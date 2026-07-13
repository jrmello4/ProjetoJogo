import { Academy } from '../models/academy.js';
import { Promotion } from '../models/promotion.js';
import { Fighter } from '../models/fighter.js';
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
import { RetentionService } from '../services/retention-service.js';
import { ManagerService } from '../services/manager-service.js';
import { CareerLogService } from '../services/career-log-service.js';
import { FightOffer } from '../models/fight-offer.js';
import { generateId, clamp } from '../utils/helpers.js';
import { TrainingCamp } from './training-camp.js';
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
  absWeek,
} from '../config/game-config.js';

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
    this.retentionService = null;
    this.managerService = null;
    this.careerLogService = null;
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
    this.managerService = new ManagerService(this.db, this.notifService);
    this.retentionService = new RetentionService(this.db, this.fighterCtrl, this.notifService, this.titleService, this.managerService);
    this.worldService = new WorldService(this.db, this.fighterCtrl, this.notifService, this.titleService, this.scoutingService, this.contractService, this.managerService, this.careerLogService);
    this.offerService = new OfferService(this.db, this.fighterCtrl, this.notifService, this.titleService, this.contractService);
    this.sponsorService = new SponsorService(this.db, this.notifService, this.careerLogService);

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
    try { localStorage.removeItem('characterCreationDone'); } catch (e) { /* ambientes sem localStorage */ }

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

    // Agentes livres recrutáveis (adversários de IA sem promoção ainda)
    for (let i = 0; i < WORLD_CONFIG.FREE_AGENT_POOL; i++) {
      const weightClass = CORE_WEIGHT_CLASSES[i % CORE_WEIGHT_CLASSES.length];
      const agent = DataGenerator.generateFighter(null, { weightClass, skillRange: [30, 55] });
      agent.id = generateId();
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
  async createPlayerFighter({ name, weightClass, archetype, origin, difficultyId, academyId }) {
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
    const result = await this.managerService.hire(fighter, managerId);
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
    const preFightId = (await this.getPlayerFighter()).id;

    const world = await this.worldService.processWeek(now, nextWeekState.startedAt, preFightId, cornerHooks);

    // Rebusca DEPOIS do tick do mundo — WorldService busca e salva sua
    // PRÓPRIA instância do lutador ao resolver a luta (record, popularidade,
    // caixa, lesão, descobertas de DNA...). Continuar mutando o `fighter`
    // buscado ANTES da luta e salvá-lo no fim deste método sobrescrevia
    // tudo isso com o estado pré-luta — a luta "acontecia" mas o resultado
    // nunca sobrevivia ao fim da semana. Bug real, achado testando ao vivo.
    const fighter = await this.getPlayerFighter();
    const academy = await this.getAcademy(fighter.academyId);

    await this.offerService.expireOld(now);
    const promotions = await this.worldService.getPromotions();
    const manager = fighter.managerId ? await this.managerService.getManager(fighter.managerId) : null;
    const negotiationMods = this.managerService.negotiationModifiers(manager);
    const offersCreated = fighter.status !== 'retired'
      ? await this.offerService.generateWeekly(now, fighter, academy?.reputation ?? 30, promotions)
      : [];

    if (fighter.status !== 'retired') {
      await this.contractService.generateOffers(fighter, now, academy?.reputation ?? 30);
    }

    const economy = this._applyWeeklyEconomy(fighter, academy, now);
    const sponsorActivity = await this.sponsorService.processWeek(now, fighter);
    await this._applyWeeklyTraining(fighter, academy);

    const retentionResolutions = await this.retentionService.processWeek(now, fighter);
    await this.retentionService.generateApproaches(now, fighter);

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

    fighter.checkNumericDiscovery(); // §B.1 — idempotente, roda toda semana

    await this.fighterCtrl.updateFighter(fighter);

    if (fighter.cash < 0) {
      await this.notifService.add('warning', '⚠️ Caixa Negativo', 'Suas finanças estão no vermelho. Aceite lutas ou reduza o padrão de vida antes que as contas atrasem.');
    }

    const state = await this.seasonService.commitWeekAdvance(nextWeekState.week, nextWeekState.year);

    return { state, now, world, offersCreated, economy, milestonesUnlocked, campResults, retentionResolutions, sponsorActivity };
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
        for (const offer of pendingOffers) {
          await this.offerService.accept(offer.id, summary.now);
          offersAccepted++;
        }

        const sponsorState = await this.sponsorService.getState();
        for (const sOffer of sponsorState.offers) {
          await this.acceptSponsorOffer(sOffer.id);
        }

        const simFighter = await this.getPlayerFighter();
        try {
          const doc = await this.db.get('gameState', `contract-offer-${simFighter.id}`);
          if (doc && doc.offers && doc.offers.length > 0) {
            doc.offers.sort((a, b) => b.tier - a.tier || b.basePurse - a.basePurse);
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

  // Economia pessoal (§A.2/§E.1): mensalidade da academia + custo de vida.
  _applyWeeklyEconomy(fighter, academy, now) {
    const academyFee = academy?.weeklyFee || 0;
    const lifestyle = LIFESTYLE_TIERS[fighter.lifestyleTier] || LIFESTYLE_TIERS.modest;
    const total = academyFee + lifestyle.weeklyCost;

    if (academyFee > 0) fighter.addTransaction(now, `Mensalidade — ${academy.name}`, -academyFee);
    if (lifestyle.weeklyCost > 0) fighter.addTransaction(now, `Custo de vida (${lifestyle.label})`, -lifestyle.weeklyCost);
    if (lifestyle.moraleBonus) fighter.morale = clamp(fighter.morale + Math.round(lifestyle.moraleBonus / 4), 0, 100);
    if (lifestyle.popularityBonus) fighter.updatePopularity(Math.round(lifestyle.popularityBonus / 4));

    return { expenses: { academyFee, lifestyle: lifestyle.weeklyCost, total }, income: { total: 0 }, net: -total };
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
      const gainChance = Math.min(0.9, 0.35 + (fighter.hidden.discipline / 100) * 0.4 + facilityBonus + specialtyBonus);
      for (const attr of meta.attrs) {
        if (Math.random() < gainChance) {
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
      }
    } catch { /* sem luta marcada */ }

    const result = TrainingCamp.processCamp(fighter, null, [], absWeekNow, opponentArchetype);
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
    await this.db.put('offers', offer);
    return { ok: true, plan };
  }

  async opponentDossier(offer) {
    const fighter = await this.getPlayerFighter();
    const opponent = await this.fighterCtrl.getFighter(offer.opponentId);
    if (!opponent) return null;

    const manager = fighter.managerId ? await this.managerService.getManager(fighter.managerId) : null;
    const hasBaseline = this.managerService.givesBaselineScouting(manager);
    const level = await this.scoutingService.knowledgeOf(opponent, fighter.id, hasBaseline);
    const nextCost = level < 3 ? this.scoutingService.studyCost(level + 1) : null;

    return {
      opponent,
      level,
      levelLabel: ScoutingService.levelLabel(level),
      nextCost,
      canAfford: nextCost != null && fighter.cash >= nextCost,
      attrs: {
        striking: ScoutingService.blur(opponent.strikingScore, level),
        grappling: ScoutingService.blur(opponent.grapplingScore, level),
        cardio: ScoutingService.blur(opponent.attributes.cardio, level),
        fightIQ: ScoutingService.blur(opponent.attributes.fightIQ, level),
        chin: ScoutingService.blur(opponent.attributes.chin, level),
      },
      tendencies: ScoutingService.readTendencies(opponent, level),
      dna: ScoutingService.revealsDna(level) ? opponent.dnaTraits : null,
    };
  }

  // ===== Negociação de bolsa (usa modificadores do empresário, §C.1) =====
  async negotiateOffer(offerId, bumpIndex) {
    const fighter = await this.getPlayerFighter();
    const academy = await this.getAcademy(fighter.academyId);
    const manager = fighter.managerId ? await this.managerService.getManager(fighter.managerId) : null;
    const mods = this.managerService.negotiationModifiers(manager);
    return await this.offerService.negotiate(offerId, bumpIndex, fighter, academy?.reputation ?? 30, mods);
  }

  // ===== Patrocínios =====
  async acceptSponsorOffer(offerId) {
    const fighter = await this.getPlayerFighter();
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
    const sponsors = await this.sponsorService.getState();

    const allFighters = await this.fighterCtrl.getAllFighters();
    const active = allFighters.filter(f => f.status !== 'retired');
    const rankings = RankingService.calculateRankings(active);
    const champions = RankingService.getChampions(rankings);

    const belts = fighter ? await this.titleService.beltsOf(fighter.id) : [];
    const contenderStatus = fighter ? await this.titleService.contenderStatusOf(fighter) : null;

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
      state,
      now: absWeek(state),
    };
  }
}
