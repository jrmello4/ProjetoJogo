import { Promotion } from '../models/promotion.js';
import { Fighter } from '../models/fighter.js';
import { Event } from '../models/event.js';
import { OFFER_STATUS } from '../models/fight-offer.js';
import { CombatAdapter } from '../controllers/combat-adapter.js';
import { FightOutcome } from '../controllers/fight-outcome.js';
import { TapeService } from './tape-service.js';
import { ReadinessService } from './readiness-service.js';
import { DataGenerator } from './data-generator.js';
import { HallOfFame } from './hall-of-fame.js';
import { InjuryService } from './injury-service.js';
import { CrowdService } from './crowd-service.js';
import { VisualIdentityService } from './visual-identity-service.js';
import { CAREER_EVENT_TYPES } from './career-event-bus.js';
import { CAREER_EVENT } from './career-events.js';
import { generateId, getWeightClassName } from '../utils/helpers.js';
import {
  ACADEMIES,
  WORLD_CONFIG,
  CORE_WEIGHT_CLASSES,
  TITLE_CONFIG,
  TITLE_ROLE,
  HYPE_PURSE_RATIO,
  POST_FIGHT_BONUSES,
  PROMOTIONS,
  OFFER_CONFIG,
  TIER_MOVEMENT_CONFIG,
  RIVALRY_CONFIG,
  GAME_PLANS,
  TAPE_CONFIG,
  WEIGHT_BULLY_CONFIG,
  absWeekToDate,
} from '../config/game-config.js';

export const WORLD_HISTORY_LIMITS = Object.freeze({
  completedEvents: 520,
  playerEvents: 120,
  standalonePlayerFights: 120,
});

// Motor do mundo vivo: cada promoção de IA agenda e realiza os próprios
// eventos. Lutas do jogador entram nos cards via ofertas aceitas.
export class WorldService {
  constructor(db, fighterCtrl, notifService, titleService = null, scoutingService = null, contractService = null, managerService = null, careerLogService = null, rivalryService = null, careerEvents = null, careerEventBus = null) {
    this.db = db;
    this.fighterCtrl = fighterCtrl;
    this.notifService = notifService;
    this.titleService = titleService;
    this.scoutingService = scoutingService;
    this.contractService = contractService;
    this.managerService = managerService;
    this.careerLogService = careerLogService;
    this.rivalryService = rivalryService;
    this.careerEventBus = careerEventBus;
    this.careerEvents = careerEvents;
    this.injuryService = new InjuryService(db, careerLogService, notifService);
  }

  // Fase 3 — reúne o contexto que decide o quanto o adversário conhece você.
  // A intensidade da rivalidade e a academia dele entram aqui porque um rival
  // te estuda de graça e uma academia grande tem quem assista às fitas.
  async _resolveTactics(player, opponent, booking) {
    let rivalryIntensity = 0;
    if (this.rivalryService) {
      const rivalries = await this.rivalryService.getRivalries(player.id);
      const shared = rivalries.find(r => r.fighterAId === opponent.id || r.fighterBId === opponent.id);
      rivalryIntensity = shared?.intensity || 0;
    }

    // Resolve scouting level to scale plan edge — segue o mesmo padrão de
    // _resolveReadiness (scoutingService.knowledgeOf + manager baseline).
    let scoutingLevel = 0;
    if (this.scoutingService) {
      let hasBaseline = false;
      if (this.managerService && player.managerId) {
        const manager = await this.managerService.getManager(player.managerId);
        hasBaseline = this.managerService.givesBaselineScouting(manager);
      }
      scoutingLevel = await this.scoutingService.knowledgeOf(opponent, player.id, hasBaseline);
    }

    return TapeService.resolveTactics({
      player,
      opponent,
      gamePlanKey: booking.gamePlan || 'balanced',
      bait: !!booking.bait,
      rivalryIntensity,
      opponentAcademy: ACADEMIES.find(a => a.id === opponent.academyId) || null,
      // O vazamento (§Fase 3b): quem dividiu o tatame com você não precisa da
      // fita. Ele te viu.
      sparredWeeks: player.sparredWith?.[opponent.id] || 0,
      planEdgeFn: (plan, target) => FightOutcome._planEdge(plan, target, scoutingLevel),
    });
  }

  // Prontidão (item 4) — reúne os insumos e delega a conta ao
  // ReadinessService. O nível de scouting entra pela MESMA função do
  // dossiê (knowledgeOf), então o que a tela mostrou é o que a luta usa.
  async _resolveReadiness(player, opponent, booking, promo) {
    let scoutingLevel = 0;
    if (this.scoutingService) {
      let hasBaseline = false;
      if (this.managerService && player.managerId) {
        const manager = await this.managerService.getManager(player.managerId);
        hasBaseline = this.managerService.givesBaselineScouting(manager);
      }
      scoutingLevel = await this.scoutingService.knowledgeOf(opponent, player.id, hasBaseline);
    }

    const player_ = ReadinessService.playerReadiness(player, booking, scoutingLevel);
    const ai = ReadinessService.aiReadiness(promo.tier, !!booking.isTitleFight, `${booking.id}-${opponent.id}`);
    return {
      player: player_.total,
      parts: player_.parts,
      opponent: ai,
      gap: player_.total - ai,
      factor: ReadinessService.gapFactor(player_.total, ai),
    };
  }

  async getPromotions() {
    const all = await this.db.getAll('organization');
    return all
      .filter(o => o.id.startsWith('promo-'))
      .map(o => new Promotion(o))
      .sort((a, b) => a.tier - b.tier);
  }

  async getPromotion(id) {
    const data = await this.db.get('organization', id);
    return data ? new Promotion(data) : null;
  }

  // Tick semanal do mundo. Retorna eventos realizados, destacando os que
  // envolvem o lutador do jogador (para a transmissão ao vivo).
  // cornerHooks (opcional): presença = caminho AO VIVO. App passa
  // prepareCardFight(container) para montar a UI de cartas dentro de
  // _runEvent; simulateWeeks passa null e o CombatAdapter resolve com IA.
  async processWeek(absWeekNow, startedAt, playerFighterId, cornerHooks = null) {
    await this.injuryService.recoverInjuries(absWeekNow, playerFighterId);
    if (this.titleService) await this.titleService.reconcileBelts();

    const promotions = await this.getPromotions();
    const playerEvents = [];

    for (const promo of promotions) {
      if (absWeekNow < promo.nextEventAbsWeek) continue;

      const outcome = await this._runEvent(promo, absWeekNow, startedAt, playerFighterId, cornerHooks);
      if (!outcome) continue;

      if (outcome.playerResults.length > 0) {
        playerEvents.push(outcome);
      }
    }

    // Resultados de IA continuam alimentando o mundo/rankings, mas não viram
    // uma pilha semanal de manchetes genéricas. Notificação deve ser algo que
    // exige ação ou diz respeito diretamente à carreira do jogador.

    await this._refillFreeAgents();
    await this._processYearEnd(absWeekNow, playerFighterId, startedAt);
    if (absWeekNow % 26 === 0) {
      await this._pruneWorldHistory(playerFighterId);
    }
    // G1: verificar cinturões interinos (toda semana)
    await this._checkInterimTitles(absWeekNow, promotions);
    await this._evolveAIFighters(absWeekNow, playerFighterId);

    // Decaimento de rivalidade (item "sempre o mesmo cara") — sem isso a
    // rivalidade mais quente de anos atrás nunca solta o topo do sorteio.
    if (this.rivalryService && absWeekNow % RIVALRY_CONFIG.DECAY_INTERVAL_WEEKS === 0) {
      await this.rivalryService.decayAll(RIVALRY_CONFIG.DECAY_AMOUNT, absWeekNow);
    }

    return { playerEvents };
  }

  async _pruneWorldHistory(playerFighterId) {
    const events = await this.db.getAll('events');
    const newestFirst = (left, right) => {
      const weekDelta = (right.absWeek || 0) - (left.absWeek || 0);
      if (weekDelta !== 0) return weekDelta;
      return Date.parse(right.date || 0) - Date.parse(left.date || 0);
    };
    const sortedEvents = [...events].sort(newestFirst);
    const playerEvents = sortedEvents.filter(event =>
      (event.results || []).some(result =>
        result.fighterAId === playerFighterId || result.fighterBId === playerFighterId
      )
    );
    const keepEventIds = new Set([
      ...sortedEvents.slice(0, WORLD_HISTORY_LIMITS.completedEvents),
      ...playerEvents.slice(0, WORLD_HISTORY_LIMITS.playerEvents),
    ].map(event => event.id));

    for (const event of events) {
      if (!keepEventIds.has(event.id)) await this.db.delete('events', event.id);
    }

    const fights = await this.db.getAll('fights');
    const playerFightIds = new Set(fights
      .filter(fight =>
        fight.fighterId === playerFighterId
        || fight.fighterAId === playerFighterId
        || fight.fighterBId === playerFighterId
      )
      .sort((a, b) => {
        const weekDelta = (b.absWeek || 0) - (a.absWeek || 0);
        return weekDelta || Date.parse(b.date || 0) - Date.parse(a.date || 0);
      })
      .slice(0, WORLD_HISTORY_LIMITS.standalonePlayerFights)
      .map(fight => fight.id));

    for (const fight of fights) {
      if (!keepEventIds.has(fight.eventId) && !playerFightIds.has(fight.id)) {
        await this.db.delete('fights', fight.id);
      }
    }

    return {
      eventsRemoved: events.length - keepEventIds.size,
      fightsRemoved: fights.filter(fight =>
        !keepEventIds.has(fight.eventId) && !playerFightIds.has(fight.id)
      ).length,
    };
  }

  async _runEvent(promo, absWeekNow, startedAt, playerFighterId, cornerHooks = null) {
    const bookings = await this._getBookings(promo.id, absWeekNow);
    const playerFighterIds = new Set();
    const bookedIds = new Set();
    const fights = [];

    // 1) Luta do jogador (oferta aceita para este evento)
    for (const booking of bookings) {
      const fighter = await this.fighterCtrl.getFighter(booking.fighterId);
      let opponent = await this.fighterCtrl.getFighter(booking.opponentId);

      // status inválido cobre o caso de o jogador ter se lesionado/aposentado
      // depois de aceitar a luta
      if (!fighter || fighter.status === 'injured' || fighter.status === 'retired') {
        booking.status = OFFER_STATUS.CANCELLED;
        await this.db.put('offers', booking);
        await this.notifService.add('warning', 'Luta Cancelada', `${booking.opponentName ? 'A luta contra ' + booking.opponentName : 'Uma luta'} foi cancelada — você não pôde competir.`);
        continue;
      }

      // Adversário indisponível: a promoção busca substituto na divisão
      if (!opponent || opponent.status !== 'roster' || opponent.availableFromAbsWeek > absWeekNow) {
        // Título em jogo e o CAMPEÃO caiu (não um desafiante qualquer):
        // curto o suficiente pra esperar -> adia o evento, título intacto —
        // sem isso, a luta virava treino sem valor e o próximo ciclo de
        // ofertas repetia a mesma chance contra o mesmo campeão sempre
        // machucado, preso nisso por anos.
        if (booking.isTitleFight && opponent && opponent.status !== 'retired') {
          const weeksOut = Math.max(0, (opponent.availableFromAbsWeek || 0) - absWeekNow);
          if (weeksOut > 0 && weeksOut <= TITLE_CONFIG.POSTPONE_MAX_WEEKS) {
            booking.eventAbsWeek = absWeekNow + weeksOut;
            await this.db.put('offers', booking);
            await this.notifService.add('info', 'Defesa de Título Adiada', `${opponent.name} ainda não recuperou. A defesa contra ${fighter.name} foi adiada para daqui ${weeksOut} semana(s) — o cinturão segue em jogo.`);
            continue;
          }
        }

        const fellThroughTitleFight = booking.isTitleFight;
        opponent = await this._findReplacement(promo.id, fighter, bookedIds, absWeekNow);
        if (!opponent) {
          booking.status = OFFER_STATUS.CANCELLED;
          await this.db.put('offers', booking);
          await this.notifService.add('warning', 'Luta Cancelada', `${fighter.name} ficou sem adversário no ${promo.nextEventName()} — a bolsa foi perdida.`);
          continue;
        }
        booking.opponentId = opponent.id;
        booking.opponentName = opponent.name;

        // Campeão fora por muito tempo (ou sumiu de vez): a luta já
        // marcada vira disputa de cinturão INTERINO em vez de perder o
        // título por completo — o desafiante mandatório não fica de mãos
        // vazias só porque o titular desapareceu do mapa.
        if (fellThroughTitleFight) {
          booking.interimTitle = true;
          booking.titleRole = null;
          await this.notifService.add('warning', '🥈 Vira Disputa de Interino', `O campeão segue fora. ${fighter.name} agora disputa o cinturão INTERINO contra ${opponent.name}.`);
        } else {
          await this.notifService.add('info', 'Troca de Adversário', `${opponent.name} substituiu o oponente original de ${fighter.name}.`);
        }
        await this.db.put('offers', booking);
      }

      bookedIds.add(fighter.id);
      bookedIds.add(opponent.id);
      playerFighterIds.add(fighter.id);
      fights.push({
        fighterA: fighter,
        fighterB: opponent,
        card: 'main',
        booking,
        titleWeightClass: (booking.isTitleFight || booking.interimTitle) ? booking.weightClass : null,
        interimTitle: !!booking.interimTitle,
      });
    }

    // 1.5) Disputa de cinturão entre lutadores da IA — vira o evento principal
    if (this.titleService) {
      const aiTitle = await this.titleService.pickAiTitleFight(promo, absWeekNow, bookedIds, playerFighterId);
      if (aiTitle) {
        bookedIds.add(aiTitle.fighterA.id);
        bookedIds.add(aiTitle.fighterB.id);
        fights.push({
          fighterA: aiTitle.fighterA,
          fighterB: aiTitle.fighterB,
          card: 'main',
          booking: null,
          titleWeightClass: aiTitle.weightClass,
        });
      }
    }

    // 2) Lutas de IA para completar o card
    const aiPairs = await this._buildAiCard(promo, bookedIds, absWeekNow);
    aiPairs.forEach((pair, i) => {
      fights.push({
        fighterA: pair[0],
        fighterB: pair[1],
        card: i < 2 ? 'main' : 'prelim',
        booking: null,
        titleWeightClass: null,
      });
    });

    if (fights.length === 0) {
      // Sem lutas viáveis — adia o evento em 1 semana
      promo.nextEventAbsWeek = absWeekNow + 1;
      await this.db.put('organization', promo);
      return null;
    }

    // 3) Simulação
    const eventId = generateId();
    const results = [];

    for (const fight of fights) {
      const { fighterA, fighterB } = fight;

      // A reserva do jogador pode carregar uma estratégia de pesagem. A IA
      // continua usando o impacto normal do próprio corte de peso.
      fighterA.applyWeightCutImpact(fight.booking?.weighIn?.impactMultiplier ?? 1);

      // P4.x — Weight bullying: o mesmo aviso que a oferta mostrou ao
      // jogador vira efeito de verdade na noite da luta. Ganho temporário
      // (revertido logo abaixo, com recoverFromWeightCut) — nunca some pra
      // sempre, senão um rival recorrente ficaria permanentemente maior.
      const weightBullyDeltas = this._applyWeightBullyBoost(fighterB, fight.booking);

      // O plano de jogo é do jogador. A IA luta equilibrada.
      const gamePlan = fight.booking?.gamePlan || 'balanced';

      const fightDateISO = absWeekToDate(absWeekNow, startedAt).toISOString();
      // §B.1 — pressurePerformer/bigEventNervous se descobrem exatamente na
      // 1ª luta de tier 1 OU numa disputa de cinturão (condições do spec,
      // checadas por lutador). O motor de cartas não modela pressão no
      // resultado da luta; a descoberta do traço continua sendo o gancho vivo.
      const isTitleFight = !!fight.titleWeightClass;
      if (isTitleFight || (promo.tier === 1 && !fighterA.reachedTier1)) {
        if (fighterA.hasDNA('pressurePerformer')) fighterA.discoverTrait('pressurePerformer');
        if (fighterA.hasDNA('bigEventNervous')) fighterA.discoverTrait('bigEventNervous');
      }
      if (isTitleFight || (promo.tier === 1 && !fighterB.reachedTier1)) {
        if (fighterB.hasDNA('pressurePerformer')) fighterB.discoverTrait('pressurePerformer');
        if (fighterB.hasDNA('bigEventNervous')) fighterB.discoverTrait('bigEventNervous');
      }
      if (promo.tier === 1) {
        fighterA.reachedTier1 = true;
        fighterB.reachedTier1 = true;
      }
      // Fase 3 — O Livro Sobre Você. Só a luta do jogador é lida: é a única
      // fita que alguém se dá ao trabalho de estudar, e é a única em que a
      // decisão (isca, arma nova, plano repetido) foi tomada por uma pessoa.
      // Luta de IA contra IA segue como sempre — `tactics` nulo = comportamento
      // anterior, sem custo.
      const tactics = fight.booking
        ? await this._resolveTactics(fighterA, fighterB, fight.booking)
        : null;

      // Prontidão (item 4): calculada AQUI, na noite da luta — é o estado
      // real do lutador que entra no octógono, não uma projeção. Vive
      // dentro de `tactics` porque só existe pra luta do jogador (mesma
      // regra do resto do objeto) e porque `result.tactics` já é o canal
      // que leva contexto tático pra tela pós-luta.
      if (tactics) {
        tactics.readiness = await this._resolveReadiness(fighterA, fighterB, fight.booking, promo);
        tactics.readinessFactorA = tactics.readiness.factor;
      }

      // TODA luta resolve pelo motor de cartas (CombatAdapter) — motor oficial
      // e único. Só a luta do jogador (fight.booking) recebe UI ao vivo e
      // prêmio de carta; IA-vs-IA roda headless (interactive=false, sem
      // recompensa). interactive espelha o antigo sinal de cornerHooks:
      // advanceWeek ao vivo passa hooks; simulateWeeks / processWeek() não.
      let result;
      let interactive = false;
      let container = null;
      if (fight.booking) {
        interactive = !!cornerHooks;
        if (interactive && cornerHooks.prepareCardFight) {
          container = await cornerHooks.prepareCardFight({
            fighter: fighterA,
            opponent: fighterB,
            promo,
          });
        } else if (interactive) {
          // Back-compat: old onFightStart intro still runs if prepareCardFight
          // is missing (dev callers / partial hooks).
          await cornerHooks.onFightStart?.({ fighter: fighterA, opponent: fighterB, promo });
        }
      }

      const adapter = new CombatAdapter();
      if (container) adapter.setContainer(container);
      result = await adapter.runFight(
        fighterA,
        fighterB,
        promo.tier === 1,
        gamePlan,
        promo.tier,
        isTitleFight,
        interactive,
        !!fight.booking, // awardReward — só a luta do jogador ganha carta
      );
      // CombatAdapter só resolve a luta — cartel/moral/popularidade/efeitos
      // pós-luta são aplicados aqui (mesmos side effects de antes), via
      // FightOutcome. IA-vs-IA recebe exatamente o mesmo tratamento.
      result.date = fightDateISO;
      this._applyCardFightOutcome(fighterA, fighterB, result, fightDateISO);

      result.tactics = tactics;

      // A fita registra o que foi observável: o plano que cada um trouxe, sob
      // que holofote. Depois da luta, porque o `record` já está atualizado —
      // é ele que decide se a rampa de novato ainda vale.
      const wonA = result.isDraw ? null : result.winnerId === fighterA.id;
      TapeService.recordFight(fighterA, {
        gamePlanKey: gamePlan,
        promoTier: promo.tier,
        isTitleFight: !!fight.titleWeightClass,
        readQuality: tactics?.readQuality ?? 0,
        won: wonA,
      });
      TapeService.recordFight(fighterB, {
        gamePlanKey: tactics?.opponentPlanKey ?? 'balanced',
        promoTier: promo.tier,
        isTitleFight: !!fight.titleWeightClass,
        won: wonA === null ? null : !wonA,
      });

      result.eventId = eventId;
      result.card = fight.card;
      result.isTitleFight = !!fight.titleWeightClass;
      result.titleWeightClass = fight.titleWeightClass || null;
      // P11.2 — rating no momento da luta (antes de lesão/sequela mexerem
      // nos atributos), pra manchete de zebra comparar quem "devia" ganhar.
      result.ratingA = fighterA.overallRating;
      result.ratingB = fighterB.overallRating;

      fighterA.recoverFromWeightCut();
      fighterB.recoverFromWeightCut();
      fighterB.attributes.power -= weightBullyDeltas.power;
      fighterB.attributes.strength -= weightBullyDeltas.strength;

      // Cartel dentro desta promoção — é o que abre a porta do cinturão.
      // Empate não conta nem como vitória nem como derrota no cartel.
      if (!result.isDraw) {
        fighterA.registerPromoResult(promo.id, result.winnerId === fighterA.id);
        fighterB.registerPromoResult(promo.id, result.winnerId === fighterB.id);
      }

      await this.injuryService.rollInjury(fighterA, result, absWeekNow, playerFighterId);
      await this.injuryService.rollInjury(fighterB, result, absWeekNow, playerFighterId);
      this.injuryService.applySuspension(fighterA, result, absWeekNow);
      this.injuryService.applySuspension(fighterB, result, absWeekNow);

      await this.fighterCtrl.updateFighter(fighterA);
      await this.fighterCtrl.updateFighter(fighterB);

      // O cinturão troca de mãos (ou não) antes de contarmos as consequências.
      // Empate em luta de título: o campeão retém automaticamente (regra real
      // do MMA) — não chamamos resolveTitleFight (não há vencedor/perdedor
      // para coroar), mas se havia campeão defendendo, a defesa ainda conta.
      let titleOutcome = null;
      if (fight.titleWeightClass && this.titleService) {
        if (fight.interimTitle) {
          // Disputa de interino: sem empate coroando ninguém (não há
          // interino anterior pra "reter" aqui — a luta nasceu já sem um).
          if (!result.isDraw) {
            titleOutcome = await this.titleService.resolveInterimTitleFight(
              promo, fight.titleWeightClass, result.winnerId, result.loserId, absWeekNow
            );
          }
        } else if (!result.isDraw) {
          titleOutcome = await this.titleService.resolveTitleFight(
            promo, fight.titleWeightClass, result.winnerId, result.loserId, absWeekNow, playerFighterId
          );
          result.titleRetained = titleOutcome.retained;
        } else {
          const champId = promo.championOf(fight.titleWeightClass);
          if (champId && (champId === fighterA.id || champId === fighterB.id)) {
            result.titleRetained = true;
            result.titleDrawDefenses = await this.titleService.recordDrawDefense(promo, fight.titleWeightClass);
          }
        }
      }

      result.id = generateId();
      await this.db.add('fights', { ...result, fighterId: fighterA.id });

      results.push(result);

      // 4) Consequências para o jogador
      if (fight.booking) {
        // Você acabou de passar 15 minutos dentro do octógono com o cara —
        // sabe mais sobre ele do que qualquer olheiro. Tarde demais.
        if (this.scoutingService) await this.scoutingService.observeAfterFight(fighterB.id);
        await this._settlePlayerFight(fight, result, promo, absWeekNow, titleOutcome);
        await this.careerEvents?.emit(CAREER_EVENT.FIGHT_COMPLETED, {
          result,
          booking: fight.booking,
          promotionId: promo.id,
          absWeekNow,
        });
        if (!result.isDraw) {
          await this.careerEvents?.emit(
            result.winnerId === fighterA.id ? CAREER_EVENT.FIGHT_WON : CAREER_EVENT.FIGHT_LOST,
            { result, booking: fight.booking, absWeekNow }
          );
        }
      }

      if (this.careerEventBus) {
        await this.careerEventBus.emit(CAREER_EVENT_TYPES.FIGHT_COMPLETED, {
          eventId,
          absWeek: absWeekNow,
          promotionId: promo.id,
          promotionName: promo.name,
          playerFighterId,
          fighterAId: fighterA.id,
          fighterBId: fighterB.id,
          isMainCard: fight.card === 'main',
          cornerTally: result.cornerTally || [],
          result,
        });
      }
    }

    // A transmissão sobe: preliminares, depois card principal, e o cinturão
    // fecha a noite. (Antes o card principal abria o evento — invertido.)
    const billing = (r) => (r.isTitleFight ? 2 : r.card === 'main' ? 1 : 0);
    results.sort((a, b) => billing(a) - billing(b));

    const event = new Event({
      id: eventId,
      name: promo.nextEventName(),
      date: absWeekToDate(absWeekNow, startedAt).toISOString(),
      mainCard: fights.filter(f => f.card === 'main').map(f => ({ fighterAId: f.fighterA.id, fighterBId: f.fighterB.id })),
      prelimCard: fights.filter(f => f.card === 'prelim').map(f => ({ fighterAId: f.fighterA.id, fighterBId: f.fighterB.id })),
      status: 'completed',
      results,
    });
    event.promotionId = promo.id;
    event.promotionName = promo.name;
    event.tier = promo.tier;
    event.absWeek = absWeekNow;
    await this.db.put('events', event);

    promo.eventsHosted++;
    promo.nextEventAbsWeek = absWeekNow + promo.cadenceWeeks;
    await this.db.put('organization', promo);

    const playerResults = results.filter(r =>
      playerFighterIds.has(r.fighterAId) || playerFighterIds.has(r.fighterBId)
    );

    return { event, results, playerResults, playerFighterIds };
  }

  // Side-effects always applied after resolving a bout (W-L-D record, fight
  // history, morale, popularity, post-fight fatigue/effects, KO accumulated
  // damage). CombatAdapter only returns a result object — without this, no
  // fight would update the cartel. Lives in FightOutcome now (era o motor
  // antigo simulateFight que aplicava isto internamente).
  _applyCardFightOutcome(fighterA, fighterB, result, dateISO) {
    const method = { method: result.method };
    const round = result.round || 3;
    if (result.isDraw) {
      FightOutcome._updateFighter(fighterA, fighterB, 'draw', method, round, dateISO);
      FightOutcome._updateFighter(fighterB, fighterA, 'draw', method, round, dateISO);
      FightOutcome._updatePopularity(fighterA, fighterB, method, 'draw');
      FightOutcome._updatePopularity(fighterB, fighterA, method, 'draw');
      fighterA.applyPostFightEffects();
      fighterB.applyPostFightEffects();
      return;
    }
    const winner = result.winnerId === fighterA.id ? fighterA : fighterB;
    const loser = result.winnerId === fighterA.id ? fighterB : fighterA;
    FightOutcome._updateFighter(winner, loser, 'win', method, round, dateISO);
    FightOutcome._updateFighter(loser, winner, 'loss', method, round, dateISO);
    FightOutcome._updatePopularity(winner, loser, method, 'win');
    FightOutcome._updatePopularity(loser, winner, method, 'loss');
    winner.applyPostFightEffects();
    loser.applyPostFightEffects();
    FightOutcome._applyAccumulatedDamage(winner, loser, result);
  }

  // Fase 3 — o que a luta significou pro Livro. É aqui que o sistema deixa de
  // ser matemática e vira história: a isca que funcionou, a arma que ninguém
  // esperava, e a noite em que o mundo finalmente te decifrou.
  async _settleTape(fighter, result, promo, absWeekNow, won, isDraw) {
    const tactics = result.tactics;
    if (!tactics) return;

    const tape = TapeService.tapeOf(fighter);
    const log = (type, magnitude, data) => this.careerLogService?.publish(fighter.id, type, absWeekNow, magnitude, data);

    if (tactics.weaponReveal) {
      const plan = GAME_PLANS[tactics.weaponReveal.planKey];
      const opponentName = result.fighterBName === fighter.name ? result.fighterAName : result.fighterBName;

      // A arma não surpreende quem esteve do outro lado dela no sparring. Esse
      // é o preço do bom parceiro de treino, e ele só cobra aqui — depois de
      // você ter gasto um camp inteiro instalando a coisa.
      if (tactics.weaponReveal.sawItComing) {
        await this.notifService.add('warning', '🥋 Ele Já Tinha Visto', `${opponentName} rodou com você no treino. ${plan.label} não surpreendeu ninguém — ele estava do outro lado dela todo dia.`);
        await log('weapon_seen_coming', 55, { plan: plan.label, opponentName });
      } else {
        await this.notifService.add('success', '🧰 Carta na Manga', `Ninguém esperava. Você entrou com ${plan.label} e ${opponentName} preparou a luta contra outro lutador.`);
        await log('weapon_revealed', 60, { plan: plan.label, opponentName, won: !!won });
      }
    }

    if (tactics.baitOutcome === 'success') {
      await this.notifService.add('success', '🎣 A Isca Funcionou', 'Ele lutou contra o seu passado. Você trouxe outra coisa.');
      await log('bait_success', 50, { plan: GAME_PLANS[tactics.opponentPlanKey]?.label });
    } else if (tactics.baitOutcome === 'failed') {
      await this.notifService.add('warning', '🎣 A Isca Falhou', 'Você abandonou o que sabe fazer e não achou o que procurava.');
    } else if (tactics.countered && !won && !isDraw) {
      await this.notifService.add('warning', '📖 Ele Te Leu', `Não foi sorte. ${result.winnerName} sabia exatamente o que você ia trazer.`);
    }

    // Decifrado: duas derrotas seguidas sob leitura alta. Não é uma má fase —
    // é o mundo tendo aberto o seu livro. Marca o ponto de virada da carreira.
    const readHigh = tactics.readQuality >= TAPE_CONFIG.FIGURED_OUT_READ;
    if (!won && !isDraw && readHigh && tape.figuredOutAtAbsWeek === 0 && (fighter.loseStreak || 0) >= 2) {
      tape.figuredOutAtAbsWeek = absWeekNow;
      tape.winsSinceFiguredOut = 0;
      await this.notifService.add('danger', '📖 Decifrado', 'O mundo abriu o livro sobre você. Continuar o mesmo lutador é continuar perdendo.');
      await log('figured_out', 75, { signature: GAME_PLANS[tactics.signature]?.label || 'seu jogo' });
    }

    // E a saída: três vitórias depois de ser decifrado. O segundo ato.
    if (tape.figuredOutAtAbsWeek > 0 && tape.winsSinceFiguredOut >= TAPE_CONFIG.REINVENTION_WINS) {
      tape.figuredOutAtAbsWeek = 0;
      tape.winsSinceFiguredOut = 0;
      await this.notifService.add('success', '🔄 Reinvenção', 'Você voltou outro lutador. O livro que escreveram sobre você não serve mais.');
      await log('reinvention', 85, { weeks: absWeekNow });
    }

    await this.fighterCtrl.updateFighter(fighter);
  }

  async _settlePlayerFight(fight, result, promo, absWeekNow, titleOutcome = null) {
    const { booking } = fight;
    const fighter = fight.fighterA; // o lutador do jogador é sempre o córner A
    const isDraw = !!result.isDraw;
    const won = !isDraw && result.winnerId === fighter.id;

    // Épico F1: hype da coletiva vira bônus na bolsa
    // Rivalidade: luta contra o rival ativo vende mais ingresso — a
    // intensidade vira o mesmo tipo de bônus que o hype de coletiva.
    let rivalryHypeBonus = 0;
    let rivalry = null;
    if (this.rivalryService) {
      rivalry = await this.rivalryService.getRivalryBetween(fighter.id, fight.fighterB.id);
      if (rivalry) rivalryHypeBonus = rivalry.intensity * RIVALRY_CONFIG.HYPE_PER_INTENSITY * HYPE_PURSE_RATIO;
    }
    const hypeBonus = (fighter.pcHype || 0) * HYPE_PURSE_RATIO + rivalryHypeBonus;
    // P5.3: Last fight bonus — 2x purse for the final fight
    const lastFightMult = fighter.lastFightPending ? (fighter.lastFightBonus || 1.0) : 1.0;
    const grossPurse = Math.round((booking.purse + (won ? booking.winBonus : 0) + hypeBonus) * lastFightMult);
    // Limpa o hype após usar — não acumular para a próxima luta
    fighter.pcHype = 0;
    // Libera a coletiva para a PRÓXIMA luta marcada.
    fighter.pcDoneForOfferId = null;

    // §A.2/§C.1: o corte já não é da academia — primeiro o contrato de
    // promoção (purseShare do atleta), depois o empresário (se tiver um).
    const afterPurseShare = Math.round(grossPurse * (fighter.purseShare ?? 0.8));
    const { managerCut, netPurse, manager } = this.managerService
      ? await this.managerService.applyCut(fighter, afterPurseShare)
      : { managerCut: 0, netPurse: afterPurseShare, manager: null };

    const bonusTags = [hypeBonus > 0 ? 'hype' : null, rivalryHypeBonus > 0 ? `rivalidade ${rivalry.intensityLabel.toLowerCase()}` : null].filter(Boolean);
    fighter.addTransaction(absWeekNow, `Bolsa — ${promo.short}${manager ? ` (empresário: -$${managerCut.toLocaleString()})` : ''}${bonusTags.length ? ` (c/ ${bonusTags.join(' + ')})` : ''}`, netPurse);
    fighter.careerEarnings = (fighter.careerEarnings || 0) + grossPurse;

    // Fase 1: Bônus pós-luta (FOTN/POTN)
    const bonuses = this._calculatePostFightBonuses(result, fighter, fight.fighterB);
    for (const bonus of bonuses) {
      if (bonus.bothFighters) {
        const bonusValue = Math.round(grossPurse * bonus.purseBonus);
        fighter.addTransaction(absWeekNow, `${bonus.label}`, bonusValue);
        fighter.updatePopularity(bonus.popularityGain);
        fighter.fightNightBonuses = (fighter.fightNightBonuses || 0) + 1;

        if (fight.fighterB) {
          fight.fighterB.addTransaction(absWeekNow, `${bonus.label}`, bonusValue);
          await this.fighterCtrl.updateFighter(fight.fighterB);
        }
      } else if (bonus.winnerId === fighter.id) {
        const bonusValue = Math.round(grossPurse * bonus.purseBonus);
        fighter.addTransaction(absWeekNow, `${bonus.label}`, bonusValue);
        fighter.updatePopularity(bonus.popularityGain);
        fighter.performanceBonuses = (fighter.performanceBonuses || 0) + 1;
      }
    }

    const opponentName = result.fighterBName === fighter.name ? result.fighterAName : result.fighterBName;

    if (isDraw) {
      // Empate não conta como vitória nem derrota no cartel.
      await this.notifService.add('info', '🤝 Empate', `Você empatou com ${result.fighterBName} (${result.method}) no ${promo.nextEventName()}. Bolsa líquida: $${netPurse.toLocaleString()}.`);
    } else if (won) {
      const isFinish = result.method && !result.method.startsWith('Decision');
      await this.notifService.add('success', '🏆 Vitória!', `Você venceu ${opponentName} por ${result.method} no ${promo.nextEventName()}. Bolsa líquida: $${netPurse.toLocaleString()}.${hypeBonus > 0 ? ` ($${hypeBonus.toLocaleString()} de bônus de hype)` : ''}`);
      if (this.careerLogService && isFinish) {
        await this.careerLogService.publish(fighter.id, 'finish', absWeekNow, promo.tier === 1 ? 70 : 45, { opponentName, method: result.method, promo: promo.short });
      }
    } else {
      await this.notifService.add('warning', 'Derrota', `Você foi derrotado por ${result.winnerName} (${result.method}). Bolsa líquida: $${netPurse.toLocaleString()}.`);
    }

    // Torcida viva — persona + energia da arena + cartas de fãs (história, não HUD frio)
    const crowdReaction = CrowdService.reactToFight({
      fighter,
      opponentName,
      won,
      isDraw,
      method: result.method,
      rivalryIntensity: rivalry?.intensity || 0,
      isTitleFight: !!booking.isTitleFight,
    });
    if (crowdReaction.popDelta) fighter.updatePopularity(crowdReaction.popDelta);
    if (crowdReaction.moraleDelta) fighter.applyMoraleChange(crowdReaction.moraleDelta);
    fighter.publicPersona = crowdReaction.persona;
    const fanMail = CrowdService.generateFanMail({
      fighter,
      opponentName,
      won,
      isDraw,
      method: result.method,
      rivalryIntensity: rivalry?.intensity || 0,
    });
    await this.db.put('gameState', {
      id: 'crowdReaction',
      absWeek: absWeekNow,
      reaction: crowdReaction,
      fanMail,
      opponentName,
    });
    if (crowdReaction.lines?.[0]) {
      await this.notifService.add('headline', `🏟️ ${crowdReaction.chant}`, crowdReaction.lines[0]);
    }
    if (this.careerLogService && crowdReaction.energy >= 75) {
      await this.careerLogService.publish(fighter.id, 'crowd_night', absWeekNow, 40 + Math.floor(crowdReaction.energy / 5), {
        chant: crowdReaction.chant,
        energy: crowdReaction.energy,
        persona: crowdReaction.persona,
        opponentName,
      });
    }

    await this._settleTape(fighter, result, promo, absWeekNow, won, isDraw);

    // Título em empate: o campeão retém automaticamente (regra real do MMA) —
    // resolveTitleFight nunca foi chamado, então o mapa de campeões não mudou.
    // A contagem de defesas (result.titleDrawDefenses) já foi feita em
    // recordDrawDefense(), chamado antes deste método.
    if (fight.titleWeightClass && isDraw && !fight.interimTitle) {
      const division = getWeightClassName(fight.titleWeightClass);
      await this.notifService.add(
        'info',
        '🛡️ Cinturão Mantido (Empate)',
        booking.titleRole === TITLE_ROLE.DEFENSE
          ? `Você empatou e mantém o cinturão ${division} do ${promo.short}${result.titleDrawDefenses ? ` (${result.titleDrawDefenses}ª defesa)` : ''}.`
          : `Você empatou pelo cinturão ${division} — o campeão atual mantém o título.`
      );
    } else if (fight.interimTitle && isDraw) {
      await this.notifService.add(
        'info',
        '🥈 Interino Segue Vago',
        `Empate na disputa do cinturão interino ${getWeightClassName(fight.titleWeightClass)} — ninguém foi coroado.`
      );
    }

    // Expõe dados financeiros no resultado para a tela pós-luta
    result._purse = grossPurse;
    result._netPurse = netPurse;
    result._managerCut = managerCut;
    result._hypeBonus = hypeBonus;
    result._won = won;

    // O cinturão é a única coisa que pesa mais que a bolsa.
    if (titleOutcome && fight.interimTitle) {
      // Interino: nunca "campeão de verdade" — a mensagem tem que deixar
      // isso claro, senão o jogador acha que virou o titular de verdade
      // enquanto o campeão lesionado ainda segura o cinturão oficial.
      const division = titleOutcome.division;
      if (won) {
        await this.notifService.add(
          'achievement',
          '🥈 Campeão Interino!',
          `Você é o novo campeão INTERINO ${division} do ${promo.short}. O cinturão de verdade volta em jogo quando o titular voltar a lutar.`
        );
        if (this.careerLogService) {
          await this.careerLogService.publish(fighter.id, 'title_won', absWeekNow, 55, { division, promo: promo.short, interim: true });
        }
      } else {
        await this.notifService.add('warning', 'Interino Escapou', `Você não conquistou o cinturão interino ${division} — ${result.winnerName} levou.`);
      }
    } else if (titleOutcome) {
      const division = titleOutcome.division;
      if (won) {
        await this.notifService.add(
          'achievement',
          titleOutcome.retained ? '🛡️ Cinturão Defendido!' : '🏆 CAMPEÃO!',
          titleOutcome.retained
            ? `Você defendeu o cinturão ${division} do ${promo.short} pela ${titleOutcome.defenses}ª vez.`
            : `Você é o novo campeão ${division} do ${promo.name}!`
        );
        if (this.careerLogService) {
          await this.careerLogService.publish(fighter.id, 'title_won', absWeekNow, titleOutcome.retained ? 60 : 95, { division, promo: promo.short, defense: titleOutcome.retained });
        }
      } else {
        await this.notifService.add(
          'warning',
          booking.titleRole === TITLE_ROLE.DEFENSE ? '💔 Cinturão Perdido' : 'Chance Desperdiçada',
          booking.titleRole === TITLE_ROLE.DEFENSE
            ? `Você perdeu o cinturão ${division} para ${result.winnerName}.`
            : `Você não conquistou o cinturão ${division}. Vai precisar reconstruir o cartel.`
        );
      }
    }

    // Prontidão (item 4): o camp desta luta acabou — pontos zeram; o
    // próximo booking começa do zero. E se o gap foi decisivo (>=15), o
    // jogo DIZ isso — efeito escondido foi exatamente a queixa do item 3.
    fighter.campReadinessPoints = 0;
    const readiness = result.tactics?.readiness;
    if (readiness && Math.abs(readiness.gap) >= 15) {
      if (readiness.gap < 0) {
        await this.notifService.add('warning', '📉 Despreparado',
          `Você entrou com prontidão ${readiness.player}% contra ~${readiness.opponent}% de ${fight.fighterB.name}. ${won ? 'Venceu mesmo assim — desta vez.' : 'A diferença de preparo pesou.'}`);
      } else if (won) {
        await this.notifService.add('info', '📈 Preparo Venceu',
          `Sua prontidão (${readiness.player}%) superou a de ${fight.fighterB.name} (~${readiness.opponent}%). O camp pagou.`);
      }
    }

    // Épico F2: registrar última semana de luta
    fighter.lastFightAbsWeek = absWeekNow;
    await this.fighterCtrl.updateFighter(fighter);

    booking.status = OFFER_STATUS.COMPLETED;
    booking.resultId = result.id;
    await this.db.put('offers', booking);

    // Épico B: consumir luta do contrato exclusivo. `null` = empate — não
    // reseta nem incrementa derrotas seguidas (não é vitória nem derrota).
    if (this.contractService) {
      await this.contractService.consumeFight(fighter.id, isDraw ? null : won, absWeekNow);
    }
  }

  // Fase 1: calcula bônus pós-luta (FOTN/POTN) com base no resultado.
  // O motor é chamado de _settlePlayerFight e decide quem ganha o quê.
  _calculatePostFightBonuses(result, fighterA, fighterB) {
    const bonuses = [];

    // Performance of the Night: KO/TKO rápido ou submissão no 1º round
    const isQuickFinish = result.round === 1 &&
      (result.method?.startsWith('KO') || result.method?.startsWith('TKO') || result.method === 'Submission');
    if (isQuickFinish) {
      bonuses.push({
        type: 'performance',
        label: POST_FIGHT_BONUSES.PERFORMANCE_OF_NIGHT.label,
        purseBonus: POST_FIGHT_BONUSES.PERFORMANCE_OF_NIGHT.purseBonus,
        popularityGain: POST_FIGHT_BONUSES.PERFORMANCE_OF_NIGHT.popularityGain,
        winnerId: result.winnerId,
      });
    }

    // Fight of the Night: 3+ rounds, scores próximos
    const totalRounds = result.rounds?.length || result.round || 3;
    const scoreDiff = Math.abs((result.totalScoreA || 0) - (result.totalScoreB || 0));
    const isFOTN = totalRounds >= 3 && scoreDiff < 15;
    if (isFOTN) {
      bonuses.push({
        type: 'fight_of_night',
        label: POST_FIGHT_BONUSES.FIGHT_OF_NIGHT.label,
        purseBonus: POST_FIGHT_BONUSES.FIGHT_OF_NIGHT.purseBonus,
        popularityGain: POST_FIGHT_BONUSES.FIGHT_OF_NIGHT.popularityGain,
        winnerId: result.winnerId,
        bothFighters: true,
      });
    }

    return bonuses;
  }

  // Ofertas aceitas desta promoção cuja luta é nesta semana (ou atrasada)
  async _getBookings(promotionId, absWeekNow) {
    const accepted = await this.db.getIndex('offers', 'status', OFFER_STATUS.ACCEPTED);
    return accepted.filter(o => o.promotionId === promotionId && o.eventAbsWeek <= absWeekNow);
  }

  async _buildAiCard(promo, excludeIds, absWeekNow) {
    const rosterData = await this.db.getIndex('fighters', 'organizationId', promo.id);
    const available = rosterData
      .map(d => new Fighter(d))
      .filter(f => f.status === 'roster' && !excludeIds.has(f.id) && f.availableFromAbsWeek <= absWeekNow);

    const byWeight = {};
    for (const f of available) {
      (byWeight[f.weightClass] ||= []).push(f);
    }

    // Pareia vizinhos de rating dentro de cada divisão (com chance de caos,
    // ver _pairDivision), alternando divisões pra variar os cards de evento
    // para evento.
    const divisionPairs = [];
    for (const fighters of Object.values(byWeight)) {
      fighters.sort((a, b) => b.overallRating - a.overallRating);
      const pairs = this._pairDivision(fighters, promo);
      if (pairs.length > 0) divisionPairs.push(pairs);
    }

    // Round-robin entre divisões
    const card = [];
    let idx = 0;
    while (card.length < WORLD_CONFIG.AI_FIGHTS_PER_EVENT && divisionPairs.length > 0) {
      const div = divisionPairs[idx % divisionPairs.length];
      const pair = div.shift();
      if (pair) card.push(pair);
      if (div.length === 0) {
        // Não decrementa idx: após o splice o próximo item já cai neste slot,
        // e idx negativo quebraria o módulo (JS: -1 % n === -1 → índice -1).
        divisionPairs.splice(idx % divisionPairs.length, 1);
      } else {
        idx++;
      }
    }

    return card;
  }

  // P11.1 — fator caos: por padrão pareia vizinhos de rating (lutas
  // sensatas), mas cada divisão rola uma vez por evento a chance de uma
  // luta estranha — um "styles clash" (topo da divisão contra alguém da
  // metade de baixo) ou um teste de prospecto contra veterano. Precisa de
  // pelo menos 4 lutadores pra sobrar gente pro resto do pareamento normal.
  _pairDivision(fighters, promo) {
    const list = [...fighters];
    const pairs = [];
    const mult = WORLD_CONFIG.AI_CHAOS_TIER_MULTIPLIER[promo.tier] ?? 1;

    if (list.length >= 4) {
      const roll = Math.random();
      const experimentalChance = WORLD_CONFIG.AI_CHAOS_EXPERIMENTAL_BASE_CHANCE * mult;
      const veteranProspectChance = WORLD_CONFIG.AI_CHAOS_VETERAN_PROSPECT_BASE_CHANCE * mult;

      if (roll < experimentalChance) {
        const top = list.shift();
        const rivalIdx = Math.floor(list.length / 2) + Math.floor(Math.random() * Math.ceil(list.length / 2));
        const [rival] = list.splice(Math.min(rivalIdx, list.length - 1), 1);
        pairs.push([top, rival]);
      } else if (roll < experimentalChance + veteranProspectChance) {
        const veteran = list.find(f => (f.age || 0) >= WORLD_CONFIG.AI_CHAOS_VETERAN_AGE_MIN);
        const prospect = [...list].reverse().find(f => f !== veteran && (f.totalFights || 0) <= WORLD_CONFIG.AI_CHAOS_PROSPECT_MAX_FIGHTS);
        if (veteran && prospect) {
          pairs.push([veteran, prospect]);
          list.splice(list.indexOf(prospect), 1);
          list.splice(list.indexOf(veteran), 1);
        }
      }
    }

    for (let i = 0; i + 1 < list.length; i += 2) {
      pairs.push([list[i], list[i + 1]]);
    }
    return pairs;
  }

  // P11.2 — giro do MMA com drama de verdade. `results` já vem ordenado por
  // billing ascendente (prelim -> main -> título, ver _runEvent), então o
  // último item é sempre o fecho da noite — antes este método pegava
  // `results[0]` (uma prelim qualquer) e chamava isso de "main event".
  _buildEventHeadlines(outcome) {
    const { event, results } = outcome;
    if (results.length === 0) return [];

    const top = results[results.length - 1];
    const headlines = [this._formatHeadline(event.name, top)];

    // Zebra num coadjuvante do card também vira manchete — senão o upset de
    // quem não fechou a noite nunca chega no jogador.
    const upset = results.find(r => r !== top && !r.isDraw && this._isUpset(r));
    if (upset) headlines.push(this._formatHeadline(event.name, upset));

    return headlines;
  }

  _isUpset(result) {
    if (result.isDraw) return false;
    const winnerRating = result.winnerId === result.fighterAId ? result.ratingA : result.ratingB;
    const loserRating = result.winnerId === result.fighterAId ? result.ratingB : result.ratingA;
    return (loserRating ?? 0) - (winnerRating ?? 0) >= WORLD_CONFIG.AI_HEADLINE_UPSET_RATING_GAP;
  }

  _formatHeadline(eventName, result) {
    if (result.isDraw) {
      return `${eventName}: ${result.fighterAName} e ${result.fighterBName} empataram.`;
    }
    const loserName = result.winnerId === result.fighterAId ? result.fighterBName : result.fighterAName;
    const totalRounds = result.rounds?.length || result.round || 3;
    const scoreDiff = Math.abs((result.totalScoreA || 0) - (result.totalScoreB || 0));
    const isFOTN = totalRounds >= 3 && scoreDiff < 15;
    const prefix = this._isUpset(result) ? '😱 ZEBRA — ' : isFOTN ? '🔥 Luta Disputada — ' : '';
    return `${prefix}${eventName}: ${result.winnerName} venceu ${loserName} por ${result.method}.`;
  }

  async _findReplacement(promotionId, fighter, excludeIds, absWeekNow) {
    const rosterData = await this.db.getIndex('fighters', 'organizationId', promotionId);
    const candidates = rosterData
      .map(d => new Fighter(d))
      .filter(f =>
        f.status === 'roster' &&
        f.weightClass === fighter.weightClass &&
        !excludeIds.has(f.id) &&
        f.availableFromAbsWeek <= absWeekNow
      )
      .sort((a, b) =>
        Math.abs(a.overallRating - fighter.overallRating) -
        Math.abs(b.overallRating - fighter.overallRating)
      );
    return candidates[0] || null;
  }

  // P4.x — aplica o bônus de "chegou maior" quando a oferta marcou o
  // adversário como weight bully. Devolve o DELTA de verdade aplicado
  // (pós-clamp em 99, não o bônus nominal) para o chamador reverter exato
  // depois da luta — um adversário perto do teto teria a soma cortada mas a
  // subtração ingênua não, drenando pontos permanentemente a cada luta.
  _applyWeightBullyBoost(fighterB, booking) {
    const bonus = booking?.opponentWeightBully
      ? Math.round(fighterB.weightCut.naturalWeight * WEIGHT_BULLY_CONFIG.POWER_PER_KG)
      : 0;
    if (bonus <= 0) {
      fighterB.applyWeightCutImpact();
      return { power: 0, strength: 0 };
    }
    const powerBefore = fighterB.attributes.power;
    const strengthBefore = fighterB.attributes.strength;
    fighterB.attributes.power = Math.min(99, powerBefore + bonus);
    fighterB.attributes.strength = Math.min(99, strengthBefore + bonus);
    fighterB.applyWeightCutImpact(WEIGHT_BULLY_CONFIG.CARDIO_IMPACT_MULT);
    return { power: fighterB.attributes.power - powerBefore, strength: fighterB.attributes.strength - strengthBefore };
  }

  async _refillFreeAgents() {
    const free = await this.db.getIndex('fighters', 'status', 'free');
    if (free.length >= WORLD_CONFIG.FREE_AGENT_MIN) return;

    const count = WORLD_CONFIG.FREE_AGENT_POOL - free.length;
    for (let i = 0; i < count; i++) {
      const weightClass = CORE_WEIGHT_CLASSES[Math.floor(Math.random() * CORE_WEIGHT_CLASSES.length)];
      const fighter = DataGenerator.generateFighter(null, { weightClass, skillRange: [30, 55] });
      fighter.id = generateId();
      await this.db.put('fighters', fighter);
    }
  }

  // G1: verifica cinturões interinos.
  // 1. Se campeão está lesionado 12+ semanas → cria cinturão interino
  // 2. Se interino existe e campeão original já se recuperou → promove interino a definitivo
  async _checkInterimTitles(absWeekNow, promotions) {
    const all = await this.fighterCtrl.getAllFighters();

    for (const promo of promotions) {
      for (const wc of CORE_WEIGHT_CLASSES) {
        const champId = promo.championOf(wc);
        if (!champId) continue;
        const champ = all.find(f => f.id === champId);

        // FASE 1: Criar interino (só quando o campeão ATIVO está lesionado 12+ semanas)
        if (champ && champ.status === 'injured') {
          const injuryEnd = champ.availableFromAbsWeek || 0;
          const weeksOut = Math.max(0, injuryEnd - absWeekNow);
          if (weeksOut >= 12 && !promo.interimChampionOf(wc)) {
            const contenders = await this.titleService.contenderRanking(promo, wc);
            const top = contenders[0];
            if (top && top.id !== champId) {
              promo.crownInterim(top.id, wc, absWeekNow);
              await this.notifService.add('headline', 'Cinturão Interino',
                `${promo.short} criou cinturão interino dos ${wc}! ${top.name} é o campeão interino enquanto ${champ.name} se recupera.`);
            }
          }
        }

        // FASE 2: Promover interino a definitivo — só quando o campeão
        // original REALMENTE não volta mais (se aposentou ou saiu do banco).
        const interimId = promo.interimChampionOf(wc);
        if (interimId) {
          const championGone = !champ || champ.status === 'retired';
          if (championGone) {
            const promotedId = promo.promoteInterim(wc);
            if (promotedId) {
              const name = all.find(f => f.id === promotedId)?.name || 'Desafiante';
              await this.notifService.add('headline', 'Cinturão Definitivo',
                `${promo.short} promoveu ${name} a campeão definitivo dos ${wc}!`);
            }
          }
        }
      }
    }
    for (const promo of promotions) {
      await this.db.put('organization', promo);
    }
  }

  // Virada de ano (semana 52): aposentadorias e nova safra de prospectos
  async _processYearEnd(absWeekNow, playerFighterId, startedAt = null) {
    if (absWeekNow % 52 !== 0) return;
    const inGameNowISO = absWeekToDate(absWeekNow, startedAt).toISOString();

    const all = await this.fighterCtrl.getAllFighters();
    for (const f of all) {
      if (f.status === 'retired') continue;
      f.age = (f.age || 28) + 1;

      // Jogador envelhece mas nunca aposenta por sorteio — a idade dele ainda
      // precisa ser persistida antes do continue.
      if (f.id === playerFighterId) {
        await this.fighterCtrl.updateFighter(f);
        continue;
      }

      const age = f.age;
      let chance = 0;
      if (age >= 40) chance = 0.35;
      else if (age >= 38) chance = 0.18;
      else if (age >= 35) chance = 0.06;

      if (chance > 0 && Math.random() < chance) {
        f.status = 'retired';
        f.organizationId = null;
        const wasPlayerFighter = f.id === playerFighterId;
        f.academyId = null;
        // Fase 1: ex-atletas do jogador nunca são purgados do banco (abaixo).
        if (wasPlayerFighter) f.wasPlayerFighter = true;

        // Campeão que pendura as luvas deixa o cinturão vago.
        const vacated = this.titleService ? await this.titleService.vacateBeltsOf(f.id) : [];

        const eligibility = HallOfFame.checkEligibility(f);
        if (eligibility.eligible) {
          const existing = await this.db.get('hallOfFame', f.id);
          if (!existing) {
            const entry = HallOfFame.induct(f, inGameNowISO, vacated);
            entry.id = f.id;
            await this.db.put('hallOfFame', entry);
          }
        }

        if (wasPlayerFighter) {
          await this.notifService.add('hall-of-fame', '🏆 Aposentadoria',
            `${f.name} pendurou as luvas aos ${age} anos após uma carreira histórica. Clique para ver a cerimônia.`);
          const gameState = await this.db.get('gameState', 'state');
          if (gameState) {
            gameState.meta = gameState.meta || {};
            gameState.meta.lastRetirementFighterId = f.id;
            await this.db.put('gameState', gameState);
          }
        }
        if (vacated.length > 0) {
          await this.notifService.add('info', 'Cinturão Vago', `${f.name} se aposentou como campeão. O cinturão ${vacated[0].promotionShort} está vago.`);
        }
      }

      // Identidade visual — unlocks + era; muta appearance só se autoEvolve
      VisualIdentityService.syncUnlocks(f);
      const visualTick = VisualIdentityService.yearlyTick(f);
      if (visualTick?.stage) f.visualStage = visualTick.stage;
      if (visualTick?.changed && visualTick.appearance) {
        f.appearance = visualTick.appearance;
      }
      if (!f.visualArchetype) {
        f.visualArchetype = VisualIdentityService.resolveArchetypeId(f);
      }

      // Persiste SEMPRE, aposentando ou não — o f.age++ acima se perde se o
      // save ficar só dentro do branch de aposentadoria.
      await this.fighterCtrl.updateFighter(f);
    }

    const count = this._annualDraftCount();
    const prospects = [];
    for (let i = 0; i < count; i++) {
      const weightClass = CORE_WEIGHT_CLASSES[Math.floor(Math.random() * CORE_WEIGHT_CLASSES.length)];
      const prospect = DataGenerator.generateProspect(weightClass);
      prospect.id = generateId();
      // Data-no-jogo de entrada no mundo — senão toda safra "estreia" no mesmo
      // dia real do fast-forward.
      prospect.createdAt = inGameNowISO;
      prospects.push(prospect);
    }

    // Fase 1: todo prospecto entra no circuito regional com roster ATIVO —
    // sem isso eles nunca aparecem em evento nenhum e ficam "soltos" pra
    // sempre, sem cartel, sem chance de subir. Uma fração entra já afiliada
    // a uma Academia (flavor de mundo vivo, §A.3 — sem mecânica de "roubo",
    // só cor local: "fulano já chegou contratado pela Fortaleza MMA").
    const tier3Promos = PROMOTIONS.filter(p => p.tier === 3);
    let affiliated = 0;
    for (const p of prospects) {
      p.status = 'roster';
      p.organizationId = tier3Promos[Math.floor(Math.random() * tier3Promos.length)].id;
      if (ACADEMIES.length > 0 && Math.random() < WORLD_CONFIG.ACADEMY_AFFILIATION_CHANCE) {
        const academy = ACADEMIES[Math.floor(Math.random() * ACADEMIES.length)];
        p.academyId = academy.id;
        affiliated++;
      }
      await this.db.put('fighters', p);
    }

    // Fase 1b: escada de tiers — promove destaques do regional pro Nacional
    // e do Nacional pra Elite, relegando os piores de cima pra abrir vaga.
    await this._processTierMovement(absWeekNow, playerFighterId);

    // Fase 1: teto de populacao — aposenta veteranos IA irrelevantes se excedeu
    const allNow = await this.fighterCtrl.getAllFighters();
    await this._trimPopulationIfNeeded(allNow, playerFighterId);

    // Fase 1: purga aposentados sem relevância — impede o banco de crescer sem
    // teto ao longo de carreiras longas (cada getAllFighters lê o store inteiro).
    await this._purgeForgettableRetired();

    // Fase 1: registra a safra no doc worldGen
    const worldGen = (await this.db.get('gameState', 'worldGen')) || { id: 'worldGen', lastGenAbsWeek: 0, totalGenerated: 0 };
    worldGen.lastGenAbsWeek = absWeekNow;
    worldGen.totalGenerated = (worldGen.totalGenerated || 0) + count;
    await this.db.put('gameState', worldGen);

    const msg = `${count} jovens prospectos chegaram ao mercado${affiliated > 0 ? ` (${affiliated} já afiliados a academias)` : ''}.`;
    await this.notifService.add('success', 'Nova Safra', msg);
  }

  // Fase 1b: escada de tiers pra lutadores de IA. Sobe do tier mais baixo
  // pro mais alto (3→2→1) pra um lutador recém-promovido já poder, em
  // tese, ser avaliado de novo daqui a um ano.
  async _processTierMovement(absWeekNow, playerFighterId) {
    const promotions = await this.getPromotions();
    const byTier = { 1: [], 2: [], 3: [] };
    for (const p of promotions) (byTier[p.tier] || []).push(p);

    await this._promoteTier(byTier[3], byTier[2], OFFER_CONFIG.TIER_GATES[2], playerFighterId);
    await this._promoteTier(byTier[2], byTier[1], OFFER_CONFIG.TIER_GATES[1], playerFighterId);
  }

  // Promove os destaques de `fromPromos` (que batem `gate`) pra `toPromos`,
  // relegando os piores de `toPromos` de volta pra `fromPromos` quando a
  // promoção de cima já está no teto de elenco — sempre tem alguém descendo
  // quando alguém sobe, pra não inflar o elenco sem limite.
  async _promoteTier(fromPromos, toPromos, gate, playerFighterId) {
    if (fromPromos.length === 0 || toPromos.length === 0 || !gate) return;

    const candidates = [];
    for (const promo of fromPromos) {
      const roster = await this.db.getIndex('fighters', 'organizationId', promo.id);
      for (const data of roster) {
        const f = new Fighter(data);
        // O jogador sobe de tier via ContractService, não por aqui.
        if (f.status !== 'roster' || f.id === playerFighterId) continue;
        const meetsWins = (f.record?.wins || 0) >= gate.wins;
        const meetsPop = (f.popularity || 0) >= gate.popularity;
        if (!meetsWins && !meetsPop) continue;
        candidates.push(f);
      }
    }
    if (candidates.length === 0) return;

    candidates.sort((a, b) => b.overallRating - a.overallRating);

    let cursor = 0;
    const maxPerPromo = TIER_MOVEMENT_CONFIG.MAX_PROMOTIONS_PER_YEAR;

    for (const toPromo of toPromos) {
      if (cursor >= candidates.length) break;

      let roomLeft = toPromo.rosterSize - (await this._activeRosterCount(toPromo.id));
      const wanted = Math.min(maxPerPromo, candidates.length - cursor);
      if (roomLeft < wanted) {
        roomLeft += await this._relegateWorst(toPromo, fromPromos, TIER_MOVEMENT_CONFIG.MAX_RELEGATIONS_PER_YEAR, playerFighterId);
      }

      let promotedHere = 0;
      while (promotedHere < maxPerPromo && roomLeft > 0 && cursor < candidates.length) {
        const f = candidates[cursor];
        f.organizationId = toPromo.id;
        await this.fighterCtrl.updateFighter(f);
        cursor++;
        promotedHere++;
        roomLeft--;
      }

      if (promotedHere > 0) {
        await this.notifService.add(
          'info',
          '📈 Acesso',
          `${promotedHere} lutador${promotedHere === 1 ? '' : 'es'} subiu${promotedHere === 1 ? '' : 'ram'} do circuito pro ${toPromo.short}.`
        );
      }
    }
  }

  async _activeRosterCount(promotionId) {
    const roster = await this.db.getIndex('fighters', 'organizationId', promotionId);
    return roster.filter(f => f.status === 'roster').length;
  }

  // Relega os piores lutadores (menor OVR, exceto campeões atuais) de
  // `promo` pra uma das `targetPromos` (tier abaixo) — abre vaga.
  async _relegateWorst(promo, targetPromos, maxCount, playerFighterId) {
    if (targetPromos.length === 0) return 0;
    const roster = await this.db.getIndex('fighters', 'organizationId', promo.id);
    const champions = new Set(Object.values(promo.champions || {}).filter(Boolean));
    const active = roster
      .map(d => new Fighter(d))
      .filter(f => f.status === 'roster' && f.id !== playerFighterId && !champions.has(f.id))
      .sort((a, b) => a.overallRating - b.overallRating);

    let relegated = 0;
    for (const f of active) {
      if (relegated >= maxCount) break;
      const target = targetPromos[Math.floor(Math.random() * targetPromos.length)];
      f.organizationId = target.id;
      await this.fighterCtrl.updateFighter(f);
      relegated++;
    }
    return relegated;
  }

  // Contagem da safra anual — min/max em WORLD_CONFIG.DRAFT_*.
  _annualDraftCount(random = Math.random) {
    return WORLD_CONFIG.DRAFT_MIN +
      Math.floor(random() * (WORLD_CONFIG.DRAFT_MAX - WORLD_CONFIG.DRAFT_MIN + 1));
  }

  // Fase 1: se ativos (não retired/dead) > POPULATION_CAP, aposenta os piores
  // veteranos de IA (age>=32, OVR<60), nunca o jogador. Retorna quantos trimou.
  async _trimPopulationIfNeeded(allNow, playerFighterId) {
    const activeCount = allNow.filter(f => f.status !== 'retired' && f.status !== 'dead').length;
    if (activeCount <= WORLD_CONFIG.POPULATION_CAP) return 0;

    const toTrim = activeCount - WORLD_CONFIG.POPULATION_CAP;
    const candidates = allNow
      .filter(f => f.id !== playerFighterId && (f.age || 28) >= 32 && f.overallRating < 60)
      .sort((a, b) => (a.overallRating || 0) - (b.overallRating || 0));
    let trimmed = 0;
    for (const c of candidates) {
      if (trimmed >= toTrim) break;
      if (c.status !== 'retired') {
        c.status = 'retired';
        c.organizationId = null;
        await this.db.put('fighters', c);
        trimmed++;
      }
    }
    return trimmed;
  }

  // Fase 1: mantém o store 'fighters' limitado. Aposentados de IA sem relevância
  // (nunca foram o jogador, não entraram no Hall da Fama) não têm valor de jogo
  // e só pesam nas leituras semanais de getAllFighters(). Lendas e o próprio
  // jogador são preservados. Rivalidades órfãs do purgado também são removidas.
  async _purgeForgettableRetired() {
    const all = await this.fighterCtrl.getAllFighters();
    const retired = all.filter(f => f.status === 'retired');
    if (retired.length === 0) return 0;

    const rivalries = await this.db.getAll('rivalries');
    let purged = 0;
    for (const f of retired) {
      if (f.wasPlayerFighter) continue;                 // o próprio jogador
      const legend = await this.db.get('hallOfFame', f.id);
      if (legend) continue;                             // lenda: fica no Hall da Fama
      await this.db.delete('fighters', f.id);
      for (const r of rivalries) {
        if (r.fighterAId === f.id || r.fighterBId === f.id) {
          await this.db.delete('rivalries', r.id);
        }
      }
      purged++;
    }
    return purged;
  }

  // Evolução semanal para IA — compensa a ausência de _applyWeeklyTraining.
  // Roda a cada 4 semanas: fighters de IA ganham uma versão light do
  // evolve() pós-luta para não estagnarem entre lutas. Jovens (< 30)
  // têm o dobro da chance de insight.
  async _evolveAIFighters(absWeekNow, playerFighterId) {
    if (absWeekNow % 4 !== 0) return;
    const all = await this.fighterCtrl.getAllFighters();
    const toUpdate = [];
    for (const data of all) {
      if (data.id === playerFighterId) continue;
      if (data.status === 'retired' || data.status === 'injured') continue;
      const fighter = new Fighter(data);
      const isYoung = (fighter.age || 30) < 30;
      let evolved = false;

      // Atributos — item 4: com o evolve() pós-luta reduzido a ganho mental,
      // este tick é o ÚNICO treino físico da IA. Chances subidas (0.15→0.25 /
      // 0.08→0.12) pra IA acompanhar um jogador que treina toda semana —
      // calibrado junto com a nova curva do jogador.
      for (const key of Object.keys(fighter.attributes)) {
        if (Math.random() > (isYoung ? 0.25 : 0.12)) continue;
        const gain = Math.random() * 1.5 + 0.5;
        fighter.attributes[key] = Math.min(
          Math.round(gain + (fighter.attributes[key] || 50)),
          fighter.effectiveCeiling(key)
        );
        evolved = true;
      }

      // XP e proficiência de golpes (IA também melhora)
      if (Math.random() < (isYoung ? 0.20 : 0.10)) {
        fighter.addXP(Math.floor(Math.random() * 5) + 2);
        evolved = true;
      }
      if (fighter.moveset && fighter.moveset.length > 0 && Math.random() < 0.25) {
        const moveId = fighter.moveset[Math.floor(Math.random() * fighter.moveset.length)];
        const gain = Math.floor(Math.random() * 3) + 1;
        fighter.gainProficiency(moveId, gain);
        evolved = true;
      }

      if (evolved) toUpdate.push(fighter);
    }
    // Batch write em vez de um DB.put por lutador — 130+ writes/4 sem vs 1
    for (const f of toUpdate) await this.fighterCtrl.updateFighter(f);
  }
}
