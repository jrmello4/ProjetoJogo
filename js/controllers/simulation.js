import { Gaussian } from '../utils/gaussian.js';
import { CORNER_INSTRUCTIONS, GAME_PLANS, GAME_PLAN_EDGE } from '../config/game-config.js';

export class SimulationEngine {
  // Styles make fights. O plano de jogo é lido contra o adversário REAL —
  // o jogador só sabe o que estudou. Acertar a leitura vale +10% por round;
  // errar custa −8%. Não estudar é jogar na sorte.
  static _planEdge(plan, opponent) {
    if (!plan.strongVs && !plan.weakVs) return 0;

    const striking = opponent.strikingScore;
    const grappling = opponent.grapplingScore;
    const gap = striking - grappling;

    const traits = new Set();
    if (gap > 6) traits.add('striker');
    else if (gap < -6) traits.add('grappler');
    if (opponent.attributes.cardio >= 60) traits.add('highCardio');
    else if (opponent.attributes.cardio <= 45) traits.add('lowCardio');
    if (opponent.attributes.fightIQ >= 60) traits.add('highIq');
    else if (opponent.attributes.fightIQ <= 45) traits.add('lowIq');

    if (plan.strongVs && traits.has(plan.strongVs)) return GAME_PLAN_EDGE.strong;
    if (plan.weakVs && traits.has(plan.weakVs)) return GAME_PLAN_EDGE.weak;
    return 0;
  }

  // cornerHooks (opcional): { onRoundEnd: async ({round, roundResult, totalScoreA, totalScoreB}) => instructionKey }
  // Só afeta o córner A (sempre o lutador da academia, por convenção do WorldService).
  // Sem cornerHooks, o comportamento é idêntico ao automático de sempre.
  // gamePlanKey: escolhido antes da luta, vale por todos os rounds; a
  // instrução de córner ajusta por cima, round a round.
  static async simulateFight(fighterA, fighterB, isBigEvent = false, cornerHooks = null, gamePlanKey = 'balanced') {
    const maxRounds = 5;
    const rounds = [];
    let totalScoreA = 0, totalScoreB = 0;

    const plan = GAME_PLANS[gamePlanKey] || GAME_PLANS.balanced;
    const planEdge = this._planEdge(plan, fighterB);

    // Cumulative stats
    const stats = {
      sigStrikesA: 0, sigStrikesB: 0,
      knockdownsA: 0, knockdownsB: 0,
      takedownsA: 0, takedownsB: 0,
      subAttemptsA: 0, subAttemptsB: 0,
      controlTimeA: 0, controlTimeB: 0, // seconds
    };

    const staminaA = 100, staminaB = 100;
    let winner = null, loser = null;
    let finishMethod = null, finishRound = 0;
    let cornerInstruction = 'balanced';
    let staminaDebtA = 0;

    for (let r = 1; r <= maxRounds; r++) {
      if (winner) break; // fight already finished

      const cornerModA = CORNER_INSTRUCTIONS[cornerInstruction] || CORNER_INSTRUCTIONS.balanced;
      const staminaFactorA = Math.max(10, staminaA * (1 - (r - 1) * 0.12) - staminaDebtA);
      const staminaFactorB = staminaB * (1 - (r - 1) * 0.12);

      const perfA = this._calcRoundPerformance(fighterA, fighterB, isBigEvent, staminaFactorA, cornerModA, plan, planEdge);
      const perfB = this._calcRoundPerformance(fighterB, fighterA, isBigEvent, staminaFactorB, null);

      // Track total scores for decision
      totalScoreA += perfA.score;
      totalScoreB += perfB.score;

      // Round stats generation
      const roundStats = this._genRoundStats(fighterA, fighterB, perfA, perfB, r);
      stats.sigStrikesA += roundStats.sigStrikesA;
      stats.sigStrikesB += roundStats.sigStrikesB;
      stats.knockdownsA += roundStats.knockdownsA;
      stats.knockdownsB += roundStats.knockdownsB;
      stats.takedownsA += roundStats.takedownsA;
      stats.takedownsB += roundStats.takedownsB;
      stats.subAttemptsA += roundStats.subAttemptsA;
      stats.subAttemptsB += roundStats.subAttemptsB;

      // Score the round (10-9, 10-8, etc.)
      const diff = perfA.score - perfB.score;
      let scoreA = 10, scoreB = 10;
      if (diff > 15) { scoreA = 10; scoreB = 8; }      // dominant round
      else if (diff > 8) { scoreA = 10; scoreB = 9; }    // clear round
      else if (diff > 3) { scoreA = 10; scoreB = 9; }    // close round
      else { scoreA = 10; scoreB = 10; }                  // even round

      // Adjust scores for knockdowns
      if (roundStats.knockdownsA > 0) scoreB = Math.max(7, scoreB - 1);
      if (roundStats.knockdownsB > 0) scoreA = Math.max(7, scoreA - 1);

      // Track control time (simplified: based on takedowns)
      stats.controlTimeA += roundStats.takedownsA * 30; // 30 sec per takedown
      stats.controlTimeB += roundStats.takedownsB * 30;

      // Check for finish this round
      const finish = this._checkRoundFinish(fighterA, fighterB, perfA, perfB, diff, r, roundStats, cornerModA, plan);
      if (finish) {
        winner = finish.winner;
        loser = finish.loser;
        finishMethod = finish.method;
        finishRound = r;
        // Add the round score anyway
        rounds.push({
          round: r,
          scoreA: finish.winner.id === fighterA.id ? scoreA : scoreB,
          scoreB: finish.winner.id === fighterA.id ? scoreB : scoreA,
          ...roundStats,
          finished: true,
          finishMethod: finish.method,
        });
        break;
      }

      rounds.push({
        round: r,
        scoreA, scoreB,
        ...roundStats,
        finished: false,
      });

      // O ritmo escolhido no córner cobra seu preço (ou ajuda) no fôlego dos rounds seguintes
      staminaDebtA += (cornerModA.fatigueMod - 1) * 15;

      if (cornerHooks?.onRoundEnd && r < maxRounds) {
        const chosen = await cornerHooks.onRoundEnd({
          round: r,
          roundResult: rounds[rounds.length - 1],
          totalScoreA: Math.round(totalScoreA),
          totalScoreB: Math.round(totalScoreB),
        });
        if (chosen && CORNER_INSTRUCTIONS[chosen]) cornerInstruction = chosen;
      }
    }

    // If no finish, determine winner by decision
    if (!winner) {
      const totalDiff = totalScoreA - totalScoreB;
      if (Math.abs(totalDiff) < 5) {
        winner = Math.random() < 0.5 ? fighterA : fighterB;
        finishMethod = 'Decision (Split)';
      } else {
        winner = totalDiff > 0 ? fighterA : fighterB;
        finishMethod = 'Decision (Unanimous)';
      }
      loser = winner === fighterA ? fighterB : fighterA;
      finishRound = maxRounds;
    }

    const result = {
      id: null,
      fighterAId: fighterA.id,
      fighterBId: fighterB.id,
      fighterAName: fighterA.name,
      fighterBName: fighterB.name,
      winnerId: winner.id,
      winnerName: winner.name,
      loserId: loser.id,
      loserName: loser.name,
      method: finishMethod,
      round: finishRound,
      eventId: null,
      date: new Date().toISOString(),
      stats,
      rounds,
      totalScoreA: Math.round(totalScoreA),
      totalScoreB: Math.round(totalScoreB),
    };

    this._updateFighter(winner, loser, true, { method: finishMethod }, finishRound);
    this._updateFighter(loser, winner, false, { method: finishMethod }, finishRound);

    // Post-fight effects
    this._updatePopularity(winner, loser, { method: finishMethod }, true);
    this._updatePopularity(loser, winner, { method: finishMethod }, false);
    winner.applyPostFightEffects();
    loser.applyPostFightEffects();

    return result;
  }

  static _calcRoundPerformance(fighter, opponent, isBigEvent, staminaFactor, cornerMod = null, plan = null, planEdge = 0) {
    const corner = cornerMod || CORNER_INSTRUCTIONS.balanced;
    const game = plan || GAME_PLANS.balanced;
    const fatiguePenalty = 1 - (fighter.fatigue / 200);
    const moraleFactor = 0.7 + (fighter.morale / 100) * 0.3;
    const determinationFactor = 0.8 + (fighter.hidden.determination / 100) * 0.2;

    // Stamina decays over rounds
    const staminaEffect = staminaFactor / 100;

    // Plano de jogo (a luta inteira) × instrução de córner (este round)
    const technique = fighter.techniqueScore * fatiguePenalty * staminaEffect;
    const cardio = fighter.attributes.cardio * fatiguePenalty * moraleFactor * staminaEffect * game.cardioMod;
    const iq = fighter.attributes.fightIQ * determinationFactor;
    const chin = fighter.attributes.chin;
    const striking = fighter.strikingScore * fatiguePenalty * staminaEffect * corner.strikingMod * game.strikingMod;
    const grappling = fighter.grapplingScore * fatiguePenalty * staminaEffect * corner.grapplingMod * game.grapplingMod;

    const styleAdvantage = this._styleMatchup(fighter, opponent);

    const baseScore =
      technique * 0.25 +
      striking * 0.2 +
      grappling * 0.15 +
      cardio * 0.15 +
      iq * 0.15 +
      chin * 0.05 +
      styleAdvantage * 5;

    const noise = Gaussian.random(0, 6);
    // A leitura do adversário: acertar o plano paga, errar cobra.
    let finalScore = (baseScore + noise) * (1 + planEdge);

    // DNA traits for big events
    if (isBigEvent) {
      if (fighter.dna.pressurePerformer) finalScore *= 1.10;
      if (fighter.dna.bigEventNervous) finalScore *= 0.90;
    }

    return {
      score: Math.max(0, finalScore),
      striking,
      grappling,
      cardio,
      iq,
      chin,
      technique,
    };
  }

  static _genRoundStats(fighterA, fighterB, perfA, perfB, round) {
    // Generate realistic-looking MMA stats per round
    const strikeBaseA = Math.max(5, perfA.striking * 1.5 + Gaussian.random(0, 5));
    const strikeBaseB = Math.max(5, perfB.striking * 1.5 + Gaussian.random(0, 5));

    const sigStrikesA = Math.round(strikeBaseA * (0.5 + Math.random() * 0.5));
    const sigStrikesB = Math.round(strikeBaseB * (0.5 + Math.random() * 0.5));

    // Knockdowns: rare, based on striking differential
    const kdChanceA = Math.max(0, (perfA.striking - perfB.striking) * 0.02 - 0.1 + Math.random() * 0.08);
    const kdChanceB = Math.max(0, (perfB.striking - perfA.striking) * 0.02 - 0.1 + Math.random() * 0.08);

    // Takedowns: based on grappling score
    const tdChanceA = Math.max(0, (perfA.grappling - perfB.grappling) * 0.01 + Math.random() * 0.08);
    const tdChanceB = Math.max(0, (perfB.grappling - perfA.grappling) * 0.01 + Math.random() * 0.08);

    // Submission attempts: based on BJJ/grappling
    const subChanceA = tdChanceA * 0.3;
    const subChanceB = tdChanceB * 0.3;

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

  static _checkRoundFinish(fighterA, fighterB, perfA, perfB, diff, round, roundStats, cornerModA = null, plan = null) {
    const finishChance = Math.min(0.4, 0.05 + Math.abs(diff) * 0.008);

    if (Math.random() > finishChance * (1 + round * 0.1)) return null;

    // Who gets finished? The one with lower performance
    const loser = perfA.score < perfB.score ? fighterA : fighterB;
    const winner = loser === fighterA ? fighterB : fighterA;
    const loserPerf = loser === fighterA ? perfA : perfB;
    const winnerPerf = loser === fighterA ? perfB : perfA;

    const strikeDiff = winnerPerf.striking - loserPerf.striking;
    const grappleDiff = winnerPerf.grappling - loserPerf.grappling;
    let chinFactor = loser.attributes.chin / 100;
    // Plano de jogo e instrução de córner mudam o quanto o SEU atleta expõe
    // o queixo. O adversário luta no automático.
    if (loser === fighterA) {
      if (cornerModA) chinFactor *= cornerModA.chinMod;
      if (plan) chinFactor *= plan.chinMod;
    }

    const methods = [];

    // KO: high striking diff and low chin
    if (strikeDiff > 3 && chinFactor < 0.7) {
      methods.push({ method: 'KO', weight: 30 });
      methods.push({ method: 'TKO', weight: 40 });
    }

    // Submission: high grappling diff
    if (grappleDiff > 3) {
      methods.push({ method: 'Submission', weight: 35 });
    }

    // TKO by strikes
    methods.push({ method: 'TKO', weight: 20 });

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

  static _styleMatchup(attacker, defender) {
    let advantage = 0;
    if (attacker.fightingStyle === 'Wrestling' && defender.fightingStyle === 'Boxing') advantage += 3;
    else if (attacker.fightingStyle === 'BJJ' && defender.fightingStyle === 'Kickboxing') advantage += 3;
    else if (attacker.fightingStyle === 'Boxing' && defender.fightingStyle === 'BJJ') advantage += 2;
    else if (attacker.fightingStyle === 'Kickboxing' && defender.fightingStyle === 'Wrestling') advantage += 2;

    const skillDiff = attacker.techniqueScore - defender.techniqueScore;
    advantage += skillDiff * 0.1;
    return advantage;
  }

  static _updateFighter(fighter, opponent, won, method, round) {
    if (won) {
      fighter.record.wins++;
      fighter.applyMoraleChange(10);
    } else {
      fighter.record.losses++;
      fighter.applyMoraleChange(-12);
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
      result: won ? 'W' : 'L',
      method: method.method,
      round,
      date: new Date().toISOString(),
      won,
    });

    if (fighter.fights.length > 50) {
      fighter.fights = fighter.fights.slice(0, 50);
    }
  }

  static _updatePopularity(fighter, opponent, method, won) {
    let change = 0;
    if (won) {
      change = 2 + Math.floor(Math.random() * 4);
      if (method.method === 'KO' || method.method === 'Submission') change += 4;
      if (method.method === 'TKO') change += 2;
      if (opponent.overallRating >= 70) change += 5;
      if (opponent.overallRating >= 80) change += 5;
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
