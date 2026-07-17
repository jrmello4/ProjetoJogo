import { LIFESTYLE_TIERS, OPTIONAL_SERVICES, WEEKLY_ACTIVITIES } from '../config/game-config.js';
import { clamp } from '../utils/helpers.js';

// Financeiro pessoal do lutador — custo de vida, serviços opcionais,
// atividades de lazer. Funções puras que mutam o fighter passado como
// parâmetro (sem acesso a DB ou services).
export class FinanceController {
  // Economia pessoal (§A.2/§E.1/§PRD): despesas quebradas em categorias
  // individuais + serviços opcionais.
  static applyWeeklyEconomy(fighter, academy, now) {
    const academyFee = academy?.weeklyFee || 0;
    const lifestyle = LIFESTYLE_TIERS[fighter.lifestyleTier] || LIFESTYLE_TIERS.modest;

    // Quebra do custo de vida em componentes
    const rentPct = 0.45;
    const foodPct = 0.25;
    const transportPct = 0.15;
    const rent = Math.round(lifestyle.weeklyCost * rentPct);
    const food = Math.round(lifestyle.weeklyCost * foodPct);
    const transport = Math.round(lifestyle.weeklyCost * transportPct);
    const leisure = Math.max(0, lifestyle.weeklyCost - rent - food - transport);

    if (academyFee > 0) fighter.addTransaction(now, `Mensalidade — ${academy.name}`, -academyFee);
    if (rent > 0) fighter.addTransaction(now, `Aluguel (${lifestyle.label})`, -rent);
    if (food > 0) fighter.addTransaction(now, `Alimentação (${lifestyle.label})`, -food);
    if (transport > 0) fighter.addTransaction(now, `Transporte (${lifestyle.label})`, -transport);
    if (leisure > 0) fighter.addTransaction(now, `Lazer (${lifestyle.label})`, -leisure);

    // Efeitos de moral/popularidade do padrão de vida
    if (lifestyle.moraleBonus) fighter.morale = clamp(fighter.morale + Math.round(lifestyle.moraleBonus / 4), 0, 100);
    if (lifestyle.popularityBonus) fighter.updatePopularity(Math.round(lifestyle.popularityBonus / 4));

    // Serviços opcionais contratados
    let serviceTotal = 0;
    const SERVICES = OPTIONAL_SERVICES;
    for (const key of fighter.hiredServices || []) {
      const svc = SERVICES[key];
      if (!svc) continue;
      serviceTotal += svc.weeklyCost;
      fighter.addTransaction(now, svc.label, -svc.weeklyCost);
      // Efeitos aplicados na applyWeeklyServices()
    }

    const total = academyFee + lifestyle.weeklyCost + serviceTotal;
    return { expenses: { academyFee, rent, food, transport, leisure, services: serviceTotal, total }, income: { total: 0 }, net: -total };
  }

  // Aplica efeitos dos serviços opcionais contratados
  static applyWeeklyServices(fighter) {
    for (const key of fighter.hiredServices || []) {
      switch (key) {
        case 'physio':
          fighter.fatigue = clamp(fighter.fatigue - 2, 0, 100);
          // Also helps injury recovery (checked elsewhere)
          break;
        case 'nutritionist':
          // Effect is applied in effectiveCeiling via model
          break;
        case 'psychologist':
          fighter.morale = clamp(fighter.morale + 1, 0, 100);
          break;
      }
    }
  }

  // Atividade de lazer semanal (§PRD: vida fora do octógono)
  static applyWeeklyActivity(fighter, now) {
    const activityKey = fighter.weeklyActivity;
    if (!activityKey) return;
    const act = WEEKLY_ACTIVITIES[activityKey];
    if (!act) return;

    fighter.weeklyActivity = null; // consome a atividade

    if (act.fatigueRecovery) fighter.fatigue = clamp(fighter.fatigue - act.fatigueRecovery, 0, 100);
    if (act.fatigueCost) fighter.fatigue = clamp(fighter.fatigue + act.fatigueCost, 0, 100);
    if (act.moraleGain) fighter.morale = clamp(fighter.morale + act.moraleGain, 0, 100);
    if (act.popularityGain) fighter.updatePopularity(act.popularityGain);
    if (act.cost) {
      if (fighter.cash >= act.cost) {
        fighter.addTransaction(now, act.label, -act.cost);
        // addTransaction já deduz do cash
      }
    }
    if (act.injuryHealChance && fighter.injury && Math.random() < act.injuryHealChance) {
      fighter.injury.restUntilAbsWeek -= 7; // acelera recuperação em 1 semana
    }
    if (act.attrGainChance && Math.random() < act.attrGainChance) {
      const keys = Object.keys(fighter.attributes);
      const attr = keys[Math.floor(Math.random() * keys.length)];
      fighter.attributes[attr] = Math.min(fighter.effectiveCeiling(attr), (fighter.attributes[attr] || 50) + Math.floor(Math.random() * 2) + 1);
    }
  }
}
