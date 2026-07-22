// ConsequencePipeline — pipeline de processamento de CONSEQUÊNCIAS
//
// Onda 4: handlers extraídos de CareerRuntime.processWeek.
// Processa reações em cadeia após eventos de carreira (lutas, semanas).
// Não é um pilar navegável — é um pipeline de processamento.

import { DNA_DISCOVERY_MAGNITUDE, RIVALRY_CONFIG, WEEKLY_TRAINING_FREQUENCY, LEVEL_CONFIG, OFFER_CONFIG } from '../config/game-config.js';
import { DNA_TRAIT_NAMES } from '../models/fighter.js';
import { pickTopRandom } from '../utils/helpers.js';

export class ConsequencePipeline {
  constructor() {
    this.db = null;
    this.fighterCtrl = null;
    this.notifService = null;
    this.careerLogService = null;
    this.careerEventBus = null;
    this.rivalryService = null;
    this.titleService = null;
    this.offerService = null;
    this.narrativeChainService = null;
    this.partnersService = null;
    this.socialMediaService = null;
    this.seasonService = null;
    this.worldService = null;
    this.podcastService = null;
    this.yearReviewService = null;
    this.narrativeCtrl = null;
    this.careerCtrl = null;
    this.careerRuntime = null;
    this.legacyRuntime = null;
  }

  init(dependencies) {
    this.db = dependencies.db;
    this.fighterCtrl = dependencies.fighterCtrl;
    this.notifService = dependencies.notifService;
    this.careerLogService = dependencies.careerLogService;
    this.careerEventBus = dependencies.careerEventBus;
    this.rivalryService = dependencies.rivalryService;
    this.titleService = dependencies.titleService;
    this.offerService = dependencies.offerService;
    this.narrativeChainService = dependencies.narrativeChainService;
    this.partnersService = dependencies.partnersService;
    this.socialMediaService = dependencies.socialMediaService;
    this.seasonService = dependencies.seasonService;
    this.worldService = dependencies.worldService;
    this.podcastService = dependencies.podcastService;
    this.yearReviewService = dependencies.yearReviewService;
    this.narrativeCtrl = dependencies.narrativeCtrl;
    this.careerCtrl = dependencies.careerCtrl;
  }

  async processFightXp(fighter, world, notifService) {
    for (const evt of world.playerEvents) {
      for (const result of evt.playerResults) {
        if (result && result.winnerId) {
          const xpGain = LEVEL_CONFIG.XP_PER_FIGHT + (result.winnerId === fighter.id ? LEVEL_CONFIG.XP_PER_WIN_BONUS : 0);
          const perkPtsBefore = fighter.perkPoints;
          const levelsUp = fighter.addXP(xpGain);
          if (levelsUp > 0) {
            const perkGained = fighter.perkPoints - perkPtsBefore;
            const bonusPts = perkGained > 0 ? ` +${perkGained} ponto(s) de perk!` : '';
            await notifService.add('success', '⬆️ Level Up!', `Você subiu para Nv.${fighter.level}!${bonusPts}`);
          }
        }
      }
    }
  }

  async processSuperFightTracking(world, fighter, now) {
    for (const evt of world.playerEvents) {
      for (const result of evt.playerResults) {
        if (!result || !result.fighterAId) continue;
        const playerIsA = evt.playerFighterIds?.has(result.fighterAId);
        if (!playerIsA && !evt.playerFighterIds?.has(result.fighterBId)) continue;
        const playerId = playerIsA ? result.fighterAId : result.fighterBId;
        const won = result.winnerId === playerId;
        if (!won || playerId !== fighter.id) continue;

        const oppId = playerIsA ? result.fighterBId : result.fighterAId;
        const all = await this.db.getAll('offers');
        const booking = all.find(o =>
          o.fighterId === fighter.id && o.opponentId === oppId &&
          (o.status === 'completed' || o.status === 'accepted' || o.status === 'cancelled')
        );
        if (!booking) continue;

        if (booking.isSuperFight) {
          fighter.updatePopularity(OFFER_CONFIG.SUPER_FIGHT.POPULARITY_GAIN);
          if (this.careerLogService) {
            const oppName = playerIsA ? result.fighterBName : result.fighterAName;
            await this.careerLogService.publish(fighter.id, 'super_fight_win', now, 90, {
              opponentName: oppName, promo: booking.promotionName,
            });
          }
        }
        if (booking.isTitleFight && booking.titleRole === 'defense' && won) {
          const opponent = await this.fighterCtrl.getFighter(oppId);
          const quality = Math.max(1, (opponent?.overallRating || 60) - 60);
          fighter.titleDefenseQuality = (fighter.titleDefenseQuality || 0) + quality;
          fighter.titleDefenses = (fighter.titleDefenses || 0) + 1;
        }
        if (booking.isTitleFight && won && !result.titleRetained) {
          const wc = booking.weightClass || result.titleWeightClass || fighter.weightClass;
          if (!fighter.titleWeightClasses) fighter.titleWeightClasses = [];
          if (!fighter.titleWeightClasses.includes(wc)) fighter.titleWeightClasses.push(wc);
          if (fighter.titleWeightClasses.length >= 2) fighter.doubleChampion = true;
        }
      }
    }
  }

  async processLastFight(fighter, now) {
    if (!fighter.lastFightPending || fighter.lastFightAbsWeek !== now) return;
    const lastFight = fighter.fights[0];
    if (lastFight && !lastFight.won) {
      fighter.updatePopularity(-15);
      await this.notifService.add('warning', '💔 Última Luta', 'Você perdeu sua despedida. O legado ficou manchado.');
    } else if (lastFight && lastFight.won) {
      fighter.updatePopularity(10);
      await this.notifService.add('success', '🏆 Última Luta', 'Vitória na despedida! Lenda do esporte!');
    }
    fighter.lastFightPending = false;
    fighter.lastFightBonus = 1.0;
    fighter.status = 'retired';
    fighter.organizationId = null;
    fighter.academyId = null;
    if (lastFight?.won) {
      await this.careerCtrl._markRetirementForCeremony(fighter, ['Última Luta — Saiu Vencendo']);
    }
    if (this.careerLogService) {
      await this.careerLogService.publish(fighter.id, 'challenge_end', now, 70, {
        reason: 'last_fight_completed', won: lastFight?.won ?? false,
      });
    }
  }

  async processTrainingXp(fighter, notifService) {
    if (!fighter) return;
    const perkPtsBefore = fighter.perkPoints;
    const levelsUp = fighter.addXP(LEVEL_CONFIG.XP_PER_WEEK_TRAINED);
    if (levelsUp > 0) {
      const perkGained = fighter.perkPoints - perkPtsBefore;
      const bonusPts = perkGained > 0 ? ` +${perkGained} ponto(s) de perk!` : '';
      await notifService.add('success', '⬆️ Level Up!', `Treino semanal te levou ao Nv.${fighter.level}!${bonusPts}`);
    }
  }

  async processWeeklyTrainingPrompt(fighter, now) {
    if (fighter.status === 'retired') return;
    const bookings = await this.offerService.getAccepted();
    const booking = bookings.find(b => b.fighterId === fighter.id);
    const weeksSinceStart = fighter.fights?.length > 0 ? now - fighter.fights[0].absWeek : now;
    if (!booking && fighter.status !== 'injured' && weeksSinceStart % WEEKLY_TRAINING_FREQUENCY === 0) {
      let existing;
      try { existing = await this.db.get('gameState', 'weeklyTrainingPrompt'); } catch { /* ok */ }
      if (!existing) {
        await this.db.put('gameState', { id: 'weeklyTrainingPrompt', active: true, absWeek: now });
      }
    }
  }

  async processWeeklyPrompts(fighter, now) {
    // Weekly training prompt
    if (fighter.status !== 'retired') {
      const bookings = await this.offerService.getAccepted();
      const booking = bookings.find(b => b.fighterId === fighter.id);
      const weeksSinceStart = fighter.fights?.length > 0 ? now - fighter.fights[0].absWeek : now;
      if (!booking && fighter.status !== 'injured' && weeksSinceStart % WEEKLY_TRAINING_FREQUENCY === 0) {
        let existing;
        try { existing = await this.db.get('gameState', 'weeklyTrainingPrompt'); } catch { /* ok */ }
        if (!existing) {
          await this.db.put('gameState', { id: 'weeklyTrainingPrompt', active: true, absWeek: now });
        }
      }
    }

    // Social media prompt
    if (fighter.status !== 'retired') {
      const bookings = await this.offerService.getAccepted();
      const hasBooking = bookings.some(b => b.fighterId === fighter.id);
      await this.narrativeCtrl.rollSocialMediaPrompt(now, fighter, hasBooking);
    }

    // Rivalry prompt
    await this._processRivalryPrompt(fighter, now);

    // Narrative event
    await this._processNarrativeEvent(fighter, now);
  }

  async _processRivalryPrompt(fighter, now) {
    if (fighter.status === 'retired') return;
    let activePrompt = await this.db.get('gameState', 'rivalry-prompt');
    if (activePrompt?.expiresAbsWeek != null && activePrompt.expiresAbsWeek <= now) {
      await this.db.delete('gameState', 'rivalry-prompt');
      activePrompt = null;
    }
    if (activePrompt) return;

    const rivalries = await this.rivalryService.getRivalries(fighter.id);
    const topRivalry = pickTopRandom(rivalries, r => r.intensity);
    if (!topRivalry || topRivalry.intensity < 3) return;

    const rivalId = topRivalry.fighterAId === fighter.id ? topRivalry.fighterBId : topRivalry.fighterAId;
    const rival = await this.fighterCtrl.getFighter(rivalId);
    if (!rival) return;

    const interaction = this.rivalryService.rollInteraction(fighter, rival);
    if (!interaction) return;

    interaction.rivalryId = topRivalry.id;
    interaction.rivalFighterId = rivalId;
    interaction.createdAbsWeek = now;
    interaction.expiresAbsWeek = now + RIVALRY_CONFIG.INTERACTION_PROMPT_EXPIRY_WEEKS;
    await this.db.put('gameState', { id: 'rivalry-prompt', ...interaction });
    await this.notifService.add('warning', '⚔️ Rivalidade', `${rival.name} está provocando você. Como reagir?`);
  }

  async _processNarrativeEvent(fighter, now) {
    if (now % 5 !== 0 || fighter.status === 'retired') return;
    let narrativePrompt;
    try { narrativePrompt = await this.db.get('gameState', 'narrative-prompt'); } catch { /* ok */ }
    if (narrativePrompt) return;

    const rivalriesForCtx = await this.rivalryService.getRivalries(fighter.id);
    let hasTrainingPartners = Object.keys(fighter.sparredWith || {}).length > 0;
    if (!hasTrainingPartners && this.partnersService) {
      try {
        const teammates = await this.partnersService.getTeammates(fighter);
        hasTrainingPartners = (teammates || []).length > 0;
      } catch { /* ok */ }
    }
    const narrativeEvent = this.careerLogService.selectNarrativeEvent(fighter, {
      hasActiveRival: rivalriesForCtx.length > 0, hasTrainingPartners,
    });
    if (!narrativeEvent) return;

    const choices = narrativeEvent.choices.map((c, i) => ({ ...c, key: `n_${i}` }));
    await this.db.put('gameState', {
      id: 'narrative-prompt', prompt: narrativeEvent.prompt,
      choices, createdAbsWeek: now,
    });
    await this.notifService.add('headline', '📰 Momento da Carreira', narrativeEvent.prompt);
  }

  async processCareerMilestones(world, fighter) {
    return await this.careerCtrl.checkMilestones(world.playerEvents, fighter);
  }

  async processNarrativeWeek(now, world, fighter) {
    await this.narrativeCtrl.checkExpectations(now, fighter);
    await this.narrativeCtrl.generateHeadlines(now, world, fighter);
    await this.narrativeCtrl.generateCallouts(now, fighter);
  }

  // "Até o Fim" mechanics
  processFightTilEnd(fighter, now) {
    if (!fighter.fightTilEnd || fighter.age < 33) return;
    fighter._applyAgeDecline(fighter.age);
    fighter._applyAgeDecline(fighter.age);
    if (fighter.lastFightAbsWeek === now && Math.random() < 0.30) {
      const physicalAttrs = ['strength', 'speed', 'cardio', 'durability', 'recovery', 'chin', 'power'];
      const targetAttr = physicalAttrs[Math.floor(Math.random() * physicalAttrs.length)];
      const reduction = 3 + Math.floor(Math.random() * 3);
      fighter.attributes[targetAttr] = Math.max(1, (fighter.attributes[targetAttr] || 50) - reduction);
      if (this.careerLogService) {
        this.careerLogService.publish(fighter.id, 'permanent_injury', now, 65, { attr: targetAttr, reduction }).catch(() => {});
      }
    }
    if (fighter.record.wins > 0 && fighter.record.losses > fighter.record.wins) {
      this.notifService.add('warning', '⚠️ Legado em Risco',
        'Seu cartel está negativo. O Hall da Fama não será uma opção se continuar assim.').catch(() => {});
    }
  }

  processDnaDiscovery(fighter, preDiscoveredTraits, now) {
    fighter.checkNumericDiscovery();
    if (!this.careerLogService) return;
    for (const trait of fighter.discoveredTraits) {
      if (preDiscoveredTraits.has(trait)) continue;
      this.careerLogService.publish(fighter.id, 'dna_discovered', now, DNA_DISCOVERY_MAGNITUDE[trait] ?? 55, {
        trait, traitLabel: DNA_TRAIT_NAMES[trait] || trait,
      }).catch(() => {});
    }
  }

  async processEndCareer(fighter, now) {
    const state = await this.seasonService.getState();
    if (fighter.retirementWindow > 0) fighter.retirementWindow--;

    const shouldShowPrompt = !state.endCareerPromptShown && fighter.status !== 'retired'
      && (fighter.retirementWindow <= 12 && fighter.retirementWindow > 0);
    if (shouldShowPrompt) {
      state.endCareerPromptShown = true;
      state.endCareerPrompt = true;
      await this.db.put('gameState', state);
      await this.notifService.add('headline', '🕊️ Último Capítulo',
        `Aos ${fighter.age} anos, sua carreira se aproxima do fim. Como quer encerrar?`);
    }
    if (fighter.age >= 37 && fighter.retirementWindow <= 0 && fighter.status !== 'retired' && !state.endCareerPromptShown) {
      state.endCareerPromptShown = true;
      state.endCareerPrompt = true;
      await this.db.put('gameState', state);
      await this.notifService.add('headline', '🕊️ Último Capítulo',
        `Aos ${fighter.age} anos, seu corpo já não responde. Hora de decidir.`);
    }
    if (fighter.retirementWindow <= 0 && fighter.age < 37 && !state.endCareerPromptShown && fighter.status !== 'retired') {
      fighter.status = 'retired';
      fighter.organizationId = null;
      fighter.academyId = null;
      await this.notifService.add('hall-of-fame', '👴 Aposentadoria',
        `Aos ${fighter.age} anos, o corpo não aguenta mais.`);
      if (this.careerLogService) {
        await this.careerLogService.publish(fighter.id, 'challenge_end', now, 50, {
          reason: 'retirement_window_expired' });
      }
    }
  }
}
