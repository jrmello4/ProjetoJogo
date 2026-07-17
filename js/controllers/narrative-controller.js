import { Rivalry } from '../models/rivalry.js';
import { SocialMedia } from './social-media.js';
import { SOCIAL_CONFIG, RIVALRY_CONFIG, EXPECTATION_CONFIG, absWeek } from '../config/game-config.js';
import { pickTopRandom } from '../utils/helpers.js';

// Narrativa semanal: redes sociais, callouts, headlines, expectativas,
// prompts de rivalidade e eventos narrativos. Recebe todas as dependências
// via construtor (DB, services, controllers auxiliares).
export class NarrativeController {
  constructor(db, fighterCtrl, notifService, careerLogService, rivalryService, partnersService, socialMediaService, seasonService, worldService) {
    this.db = db;
    this.fighterCtrl = fighterCtrl;
    this.notifService = notifService;
    this.careerLogService = careerLogService;
    this.rivalryService = rivalryService;
    this.partnersService = partnersService;
    this.socialMediaService = socialMediaService;
    this.seasonService = seasonService;
    this.worldService = worldService;
  }

  // ===== Redes sociais em semana livre (§D.2) =====
  // Resolve QUEM é o rival ativo mais intenso (se houver) antes de rolar a
  // chance semanal — a opção de provocar só existe quando isso resolve para
  // um fighter de verdade. Só LÊ dados; quem muta/salva o fighter é
  // resolveSocialPrompt(), chamado depois pelo clique do jogador.
  async rollSocialMediaPrompt(now, fighter, hasBooking) {
    const activeRivalries = await this.rivalryService.getRivalries(fighter.id);
    let rivalInfo = null;
    if (activeRivalries.length > 0) {
      const rivalry = pickTopRandom(activeRivalries, r => r.intensity);
      const rivalFighterId = rivalry.fighterAId === fighter.id ? rivalry.fighterBId : rivalry.fighterAId;
      const rivalFighter = await this.fighterCtrl.getFighter(rivalFighterId);
      if (rivalFighter) {
        rivalInfo = { rivalryId: rivalry.id, fighterId: rivalFighterId, name: rivalFighter.name };
      }
    }
    return await this.socialMediaService.processWeek(now, hasBooking, rivalInfo);
  }

  async generateHeadlines(now, world, fighter) {
    const { playerEvents, promotionEvents } = world;

    for (const evt of (playerEvents || [])) {
      for (const r of (evt.playerResults || [])) {
        const playerIsA = evt.playerFighterIds?.has(r.fighterAId);
        const playerId = playerIsA ? r.fighterAId : r.fighterBId;
        const opponentName = playerIsA ? r.fighterBName : r.fighterAName;
        const won = r.isDraw ? null : r.winnerId === playerId;

        if (won === false && r.method && (r.method.startsWith('KO') || r.method.startsWith('TKO'))) {
          await this.notifService.add('headline', 'Nocaute Sofrido', `Você foi nocauteado por ${opponentName} no R${r.round}.`);
        }
        if (won === true && r.method && r.method.startsWith('KO')) {
          await this.notifService.add('headline', 'Nocaute!', `Você nocauteou ${opponentName} no R${r.round}!`);
        }
        if (won === true && r.method && r.method.startsWith('Submission')) {
          await this.notifService.add('headline', 'Finalização!', `Você finalizou ${opponentName} no R${r.round}!`);
        }
      }
    }

    for (const promo of (promotionEvents || [])) {
      for (const r of (promo.results || []).slice(0, 3)) {
        const headlineParts = [];
        if (r.method === 'KO') headlineParts.push(`💥 NOCAUTE: ${r.winnerName} destrói ${r.loserName} no R${r.round}`);
        else if (r.method === 'Submission') headlineParts.push(`🔄 Finalização: ${r.winnerName} finaliza ${r.loserName} no R${r.round}`);
        else if (r.isTitleFight) headlineParts.push(`🏆 Disputa de cinturão: ${r.winnerName} vence ${r.loserName}`);

        if (r.winnerOvr && r.loserOvr && r.loserOvr > r.winnerOvr + 8) {
          headlineParts.push(`⚠️ SURPRESA: ${r.winnerName} (OVR ${r.winnerOvr}) vence ${r.loserName} (OVR ${r.loserOvr})`);
        }

        if (headlineParts.length > 0) {
          await this.notifService.add('headline', promo.promotionName, `${headlineParts[0]}`);
        }
      }
    }
  }

  async generateCallouts(now, fighter) {
    if (fighter.status === 'injured' || fighter.status === 'retired') return;
    if (Math.random() > 0.3) return;

    const allFighters = await this.fighterCtrl.getAllFighters();
    const callouters = allFighters.filter(f =>
      f.id !== fighter.id &&
      f.status !== 'retired' &&
      f.weightClass === fighter.weightClass &&
      f.popularity >= 30
    );
    if (!callouters.length) return;

    const caller = callouters[Math.floor(Math.random() * callouters.length)];
    const calloutPhrases = [
      `${caller.name} te provocou: "Eu enfrento qualquer um, inclusive ele."`,
      `${caller.name} disse em entrevista que você "não está pronto para o próximo nível."`,
      `${caller.name} quer uma chance contra você: "Quero mostrar quem manda na divisão."`,
      `${caller.name} criticou sua última atuação: "Eu teria finalizado no primeiro round."`,
      `${caller.name} mandou um salve: "Para de fugir e aceita uma luta."`,
    ];

    const phrase = calloutPhrases[Math.floor(Math.random() * calloutPhrases.length)];
    await this.notifService.add('headline', 'Callout', phrase);
  }

  async checkExpectations(now, fighter) {
    if (fighter.status === 'injured' || fighter.status === 'retired') return;
    if (!fighter.promotionContract && !fighter.organizationId) return;

    if (fighter.expectation?.urgency >= 3) {
      const oldMorale = fighter.morale;
      const oldLoyalty = fighter.loyalty;
      fighter.morale = Math.max(0, fighter.morale - EXPECTATION_CONFIG.MORALE_DAMAGE_URGENT);
      fighter.loyalty = Math.max(0, fighter.loyalty - EXPECTATION_CONFIG.LOYALTY_DAMAGE_URGENT);
      if (fighter.morale < oldMorale || fighter.loyalty < oldLoyalty) {
        await this.notifService.add(
          'warning',
          'Insatisfação',
          `Você está frustrado com a falta de ${fighter.expectation.kind === 'title_shot' ? 'chance de título' : fighter.expectation.kind === 'move_up_tier' ? 'progressão de carreira' : fighter.expectation.kind === 'more_fights' ? 'lutas' : 'melhor pagamento'}. Moral: -${EXPECTATION_CONFIG.MORALE_DAMAGE_URGENT}, Lealdade: -${EXPECTATION_CONFIG.LOYALTY_DAMAGE_URGENT}.`
        );
      }
    }

    if (now - (fighter.lastExpectationCheck || 0) < EXPECTATION_CONFIG.CHECK_INTERVAL) return;

    const promotions = await this.worldService.getPromotions();
    const promoId = fighter.promotionContract?.promotionId || fighter.organizationId;
    const promo = promotions.find(p => p.id === promoId);
    if (!promo) return;

    // Já é campeão desta divisão nesta promoção — não faz sentido "querer
    // uma chance de título" de um cinturão que já está com ele.
    if (promo.isChampion(fighter.id, fighter.weightClass)) {
      fighter.lastExpectationCheck = now;
      fighter.expectation = null;
      return;
    }

    const weeksSinceLastFight = now - (fighter.lastFightAbsWeek || 0);
    const tier = promo.tier;
    const fighterTier = fighter.overallRating >= 75 ? 1 : fighter.overallRating >= 60 ? 2 : 3;

    let expectation = null;
    if (fighterTier <= tier && weeksSinceLastFight >= 12) {
      expectation = { kind: 'title_shot', sinceAbsWeek: now, urgency: 2 };
    } else if (fighterTier < tier && weeksSinceLastFight >= 8) {
      expectation = { kind: 'move_up_tier', sinceAbsWeek: now, urgency: 2 };
    } else if (weeksSinceLastFight >= 16) {
      expectation = { kind: 'more_fights', sinceAbsWeek: now, urgency: 3 };
    } else if (fighter.record.wins >= 3 && fighter.popularity >= 60 && !fighter.expectation) {
      expectation = { kind: 'better_pay', sinceAbsWeek: now, urgency: 1 };
    }

    fighter.lastExpectationCheck = now;

    if (expectation) {
      fighter.expectation = expectation;
      await this.notifService.add(
        'warning',
        'Expectativa',
        `Você quer ${expectation.kind === 'title_shot' ? 'uma chance de título' : expectation.kind === 'move_up_tier' ? 'subir de tier' : expectation.kind === 'more_fights' ? 'lutar mais' : 'melhor pagamento'}.`
      );
    } else {
      fighter.expectation = null;
    }

    if (fighter.expectation && weeksSinceLastFight >= 4) {
      fighter.expectation.urgency = Math.min(3, (fighter.expectation.urgency || 1) + 1);
    }
  }

  // Resolve o prompt pendente com a escolha do jogador. Fetch-mutate-save
  // PRÓPRIO e isolado (busca o fighter fresco, muta, salva uma vez só) —
  // chamado direto por um clique do jogador (padrão idêntico a
  // accept/declineSponsorOffer), nunca de dentro de processWeek, então não
  // há risco do bug de "outro código já salvou uma instância mais nova".
  async resolveSocialPrompt(choice, fighterId) {
    const fighter = await this.fighterCtrl.getFighter(fighterId);
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };

    const state = await this.socialMediaService.getState();
    const pending = state.pending;
    if (!pending) return { ok: false, reason: 'Nenhum post pendente.' };

    const seasonState = await this.seasonService.getState();
    const now = absWeek(seasonState);

    const result = SocialMedia.applyContextualChoice(fighter, choice, {
      isChampion: fighter.ranking === 1 || (fighter.titlesWon || 0) > 0,
    });

    if (result.provoked) {
      await this.careerLogService.publish(fighter.id, 'provocation', now, SOCIAL_CONFIG.PROVOCATION_MAGNITUDE, {
        targetFighterId: pending.rivalFighterId || null,
        targetName: pending.rivalName || null,
      });

      if (pending.rivalryId) {
        const rivalryData = await this.db.get('rivalries', pending.rivalryId);
        if (rivalryData) {
          const rivalry = new Rivalry(rivalryData);
          rivalry.increaseIntensity(SOCIAL_CONFIG.PROVOKE_RIVALRY_INTENSITY_GAIN);
          rivalry.addEvent('provocation', `Provocação pública contra ${pending.rivalName || 'rival'} nas redes sociais`);
          await this.db.put('rivalries', rivalry);
        }
      }
    }

    if (result.viral) {
      await this.notifService.add('headline', '🔥 Viral!', 'Seu post explodiu nas redes sociais! Popularidade extra e novos olhos no seu trabalho.');
      if (this.careerLogService) {
        await this.careerLogService.publish(fighter.id, 'viral', now, 65, {});
      }
    }

    if (result.backfire) {
      await this.notifService.add('warning', '💥 Repercussão Negativa', 'Seu post teve uma repercussão negativa inesperada. Popularidade caiu.');
      if (this.careerLogService) {
        await this.careerLogService.publish(fighter.id, 'backfire', now, 40, {});
      }
    }

    await this.fighterCtrl.updateFighter(fighter);
    await this.socialMediaService.clearPending();

    return { ok: true, choice, effects: result.effects };
  }

  // ===== Rivalidade: resolve a escolha do jogador no prompt semanal =====
  async resolveRivalryInteraction(choice, fighterId) {
    const fighter = await this.fighterCtrl.getFighter(fighterId);
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };

    let state;
    try { state = await this.db.get('gameState', 'rivalry-prompt'); } catch { /* ok */ }
    if (!state || !state.choices) return { ok: false, reason: 'Nenhum prompt pendente.' };

    const seasonState = await this.seasonService.getState();
    const now = absWeek(seasonState);
    if (state.expiresAbsWeek != null && state.expiresAbsWeek <= now) {
      await this.db.delete('gameState', 'rivalry-prompt').catch(() => {});
      return { ok: false, reason: 'Esse momento de rivalidade já passou.' };
    }
    if (!state.choices.some(c => c.key === choice)) return { ok: false, reason: 'Escolha de rivalidade inválida.' };
    await this.db.delete('gameState', 'rivalry-prompt').catch(() => {});

    const rival = await this.fighterCtrl.getFighter(state.rivalFighterId);
    const rivalryData = await this.db.get('rivalries', state.rivalryId);
    if (!rivalryData) return { ok: false, reason: 'Rivalidade não encontrada.' };
    const rivalry = new Rivalry(rivalryData);

    const fighterPop = fighter.popularity || 0;
    const rivalPop = rival?.popularity || 0;
    const recentResult = fighter.latestFightResult;
    const resultIsRecent = fighter.lastFightAbsWeek && (now - fighter.lastFightAbsWeek) <= 8;
    const lostLastFight = resultIsRecent && recentResult?.won === false;
    const wonLastFight = resultIsRecent && recentResult?.won === true;

    const personality = state.rivalPersonality || 'cautious';
    const isUnderdog = fighterPop < rivalPop - 10;
    const intensityGain = 1 + Math.floor(Math.random() * 3);
    let popChange = 0;
    let moraleChange = 0;
    let finalIntensityGain = 0;

    switch (choice) {
      case 'provoke':
        if (personality === 'aggressive') {
          finalIntensityGain = intensityGain + 1;
          popChange = isUnderdog ? 3 : 0;
        } else if (personality === 'cautious') {
          finalIntensityGain = 0;
          popChange = 0;
        } else {
          finalIntensityGain = 1;
          popChange = 1;
        }
        if (wonLastFight) finalIntensityGain += 1;
        if (lostLastFight) { popChange -= 2; moraleChange = -3; }
        break;

      case 'respect':
        if (personality === 'aggressive') {
          finalIntensityGain = -1;
        } else if (personality === 'cautious') {
          finalIntensityGain = 0;
          popChange = 2;
        } else {
          finalIntensityGain = 0;
          popChange = 1;
        }
        moraleChange = 2;
        break;

      case 'ignore':
      default:
        popChange = 0;
        moraleChange = 1;
        break;
    }

    fighter.updatePopularity(popChange);
    fighter.applyMoraleChange(moraleChange);

    if (finalIntensityGain > 0) {
      rivalry.increaseIntensity(finalIntensityGain);
    } else if (finalIntensityGain < 0) {
      rivalry.intensity = Math.max(1, rivalry.intensity + finalIntensityGain);
    }

    const actionLabel = { provoke: 'provocou', respect: 'respeitou', ignore: 'ignorou' }[choice] || choice;
    const displayRivalName = rival?.name || state.rivalName;
    rivalry.addEvent('interaction', `${fighter.name} ${actionLabel} ${displayRivalName} publicamente`);

    await this.db.put('rivalries', rivalry);
    await this.fighterCtrl.updateFighter(fighter);

    const messages = {
      provoke: `Você provocou ${displayRivalName}.${finalIntensityGain > 0 ? ' A rivalidade esquentou!' : ' O rival ignorou.'}`,
      respect: `Você respeitou ${displayRivalName}. Postura de campeão.`,
      ignore: 'Você ignorou a provocação. Postura profissional.',
    };
    await this.notifService.add('info', 'Rivalidade', messages[choice] || '');

    return { ok: true, choice, effects: { popChange, moraleChange, intensityGain: finalIntensityGain } };
  }

  // ===== Evento narrativo: resolve a escolha do jogador =====
  async resolveNarrativeChoice(choiceKey, fighterId) {
    const fighter = await this.fighterCtrl.getFighter(fighterId);
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };

    let promptData;
    try { promptData = await this.db.get('gameState', 'narrative-prompt'); } catch { /* ok */ }
    if (!promptData) return { ok: false, reason: 'Nenhum evento narrativo pendente.' };

    const choice = promptData.choices.find(c => c.key === choiceKey);
    if (!choice) return { ok: false, reason: 'Escolha inválida.' };

    // Aplica os efeitos
    const effects = choice.effects || {};
    const logParts = [];
    const seasonState = await this.seasonService.getState();
    const absWeekNow = absWeek(seasonState);
    for (const [key, value] of Object.entries(effects)) {
      switch (key) {
        case 'morale':
          fighter.applyMoraleChange(value);
          logParts.push(`moral ${value >= 0 ? '+' : ''}${value}`);
          break;
        case 'popularity':
          fighter.updatePopularity(value);
          logParts.push(`popularidade ${value >= 0 ? '+' : ''}${value}`);
          break;
        case 'hype':
          fighter.narrativeHype = (fighter.narrativeHype || 0) + value;
          logParts.push(`hype ${value >= 0 ? '+' : ''}${value}`);
          break;
        case 'heat':
          fighter.narrativeHeat = (fighter.narrativeHeat || 0) + value;
          logParts.push(`heat ${value >= 0 ? '+' : ''}${value}`);
          break;
        // P5.2: Bastidores — efeitos expandidos
        case 'cash':
          fighter.addTransaction(absWeekNow, `📰 ${choice.text.slice(0, 30)}`, value);
          logParts.push(`dinheiro ${value >= 0 ? '+' : ''}${value}`);
          break;
        case 'bondBoost':
          // Tenta boost de bond com o parceiro de treino atual
          if (this.partnersService && fighter.academyId) {
            const teammates = await this.partnersService.getTeammates(fighter);
            if (teammates && teammates.length > 0) {
              // Escolhe o parceiro com maior bond atual para receber o boost
              const target = teammates.reduce((best, t) => {
                const bond = this.partnersService.constructor.bondOf(fighter, t.id);
                return bond > (best.bond || 0) ? { fighter: t, bond } : best;
              }, { bond: 0 });
              if (target.fighter) {
                const currentBond = this.partnersService.constructor.bondOf(fighter, target.fighter.id);
                this.partnersService.constructor._setBond(fighter, target.fighter.id, currentBond + value);
                logParts.push(`vínculo +${value}`);
              }
            }
          }
          break;
        case 'loyalty':
          fighter.loyalty = Math.max(0, Math.min(100, (fighter.loyalty || 50) + value));
          logParts.push(`lealdade ${value >= 0 ? '+' : ''}${value}`);
          break;
        case 'determination':
          fighter.hidden.determination = Math.max(0, Math.min(100, (fighter.hidden.determination || 50) + value));
          logParts.push(`determinação ${value >= 0 ? '+' : ''}${value}`);
          break;
        case 'discipline':
          fighter.hidden.discipline = Math.max(0, Math.min(100, (fighter.hidden.discipline || 50) + value));
          logParts.push(`disciplina ${value >= 0 ? '+' : ''}${value}`);
          break;
        default:
          // Atributo do lutador (ex: composure, power, awareness, chin, etc.)
          if (key in fighter.attributes) {
            const newVal = Math.min(fighter.effectiveCeiling(key), Math.max(1, (fighter.attributes[key] || 50) + value));
            fighter.attributes[key] = newVal;
            logParts.push(`${key} ${value >= 0 ? '+' : ''}${value}`);
          }
          break;
      }
    }

    await this.fighterCtrl.updateFighter(fighter);
    await this.db.delete('gameState', 'narrative-prompt');

    if (this.careerLogService) {
      await this.careerLogService.publish(fighter.id, 'narrative_choice', absWeekNow, 35, {
        prompt: promptData.prompt.slice(0, 80),
        choice: choice.text,
        effects: logParts.join(', '),
      });
    }

    return { ok: true, choice: choice.text, effects: logParts };
  }
}
