import { clamp, formatWeeks } from '../utils/helpers.js';
import { WEEKLY_TRAINING_CHOICES, TRAINING_FOCUS_META, rollInjurySeverity } from '../config/game-config.js';
import { TrainingPartnersService } from '../services/training-partners-service.js';

// Microdecisões de treino semanal — Fase 1.
//
// A cada ~4 semanas, quando o lutador não tem luta marcada, surge a escolha
// de como treinar naquela semana: intenso (alto risco/recompensa), técnico
// (progressão segura), recuperação ativa (descanso) ou parceiro (vínculo).
//
// O efeito é aplicado em cima do treino semanal normal — é um bônus
// extra, não uma substituição.
export class WeeklyTrainingController {
  static getChoices(fighter) {
    return Object.entries(WEEKLY_TRAINING_CHOICES).map(([key, cfg]) => ({
      key,
      label: cfg.label,
      description: cfg.description,
      attrMult: cfg.attrMult,
      fatigueGain: cfg.fatigueGain,
      moraleEffect: cfg.moraleEffect,
      injuryRisk: cfg.injuryRisk,
      bondBoost: cfg.bondBoost || false,
    }));
  }

  static applyChoice(fighter, choiceKey, academy, teammates, absWeekNow) {
    const cfg = WEEKLY_TRAINING_CHOICES[choiceKey];
    if (!cfg) return null;

    const focus = fighter.trainingFocus || 'striking';
    const focusMeta = TRAINING_FOCUS_META[focus];
    const academyBonus = academy?.specialties?.[focus] || 0;

    const gains = {};
    if (focusMeta?.attrs) {
      for (const attr of focusMeta.attrs) {
        const gain = Math.round((2 + Math.random() * 3) * cfg.attrMult * (1 + academyBonus));
        const ceiling = fighter.effectiveCeiling(attr);
        const before = fighter.attributes[attr] || 50;
        fighter.attributes[attr] = clamp(before + gain, 0, ceiling);
        gains[attr] = fighter.attributes[attr] - before;
      }
    }

    fighter.fatigue = clamp(fighter.fatigue + cfg.fatigueGain, 0, 100);
    fighter.morale = clamp(fighter.morale + cfg.moraleEffect, 0, 100);

    let injured = false;
    if (Math.random() < cfg.injuryRisk) {
      // Bug real: isto somava um offset de 1-3 semanas em cima de
      // fighter.injury?.restUntilAbsWeek — que é null aqui (não dá pra
      // escolher treino semanal já lesionado) — então virava "0 + 1..3",
      // uma semana ABSOLUTA lá no início do jogo. Depois da semana 3 de
      // carreira (ou seja, quase sempre), a lesão já nascia "vencida":
      // _recoverInjuries via absWeekNow > restUntilAbsWeek liberava o
      // lutador no tick seguinte, não importa a intenção de 1-3 semanas.
      const severity = rollInjurySeverity(['bruise', 'cut']);
      fighter.status = 'injured';
      fighter.injury = {
        stage: 'rest',
        restUntilAbsWeek: absWeekNow + severity.weeks,
        rehabEndAbsWeek: 0,
        type: severity.type,
        description: `${severity.label} durante treino — ${formatWeeks(severity.weeks)}`,
        rehabCost: 0,
        rehabChosen: false,
        resumeStatus: 'active',
      };
      injured = true;
    }

    const bondGains = [];
    if (cfg.bondBoost && teammates.length > 0) {
      const partner = teammates[Math.floor(Math.random() * teammates.length)];
      const currentBond = TrainingPartnersService.bondOf(fighter, partner.id);
      TrainingPartnersService._setBond(fighter, partner.id, Math.min(100, currentBond + 5));
      bondGains.push({ partnerName: partner.name, newBond: currentBond + 5 });
    }

    return { gains, fatigueDelta: cfg.fatigueGain, moraleDelta: cfg.moraleEffect, injured, bondGains };
  }
}
