// CareerRuntime — orquestrador do pilar CARREIRA
//
// Onda 1: init(), bootstrap, migrate, domain reactions, queries simples.
// Onda 2: processWeek, simulateWeeks, resolveWeighIn, helpers de preparação.
//
// Regra: CareerRuntime ORQUESTRA, não implementa lógica de domínio.
// Toda regra de negócio permanece nos serviços especializados.

import { DB } from '../services/db.js';
import { DataGenerator } from '../services/data-generator.js';
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
import { CareerEventBus, CAREER_EVENT_TYPES } from '../services/career-event-bus.js';
import { CAREER_EVENT, CareerEvents } from '../services/career-events.js';
import { RivalryService } from '../services/rivalry-service.js';
import { StyleService } from '../services/style-service.js';
import { SocialMediaService } from '../services/social-media-service.js';
import { PodcastService } from '../services/podcast-service.js';
import { YearReviewService } from '../services/year-review-service.js';
import { CrowdService } from '../services/crowd-service.js';
import { VisualIdentityService } from '../services/visual-identity-service.js';
import { NarrativeChainService } from '../services/narrative-chain-service.js';
import { RankingService } from '../services/ranking.js';
import { SocialMedia } from '../controllers/social-media.js';
import { FightOffer } from '../models/fight-offer.js';
import { Academy } from '../models/academy.js';
import { Promotion } from '../models/promotion.js';
import { Fighter, DNA_TRAIT_NAMES } from '../models/fighter.js';
import { generateId, clamp, pickTopRandom, sanitizePlayerName } from '../utils/helpers.js';
import { TrainingCamp } from '../controllers/training-camp.js';
import { WeeklyTrainingController } from '../controllers/weekly-training.js';
import { FinanceController } from '../controllers/finance-controller.js';
import { NarrativeController } from '../controllers/narrative-controller.js';
import { CareerController } from '../controllers/career-controller.js';
import {
  ACADEMIES,
  ARCHETYPES,
  ORIGINS,
  DIFFICULTIES,
  LIFESTYLE_TIERS,
  LIFESTYLE_DOWNGRADE_MORALE_PENALTY,
  PROMOTIONS,
  CORE_WEIGHT_CLASSES,
  WORLD_CONFIG,
  TRAINING_FOCUS_META,
  GAME_PLANS,
  CAMP_CONFIG,
  WEIGH_IN_CONFIG,
  RIVALRY_CONFIG,
  SYNERGY_CONFIG,
  PARTNER_CONFIG,
  DNA_DISCOVERY_MAGNITUDE,
  READINESS_CONFIG,
  WEEKLY_TRAINING_CHOICES,
  WEEKLY_TRAINING_FREQUENCY,
  CHALLENGE_MODES,
  absWeek,
} from '../config/game-config.js';
import { TapeService } from '../services/tape-service.js';
import { ReadinessService } from '../services/readiness-service.js';
import { OnboardingService } from '../services/onboarding-service.js';
import { LEVEL_CONFIG, MOVES, WEEKLY_ACTIVITIES, INJURY_CONFIG, OFFER_CONFIG } from '../config/game-config.js';
import { MonetizationService } from '../services/monetization-service.js';
import { PreparationRuntime } from './PreparationRuntime.js';
import { ConsequencePipeline } from './ConsequencePipeline.js';
import { LegacyRuntime } from './LegacyRuntime.js';

const WORLD_MODE = 'career-1-fighter';
const WORLD_SCHEMA = 5;

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

    // Sub-runtimes (preenchidos após init)
    this.preparation = null;
    this.consequences = null;
    this.legacy = null;
  }

  // ===================================================================
  // LIFECYCLE — init
  // ===================================================================

  /** Inicializa todos os serviços e o mundo. Aceita um DB externo. */
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

    let meta = await this.db.get('gameState', 'meta');
    if (!meta) {
      await this.bootstrapWorld();
    } else {
      meta = await this.migrateWorld(meta);
      await this.applyPatches(meta);
    }

    this.notifService.clearOld().catch(() => {});

    return await this.getPlayer();
  }

  /** Handler de eventos de domínio (careerEvents). */
  _registerDomainReactions() {
    this.careerEvents.on(CAREER_EVENT.FIGHT_OFFERED, async ({ payload }) => {
      const { offer } = payload;
      await this.notifService.add(
        'offer',
        '📩 Nova Oferta de Luta',
        `${offer.promotionName} quer você contra ${offer.opponentName} — bolsa de $${offer.purse.toLocaleString()}.${offer.isShortNotice ? ' ⚡ SHORT NOTICE!' : ''}`
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

  // ===================================================================
  // WORLD BOOTSTRAP
  // ===================================================================

  /** Bootstrap do mundo. */
  async bootstrapWorld() {
    for (const store of ['fighters', 'organization', 'events', 'fights', 'rivalries', 'hallOfFame', 'notifications', 'offers']) {
      await this.db.clear(store);
    }
    for (const docId of ['careerLog', 'sponsors', 'retention', 'socialMedia', 'rivalry-prompt']) {
      await this.db.delete('gameState', docId);
    }
    try { localStorage.removeItem('characterCreationDone'); } catch { /* ok */ }

    await this.db.put('gameState', {
      id: 'state', week: 1, year: 1, totalEvents: 0,
      startedAt: new Date().toISOString(),
    });
    await this.db.put('gameState', { id: 'milestones' });
    await this.db.put('gameState', { id: 'career', playerFighterId: null });

    const stagger = { 3: [2, 3], 2: [3, 4], 1: [5] };
    const used = { 1: 0, 2: 0, 3: 0 };
    for (const cfg of PROMOTIONS) {
      const offsets = stagger[cfg.tier];
      const promo = new Promotion({
        ...cfg,
        nextEventAbsWeek: offsets[used[cfg.tier] % offsets.length],
      });
      used[cfg.tier]++;
      await this.db.put('organization', promo);

      const roster = DataGenerator.generatePromotionRoster(promo, CORE_WEIGHT_CLASSES);
      for (const f of roster) {
        f.id = generateId();
        await this.db.put('fighters', f);
      }
    }

    for (const cfg of ACADEMIES) {
      const academy = new Academy({ ...cfg });
      await this.db.put('organization', academy);
    }

    await this.managerService.bootstrap();

    for (let i = 0; i < WORLD_CONFIG.FREE_AGENT_POOL; i++) {
      const weightClass = CORE_WEIGHT_CLASSES[i % CORE_WEIGHT_CLASSES.length];
      const agent = DataGenerator.generateFighter(null, { weightClass, skillRange: [30, 55] });
      agent.id = generateId();
      if (Math.random() < WORLD_CONFIG.ACADEMY_AFFILIATION_CHANCE) {
        agent.academyId = ACADEMIES[Math.floor(Math.random() * ACADEMIES.length)].id;
      }
      await this.db.put('fighters', agent);
    }

    await this.titleService.seedBelts();

    await this.db.put('gameState', {
      id: 'meta', mode: WORLD_MODE, schemaVersion: WORLD_SCHEMA,
      patches: [], createdAt: new Date().toISOString(),
    });
  }

  // ===================================================================
  // MIGRATION + PATCHES
  // ===================================================================

  async migrateWorld(meta) {
    const sourceVersion = Number.isInteger(meta.schemaVersion) ? meta.schemaVersion : 0;
    if (sourceVersion > WORLD_SCHEMA) {
      throw new Error(`Este save usa schema ${sourceVersion}, mais novo que o suportado (${WORLD_SCHEMA}). Atualize o jogo antes de abrir esta carreira.`);
    }

    let migrated = {
      ...meta,
      id: 'meta',
      mode: meta.mode || WORLD_MODE,
      schemaVersion: sourceVersion,
      patches: Array.isArray(meta.patches) ? meta.patches : [],
      migrationHistory: Array.isArray(meta.migrationHistory) ? meta.migrationHistory : [],
    };

    while (migrated.schemaVersion < WORLD_SCHEMA) {
      const from = migrated.schemaVersion;
      await this._applySchemaMigration(from);
      migrated = {
        ...migrated,
        schemaVersion: from + 1,
        migrationHistory: [...migrated.migrationHistory, {
          from, to: from + 1, appliedAt: new Date().toISOString(),
        }],
      };
      await this.db.put('gameState', migrated);
    }

    await this.db.put('gameState', migrated);
    return migrated;
  }

  async _applySchemaMigration(fromVersion) {
    if (fromVersion <= 4) {
      const state = await this.db.get('gameState', 'state');
      if (!state) {
        await this.db.put('gameState', {
          id: 'state', week: 1, year: 1, totalEvents: 0,
          startedAt: new Date().toISOString(),
        });
      }
      const milestones = await this.db.get('gameState', 'milestones');
      if (!milestones) await this.db.put('gameState', { id: 'milestones' });
      const career = await this.db.get('gameState', 'career');
      if (!career) await this.db.put('gameState', { id: 'career', playerFighterId: null });
    }
  }

  async applyPatches(meta) {
    const applied = new Set(meta.patches || []);
    if (applied.size !== (meta.patches || []).length) {
      await this.db.put('gameState', { ...meta, id: 'meta', patches: [...applied] });
    }

    const fighter = await this.getPlayer();
    if (fighter?.campProcessedThisWeek) {
      fighter.campProcessedThisWeek = false;
      await this.fighterCtrl.updateFighter(fighter);
    }
  }

  // ===================================================================
  // QUERIES
  // ===================================================================

  async getPlayer() {
    return await this.fighterCtrl.getPlayerFighter();
  }

  async getAcademies() {
    const all = await this.db.getAll('organization');
    return all.filter(o => o.id.startsWith('academy-')).map(o => new Academy(o));
  }

  async getAcademy(id) {
    if (!id) return null;
    const data = await this.db.get('organization', id);
    return data ? new Academy(data) : null;
  }

  async getPlayerAcademy() {
    const fighter = await this.getPlayer();
    return fighter ? await this.getAcademy(fighter.academyId) : null;
  }

  async playerAcademyReputation(fighter) {
    const academy = await this.getAcademy(fighter.academyId);
    return academy?.reputation ?? 30;
  }

  async getManagers() {
    return await this.managerService.getAll();
  }

  async getPlayerManager() {
    const fighter = await this.getPlayer();
    return fighter?.managerId ? await this.managerService.getManager(fighter.managerId) : null;
  }

  async getMilestones() {
    const raw = await this.db.get('gameState', 'milestones');
    const state = raw || {};
    const defs = [
      { id: 'firstFight', label: 'Estreia Profissional', desc: 'Sua primeira luta', max: 1 },
      { id: 'firstWin', label: 'Primeira Vitória', desc: 'Vencer a primeira luta', max: 1 },
      { id: 'fiveWins', label: '5 Vitórias', desc: 'Acumular 5 vitórias', max: 5 },
      { id: 'tenWins', label: '10 Vitórias', desc: 'Acumular 10 vitórias', max: 10 },
      { id: 'firstFinish', label: 'Primeira Finalização', desc: 'Vencer por KO, TKO ou finalização', max: 1 },
      { id: 'firstTier2', label: 'Palco Nacional', desc: 'Lutar em uma promoção nacional', max: 1 },
      { id: 'firstTier1', label: 'Elite Mundial', desc: 'Lutar na Apex Fighting Championship', max: 1 },
      { id: 'popularity50', label: 'Nome Conhecido', desc: 'Alcançar popularidade 50', max: 50 },
      { id: 'popularity80', label: 'Superstar', desc: 'Alcançar popularidade 80', max: 80 },
      { id: 'firstTitleShot', label: 'Disputa de Cinturão', desc: 'Sua primeira disputa de título', max: 1 },
      { id: 'firstBelt', label: 'Campeão', desc: 'Conquistar o primeiro cinturão', max: 1 },
      { id: 'firstDefense', label: 'Defesa de Cinturão', desc: 'Defender um cinturão com sucesso', max: 1 },
      { id: 'worldChampion', label: 'Campeão Mundial', desc: 'Conquistar o cinturão da elite mundial', max: 1 },
    ];

    return defs.map(d => ({
      ...d,
      current: Math.min(state[d.id] || 0, d.max),
      unlocked: (state[d.id] || 0) >= d.max,
    }));
  }

  async getCalendar() {
    const fighter = await this.getPlayer();
    if (!fighter) return null;

    const season = await this.seasonService.getState();
    const now = absWeek(season);

    const bookings = await this.offerService.getAccepted();
    const booking = bookings.find(b => b.fighterId === fighter.id);
    const promotions = await this.worldService.getPromotions();

    const entries = [];
    const lookahead = 26;
    const lookback = 4;

    for (let w = Math.max(1, now - lookback); w <= now + lookahead; w++) {
      const weekNum = ((w - 1) % 52) + 1;
      const yearNum = Math.ceil(w / 52);
      const label = `Sem ${weekNum}, Ano ${yearNum}`;

      let weekType = 'training';
      let details = null;
      let icon = '💪';

      if (booking && w === booking.eventAbsWeek) {
        weekType = 'fight';
        icon = '🥊';
        details = `Luta vs ${booking.opponentName}`;
        if (booking.isTitleFight) { weekType = 'title_fight'; icon = '🏆'; }
      } else if (booking && w === booking.eventAbsWeek - WEIGH_IN_CONFIG.WEEKS_BEFORE_FIGHT) {
        weekType = 'weigh_in';
        icon = '⚖️';
        details = booking.weighIn?.completed
          ? `Pesagem: ${booking.weighIn.strategyLabel}`
          : `Pesagem vs ${booking.opponentName}`;
      } else if (booking && w >= booking.eventAbsWeek - 4 && w < booking.eventAbsWeek && w > now) {
        weekType = 'camp';
        icon = '🔥';
        details = `Camp — luta em ${booking.eventAbsWeek - w} sem`;
      }

      if (fighter.availableFromAbsWeek && w < fighter.availableFromAbsWeek && w > now) {
        weekType = 'suspended';
        icon = '❌';
        details = 'Suspensão médica';
      }

      for (const promo of promotions) {
        if (promo.nextEventAbsWeek && w === promo.nextEventAbsWeek && !booking) {
          weekType = 'event';
          icon = '📰';
          details = `Evento ${promo.short}`;
        }
      }

      entries.push({
        absWeek: w, weekType, label, icon, details,
        isFightWeek: weekType === 'fight' || weekType === 'title_fight',
        isCurrentWeek: w === now, isPastWeek: w < now,
      });
    }

    return {
      currentWeek: now, entries,
      upcomingFight: booking ? {
        opponentName: booking.opponentName, promotionName: booking.promotionName,
        absWeek: booking.eventAbsWeek, isTitleFight: !!booking.isTitleFight,
      } : null,
      medicalStatus: fighter.availableFromAbsWeek > now ? {
        availableFromAbsWeek: fighter.availableFromAbsWeek,
        weeksRemaining: fighter.availableFromAbsWeek - now,
        diagnosis: fighter.injury?.description || 'Suspensão médica preventiva após a luta',
        stage: fighter.injury?.stage || 'suspension',
      } : null,
    };
  }

  // ===================================================================
  // DASHBOARD — query agregadora (Onda 6)
  // ===================================================================

  async getDashboard() {
    const fighter = await this.getPlayer();
    const academy = await this.getAcademy(fighter?.academyId);
    const manager = fighter?.managerId ? await this.managerService.getManager(fighter.managerId) : null;
    const pendingOffers = await this.offerService.getPending();
    const bookings = await this.offerService.getAccepted();
    const promotions = await this.worldService.getPromotions();
    const pastEvents = (await this.eventCtrl.getAllEvents()).slice(0, 6);
    const milestones = await this.getMilestones();
    const state = await this.seasonService.getState();
    const now = absWeek(state);
    const sponsors = await this.sponsorService.getState();
    const socialState = await this.socialMediaService.getState();
    const socialPrompt = socialState.pending
      ? {
          ...socialState.pending,
          choices: SocialMedia.getContextualChoices(fighter, {
            hasActiveRival: !!socialState.pending.rivalryId,
            rivalName: socialState.pending.rivalName,
            careerLog: null,
          }),
        }
      : null;

    const allFighters = await this.fighterCtrl.getAllFighters();
    const active = allFighters.filter(f => f.status !== 'retired');
    const rankings = RankingService.calculateRankings(active);
    const champions = RankingService.getChampions(rankings);

    const belts = fighter ? await this.titleService.beltsOf(fighter.id) : [];
    const contenderStatus = fighter ? await this.titleService.contenderStatusOf(fighter) : null;
    const playerBooking = fighter ? bookings.find(b => b.fighterId === fighter.id) : null;
    const weighInPrompt = playerBooking
      && !playerBooking.weighIn?.completed
      && now >= playerBooking.eventAbsWeek - WEIGH_IN_CONFIG.WEEKS_BEFORE_FIGHT
      && now <= playerBooking.eventAbsWeek
      ? {
          offerId: playerBooking.id,
          opponentName: playerBooking.opponentName,
          strategies: Object.entries(WEIGH_IN_CONFIG.STRATEGIES).map(([key, strategy]) => ({
            key, label: strategy.label, description: strategy.description,
          })),
        }
      : null;

    let rivalryPrompt = null;
    try { const rp = await this.db.get('gameState', 'rivalry-prompt'); if (rp?.choices) rivalryPrompt = rp; } catch { /* ok */ }

    let narrativePrompt = null;
    try { const np = await this.db.get('gameState', 'narrative-prompt'); if (np?.choices) narrativePrompt = np; } catch { /* ok */ }

    let weeklyTrainingPrompt = null;
    try { const wtp = await this.db.get('gameState', 'weeklyTrainingPrompt'); if (wtp?.active) weeklyTrainingPrompt = wtp; } catch { /* ok */ }

    const podcastEpisode = this.podcastService ? await this.podcastService.getLatest() : null;
    const yearReview = this.yearReviewService ? await this.yearReviewService.getLatest() : null;

    let crowdSnapshot = null;
    try {
      const cr = await this.db.get('gameState', 'crowdReaction');
      if (cr?.reaction && (!fighter || cr.absWeek >= (now - 3))) {
        crowdSnapshot = { reaction: cr.reaction, fanMail: cr.fanMail || [], opponentName: cr.opponentName };
      }
    } catch { /* ok */ }

    let mediaCompare = null;
    if (fighter && this.rivalryService) {
      const rivs = await this.rivalryService.getRivalries(fighter.id);
      if (rivs.length > 0) {
        const top = rivs.reduce((a, b) => (b.intensity > a.intensity ? b : a));
        const rid = top.fighterAId === fighter.id ? top.fighterBId : top.fighterAId;
        const rival = await this.fighterCtrl.getFighter(rid);
        if (rival) {
          const h2h = (fighter.fights || []).filter(f => f.opponentId === rival.id);
          const wins = h2h.filter(f => f.won === true).length;
          const losses = h2h.filter(f => f.won === false).length;
          mediaCompare = {
            rivalName: rival.name, rivalId: rival.id, intensity: top.intensity, type: top.type,
            yourRecord: `${fighter.record.wins}-${fighter.record.losses}`,
            rivalRecord: `${rival.record.wins}-${rival.record.losses}`,
            yourOvr: fighter.overallRating, rivalOvr: rival.overallRating,
            yourPop: fighter.popularity || 0, rivalPop: rival.popularity || 0,
            h2h: `${wins}-${losses}`,
            headline: top.intensity >= 7
              ? `A divisão só fala em ${fighter.name} vs ${rival.name}`
              : top.intensity >= 4
                ? `A imprensa compara: ${fighter.name} e ${rival.name}`
                : `${rival.name} ainda está no radar`,
          };
        }
      }
    }

    const pendingRehab = fighter?.injury?.stage === 'rehab' && !fighter.injury.rehabChosen;

    let readiness = null;
    if (playerBooking && fighter) {
      const hasBaseline = this.managerService.givesBaselineScouting(manager);
      const opponent = await this.fighterCtrl.getFighter(playerBooking.opponentId);
      const level = opponent ? await this.scoutingService.knowledgeOf(opponent, fighter.id, hasBaseline) : 0;
      const p = ReadinessService.playerReadiness(fighter, playerBooking, level);
      const ai = ReadinessService.aiReadiness(playerBooking.tier, !!playerBooking.isTitleFight, `${playerBooking.id}-${playerBooking.opponentId}`);
      readiness = {
        player: p.total, parts: p.parts,
        opponentKnown: level >= 1,
        opponent: level >= 1 ? ai : null,
        opponentLabel: level >= 1 ? ReadinessService.label(ai) : null,
      };
    }

    return {
      fighter, academy, manager, belts,
      contenderStatus: contenderStatus && !contenderStatus.isChampion ? contenderStatus : null,
      pendingOffers, bookings, promotions, pastEvents, milestones, champions, rankings,
      sponsors, socialPrompt, rivalryPrompt, narrativePrompt, weeklyTrainingPrompt,
      podcastEpisode, yearReview, crowdSnapshot, mediaCompare, pendingRehab,
      weighInPrompt, readiness,
      endCareerPrompt: state.endCareerPrompt || false, state, now,
      narrativeChains: this.narrativeChainService
        ? await this.narrativeChainService.getAllRecent(1) : [],
      lastFightResult: fighter?.fights?.[0]?.won ?? null,
      onboarding: fighter && OnboardingService.shouldShow(fighter)
        ? {
            activeStep: OnboardingService.activeStep(fighter),
            progress: OnboardingService.progress(fighter),
            steps: OnboardingService.steps(fighter),
          }
        : null,
    };
  }

  // ===================================================================
  // PROCESS WEEK — tick semanal (movido do game-controller)
  // ===================================================================

  async processWeek(cornerHooks = null) {
    const tickStartedAt = Date.now();
    const nextWeekState = await this.seasonService.peekNextWeek();
    const now = absWeek(nextWeekState);
    const preFight = await this.getPlayer();
    const preFightId = preFight.id;
    const preDiscoveredTraits = new Set(preFight.discoveredTraits);

    await this.preparation.autoResolveDueWeighIn(now, preFight);

    const world = await this.worldService.processWeek(now, nextWeekState.startedAt, preFightId, cornerHooks);

    const fighter = await this.getPlayer();
    const academy = await this.getAcademy(fighter.academyId);

    // XP por luta + super fight tracking (delegado ao ConsequencePipeline)
    await this.consequences.processFightXp(fighter, world, this.notifService);
    await this.consequences.processSuperFightTracking(world, fighter, now);

    // Last fight pending (delegado ao ConsequencePipeline)
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

    // Weekly training prompt + training XP (delegado ao ConsequencePipeline)
    await this.consequences.processWeeklyTrainingPrompt(fighter, now);
    await this.consequences.processTrainingXp(fighter, this.notifService);

    // Injury stages + tape
    await this.careerCtrl.processInjuryStages(fighter, now);
    TapeService.decayIdle(fighter, now);

    const campResults = await this.preparation.applyWeeklyCamp(now, fighter);
    if (campResults.canceledFight) {
      const bookings = await this.offerService.getAccepted();
      const booking = bookings.find(b => b.fighterId === fighter.id);
      if (booking) {
        await this.offerService.cancelBooking(booking.id);
        await this.notifService.add('warning', 'Luta Cancelada', `Você se lesionou no treino pesado. A luta contra ${booking.opponentName} foi cancelada.`);
      }
    }

    const milestonesUnlocked = await this.consequences.processCareerMilestones(world, fighter);

    await this.consequences.processNarrativeWeek(now, world, fighter);

    const rivalStories = fighter.status !== 'retired'
      ? await this.narrativeCtrl.processRivalArcs(now, fighter)
      : [];

    FinanceController.applyWeeklyActivity(fighter, now);

    await this.consequences.processWeeklyPrompts(fighter, now);

    // Legacy (podcast, crowd, year review)
    await this.legacy.processWeek(now, fighter, { rivalStories });

    // "Até o Fim" mechanics
    this.consequences.processFightTilEnd(fighter, now);

    // DNA discovery
    this.consequences.processDnaDiscovery(fighter, preDiscoveredTraits, now);

    // End-of-career prompts
    await this.consequences.processEndCareer(fighter, now);

    await this.fighterCtrl.updateFighter(fighter);

    if (fighter.cash < 0) {
      await this.notifService.add('warning', '⚠️ Caixa Negativo', 'Suas finanças estão no vermelho. Aceite lutas ou reduza o padrão de vida antes que as contas atrasem.');
    }

    const finalState = await this.seasonService.commitWeekAdvance(nextWeekState.week, nextWeekState.year);
    const durationMs = Date.now() - tickStartedAt;
    this.lastWeekDebug = {
      absWeek: now, durationMs,
      playerFightCount: world.playerEvents.reduce((sum, event) => sum + event.playerResults.length, 0),
      offersCreated: offersCreated.length,
    };
    await this.careerEventBus.emit(CAREER_EVENT_TYPES.WEEK_PROCESSED, this.lastWeekDebug);

    return { state: finalState, now, world, offersCreated, economy, milestonesUnlocked, campResults, sponsorActivity };
  }

  // ===================================================================
  // SIMULATE WEEKS — fast-forward (movido do game-controller)
  // ===================================================================

  async simulateWeeks(count, options = {}) {
    const { trainingFocus = null } = options;

    if (trainingFocus) {
      const fighter = await this.getPlayer();
      fighter.trainingFocus = trainingFocus;
      await this.fighterCtrl.updateFighter(fighter);
    }

    const startFighter = await this.getPlayer();
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
      for (let i = 0; i < count; i++) {
        const summary = await this.processWeek();
        weeksSimulated++;

        const pendingOffers = await this.offerService.getPending();
        if (pendingOffers.length > 0) {
          const current = await this.getPlayer();
          const accepted = await this.offerService.getAccepted();
          const hasBooking = accepted.some(b => b.fighterId === current.id);
          if (current.status !== 'injured' && !hasBooking) {
            await this.offerService.accept(pendingOffers[0].id, summary.now);
            offersAccepted++;
          }
        }

        const sponsorState = await this.sponsorService.getState();
        for (const sOffer of sponsorState.offers) {
          await this.acceptSponsorOffer(sOffer.id);
        }

        // Social, rivalry, weigh-in usando narrativeCtrl diretamente
        const current = await this.getPlayer();
        if (current) {
          await this.narrativeCtrl.resolveSocialPrompt('stay_quiet', current.id);
          await this.narrativeCtrl.resolveRivalryInteraction('ignore', current.id).catch(() => {});
        }
        await this.preparation.resolveWeighIn(WEIGH_IN_CONFIG.AUTO_STRATEGY, summary.now, { auto: true }).catch(() => {});

        const simFighter = await this.getPlayer();
        try {
          const doc = await this.db.get('gameState', `contract-offer-${simFighter.id}`);
          if (doc && doc.offers && doc.offers.length > 0) {
            doc.offers.sort((a, b) => a.tier - b.tier || b.basePurse - a.basePurse);
            await this.contractService.accept(simFighter.id, doc.offers[0].promotionId, summary.now);
          }
        } catch { /* sem propostas */ }

        for (const evt of summary.world.playerEvents) {
          for (const r of evt.playerResults) {
            const playerIsA = evt.playerFighterIds.has(r.fighterAId);
            const won = r.isDraw ? null : r.winnerId === (playerIsA ? r.fighterAId : r.fighterBId);
            fightResults.push({
              fighterName: playerIsA ? r.fighterAName : r.fighterBName,
              opponentName: playerIsA ? r.fighterBName : r.fighterAName,
              won, method: r.method, promoName: evt.event.promotionName,
              absWeek: summary.now,
            });
          }
        }
        milestonesUnlocked.push(...summary.milestonesUnlocked);
      }
    } finally {
      this.notifService.muted = false;
    }

    const endFighter = await this.getPlayer();

    return {
      weeksSimulated, offersAccepted,
      cashDelta: endFighter.cash - startCash,
      popularityDelta: endFighter.popularity - startPopularity,
      winsDelta: endFighter.record.wins - startWins,
      lossesDelta: endFighter.record.losses - startLosses,
      fightResults, milestonesUnlocked, endFighter,
    };
  }

  // ===================================================================
  // HELPERS — preparação (temporários aqui, Onda 3 → PreparationRuntime)
  // ===================================================================

  async acceptSponsorOffer(offerId) {
    const fighter = await this.getPlayer();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    const state = await this.seasonService.getState();
    return await this.sponsorService.accept(offerId, absWeek(state), fighter.record.wins);
  }

  async _findFightOffer(fighterId, opponentId) {
    const all = await this.db.getAll('offers');
    return all.find(o =>
      o.fighterId === fighterId && o.opponentId === opponentId &&
      (o.status === 'completed' || o.status === 'accepted' || o.status === 'cancelled')
    );
  }
}
