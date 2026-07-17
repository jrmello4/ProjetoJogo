import { Academy } from '../models/academy.js';
import { Promotion } from '../models/promotion.js';
import { Fighter, DNA_TRAIT_NAMES } from '../models/fighter.js';
import { DB } from '../services/db.js';
import { DataGenerator } from '../services/data-generator.js';
import { RankingService } from '../services/ranking.js';
import { FighterController } from './fighter-controller.js';
import { EventController } from './event-controller.js';
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
import { RivalryService } from '../services/rivalry-service.js';
import { SocialMediaService } from '../services/social-media-service.js';
import { SocialMedia } from './social-media.js';
import { Rivalry } from '../models/rivalry.js';
import { FightOffer } from '../models/fight-offer.js';
import { generateId, clamp, pickTopRandom } from '../utils/helpers.js';
import { TrainingCamp } from './training-camp.js';
import { WeeklyTrainingController } from './weekly-training.js';
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
  EXPECTATION_CONFIG,
  SOCIAL_CONFIG,
  WEIGH_IN_CONFIG,
  RIVALRY_CONFIG,
  PARTNER_CONFIG,
  DNA_DISCOVERY_MAGNITUDE,
  READINESS_CONFIG,
  WEEKLY_TRAINING_CHOICES,
  WEEKLY_TRAINING_FREQUENCY,
  absWeek,
} from '../config/game-config.js';
import { TapeService } from '../services/tape-service.js';
import { ReadinessService } from '../services/readiness-service.js';
import { LEVEL_CONFIG, MOVES, OPTIONAL_SERVICES, WEEKLY_ACTIVITIES, INJURY_CONFIG, OFFER_CONFIG } from '../config/game-config.js';

const WORLD_MODE = 'career-1-fighter';
// v4: carreira de 1 lutador — Academy substitui Gym/RivalGym, economia
// pessoal, sem elenco. Ver docs/superpowers/specs/2026-07-13-carreira-sistemica-1-lutador-design.md
const WORLD_SCHEMA = 4;

// Orquestrador da carreira: o jogador É o lutador, do primeiro contrato à
// aposentadoria. As promoções são IA e o mundo gira sozinho a cada semana.
export class GameController {
  constructor() {
    this.db = new DB();
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
    this.rivalryService = null;
    this.socialMediaService = null;
  }

  async init() {
    await this.db.init();

    this.fighterCtrl = new FighterController(this.db);
    this.eventCtrl = new EventController(this.db);
    this.seasonService = new SeasonService(this.db);
    this.notifService = new NotificationService(this.db);
    this.careerLogService = new CareerLogService(this.db);
    this.titleService = new TitleService(this.db, this.fighterCtrl, this.notifService);
    this.scoutingService = new ScoutingService(this.db, this.notifService);
    this.contractService = new ContractService(this.db, this.fighterCtrl, this.notifService);
    this.managerService = new ManagerService(this.db, this.notifService, this.careerLogService);
    this.rivalryService = new RivalryService(this.db, this.careerLogService);
    this.partnersService = new TrainingPartnersService(this.db, this.fighterCtrl, this.notifService, this.careerLogService);
    // Construído depois do RivalryService: _computePressureLevel precisa de
    // rivalryService para pressão extra em revanche 'grudge'.
    this.worldService = new WorldService(this.db, this.fighterCtrl, this.notifService, this.titleService, this.scoutingService, this.contractService, this.managerService, this.careerLogService, this.rivalryService);
    this.offerService = new OfferService(this.db, this.fighterCtrl, this.notifService, this.titleService, this.contractService, this.rivalryService);
    this.sponsorService = new SponsorService(this.db, this.notifService, this.careerLogService);
    this.socialMediaService = new SocialMediaService(this.db, this.notifService);

    const meta = await this.db.get('gameState', 'meta');
    if (!meta || meta.mode !== WORLD_MODE || meta.schemaVersion !== WORLD_SCHEMA) {
      await this._bootstrapNewWorld();
    } else {
      await this._applyPatches(meta);
    }

    return await this.getPlayerFighter();
  }

  async _applyPatches(meta) {
    const applied = new Set(meta.patches || []);
    if (applied.size !== (meta.patches || []).length) {
      await this.db.put('gameState', { ...meta, id: 'meta', patches: [...applied] });
    }

    const fighter = await this.getPlayerFighter();
    if (fighter?.campProcessedThisWeek) {
      fighter.campProcessedThisWeek = false;
      await this.fighterCtrl.updateFighter(fighter);
    }
  }

  // ===== Bootstrap do mundo =====
  // Constrói o MUNDO (promoções, academias, empresários, agentes livres).
  // Não cria o lutador do jogador ainda — isso é createPlayerFighter(),
  // chamado depois da criação de personagem (§A.7).
  async _bootstrapNewWorld() {
    for (const store of ['fighters', 'organization', 'events', 'fights', 'rivalries', 'hallOfFame', 'notifications', 'offers']) {
      await this.db.clear(store);
    }
    // Docs que vivem dentro do store 'gameState' (não cobertos pelo clear()
    // acima) e são keyed por doc singleton, não por fighterId — sem limpá-los
    // aqui, um mundo novo herdava sponsors/retention/social/careerLog da
    // carreira anterior. 'careerLog' também filtra por fighterId em
    // topByMagnitude(), mas ainda limpamos aqui para não acumular lixo de
    // mundos antigos.
    for (const docId of ['careerLog', 'sponsors', 'retention', 'socialMedia', 'rivalry-prompt']) {
      await this.db.delete('gameState', docId);
    }
    try { localStorage.removeItem('characterCreationDone'); } catch { /* ambientes sem localStorage */ }

    await this.db.put('gameState', {
      id: 'state',
      week: 1,
      year: 1,
      totalEvents: 0,
      startedAt: new Date().toISOString(),
    });
    await this.db.put('gameState', { id: 'milestones' });
    await this.db.put('gameState', { id: 'career', playerFighterId: null });

    // Promoções de IA com calendários defasados para o mundo ter ritmo
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

    // Academias — lugares no mundo, sem dono (§A.1)
    for (const cfg of ACADEMIES) {
      const academy = new Academy({ ...cfg });
      await this.db.put('organization', academy);
    }

    // Empresários (§C.1)
    await this.managerService.bootstrap();

    // Agentes livres recrutáveis (adversários de IA sem promoção ainda).
    //
    // §Fase 3b — eles nascem filiados a uma academia. Antes disto, só os
    // prospectos do draft anual recebiam `academyId`, e a sala de treino do
    // jogador ficava literalmente vazia pelos primeiros anos de carreira: um
    // sistema inteiro invisível até o mundo girar sozinho o bastante.
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
      id: 'meta',
      mode: WORLD_MODE,
      schemaVersion: WORLD_SCHEMA,
      patches: [],
      createdAt: new Date().toISOString(),
    });
  }

  // ===== Criação de personagem (§A.7) =====
  // Gera o lutador do jogador com viés leve de arquétipo/origem sobre a
  // base do DataGenerator (reaproveita toda a lógica de atributos/DNA/
  // corte de peso já existente — só empurra a semente antes de gerar).
  async createPlayerFighter({ name, weightClass, archetype, origin, difficultyId, academyId, managerId = null }) {
    const difficulty = DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[1];
    const arch = ARCHETYPES[archetype] || ARCHETYPES.generalist;
    const orig = ORIGINS[origin] || null;

    const data = DataGenerator.generateFighter(null, {
      weightClass,
      skillRange: [40, 55],
      age: 20 + Math.floor(Math.random() * 4),
      maxFights: 0, // carreira começa 0-0-0 — sem cartel fabricado
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
    data.name = name || data.name;
    data.fightingStyle = orig?.label || arch.label;
    data.status = 'roster';
    data.organizationId = null;
    data.academyId = academyId;
    data.academyJoinedAbsWeek = 1;
    data.managerId = managerId;
    data.cash = difficulty.cash;
    data.lifestyleTier = 'modest';

    await this.db.put('fighters', data);
    await this.fighterCtrl.setPlayerFighterId(data.id);

    const fighter = new Fighter(data);
    await this._ensureInitialOffers(fighter);
    return fighter;
  }

  async _ensureInitialOffers(fighter) {
    const promotions = await this.worldService.getPromotions();
    for (let attempt = 0; attempt < 3; attempt++) {
      const created = await this.offerService.generateWeekly(1, fighter, await this._playerAcademyReputation(fighter), promotions);
      if (created.length > 0) break;
    }
  }

  // ===== Academias =====
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
    const fighter = await this.getPlayerFighter();
    return fighter ? await this.getAcademy(fighter.academyId) : null;
  }

  async _playerAcademyReputation(fighter) {
    const academy = await this.getAcademy(fighter.academyId);
    return academy?.reputation ?? 30;
  }

  // Trocar de academia — não é mais "recrutamento", é escolha (§E.3).
  // Sinergia com o técnico não zera nem é herdada inteira (§C.2).
  async switchAcademy(academyId) {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    if (fighter.academyId === academyId) return { ok: false, reason: 'Você já treina aí.' };

    const academy = await this.getAcademy(academyId);
    if (!academy) return { ok: false, reason: 'Academia não encontrada.' };

    // Muta o MESMO objeto e grava uma vez só — setAcademy() faz seu próprio
    // get+put por id; chamá-lo e depois salvar este `fighter` (já carregado
    // antes) sobrescrevia a troca com o academyId antigo ainda em memória.
    const state = await this.seasonService.getState();
    if (fighter.academyId && !fighter.previousAcademyIds.includes(fighter.academyId)) {
      fighter.previousAcademyIds.push(fighter.academyId);
    }
    fighter.academyId = academyId;
    fighter.academyJoinedAbsWeek = absWeek(state);
    fighter.coachSynergy = Math.round(fighter.coachSynergy * 0.4); // SYNERGY_CONFIG.CARRY_OVER_RATIO
    await this.fighterCtrl.updateFighter(fighter);
    if (this.careerLogService) {
      await this.careerLogService.publish(fighter.id, 'academy_switch', absWeek(state), 40, { academyName: academy.name });
    }
    return { ok: true, academy };
  }

  // ===== Empresário (§C.1) =====
  async getManagers() {
    return await this.managerService.getAll();
  }

  async getPlayerManager() {
    const fighter = await this.getPlayerFighter();
    return fighter?.managerId ? await this.managerService.getManager(fighter.managerId) : null;
  }

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

  // ===== Custo de vida (§E.1) =====
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
    fighter.everReachedLifestyle[tier] = true;
    await this.fighterCtrl.updateFighter(fighter);
    return { ok: true };
  }

  // ===== O lutador do jogador =====
  async getPlayerFighter() {
    return await this.fighterCtrl.getPlayerFighter();
  }

  // ===== Tick semanal =====
  // Ordem importa: mundo gira -> ofertas expiram/chegam -> economia -> treino.
  async processWeek(cornerHooks = null) {
    const nextWeekState = await this.seasonService.peekNextWeek();
    const now = absWeek(nextWeekState);
    const preFight = await this.getPlayerFighter();
    const preFightId = preFight.id;
    // §F — snapshot pré-semana pra publicar dna_discovered no careerLog por
    // diff no fim deste método: descobertas acontecem em vários gatilhos
    // espalhados (luta, treino, moral) sem acesso a careerLogService — mais
    // simples comparar o conjunto final contra este snapshot do que plumbing
    // o service em cada trigger individual.
    const preDiscoveredTraits = new Set(preFight.discoveredTraits);

    // A escolha fica disponível na semana anterior. Se ela for ignorada até
    // a noite do evento, a equipe executa o plano conservador em vez de
    // deixar uma reserva travada ou pular a luta silenciosamente.
    await this._autoResolveDueWeighIn(now, preFight);

    const world = await this.worldService.processWeek(now, nextWeekState.startedAt, preFightId, cornerHooks);

    // §D.3 — criação/atualização de rivalidade tem que rodar aqui (dentro de
    // processWeek), não só no advanceWeek() ao vivo do app.js, senão o
    // fast-forward (simulateWeeks -> processWeek em loop) nunca cria nem
    // deriva tipo de rivalidade nenhuma. checkPostFight só LÊ os Fighters
    // passados (id) e escreve na store 'rivalries' — nunca chama
    // fighterCtrl.updateFighter, então não corre o risco de pisar em cima
    // do fetch-mutate-save do WorldService feito logo acima.
    for (const evt of world.playerEvents) {
      for (const result of evt.playerResults) {
        const fighterA = await this.fighterCtrl.getFighter(result.fighterAId);
        const fighterB = await this.fighterCtrl.getFighter(result.fighterBId);
        if (fighterA && fighterB) {
          await this.rivalryService.checkPostFight(fighterA, fighterB, result, result.card === 'main', now, preFightId);
        }
      }
    }

    // Rebusca DEPOIS do tick do mundo — WorldService busca e salva sua
    // PRÓPRIA instância do lutador ao resolver a luta (record, popularidade,
    // caixa, lesão, descobertas de DNA...). Continuar mutando o `fighter`
    // buscado ANTES da luta e salvá-lo no fim deste método sobrescrevia
    // tudo isso com o estado pré-luta — a luta "acontecia" mas o resultado
    // nunca sobrevivia ao fim da semana. Bug real, achado testando ao vivo.
    const fighter = await this.getPlayerFighter();
    const academy = await this.getAcademy(fighter.academyId);

    // XP por luta
    for (const evt of world.playerEvents) {
      for (const result of evt.playerResults) {
        if (result && result.winnerId) {
          const xpGain = LEVEL_CONFIG.XP_PER_FIGHT + (result.winnerId === fighter.id ? LEVEL_CONFIG.XP_PER_WIN_BONUS : 0);
          const perkPtsBefore = fighter.perkPoints;
          const levelsUp = fighter.addXP(xpGain);
          if (levelsUp > 0) {
            const perkGained = fighter.perkPoints - perkPtsBefore;
            const bonusPts = perkGained > 0 ? ` +${perkGained} ponto(s) de perk!` : '';
            await this.notifService.add('success', '⬆️ Level Up!', `Você subiu para Nv.${fighter.level}!${bonusPts}`);
          }
        }
      }
    }

    // P4.3: Super fight win bonus, title defense quality, double champion tracking
    for (const evt of world.playerEvents) {
      for (const result of evt.playerResults) {
        if (!result || !result.fighterAId) continue;
        const playerIsA = evt.playerFighterIds?.has(result.fighterAId);
        if (!playerIsA && !evt.playerFighterIds?.has(result.fighterBId)) continue;
        const playerId = playerIsA ? result.fighterAId : result.fighterBId;
        const won = result.winnerId === playerId;

        if (won && playerId === fighter.id) {
          // Busca a oferta correspondente a esta luta
          const oppId = playerIsA ? result.fighterBId : result.fighterAId;
          const booking = await this._findFightOffer(fighter.id, oppId);

          if (booking) {
            // Super fight — vitória contra campeão de outra promoção
            if (booking.isSuperFight) {
              fighter.updatePopularity(OFFER_CONFIG.SUPER_FIGHT.POPULARITY_GAIN);
              const oppName = playerIsA ? result.fighterBName : result.fighterAName;
              await this.careerLogService.publish(fighter.id, 'super_fight_win', now, 90, {
                opponentName: oppName,
                promo: booking.promotionName,
              });
            }

            // Qualidade da defesa de cinturão
            if (booking.isTitleFight && booking.titleRole === 'defense' && won) {
              const opponent = await this.fighterCtrl.getFighter(oppId);
              const quality = Math.max(1, (opponent?.overallRating || 60) - 60);
              fighter.titleDefenseQuality = (fighter.titleDefenseQuality || 0) + quality;
              fighter.titleDefenses = (fighter.titleDefenses || 0) + 1;
            }

            // Duplo campeão: rastreia em quantas divisões diferentes o lutador já foi campeão
            if (booking.isTitleFight && won && !result.titleRetained) {
              const wc = booking.weightClass || result.titleWeightClass || fighter.weightClass;
              if (!fighter.titleWeightClasses) fighter.titleWeightClasses = [];
              if (!fighter.titleWeightClasses.includes(wc)) {
                fighter.titleWeightClasses.push(wc);
              }
              if (fighter.titleWeightClasses.length >= 2) {
                fighter.doubleChampion = true;
              }
            }
          }
        }
      }
    }

    await this.offerService.expireOld(now);
    const promotions = await this.worldService.getPromotions();
    const offersCreated = fighter.status !== 'retired'
      ? await this.offerService.generateWeekly(now, fighter, academy?.reputation ?? 30, promotions)
      : [];

    if (fighter.status !== 'retired') {
      await this.contractService.generateOffers(fighter, now, academy?.reputation ?? 30);
    }

    const economy = this._applyWeeklyEconomy(fighter, academy, now);
    // Serviços opcionais (nutricionista, fisioterapeuta, psicólogo)
    this._applyWeeklyServices(fighter);
    const sponsorActivity = await this.sponsorService.processWeek(now, fighter);
    await this._applyWeeklyTraining(fighter, academy);

    // Fase 1: Weekly training micro-decision check
    if (fighter.status !== 'retired') {
      const bookings = await this.offerService.getAccepted();
      const booking = bookings.find(b => b.fighterId === fighter.id);
      const weeksSinceStart = fighter.fights?.length > 0
        ? now - fighter.fights[0].absWeek
        : now;
      if (!booking && fighter.status !== 'injured' && weeksSinceStart % WEEKLY_TRAINING_FREQUENCY === 0) {
        let existing;
        try { existing = await this.db.get('gameState', 'weeklyTrainingPrompt'); } catch { /* ok */ }
        if (!existing) {
          await this.db.put('gameState', { id: 'weeklyTrainingPrompt', active: true, absWeek: now });
        }
      }
    }

    // XP: treinar dá XP
    if (fighter) {
      const perkPtsBefore = fighter.perkPoints;
      const levelsUp = fighter.addXP(LEVEL_CONFIG.XP_PER_WEEK_TRAINED);
      if (levelsUp > 0) {
        const perkGained = fighter.perkPoints - perkPtsBefore;
        const bonusPts = perkGained > 0 ? ` +${perkGained} ponto(s) de perk!` : '';
        await this.notifService.add('success', '⬆️ Level Up!', `Treino semanal te levou ao Nv.${fighter.level}!${bonusPts}`);
      }
    }

    // P2.2: Staged injury recovery
    await this._processInjuryStages(fighter, now);

    // Fase 3 — sumir do mapa te torna um enigma de novo. É a única forma
    // gratuita de baixar a exposição, e ela cobra o preço mais alto do jogo:
    // não estar lutando.
    TapeService.decayIdle(fighter, now);

    await this._checkExpectations(now, fighter);

    const campResults = await this._applyWeeklyCamp(now, fighter);
    if (campResults.canceledFight) {
      const bookings = await this.offerService.getAccepted();
      const booking = bookings.find(b => b.fighterId === fighter.id);
      if (booking) {
        await this.offerService.cancelBooking(booking.id);
        await this.notifService.add('warning', 'Luta Cancelada', `Você se lesionou no treino pesado. A luta contra ${booking.opponentName} foi cancelada.`);
      }
    }

    const milestonesUnlocked = await this._checkMilestones(world.playerEvents, fighter);

    await this._generateHeadlines(now, world, fighter);
    await this._generateCallouts(now, fighter);

    // §D.2 — só lê `fighter` (id/status), nunca muta nem salva: os efeitos
    // de popularidade/moral só acontecem quando o jogador responde ao
    // prompt (resolveSocialPrompt), bem depois do save único deste método.
    // Atividade de lazer semanal (§PRD: vida fora do octógono)
    this._applyWeeklyActivity(fighter, now);

    if (fighter.status !== 'retired') {
      const bookings = await this.offerService.getAccepted();
      const hasBooking = bookings.some(b => b.fighterId === fighter.id);
      await this._rollSocialMediaPrompt(now, fighter, hasBooking);
    }

    // §D.3 — prompt semanal de rivalidade
    if (fighter.status !== 'retired') {
      let activePrompt = await this.db.get('gameState', 'rivalry-prompt');
      if (activePrompt?.expiresAbsWeek != null && activePrompt.expiresAbsWeek <= now) {
        await this.db.delete('gameState', 'rivalry-prompt');
        activePrompt = null;
      }
      if (!activePrompt) {
        const rivalries = await this.rivalryService.getRivalries(fighter.id);
        const topRivalry = pickTopRandom(rivalries, r => r.intensity);
        if (topRivalry && topRivalry.intensity >= 3) {
          const rivalId = topRivalry.fighterAId === fighter.id ? topRivalry.fighterBId : topRivalry.fighterAId;
          const rival = await this.fighterCtrl.getFighter(rivalId);
          if (rival) {
            const interaction = this.rivalryService.rollInteraction(fighter, rival);
            if (interaction) {
              interaction.rivalryId = topRivalry.id;
              interaction.rivalFighterId = rivalId;
              interaction.createdAbsWeek = now;
              interaction.expiresAbsWeek = now + RIVALRY_CONFIG.INTERACTION_PROMPT_EXPIRY_WEEKS;
              await this.db.put('gameState', { id: 'rivalry-prompt', ...interaction });
              await this.notifService.add('warning', '⚔️ Rivalidade', `${rival.name} está provocando você. Como reagir?`);
            }
          }
        }
      }
    }

    // Fase 1: Evento narrativo semanal (a cada ~5 semanas)
    if (now % 5 === 0 && fighter.status !== 'retired') {
      let narrativePrompt;
      try { narrativePrompt = await this.db.get('gameState', 'narrative-prompt'); } catch { /* ok */ }
      if (!narrativePrompt) {
        const narrativeEvent = this.careerLogService.selectNarrativeEvent(fighter);
        if (narrativeEvent) {
          const choices = narrativeEvent.choices.map((c, i) => ({
            ...c,
            key: `n_${i}`,
          }));
          await this.db.put('gameState', {
            id: 'narrative-prompt',
            prompt: narrativeEvent.prompt,
            choices,
            createdAbsWeek: now,
          });
          await this.notifService.add('headline', '📰 Momento da Carreira', narrativeEvent.prompt);
        }
      }
    }

    fighter.checkNumericDiscovery(); // §B.1 — idempotente, roda toda semana

    if (this.careerLogService) {
      for (const trait of fighter.discoveredTraits) {
        if (preDiscoveredTraits.has(trait)) continue;
        await this.careerLogService.publish(fighter.id, 'dna_discovered', now, DNA_DISCOVERY_MAGNITUDE[trait] ?? 55, {
          trait, traitLabel: DNA_TRAIT_NAMES[trait] || trait,
        });
      }
    }

    await this.fighterCtrl.updateFighter(fighter);

    if (fighter.cash < 0) {
      await this.notifService.add('warning', '⚠️ Caixa Negativo', 'Suas finanças estão no vermelho. Aceite lutas ou reduza o padrão de vida antes que as contas atrasem.');
    }

    const state = await this.seasonService.commitWeekAdvance(nextWeekState.week, nextWeekState.year);

    return { state, now, world, offersCreated, economy, milestonesUnlocked, campResults, sponsorActivity };
  }

  // ===== Simulação de período (fast-forward) =====
  async simulateWeeks(count, options = {}) {
    const { trainingFocus = null } = options;

    if (trainingFocus) {
      const fighter = await this.getPlayerFighter();
      fighter.trainingFocus = trainingFocus;
      await this.fighterCtrl.updateFighter(fighter);
    }

    const startFighter = await this.getPlayerFighter();
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
          // Estado ATUAL, não o snapshot de antes do loop: lesão ou booking
          // podem ter surgido durante o próprio fast-forward.
          const current = await this.getPlayerFighter();
          const accepted = await this.offerService.getAccepted();
          const hasBooking = accepted.some(b => b.fighterId === current.id);
          if (current.status !== 'injured' && !hasBooking) {
            // Uma luta por vez: aceita só a melhor oferta (getPending ordena
            // por bolsa); as demais ficam pendentes até expirar ou vagar agenda.
            await this.offerService.accept(pendingOffers[0].id, summary.now);
            offersAccepted++;
          }
        }

        const sponsorState = await this.sponsorService.getState();
        for (const sOffer of sponsorState.offers) {
          await this.acceptSponsorOffer(sOffer.id);
        }

        // §D.2 — sem isto, prompts de rede social só são criados aqui (dentro
        // do processWeek compartilhado) mas nunca resolvidos durante Simular
        // Período (resolveSocialPrompt só era chamado por clique em app.js).
        // Ficavam pendentes até expirar (PROMPT_EXPIRY_WEEKS) sem nunca gerar
        // efeito — e sem 'provocation' nenhuma publicada, cláusulas de imagem
        // de patrocínio (§E.2) nunca disparavam durante fast-forward.
        // 'stay_quiet' é o piloto automático: mesmo espírito de auto-aceitar
        // ofertas/patrocínios acima, mas sem risco (nenhuma outra opção é
        // estritamente "melhor" sem ler o contexto de rivalidade).
        await this.resolveSocialPrompt('stay_quiet');
        await this.resolveRivalryInteraction('ignore').catch(() => {});
        await this.resolveWeighIn(WEIGH_IN_CONFIG.AUTO_STRATEGY, summary.now, { auto: true }).catch(() => {});

        const simFighter = await this.getPlayerFighter();
        try {
          const doc = await this.db.get('gameState', `contract-offer-${simFighter.id}`);
          if (doc && doc.offers && doc.offers.length > 0) {
            // Tier 1 é melhor que tier 2/3; a ordenação inversa fazia o
            // fast-forward renovar na liga inferior mesmo com promoção na mesa.
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
              won,
              method: r.method,
              promoName: evt.event.promotionName,
              absWeek: summary.now,
            });
          }
        }
        milestonesUnlocked.push(...summary.milestonesUnlocked);
      }
    } finally {
      this.notifService.muted = false;
    }

    const endFighter = await this.getPlayerFighter();

    return {
      weeksSimulated,
      offersAccepted,
      cashDelta: endFighter.cash - startCash,
      popularityDelta: endFighter.popularity - startPopularity,
      winsDelta: endFighter.record.wins - startWins,
      lossesDelta: endFighter.record.losses - startLosses,
      fightResults,
      milestonesUnlocked,
      endFighter,
    };
  }

  // Economia pessoal (§A.2/§E.1/§PRD): despesas quebradas em categorias
  // individuais + serviços opcionais.
  _applyWeeklyEconomy(fighter, academy, now) {
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
      // Efeitos aplicados na _applyWeeklyServices()
    }

    const total = academyFee + lifestyle.weeklyCost + serviceTotal;
    return { expenses: { academyFee, rent, food, transport, leisure, services: serviceTotal, total }, income: { total: 0 }, net: -total };
  }

  // Aplica efeitos dos serviços opcionais contratados
  _applyWeeklyServices(fighter) {
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
  _applyWeeklyActivity(fighter, now) {
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

  // Treino semanal — foco individual, amplificado pela especialidade da
  // Academia atual (substitui COACH_CONFIG de hoje, que era contratação).
  async _applyWeeklyTraining(fighter, academy) {
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

  async _generateHeadlines(now, world, fighter) {
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

  async _generateCallouts(now, fighter) {
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

  // ===== Redes sociais em semana livre (§D.2) =====
  // Resolve QUEM é o rival ativo mais intenso (se houver) antes de rolar a
  // chance semanal — a opção de provocar só existe quando isso resolve para
  // um fighter de verdade. Só LÊ dados; quem muta/salva o fighter é
  // resolveSocialPrompt(), chamado depois pelo clique do jogador.
  async _rollSocialMediaPrompt(now, fighter, hasBooking) {
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

  // Resolve o prompt pendente com a escolha do jogador. Fetch-mutate-save
  // PRÓPRIO e isolado (busca o fighter fresco, muta, salva uma vez só) —
  // chamado direto por um clique do jogador (padrão idêntico a
  // accept/declineSponsorOffer), nunca de dentro de processWeek, então não
  // há risco do bug de "outro código já salvou uma instância mais nova".
  async resolveSocialPrompt(choice) {
    const fighter = await this.getPlayerFighter();
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

  // ===== Pesagem pré-luta =====
  // A pesagem pertence à reserva (FightOffer), não ao fighter: cada luta
  // pode ter uma estratégia diferente e o histórico da oferta permanece
  // explicável depois do evento.
  async _autoResolveDueWeighIn(absWeekNow, fighter) {
    if (!fighter) return null;
    const bookings = await this.offerService.getAccepted();
    const booking = bookings.find(b => b.fighterId === fighter.id);
    if (!booking || booking.weighIn?.completed || absWeekNow < booking.eventAbsWeek) return null;
    return this.resolveWeighIn(WEIGH_IN_CONFIG.AUTO_STRATEGY, absWeekNow, { auto: true });
  }

  async resolveWeighIn(strategyId, absWeekNow = null, { auto = false } = {}) {
    const fighter = await this.getPlayerFighter();
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
        0,
        1
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
      completed: true,
      strategyId,
      strategyLabel: strategy.label,
      impactMultiplier,
      fatigueDelta: fatigueDelta || 0,
      moraleDelta: moraleDelta || 0,
      outcome,
      resolvedAbsWeek: now,
      auto,
    };

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

  // ===== Rivalidade: resolve a escolha do jogador no prompt semanal =====
  async resolveRivalryInteraction(choice) {
    const fighter = await this.getPlayerFighter();
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
  async resolveNarrativeChoice(choiceKey) {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };

    let promptData;
    try { promptData = await this.db.get('gameState', 'narrative-prompt'); } catch { /* ok */ }
    if (!promptData) return { ok: false, reason: 'Nenhum evento narrativo pendente.' };

    const choice = promptData.choices.find(c => c.key === choiceKey);
    if (!choice) return { ok: false, reason: 'Escolha inválida.' };

    // Aplica os efeitos
    const effects = choice.effects || {};
    const logParts = [];
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
        default:
          // Atributo do lutador (ex: composure, power, awareness, discipline)
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

    const seasonState = await this.seasonService.getState();
    const now = absWeek(seasonState);
    if (this.careerLogService) {
      await this.careerLogService.publish(fighter.id, 'narrative_choice', now, 35, {
        prompt: promptData.prompt.slice(0, 80),
        choice: choice.text,
        effects: logParts.join(', '),
      });
    }

    return { ok: true, choice: choice.text, effects: logParts };
  }

  // ===== Treino Semanal: resolve a escolha do jogador =====
  async resolveWeeklyTraining(choiceKey) {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };

    let prompt;
    try { prompt = await this.db.get('gameState', 'weeklyTrainingPrompt'); } catch { /* ok */ }
    if (!prompt || !prompt.active) return { ok: false, reason: 'Nenhum prompt de treino semanal pendente.' };

    const cfg = WEEKLY_TRAINING_CHOICES[choiceKey];
    if (!cfg) return { ok: false, reason: 'Escolha de treino inválida.' };

    const academy = await this.getAcademy(fighter.academyId);
    const teammates = await this.partnersService.getTeammates(fighter);

    const result = WeeklyTrainingController.applyChoice(fighter, choiceKey, academy, teammates);
    if (!result) return { ok: false, reason: 'Falha ao aplicar treino semanal.' };

    await this.fighterCtrl.updateFighter(fighter);
    await this.db.delete('gameState', 'weeklyTrainingPrompt');

    const seasonState = await this.seasonService.getState();
    const now = absWeek(seasonState);
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

  async _checkExpectations(now, fighter) {
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

  async _applyWeeklyCamp(absWeekNow, fighter) {
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
        // Prontidão (item 4): semana de camp COM luta marcada acumula pontos
        // de prontidão (por intensidade, teto em READINESS_CONFIG.CAMP_CAP).
        const perWeek = READINESS_CONFIG.CAMP_PER_WEEK[intensity] || 0;
        fighter.campReadinessPoints = Math.min(
          READINESS_CONFIG.CAMP_CAP,
          (fighter.campReadinessPoints || 0) + perWeek
        );
      }
    } catch { /* sem luta marcada */ }

    // A academia entra aqui porque é ela que define quais armas existem pra
    // você e o quão rápido você as instala (§Fase 3). E a sala de treino deixa
    // de ser um `[]` — o `team` sempre foi um parâmetro real que nunca recebeu
    // ninguém (§Fase 3b).
    const academy = await this.getAcademy(fighter.academyId);
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

    // Prof Gains: notificar ganhos de proficiência do camp
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

  async setTrainingFocus(focus) {
    if (!TRAINING_FOCUS_META[focus]) return null;
    const fighter = await this.getPlayerFighter();
    if (!fighter) return null;
    fighter.trainingFocus = focus;
    await this.fighterCtrl.updateFighter(fighter);
    return fighter;
  }

  // ===== Preparação: scouting e plano de jogo =====
  async studyOpponent(fighterId) {
    const fighter = await this.getPlayerFighter();
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

  async setGamePlan(offerId, plan) {
    if (!GAME_PLANS[plan]) return { ok: false, reason: 'Plano inválido.' };
    const data = await this.db.get('offers', offerId);
    if (!data) return { ok: false, reason: 'Luta não encontrada.' };

    const offer = new FightOffer(data);
    offer.gamePlan = plan;
    // Prontidão (item 4): escolher o plano NA TELA pontua — o 'balanced'
    // silencioso do autopilot não.
    offer.planConfirmed = true;
    // Trocar de plano invalida a isca: iscar é trazer o OPOSTO da sua
    // assinatura. Deixar a flag ligada depois de mudar o plano poderia gerar
    // uma "isca" com a própria assinatura — que não engana ninguém.
    offer.bait = false;
    await this.db.put('offers', offer);
    return { ok: true, plan };
  }

  // ===== Fase 3b — o dilema do companheiro =====
  // Não existe escolha limpa aqui, e é esse o ponto. Aceitar rende a luta (e
  // ela costuma ser a boa: a promoção não oferece o seu parceiro à toa).
  // Recusar preserva a pessoa e custa a oportunidade.
  async acceptOffer(offerId, absWeekNow) {
    const fighter = await this.getPlayerFighter();
    const data = await this.db.get('offers', offerId);
    const teammate = data ? await this.partnersService.isTeammate(fighter, data.opponentId) : null;

    // `accept` devolve null quando a oferta não está mais pendente. Sem esta
    // guarda, o vínculo com o parceiro seria destruído por uma luta que nem
    // chegou a ser marcada.
    const result = await this.offerService.accept(offerId, absWeekNow);
    if (!result) return null;

    if (teammate) {
      await this.partnersService.breakBond(fighter, teammate.id, absWeekNow);
      await this.fighterCtrl.updateFighter(fighter);
    }
    return result;
  }

  // Recusar por lealdade não é de graça: a promoção segue procurando outro. Mas
  // o vínculo sobrevive — e um parceiro que sabe que você recusou lutar contra
  // ele treina diferente com você.
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

  // Fase 3 — a isca. Só existe se você tem uma reputação pra fingir e o plano
  // escolhido não é ela. Iscar quem não te leu é jogar fora a assinatura de
  // graça, mas o jogo não impede: essa é a decisão do jogador, não do sistema.
  async setBait(offerId, on) {
    const fighter = await this.getPlayerFighter();
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

  async opponentDossier(offer) {
    const fighter = await this.getPlayerFighter();
    const opponent = await this.fighterCtrl.getFighter(offer.opponentId);
    if (!opponent) return null;

    const manager = fighter.managerId ? await this.managerService.getManager(fighter.managerId) : null;
    const hasBaseline = this.managerService.givesBaselineScouting(manager);
    const level = await this.scoutingService.knowledgeOf(opponent, fighter.id, hasBaseline);
    // Bônus temporário de scouting do camp (spec "study")
    const scoutingBoost = fighter.scoutingBoost || 0;
    if (scoutingBoost > 0) {
      fighter.scoutingBoost = 0; // consome o bônus
      await this.fighterCtrl.updateFighter(fighter);
    }
    const effectiveLevel = Math.min(3, level + scoutingBoost);
    const nextCost = level < 3 ? this.scoutingService.studyCost(level + 1) : null;

    // Seed estável pra erros factuais de scouting (mesma oferta = mesmos erros)
    const seed = [...offer.id].reduce((s, c) => s + c.charCodeAt(0), 0);

    return {
      opponent,
      level: effectiveLevel, // nível efetivo (com bônus)
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
      theirRead: await this._theirRead(fighter, opponent, offer, level),
    };
  }

  // Fase 3 — o espelho: "o que eles sabem sobre você". A informação passa pela
  // MESMA névoa do scouting, o que transforma empresário e academia em
  // contra-inteligência: o quanto você sabe do que eles sabem.
  //
  // A predição é embaralhada por um seed estável (o id da oferta), não por
  // Math.random(): sem isso o jogador re-renderizaria a tela até a predição
  // sair do jeito que ele quer, e a névoa não custaria nada.
  async _theirRead(fighter, opponent, offer, level) {
    let rivalryIntensity = 0;
    try {
      const rivalries = await this.rivalryService.getRivalries(fighter.id);
      rivalryIntensity = rivalries.find(r => r.fighterAId === opponent.id || r.fighterBId === opponent.id)?.intensity || 0;
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

    // Bônus de estratégia do camp — reduz chance de erro em 1 nível
    const strategyBonus = fighter.campStrategyBonus || 0;
    if (strategyBonus > 0) {
      fighter.campStrategyBonus = 0; // consome o bônus
      await this.fighterCtrl.updateFighter(fighter);
    }
    const effectiveLevel = Math.min(3, level + strategyBonus);

    // Sem ter estudado nada, você não faz ideia do que o córner dele preparou.
    if (effectiveLevel === 0) return { ...base, predictedPlanKey: null, reliable: false };

    // Nível 1: a leitura existe, mas sua equipe erra. Um plano errado aqui é
    // pior que nenhum — é nele que você vai basear a isca.
    const seed = [...offer.id].reduce((s, c) => s + c.charCodeAt(0), 0);
    const misread = effectiveLevel === 1 && seed % 3 === 0;
    const alternatives = Object.keys(GAME_PLANS).filter(k => k !== truth.planKey);
    const predicted = misread ? alternatives[seed % alternatives.length] : truth.planKey;

    return { ...base, predictedPlanKey: predicted, reliable: effectiveLevel >= 2 };
  }

  // Define atividade de lazer da semana (§PRD: vida fora do octógono)
  async setWeeklyActivity(activityKey) {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    if (activityKey && !WEEKLY_ACTIVITIES[activityKey]) return { ok: false, reason: 'Atividade inválida.' };
    fighter.weeklyActivity = activityKey || null;
    await this.fighterCtrl.updateFighter(fighter);
    return { ok: true };
  }

  // ===== Negociação de bolsa (usa modificadores do empresário, §C.1) =====
  async negotiateOffer(offerId, bumpIndex) {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    const academy = await this.getAcademy(fighter.academyId);
    const manager = fighter.managerId ? await this.managerService.getManager(fighter.managerId) : null;
    const mods = this.managerService.negotiationModifiers(manager);
    return await this.offerService.negotiate(offerId, bumpIndex, fighter, academy?.reputation ?? 30, mods);
  }

  // ===== Patrocínios =====
  async acceptSponsorOffer(offerId) {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };
    const state = await this.seasonService.getState();
    return await this.sponsorService.accept(offerId, absWeek(state), fighter.record.wins);
  }

  async declineSponsorOffer(offerId) {
    return await this.sponsorService.decline(offerId);
  }

  // ===== Objetivos =====
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

  async _checkMilestones(playerEvents, fighter) {
    const state = await this.db.get('gameState', 'milestones') || {};
    state.id = 'milestones';
    const unlocked = [];
    const bump = (id, value, max) => {
      const prev = state[id] || 0;
      if (prev >= max) return;
      state[id] = value;
      if (value >= max) unlocked.push(id);
    };

    for (const evt of playerEvents) {
      for (const r of evt.playerResults) {
        const playerIsA = evt.playerFighterIds.has(r.fighterAId);
        const playerId = playerIsA ? r.fighterAId : r.fighterBId;
        const won = r.winnerId === playerId;
        const isFinish = r.method && !r.method.startsWith('Decision');

        bump('firstFight', 1, 1);
        if (won) {
          bump('firstWin', 1, 1);
          if (isFinish) bump('firstFinish', 1, 1);
        }
        if (evt.event.tier === 2) bump('firstTier2', 1, 1);
        if (evt.event.tier === 1) bump('firstTier1', 1, 1);

        if (r.isTitleFight) {
          bump('firstTitleShot', 1, 1);
          if (won) {
            if (r.titleRetained) bump('firstDefense', 1, 1);
            else bump('firstBelt', 1, 1);
            if (evt.event.tier === 1) bump('worldChampion', 1, 1);
          }
        }
      }
    }

    bump('fiveWins', Math.min(fighter.record.wins, 5), 5);
    bump('tenWins', Math.min(fighter.record.wins, 10), 10);
    bump('popularity50', Math.min(fighter.popularity, 50), 50);
    bump('popularity80', Math.min(fighter.popularity, 80), 80);

    await this.db.put('gameState', state);
    return unlocked;
  }

  // ===== Contrato exclusivo com conflito de cinturão (Épico B/C) =====
  // Verifica se o lutador segura cinturão em promoção diferente da que
  // está assinando. Se sim, o jogador precisa escolher entre vacar o
  // título e subir, ou adiar o contrato.
  // Compara por promotionId, não pelo nome de exibição: nome é string de UI
  // (frágil a rename/acento) e não identifica a promoção de forma confiável.
  async getSigningConflict(fighterId, promoId) {
    const belts = await this.titleService.beltsOf(fighterId);
    const otherBelts = belts.filter(b => b.promotionId !== promoId);
    return otherBelts.length > 0 ? otherBelts : null;
  }

  // Assina o contrato, vaga os cinturões das OUTRAS promoções (mantém o da
  // promoção assinada, se houver) e cancela ofertas de luta concorrentes.
  // Retorna { fighter, vacated, cancelledOffers }.
  async signContractWithVacate(fighterId, promoId, absWeekNow) {
    const fighter = await this.fighterCtrl.getFighter(fighterId);
    const vacated = await this.titleService.vacateBeltsOf(fighterId, promoId);
    const result = await this.contractService.accept(fighterId, promoId, absWeekNow);
    const cancelledOffers = await this.offerService.cancelOffersNotFrom(fighterId, promoId);

    for (const v of vacated) {
      await this.notifService.add(
        'warning',
        'Cinturão Vagado',
        `${fighter?.name || 'Atleta'} abdicou do cinturão ${v.weightClass} do ${v.promotionShort} para assinar contrato exclusivo.`
      );
    }

    return { fighter: result, vacated, cancelledOffers };
  }

  // ===== Calendário visual (§F.7) =====
  async getCalendarData() {
    const fighter = await this.getPlayerFighter();
    if (!fighter) return null;

    const season = await this.seasonService.getState();
    const now = absWeek(season);

    const bookings = await this.offerService.getAccepted();
    const booking = bookings.find(b => b.fighterId === fighter.id);
    const promotions = await this.worldService.getPromotions();

    const entries = [];
    const lookahead = 26;
    // Algumas semanas passadas entram no início da timeline — sem elas, o
    // loop começava em `now` e `isPastWeek` nunca era verdade, deixando o
    // estilo "passado com opacidade" como código morto.
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
          details = `Evento ${promo.short}`; // Promotion expõe `short`, não `shortName`
        }
      }

      entries.push({
        absWeek: w, weekType, label, icon, details,
        isFightWeek: weekType === 'fight' || weekType === 'title_fight',
        isCurrentWeek: w === now, isPastWeek: w < now,
      });
    }

    return {
      currentWeek: now,
      entries,
      upcomingFight: booking ? {
        opponentName: booking.opponentName,
        promotionName: booking.promotionName,
        absWeek: booking.eventAbsWeek,
        isTitleFight: !!booking.isTitleFight,
      } : null,
    };
  }

  // ===== P2.2: Staged injury recovery =====
  async _processInjuryStages(fighter, absWeekNow) {
    if (!fighter.injury || !fighter.injury.stage) return;

    const injury = fighter.injury;

    if (injury.stage === 'rest' && absWeekNow >= injury.restUntilAbsWeek) {
      // Rest stage complete — move to rehab stage
      injury.stage = 'rehab';
      injury.rehabEndAbsWeek = absWeekNow + INJURY_CONFIG.REHAB_FREE_WEEKS;
      await this.notifService.add('injury', 'Lesão em recuperação',
        'Sua lesão entrou na fase de reabilitação. Você pode escolher entre fisioterapia rápida (paga) ou gratuita (mais lenta) no painel principal.');
    }

    if (injury.stage === 'rehab' && injury.rehabChosen && absWeekNow >= injury.rehabEndAbsWeek) {
      // Rehab complete — move to return stage
      injury.stage = 'return';
      injury.restUntilAbsWeek = absWeekNow + INJURY_CONFIG.RETURN_WEEKS;
      fighter.status = 'active';
      await this.notifService.add('injury', 'Retorno gradual',
        'Você está liberado para treinar, mas com intensidade reduzida.');
    }

    if (injury.stage === 'return' && absWeekNow >= (injury.restUntilAbsWeek || 0)) {
      // Fully healed
      fighter.injury = null;
      fighter.status = 'active';
      await this.notifService.add('info', 'Recuperado',
        'Você está 100% recuperado da lesão.');
    }
  }

  // ===== P2.2: Resolve rehab choice =====
  async resolveRehabChoice(choiceKey) {
    const fighter = await this.getPlayerFighter();
    if (!fighter?.injury || fighter.injury.stage !== 'rehab' || fighter.injury.rehabChosen) {
      return { ok: false, reason: 'Nenhuma escolha de reabilitação pendente.' };
    }

    const state = await this.seasonService.getState();
    const now = absWeek(state);

    if (choiceKey === 'fast') {
      const cost = INJURY_CONFIG.REHAB_FAST_COST * INJURY_CONFIG.REHAB_FAST_WEEKS;
      if (fighter.cash < cost) {
        return { ok: false, reason: `Você precisa de $${cost} para fisioterapia rápida.` };
      }
      fighter.cash -= cost;
      fighter.injury.rehabEndAbsWeek = now + INJURY_CONFIG.REHAB_FAST_WEEKS;
      fighter.injury.rehabCost = cost;
      fighter.addTransaction(now, 'Fisioterapia rápida', -cost);
    } else {
      // Free rehab — already set in _processInjuryStages
      fighter.injury.rehabEndAbsWeek = fighter.injury.rehabEndAbsWeek || (now + INJURY_CONFIG.REHAB_FREE_WEEKS);
    }

    fighter.injury.rehabChosen = true;
    await this.fighterCtrl.updateFighter(fighter);
    // Clear pending signal
    try { await this.db.delete('gameState', 'rehabChoicePrompt'); } catch { /* ok */ }

    const weeks = choiceKey === 'fast' ? INJURY_CONFIG.REHAB_FAST_WEEKS : INJURY_CONFIG.REHAB_FREE_WEEKS;
    return {
      ok: true,
      choice: choiceKey,
      rehabWeeks: weeks,
      cost: choiceKey === 'fast' ? INJURY_CONFIG.REHAB_FAST_COST * INJURY_CONFIG.REHAB_FAST_WEEKS : 0,
    };
  }

  // ===== Dashboard =====
  async getDashboard() {
    const fighter = await this.getPlayerFighter();
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
            careerLog: null, // careerLog pode ser passado se disponível
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
            key,
            label: strategy.label,
            description: strategy.description,
          })),
        }
      : null;

    let rivalryPrompt = null;
    try { const rp = await this.db.get('gameState', 'rivalry-prompt'); if (rp?.choices) rivalryPrompt = rp; } catch { /* ok */ }

    let narrativePrompt = null;
    try { const np = await this.db.get('gameState', 'narrative-prompt'); if (np?.choices) narrativePrompt = np; } catch { /* ok */ }

    let weeklyTrainingPrompt = null;
    try { const wtp = await this.db.get('gameState', 'weeklyTrainingPrompt'); if (wtp?.active) weeklyTrainingPrompt = wtp; } catch { /* ok */ }

    // P2.2: rehab choice pending
    const pendingRehab = fighter?.injury?.stage === 'rehab' && !fighter.injury.rehabChosen;

    // Prontidão (item 4) — resumo pro dashboard quando há luta marcada.
    // Mesma conta da simulação; prontidão do adversário exige scouting 1+.
    let readiness = null;
    if (playerBooking && fighter) {
      const hasBaseline = this.managerService.givesBaselineScouting(manager);
      const opponent = await this.fighterCtrl.getFighter(playerBooking.opponentId);
      const level = opponent ? await this.scoutingService.knowledgeOf(opponent, fighter.id, hasBaseline) : 0;
      const p = ReadinessService.playerReadiness(fighter, playerBooking, level);
      const ai = ReadinessService.aiReadiness(playerBooking.tier, !!playerBooking.isTitleFight, `${playerBooking.id}-${playerBooking.opponentId}`);
      readiness = {
        player: p.total,
        parts: p.parts,
        opponentKnown: level >= 1,
        opponent: level >= 1 ? ai : null,
        opponentLabel: level >= 1 ? ReadinessService.label(ai) : null,
      };
    }

    return {
      fighter,
      academy,
      manager,
      belts,
      contenderStatus: contenderStatus && !contenderStatus.isChampion ? contenderStatus : null,
      pendingOffers,
      bookings,
      promotions,
      pastEvents,
      milestones,
      champions,
      rankings,
      sponsors,
      socialPrompt,
      rivalryPrompt,
      narrativePrompt,
      weeklyTrainingPrompt,
      pendingRehab,
      weighInPrompt,
      readiness,
      state,
      now,
    };
  }

  // P4.3: Encontra a oferta de luta correspondente a um resultado
  async _findFightOffer(fighterId, opponentId) {
    const all = await this.db.getAll('offers');
    return all.find(o =>
      o.fighterId === fighterId &&
      (o.opponentId === opponentId) &&
      (o.status === 'completed' || o.status === 'accepted' || o.status === 'cancelled')
    );
  }

  // P4.3: Mudança de peso — sobe ou desce uma categoria.
  // Exige lealdade mínima, tem lockout de 8 semanas.
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

    // Verifica lockout de mudança de peso
    if (fighter.weightMoveLockedUntilAbsWeek && fighter.weightMoveLockedUntilAbsWeek > absWeekNow) {
      return { ok: false, reason: `Você mudou de peso recentemente. Aguarde ${fighter.weightMoveLockedUntilAbsWeek - absWeekNow} semana(s).` };
    }

    // Verifica se tem contrato ativo e precisa de permissão da promoção
    if (fighter.promotionContract?.status === 'active' && fighter.promotionContract.titleClause && fighter.weightClass !== newWeightClass) {
      // Com title clause ativa, mudar de peso pode significar vagar cinturão
      const belts = await this.titleService.beltsOf(fighterId);
      const currentBelt = belts.find(b => b.weightClass === fighter.weightClass);
      if (currentBelt) {
        // Vaga o cinturão atual
        await this.titleService.vacateBeltsOf(fighterId);
        await this.notifService.add('warning', 'Cinturão Vagado',
          `Você abdicou do cinturão ${fighter.weightClass} para mudar de divisão.`);
      }
    }

    // Registra o peso anterior antes de trocar
    if (!fighter.originalWeightClass) {
      fighter.originalWeightClass = fighter.weightClass;
    }
    fighter.weightClass = newWeightClass;
    fighter.weightMoveLockedUntilAbsWeek = absWeekNow + OFFER_CONFIG.WEIGHT_MOVE.RECOMMIT_WEEKS;

    await this.fighterCtrl.updateFighter(fighter);

    if (this.careerLogService) {
      await this.careerLogService.publish(fighter.id, 'weight_change', absWeekNow, 60, {
        from: fighter.originalWeightClass,
        to: newWeightClass,
      });
    }

    await this.notifService.add('success', 'Mudança de Peso',
      `Você mudou para ${newWeightClass}. Esta decisão está travada por ${OFFER_CONFIG.WEIGHT_MOVE.RECOMMIT_WEEKS} semanas.`);

    return { ok: true, newWeightClass };
  }
}
