// ============================================================
// InjuryService — lesões, suspensões, recuperação
// ============================================================
// Extraído de world-service.js (Fase 14 — reestruturação técnica).
// Gerencia a aplicação de suspensões médicas, rolagem de lesões
// pós-luta e recuperação semanal de lutadores.

import { Fighter } from '../models/fighter.js';
import { formatWeeks } from '../utils/helpers.js';
import {
  WORLD_CONFIG,
  PERMANENT_SCAR_TABLE,
  DNA_DISCOVERY_CONFIG,
  INJURY_CONFIG,
  CONSECUTIVE_KO_CONFIG,
} from '../config/game-config.js';
import { computeSuspensionWeeks, rollInjurySeverity } from '../config/game-config.js';

export class InjuryService {
  constructor(db, careerLogService, notifService) {
    this.db = db;
    this.careerLogService = careerLogService;
    this.notifService = notifService;
  }

  /** Aplica suspensão médica mínima pós-luta */
  applySuspension(fighter, result, absWeekNow) {
    const won = result.winnerId === fighter.id;
    const weeks = computeSuspensionWeeks(result.method, won);
    const suspendedUntil = absWeekNow + weeks;
    const injuryRestUntil = fighter.injury?.restUntilAbsWeek || fighter.injury?.untilAbsWeek || 0;
    fighter.availableFromAbsWeek = Math.max(suspendedUntil, injuryRestUntil);
  }

  /** Rola chance de lesão pós-luta e aplica se ocorrer */
  async rollInjury(fighter, result, absWeekNow, playerFighterId) {
    const won = result.winnerId === fighter.id;
    const isFinish = result.method && !result.method.startsWith('Decision');

    let chance = won ? WORLD_CONFIG.INJURY_CHANCE_WINNER : WORLD_CONFIG.INJURY_CHANCE_LOSER;
    if (!won && isFinish) chance += WORLD_CONFIG.INJURY_CHANCE_FINISH_BONUS;
    if (fighter.hasDNA('injuryProne')) chance += WORLD_CONFIG.INJURY_CHANCE_PRONE_BONUS;

    const isKoTkoLoss = !won && result.method && (result.method.startsWith('KO') || result.method.startsWith('TKO'));
    if (fighter.id === playerFighterId) {
      fighter.consecutiveKoTkoLosses = isKoTkoLoss ? (fighter.consecutiveKoTkoLosses || 0) + 1 : 0;
    }

    if (Math.random() >= chance) return;

    const severity = rollInjurySeverity();
    let weeks = severity.weeks;

    let examNote = '';
    if (fighter.id === playerFighterId && isKoTkoLoss && fighter.consecutiveKoTkoLosses >= CONSECUTIVE_KO_CONFIG.EXAM_THRESHOLD) {
      weeks += CONSECUTIVE_KO_CONFIG.EXAM_EXTRA_WEEKS;
      examNote = ` — exame neurológico obrigatório após ${fighter.consecutiveKoTkoLosses} nocautes seguidos`;
      if (this.careerLogService) {
        await this.careerLogService.publish(fighter.id, 'consecutive_ko_exam', absWeekNow, 65, {
          count: fighter.consecutiveKoTkoLosses,
        });
      }
    }
    if (fighter.id === playerFighterId && isKoTkoLoss && fighter.consecutiveKoTkoLosses >= CONSECUTIVE_KO_CONFIG.RETIREMENT_WARNING_THRESHOLD) {
      await this.notifService.add('danger', '🧠 Recomendação Médica',
        `${fighter.consecutiveKoTkoLosses} nocautes seguidos. Times médicos recomendam fortemente considerar a aposentadoria — o risco acumulado é real.`);
    }

    fighter.injury = {
      stage: 'rest',
      restUntilAbsWeek: absWeekNow + weeks,
      rehabEndAbsWeek: 0,
      type: severity.type,
      description: `${severity.label} — ${formatWeeks(weeks)}${examNote}`,
      rehabCost: 0,
      rehabChosen: false,
      resumeStatus: fighter.status,
    };
    fighter.status = 'injured';

    // §B.1 — injuryProne discovery
    if (fighter.hasDNA('injuryProne') && !fighter.isDiscovered('injuryProne')
      && fighter.injuryCount >= 1
      && (absWeekNow - fighter.lastInjuryAbsWeek) < DNA_DISCOVERY_CONFIG.INJURY_PRONE_WINDOW_WEEKS) {
      fighter.discoverTrait('injuryProne');
    }
    fighter.injuryCount = (fighter.injuryCount || 0) + 1;
    fighter.lastInjuryAbsWeek = absWeekNow;

    // §B.2 — scar system
    const scarChance = weeks >= WORLD_CONFIG.SCAR_SEVERE_WEEKS_THRESHOLD
      ? WORLD_CONFIG.SCAR_CHANCE_SEVERE
      : WORLD_CONFIG.SCAR_CHANCE_LIGHT;
    if (Math.random() < scarChance) {
      const template = PERMANENT_SCAR_TABLE[Math.floor(Math.random() * PERMANENT_SCAR_TABLE.length)];
      fighter.permanentScars.push({
        bodyPart: template.bodyPart,
        attributeCeilings: { ...template.attributeCeilings },
        compensation: { ...template.compensation },
        fromFightId: result.id,
        atAbsWeek: absWeekNow,
      });
      for (const [attr, bonus] of Object.entries(template.compensation)) {
        fighter.attributes[attr] = Math.min(fighter.effectiveCeiling(attr), (fighter.attributes[attr] || 50) + bonus);
      }
      if (this.careerLogService && fighter.id === playerFighterId) {
        await this.careerLogService.publish(fighter.id, 'permanent_scar', absWeekNow, 55, { bodyPart: template.bodyPart });
      }
    }

    // Sequelas de KO/TKO
    if (fighter.id === playerFighterId && !won && isFinish) {
      const method = result.method || '';
      if (Math.random() < INJURY_CONFIG.SEVERE_INJURY_CHANCE) {
        let attr = null;
        let desc = '';
        if (method.startsWith('KO')) {
          attr = 'chin';
          desc = 'Sequela de nocaute';
        } else if (method.startsWith('TKO')) {
          attr = Math.random() < 0.5 ? 'speed' : 'chin';
          desc = attr === 'speed' ? 'Lesão articular grave' : 'Sequela de TKO';
        } else if (method === 'Submission') {
          attr = 'speed';
          desc = 'Lesão em articulação';
        }
        if (attr) {
          fighter.applySequelae(attr, desc);
          if (this.careerLogService) {
            const seq = fighter.sequelae?.[fighter.sequelae.length - 1];
            await this.careerLogService.publish(fighter.id, 'sequela', absWeekNow, 60, {
              attr,
              reduction: seq?.reduction,
              description: desc,
            });
          }
        }
      }
    }
  }

  /** Recupera lutadores cujo tempo de lesão expirou */
  async recoverInjuries(absWeekNow, playerFighterId) {
    const injured = await this.db.getIndex('fighters', 'status', 'injured');
    for (const data of injured) {
      if (!data.injury) continue;
      const healWeek = data.injury.restUntilAbsWeek || data.injury.untilAbsWeek || 0;
      if (healWeek > absWeekNow) continue;
      const fighter = new Fighter(data);
      fighter.status = fighter.injury.resumeStatus || 'roster';
      fighter.injury = null;
      await this.db.put('fighters', fighter);
      if (fighter.id === playerFighterId) {
        await this.notifService.add('success', 'Recuperado', `${fighter.name} está liberado pelo departamento médico.`);
      }
    }
  }
}
