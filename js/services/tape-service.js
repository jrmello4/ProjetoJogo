import { clamp } from '../utils/helpers.js';
import {
  GAME_PLANS,
  GAME_PLAN_EDGE,
  COUNTER_OF,
  PLAN_SPECIALTY,
  TAPE_CONFIG,
  FIGHTING_STYLES,
} from '../config/game-config.js';

// O Livro Sobre Você — Fase 3.
//
// Até aqui o scouting era via de mão única: você estudava o adversário e o
// mundo nunca estudava você. Pior: a IA lutava sem plano de jogo nenhum
// (`_calcRoundPerformance(fighterB, ..., null)`), o que deixava a maior
// alavanca do motor parada.
//
// Este serviço faz o mundo te ler de volta. Ele é estático e não conhece o
// `db`: recebe lutadores, devolve números. Toda a decisão de leitura, isca,
// arma nova e maestria vive aqui; o motor de cartas só aplica o resultado.
// Essa fronteira é o que permite testar o sistema sem subir um jogo inteiro.
export class TapeService {
  static defaultTape() {
    return {
      planHistory: [],        // gamePlanKey usados, mais recente no índice 0
      planMastery: {},        // { striker: 0-100, ... }
      exposure: 0,            // 0-100
      weapon: null,           // { planKey, mastery, revealed }
      figuredOutAtAbsWeek: 0,
      winsSinceFiguredOut: 0,
      lastReadQuality: 0,
    };
  }

  static tapeOf(fighter) {
    if (!fighter.tape) fighter.tape = this.defaultTape();
    fighter.tape.style = fighter.style;
    fighter.tape.styleLabel = FIGHTING_STYLES[fighter.style]?.label || 'Freestyle';
    return fighter.tape;
  }

  // ===== Assinatura =====
  // O plano que aparece em >= 60% das últimas 5 lutas. Se você varia, não
  // existe assinatura — e sem assinatura não existe counter pra trazer contra
  // você. Ser imprevisível é uma estratégia legítima; ela só não te dá uma
  // arma que ganha luta sozinha (ver maestria).
  static signatureOf(fighter) {
    const history = this.tapeOf(fighter).planHistory.slice(0, TAPE_CONFIG.SIGNATURE_WINDOW);
    if (history.length === 0) return null;

    const counts = {};
    for (const key of history) counts[key] = (counts[key] || 0) + 1;

    const [top, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return n / history.length >= TAPE_CONFIG.SIGNATURE_THRESHOLD ? top : null;
  }

  // ===== Scouting para IA de cartas =====
  // Empacota exposure + signatureOf no formato que AICombat.selectLoadout
  // consome pra escolher o loadout que counter-a o jogador. Puramente
  // aditivo — não toca em planHistory nem em nenhum outro método.
  static getFavoredPlanData(fighter) {
    return {
      exposure: this.tapeOf(fighter).exposure,
      favoredPlan: this.signatureOf(fighter),
    };
  }

  // ===== Maestria de plano =====
  // Repetir um plano o afia. É a outra metade da tese: a mesma repetição que
  // te dá a vantagem é a que te entrega. `balanced` é a ausência de plano —
  // não há técnica pra masterizar, senão repetir 'balanced' seria a jogada
  // ótima (assinatura sem counter E com bônus).
  static planMasteryBonus(fighter, planKey) {
    if (planKey === 'balanced') return 0;
    const mastery = this.tapeOf(fighter).planMastery[planKey] || 0;
    return TAPE_CONFIG.PLAN_MASTERY_MAX_BONUS * (mastery / 100);
  }

  // ===== A leitura =====
  // Quanto o adversário sabe sobre você. Exposição é o que existe pra ler;
  // fightIQ é a capacidade de ler; a academia dele é a estrutura de análise.
  // Um rival ganha um bônus de graça — ele te conhece por fora da fita, e é
  // isso que torna a terceira luta de uma trilogia brutal.
  static readQuality(opponent, target, { rivalryIntensity = 0, opponentAcademy = null, sparredWeeks = 0 } = {}) {
    const exposure = this.tapeOf(target).exposure / 100;
    const iq = 0.5 + (opponent.attributes?.fightIQ ?? 50) / TAPE_CONFIG.READ_IQ_SCALE;
    const structure = 0.7 + ((opponentAcademy?.reputation ?? 30) / 100) * 0.3;
    const rivalry = rivalryIntensity > 0 ? TAPE_CONFIG.READ_RIVALRY_BONUS : 0;

    // O vazamento (Fase 3b): quem dividiu o tatame com você não precisa da
    // fita. Ele não te leu — ele te VIU. Nem a arma nova escapa de quem estava
    // do outro lado dela todo dia no treino.
    const sparring = Math.min(
      sparredWeeks * TAPE_CONFIG.READ_SPARRING_PER_WEEK,
      TAPE_CONFIG.READ_SPARRING_CAP
    );

    return clamp(exposure * iq * structure + rivalry + sparring, 0, 1);
  }

  // O plano que o adversário traz. Sem leitura suficiente ou sem assinatura
  // counterável, ele luta equilibrado — exatamente o comportamento de hoje.
  static opponentPlanFor(opponent, target, ctx = {}) {
    const read = this.readQuality(opponent, target, ctx);
    const signature = this.signatureOf(target);
    const counter = signature ? COUNTER_OF[signature] : null;

    if (!counter || read < TAPE_CONFIG.READ_THRESHOLD) {
      return { planKey: 'balanced', read, signature, countered: false };
    }
    return { planKey: counter, read, signature, countered: true };
  }

  // ===== A arma nova =====
  static canInstall(academy, planKey) {
    const spec = PLAN_SPECIALTY[planKey];
    if (!spec) return false;
    return (academy?.specialties?.[spec] ?? 0) >= TAPE_CONFIG.WEAPON_MIN_SPECIALTY;
  }

  static installablePlans(academy) {
    return Object.keys(GAME_PLANS).filter(k => k !== 'balanced' && this.canInstall(academy, k));
  }

  // Maestria ganha numa semana de camp dedicada. Sinergia com o técnico e
  // especialidade da academia aceleram; idade freia. É por isso que o veterano
  // não se reinventa por arma nova — ele se reinventa por leitura (isca).
  static installRate(fighter, academy, planKey) {
    const spec = PLAN_SPECIALTY[planKey];
    const synergy = 0.5 + ((fighter.coachSynergy ?? 40) / 100) * TAPE_CONFIG.WEAPON_SYNERGY_SCALE;
    const academyBonus = 1 + (academy?.specialties?.[spec] ?? 0) * TAPE_CONFIG.WEAPON_ACADEMY_SPEC_BONUS;
    const agePenalty = 1 - Math.max(0, (fighter.age ?? 25) - TAPE_CONFIG.WEAPON_AGE_PENALTY_FROM)
      * TAPE_CONFIG.WEAPON_AGE_PENALTY_PER_YEAR;
    const discipline = 0.7 + ((fighter.dna?.discipline ?? 50) / 100) * 0.6;

    return Math.max(
      1,
      TAPE_CONFIG.WEAPON_INSTALL_BASE * synergy * academyBonus * Math.max(0.2, agePenalty) * discipline
    );
  }

  // Chamado a cada semana de camp com spec `install_weapon`. `partnerBoost`
  // vem da sala de treino (Fase 3b): um parceiro forte na especialidade acelera
  // a instalação — e, de quebra, passa a ser a única pessoa no mundo em quem a
  // arma não vai funcionar, porque ele a viu nascer.
  static progressWeapon(fighter, academy, planKey, partnerBoost = 0) {
    const tape = this.tapeOf(fighter);
    if (!tape.weapon || tape.weapon.planKey !== planKey || tape.weapon.revealed) {
      tape.weapon = { planKey, mastery: 0, revealed: false };
    }
    const gained = this.installRate(fighter, academy, planKey) * (1 + partnerBoost);
    tape.weapon.mastery = clamp(tape.weapon.mastery + gained, 0, 100);
    return { gained: Math.round(gained), mastery: Math.round(tape.weapon.mastery), ready: tape.weapon.mastery >= TAPE_CONFIG.WEAPON_READY_MASTERY };
  }

  // ===== Resolução tática pré-luta =====
  // Ponto único onde leitura, isca, arma e maestria viram dois números que o
  // motor de luta entende: `edgeA` (o jogador) e `edgeB` (o adversário).
  // `planEdgeFn` é injetado pelo chamador (FightOutcome._planEdge) para não
  // duplicar aqui a leitura de traços por atributos que o motor já faz.
  static resolveTactics({ player, opponent, gamePlanKey, bait = false, rivalryIntensity = 0, opponentAcademy = null, sparredWeeks = 0, planEdgeFn }) {
    const tape = this.tapeOf(player);
    const plan = GAME_PLANS[gamePlanKey] || GAME_PLANS.balanced;

    const oppRead = this.opponentPlanFor(opponent, player, { rivalryIntensity, opponentAcademy, sparredWeeks });
    const opponentPlan = GAME_PLANS[oppRead.planKey] || GAME_PLANS.balanced;

    let edgeA = planEdgeFn(plan, opponent) + this.planMasteryBonus(player, gamePlanKey);

    // A vantagem do adversário escala com a CONFIANÇA dele, não chega inteira
    // no instante em que ele cruza o limiar de leitura. Sem essa multiplicação
    // por `read`, o counter entregava o `_planEdge` de atributos inteiro de uma
    // vez — e a dificuldade da carreira virava um degrau (medido: 83% → 65% de
    // vitória num único passo de exposição) em vez de uma curva.
    let edgeB = oppRead.countered
      ? oppRead.read * (planEdgeFn(opponentPlan, player) + TAPE_CONFIG.TAPE_READ_EDGE)
      : planEdgeFn(opponentPlan, player);

    // A arma nova. Enquanto crua, ela entrega o plano pela metade e ainda
    // cobra — arma crua é pior que não ter plano. Mas a ESTREIA dela anula a
    // leitura do adversário: ele preparou uma luta contra o velho você.
    let planModFactorA = 1;
    let weaponReveal = null;
    const weapon = tape.weapon;
    const usingWeapon = weapon && !weapon.revealed && weapon.planKey === gamePlanKey;

    if (usingWeapon) {
      const factor = clamp(weapon.mastery / TAPE_CONFIG.WEAPON_READY_MASTERY, 0, 1);
      planModFactorA = factor;
      edgeA -= TAPE_CONFIG.WEAPON_RAW_PENALTY * (1 - factor);

      // A consequência mais cruel do cruzamento entre a fita e a sala de treino:
      // a arma nova não surpreende quem esteve do outro lado dela todo dia no
      // sparring. O seu melhor parceiro é a única pessoa do mundo em quem ela
      // não funciona — e é exatamente ele que a promoção vai te oferecer.
      const sawItComing = sparredWeeks >= TAPE_CONFIG.WEAPON_SEEN_SPARRING_WEEKS;
      if (!sawItComing) {
        edgeA += TAPE_CONFIG.WEAPON_SURPRISE_BONUS;
        // Quanto mais ele confiou na fita, pior pra ele.
        edgeB = GAME_PLAN_EDGE.weak * oppRead.read;
      }
      weaponReveal = {
        planKey: gamePlanKey,
        mastery: Math.round(weapon.mastery),
        ready: factor >= 1,
        sawItComing,
      };
    }

    // A isca. Só existe se você TEM uma reputação pra fingir, e só paga se ele
    // realmente se comprometeu a counter-á-la. Iscar quem não te leu é jogar
    // fora a própria assinatura de graça.
    let baitOutcome = null;
    if (bait && !usingWeapon && this._canBait(player, gamePlanKey)) {
      const chance = clamp(
        TAPE_CONFIG.BAIT_BASE + (player.attributes?.fightIQ ?? 50) * TAPE_CONFIG.BAIT_IQ_SCALE,
        0.05,
        0.90
      );
      if (Math.random() < chance) {
        // A isca não te deixa mais forte — ela deixa ELE fora de posição. Tudo
        // escala com o quanto ele se comprometeu: iscar quem não te leu não tem
        // o que explorar, e é isso que faz da isca uma decisão em vez de um
        // botão de "ganhar mais".
        edgeB = TAPE_CONFIG.BAIT_OPPONENT_PENALTY * oppRead.read;
        edgeA += TAPE_CONFIG.BAIT_REWARD * oppRead.read;
        baitOutcome = 'success';
      } else {
        edgeA += TAPE_CONFIG.BAIT_PENALTY;
        baitOutcome = 'failed';
      }
    }

    return {
      opponentPlanKey: oppRead.planKey,
      countered: oppRead.countered,
      readQuality: oppRead.read,
      signature: oppRead.signature,
      edgeA: clamp(edgeA, TAPE_CONFIG.EDGE_FLOOR, TAPE_CONFIG.EDGE_CEIL),
      edgeB: clamp(edgeB, TAPE_CONFIG.EDGE_FLOOR, TAPE_CONFIG.EDGE_CEIL),
      planModFactorA,
      baitOutcome,
      weaponReveal,
    };
  }

  static _canBait(player, gamePlanKey) {
    const signature = this.signatureOf(player);
    return !!signature && COUNTER_OF[signature] && signature !== gamePlanKey;
  }

  // ===== Pós-luta =====
  // A fita só registra o que é observável de fora: qual plano você trouxe e
  // sob que holofote. Nunca atributos ocultos.
  static recordFight(fighter, { gamePlanKey = 'balanced', promoTier = 3, isTitleFight = false, readQuality = 0, won = null } = {}) {
    const tape = this.tapeOf(fighter);

    tape.planHistory.unshift(gamePlanKey);
    if (tape.planHistory.length > TAPE_CONFIG.SIGNATURE_WINDOW * 2) {
      tape.planHistory.length = TAPE_CONFIG.SIGNATURE_WINDOW * 2;
    }

    if (gamePlanKey !== 'balanced') {
      tape.planMastery[gamePlanKey] = clamp(
        (tape.planMastery[gamePlanKey] || 0) + TAPE_CONFIG.PLAN_MASTERY_PER_USE, 0, 100
      );
    }
    for (const key of Object.keys(tape.planMastery)) {
      if (key === gamePlanKey) continue;
      tape.planMastery[key] = clamp(tape.planMastery[key] - TAPE_CONFIG.PLAN_MASTERY_DECAY_PER_FIGHT, 0, 100);
    }

    const fights = (fighter.record?.wins || 0) + (fighter.record?.losses || 0) + (fighter.record?.draws || 0);
    const rookieScale = fights < TAPE_CONFIG.EXPOSURE_ROOKIE_FIGHTS ? TAPE_CONFIG.EXPOSURE_ROOKIE_SCALE : 1;
    const gain = (
      TAPE_CONFIG.EXPOSURE_BASE_PER_FIGHT
      + (fighter.popularity || 0) * TAPE_CONFIG.EXPOSURE_POPULARITY_SCALE
      + (promoTier === 1 ? TAPE_CONFIG.EXPOSURE_TIER1_BONUS : 0)
      + (isTitleFight ? TAPE_CONFIG.EXPOSURE_TITLE_BONUS : 0)
    ) * rookieScale;
    tape.exposure = clamp(tape.exposure + gain, 0, 100);

    tape.lastReadQuality = readQuality;

    // A arma revelada vira um plano normal — pode virar sua nova assinatura, e
    // o ciclo recomeça. O mundo tem que te reestudar do zero.
    if (tape.weapon && !tape.weapon.revealed && tape.weapon.planKey === gamePlanKey) {
      tape.weapon.revealed = true;
      tape.exposure = clamp(tape.exposure - TAPE_CONFIG.EXPOSURE_NEW_WEAPON_DROP, 0, 100);
    }

    if (tape.figuredOutAtAbsWeek > 0) {
      tape.winsSinceFiguredOut = won === true ? tape.winsSinceFiguredOut + 1 : 0;
    }
  }

  // Sumir do mapa te torna um enigma de novo — com o custo óbvio de não estar
  // lutando. Chamado no tick semanal.
  static decayIdle(fighter, absWeekNow) {
    const tape = this.tapeOf(fighter);
    const idle = absWeekNow - (fighter.lastFightAbsWeek || 0);
    if (idle <= TAPE_CONFIG.EXPOSURE_IDLE_AFTER_WEEKS) return 0;

    const before = tape.exposure;
    tape.exposure = clamp(tape.exposure - TAPE_CONFIG.EXPOSURE_IDLE_DECAY, 0, 100);
    return before - tape.exposure;
  }

  // ===== Rótulos (UI) =====
  static exposureLabel(exposure) {
    if (exposure >= 75) return 'Livro aberto';
    if (exposure >= 50) return 'Bem estudado';
    if (exposure >= 25) return 'Conhecido';
    return 'Enigma';
  }
}
