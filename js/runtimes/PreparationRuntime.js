// PreparationRuntime — orquestrador do pilar PREPARAÇÃO
//
// Onda 3: implementado com as funções extraídas de CareerRuntime.
// Orquestra camp, treino, scouting, tape, pesagem.
// Toda regra de negócio permanece nos serviços especializados.

import { TRAINING_FOCUS_META, GAME_PLANS, CAMP_CONFIG, WEIGH_IN_CONFIG, WEEKLY_TRAINING_CHOICES, WEEKLY_ACTIVITIES, ACADEMIES, READINESS_CONFIG, absWeek, MOVES } from '../config/game-config.js';
import { Academy } from '../models/academy.js';
import { clamp } from '../utils/helpers.js';
import { ScoutingService } from '../services/scouting-service.js';
import { TapeService } from '../services/tape-service.js';
import { OnboardingService } from '../services/onboarding-service.js';
import { TrainingCamp } from '../controllers/training-camp.js';
import { WeeklyTrainingController } from '../controllers/weekly-training.js';
import { FightOffer } from '../models/fight-offer.js';

export class PreparationRuntime {
  constructor() {
    this.db = null;
    this.fighterCtrl = null;
    this.notifService = null;
    this.careerLogService = null;
    this.scoutingService = null;
    this.managerService = null;
    this.offerService = null;
    this.partnersService = null;
    this.seasonService = null;
    this.tapeService = null;
    this.readinessService = null;
  }

  init(dependencies) {
    this.db = dependencies.db;
    this.fighterCtrl = dependencies.fighterCtrl;
    this.notifService = dependencies.notifService;
    this.careerLogService = dependencies.careerLogService;
    this.scoutingService = dependencies.scoutingService;
    this.managerService = dependencies.managerService;
    this.offerService = dependencies.offerService;
    this.partnersService = dependencies.partnersService;
    this.seasonService = dependencies.seasonService;
    this.tapeService = dependencies.tapeService;
    this.readinessService = dependencies.readinessService;
  }

  // ===================================================================
  // WEIGH-IN
  // ===================================================================

  async autoResolveDueWeighIn(absWeekNow, fighter) {
    if (!fighter) return null;
    const bookings = await this.offerService.getAccepted();
    const booking = bookings.find(b => b.fighterId === fighter.id);
    if (!booking || booking.weighIn?.completed || absWeekNow < booking.eventAbsWeek) return null;
    return this.resolveWeighIn(WEIGH_IN_CONFIG.AUTO_STRATEGY, absWeekNow, { auto: true });
  }

  async resolveWeighIn(strategyId, absWeekNow = null, { auto = false } = {}) {
    const fighter = await this.fighterCtrl.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };

    const strategy = WEIGH_IN_CONFIG.STRATEGIES[strategyId];
    if (!strategy) return { ok: false, reason: 'Estratégia de pesagem inválida.' };

    const bookings = await this.offerService.getAccepted();
    const booking = bookings.find(b => b.fighterId === fighter.id);
    if (!booking) return { ok: false, reason: 'Nenhuma luta marcada.' };
    if (booking.weighIn?.completed) return { ok: false, reason: 'A pesagem desta luta já foi definida.' };

    const state = absWeekNow == null ? await this.seasonService.getState() : null;
    const now = absWeekNow ?? absWeek(state);
    const dueWeek = booking.eventAbsWeek - WEIGH_IN_CONFIG.WEEKS_BEFORE_FIGHT;
    if (now < dueWeek) return { ok: false, reason: 'A pesagem só abre na semana anterior à luta.' };
    if (now > booking.eventAbsWeek) return { ok: false, reason: 'Esta luta já passou.' };

    let impactMultiplier = strategy.impactMultiplier;
    let fatigueDelta = strategy.fatigueDelta;
    let moraleDelta = strategy.moraleDelta;
    let outcome = 'steady';

    if (strategyId === 'aggressive') {
      const successChance = clamp(
        WEIGH_IN_CONFIG.AGGRESSIVE_SUCCESS_BASE
          + ((fighter.weightCut?.ease || 0) / 100) * WEIGH_IN_CONFIG.AGGRESSIVE_SUCCESS_EASE_FACTOR,
        0, 1
      );
      const succeeded = Math.random() < successChance;
      impactMultiplier = succeeded ? strategy.successImpactMultiplier : strategy.failureImpactMultiplier;
      fatigueDelta = succeeded ? strategy.successFatigueDelta : strategy.failureFatigueDelta;
      moraleDelta = succeeded ? strategy.successMoraleDelta : strategy.failureMoraleDelta;
      outcome = succeeded ? 'success' : 'rough';
    }

    fighter.applyFatigue(fatigueDelta || 0);
    fighter.applyMoraleChange(moraleDelta || 0);
    booking.weighIn = {
      completed: true, strategyId, strategyLabel: strategy.label,
      impactMultiplier, fatigueDelta: fatigueDelta || 0, moraleDelta: moraleDelta || 0,
      outcome, resolvedAbsWeek: now, auto,
    };
    OnboardingService.markWeighedIn(fighter);

    await this.fighterCtrl.updateFighter(fighter);
    await this.db.put('offers', booking);

    const outcomeText = outcome === 'success'
      ? 'O corte agressivo encaixou e a reidratação foi excelente.'
      : outcome === 'rough'
        ? 'O corte agressivo cobrou seu preço; você chega mais desgastado para a luta.'
        : `${strategy.label} concluído.`;
    await this.notifService.add(
      auto ? 'info' : 'success',
      auto ? 'Pesagem resolvida pela equipe' : '⚖️ Pesagem concluída',
      outcomeText
    );

    return { ok: true, booking, weighIn: booking.weighIn };
  }

  // ===================================================================
  // TRAINING
  // ===================================================================

  async applyWeeklyTraining(fighter, academy) {
    if (fighter.status === 'injured') return;

    const facilityBonus = academy?.facility?.trainingBonus || 0;
    const focus = fighter.trainingFocus || 'striking';
    const meta = TRAINING_FOCUS_META[focus] || TRAINING_FOCUS_META.striking;

    if (focus === 'recovery') {
      const specialtyRecovery = Math.round((academy?.specialtyBonus('cardio') || 0) * 10);
      fighter.fatigue = clamp(fighter.fatigue - (12 + (academy?.facility?.recoveryBonus || 0) + specialtyRecovery), 0, 100);
      fighter.applyMoraleChange(3);
    } else {
      const specialtyBonus = academy?.specialtyBonus(focus) || 0;
      let gainChance = Math.min(0.9, 0.20 + (fighter.hidden.discipline / 100) * 0.4 + facilityBonus + specialtyBonus);
      for (const attr of meta.attrs) {
        const attrVal = fighter.attributes[attr] || 50;
        let attrChance = gainChance;
        if (attrVal >= 85) attrChance *= 0.25;
        else if (attrVal >= 70) attrChance *= 0.5;
        if (Math.random() < attrChance) {
          fighter.attributes[attr] = clamp(fighter.attributes[attr] + 1, 0, fighter.effectiveCeiling(attr));
        }
      }
      fighter.applyFatigue(4);
    }
    fighter.recover();
  }

  async applyWeeklyCamp(absWeekNow, fighter) {
    if (fighter.status === 'injured' || fighter.status === 'retired') return { result: null, canceledFight: false };
    if (!fighter.campConfig) {
      fighter.campProcessedThisWeek = false;
      return { result: null, canceledFight: false };
    }

    const { intensity } = fighter.campConfig;
    const cost = CAMP_CONFIG.WEEKLY_COST[intensity] || 0;
    if (cost > 0) {
      if (fighter.cash >= cost) {
        fighter.addTransaction(absWeekNow, 'Camp de treinamento', -cost);
      } else {
        fighter.campConfig = null;
        await this.notifService.add('warning', 'Camp Cancelado', 'Camp cancelado por falta de fundos.');
        return { result: null, canceledFight: false };
      }
    }

    let opponentArchetype = null;
    try {
      const accepted = await this.offerService.getAccepted();
      const booking = accepted.find(b => b.fighterId === fighter.id);
      if (booking) {
        const opponent = await this.fighterCtrl.getFighter(booking.opponentId);
        if (opponent) opponentArchetype = TrainingCamp.opponentArchetype(opponent);
        const perWeek = READINESS_CONFIG.CAMP_PER_WEEK[intensity] || 0;
        fighter.campReadinessPoints = Math.min(
          READINESS_CONFIG.CAMP_CAP,
          (fighter.campReadinessPoints || 0) + perWeek
        );
      }
    } catch { /* sem luta marcada */ }

    const academy = await this._getAcademy(fighter.academyId);
    const team = await this.partnersService.getTeammates(fighter);
    const result = TrainingCamp.processCamp(fighter, academy, team, absWeekNow, opponentArchetype);

    if (result?.sparring) {
      const s = result.sparring;
      if (s.osmosis) {
        await this.notifService.add('info', '🥋 Sala de Treino', `Rodando com ${s.partnerName}, você roubou um pedaço do jogo dele (${s.osmosis}).`);
      }
      if (s.partnerInjured) {
        const partner = team.find(f => f.id === fighter.campConfig.sparringPartnerId);
        if (partner) await this.partnersService.injurePartner(partner, s.injuryWeeks, absWeekNow, fighter.name);
      }
    }

    if (result?.weapon) {
      const plan = GAME_PLANS[fighter.campConfig.weaponTarget];
      await this.notifService.add(
        result.weapon.ready ? 'success' : 'info',
        '🧰 Arma Nova',
        result.weapon.ready
          ? `${plan.label} está pronta (${result.weapon.mastery}%). Traga-a numa luta e ninguém vai estar esperando.`
          : `${plan.label}: ${result.weapon.mastery}% instalada. Usá-la crua é pior que não ter plano.`
      );
    }

    if (result?.profGains && Object.keys(result.profGains).length > 0) {
      const lines = Object.entries(result.profGains).map(([moveId, amt]) => {
        const move = MOVES[moveId];
        const prof = Math.round(fighter.getMoveProficiency(moveId));
        return `${move?.name || moveId} +${amt}% (${prof}%)`;
      });
      await this.notifService.add('info', '🎯 Proficiência', lines.join(' · '));
    }

    return { result, canceledFight: !!(result?.canceledFight && result?.injured) };
  }

  async resolveWeeklyTraining(choiceKey) {
    const fighter = await this.fighterCtrl.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };

    let prompt;
    try { prompt = await this.db.get('gameState', 'weeklyTrainingPrompt'); } catch { /* ok */ }
    if (!prompt || !prompt.active) return { ok: false, reason: 'Nenhum prompt de treino semanal pendente.' };

    const cfg = WEEKLY_TRAINING_CHOICES[choiceKey];
    if (!cfg) return { ok: false, reason: 'Escolha de treino inválida.' };

    const academy = await this._getAcademy(fighter.academyId);
    const teammates = await this.partnersService.getTeammates(fighter);
    const seasonState = await this.seasonService.getState();
    const now = absWeek(seasonState);

    const result = WeeklyTrainingController.applyChoice(fighter, choiceKey, academy, teammates, now);
    if (!result) return { ok: false, reason: 'Falha ao aplicar treino semanal.' };

    await this.fighterCtrl.updateFighter(fighter);
    await this.db.delete('gameState', 'weeklyTrainingPrompt');

    if (this.careerLogService) {
      await this.careerLogService.publish(fighter.id, 'weekly_training', now, 20, {
        choice: choiceKey,
        gains: Object.keys(result.gains).length > 0 ? Object.entries(result.gains).map(([a, v]) => `${a}+${v}`).join(', ') : 'nenhum',
        injured: result.injured,
      });
    }

    if (result.injured) {
      await this.notifService.add('warning', 'Lesão no Treino', 'Você se lesionou durante o treino semanal intenso.');
    }

    return { ok: true, ...result };
  }

  async setTrainingFocus(focus) {
    if (!TRAINING_FOCUS_META[focus]) return null;
    const fighter = await this.fighterCtrl.getPlayerFighter();
    if (!fighter) return null;
    fighter.trainingFocus = focus;
    await this.fighterCtrl.updateFighter(fighter);
    return fighter;
  }

  async setActivity(activityKey) {
    const fighter = await this.fighterCtrl.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    if (activityKey && !WEEKLY_ACTIVITIES[activityKey]) return { ok: false, reason: 'Atividade inválida.' };
    fighter.weeklyActivity = activityKey || null;
    await this.fighterCtrl.updateFighter(fighter);
    return { ok: true };
  }

  // ===================================================================
  // SCOUTING / DOSSIER
  // ===================================================================

  async studyOpponent(fighterId) {
    const fighter = await this.fighterCtrl.getPlayerFighter();
    const opponent = await this.fighterCtrl.getFighter(fighterId);
    if (!opponent) return { ok: false, reason: 'Lutador não encontrado.' };

    const state = await this.seasonService.getState();
    const result = await this.scoutingService.study(opponent, fighter, absWeek(state));
    if (result.ok) {
      await this.fighterCtrl.updateFighter(fighter);
      await this.notifService.add('info', '🔍 Relatório', `${opponent.name} agora está "${result.label}". Custo: $${result.cost.toLocaleString()}.`);
    }
    return result;
  }

  async opponentDossier(offer) {
    const fighter = await this.fighterCtrl.getPlayerFighter();
    const opponent = await this.fighterCtrl.getFighter(offer.opponentId);
    if (!opponent) return null;

    const manager = fighter.managerId ? await this.managerService.getManager(fighter.managerId) : null;
    const hasBaseline = this.managerService.givesBaselineScouting(manager);
    const level = await this.scoutingService.knowledgeOf(opponent, fighter.id, hasBaseline);
    const scoutingBoost = fighter.scoutingBoost || 0;
    if (scoutingBoost > 0) {
      fighter.scoutingBoost = 0;
      await this.fighterCtrl.updateFighter(fighter);
    }
    const effectiveLevel = Math.min(3, level + scoutingBoost);
    const nextCost = level < 3 ? this.scoutingService.studyCost(level + 1) : null;

    const seed = [...offer.id].reduce((s, c) => s + c.charCodeAt(0), 0);

    return {
      opponent,
      level: effectiveLevel,
      levelLabel: ScoutingService.levelLabel(level),
      nextCost,
      canAfford: nextCost != null && fighter.cash >= nextCost,
      attrs: {
        striking: ScoutingService.blurWithOffset(opponent.strikingScore, level, seed),
        grappling: ScoutingService.blurWithOffset(opponent.grapplingScore, level, seed),
        cardio: ScoutingService.blurWithOffset(opponent.attributes.cardio, level, seed),
        fightIQ: ScoutingService.blurWithOffset(opponent.attributes.fightIQ, level, seed),
        chin: ScoutingService.blurWithOffset(opponent.attributes.chin, level, seed),
      },
      tendencies: ScoutingService.readWithErrors(opponent, level, seed),
      dna: ScoutingService.revealsDna(level) ? opponent.dnaTraits : null,
      theirRead: await this.theirRead(fighter, opponent, offer, level),
    };
  }

  async theirRead(fighter, opponent, offer, level) {
    let rivalryIntensity = 0;
    try {
      const rivalries = await this.db.getAll('rivalries');
      const filtered = rivalries.filter(r =>
        r.fighterAId === fighter.id || r.fighterBId === fighter.id
      );
      rivalryIntensity = filtered.find(r => r.fighterAId === opponent.id || r.fighterBId === opponent.id)?.intensity || 0;
    } catch { /* sem rivalidade */ }

    const truth = TapeService.opponentPlanFor(opponent, fighter, {
      rivalryIntensity,
      opponentAcademy: ACADEMIES.find(a => a.id === opponent.academyId) || null,
    });

    const tape = TapeService.tapeOf(fighter);
    const base = {
      exposure: Math.round(tape.exposure),
      exposureLabel: TapeService.exposureLabel(tape.exposure),
      signature: truth.signature,
      canBait: TapeService._canBait(fighter, offer.gamePlan || 'balanced'),
      bait: !!offer.bait,
      weapon: tape.weapon && !tape.weapon.revealed ? { ...tape.weapon } : null,
    };

    const strategyBonus = fighter.campStrategyBonus || 0;
    if (strategyBonus > 0) {
      fighter.campStrategyBonus = 0;
      await this.fighterCtrl.updateFighter(fighter);
    }
    const effectiveLevel = Math.min(3, level + strategyBonus);

    if (effectiveLevel === 0) return { ...base, predictedPlanKey: null, reliable: false };

    const seed = [...offer.id].reduce((s, c) => s + c.charCodeAt(0), 0);
    const misread = effectiveLevel === 1 && seed % 3 === 0;
    const alternatives = Object.keys(GAME_PLANS).filter(k => k !== truth.planKey);
    const predicted = misread ? alternatives[seed % alternatives.length] : truth.planKey;

    return { ...base, predictedPlanKey: predicted, reliable: effectiveLevel >= 2 };
  }

  // ===================================================================
  // GAME PLAN
  // ===================================================================

  async setGamePlan(offerId, plan) {
    if (!GAME_PLANS[plan]) return { ok: false, reason: 'Plano inválido.' };
    const data = await this.db.get('offers', offerId);
    if (!data) return { ok: false, reason: 'Luta não encontrada.' };

    const offer = new FightOffer(data);
    offer.gamePlan = plan;
    offer.planConfirmed = true;
    offer.bait = false;
    await this.db.put('offers', offer);
    return { ok: true, plan };
  }

  async setBait(offerId, on) {
    const fighter = await this.fighterCtrl.getPlayerFighter();
    const data = await this.db.get('offers', offerId);
    if (!data || !fighter) return { ok: false, reason: 'Luta não encontrada.' };

    const offer = new FightOffer(data);
    if (on && !TapeService._canBait(fighter, offer.gamePlan || 'balanced')) {
      return { ok: false, reason: 'Você não tem uma assinatura pra fingir — ou o plano escolhido JÁ é a sua assinatura.' };
    }

    offer.bait = !!on;
    await this.db.put('offers', offer);
    return { ok: true, bait: offer.bait };
  }

  // ===================================================================
  // HELPERS
  // ===================================================================

  async _getAcademy(id) {
    if (!id) return null;
    const data = await this.db.get('organization', id);
    return data ? new Academy(data) : null;
  }
}
