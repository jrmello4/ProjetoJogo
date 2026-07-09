import { Gym } from '../models/gym.js';
import { Promotion } from '../models/promotion.js';
import { DB } from '../services/db.js';
import { DataGenerator } from '../services/data-generator.js';
import { RankingService } from '../services/ranking.js';
import { FighterController } from './fighter-controller.js';
import { EventController } from './event-controller.js';
import { SeasonService } from '../services/season-service.js';
import { NotificationService } from '../services/notification-service.js';
import { WorldService } from '../services/world-service.js';
import { OfferService } from '../services/offer-service.js';
import { RivalGymService } from '../services/rival-gym-service.js';
import { SponsorService } from '../services/sponsor-service.js';
import { TitleService } from '../services/title-service.js';
import { ScoutingService } from '../services/scouting-service.js';
import { ContractService } from '../services/contract-service.js';
import { RetentionService } from '../services/retention-service.js';
import { RivalGym } from '../models/rival-gym.js';
import { FightOffer } from '../models/fight-offer.js';
import { Fighter } from '../models/fighter.js';
import { generateId, clamp } from '../utils/helpers.js';
import { TrainingCamp } from './training-camp.js';
import {
  GYM_CONFIG,
  PROMOTIONS,
  RIVAL_GYMS,
  CORE_WEIGHT_CLASSES,
  WORLD_CONFIG,
  COACH_CONFIG,
  SCOUT_CONFIG,
  TRAINING_FOCUS_META,
  GAME_PLANS,
  CAMP_CONFIG,
  EXPECTATION_CONFIG,
  absWeek,
} from '../config/game-config.js';

const WORLD_MODE = 'gym';
// v3: ritmo realista de lutas (~3-4/ano), rosters maiores, patrocínios
const WORLD_SCHEMA = 3;

// Orquestrador do modo academia: o jogador é o treinador/dono de um gym;
// as promoções são IA e o mundo gira sozinho a cada semana.
export class GameController {
  constructor() {
    this.db = new DB();
    this.fighterCtrl = null;
    this.eventCtrl = null;
    this.seasonService = null;
    this.notifService = null;
    this.worldService = null;
    this.offerService = null;
    this.rivalGymService = null;
    this.sponsorService = null;
    this.titleService = null;
    this.scoutingService = null;
    this.contractService = null;
    this.retentionService = null;
  }

  async init() {
    await this.db.init();

    this.fighterCtrl = new FighterController(this.db);
    this.eventCtrl = new EventController(this.db);
    this.seasonService = new SeasonService(this.db);
    this.notifService = new NotificationService(this.db);
    this.titleService = new TitleService(this.db, this.fighterCtrl, this.notifService);
    this.scoutingService = new ScoutingService(this.db, this.notifService);
    this.contractService = new ContractService(this.db, this.fighterCtrl, this.notifService);
    this.retentionService = new RetentionService(this.db, this.fighterCtrl, this.notifService);
    this.worldService = new WorldService(this.db, this.fighterCtrl, this.notifService, this.titleService, this.scoutingService, this.contractService);
    this.offerService = new OfferService(this.db, this.fighterCtrl, this.notifService, this.titleService, this.contractService);
    this.rivalGymService = new RivalGymService(this.db, this.fighterCtrl, this.notifService, this.titleService, this.retentionService);
    this.sponsorService = new SponsorService(this.db, this.notifService);

    const meta = await this.db.get('gameState', 'meta');
    if (!meta || meta.mode !== WORLD_MODE || meta.schemaVersion !== WORLD_SCHEMA) {
      await this._bootstrapNewWorld();
    } else {
      await this._applyPatches(meta);
    }

    return await this.getGym();
  }

  // ===== Patches aditivos =====
  // Features novas que só adicionam campos não precisam recriar o mundo —
  // e portanto não custam a carreira do jogador. Cada patch roda uma vez.
  async _applyPatches(meta) {
    const applied = new Set(meta.patches || []);

    if (!applied.has('belts')) {
      await this.titleService.seedBelts();
      applied.add('belts');
    }

    // Épico B: atletas existentes começam sem contrato (nada a derivar)
    if (!applied.has('promotionContracts')) {
      const team = await this.getTeam();
      for (const fighter of team) {
        if (!fighter.promotionContract) {
          fighter.promotionContract = null;
          await this.fighterCtrl.updateFighter(fighter);
        }
      }
      applied.add('promotionContracts');
    }

    // Épico A: atletas existentes ganham loyalty e purseShare default
    if (!applied.has('retention')) {
      const team = await this.getTeam();
      for (const fighter of team) {
        fighter.loyalty = fighter.loyalty ?? 50;
        fighter.purseShare = fighter.purseShare ?? 0.8;
        fighter.promises = fighter.promises || [];
        await this.fighterCtrl.updateFighter(fighter);
      }
      const gym = await this.getGym();
      if (gym) {
        gym.trust = gym.trust ?? 50;
        await this.updateGym(gym);
      }
      applied.add('retention');
    }

    // Épico C: expandir atributos de 8 para 24 em saves existentes
    if (!applied.has('expandedAttributes')) {
      const team = await this.getTeam();
      for (const fighter of team) {
        const oldLen = Object.keys(fighter.attributes).length;
        fighter.attributes = Fighter.expandAttributes(fighter.attributes);
        if (Object.keys(fighter.attributes).length !== oldLen) {
          await this.fighterCtrl.updateFighter(fighter);
        }
      }
      applied.add('expandedAttributes');
    }


    // Fase 1: inicializa doc worldGen para rastrear regeneração do mundo
    if (!applied.has('worldRegen')) {
      const existing = await this.db.get('gameState', 'worldGen');
      if (!existing) {
        await this.db.put('gameState', { id: 'worldGen', lastGenAbsWeek: 0, totalGenerated: 0 });
      }
      applied.add('worldRegen');
    }
    if (applied.size !== (meta.patches || []).length) {
      await this.db.put('gameState', { ...meta, id: 'meta', patches: [...applied] });
    }

    // Épico D: resetar campProcessedThisWeek para todos no início de semana
    const allTeam = await this.getTeam();
    for (const f of allTeam) {
      if (f.campProcessedThisWeek) {
        f.campProcessedThisWeek = false;
        await this.fighterCtrl.updateFighter(f);
      }
    }
  }

  // ===== Bootstrap do mundo =====
  // Sem migração do modo antigo (organização): mundo novo, save novo.
  async _bootstrapNewWorld() {
    for (const store of ['fighters', 'organization', 'events', 'fights', 'rivalries', 'hallOfFame', 'notifications', 'offers']) {
      await this.db.clear(store);
    }
    // Mundo novo = onboarding de novo (nome da academia, dificuldade)
    try { localStorage.removeItem('gymOnboardingDone'); } catch (e) { /* ambientes sem localStorage */ }
    await this.db.put('gameState', {
      id: 'state',
      week: 1,
      year: 1,
      totalEvents: 0,
      startedAt: new Date().toISOString(),
    });
    await this.db.put('gameState', { id: 'milestones' });

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

    // Academias rivais — competem pelos mesmos agentes livres e podem
    // seduzir atletas insatisfeitos da sua equipe
    for (const cfg of RIVAL_GYMS) {
      const rival = new RivalGym({ ...cfg });
      await this.db.put('organization', rival);
    }

    // Agentes livres recrutáveis
    for (let i = 0; i < WORLD_CONFIG.FREE_AGENT_POOL; i++) {
      const weightClass = CORE_WEIGHT_CLASSES[i % CORE_WEIGHT_CLASSES.length];
      const agent = DataGenerator.generateFighter(null, { weightClass, skillRange: [30, 55] });
      agent.id = generateId();
      await this.db.put('fighters', agent);
    }

    // Equipe inicial: 3 prospectos em divisões distintas
    const divisions = [...CORE_WEIGHT_CLASSES].sort(() => Math.random() - 0.5).slice(0, GYM_CONFIG.STARTING_TEAM_SIZE);
    for (const weightClass of divisions) {
      const prospect = DataGenerator.generateProspect(weightClass);
      prospect.id = generateId();
      prospect.gymId = GYM_CONFIG.ID;
      prospect.gymJoinedAbsWeek = 1;
      prospect.status = 'gym';
      await this.db.put('fighters', prospect);
    }

    const gym = new Gym({});
    await this.db.put('gameState', gym);

    // O mundo já nasce com campeões — a escada precisa de um cume desde o dia 1
    await this.titleService.seedBelts();

    await this.db.put('gameState', {
      id: 'meta',
      mode: WORLD_MODE,
      schemaVersion: WORLD_SCHEMA,
      patches: ['belts'],
      createdAt: new Date().toISOString(),
    });

    // Primeiras ofertas: o jogador precisa ter uma decisão na mesa já no load
    await this._ensureInitialOffers(gym);
  }

  async _ensureInitialOffers(gym) {
    const team = await this.getTeam();
    const promotions = await this.worldService.getPromotions();
    for (let attempt = 0; attempt < 3; attempt++) {
      const created = await this.offerService.generateWeekly(1, gym, team, promotions);
      if (created.length > 0) break;
    }
  }

  // ===== Academia =====
  async getGym() {
    const data = await this.db.get('gameState', 'gym');
    return new Gym(data || {});
  }

  async updateGym(gym) {
    gym.id = 'gym'; // keyPath do store gameState — sem isso o put falha
    await this.db.put('gameState', gym);
  }

  async getTeam() {
    return await this.fighterCtrl.getTeam(GYM_CONFIG.ID);
  }

  recruitFee(fighter) {
    return GYM_CONFIG.RECRUIT_FEE_BASE + fighter.overallRating * GYM_CONFIG.RECRUIT_FEE_PER_OVR;
  }

  async recruitFighter(fighterId) {
    const gym = await this.getGym();
    const team = await this.getTeam();
    const fighter = await this.fighterCtrl.getFighter(fighterId);
    if (!fighter) return { ok: false, reason: 'Lutador não encontrado.' };

    if (team.length >= gym.maxTeamSize) {
      return { ok: false, reason: `Academia lotada (${gym.maxTeamSize} atletas). Dispense alguém ou expanda as instalações.` };
    }
    const fee = this.recruitFee(fighter);
    if (gym.cash < fee) {
      return { ok: false, reason: `Caixa insuficiente. A taxa de recrutamento é $${fee.toLocaleString()}.` };
    }

    const state = await this.seasonService.getState();
    gym.addTransaction(absWeek(state), `Recrutamento — ${fighter.name}`, -fee);
    await this.updateGym(gym);
    await this.fighterCtrl.recruitToGym(fighterId, GYM_CONFIG.ID, absWeek(state));

    return { ok: true, fee, fighter };
  }

  // ===== Tick semanal =====
  // Ordem importa: mundo gira -> ofertas expiram/chegam -> economia -> treino.
  // cornerHooks (opcional): instruções de córner ao vivo para a luta do
  // jogador nesta semana. Omitido durante simulateWeeks (fast-forward).
  async processWeek(cornerHooks = null) {
    const state = await this.seasonService.advanceWeek();
    const now = absWeek(state);
    const gym = await this.getGym();

    const world = await this.worldService.processWeek(now, state.startedAt, gym, cornerHooks);

    await this.offerService.expireOld(now);
    const team = await this.getTeam();
    const promotions = await this.worldService.getPromotions();
    const offersCreated = await this.offerService.generateWeekly(now, gym, team, promotions);

    // Épico B: geração de propostas de contrato para atletas elegíveis
    for (const fighter of team) {
      if (fighter.status !== 'gym' && fighter.status !== 'roster') continue;
      await this.contractService.generateOffers(fighter, now);
    }

    const economy = this._applyWeeklyEconomy(gym, team, now);

    // Patrocínios: pagamento semanal, metas batidas/perdidas, novas propostas
    const sponsorActivity = await this.sponsorService.processWeek(now, gym);

    await this._applyWeeklyTraining(team, gym);

    // Academias rivais disputam o mercado e podem seduzir atletas seus —
    // roda depois do treino pra refletir moral já atualizado da semana
    const teamAfterTraining = await this.getTeam();
    const rivalActivity = await this.rivalGymService.processWeek(now, gym, teamAfterTraining);

    // Épico A: processar retenção — approaches expirados e promessas vencidas
    await this.retentionService.processWeek(now, gym);

    // Épico F2: expectativas dos atletas
    await this._checkExpectations(now, teamAfterTraining);

    // Épico D: processar acampamento semanal (ganhos + riscos)
    const campResults = await this._applyWeeklyCamp(now, teamAfterTraining, gym);

    // Cancela lutas se lesão no camp aconteceu
    if (campResults.canceledFights.length > 0) {
      const bookings = await this.offerService.getAccepted();
      for (const cancel of campResults.canceledFights) {
        const booking = bookings.find(b => b.fighterId === cancel.fighterId);
        if (booking) {
          await this.offerService.cancelBooking(booking.id);
          await this.notifService.add(
            'warning',
            'Luta Cancelada',
            `${cancel.fighterName} lesionou-se no treino pesado. A luta contra ${cancel.opponentName} foi cancelada.`
          );
        }
      }
    }

    const milestonesUnlocked = await this._checkMilestones(world.playerEvents, gym);

    // Épico F3: gerar manchetes da semana
    await this._generateHeadlines(now, world, teamAfterTraining);
    // Épico F3: callouts de IA provocando atletas do jogador
    await this._generateCallouts(now, teamAfterTraining);

    await this.updateGym(gym);

    if (gym.cash < 0) {
      await this.notifService.add('warning', '⚠️ Caixa Negativo', 'A academia está no vermelho. Aceite lutas ou reduza a equipe antes que as portas fechem.');
    }

    return { state, now, world, offersCreated, economy, milestonesUnlocked, campResults, rivalActivity, sponsorActivity };
  }

  // ===== Simulação de período (fast-forward) =====
  // Roda N semanas em automático (sem instruções de córner) e devolve um
  // resumo agregado em vez de centenas de notificações individuais.
  // options.trainingFocus: se definido, aplica o mesmo foco a toda a equipe
  // durante o período (senão mantém o foco individual já escolhido de cada um).
  // Ofertas de luta são aceitas automaticamente — o jogador está "fora".
  async simulateWeeks(count, options = {}) {
    const { trainingFocus = null } = options;

    if (trainingFocus) {
      const team = await this.getTeam();
      for (const fighter of team) {
        fighter.trainingFocus = trainingFocus;
        await this.fighterCtrl.updateFighter(fighter);
      }
    }

    const startGym = await this.getGym();
    const startCash = startGym.cash;
    const startRep = startGym.reputation;
    const startWins = startGym.wins;
    const startLosses = startGym.losses;

    this.notifService.muted = true;
    const fightResults = [];
    const milestonesUnlocked = [];
    const poachedFighters = [];
    let weeksSimulated = 0;
    let offersAccepted = 0;
    let rivalSignings = 0;

    try {
      for (let i = 0; i < count; i++) {
        const summary = await this.processWeek();
        weeksSimulated++;

        // Aceita automaticamente as ofertas da semana — sem o jogador por
        // perto para decidir, a academia fecha o que aparecer.
        const pendingOffers = await this.offerService.getPending();
        for (const offer of pendingOffers) {
          await this.offerService.accept(offer.id, summary.now);
          offersAccepted++;
        }

        // Patrocínios também fecham sozinhos — renda sem contrapartida
        const sponsorState = await this.sponsorService.getState();
        for (const sOffer of sponsorState.offers) {
          await this.acceptSponsorOffer(sOffer.id);
        }

        // Épico B: aceitar automaticamente a melhor proposta de contrato durante simulação
        const simTeam = await this.getTeam();
        for (const fighter of simTeam) {
          try {
            const doc = await this.db.get('gameState', `contract-offer-${fighter.id}`);
            if (doc && doc.offers && doc.offers.length > 0) {
              doc.offers.sort((a, b) => b.tier - a.tier || b.basePurse - a.basePurse);
              await this.contractService.accept(fighter.id, doc.offers[0].promotionId, summary.now);
            }
          } catch { /* sem propostas */ }
        }

        for (const evt of summary.world.playerEvents) {
          for (const r of evt.playerResults) {
            const playerIsA = evt.playerFighterIds.has(r.fighterAId);
            const won = r.winnerId === (playerIsA ? r.fighterAId : r.fighterBId);
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

        rivalSignings += summary.rivalActivity.signings.length;
        if (summary.rivalActivity.poached) {
          poachedFighters.push({ ...summary.rivalActivity.poached, absWeek: summary.now });
        }
      }
    } finally {
      this.notifService.muted = false;
    }

    const endGym = await this.getGym();

    return {
      weeksSimulated,
      offersAccepted,
      rivalSignings,
      poachedFighters,
      cashDelta: endGym.cash - startCash,
      repDelta: endGym.reputation - startRep,
      winsDelta: endGym.wins - startWins,
      lossesDelta: endGym.losses - startLosses,
      fightResults,
      milestonesUnlocked,
      endGym,
    };
  }

  _applyWeeklyEconomy(gym, team, now) {
    const expenses = gym.weeklyExpenses(team.length);
    const income = gym.weeklyIncome();

    gym.addTransaction(now, 'Mensalidades de alunos', income.total);
    gym.addTransaction(now, `Custos da academia (aluguel + treinadores)`, -expenses.total);

    return { expenses, income, net: income.total - expenses.total };
  }

  // Cada lutador treina o próprio foco (fighter.trainingFocus), amplificado
  // pelo nível da academia e por treinadores auxiliares contratados.
  async _applyWeeklyTraining(team, gym) {
    const facilityBonus = gym.facility.trainingBonus;

    for (const fighter of team) {
      if (fighter.status === 'injured') continue;

      const focus = fighter.trainingFocus || 'striking';
      const meta = TRAINING_FOCUS_META[focus] || TRAINING_FOCUS_META.striking;

      if (focus === 'recovery') {
        const coachRecovery = gym.hasCoach('cardio') ? (COACH_CONFIG.cardio.recoveryBonus || 0) : 0;
        fighter.fatigue = clamp(fighter.fatigue - (12 + gym.facility.recoveryBonus + coachRecovery), 0, 100);
        fighter.applyMoraleChange(3);
      } else {
        const coachBonus = gym.hasCoach(focus) ? (COACH_CONFIG[focus]?.gainBonus || 0) : 0;
        const gainChance = Math.min(0.9, 0.35 + (fighter.hidden.discipline / 100) * 0.4 + facilityBonus + coachBonus);
        for (const attr of meta.attrs) {
          if (Math.random() < gainChance) {
            fighter.attributes[attr] = clamp(fighter.attributes[attr] + 1, 0, Math.max(fighter.attributes[attr], fighter.hidden.potential));
          }
        }
        fighter.applyFatigue(4);
      }
      fighter.recover();
      await this.fighterCtrl.updateFighter(fighter);
    }
  }

  // Épico F3: gera manchetes do mundo da semana — vitórias, upsets, lesões, cinturões
  async _generateHeadlines(now, world, team) {
    const { playerEvents, promotionEvents } = world;

    // Manchetes de eventos do jogador
    for (const pe of (playerEvents || [])) {
      const fighter = team.find(f => f.id === pe.fighterId);
      if (!pe.won && pe.method && (pe.method.startsWith('KO') || pe.method.startsWith('TKO'))) {
        await this.notifService.add('headline', 'Nocaute Sofrido', `${fighter?.name || 'Atleta'} foi nocauteado por ${pe.opponentName} no R${pe.round}.`);
      }
      if (pe.won && pe.method && pe.method.startsWith('KO')) {
        await this.notifService.add('headline', 'Nocaute!', `${fighter?.name || 'Atleta'} nocauteou ${pe.opponentName} no R${pe.round}!`);
      }
      if (pe.won && pe.method && pe.method.startsWith('Submission')) {
        await this.notifService.add('headline', 'Finalização!', `${fighter?.name || 'Atleta'} finalizou ${pe.opponentName} no R${pe.round}!`);
      }
    }

    // Manchetes de eventos do mundo (promoções)
    for (const promo of (promotionEvents || [])) {
      for (const r of (promo.results || []).slice(0, 3)) { // top 3 resultados
        const headlineParts = [];
        if (r.method === 'KO') headlineParts.push(`💥 NOCAUTE: ${r.winnerName} destrói ${r.loserName} no R${r.round}`);
        else if (r.method === 'Submission') headlineParts.push(`🔄 Finalização: ${r.winnerName} finaliza ${r.loserName} no R${r.round}`);
        else if (r.isTitleFight) headlineParts.push(`🏆 Disputa de cinturão: ${r.winnerName} vence ${r.loserName}`);

        // Upset detection: underdog wins (lower OVR)
        if (r.winnerOvr && r.loserOvr && r.loserOvr > r.winnerOvr + 8) {
          headlineParts.push(`⚠️ SURPRESA: ${r.winnerName} (OVR ${r.winnerOvr}) vence ${r.loserName} (OVR ${r.loserOvr})`);
        }

        if (headlineParts.length > 0) {
          await this.notifService.add('headline', promo.promotionName, `${headlineParts[0]}`);
        }
      }
    }
  }

  // Épico F3: gera callouts de lutadores de IA provocando os atletas do jogador
  async _generateCallouts(now, team) {
    const promotions = await this.worldService.getPromotions();
    if (!promotions.length) return;

    // Chance semanal de callout: ~30%
    if (Math.random() > 0.3) return;

    // Pega um atleta do time elegível (não lesionado, ativo)
    const eligible = team.filter(f => f.status !== 'injured' && f.status !== 'retired');
    if (!eligible.length) return;

    const target = eligible[Math.floor(Math.random() * eligible.length)];

    // Pega um lutador de IA de qualquer lugar
    const allFighters = await this.fighterCtrl.getAllFighters();
    const callouters = allFighters.filter(f =>
      f.id !== target.id &&
      f.status !== 'retired' &&
      f.weightClass === target.weightClass &&
      f.popularity >= 30
    );

    if (!callouters.length) return;

    const caller = callouters[Math.floor(Math.random() * callouters.length)];
    const calloutPhrases = [
      `${caller.name} provocou ${target.name}: "Eu enfrento qualquer um, inclusive ele."`,
      `${caller.name} disse em entrevista que ${target.name} "não está pronto para o próximo nível."`,
      `${caller.name} quer uma chance contra ${target.name}: "Quero mostrar quem manda na divisão."`,
      `${caller.name} criticou a última atuação de ${target.name}: "Eu teria finalizado no primeiro round."`,
      `${caller.name} mandou um salve: "${target.name}, para de fugir e aceita uma luta."`,
    ];

    const phrase = calloutPhrases[Math.floor(Math.random() * calloutPhrases.length)];
    await this.notifService.add('headline', 'Callout', phrase);
  }

  // Épico F2: expectativas dos atletas (título, subir de tier, mais lutas, melhor pagamento)
  async _checkExpectations(now, team) {
    const promotions = await this.worldService.getPromotions();

    for (const fighter of team) {
      if (fighter.status === 'injured' || fighter.status === 'retired') continue;
      if (!fighter.promotionContract && !fighter.organizationId) continue;

      // === FASE 1: DANO SEMANAL (roda toda semana, independente do CHECK_INTERVAL) ===
      if (fighter.expectation?.urgency >= 3) {
        const oldMorale = fighter.morale;
        const oldLoyalty = fighter.loyalty;
        fighter.morale = Math.max(0, fighter.morale - EXPECTATION_CONFIG.MORALE_DAMAGE_URGENT);
        fighter.loyalty = Math.max(0, fighter.loyalty - EXPECTATION_CONFIG.LOYALTY_DAMAGE_URGENT);
        // Só notifica se houve dano real (evita spam quando já está em 0)
        if (fighter.morale < oldMorale || fighter.loyalty < oldLoyalty) {
          await this.notifService.add(
            'warning',
            'Insatisfação',
            `${fighter.name} está frustrado(a) com a falta de ${fighter.expectation.kind === 'title_shot' ? 'chance de título' : fighter.expectation.kind === 'move_up_tier' ? 'progressão de carreira' : fighter.expectation.kind === 'more_fights' ? 'lutas' : 'melhor pagamento'}. Moral: -${EXPECTATION_CONFIG.MORALE_DAMAGE_URGENT}, Lealdade: -${EXPECTATION_CONFIG.LOYALTY_DAMAGE_URGENT}.`
          );
        }
      }

      // === FASE 2: REAVALIAÇÃO (a cada CHECK_INTERVAL semanas) ===
      if (now - (fighter.lastExpectationCheck || 0) < EXPECTATION_CONFIG.CHECK_INTERVAL) {
        await this.fighterCtrl.updateFighter(fighter);
        continue;
      }

      const promoId = fighter.promotionContract?.promotionId || fighter.organizationId;
      const promo = promotions.find(p => p.id === promoId);
      if (!promo) continue;

      const weeksSinceLastFight = now - (fighter.lastFightAbsWeek || 0);
      const tier = promo.tier;
      const fighterTier = fighter.overallRating >= 75 ? 1 : fighter.overallRating >= 60 ? 2 : 3;

      let expectation = null;

      // Atleta de alto nível quer chance de título
      if (fighterTier <= tier && weeksSinceLastFight >= 12) {
        expectation = { kind: 'title_shot', sinceAbsWeek: now, urgency: 2 };
      }
      // Atleta abaixo do tier da promoção quer subir
      else if (fighterTier < tier && weeksSinceLastFight >= 8) {
        expectation = { kind: 'move_up_tier', sinceAbsWeek: now, urgency: 2 };
      }
      // Atleta inativo por muito tempo quer lutar
      else if (weeksSinceLastFight >= 16) {
        expectation = { kind: 'more_fights', sinceAbsWeek: now, urgency: 3 };
      }
      // Atleta de alto desempenho quer melhor pagamento
      else if (fighter.record.wins >= 3 && fighter.popularity >= 60 && !fighter.expectation) {
        expectation = { kind: 'better_pay', sinceAbsWeek: now, urgency: 1 };
      }

      fighter.lastExpectationCheck = now;

      if (expectation) {
        fighter.expectation = expectation;
        await this.notifService.add(
          'warning',
          'Expectativa',
          `${fighter.name} quer ${expectation.kind === 'title_shot' ? 'uma chance de título' : expectation.kind === 'move_up_tier' ? 'subir de tier' : expectation.kind === 'more_fights' ? 'lutar mais' : 'melhor pagamento'}.`
        );
      } else {
        fighter.expectation = null;
      }

      // Urgência aumenta com o tempo na reavaliação
      if (fighter.expectation && weeksSinceLastFight >= 4) {
        fighter.expectation.urgency = Math.min(3, (fighter.expectation.urgency || 1) + 1);
      }

      await this.fighterCtrl.updateFighter(fighter);
    }
  }

  // Épico D: processa configurações de camp dos atletas no loop semanal
  async _applyWeeklyCamp(absWeekNow, team, gym) {
    const results = [];
    const canceledFights = [];

    for (const fighter of team) {
      if (fighter.status === 'injured' || fighter.status === 'retired') continue;
      if (!fighter.campConfig) {
        fighter.campProcessedThisWeek = false;
        await this.fighterCtrl.updateFighter(fighter);
        continue;
      }

      // Atleta com camp configurado: processar
      const { intensity } = fighter.campConfig;

      // Cobrar custo semanal do camp
      const cost = CAMP_CONFIG.WEEKLY_COST[intensity] || 0;
      if (cost > 0) {
        if (gym.cash >= cost) {
          gym.addTransaction(absWeekNow, `Camp: ${fighter.name}`, -cost);
        } else {
          // Sem dinheiro: cancela o camp automaticamente
          fighter.campConfig = null;
          await this.fighterCtrl.updateFighter(fighter);
          await this.notifService.add('warning', 'Camp Cancelado', `Camp de ${fighter.name} cancelado por falta de fundos.`);
          continue;
        }
      }

      // Determinar arquétipo do adversário (se tiver luta marcada)
      let opponentArchetype = null;
      try {
        const accepted = await this.offerService.getAccepted();
        const booking = accepted.find(b => b.fighterId === fighter.id);
        if (booking) {
          const opponent = await this.fighterCtrl.getFighter(booking.opponentId);
          if (opponent) {
            opponentArchetype = TrainingCamp.opponentArchetype(opponent);
          }
        }
      } catch { /* sem luta marcada */ }

      const result = TrainingCamp.processCamp(fighter, gym, team, absWeekNow, opponentArchetype);

      if (result) {
        results.push({ fighterId: fighter.id, fighterName: fighter.name, result });

        if (result.canceledFight && result.injured) {
          const accepted = await this.offerService.getAccepted();
          const booking = accepted.find(b => b.fighterId === fighter.id);
          canceledFights.push({
            fighterId: fighter.id,
            fighterName: fighter.name,
            opponentName: booking?.opponentName || 'desconhecido',
          });
        }
      }

      await this.fighterCtrl.updateFighter(fighter);
    }

    return { results, canceledFights };
  }

  async setTrainingFocus(fighterId, focus) {
    if (!TRAINING_FOCUS_META[focus]) return null;
    const fighter = await this.fighterCtrl.getFighter(fighterId);
    if (!fighter) return null;
    fighter.trainingFocus = focus;
    await this.fighterCtrl.updateFighter(fighter);
    return fighter;
  }

  // ===== Estrutura da academia (Fase 2) =====
  async upgradeFacility() {
    const gym = await this.getGym();
    const next = gym.nextFacility;
    if (!next) return { ok: false, reason: 'Sua academia já está no nível máximo.' };
    if (gym.cash < next.upgradeCost) {
      return { ok: false, reason: `Caixa insuficiente. O upgrade custa $${next.upgradeCost.toLocaleString()}.` };
    }

    const state = await this.seasonService.getState();
    gym.addTransaction(absWeek(state), `Upgrade — ${next.name}`, -next.upgradeCost);
    gym.level++;
    await this.updateGym(gym);
    return { ok: true, facility: next };
  }

  async hireCoach(category) {
    const gym = await this.getGym();
    if (!COACH_CONFIG[category]) return { ok: false, reason: 'Categoria inválida.' };
    if (gym.hasCoach(category)) return { ok: false, reason: 'Treinador já contratado.' };
    if (gym.hiredCoachCount >= gym.facility.coachSlots) {
      return { ok: false, reason: `Sua estrutura atual só comporta ${gym.facility.coachSlots} treinador${gym.facility.coachSlots === 1 ? '' : 'es'}. Faça upgrade para abrir mais vagas.` };
    }

    gym.coaches[category] = true;
    await this.updateGym(gym);
    return { ok: true };
  }

  async fireCoach(category) {
    const gym = await this.getGym();
    gym.coaches[category] = false;
    await this.updateGym(gym);
    return { ok: true };
  }

  async purchaseScout() {
    const gym = await this.getGym();
    if (gym.scoutLevel > 0) return { ok: false, reason: 'Você já contratou um olheiro.' };
    if (gym.cash < SCOUT_CONFIG.unlockCost) {
      return { ok: false, reason: `Caixa insuficiente. O olheiro custa $${SCOUT_CONFIG.unlockCost.toLocaleString()}.` };
    }

    const state = await this.seasonService.getState();
    gym.addTransaction(absWeek(state), 'Contratação — Olheiro', -SCOUT_CONFIG.unlockCost);
    gym.scoutLevel = 1;
    await this.updateGym(gym);
    return { ok: true };
  }

  // ===== Preparação: scouting e plano de jogo =====

  // Estuda o adversário de uma luta marcada. Cada nível custa mais caro e
  // revela mais: faixas de atributo estreitam, tendências e DNA aparecem.
  async studyOpponent(fighterId) {
    const gym = await this.getGym();
    const opponent = await this.fighterCtrl.getFighter(fighterId);
    if (!opponent) return { ok: false, reason: 'Lutador não encontrado.' };

    const state = await this.seasonService.getState();
    const result = await this.scoutingService.study(opponent, gym, absWeek(state));
    if (result.ok) {
      await this.updateGym(gym);
      await this.notifService.add('info', '🔍 Relatório do Olheiro', `${opponent.name} agora está "${result.label}". Custo: $${result.cost.toLocaleString()}.`);
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

  // Tudo que o jogador tem direito de saber sobre um adversário marcado.
  async opponentDossier(offer) {
    const gym = await this.getGym();
    const opponent = await this.fighterCtrl.getFighter(offer.opponentId);
    if (!opponent) return null;

    const level = await this.scoutingService.knowledgeOf(opponent, gym);
    const nextCost = level < 3 ? this.scoutingService.studyCost(level + 1) : null;

    return {
      opponent,
      level,
      levelLabel: ScoutingService.levelLabel(level),
      nextCost,
      canAfford: nextCost != null && gym.cash >= nextCost,
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

  // ===== Patrocínios =====
  async acceptSponsorOffer(offerId) {
    const state = await this.seasonService.getState();
    const gym = await this.getGym();
    return await this.sponsorService.accept(offerId, absWeek(state), gym.wins);
  }

  async declineSponsorOffer(offerId) {
    return await this.sponsorService.decline(offerId);
  }

  // ===== Objetivos (milestones do modo academia) =====
  async getMilestones() {
    const raw = await this.db.get('gameState', 'milestones');
    const state = raw || {};
    const defs = [
      { id: 'firstFight', label: 'Estreia Profissional', desc: 'Colocar um atleta para lutar', max: 1 },
      { id: 'firstWin', label: 'Primeira Vitória', desc: 'Vencer a primeira luta', max: 1 },
      { id: 'fiveWins', label: '5 Vitórias', desc: 'Acumular 5 vitórias da equipe', max: 5 },
      { id: 'tenWins', label: '10 Vitórias', desc: 'Acumular 10 vitórias da equipe', max: 10 },
      { id: 'firstFinish', label: 'Primeira Finalização', desc: 'Vencer por KO, TKO ou finalização', max: 1 },
      { id: 'firstTier2', label: 'Palco Nacional', desc: 'Lutar em uma promoção nacional', max: 1 },
      { id: 'firstTier1', label: 'Elite Mundial', desc: 'Lutar na Apex Fighting Championship', max: 1 },
      { id: 'rep50', label: 'Academia Respeitada', desc: 'Alcançar reputação 50', max: 50 },
      { id: 'topGym', label: 'Academia Nº1', desc: 'Superar todas as academias rivais em reputação', max: 1 },
      { id: 'firstTitleShot', label: 'Disputa de Cinturão', desc: 'Levar um atleta a uma luta de título', max: 1 },
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

  async _checkMilestones(playerEvents, gym) {
    const state = await this.db.get('gameState', 'milestones') || {};
    state.id = 'milestones'; // keyPath do store gameState — sem isso o put falha
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

        // Cinturões: chegar lá, ganhar, defender, e conquistar o mundial
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

    bump('fiveWins', Math.min(gym.wins, 5), 5);
    bump('tenWins', Math.min(gym.wins, 10), 10);
    bump('rep50', Math.min(gym.reputation, 50), 50);

    const rivalGyms = await this.rivalGymService.getAll();
    if (rivalGyms.length > 0 && rivalGyms.every(r => gym.reputation > r.reputation)) {
      bump('topGym', 1, 1);
    }

    await this.db.put('gameState', state);
    return unlocked;
  }

  // ===== Dashboard =====
  async getDashboard() {
    const gym = await this.getGym();
    const team = await this.getTeam();
    const pendingOffers = await this.offerService.getPending();
    const bookings = await this.offerService.getAccepted();
    const promotions = await this.worldService.getPromotions();
    const pastEvents = (await this.eventCtrl.getAllEvents()).slice(0, 6);
    const milestones = await this.getMilestones();
    const state = await this.seasonService.getState();
    const rivalGyms = await this.rivalGymService.getAll();
    const sponsors = await this.sponsorService.getState();

    const allFighters = await this.fighterCtrl.getAllFighters();
    const active = allFighters.filter(f => f.status !== 'retired');
    const rankings = RankingService.calculateRankings(active);
    const champions = RankingService.getChampions(rankings);

    const gymStandings = [
      { name: gym.name, reputation: gym.reputation, isPlayer: true },
      ...rivalGyms.map(r => ({ name: r.name, reputation: r.reputation, isPlayer: false })),
    ].sort((a, b) => b.reputation - a.reputation);

    // Cinturões da casa: { [fighterId]: [{ promotionShort, weightClass, defenses }] }
    const teamBelts = {};
    const teamContenderStatus = {};
    for (const f of team) {
      const belts = await this.titleService.beltsOf(f.id);
      if (belts.length > 0) teamBelts[f.id] = belts;

      const status = await this.titleService.contenderStatusOf(f);
      if (status && !status.isChampion) teamContenderStatus[f.id] = status;
    }

    return {
      gym,
      team,
      teamBelts,
      teamContenderStatus,
      pendingOffers,
      bookings,
      promotions,
      pastEvents,
      milestones,
      champions,
      rankings,
      gymStandings,
      sponsors,
      state,
      now: absWeek(state),
    };
  }
}
