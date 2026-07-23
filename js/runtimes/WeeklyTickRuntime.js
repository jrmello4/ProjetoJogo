import { WEIGH_IN_CONFIG, absWeek } from '../config/game-config.js';
import { TapeService } from '../services/tape-service.js';
import { FinanceController } from '../controllers/finance-controller.js';
import { CAREER_EVENT_TYPES } from '../services/career-event-bus.js';

// Fluxo semanal e fast-forward. Recebe os serviços prontos; não cria mundo nem UI.
export class WeeklyTickRuntime {
  init(dependencies) {
    Object.assign(this, dependencies);
    this.lastWeekDebug = null;
  }

  async _getPlayer() {
    return this.fighterCtrl.getPlayerFighter();
  }

  async processWeek(cornerHooks = null) {
    const tickStartedAt = Date.now();
    const nextWeekState = await this.seasonService.peekNextWeek();
    const now = absWeek(nextWeekState);
    const preFight = await this._getPlayer();
    const preFightId = preFight.id;
    const preDiscoveredTraits = new Set(preFight.discoveredTraits);
    await this.preparation.autoResolveDueWeighIn(now, preFight);

    const world = await this.worldService.processWeek(now, nextWeekState.startedAt, preFightId, cornerHooks);
    const fighter = await this._getPlayer();
    const academy = await this.getAcademy(fighter.academyId);

    await this.consequences.processFightXp(fighter, world, this.notifService);
    await this.consequences.processSuperFightTracking(world, fighter, now);
    await this.consequences.processLastFight(fighter, now);
    await this.offerService.expireOld(now);

    const promotions = await this.worldService.getPromotions();
    const offersCreated = fighter.status !== 'retired'
      ? await this.offerService.generateWeekly(now, fighter, academy?.reputation ?? 30, promotions)
      : [];
    if (fighter.status !== 'retired') {
      await this.contractService.generateOffers(fighter, now, academy?.reputation ?? 30);
    }

    const economy = FinanceController.applyWeeklyEconomy(fighter, academy, now);
    FinanceController.applyWeeklyServices(fighter);
    if (fighter.passiveIncome > 0 && fighter.status === 'retired') {
      fighter.addTransaction(now, '🎙️ Comentarista — Renda Passiva', fighter.passiveIncome);
    }

    const sponsorActivity = await this.sponsorService.processWeek(now, fighter);
    await this.preparation.applyWeeklyTraining(fighter, academy);
    await this.consequences.processWeeklyTrainingPrompt(fighter, now);
    await this.consequences.processTrainingXp(fighter, this.notifService);
    await this.careerCtrl.processInjuryStages(fighter, now);
    TapeService.decayIdle(fighter, now);

    const campResults = await this.preparation.applyWeeklyCamp(now, fighter);
    if (campResults.canceledFight) {
      const booking = (await this.offerService.getAccepted()).find(item => item.fighterId === fighter.id);
      if (booking) {
        await this.offerService.cancelBooking(booking.id);
        await this.notifService.add('warning', 'Luta Cancelada', `Você se lesionou no treino pesado. A luta contra ${booking.opponentName} foi cancelada.`);
      }
    }

    const milestonesUnlocked = await this.consequences.processCareerMilestones(world, fighter);
    await this.consequences.processNarrativeWeek(now, world, fighter);
    const rivalStories = fighter.status !== 'retired' ? await this.narrativeCtrl.processRivalArcs(now, fighter) : [];
    FinanceController.applyWeeklyActivity(fighter, now);
    await this.consequences.processWeeklyPrompts(fighter, now);
    await this.legacy.processWeek(now, fighter, { rivalStories });
    this.consequences.processFightTilEnd(fighter, now);
    this.consequences.processDnaDiscovery(fighter, preDiscoveredTraits, now);
    await this.consequences.processEndCareer(fighter, now);
    await this.fighterCtrl.updateFighter(fighter);
    if (now % 4 === 0) await this.notifService.clearOld();

    if (fighter.cash < 0) {
      await this.notifService.add('warning', '⚠️ Caixa Negativo', 'Suas finanças estão no vermelho. Aceite lutas ou reduza o padrão de vida antes que as contas atrasem.');
    }

    const state = await this.seasonService.commitWeekAdvance(nextWeekState.week, nextWeekState.year);
    this.lastWeekDebug = {
      absWeek: now,
      durationMs: Date.now() - tickStartedAt,
      playerFightCount: world.playerEvents.reduce((sum, event) => sum + event.playerResults.length, 0),
      offersCreated: offersCreated.length,
    };
    await this.careerEventBus.emit(CAREER_EVENT_TYPES.WEEK_PROCESSED, this.lastWeekDebug);
    return { state, now, world, offersCreated, economy, milestonesUnlocked, campResults, sponsorActivity };
  }

  async simulateWeeks(count, options = {}) {
    const { trainingFocus = null } = options;
    if (trainingFocus) {
      const fighter = await this._getPlayer();
      fighter.trainingFocus = trainingFocus;
      await this.fighterCtrl.updateFighter(fighter);
    }

    const startFighter = await this._getPlayer();
    const startCash = startFighter.cash;
    const startPopularity = startFighter.popularity;
    const startWins = startFighter.record.wins;
    const startLosses = startFighter.record.losses;
    this.notifService.muted = true;
    const fightResults = [];
    const milestonesUnlocked = [];
    let weeksSimulated = 0;
    let offersAccepted = 0;

    try {
      for (let index = 0; index < count; index++) {
        const summary = await this.processWeek();
        weeksSimulated++;
        const pendingOffers = await this.offerService.getPending();
        if (pendingOffers.length > 0) {
          const current = await this._getPlayer();
          const accepted = await this.offerService.getAccepted();
          const hasBooking = accepted.some(booking => booking.fighterId === current.id);
          if (current.status !== 'injured' && !hasBooking) {
            await this.offerService.accept(pendingOffers[0].id, summary.now);
            offersAccepted++;
          }
        }

        const sponsorState = await this.sponsorService.getState();
        for (const offer of sponsorState.offers) await this.acceptSponsorOffer(offer.id);
        const current = await this._getPlayer();
        if (current) {
          await this.narrativeCtrl.resolveSocialPrompt('stay_quiet', current.id);
          await this.narrativeCtrl.resolveRivalryInteraction('ignore', current.id).catch(() => {});
        }
        await this.preparation.resolveWeighIn(WEIGH_IN_CONFIG.AUTO_STRATEGY, summary.now, { auto: true }).catch(() => {});

        const simFighter = await this._getPlayer();
        try {
          const doc = await this.db.get('gameState', `contract-offer-${simFighter.id}`);
          if (doc?.offers?.length) {
            doc.offers.sort((a, b) => a.tier - b.tier || b.basePurse - a.basePurse);
            await this.contractService.accept(simFighter.id, doc.offers[0].promotionId, summary.now);
          }
        } catch { /* sem propostas */ }

        for (const event of summary.world.playerEvents) {
          for (const result of event.playerResults) {
            const playerIsA = event.playerFighterIds.has(result.fighterAId);
            fightResults.push({
              fighterName: playerIsA ? result.fighterAName : result.fighterBName,
              opponentName: playerIsA ? result.fighterBName : result.fighterAName,
              won: result.isDraw ? null : result.winnerId === (playerIsA ? result.fighterAId : result.fighterBId),
              method: result.method, promoName: event.event.promotionName, absWeek: summary.now,
            });
          }
        }
        milestonesUnlocked.push(...summary.milestonesUnlocked);
      }
    } finally {
      this.notifService.muted = false;
    }

    const endFighter = await this._getPlayer();
    return {
      weeksSimulated, offersAccepted,
      cashDelta: endFighter.cash - startCash,
      popularityDelta: endFighter.popularity - startPopularity,
      winsDelta: endFighter.record.wins - startWins,
      lossesDelta: endFighter.record.losses - startLosses,
      fightResults, milestonesUnlocked, endFighter,
    };
  }
}
