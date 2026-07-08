import { clamp } from '../utils/helpers.js';
import { GYM_CONFIG } from '../config/game-config.js';

export class TrainingCamp {
  static runCamp(fighter, intensity, specialization, absWeekNow) {
    const gains = this._calculateGains(intensity, specialization);
    const risks = this._calculateRisks(intensity, fighter);

    // Aplicar ganhos de atributos
    for (const [attr, amount] of Object.entries(gains)) {
      fighter.attributes[attr] = clamp(fighter.attributes[attr] + amount, 0, 99);
    }

    // Verificar riscos
    let injured = false;
    let overtrained = false;

    if (Math.random() < risks.injuryChance) {
      injured = true;
      const prevStatus = fighter.status;
      fighter.status = 'injured';
      const injuryWeeks = 4 + Math.floor(Math.random() * 5); // 4-8 semanas
      fighter.injury = {
        untilAbsWeek: absWeekNow + injuryWeeks,
        description: 'Lesionado no treino',
        resumeStatus: prevStatus,
      };
      fighter.availableFromAbsWeek = fighter.injury.untilAbsWeek;
      fighter.fatigue = clamp(fighter.fatigue + 30, 0, 100);
    }

    if (Math.random() < risks.overtrainingChance) {
      overtrained = true;
      fighter.morale = clamp(fighter.morale - 15, 0, 100);
      fighter.fatigue = clamp(fighter.fatigue + 20, 0, 100);
    }

    // Benefício de recuperação
    fighter.fatigue = clamp(fighter.fatigue - (intensity === 'light' ? 5 : intensity === 'medium' ? 3 : 0), 0, 100);

    return {
      success: true,
      gains,
      injured,
      overtrained,
    };
  }

  static _calculateGains(intensity, specialization) {
    const multiplier = intensity === 'light' ? 1 : intensity === 'medium' ? 2 : 4;
    const gains = {};

    const attrMap = {
      striking: ['boxing', 'kickboxing', 'muayThai'],
      grappling: ['wrestling', 'bjj'],
      cardio: ['cardio'],
      chin: ['chin'],
    };

    const attrs = attrMap[specialization] || attrMap.striking;
    for (const attr of attrs) {
      gains[attr] = Math.floor(multiplier * (0.5 + Math.random()));
    }

    return gains;
  }

  static _calculateRisks(intensity, fighter) {
    let injuryChance = 0;
    let overtrainingChance = 0;

    if (intensity === 'light') {
      injuryChance = 0.02;
      overtrainingChance = 0.01;
    } else if (intensity === 'medium') {
      injuryChance = 0.08;
      overtrainingChance = 0.05;
    } else {
      injuryChance = 0.20;
      overtrainingChance = 0.15;
    }

    // DNA: injuryProne aumenta risco de lesão
    if (fighter.dna.injuryProne) {
      injuryChance *= 2.0;
    }

    // DNA: exceptionalRecovery reduz risco de lesão
    if (fighter.dna.exceptionalRecovery) {
      injuryChance *= 0.5;
    }

    // DNA: emotionallyUnstable aumenta risco de overtraining
    if (fighter.dna.emotionallyUnstable) {
      overtrainingChance *= 1.5;
    }

    return {
      injuryChance: Math.min(injuryChance, 0.5),
      overtrainingChance: Math.min(overtrainingChance, 0.4),
    };
  }
}