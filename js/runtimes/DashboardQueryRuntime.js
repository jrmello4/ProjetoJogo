import { Academy } from '../models/academy.js';
import { RankingService } from '../services/ranking.js';
import { SocialMedia } from '../controllers/social-media.js';
import { ReadinessService } from '../services/readiness-service.js';
import { OnboardingService } from '../services/onboarding-service.js';
import { WEIGH_IN_CONFIG, absWeek } from '../config/game-config.js';

// Leituras agregadas da carreira. Não avança o tempo nem altera regras do mundo.
export class DashboardQueryRuntime {
  init(dependencies) {
    Object.assign(this, dependencies);
  }

  async getPlayer() {
    return this.fighterCtrl.getPlayerFighter();
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
    return fighter ? this.getAcademy(fighter.academyId) : null;
  }

  async playerAcademyReputation(fighter) {
    const academy = await this.getAcademy(fighter.academyId);
    return academy?.reputation ?? 30;
  }

  async getManagers() {
    return this.managerService.getAll();
  }

  async getPlayerManager() {
    const fighter = await this.getPlayer();
    return fighter?.managerId ? this.managerService.getManager(fighter.managerId) : null;
  }

  async getMilestones() {
    const state = await this.db.get('gameState', 'milestones') || {};
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
    return defs.map(def => ({
      ...def,
      current: Math.min(state[def.id] || 0, def.max),
      unlocked: (state[def.id] || 0) >= def.max,
    }));
  }

  async getCalendar() {
    const fighter = await this.getPlayer();
    if (!fighter) return null;
    const season = await this.seasonService.getState();
    const now = absWeek(season);
    const bookings = await this.offerService.getAccepted();
    const booking = bookings.find(item => item.fighterId === fighter.id);
    const promotions = await this.worldService.getPromotions();
    const entries = [];

    for (let week = Math.max(1, now - 4); week <= now + 26; week++) {
      const weekNum = ((week - 1) % 52) + 1;
      const yearNum = Math.ceil(week / 52);
      let weekType = 'training';
      let details = null;
      let icon = '💪';
      if (booking && week === booking.eventAbsWeek) {
        weekType = booking.isTitleFight ? 'title_fight' : 'fight';
        icon = booking.isTitleFight ? '🏆' : '🥊';
        details = `Luta vs ${booking.opponentName}`;
      } else if (booking && week === booking.eventAbsWeek - WEIGH_IN_CONFIG.WEEKS_BEFORE_FIGHT) {
        weekType = 'weigh_in';
        icon = '⚖️';
        details = booking.weighIn?.completed ? `Pesagem: ${booking.weighIn.strategyLabel}` : `Pesagem vs ${booking.opponentName}`;
      } else if (booking && week >= booking.eventAbsWeek - 4 && week < booking.eventAbsWeek && week > now) {
        weekType = 'camp';
        icon = '🔥';
        details = `Camp — luta em ${booking.eventAbsWeek - week} sem`;
      }
      if (fighter.availableFromAbsWeek && week < fighter.availableFromAbsWeek && week > now) {
        weekType = 'suspended'; icon = '❌'; details = 'Suspensão médica';
      }
      for (const promo of promotions) {
        if (promo.nextEventAbsWeek && week === promo.nextEventAbsWeek && !booking) {
          weekType = 'event'; icon = '📰'; details = `Evento ${promo.short}`;
        }
      }
      entries.push({
        absWeek: week, weekType, label: `Sem ${weekNum}, Ano ${yearNum}`, icon, details,
        isFightWeek: weekType === 'fight' || weekType === 'title_fight',
        isCurrentWeek: week === now, isPastWeek: week < now,
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
    const socialPrompt = socialState.pending ? {
      ...socialState.pending,
      choices: SocialMedia.getContextualChoices(fighter, {
        hasActiveRival: !!socialState.pending.rivalryId,
        rivalName: socialState.pending.rivalName,
        careerLog: null,
      }),
    } : null;

    const active = (await this.fighterCtrl.getAllFighters()).filter(item => item.status !== 'retired');
    const rankings = RankingService.calculateRankings(active);
    const champions = RankingService.getChampions(rankings);
    const belts = fighter ? await this.titleService.beltsOf(fighter.id) : [];
    const contenderStatus = fighter ? await this.titleService.contenderStatusOf(fighter) : null;
    const playerBooking = fighter ? bookings.find(item => item.fighterId === fighter.id) : null;
    const weighInPrompt = playerBooking && !playerBooking.weighIn?.completed
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
    try { const prompt = await this.db.get('gameState', 'rivalry-prompt'); if (prompt?.choices) rivalryPrompt = prompt; } catch { /* ok */ }
    let narrativePrompt = null;
    try { const prompt = await this.db.get('gameState', 'narrative-prompt'); if (prompt?.choices) narrativePrompt = prompt; } catch { /* ok */ }
    let weeklyTrainingPrompt = null;
    try { const prompt = await this.db.get('gameState', 'weeklyTrainingPrompt'); if (prompt?.active) weeklyTrainingPrompt = prompt; } catch { /* ok */ }
    const podcastEpisode = this.podcastService ? await this.podcastService.getLatest() : null;
    const yearReview = this.yearReviewService ? await this.yearReviewService.getLatest() : null;

    let crowdSnapshot = null;
    try {
      const crowd = await this.db.get('gameState', 'crowdReaction');
      if (crowd?.reaction && (!fighter || crowd.absWeek >= now - 3)) {
        crowdSnapshot = { reaction: crowd.reaction, fanMail: crowd.fanMail || [], opponentName: crowd.opponentName };
      }
    } catch { /* ok */ }

    let mediaCompare = null;
    if (fighter && this.rivalryService) {
      const rivalries = await this.rivalryService.getRivalries(fighter.id);
      if (rivalries.length) {
        const top = rivalries.reduce((a, b) => b.intensity > a.intensity ? b : a);
        const rivalId = top.fighterAId === fighter.id ? top.fighterBId : top.fighterAId;
        const rival = await this.fighterCtrl.getFighter(rivalId);
        if (rival) {
          const h2h = (fighter.fights || []).filter(fight => fight.opponentId === rival.id);
          const wins = h2h.filter(fight => fight.won === true).length;
          const losses = h2h.filter(fight => fight.won === false).length;
          mediaCompare = {
            rivalName: rival.name, rivalId: rival.id, intensity: top.intensity, type: top.type,
            yourRecord: `${fighter.record.wins}-${fighter.record.losses}`,
            rivalRecord: `${rival.record.wins}-${rival.record.losses}`,
            yourOvr: fighter.overallRating, rivalOvr: rival.overallRating,
            yourPop: fighter.popularity || 0, rivalPop: rival.popularity || 0,
            h2h: `${wins}-${losses}`,
            headline: top.intensity >= 7 ? `A divisão só fala em ${fighter.name} vs ${rival.name}`
              : top.intensity >= 4 ? `A imprensa compara: ${fighter.name} e ${rival.name}`
                : `${rival.name} ainda está no radar`,
          };
        }
      }
    }

    let readiness = null;
    if (playerBooking && fighter) {
      const hasBaseline = this.managerService.givesBaselineScouting(manager);
      const opponent = await this.fighterCtrl.getFighter(playerBooking.opponentId);
      const level = opponent ? await this.scoutingService.knowledgeOf(opponent, fighter.id, hasBaseline) : 0;
      const player = ReadinessService.playerReadiness(fighter, playerBooking, level);
      const opponentReadiness = ReadinessService.aiReadiness(playerBooking.tier, !!playerBooking.isTitleFight, `${playerBooking.id}-${playerBooking.opponentId}`);
      readiness = {
        player: player.total, parts: player.parts,
        opponentKnown: level >= 1,
        opponent: level >= 1 ? opponentReadiness : null,
        opponentLabel: level >= 1 ? ReadinessService.label(opponentReadiness) : null,
      };
    }

    return {
      fighter, academy, manager, belts,
      contenderStatus: contenderStatus && !contenderStatus.isChampion ? contenderStatus : null,
      pendingOffers, bookings, promotions, pastEvents, milestones, champions, rankings,
      sponsors, socialPrompt, rivalryPrompt, narrativePrompt, weeklyTrainingPrompt,
      podcastEpisode, yearReview, crowdSnapshot, mediaCompare,
      pendingRehab: fighter?.injury?.stage === 'rehab' && !fighter.injury.rehabChosen,
      weighInPrompt, readiness, endCareerPrompt: state.endCareerPrompt || false, state, now,
      narrativeChains: this.narrativeChainService ? await this.narrativeChainService.getAllRecent(1) : [],
      lastFightResult: fighter?.fights?.[0]?.won ?? null,
      onboarding: fighter && OnboardingService.shouldShow(fighter) ? {
        activeStep: OnboardingService.activeStep(fighter),
        progress: OnboardingService.progress(fighter),
        steps: OnboardingService.steps(fighter),
      } : null,
    };
  }
}
