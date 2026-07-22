import { Fighter } from '../models/fighter.js';
import { DB } from '../services/db.js';
import { DataGenerator } from '../services/data-generator.js';
import { TrainingPartnersService } from '../services/training-partners-service.js';
import { CAREER_EVENT_TYPES } from '../services/career-event-bus.js';
import { StyleService } from '../services/style-service.js';
import { VisualIdentityService } from '../services/visual-identity-service.js';
import { generateId, clamp, sanitizePlayerName } from '../utils/helpers.js';
import {
  ARCHETYPES,
  ORIGINS,
  DIFFICULTIES,
  LIFESTYLE_TIERS,
  LIFESTYLE_DOWNGRADE_MORALE_PENALTY,
  SYNERGY_CONFIG,
  PARTNER_CONFIG,
  CHALLENGE_MODES,
  absWeek,
} from '../config/game-config.js';
import { OnboardingService } from '../services/onboarding-service.js';
import { OFFER_CONFIG } from '../config/game-config.js';
import { CareerRuntime } from '../runtimes/CareerRuntime.js';

// v4: carreira de 1 lutador — Academy substitui Gym/RivalGym, economia
// pessoal, sem elenco. Ver docs/superpowers/specs/2026-07-13-carreira-sistemica-1-lutador-design.md

// Orquestrador da carreira: o jogador É o lutador, do primeiro contrato à
// aposentadoria. As promoções são IA e o mundo gira sozinho a cada semana.
// Fachada compatível: preserva a API pública e delega a orquestração aos runtimes.
export class GameController {
  constructor() {
    this.db = new DB();
    this.runtime = null;
    this.fighterCtrl = null;
    this.eventCtrl = null;
    this.seasonService = null;
    this.notifService = null;
    this.worldService = null;
    this.offerService = null;
    this.sponsorService = null;
    this.titleService = null;
    this.scoutingService = null;
    this.contractService = null;
    this.managerService = null;
    this.careerLogService = null;
    this.careerEventBus = null;
    this.careerEvents = null;
    this.rivalryService = null;
    this.socialMediaService = null;
    this.podcastService = null;
    this.yearReviewService = null;
    this.financeCtrl = null;
    this.narrativeCtrl = null;
    this.careerCtrl = null;
    this.lastWeekDebug = null;
  }

  async init() {
    this.runtime = new CareerRuntime();
    const fighter = await this.runtime.init(this.db);

    // Copia referências dos serviços do CareerRuntime (mesmos objetos)
    this.db = this.runtime.db;
    this.fighterCtrl = this.runtime.fighterCtrl;
    this.eventCtrl = this.runtime.eventCtrl;
    this.seasonService = this.runtime.seasonService;
    this.notifService = this.runtime.notifService;
    this.careerLogService = this.runtime.careerLogService;
    this.careerEventBus = this.runtime.careerEventBus;
    this.careerEvents = this.runtime.careerEvents;
    this.titleService = this.runtime.titleService;
    this.scoutingService = this.runtime.scoutingService;
    this.contractService = this.runtime.contractService;
    this.managerService = this.runtime.managerService;
    this.partnersService = this.runtime.partnersService;
    this.worldService = this.runtime.worldService;
    this.offerService = this.runtime.offerService;
    this.sponsorService = this.runtime.sponsorService;
    this.socialMediaService = this.runtime.socialMediaService;
    this.podcastService = this.runtime.podcastService;
    this.yearReviewService = this.runtime.yearReviewService;
    this.narrativeChainService = this.runtime.narrativeChainService;
    this.monetizationService = this.runtime.monetizationService;
    this.rivalryService = this.runtime.rivalryService;
    this.financeCtrl = this.runtime.financeCtrl;
    this.narrativeCtrl = this.runtime.narrativeCtrl;
    this.careerCtrl = this.runtime.careerCtrl;

    // Handlers que referenciam métodos do próprio GameController
    this._registerCareerEventHandlers();

    return fighter;
  }

  _registerCareerEventHandlers() {
    this.careerEventBus.subscribe(CAREER_EVENT_TYPES.FIGHT_COMPLETED, async ({ payload }) => {
      if (!payload.playerFighterId) return;
      const isPlayerFight = payload.fighterAId === payload.playerFighterId || payload.fighterBId === payload.playerFighterId;
      if (!isPlayerFight) return;

      const fighterA = await this.fighterCtrl.getFighter(payload.fighterAId);
      const fighterB = await this.fighterCtrl.getFighter(payload.fighterBId);
      if (fighterA && fighterB) {
        await this.rivalryService.checkPostFight(
          fighterA, fighterB, payload.result,
          payload.isMainCard, payload.absWeek, payload.playerFighterId,
        );
      }

      await this._applyCoachSynergyFromFight(payload);
    });
  }

  async _applyCoachSynergyFromFight(payload) {
    const tally = payload.cornerTally || [];
    if (tally.length === 0 || payload.fighterAId !== payload.playerFighterId) return;

    const won = !payload.result.isDraw && payload.result.winnerId === payload.playerFighterId;
    const fighter = await this.fighterCtrl.getFighter(payload.playerFighterId);
    if (!fighter) return;
    const academy = await this.getAcademy(fighter.academyId);
    const growthRate = SYNERGY_CONFIG.GROWTH_RATE_BY_FACILITY[(academy?.facilityLevel || 1) - 1] ?? 1;
    const followed = tally.filter(entry => entry.followed).length;
    const ignored = tally.filter(entry => !entry.followed).length;
    const delta = Math.round(
      (won ? followed * SYNERGY_CONFIG.GAIN_ON_INSTRUCTION_FOLLOWED_AND_WON : 0) * growthRate +
      (!won && !payload.result.isDraw ? ignored * SYNERGY_CONFIG.LOSS_ON_INSTRUCTION_IGNORED_AND_LOST : 0) * growthRate,
    );
    if (delta === 0) return;

    fighter.coachSynergy = clamp((fighter.coachSynergy || 0) + delta, 0, 100);
    await this.fighterCtrl.updateFighter(fighter);
  }

  getDebugSnapshot() {
    return {
      lastWeek: this.runtime?.lastWeekDebug ?? this.lastWeekDebug,
      events: this.careerEventBus?.getStats() || null,
      recentEvents: this.careerEventBus?.recent(20) || [],
    };
  }

  // ===== Criação de personagem =====
  async createPlayerFighter({ name, weightClass, archetype, origin, difficultyId, academyId, managerId = null, challengeMode = null, appearance = null }) {
    const difficulty = DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[1];
    const arch = ARCHETYPES[archetype] || ARCHETYPES.generalist;
    const orig = ORIGINS[origin] || null;

    const data = DataGenerator.generateFighter(null, {
      weightClass,
      skillRange: [40, 55],
      age: 20 + Math.floor(Math.random() * 4),
      maxFights: 0,
    });

    for (const attr of arch.seedAttrs) {
      data.attributes[attr] = clamp((data.attributes[attr] || 50) + arch.seedBonus, 1, 99);
    }
    if (orig) {
      for (const attr of orig.seedAttrs) {
        data.attributes[attr] = clamp((data.attributes[attr] || 50) + orig.seedBonus, 1, 99);
      }
    }

    data.id = generateId();
    data.name = sanitizePlayerName(name, { fallback: data.name || 'Lutador Anônimo' });
    data.fightingStyle = orig?.label || arch.label;

    if (orig?.styleKey) {
      data.style = orig.styleKey;
      data.moveset = StyleService.randomMoveset(orig.styleKey, 6);
      const oldProfs = Object.values(data.moveProficiency || {});
      const base = oldProfs.length ? Math.round(oldProfs.reduce((a, b) => a + b, 0) / oldProfs.length) : 40;
      data.moveProficiency = {};
      for (const m of data.moveset) {
        data.moveProficiency[m] = clamp(base + Math.floor(Math.random() * 21) - 10, 10, 100);
      }
    }
    data.status = 'roster';
    data.organizationId = null;
    data.academyId = academyId;
    data.academyJoinedAbsWeek = 1;
    data.managerId = managerId;
    data.cash = difficulty.cash;
    data.lifestyleTier = 'modest';
    data.appearance = appearance;
    data.visualUnlocks = ['street_simple'];
    data.visualAutoEvolve = false;
    data.visualLock = !!appearance;
    data.wasChampion = false;
    data.titlesWon = data.titlesWon || 0;

    if (challengeMode && CHALLENGE_MODES[challengeMode]) {
      CHALLENGE_MODES[challengeMode].apply(data);
    }

    await this.db.put('fighters', data);
    await this.fighterCtrl.setPlayerFighterId(data.id);

    const fighter = new Fighter(data);
    await this._ensureInitialOffers(fighter);

    if (challengeMode && CHALLENGE_MODES[challengeMode] && this.careerLogService) {
      const state = await this.seasonService.getState();
      await this.careerLogService.publish(
        fighter.id, 'challenge_start', absWeek(state), 50,
        { mode: CHALLENGE_MODES[challengeMode].name }
      );
    }

    return fighter;
  }

  async _ensureInitialOffers(fighter) {
    const promotions = await this.worldService.getPromotions();
    for (let attempt = 0; attempt < 3; attempt++) {
      const created = await this.offerService.generateWeekly(1, fighter, await this._playerAcademyReputation(fighter), promotions);
      if (created.length > 0) break;
    }
  }

  // ===== Queries (delegadas ao CareerRuntime) =====
  async getPlayerFighter() {
    return this.runtime.getPlayer();
  }

  async getAcademies() {
    return this.runtime.getAcademies();
  }

  async getAcademy(id) {
    return this.runtime.getAcademy(id);
  }

  async getPlayerAcademy() {
    return this.runtime.getPlayerAcademy();
  }

  async _playerAcademyReputation(fighter) {
    return this.runtime.playerAcademyReputation(fighter);
  }

  async getManagers() {
    return this.runtime.getManagers();
  }

  async getPlayerManager() {
    return this.runtime.getPlayerManager();
  }

  async getMilestones() {
    return this.runtime.getMilestones();
  }

  async getCalendarData() {
    return this.runtime.getCalendar();
  }

  // ===== Academias =====
  async switchAcademy(academyId) {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    if (fighter.academyId === academyId) return { ok: false, reason: 'Você já treina aí.' };

    const academy = await this.getAcademy(academyId);
    if (!academy) return { ok: false, reason: 'Academia não encontrada.' };

    const state = await this.seasonService.getState();
    if (fighter.academyId && !fighter.previousAcademyIds.includes(fighter.academyId)) {
      fighter.previousAcademyIds.push(fighter.academyId);
    }
    fighter.academyId = academyId;
    fighter.academyJoinedAbsWeek = absWeek(state);
    fighter.coachSynergy = Math.round(fighter.coachSynergy * 0.4);
    await this.fighterCtrl.updateFighter(fighter);
    if (this.careerLogService) {
      await this.careerLogService.publish(fighter.id, 'academy_switch', absWeek(state), 40, { academyName: academy.name });
    }
    return { ok: true, academy };
  }

  // ===== Empresário =====
  async hireManager(managerId) {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    const state = await this.seasonService.getState();
    const result = await this.managerService.hire(fighter, managerId, absWeek(state));
    if (result.ok) await this.fighterCtrl.updateFighter(fighter);
    return result;
  }

  async terminateManager() {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    const state = await this.seasonService.getState();
    const result = await this.managerService.terminate(fighter, absWeek(state));
    if (result.ok) await this.fighterCtrl.updateFighter(fighter);
    return result;
  }

  // ===== Custo de vida =====
  async setLifestyle(tier) {
    if (!LIFESTYLE_TIERS[tier]) return { ok: false, reason: 'Padrão de vida inválido.' };
    const fighter = await this.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };

    const tiers = ['modest', 'comfortable', 'luxurious'];
    const wasHigher = tiers.indexOf(tier) < tiers.indexOf(fighter.lifestyleTier);
    if (wasHigher && fighter.everReachedLifestyle[fighter.lifestyleTier]) {
      fighter.morale = clamp(fighter.morale - LIFESTYLE_DOWNGRADE_MORALE_PENALTY, 0, 100);
    }
    fighter.lifestyleTier = tier;
    VisualIdentityService.syncUnlocks(fighter);
    if (fighter.visualAutoEvolve) {
      VisualIdentityService.applyCareerVisualRewards(fighter, {
        preferUnlockIds: tier === 'luxurious' ? ['luxury_blazer', 'media_shades'] : ['street_simple'],
      });
    }
    fighter.everReachedLifestyle[tier] = true;
    await this.fighterCtrl.updateFighter(fighter);
    return { ok: true };
  }

  // ===== Tick semanal (delegado ao CareerRuntime) =====
  async processWeek(cornerHooks = null) {
    return this.runtime.processWeek(cornerHooks);
  }

  // ===== Simulação de período (fast-forward) =====
  async simulateWeeks(count, options = {}) {
    return this.runtime.simulateWeeks(count, options);
  }

  async resolveSocialPrompt(choice) {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    return this.narrativeCtrl.resolveSocialPrompt(choice, fighter.id);
  }

  // ===== Pesagem (delegado ao CareerRuntime) =====
  async resolveWeighIn(strategyId, absWeekNow, options) {
    return this.runtime.preparation.resolveWeighIn(strategyId, absWeekNow, options);
  }

  async resolveRehabChoice(choiceKey) {
    return this.runtime.resolveRehabChoice(choiceKey);
  }

  async resolveEndCareer(fighterId, choiceKey) {
    return this.runtime.resolveEndCareer(fighterId, choiceKey);
  }

  async resolveRivalryInteraction(choice) {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    return this.narrativeCtrl.resolveRivalryInteraction(choice, fighter.id);
  }

  async resolveNarrativeChoice(choiceKey) {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    return this.narrativeCtrl.resolveNarrativeChoice(choiceKey, fighter.id);
  }

  // ===== Preparação (delegado ao PreparationRuntime) =====
  async resolveWeeklyTraining(choiceKey) {
    return this.runtime.preparation.resolveWeeklyTraining(choiceKey);
  }

  async setTrainingFocus(focus) {
    return this.runtime.preparation.setTrainingFocus(focus);
  }

  async studyOpponent(fighterId) {
    return this.runtime.preparation.studyOpponent(fighterId);
  }

  async setGamePlan(offerId, plan) {
    return this.runtime.preparation.setGamePlan(offerId, plan);
  }

  async setBait(offerId, on) {
    return this.runtime.preparation.setBait(offerId, on);
  }

  async opponentDossier(offer) {
    return this.runtime.preparation.opponentDossier(offer);
  }

  async setWeeklyActivity(activityKey) {
    return this.runtime.preparation.setActivity(activityKey);
  }

  // ===== Ofertas =====
  async acceptOffer(offerId, absWeekNow) {
    const fighter = await this.getPlayerFighter();
    const data = await this.db.get('offers', offerId);
    const teammate = data ? await this.partnersService.isTeammate(fighter, data.opponentId) : null;

    const result = await this.offerService.accept(offerId, absWeekNow);
    if (!result) return null;

    OnboardingService.markOfferAccepted(fighter);

    if (teammate) {
      await this.partnersService.breakBond(fighter, teammate.id, absWeekNow);
    }
    await this.fighterCtrl.updateFighter(fighter);
    return result;
  }

  async declineOffer(offerId, absWeekNow) {
    const fighter = await this.getPlayerFighter();
    const data = await this.db.get('offers', offerId);
    const teammate = data ? await this.partnersService.isTeammate(fighter, data.opponentId) : null;

    const result = await this.offerService.decline(offerId);

    if (teammate) {
      TrainingPartnersService._setBond(fighter, teammate.id, teammate.bond + PARTNER_CONFIG.BOND_ON_LOYALTY);
      fighter.applyMoraleChange(PARTNER_CONFIG.MORALE_ON_LOYALTY);
      await this.fighterCtrl.updateFighter(fighter);
      await this.notifService.add('success', '🤝 Você Recusou', `${teammate.name} soube que você disse não. Alguns vínculos valem mais que uma bolsa.`);
      await this.careerLogService.publish(fighter.id, 'refused_friend', absWeekNow, 65, { partnerName: teammate.name });
    }
    return result;
  }

  // ===== Negociação =====
  async negotiateOffer(offerId, bumpIndex) {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    const academy = await this.getAcademy(fighter.academyId);
    const manager = fighter.managerId ? await this.managerService.getManager(fighter.managerId) : null;
    const mods = this.managerService.negotiationModifiers(manager);
    return await this.offerService.negotiate(offerId, bumpIndex, fighter, academy?.reputation ?? 30, mods);
  }

  // ===== Patrocínios (delegados ao CareerRuntime) =====
  async acceptSponsorOffer(offerId) {
    return this.runtime.acceptSponsorOffer(offerId);
  }

  async declineSponsorOffer(offerId) {
    return await this.sponsorService.decline(offerId);
  }

  // ===== Contrato com conflito de cinturão =====
  async getSigningConflict(fighterId, promoId) {
    const belts = await this.titleService.beltsOf(fighterId);
    const otherBelts = belts.filter(b => b.promotionId !== promoId);
    return otherBelts.length > 0 ? otherBelts : null;
  }

  async signContractWithVacate(fighterId, promoId, absWeekNow) {
    const fighter = await this.fighterCtrl.getFighter(fighterId);
    const vacated = await this.titleService.vacateBeltsOf(fighterId, promoId);
    const result = await this.contractService.accept(fighterId, promoId, absWeekNow);
    const cancelledOffers = await this.offerService.cancelOffersNotFrom(fighterId, promoId);

    for (const v of vacated) {
      await this.notifService.add(
        'warning', 'Cinturão Vagado',
        `${fighter?.name || 'Atleta'} abdicou do cinturão ${v.weightClass} do ${v.promotionShort} para assinar contrato exclusivo.`
      );
    }

    return { fighter: result, vacated, cancelledOffers };
  }

  // ===== Dashboard (delegado ao CareerRuntime) =====
  async getDashboard() {
    return this.runtime.getDashboard();
  }

  async dismissOnboarding() {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return;
    OnboardingService.dismiss(fighter);
    await this.fighterCtrl.updateFighter(fighter);
  }

  // ===== Helpers =====
  async changeWeightClass(fighterId, newWeightClass) {
    const fighter = await this.fighterCtrl.getFighter(fighterId);
    if (!fighter) return { ok: false, reason: 'Lutador não encontrado.' };

    const classes = ['Strawweight', 'Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Light Heavyweight', 'Heavyweight'];
    const currentIdx = classes.indexOf(fighter.weightClass);
    const targetIdx = classes.indexOf(newWeightClass);

    if (currentIdx === -1 || targetIdx === -1) return { ok: false, reason: 'Classe de peso inválida.' };
    if (Math.abs(currentIdx - targetIdx) !== 1) return { ok: false, reason: 'Só pode mudar uma categoria por vez.' };
    if ((fighter.loyalty || 0) < OFFER_CONFIG.WEIGHT_MOVE.MIN_LOYALTY) return { ok: false, reason: 'Sua lealdade com a academia é muito baixa para mudar de peso.' };

    const state = await this.seasonService.getState();
    const absWeekNow = absWeek(state);

    if (fighter.weightMoveLockedUntilAbsWeek && fighter.weightMoveLockedUntilAbsWeek > absWeekNow) {
      return { ok: false, reason: `Você mudou de peso recentemente. Aguarde ${fighter.weightMoveLockedUntilAbsWeek - absWeekNow} semana(s).` };
    }

    if (fighter.promotionContract?.status === 'active' && fighter.promotionContract.titleClause && fighter.weightClass !== newWeightClass) {
      const belts = await this.titleService.beltsOf(fighterId);
      const currentBelt = belts.find(b => b.weightClass === fighter.weightClass);
      if (currentBelt) {
        await this.titleService.vacateBeltsOf(fighterId);
        await this.notifService.add('warning', 'Cinturão Vagado',
          `Você abdicou do cinturão ${fighter.weightClass} para mudar de divisão.`);
      }
    }

    if (!fighter.originalWeightClass) {
      fighter.originalWeightClass = fighter.weightClass;
    }
    fighter.weightClass = newWeightClass;
    fighter.weightMoveLockedUntilAbsWeek = absWeekNow + OFFER_CONFIG.WEIGHT_MOVE.RECOMMIT_WEEKS;

    await this.fighterCtrl.updateFighter(fighter);

    if (this.careerLogService) {
      await this.careerLogService.publish(fighter.id, 'weight_change', absWeekNow, 60, {
        from: fighter.originalWeightClass, to: newWeightClass,
      });
    }

    await this.notifService.add('success', 'Mudança de Peso',
      `Você mudou para ${newWeightClass}. Esta decisão está travada por ${OFFER_CONFIG.WEIGHT_MOVE.RECOMMIT_WEEKS} semanas.`);

    return { ok: true, newWeightClass };
  }
}
