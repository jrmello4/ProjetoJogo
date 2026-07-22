// CareerRuntime â€” orquestrador do pilar CARREIRA
//
// Onda 1: init(), bootstrap, migrate, domain reactions, queries simples.
// Onda 2: processWeek, simulateWeeks, resolveWeighIn, helpers de preparaÃ§Ã£o.
//
// Regra: CareerRuntime ORQUESTRA, nÃ£o implementa lÃ³gica de domÃ­nio.
// Toda regra de negÃ³cio permanece nos serviÃ§os especializados.

import { DB } from '../services/db.js';
import { FighterController } from '../controllers/fighter-controller.js';
import { EventController } from '../controllers/event-controller.js';
import { SeasonService } from '../services/season-service.js';
import { NotificationService } from '../services/notification-service.js';
import { WorldService } from '../services/world-service.js';
import { OfferService } from '../services/offer-service.js';
import { SponsorService } from '../services/sponsor-service.js';
import { TitleService } from '../services/title-service.js';
import { ScoutingService } from '../services/scouting-service.js';
import { ContractService } from '../services/contract-service.js';
import { TrainingPartnersService } from '../services/training-partners-service.js';
import { ManagerService } from '../services/manager-service.js';
import { CareerLogService } from '../services/career-log-service.js';
import { CareerEventBus } from '../services/career-event-bus.js';
import { CAREER_EVENT, CareerEvents } from '../services/career-events.js';
import { RivalryService } from '../services/rivalry-service.js';
import { SocialMediaService } from '../services/social-media-service.js';
import { PodcastService } from '../services/podcast-service.js';
import { YearReviewService } from '../services/year-review-service.js';
import { NarrativeChainService } from '../services/narrative-chain-service.js';
import { FinanceController } from '../controllers/finance-controller.js';
import { NarrativeController } from '../controllers/narrative-controller.js';
import { CareerController } from '../controllers/career-controller.js';
import { absWeek } from '../config/game-config.js';
import { MonetizationService } from '../services/monetization-service.js';
import { PreparationRuntime } from './PreparationRuntime.js';
import { ConsequencePipeline } from './ConsequencePipeline.js';
import { LegacyRuntime } from './LegacyRuntime.js';
import { CareerBootstrapRuntime } from './CareerBootstrapRuntime.js';
import { DashboardQueryRuntime } from './DashboardQueryRuntime.js';
import { WeeklyTickRuntime } from './WeeklyTickRuntime.js';


export class CareerRuntime {
  constructor() {
    this.db = null;
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
    this.partnersService = null;
    this.careerLogService = null;
    this.careerEventBus = null;
    this.careerEvents = null;
    this.rivalryService = null;
    this.socialMediaService = null;
    this.podcastService = null;
    this.yearReviewService = null;
    this.narrativeChainService = null;
    this.financeCtrl = null;
    this.narrativeCtrl = null;
    this.careerCtrl = null;
    this.lastWeekDebug = null;

    // Sub-runtimes (preenchidos apÃ³s init)
    this.preparation = null;
    this.consequences = null;
    this.legacy = null;
    this.bootstrap = null;
    this.queries = null;
    this.weeklyTick = null;
  }

  // ===================================================================
  // LIFECYCLE â€” init
  // ===================================================================

  /** Inicializa todos os serviÃ§os e o mundo. Aceita um DB externo. */
  async init(externalDb = null) {
    this.db = externalDb || new DB();
    await this.db.init();

    this.fighterCtrl = new FighterController(this.db);
    this.eventCtrl = new EventController(this.db);
    this.seasonService = new SeasonService(this.db);
    this.notifService = new NotificationService(this.db);
    this.careerLogService = new CareerLogService(this.db);
    this.careerEventBus = new CareerEventBus();
    this.careerEvents = new CareerEvents();
    this.titleService = new TitleService(this.db, this.fighterCtrl, this.notifService);
    this.scoutingService = new ScoutingService(this.db, this.notifService);
    this.contractService = new ContractService(this.db, this.fighterCtrl, this.notifService);
    this.managerService = new ManagerService(this.db, this.notifService, this.careerLogService);
    this.rivalryService = new RivalryService(this.db, this.careerLogService);
    this.partnersService = new TrainingPartnersService(this.db, this.fighterCtrl, this.notifService, this.careerLogService);
    this.worldService = new WorldService(this.db, this.fighterCtrl, this.notifService, this.titleService, this.scoutingService, this.contractService, this.managerService, this.careerLogService, this.rivalryService, this.careerEvents, this.careerEventBus);
    this.offerService = new OfferService(this.db, this.fighterCtrl, this.notifService, this.titleService, this.contractService, this.rivalryService, this.careerEvents);
    this.sponsorService = new SponsorService(this.db, this.notifService, this.careerLogService);
    this.socialMediaService = new SocialMediaService(this.db, this.notifService);
    this.podcastService = new PodcastService(this.db, this.careerLogService, this.notifService);
    this.yearReviewService = new YearReviewService(this.db, this.careerLogService, this.notifService);
    this.narrativeChainService = new NarrativeChainService(this.db);
    this.monetizationService = new MonetizationService(this.db);
    this._registerDomainReactions();

    this.financeCtrl = new FinanceController();
    this.narrativeCtrl = new NarrativeController(this.db, this.fighterCtrl, this.notifService, this.careerLogService, this.rivalryService, this.partnersService, this.socialMediaService, this.seasonService, this.worldService);
    this.careerCtrl = new CareerController(this.db, this.fighterCtrl, this.notifService, this.careerLogService, this.seasonService, this.titleService);

    this.preparation = new PreparationRuntime();
    this.preparation.init({
      db: this.db, fighterCtrl: this.fighterCtrl, notifService: this.notifService,
      careerLogService: this.careerLogService, scoutingService: this.scoutingService,
      managerService: this.managerService, offerService: this.offerService,
      partnersService: this.partnersService, seasonService: this.seasonService,
      tapeService: null, readinessService: null,
    });

    this.consequences = new ConsequencePipeline();
    this.consequences.init({
      db: this.db, fighterCtrl: this.fighterCtrl, notifService: this.notifService,
      careerLogService: this.careerLogService, careerEventBus: this.careerEventBus,
      rivalryService: this.rivalryService, titleService: this.titleService,
      offerService: this.offerService, narrativeChainService: this.narrativeChainService,
      partnersService: this.partnersService, socialMediaService: this.socialMediaService,
      seasonService: this.seasonService, worldService: this.worldService,
      podcastService: this.podcastService, yearReviewService: this.yearReviewService,
      narrativeCtrl: this.narrativeCtrl, careerCtrl: this.careerCtrl,
    });

    this.legacy = new LegacyRuntime();
    this.legacy.init({
      db: this.db, notifService: this.notifService,
      careerLogService: this.careerLogService, podcastService: this.podcastService,
      yearReviewService: this.yearReviewService, hallOfFame: null, biographyService: null,
    });

    this.queries = new DashboardQueryRuntime();
    this.queries.init({
      db: this.db, fighterCtrl: this.fighterCtrl, eventCtrl: this.eventCtrl,
      seasonService: this.seasonService, worldService: this.worldService,
      offerService: this.offerService, sponsorService: this.sponsorService,
      socialMediaService: this.socialMediaService, managerService: this.managerService,
      titleService: this.titleService, scoutingService: this.scoutingService,
      rivalryService: this.rivalryService, podcastService: this.podcastService,
      yearReviewService: this.yearReviewService, narrativeChainService: this.narrativeChainService,
    });

    this.bootstrap = new CareerBootstrapRuntime();
    this.bootstrap.init({
      db: this.db, fighterCtrl: this.fighterCtrl,
      managerService: this.managerService, titleService: this.titleService,
    });
    await this.bootstrap.initializeWorld();

    this.weeklyTick = new WeeklyTickRuntime();
    this.weeklyTick.init({
      db: this.db, fighterCtrl: this.fighterCtrl, seasonService: this.seasonService,
      worldService: this.worldService, offerService: this.offerService,
      contractService: this.contractService, sponsorService: this.sponsorService,
      notifService: this.notifService, preparation: this.preparation,
      consequences: this.consequences, legacy: this.legacy, careerCtrl: this.careerCtrl,
      narrativeCtrl: this.narrativeCtrl, careerEventBus: this.careerEventBus,
      getAcademy: id => this.getAcademy(id),
      acceptSponsorOffer: id => this.acceptSponsorOffer(id),
    });

    this.notifService.clearOld().catch(() => {});

    return await this.getPlayer();
  }

  /** Handler de eventos de domÃ­nio (careerEvents). */
  _registerDomainReactions() {
    this.careerEvents.on(CAREER_EVENT.FIGHT_OFFERED, async ({ payload }) => {
      const { offer } = payload;
      await this.notifService.add(
        'offer',
        'Nova Oferta de Luta',
        `${offer.promotionName} quer você contra ${offer.opponentName} — bolsa de $${offer.purse.toLocaleString()}.${offer.isShortNotice ? ' SHORT NOTICE!' : ''}`
      );
    });
    this.careerEvents.on(CAREER_EVENT.FIGHT_ACCEPTED, async ({ payload }) => {
      const { offer, weeksOut } = payload;
      await this.notifService.add('success', 'Luta Fechada!', `${offer.opponentName} em ${weeksOut} semana${weeksOut === 1 ? '' : 's'} pelo ${offer.promotionName}. Hora do camp!`);
    });
    this.careerEvents.on(CAREER_EVENT.FIGHT_COMPLETED, async ({ payload }) => {
      const { result, booking, absWeekNow } = payload;
      const won = result.isDraw ? null : result.winnerId === booking.fighterId;
      await this.careerLogService.publish(booking.fighterId, 'fight_completed', absWeekNow, result.isDraw ? 30 : result.isFinish ? 55 : 40, {
        opponentName: booking.opponentName,
        promotionName: booking.promotionName,
        won,
        method: result.method,
        round: result.round,
        isTitleFight: !!booking.isTitleFight,
        resultId: result.id,
      });

      try {
        const fighter = await this.getPlayer();
        if (fighter && this.narrativeChainService) {
          const opponent = booking.opponentId ? await this.fighterCtrl.getFighter(booking.opponentId) : null;
          await this.narrativeChainService.generateAfterFight(fighter, opponent, result, booking, absWeekNow, result.isDraw);
        }
      } catch (e) {
        console.warn('F11 narrative chain failed:', e);
      }
    });
  }


  async getPlayer() {
    return await this.fighterCtrl.getPlayerFighter();
  }

  async getAcademies() { return this.queries.getAcademies(); }
  async getAcademy(id) { return this.queries.getAcademy(id); }
  async getPlayerAcademy() { return this.queries.getPlayerAcademy(); }
  async playerAcademyReputation(fighter) { return this.queries.playerAcademyReputation(fighter); }
  async getManagers() { return this.queries.getManagers(); }
  async getPlayerManager() { return this.queries.getPlayerManager(); }
  async getMilestones() { return this.queries.getMilestones(); }
  async getCalendar() { return this.queries.getCalendar(); }
  async getDashboard() { return this.queries.getDashboard(); }

  async processWeek(cornerHooks = null) {
    const summary = await this.weeklyTick.processWeek(cornerHooks);
    this.lastWeekDebug = this.weeklyTick.lastWeekDebug;
    return summary;
  }

  async simulateWeeks(count, options = {}) {
    const result = await this.weeklyTick.simulateWeeks(count, options);
    this.lastWeekDebug = this.weeklyTick.lastWeekDebug;
    return result;
  }

  // ===================================================================
  // HELPERS â€” preparaÃ§Ã£o (temporÃ¡rios aqui, Onda 3 â†’ PreparationRuntime)
  // ===================================================================

  async acceptSponsorOffer(offerId) {
    const fighter = await this.getPlayer();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    const state = await this.seasonService.getState();
    return await this.sponsorService.accept(offerId, absWeek(state), fighter.record.wins);
  }

  async resolveRehabChoice(choiceKey) {
    const fighter = await this.getPlayer();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    return this.careerCtrl.resolveRehabChoice(choiceKey, fighter.id);
  }

  async resolveEndCareer(fighterId, choiceKey) {
    return this.careerCtrl.resolveEndCareer(fighterId, choiceKey);
  }

  async _findFightOffer(fighterId, opponentId) {
    const all = await this.db.getAll('offers');
    return all.find(o =>
      o.fighterId === fighterId && o.opponentId === opponentId &&
      (o.status === 'completed' || o.status === 'accepted' || o.status === 'cancelled')
    );
  }
}
