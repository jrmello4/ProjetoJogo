import { Gaussian } from '../utils/gaussian.js';
import { CORNER_INSTRUCTIONS, GAME_PLANS, GAME_PLAN_EDGE } from '../config/game-config.js';
import { clamp } from '../utils/helpers.js';
import { StyleService } from '../services/style-service.js';

export class SimulationEngine {
  // Styles make fights. O plano de jogo é lido contra o adversário REAL —
  // o jogador só sabe o que estudou. Acertar a leitura vale +10% por round;
  // errar custa −8%. Não estudar é jogar na sorte.
  static _planEdge(plan, opponent) {
    if (!plan.strongVs && !plan.weakVs) return 0;

    const a = opponent.attributes;
    const striking = opponent.strikingScore;
    const grappling = opponent.grapplingScore;
    const gap = striking - grappling;

    const traits = new Set();
    if (gap > 6) traits.add('striker');
    else if (gap < -6) traits.add('grappler');
    if (a.cardio >= 60) traits.add('highCardio');
    else if (a.cardio <= 45) traits.add('lowCardio');
    if (a.fightIQ >= 60) traits.add('highIq');
    else if (a.fightIQ <= 45) traits.add('lowIq');
    // Épico C: novos traits baseados em atributos expandidos
    if ((a.power ?? 50) >= 65) traits.add('powerful');
    if ((a.takedowns ?? 50) >= 65) traits.add('wrestler');
    if ((a.submissionOffense ?? 50) >= 65) traits.add('submission');
    if ((a.speed ?? 50) >= 65) traits.add('fast');
    if ((a.composure ?? 50) <= 40) traits.add('nervous');

    if (plan.strongVs && traits.has(plan.strongVs)) return GAME_PLAN_EDGE.strong;
    if (plan.weakVs && traits.has(plan.weakVs)) return GAME_PLAN_EDGE.weak;
    return 0;
  }

  // Arma crua (Fase 3): uma arma nova instalada pela metade entrega o plano
  // pela metade. `factor` 0..1 puxa cada modificador de volta pra 1.0 — o
  // movimento existe, você só ainda não sabe fazer ele.
  static _scalePlan(plan, factor) {
    if (factor >= 1) return plan;
    const scale = (m) => 1 + (m - 1) * factor;
    return {
      ...plan,
      strikingMod: scale(plan.strikingMod),
      grapplingMod: scale(plan.grapplingMod),
      cardioMod: scale(plan.cardioMod),
      chinMod: scale(plan.chinMod),
    };
  }

  // cornerHooks (opcional): { onRoundEnd: async ({round, roundResult, totalScoreA, totalScoreB}) => instructionKey }
  // Só afeta o córner A (sempre o lutador do jogador, por convenção do WorldService).
  // Sem cornerHooks, o comportamento é idêntico ao automático de sempre.
  // gamePlanKey: escolhido antes da luta, vale por todos os rounds; a
  // instrução de córner ajusta por cima, round a round.
  // `dateISO`: data-no-jogo da luta (derivada da semana atual). Sem ela, todo
  // evento simulado num fast-forward levava o relógio real — e "todo mundo lutava
  // no mesmo dia". O chamador (WorldService) passa absWeekToDate(semana).
  // `fiveRounds`: formato real do MMA — main events/títulos vão a 5 rounds,
  // o resto vai a 3. `pressureLevel` (0-100, §C.3): o quanto esta luta pesa
  // psicologicamente — título, reencontro, sequência em risco. Escala
  // `pressurePerformer`/`bigEventNervous`/composure em vez de tudo-ou-nada;
  // antes disto, "pressão" era o mesmo booleano que decidia rounds (isBigEvent).
  // `tactics` (Fase 3, opcional): o resultado de TapeService.resolveTactics —
  // { opponentPlanKey, edgeA, edgeB, planModFactorA }. É por aqui que o
  // adversário deixa de lutar sem plano nenhum e passa a trazer um counter
  // contra o que ele leu na sua fita. Sem `tactics`, o comportamento é
  // idêntico ao de antes: a IA luta equilibrada e sem vantagem. A mudança é
  // aditiva de propósito — todo call site antigo continua válido.
  static async simulateFight(fighterA, fighterB, fiveRounds = false, cornerHooks = null, gamePlanKey = 'balanced', dateISO = null, pressureLevel = 0, tactics = null) {
    const profileA = StyleService.resolveFighter(fighterA);
    const profileB = StyleService.resolveFighter(fighterB);
    const matchup = StyleService.resolveMatchup(profileA, profileB);
    const maxRounds = fiveRounds ? 5 : 3;
    const rounds = [];
    let totalScoreA = 0, totalScoreB = 0;

    const rawPlan = GAME_PLANS[gamePlanKey] || GAME_PLANS.balanced;
    const plan = this._scalePlan(rawPlan, tactics?.planModFactorA ?? 1);
    const planEdge = tactics ? tactics.edgeA : this._planEdge(plan, fighterB);

    // O adversário agora tem plano de jogo — o dele é escolhido pela leitura
    // que ele fez de VOCÊ (TapeService), não por atributos seus.
    const planB = GAME_PLANS[tactics?.opponentPlanKey] || GAME_PLANS.balanced;
    const planEdgeB = tactics ? tactics.edgeB : 0;

    // Cumulative stats
    const stats = {
      sigStrikesA: 0, sigStrikesB: 0,
      knockdownsA: 0, knockdownsB: 0,
      takedownsA: 0, takedownsB: 0,
      subAttemptsA: 0, subAttemptsB: 0,
      controlTimeA: 0, controlTimeB: 0, // seconds
    };

    let staminaA = 100, staminaB = 100;
    let winner = null, loser = null;
    let isDraw = false;
    let finishMethod = null, finishRound = 0;
    let cornerInstruction = 'balanced';
    let staminaDebtA = 0, staminaDebtB = 0;

    // AI corner instruction — heuristic based on the opponent's style so the
    // AI fighter does not fight with flat 1.0 every round (was null / missing).
    const aiStyle = fighterB.style;
    let cornerInstructionB = 'balanced';
    if (aiStyle === 'boxer' || aiStyle === 'muayThai') cornerInstructionB = 'aggressive';
    else if (aiStyle === 'wrestler' || aiStyle === 'bjj') cornerInstructionB = 'balanced';

    for (let r = 1; r <= maxRounds; r++) {
      if (winner) break; // fight already finished

      // §C.2 — "lutar no instinto": bypassa o córner por completo. Em vez de
      // um CORNER_INSTRUCTIONS fixo, os mods vêm dinamicamente de
      // composure/fightIQ do PRÓPRIO lutador (ver _instinctMod). Escolhido
      // dinâmico (não uma entrada estática em CORNER_INSTRUCTIONS) porque o
      // efeito precisa escalar com o lutador que está lutando, não ser um
      // valor único pra todo mundo — diff pequeno aqui, e evita inflar o
      // catálogo de instruções "de verdade" com uma opção que não é conselho
      // de ninguém.
      const cornerModA = cornerInstruction === 'instinct'
        ? this._instinctMod(fighterA)
        : (CORNER_INSTRUCTIONS[cornerInstruction] || CORNER_INSTRUCTIONS.balanced);
      const cornerModB = CORNER_INSTRUCTIONS[cornerInstructionB] || CORNER_INSTRUCTIONS.balanced;
      const staminaDecayA = (profileA?.mods.staminaDecayReduction || 1);
      const staminaDecayB = (profileB?.mods.staminaDecayReduction || 1);
      const staminaFactorA = Math.max(10, staminaA * (1 - (r - 1) * 0.12 * staminaDecayA) - staminaDebtA);
      const staminaFactorB = Math.max(10, staminaB * (1 - (r - 1) * 0.12 * staminaDecayB) - staminaDebtB);

      const perfA = this._calcRoundPerformance(fighterA, fighterB, pressureLevel, staminaFactorA, cornerModA, plan, planEdge, profileA, matchup.bonusA);
      const perfB = this._calcRoundPerformance(fighterB, fighterA, pressureLevel, staminaFactorB, cornerModB, planB, planEdgeB, profileB, matchup.bonusB);

      // Track total scores for decision
      totalScoreA += perfA.score;
      totalScoreB += perfB.score;

      // Round stats generation
      const roundStats = this._genRoundStats(fighterA, fighterB, perfA, perfB, r, profileA, profileB);
      const roundLog = this._genRoundBeats(fighterA, fighterB, roundStats);
      stats.sigStrikesA += roundStats.sigStrikesA;
      stats.sigStrikesB += roundStats.sigStrikesB;
      stats.knockdownsA += roundStats.knockdownsA;
      stats.knockdownsB += roundStats.knockdownsB;
      stats.takedownsA += roundStats.takedownsA;
      stats.takedownsB += roundStats.takedownsB;
      stats.subAttemptsA += roundStats.subAttemptsA;
      stats.subAttemptsB += roundStats.subAttemptsB;

      // 10-point must: quem vence o round leva 10, o outro leva 9 (round
      // normal), 8 (dominação) ou 7 (atropelo raro). 10-10 existe mas é
      // raríssimo — juiz de MMA é instruído a escolher um vencedor. A versão
      // anterior só testava diff positivo (B era incapaz de VENCER um round
      // no cartão) e o knockdown rebaixava o 10 do vencedor, gerando 9-9.
      // Agora o knockdown pesa na DECISÃO do round, como um juiz faria.
      const diff = perfA.score - perfB.score;
      const kdSwing = (roundStats.knockdownsA - roundStats.knockdownsB) * 12;
      const effDiff = diff + kdSwing;
      const margin = Math.abs(effDiff);
      // Thresholds calibrados na distribuição real de margens da simulação
      // (mediana ~23, p90 ~53, p99 ~73): 10-8 em ~10% dos rounds, 10-7 ~1%.
      let loseScore;
      if (margin > 75) loseScore = 7;                       // atropelo histórico
      else if (margin > 52) loseScore = 8;                  // round dominante
      else if (margin > 1.5) loseScore = 9;                 // round claro/apertado
      else loseScore = Math.random() < 0.05 ? 10 : 9;       // quase-empate: 10-10 raro
      let scoreA, scoreB;
      if (effDiff >= 0) { scoreA = 10; scoreB = loseScore; }
      else { scoreB = 10; scoreA = loseScore; }

      // Track control time (simplified: based on takedowns)
      stats.controlTimeA += roundStats.takedownsA * 30; // 30 sec per takedown
      stats.controlTimeB += roundStats.takedownsB * 30;

      // Check for finish this round
      const finish = this._checkRoundFinish(fighterA, fighterB, perfA, perfB, diff, r, roundStats, cornerModA, plan, planB);
      if (finish) {
        winner = finish.winner;
        loser = finish.loser;
        finishMethod = finish.method;
        finishRound = r;
        // O momento do desfecho é o beat mais importante da luta — sem ele o
        // Live Fight Hub mostra "Fim da luta!" sem dizer o que aconteceu.
        roundLog.push({
          type: 'finish',
          fighterId: winner.id,
          detail: finish.method === 'KO'
            ? `${winner.name} APAGA ${loser.name}! Nocaute brutal no round ${r}!`
            : finish.method === 'TKO'
              ? `${winner.name} castiga ${loser.name} até o árbitro intervir — TKO no round ${r}!`
              : `${winner.name} FINALIZA ${loser.name}! Acabou no round ${r}!`,
        });
        // Add the round score anyway
        rounds.push({
          round: r,
          scoreA: finish.winner.id === fighterA.id ? scoreA : scoreB,
          scoreB: finish.winner.id === fighterA.id ? scoreB : scoreA,
          margin,
          ...roundStats,
          finished: true,
          finishMethod: finish.method,
          roundLog,
        });
        break;
      }

      rounds.push({
        round: r,
        scoreA, scoreB,
        margin,
        ...roundStats,
        finished: false,
        roundLog,
      });

      // O ritmo escolhido no córner cobra seu preço (ou ajuda) no fôlego dos rounds seguintes
      staminaDebtA += (cornerModA.fatigueMod - 1) * 15;

      // Stamina base decai a cada round
      staminaA = Math.max(15, staminaA - 10);
      staminaB = Math.max(15, staminaB - 10);

      if (cornerHooks?.onRoundEnd && r < maxRounds) {
        // Cartões oficiais parciais (10-point must acumulado) — é isto que o
        // córner de verdade sabe entre rounds, não a "performance bruta".
        const cardA = rounds.reduce((s, rd) => s + rd.scoreA, 0);
        const cardB = rounds.reduce((s, rd) => s + rd.scoreB, 0);
        const chosen = await cornerHooks.onRoundEnd({
          round: r,
          roundResult: rounds[rounds.length - 1],
          totalScoreA: Math.round(totalScoreA),
          totalScoreB: Math.round(totalScoreB),
          cardA,
          cardB,
        });
        // 'instinct' não é uma chave de CORNER_INSTRUCTIONS (ver _instinctMod)
        // — sem este ramo, o lookup abaixo a rejeitaria como desconhecida e a
        // escolha do jogador seria silenciosamente ignorada.
        if (chosen === 'instinct') cornerInstruction = 'instinct';
        else if (chosen && CORNER_INSTRUCTIONS[chosen]) cornerInstruction = chosen;
      }
    }

    // Sem finish → decisão dos juízes, computada DOS CARTÕES (10-point must).
    // A versão anterior somava performance bruta — o jogador via os rounds
    // no placar e o veredito podia contradizê-los.
    let scorecards = null;
    if (!winner) {
      // 3 juízes: cada um pontua os rounds. Em round apertado (margin <= 4)
      // um juiz pode ter visto o round pro outro lado.
      scorecards = [0, 1, 2].map(() => {
        let a = 0, b = 0;
        for (const rd of rounds) {
          let sA = rd.scoreA, sB = rd.scoreB;
          if ((rd.margin ?? 99) <= 6 && sA !== sB && Math.random() < 0.15) {
            const t = sA; sA = sB; sB = t; // divergência do juiz
          }
          a += sA; b += sB;
        }
        return { a, b };
      });

      const votesA = scorecards.filter(j => j.a > j.b).length;
      const votesB = scorecards.filter(j => j.b > j.a).length;
      const evenCards = 3 - votesA - votesB;

      // Regra real do MMA: só vence quem tem MAIORIA (2 de 3 juízes). A
      // versão anterior declarava vencedor sempre que votesA !== votesB —
      // 1 voto a 0 (com 2 cartões empatados) já bastava, tornando empate
      // matematicamente impossível mesmo com fighter.record.draws existindo
      // no modelo e sendo exibido em todas as telas (sempre 0).
      if (votesA >= 2 || votesB >= 2) {
        const aWins = votesA >= 2;
        winner = aWins ? fighterA : fighterB;
        loser = winner === fighterA ? fighterB : fighterA;
        const winVotes = aWins ? votesA : votesB;
        finishMethod = winVotes === 3
          ? 'Decision (Unanimous)'
          : evenCards === 1
            ? 'Decision (Majority)'
            : 'Decision (Split)';
      } else {
        // Nenhum lado tem maioria — empate. Sub-tipo segue a nomenclatura
        // oficial: unânime (3 cartões empatados), majoritário (1 juiz viu
        // um vencedor, 2 empataram) ou dividido (1 pra cada lado + 1 empatado).
        isDraw = true;
        finishMethod = evenCards === 3
          ? 'Decision (Draw)'
          : evenCards === 2
            ? 'Decision (Majority Draw)'
            : 'Decision (Split Draw)';
      }
      finishRound = maxRounds;
    }

    const result = {
      id: null,
      fighterAId: fighterA.id,
      fighterBId: fighterB.id,
      fighterAName: fighterA.name,
      fighterBName: fighterB.name,
      winnerId: isDraw ? null : winner.id,
      winnerName: isDraw ? null : winner.name,
      loserId: isDraw ? null : loser.id,
      loserName: isDraw ? null : loser.name,
      isDraw,
      method: finishMethod,
      round: finishRound,
      eventId: null,
      date: dateISO || new Date().toISOString(),
      stats,
      rounds,
      totalScoreA: Math.round(totalScoreA),
      totalScoreB: Math.round(totalScoreB),
      scorecards, // [{a,b} x3] em decisões; null em finish
    };

    if (isDraw) {
      this._updateFighter(fighterA, fighterB, 'draw', { method: finishMethod }, finishRound, dateISO);
      this._updateFighter(fighterB, fighterA, 'draw', { method: finishMethod }, finishRound, dateISO);
      this._updatePopularity(fighterA, fighterB, { method: finishMethod }, 'draw');
      this._updatePopularity(fighterB, fighterA, { method: finishMethod }, 'draw');
      fighterA.applyPostFightEffects();
      fighterB.applyPostFightEffects();
      // Empate nunca é decidido por nocaute/finalização — sem dano acumulado (E2).
    } else {
      this._updateFighter(winner, loser, 'win', { method: finishMethod }, finishRound, dateISO);
      this._updateFighter(loser, winner, 'loss', { method: finishMethod }, finishRound, dateISO);
      this._updatePopularity(winner, loser, { method: finishMethod }, 'win');
      this._updatePopularity(loser, winner, { method: finishMethod }, 'loss');
      winner.applyPostFightEffects();
      loser.applyPostFightEffects();

      // E2: dano acumulado — cada derrota por KO/TKO raspa chin e durability permanentemente
      this._applyAccumulatedDamage(winner, loser, result);
    }

    return result;
  }

  // Épico E2: derrota por KO/TKO causa dano permanente
  static _applyAccumulatedDamage(winner, loser, result) {
    const method = result.method;
    if (!method || method.startsWith('Decision')) return;

    // Quem perdeu por nocaute sofre dano
    const loserPerf = loser.id === result.fighterAId
      ? { score: result.totalScoreA }
      : { score: result.totalScoreB };

    if (method === 'KO' || method === 'TKO') {
      const damage = method === 'KO'
        ? Math.floor(Math.random() * 4) + 2  // 2-5 pontos (era 3-7, reduzido para evitar que duas lutas destruam o chin)
        : Math.floor(Math.random() * 3) + 1; // 1-3 pontos

      loser.attributes.chin = clamp(loser.attributes.chin - damage, 1, 99);
      loser.attributes.durability = clamp(loser.attributes.durability - Math.floor(damage * 0.7), 1, 99);
    }
  }

  // §C.2 — "lutar no instinto": nenhum bônus/penalidade de córner, nenhuma
  // leitura (certa ou errada) de ninguém além do próprio lutador. Em vez
  // disso, escala em torno de 1.0 conforme composure/fightIQ — quem tem a
  // cabeça no lugar e lê bem o jogo se vira sozinho tão bem quanto (ou
  // melhor) que um bom conselho; quem não tem, sofre um pouco por decidir
  // tudo sozinho no calor da luta. fatigueMod tem um custo mínimo (1.05) —
  // instinto não impõe um ritmo artificial, mas decidir tudo no calor da luta
  // ainda cobra fôlego. Antes era 1.0 (neutro), o que tornava instinto
  // estritamente superior a todas as outras opções para fighters com
  // composure+fightIQ > 110 (fix de balanceamento).
  static _instinctMod(fighter) {
    const composure = fighter.attributes.composure ?? 50;
    const fightIQ = fighter.attributes.fightIQ ?? 50;
    const selfReliance = (composure + fightIQ) / 2;
    // ~0.8x em 0, 1.0x em 50, ~1.2x em 100 — mesma ordem de grandeza dos
    // mods dinâmicos já usados em _calcRoundPerformance (ex: strikingPower).
    const factor = 1 + (selfReliance - 50) / 250;
    return {
      label: 'Instinto', icon: '🧭', desc: 'Sem córner — só a sua própria leitura da luta.',
      strikingMod: factor,
      grapplingMod: factor,
      fatigueMod: 1.05,
      chinMod: factor,
    };
  }

  static _calcRoundPerformance(fighter, opponent, pressureLevel, staminaFactor, cornerMod = null, plan = null, planEdge = 0, profile = null, matchupBonus = 0) {
    const corner = cornerMod || CORNER_INSTRUCTIONS.balanced;
    const game = plan || GAME_PLANS.balanced;
    const prof = profile || StyleService.resolveFighter(fighter);
    const mods = prof.mods;
    const fatiguePenalty = 1 - (fighter.fatigue / 200);
    const moraleFactor = 0.7 + (fighter.morale / 100) * 0.3;
    const determinationFactor = 0.8 + (fighter.hidden.determination / 100) * 0.2;

    // Stamina decays over rounds
    const staminaEffect = staminaFactor / 100;

    // Épico C: novos atributos expandidos
    const a = fighter.attributes;

    // Fôlego: recovery ajuda a manter stamina entre rounds
    const recoveryBonus = 1 + (a.recovery ?? 50) / 200;
    const adjustedStamina = staminaEffect * recoveryBonus;

    // Plano de jogo (a luta inteira) × instrução de córner (este round)
    const technique = fighter.techniqueScore * fatiguePenalty * adjustedStamina;
    const cardio = a.cardio * fatiguePenalty * moraleFactor * adjustedStamina * game.cardioMod;
    const iq = a.fightIQ * determinationFactor;

    // Striking: boxing/kickboxing/muayThai + power, footwork, headMovement, clinch, speed, aggression
    const strikingPower = 1 + (a.power ?? 50) / 200;
    const strikingDefense = 1 + ((a.footwork ?? 50) + (a.headMovement ?? 50)) / 400;
    const strikingSpeed = 1 + (a.speed ?? 50) / 200;
    const aggressionMod = 1 + ((a.aggression ?? 50) - 50) / 200;
    const clinchFactor = 1 + (a.clinch ?? 50) / 300;

    const striking = fighter.strikingScore * fatiguePenalty * adjustedStamina
      * corner.strikingMod * game.strikingMod
      * strikingPower * strikingSpeed * aggressionMod;

    // Grappling: wrestling/bjj + takedowns, takedownDefense, groundControl, submissionOffense, strength
    const tdPower = 1 + (a.takedowns ?? 50) / 200;
    const tdDefense = 1 + (a.takedownDefense ?? 50) / 300;
    const groundBonus = 1 + (a.groundControl ?? 50) / 300;
    const strengthMod = 1 + (a.strength ?? 50) / 300;
    const subOff = (a.submissionOffense ?? 50) / 100;
    const subDef = (a.submissionDefense ?? 50) / 100;

    const grappling = fighter.grapplingScore * fatiguePenalty * adjustedStamina
      * corner.grapplingMod * game.grapplingMod
      * tdPower * groundBonus * strengthMod;

    // Chin + durability (novo): resistência a nocautes
    const chin = a.chin * (1 + ((a.durability ?? 50) - 50) / 200);

    // Adaptability: melhora o plano de jogo quanto mais dura a luta
    const adaptBonus = 1 + ((a.adaptability ?? 50) - 50) / 300;

    // Composure: ajuda em big events e decisões apertadas
    const composureFactor = 1 + ((a.composure ?? 50) - 50) / 200;

    const styleAdvantage = matchupBonus;

    const baseScore =
      technique * 0.2 +
      striking * 0.2 +
      grappling * 0.15 +
      cardio * 0.1 +
      iq * 0.1 +
      chin * 0.05 +
      styleAdvantage * 5 +
      // Novos atributos contribuem para o score base
      (a.power ?? 50) * 0.02 +
      (a.speed ?? 50) * 0.02 +
      (a.strength ?? 50) * 0.01;

    const noise = Gaussian.random(0, 6);
    // A leitura do adversário: acertar o plano paga, errar cobra.
    let finalScore = (baseScore + noise) * (1 + planEdge * adaptBonus);

    // DNA traits + composure escalam com a pressão da luta (§C.3) em vez
    // de tudo-ou-nada — um título pesa mais que uma luta regional de tier 1.
    const pressureFactor = Math.max(0, Math.min(100, pressureLevel || 0)) / 100;
    if (pressureFactor > 0) {
      if (fighter.dna.pressurePerformer) finalScore *= 1 + 0.10 * pressureFactor;
      if (fighter.dna.bigEventNervous) finalScore *= 1 - 0.10 * pressureFactor;
      finalScore *= 1 + (composureFactor - 1) * pressureFactor;
    }

    return {
      score: Math.max(0, finalScore),
      striking,
      grappling,
      cardio,
      iq,
      chin,
      technique,
      // Novos para _genRoundStats
      power: a.power ?? 50,
      footwork: a.footwork ?? 50,
      headMovement: a.headMovement ?? 50,
      takedowns: a.takedowns ?? 50,
      submissionOffense: a.submissionOffense ?? 50,
      submissionDefense: a.submissionDefense ?? 50,
      speed: a.speed ?? 50,
      aggression: a.aggression ?? 50,
      durability: a.durability ?? 50,
      groundControl: a.groundControl ?? 50,
      strength: a.strength ?? 50,
      composure: a.composure ?? 50,
    };
  }

  static _genRoundStats(fighterA, fighterB, perfA, perfB, round, profileA = null, profileB = null) {
    // Generate realistic-looking MMA stats per round
    // Épico C: agressão aumenta volume, footwork/headMovement reduzem acertos sofridos
    const aggressionModA = 0.8 + (perfA.aggression / 100) * 0.4;
    const aggressionModB = 0.8 + (perfB.aggression / 100) * 0.4;
    const defenseModA = 1 - ((perfA.footwork + perfA.headMovement) / 2) / 400;
    const defenseModB = 1 - ((perfB.footwork + perfB.headMovement) / 2) / 400;

    const strikeBaseA = Math.max(3, perfA.striking * 1.5 * aggressionModA * defenseModB + Gaussian.random(0, 5));
    const strikeBaseB = Math.max(3, perfB.striking * 1.5 * aggressionModB * defenseModA + Gaussian.random(0, 5));

    const sigStrikesA = Math.round(strikeBaseA * (0.5 + Math.random() * 0.5));
    const sigStrikesB = Math.round(strikeBaseB * (0.5 + Math.random() * 0.5));

    // Knockdowns: power + striking differential
    const powerFactorA = perfA.power / 100;
    const powerFactorB = perfB.power / 100;
    const kdBonusA = (profileA?.mods.kdChanceBonus || 0);
    const kdBonusB = (profileB?.mods.kdChanceBonus || 0);
    const kdChanceA = Math.max(0, (perfA.striking - perfB.striking) * 0.02 * powerFactorA - 0.1 + Math.random() * 0.08 + kdBonusA);
    const kdChanceB = Math.max(0, (perfB.striking - perfA.striking) * 0.02 * powerFactorB - 0.1 + Math.random() * 0.08 + kdBonusB);

    // Takedowns: takedowns skill + strength + grappling differential
    const tdSkillA = perfA.takedowns / 100;
    const tdSkillB = perfB.takedowns / 100;
    const strengthFactorA = perfA.strength / 100;
    const strengthFactorB = perfB.strength / 100;
    const tdChanceA = Math.max(0, (perfA.grappling - perfB.grappling) * 0.01 * tdSkillA * strengthFactorA + Math.random() * 0.08);
    const tdChanceB = Math.max(0, (perfB.grappling - perfA.grappling) * 0.01 * tdSkillB * strengthFactorB + Math.random() * 0.08);

    // Submission attempts: submissionOffense + groundControl
    const subOffA = perfA.submissionOffense / 100;
    const subOffB = perfB.submissionOffense / 100;
    const gcA = perfA.groundControl / 100;
    const gcB = perfB.groundControl / 100;
    const subChanceA = tdChanceA * 0.3 * subOffA * gcA;
    const subChanceB = tdChanceB * 0.3 * subOffB * gcB;

    return {
      sigStrikesA,
      sigStrikesB,
      knockdownsA: Math.random() < kdChanceA ? 1 : 0,
      knockdownsB: Math.random() < kdChanceB ? 1 : 0,
      takedownsA: Math.random() < tdChanceA ? 1 : 0,
      takedownsB: Math.random() < tdChanceB ? 1 : 0,
      subAttemptsA: Math.random() < subChanceA ? 1 : 0,
      subAttemptsB: Math.random() < subChanceB ? 1 : 0,
    };
  }

  // Fase 2 (Live Fight Hub): extrai os "momentos" de destaque de um round
  // a partir das estatísticas já calculadas. Só apresentação — não altera o
  // resultado da luta.
  static _genRoundBeats(fighterA, fighterB, roundStats) {
    const beats = [];
    if (roundStats.knockdownsA > 0) {
      beats.push({ type: 'knockdown', fighterId: fighterA.id, detail: `${fighterA.name} derruba ${fighterB.name} com um knockdown devastador!` });
    }
    if (roundStats.knockdownsB > 0) {
      beats.push({ type: 'knockdown', fighterId: fighterB.id, detail: `${fighterB.name} responde com um knockdown em ${fighterA.name}!` });
    }
    if (roundStats.subAttemptsA > 0) {
      beats.push({ type: 'sub_attempt', fighterId: fighterA.id, detail: `${fighterA.name} tenta finalização e coloca ${fighterB.name} em apuros!` });
    }
    if (roundStats.subAttemptsB > 0) {
      beats.push({ type: 'sub_attempt', fighterId: fighterB.id, detail: `${fighterB.name} arrisca uma finalização em ${fighterA.name}!` });
    }
    if (roundStats.takedownsA > 0) {
      beats.push({ type: 'takedown', fighterId: fighterA.id, detail: `${fighterA.name} leva a luta ao chão com uma queda precisa.` });
    }
    if (roundStats.takedownsB > 0) {
      beats.push({ type: 'takedown', fighterId: fighterB.id, detail: `${fighterB.name} acerta a queda em ${fighterA.name}.` });
    }
    return beats;
  }

  // `planB` (Fase 3): o adversário agora traz plano, então o chinMod dele
  // também protege o queixo dele. Sem isso, o counter que ele monta contra a
  // sua fita só valeria na ofensiva — e um plano defensivo não defenderia nada.
  static _checkRoundFinish(fighterA, fighterB, perfA, perfB, diff, round, roundStats, cornerModA = null, plan = null, planB = null) {
    const finishChance = Math.min(0.4, 0.05 + Math.abs(diff) * 0.008);

    if (Math.random() > finishChance * (1 + round * 0.1)) return null;

    // Who gets finished? The one with lower performance
    const loser = perfA.score < perfB.score ? fighterA : (perfB.score < perfA.score ? fighterB : (Math.random() < 0.5 ? fighterA : fighterB));
    const winner = loser === fighterA ? fighterB : fighterA;
    const loserPerf = loser === fighterA ? perfA : perfB;
    const winnerPerf = loser === fighterA ? perfB : perfA;

    const strikeDiff = winnerPerf.striking - loserPerf.striking;
    const grappleDiff = winnerPerf.grappling - loserPerf.grappling;

    // Épico C: chin + durability determinam resistência a nocautes
    let chinFactor = (loser.attributes.chin / 100) * (1 + ((loserPerf.durability ?? 50) - 50) / 200);
    if (loser === fighterA) {
      if (cornerModA) chinFactor *= cornerModA.chinMod;
      if (plan) chinFactor *= plan.chinMod;
    } else if (planB) {
      chinFactor *= planB.chinMod;
    }

    // Submissão: subOffense do vencedor vs subDefense do perdedor
    const subAdvantage = (winnerPerf.submissionOffense / 100) - (loserPerf.submissionDefense / 100);

    // Power do vencedor aumenta KO chance
    const powerMod = 1 + (winnerPerf.power - 50) / 200;

    const methods = [];

    // KO: high striking diff and low chin, amplified by power
    if (strikeDiff > 3 * (1 / powerMod) && chinFactor < 0.7) {
      methods.push({ method: 'KO', weight: Math.round(30 * powerMod) });
      methods.push({ method: 'TKO', weight: Math.round(40 * powerMod) });
    }

    // Submission: high grappling diff + sub advantage
    if (grappleDiff > 3 && subAdvantage > 0) {
      methods.push({ method: 'Submission', weight: Math.round(35 * (1 + subAdvantage)) });
    }

    // TKO by strikes (sempre possível com strikingDiff alto)
    if (strikeDiff > 2) {
      methods.push({ method: 'TKO', weight: 20 });
    }

    if (methods.length === 0) return null;

    // Weighted random pick
    const totalWeight = methods.reduce((s, m) => s + m.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosen = methods[0].method;
    for (const m of methods) {
      roll -= m.weight;
      if (roll <= 0) { chosen = m.method; break; }
    }

    return { winner, loser, method: chosen };
  }

  // `outcome`: 'win' | 'loss' | 'draw'
  static _updateFighter(fighter, opponent, outcome, method, round, dateISO = null) {
    if (outcome === 'win') {
      fighter.record.wins++;
      fighter.applyMoraleChange(10);
    } else if (outcome === 'draw') {
      fighter.record.draws++;
      fighter.applyMoraleChange(-2); // ninguém comemora um empate, mas não é derrota
    } else {
      fighter.record.losses++;
      fighter.applyMoraleChange(-12);
      // Épico D — KO/TKO é mais devastador que decisão para a moral
      if (method && (method.method?.startsWith('KO') || method.method?.startsWith('TKO'))) {
        fighter.applyMoraleChange(-6); // -18 total (KO abala mais)
      }
      // Decisão: moral leve (perdeu mas lutou, não foi humilhado)
    }

    fighter.applyFatigue(15 + round * 5);
    fighter.evolve();

    fighter.fights.unshift({
      opponentId: opponent.id,
      opponent: opponent.name,
      // O ranking usa isto para "qualidade das vitórias" — sem gravar, todo
      // adversário valia 50 e vencer o campeão pesava o mesmo que vencer um
      // estreante.
      opponentRating: opponent.overallRating,
      // G3: OVR do lutador no momento da luta para gráfico de carreira
      fighterRating: fighter.overallRating,
      result: outcome === 'win' ? 'W' : outcome === 'draw' ? 'D' : 'L',
      method: method.method,
      round,
      date: dateISO || new Date().toISOString(),
      // null (não false) — um empate não deve quebrar/contar como derrota
      // em nenhuma lógica que faça `=== false` em vez de checar falsy.
      won: outcome === 'win' ? true : outcome === 'draw' ? null : false,
    });

    if (fighter.fights.length > 50) {
      fighter.fights = fighter.fights.slice(0, 50);
    }
  }

  // `outcome`: 'win' | 'loss' | 'draw'
  static _updatePopularity(fighter, opponent, method, outcome) {
    let change = 0;
    if (outcome === 'win') {
      change = 2 + Math.floor(Math.random() * 4);
      if (method.method === 'KO' || method.method === 'Submission') change += 4;
      if (method.method === 'TKO') change += 2;
      if (opponent.overallRating >= 70) change += 5;
      if (opponent.overallRating >= 80) change += 5;
    } else if (outcome === 'draw') {
      change = Math.random() < 0.5 ? 0 : -1; // quase neutro
    } else {
      change = -1 - Math.floor(Math.random() * 3);
      if (opponent.overallRating >= 70) change = Math.max(change, -2);
    }
    fighter.updatePopularity(change);
  }

  static getFightBonus(results) {
    // Fight of the Night: highest combined damage/stats
    let fightOfNight = null;
    let bestTotalStats = 0;

    for (const r of results) {
      const total = (r.stats.sigStrikesA + r.stats.sigStrikesB) +
                    (r.stats.knockdownsA + r.stats.knockdownsB) +
                    (r.stats.subAttemptsA + r.stats.subAttemptsB);
      if (total > bestTotalStats) {
        bestTotalStats = total;
        fightOfNight = r;
      }
    }

    // Performance of the Night: fastest/most dominant finish
    let perfOfNight = null;
    let bestPerfScore = 0;

    for (const r of results) {
      if (r.method !== 'Decision (Unanimous)' && r.method !== 'Decision (Split)') {
        const score = (100 - r.round * 15) + Math.abs(r.totalScoreA - r.totalScoreB) * 0.5;
        if (score > bestPerfScore) {
          bestPerfScore = score;
          perfOfNight = r;
        }
      }
    }

    // Can't be both
    if (perfOfNight && perfOfNight === fightOfNight) {
      perfOfNight = null;
    }

    const bonuses = [];
    if (fightOfNight) bonuses.push({ type: 'Luta da Noite', winner: fightOfNight.winnerName, amount: 15000 });
    if (perfOfNight) bonuses.push({ type: 'Performance da Noite', winner: perfOfNight.winnerName, amount: 10000 });

    return bonuses;
  }
}
