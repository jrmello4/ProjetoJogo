import { clamp, formatWeeks } from '../utils/helpers.js';
import { CAMP_CONFIG, TAPE_CONFIG, PLAN_SPECIALTY, INJURY_CONFIG, rollInjurySeverity } from '../config/game-config.js';
import { TapeService } from '../services/tape-service.js';
import { TrainingPartnersService } from '../services/training-partners-service.js';
import { ACTIVE_CARDS } from '../config/card-config.js';

// Task 9 — pools de carta por especialidade de academia. Academias não têm
// um campo categórico ('striking'/'grappling'/'balanced'): elas têm
// `specialties.{striking,grappling,cardio}`, valores numéricos (ver
// ACADEMIES em game-config.js, faixa observada ~0–0.30). `_academyCardPool`
// converte isso na chave categórica usando o mesmo espírito de
// `_getArchetype` (comparar as duas pontas e olhar o gap).
export const ACADEMY_CARD_POOLS = {
  // Academias têm pools de carta baseados na especialidade
  striking: { active: ['jab', 'cross', 'overhand', 'highKick', 'legKick'] },
  grappling: { active: ['doubleLeg', 'singleLeg', 'clinchKnee', 'rearNaked', 'armbar'] },
  balanced: { active: ['jab', 'cross', 'doubleLeg', 'takedownDefense', 'legKick'] },
};

// Épico D: Acampamento de verdade.
// O camp deixa de ser um botão manual e vira uma configuração que roda
// dentro do loop semanal (_applyWeeklyTraining). Você configura uma vez
// (intensidade + foco + sparring partner) e o treino acontece semana a
// semana até a luta — ou até você mudar a configuração.
export class TrainingCamp {
  // ===== Configuração =====
  // Define o camp para o fighter. Só permitido se ele tem luta marcada
  // (intensity === 'intense' exige booking; moderate e light também
  // funcionam sem luta como treino normal aprimorado).
  // `weaponTarget` (Fase 3): só usado quando spec === 'install_weapon'. É o
  // gamePlanKey da arma que o lutador está instalando.
  // `cardFocus` (Task 9): só usado quando spec === 'card_discovery'. É o
  // card-id que o lutador escolheu, na configuração, entre as opções que a
  // academia oferece — mesmo padrão de weaponTarget, mesma razão: processCamp
  // roda sozinho no fast-forward e não pode parar pra perguntar nada.
  static configureCamp(fighter, intensity, spec, sparringPartnerId = null, weaponTarget = null, proficiencyFocus = null, cardFocus = null) {
    fighter.campConfig = {
      intensity,
      spec,
      sparringPartnerId,
      weaponTarget,
      proficiencyFocus,
      cardFocus,
    };
    fighter.campProcessedThisWeek = false;
  }

  static cancelCamp(fighter) {
    fighter.campConfig = null;
    fighter.campProcessedThisWeek = false;
  }

  // ===== Processamento semanal (chamado por _applyWeeklyTraining) =====
  // Retorna { gains, injured, overtrained, canceledFight, weapon }
  // `academy`: a academia onde o lutador treina hoje. Precisa dela porque é a
  // academia que define quais armas ela sabe ensinar e o quão rápido.
  static processCamp(fighter, academy, team, absWeekNow, opponentArchetype = null) {
    const cfg = fighter.campConfig;
    if (!cfg) return null;

    const { intensity, spec, sparringPartnerId, weaponTarget, cardFocus } = cfg;

    // Resolve o spec efetivo (install_weapon deriva do weaponTarget)
    const installing = spec === 'install_weapon' && weaponTarget && TapeService.canInstall(academy, weaponTarget);
    const resolvedSpec = installing ? PLAN_SPECIALTY[weaponTarget] : spec;
    const gains = this._calcGains(intensity, resolvedSpec);

    // Task 9 follow-up (fix round 3) — card_discovery é um evento de UMA VEZ:
    // assim que `cardFocus` está em `fighter.cardPool` (ou nunca poderia
    // entrar, porque não é uma carta válida no pool desta academia), rodar o
    // camp de novo com esta config não faz mais nada. Só que `campConfig`
    // persiste semana a semana igual todo outro spec (é assim que
    // 'striking' funciona — ganho repetido é o comportamento certo lá). Sem
    // esta checagem, o jogador paga fadiga e risco de lesão/overtraining
    // INDEFINIDAMENTE por uma carta que já ganhou, toda semana, até
    // reconfigurar manualmente — pior ainda no fast-forward, onde ninguém
    // está olhando pra notar (ver test/simulate-week.test.js, 60 semanas).
    // Calculado AQUI, antes de fadiga/risco, porque a checagem em si é pura
    // (só `.includes`, sem mutação) — a mutação real do cardPool continua
    // mais abaixo, junto dos outros efeitos de spec, pra não duplicar a
    // lógica de aquisição. Não mexe em `fighter.campConfig` (sem
    // cancelCamp() automático) — a config persistida fica intacta de
    // propósito, review anterior já descartou reset automático por efeito
    // colateral em booking/readiness.
    let cardDiscoveryNoOp = false;
    if (spec === 'card_discovery') {
      const poolKey = this._academyCardPool(academy);
      const pool = ACADEMY_CARD_POOLS[poolKey] || ACADEMY_CARD_POOLS.balanced;
      const validCard = !!cardFocus && pool.active.includes(cardFocus);
      const alreadyOwned = validCard && !!fighter.cardPool?.includes(cardFocus);
      cardDiscoveryNoOp = !validCard || alreadyOwned;
    }

    // A sala de treino (Fase 3b). Antes daqui, `team` chegava sempre vazio e
    // este bloco inteiro era código morto: existia um sistema de sparring
    // desenhado e nunca povoado. Agora o parceiro é uma pessoa — você aprende
    // com ele, você o machuca, e ele passa a te conhecer melhor que qualquer
    // fita pública.
    //
    // Roda ANTES da instalação da arma porque um parceiro forte na
    // especialidade acelera o aprendizado: não se instala wrestling sem alguém
    // que saiba wrestling te jogando no chão.
    let sparringBonus = 0;
    let sparring = null;
    const partner = sparringPartnerId ? team.find(f => f.id === sparringPartnerId) : null;

    if (partner) {
      if (partner.weightClass === fighter.weightClass) {
        sparringBonus += CAMP_CONFIG.SPARRING_CLOSE_WEIGHT_BONUS;
      }
      // O parceiro que imita o adversário da semana vale mais que um bom
      // parceiro genérico — é para isso que serve um camp.
      if (opponentArchetype && this._getArchetype(partner) === opponentArchetype) {
        sparringBonus += CAMP_CONFIG.SPARRING_MATCH_BONUS;
      }

      sparring = TrainingPartnersService.spar(
        fighter, partner, intensity, installing ? weaponTarget : null
      );
    }

    // Fase 3 — instalar arma nova. Os atributos que o camp treina são os da
    // especialidade da própria arma (instalar um wrestling treina wrestling),
    // mas mal: você está gastando as semanas aprendendo um movimento em vez de
    // afiar o que já sabe. Esse é o custo real da reinvenção — você chega pior
    // nesta luta pra ganhar as próximas três.
    let weapon = null;
    if (installing) {
      weapon = TapeService.progressWeapon(fighter, academy, weaponTarget, sparring?.weaponBoost ?? 0);
      for (const attr of Object.keys(gains)) {
        gains[attr] = Math.floor(gains[attr] * TAPE_CONFIG.WEAPON_CAMP_GAIN_SCALE);
      }
    }

    // Aplicar ganhos com bônus de sparring — respeita o teto reduzido por
    // sequela permanente (§B.2), igual Fighter.evolve()
    // P2.2: return stage — gains at 50%
    const returnMult = fighter.injury?.stage === 'return' ? INJURY_CONFIG.RETURN_TRAINING_MULT : 1.0;
    for (const [attr, amount] of Object.entries(gains)) {
      const boosted = Math.round(amount * (1 + sparringBonus) * returnMult);
      fighter.attributes[attr] = clamp(fighter.attributes[attr] + boosted, 0, fighter.effectiveCeiling(attr));
    }

    // Proficiência de golpes (só para specs de treino físico)
    const profGains = {};
    const physicalSpecs = ['striking', 'grappling', 'cardio', 'chin'];
    if (physicalSpecs.includes(resolvedSpec) && fighter.moveset && fighter.moveset.length > 0) {
      const profGain = { light: 1, moderate: 2, intense: 3 }[intensity] || 1;
      const focus = cfg.proficiencyFocus;
      if (focus && fighter.moveset.includes(focus)) {
        // Golpe focado ganha 2x, se houver segundo slot vai pra outro aleatório
        profGains[focus] = profGain * 2;
        fighter.gainProficiency(focus, profGain * 2);
        const others = fighter.moveset.filter(m => m !== focus);
        if (others.length > 0) {
          const second = others[Math.floor(Math.random() * others.length)];
          profGains[second] = profGain;
          fighter.gainProficiency(second, profGain);
        }
      } else {
        const shuffled = [...fighter.moveset].sort(() => Math.random() - 0.5);
        const count = Math.min(2, shuffled.length);
        for (let i = 0; i < count; i++) {
          profGains[shuffled[i]] = profGain;
          fighter.gainProficiency(shuffled[i], profGain);
        }
      }
    }

    // Riscos
    const risks = this._calcRisks(intensity, fighter);
    const result = {
      gains,
      profGains,
      sparringBonus,
      weapon,
      sparring,
      cardAcquired: null,
      injured: false,
      overtrained: false,
      canceledFight: false,
      injuryWeeks: 0,
    };

    // `cardDiscoveryNoOp` (fix round 3): uma semana de card_discovery que não
    // pode mais adquirir nada (carta já no pool, ou cardFocus inválido pra
    // esta academia) não custa fadiga nem rola risco — mesmo princípio de
    // "sem ganho, sem custo" que já vale pra `gains` (_calcGains devolve {}
    // pra card_discovery). Uma aquisição nova NESTA chamada (cardFocus ainda
    // não possuído, válido no pool) continua custando normal, como qualquer
    // outra semana produtiva de camp.
    if (!cardDiscoveryNoOp) {
      if (Math.random() < risks.injuryChance) {
        result.injured = true;
        // Sparring controlado não quebra osso do nada — sem a fratura rara
        // que a lesão de luta de verdade pode rolar (rollInjurySeverity()
        // completo). Mesma taxonomia médica (contusão/corte/concussão/
        // articular), taxa de camp fica um pouco mais dura que a antiga
        // faixa fixa de 3-8 semanas.
        const severity = rollInjurySeverity(['bruise', 'cut', 'concussion', 'joint']);
        const injuryWeeks = severity.weeks;
        result.injuryWeeks = injuryWeeks;

        const prevStatus = fighter.status;
        fighter.status = 'injured';
        fighter.injury = {
          stage: 'rest',
          restUntilAbsWeek: absWeekNow + injuryWeeks,
          rehabEndAbsWeek: 0,
          type: severity.type,
          description: `${severity.label} no treino (${intensity}) — ${formatWeeks(injuryWeeks)}`,
          rehabCost: 0,
          rehabChosen: false,
          resumeStatus: prevStatus,
        };
        fighter.availableFromAbsWeek = fighter.injury.restUntilAbsWeek;

        // Lesão intensa cancela a luta
        if (intensity === 'intense' && CAMP_CONFIG.CAMP_INJURY_CANCELS_FIGHT) {
          result.canceledFight = true;
        }
      }

      if (Math.random() < risks.overtrainingChance) {
        result.overtrained = true;
        fighter.morale = clamp(fighter.morale - 12, 0, 100);
        fighter.fatigue = clamp(fighter.fatigue + 15, 0, 100);
      }

      // Fadiga: intensidade alta cansa mais
      const fatigueCost = intensity === 'light' ? 3 : intensity === 'moderate' ? 8 : 15;
      fighter.applyFatigue(fatigueCost);
    }

    // Efeitos especiais das novas specs (§PRD) — `spec` já veio da
    // desestruturação no topo de processCamp
    if (spec === 'recovery') {
      // Recuperação: reduz fadiga extra e acelera lesões
      fighter.fatigue = clamp(fighter.fatigue - 10, 0, 100);
      if (fighter.injury && fighter.injury.stage === 'rest') {
        fighter.injury.restUntilAbsWeek -= 7; // acelera em 1 semana
      }
    }
    if (spec === 'card_discovery' && cardFocus) {
      // Task 9 — descoberta de carta: sem TapeService.canInstall-style
      // validação adiada (a escolha já foi travada na configuração, igual
      // weaponTarget). Só entra no pool persistente do lutador; dedupe pra
      // não empilhar a mesma carta se o jogador reconfigurar o camp com o
      // mesmo foco em semanas seguidas.
      fighter.cardPool = fighter.cardPool || [];
      if (!fighter.cardPool.includes(cardFocus)) {
        fighter.cardPool.push(cardFocus);
        result.cardAcquired = cardFocus;
      }
    }
    if (spec === 'strategy') {
      // Estratégia: bônus na leitura do plano do oponente na próxima luta
      fighter.campStrategyBonus = 1;
    }
    if (spec === 'study') {
      // Estudo: bônus temporário de scouting (1 nível extra no próximo oponente)
      fighter.scoutingBoost = 1;
    }

    fighter.campProcessedThisWeek = true;
    return result;
  }

  // ===== Helpers =====
  static _calcGains(intensity, spec) {
    const mult = CAMP_CONFIG.GAIN_MULTIPLIER[intensity] || 1;
    const gains = {};

    const attrMap = {
      striking: ['boxing', 'kickboxing', 'muayThai', 'power', 'footwork'],
      grappling: ['wrestling', 'bjj', 'takedowns', 'groundControl'],
      cardio: ['cardio', 'recovery', 'durability'],
      chin: ['chin', 'composure'],
      recovery: [],  // sem ganho de atributo — efeito especial em processCamp
      strategy: ['fightIQ'],
      study: ['fightIQ', 'adaptability'],
      card_discovery: [],  // sem ganho de atributo — a semana vira uma carta, não pontos
    };

    const attrs = attrMap[spec] || attrMap.striking;
    for (const attr of attrs) {
      gains[attr] = Math.floor(mult * (0.3 + Math.random() * 0.7));
    }

    return gains;
  }

  static _calcRisks(intensity, fighter) {
    let injuryChance = CAMP_CONFIG.INJURY_CHANCE[intensity] || 0.01;
    let overtrainingChance = CAMP_CONFIG.OVERTRAINING_CHANCE[intensity] || 0.01;

    // DNA: injuryProne dobra risco de lesão
    if (fighter.dna?.injuryProne) injuryChance *= 2.0;
    if (fighter.dna?.exceptionalRecovery) injuryChance *= 0.5;
    if (fighter.dna?.emotionallyUnstable) overtrainingChance *= 1.5;

    // P2.2: return stage — 2x injury risk
    if (fighter.injury?.stage === 'return') {
      injuryChance *= INJURY_CONFIG.RETURN_REINJURY_MULT;
    }

    return {
      injuryChance: Math.min(injuryChance, 0.5),
      overtrainingChance: Math.min(overtrainingChance, 0.4),
    };
  }

  // O arquétipo de um lutador para fins de sparring
  static _getArchetype(fighter) {
    if (!fighter) return 'balanced';
    const striking = fighter.strikingScore;
    const grappling = fighter.grapplingScore;
    const gap = striking - grappling;
    if (gap > 8) return 'striker';
    if (gap < -8) return 'grappler';
    return 'balanced';
  }

  // O arquétipo do adversário baseado no que sabemos dele
  static opponentArchetype(opponent) {
    if (!opponent) return null;
    return this._getArchetype(opponent);
  }

  // Task 9 — a chave categórica de pool de carta de uma academia, derivada
  // dos bônus numéricos `specialties.{striking,grappling}`. Mesmo espírito
  // de `_getArchetype` (compara as duas pontas, olha o gap), mas numa escala
  // bem diferente: `strikingScore`/`grapplingScore` de um lutador vivem
  // grosso modo em 0–100 (gap > 8 ali é ~8% da escala); `specialties` é um
  // multiplicador que, no catálogo real (ACADEMIES em game-config.js), varia
  // só entre 0 e ~0.30.
  //
  // Correção de review (task 9 follow-up): um único threshold simétrico é
  // matematicamente incapaz de separar as 3 academias reais em 3 pools
  // diferentes. Os gaps reais (striking - grappling) são:
  //   academy-blacktiger = 0.10 - 0.15 = -0.05
  //   academy-fortaleza  = 0.20 - 0.30 = -0.10
  //   academy-elite      = 0.30 - 0.25 = +0.05
  // blacktiger e elite têm a MESMA magnitude (0.05) com sinais opostos — um
  // threshold simétrico sempre os classifica em espelho (os dois cruzam, ou
  // nenhum cruza), então 'striking' e 'balanced' nunca coexistem com um
  // threshold só. Daí os dois thresholds:
  //  - STRIKING_GAP_THRESHOLD = 0.05: bate exatamente no único gap positivo
  //    do catálogo (academy-elite). É o mesmo "número limpo" já derivado
  //    escalando o ~8% de `_getArchetype` pra essa faixa (~0.024 → 0.05
  //    arredondado). Inclusivo (`>=`) de propósito — não é um acidente de
  //    borda, é a definição: só existe UM ponto de dado positivo no
  //    catálogo hoje, então não há como pedir "margem" além dele sem
  //    esvaziar 'striking' de novo.
  //  - GRAPPLING_GAP_THRESHOLD = 0.075: o ponto médio entre blacktiger
  //    (-0.05, fica em 'balanced') e fortaleza (-0.10, vira 'grappling') —
  //    dá aos dois uma margem real e igual (0.025) em vez de uma moeda no
  //    ar em cima do mesmo -0.05 que já define o corte de striking.
  // Resultado: as 3 academias reais caem em 3 pools diferentes — nenhum
  // pool fica morto, e a separação grappling/balanced tem folga de verdade.
  //
  // EPSILON: `0.30 - 0.25` em ponto flutuante dá 0.049999999999999996, não
  // 0.05 — então um `>=` "exato" contra STRIKING_GAP_THRESHOLD falhava pro
  // próprio academy-elite que o threshold foi desenhado pra capturar (pego
  // rodando o script de verificação, não por inspeção). EPSILON absorve
  // esse erro de arredondamento de ponto flutuante sem abrir a porta pra
  // gaps genuinamente menores que o threshold.
  static _academyCardPool(academy) {
    const STRIKING_GAP_THRESHOLD = 0.05;
    const GRAPPLING_GAP_THRESHOLD = 0.075;
    const EPSILON = 1e-9;
    const striking = academy?.specialties?.striking ?? 0;
    const grappling = academy?.specialties?.grappling ?? 0;
    const gap = striking - grappling;
    if (gap >= STRIKING_GAP_THRESHOLD - EPSILON) return 'striking';
    if (gap <= -GRAPPLING_GAP_THRESHOLD + EPSILON) return 'grappling';
    return 'balanced';
  }

  // Task 9 — as opções de carta que a academia oferece nesta configuração de
  // camp. Resolve card-ids do pool categórico para objetos {id, name,
  // description} prontos pra view renderizar. Determinístico (sempre as
  // primeiras 3 do pool NA ORDEM DO POOL, pulando o que o lutador já tem) —
  // se fosse aleatório a cada render, a seleção do jogador poderia "sumir da
  // lista" ao reabrir a tela.
  //
  // Correção de review (task 9 follow-up): antes disto, a função sempre
  // devolvia `pool.active.slice(0, 3)` — as 3 mesmas cartas, pra sempre,
  // não importa o que o lutador já tinha. Consequência: as cartas de índice
  // 3-4 do pool (5 cartas) nunca eram alcançáveis por este caminho, e assim
  // que o lutador tinha as 3 primeiras, `card_discovery` virava um
  // no-op garantido — zero ganho, risco/fadiga cheios, toda semana,
  // silenciosamente (inclusive no fast-forward). Agora recebe `fighter` e
  // filtra `fighter.cardPool` antes de fatiar, então sempre tenta oferecer
  // até 3 cartas que o lutador AINDA NÃO tem, cobrindo o pool de 5 inteiro
  // conforme as primeiras vão sendo adquiridas. Se as 5 já foram todas
  // adquiridas, devolve `[]` — a view (`js/views/training-camp.js`) já
  // esconde o bloco inteiro E a opção 'card_discovery' do <select> quando
  // `cardOptions.length === 0` (mesmo padrão usado pra `weaponOptions`
  // vazio), então um pool esgotado nunca vira uma opção selecionável: o
  // jogador nem chega a configurar um camp que seria um no-op silencioso.
  static getCardDiscoveryOptions(academy, fighter = null) {
    const poolKey = this._academyCardPool(academy);
    const pool = ACADEMY_CARD_POOLS[poolKey] || ACADEMY_CARD_POOLS.balanced;
    const owned = fighter?.cardPool || [];
    const available = pool.active.filter(id => !owned.includes(id));
    return available.slice(0, 3).map(id => {
      const card = ACTIVE_CARDS[id];
      return {
        id,
        name: card?.name || id,
        description: card?.description || '',
      };
    });
  }
}
