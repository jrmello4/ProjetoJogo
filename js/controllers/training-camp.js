import { clamp } from '../utils/helpers.js';
import { CAMP_CONFIG, TAPE_CONFIG, PLAN_SPECIALTY } from '../config/game-config.js';
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
  static configureCamp(fighter, intensity, spec, sparringPartnerId = null, weaponTarget = null) {
    fighter.campConfig = {
      intensity,
      spec,
      sparringPartnerId,
      weaponTarget,
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

    // Fase 3 — instalar arma nova. Os atributos que o camp treina são os da
    // especialidade da própria arma (instalar um wrestling treina wrestling),
    // mas mal: você está gastando as semanas aprendendo um movimento em vez de
    // afiar o que já sabe. Esse é o custo real da reinvenção — você chega pior
    // nesta luta pra ganhar as próximas três.
    const installing = spec === 'install_weapon' && weaponTarget && TapeService.canInstall(academy, weaponTarget);
    const gains = this._calcGains(intensity, installing ? PLAN_SPECIALTY[weaponTarget] : spec);

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
    for (const [attr, amount] of Object.entries(gains)) {
      const boosted = Math.round(amount * (1 + sparringBonus));
      fighter.attributes[attr] = clamp(fighter.attributes[attr] + boosted, 0, fighter.effectiveCeiling(attr));
    }

    // Riscos
    const risks = this._calcRisks(intensity, fighter);
    const result = {
      gains,
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
      const injuryWeeks = 3 + Math.floor(Math.random() * 6); // 3-8 semanas
      result.injuryWeeks = injuryWeeks;

      const prevStatus = fighter.status;
      fighter.status = 'injured';
      fighter.injury = {
        untilAbsWeek: absWeekNow + injuryWeeks,
        description: `Lesionado no treino (${intensity})`,
        resumeStatus: prevStatus,
      };
      fighter.availableFromAbsWeek = fighter.injury.untilAbsWeek;

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
