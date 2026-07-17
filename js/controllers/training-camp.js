import { clamp, formatWeeks } from '../utils/helpers.js';
import { CAMP_CONFIG, TAPE_CONFIG, PLAN_SPECIALTY, INJURY_CONFIG, rollInjurySeverity } from '../config/game-config.js';
import { TapeService } from '../services/tape-service.js';
import { TrainingPartnersService } from '../services/training-partners-service.js';

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
  static configureCamp(fighter, intensity, spec, sparringPartnerId = null, weaponTarget = null, proficiencyFocus = null) {
    fighter.campConfig = {
      intensity,
      spec,
      sparringPartnerId,
      weaponTarget,
      proficiencyFocus,
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

    const { intensity, spec, sparringPartnerId, weaponTarget } = cfg;

    // Resolve o spec efetivo (install_weapon deriva do weaponTarget)
    const installing = spec === 'install_weapon' && weaponTarget && TapeService.canInstall(academy, weaponTarget);
    const resolvedSpec = installing ? PLAN_SPECIALTY[weaponTarget] : spec;
    const gains = this._calcGains(intensity, resolvedSpec);

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
      injured: false,
      overtrained: false,
      canceledFight: false,
      injuryWeeks: 0,
    };

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

    // Efeitos especiais das novas specs (§PRD) — `spec` já veio da
    // desestruturação no topo de processCamp
    if (spec === 'recovery') {
      // Recuperação: reduz fadiga extra e acelera lesões
      fighter.fatigue = clamp(fighter.fatigue - 10, 0, 100);
      if (fighter.injury && fighter.injury.stage === 'rest') {
        fighter.injury.restUntilAbsWeek -= 7; // acelera em 1 semana
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
}
