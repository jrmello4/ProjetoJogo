// LegacyRuntime — orquestrador do pilar LEGADO
//
// Onda 5: processWeek, processYearEnd, podcast, crowd, biografia, timeline.
// Fonte única de verdade: CareerLog. Podcast, Year Review, Biography
// e Timeline são formatos diferentes de apresentação dos mesmos dados.
//
// Regra: LegacyRuntime ORQUESTRA, não implementa lógica de domínio.

export class LegacyRuntime {
  constructor() {
    this.db = null;
    this.notifService = null;
    this.careerLogService = null;
    this.podcastService = null;
    this.yearReviewService = null;
    this.biographyService = null;
    this.hallOfFame = null;
  }

  init(dependencies) {
    this.db = dependencies.db;
    this.notifService = dependencies.notifService;
    this.careerLogService = dependencies.careerLogService;
    this.podcastService = dependencies.podcastService;
    this.yearReviewService = dependencies.yearReviewService;
    this.biographyService = dependencies.biographyService;
    this.hallOfFame = dependencies.hallOfFame;
  }

  /** Processa eventos de legado durante o tick semanal. */
  async processWeek(now, fighter, { rivalStories = [] } = {}) {
    // Podcast
    if (fighter.status !== 'retired' && this.podcastService) {
      await this.podcastService.processWeek(now, fighter, { rivalStories });
    }

    // Crowd decay
    const { CrowdService } = await import('../services/crowd-service.js');
    if (fighter.status !== 'retired') {
      CrowdService.applyWeeklyDecay(fighter);
    }

    // Year review (every 52 weeks)
    if (now > 0 && now % 52 === 0 && fighter.status !== 'retired' && this.yearReviewService) {
      await this.yearReviewService.processYearEnd(now, fighter);
    }
  }

  /** Retorna a retrospectiva mais recente. */
  async getLatestReview() {
    return this.yearReviewService ? await this.yearReviewService.getLatest() : null;
  }

  /** Retorna o episódio de podcast mais recente. */
  async getLatestPodcast() {
    return this.podcastService ? await this.podcastService.getLatest() : null;
  }

  /** Gera biografia do lutador. */
  async getBiography(fighterId) {
    return this.biographyService ? await this.biographyService.getBiography(fighterId) : null;
  }

  /** Linha do tempo unificada da carreira. */
  async getTimeline(fighterId) {
    return this.careerLogService ? await this.careerLogService.getAll(fighterId) : [];
  }

  /** Lista entries do Hall da Fama. */
  async getHallOfFame() {
    return this.hallOfFame ? await this.hallOfFame.getEntries() : [];
  }
}
