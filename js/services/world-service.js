import { Promotion } from '../models/promotion.js';
import { Fighter } from '../models/fighter.js';
import { Event } from '../models/event.js';
import { OFFER_STATUS } from '../models/fight-offer.js';
import { SimulationEngine } from '../controllers/simulation.js';
import { DataGenerator } from './data-generator.js';
import { HallOfFame } from './hall-of-fame.js';
import { generateId, getWeightClassName } from '../utils/helpers.js';
import {
  ACADEMIES,
  WORLD_CONFIG,
  CORE_WEIGHT_CLASSES,
  TITLE_CONFIG,
  TITLE_ROLE,
  HYPE_PURSE_RATIO,
  PROMOTIONS,
  OFFER_CONFIG,
  TIER_MOVEMENT_CONFIG,
  PERMANENT_SCAR_TABLE,
  DNA_DISCOVERY_CONFIG,
  RIVALRY_CONFIG,
  absWeekToDate,
  computeSuspensionWeeks,
} from '../config/game-config.js';

// Motor do mundo vivo: cada promoção de IA agenda e realiza os próprios
// eventos. Lutas do jogador entram nos cards via ofertas aceitas.
export class WorldService {
  constructor(db, fighterCtrl, notifService, titleService = null, scoutingService = null, contractService = null, managerService = null, careerLogService = null, rivalryService = null) {
    this.db = db;
    this.fighterCtrl = fighterCtrl;
    this.notifService = notifService;
    this.titleService = titleService;
    this.scoutingService = scoutingService;
    this.contractService = contractService;
    this.managerService = managerService;
    this.careerLogService = careerLogService;
    this.rivalryService = rivalryService;
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
  // cornerHooks (opcional): repassado à simulação da luta do jogador para
  // permitir instruções de córner ao vivo entre rounds (ver app.js).
  async processWeek(absWeekNow, startedAt, playerFighterId, cornerHooks = null) {
    await this._recoverInjuries(absWeekNow, playerFighterId);
    if (this.titleService) await this.titleService.reconcileBelts();

    const promotions = await this.getPromotions();
    const playerEvents = [];
    const aiHeadlines = [];

    for (const promo of promotions) {
      if (absWeekNow < promo.nextEventAbsWeek) continue;

      const outcome = await this._runEvent(promo, absWeekNow, startedAt, playerFighterId, cornerHooks);
      if (!outcome) continue;

      if (outcome.playerResults.length > 0) {
        playerEvents.push(outcome);
      } else if (outcome.results.length > 0) {
        const main = outcome.results[0];
        aiHeadlines.push(main.isDraw
          ? `${outcome.event.name}: ${main.fighterAName} e ${main.fighterBName} empataram.`
          : `${outcome.event.name}: ${main.winnerName} venceu ${main.winnerId === main.fighterAId ? main.fighterBName : main.fighterAName} por ${main.method}.`);
      }
    }

    for (const headline of aiHeadlines.slice(0, 3)) {
      await this.notifService.add('info', 'Giro do MMA', headline);
    }

    await this._refillFreeAgents();
    await this._processYearEnd(absWeekNow, playerFighterId, startedAt);
    // G1: verificar cinturões interinos (toda semana)
    await this._checkInterimTitles(absWeekNow, promotions);

    return { playerEvents };
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
        opponent = await this._findReplacement(promo.id, fighter, bookedIds, absWeekNow);
        if (!opponent) {
          booking.status = OFFER_STATUS.CANCELLED;
          await this.db.put('offers', booking);
          await this.notifService.add('warning', 'Luta Cancelada', `${fighter.name} ficou sem adversário no ${promo.nextEventName()} — a bolsa foi perdida.`);
          continue;
        }
        booking.opponentId = opponent.id;
        booking.opponentName = opponent.name;

        // Cinturão não muda de mãos contra um substituto: sem o campeão
        // (ou o desafiante oficial) no córner oposto, a luta perde o título.
        if (booking.isTitleFight) {
          booking.isTitleFight = false;
          booking.titleRole = null;
          await this.notifService.add('warning', 'Cinturão Fora de Jogo', `O adversário oficial caiu. ${fighter.name} luta contra ${opponent.name}, mas o cinturão não está mais em disputa.`);
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
        titleWeightClass: booking.isTitleFight ? booking.weightClass : null,
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
    const aiPairs = await this._buildAiCard(promo.id, bookedIds, absWeekNow);
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

      fighterA.applyWeightCutImpact();
      fighterB.applyWeightCutImpact();

      // Instruções de córner ao vivo só existem para a luta do jogador,
      // e só quando o app.js fornece os hooks (fast-forward simula automático).
      let hooks = null;
      if (fight.booking && cornerHooks) {
        await cornerHooks.onFightStart?.({ fighter: fighterA, opponent: fighterB, promo });
        hooks = { onRoundEnd: (info) => cornerHooks.onRoundEnd({ ...info, fighter: fighterA, opponent: fighterB, promo }) };
      }

      // O plano de jogo é do jogador. A IA luta equilibrada.
      const gamePlan = fight.booking?.gamePlan || 'balanced';

      const fightDateISO = absWeekToDate(absWeekNow, startedAt).toISOString();
      const pressureLevel = await this._computePressureLevel(fight, promo);
      // §B.1 — pressurePerformer/bigEventNervous só se descobrem numa luta
      // que realmente pesa (metade do gatilho de C.3: pressão alta).
      if (pressureLevel >= 50) {
        if (fighterA.hasDNA('pressurePerformer')) fighterA.discoverTrait('pressurePerformer');
        if (fighterA.hasDNA('bigEventNervous')) fighterA.discoverTrait('bigEventNervous');
        if (fighterB.hasDNA('pressurePerformer')) fighterB.discoverTrait('pressurePerformer');
        if (fighterB.hasDNA('bigEventNervous')) fighterB.discoverTrait('bigEventNervous');
      }
      const result = await SimulationEngine.simulateFight(fighterA, fighterB, promo.tier === 1, hooks, gamePlan, fightDateISO, pressureLevel);
      result.eventId = eventId;
      result.card = fight.card;
      result.isTitleFight = !!fight.titleWeightClass;
      result.titleWeightClass = fight.titleWeightClass || null;

      fighterA.recoverFromWeightCut();
      fighterB.recoverFromWeightCut();

      // Cartel dentro desta promoção — é o que abre a porta do cinturão.
      // Empate não conta nem como vitória nem como derrota no cartel.
      if (!result.isDraw) {
        fighterA.registerPromoResult(promo.id, result.winnerId === fighterA.id);
        fighterB.registerPromoResult(promo.id, result.winnerId === fighterB.id);
      }

      this._rollInjury(fighterA, result, absWeekNow);
      this._rollInjury(fighterB, result, absWeekNow);
      this._applySuspension(fighterA, result, absWeekNow);
      this._applySuspension(fighterB, result, absWeekNow);

      await this.fighterCtrl.updateFighter(fighterA);
      await this.fighterCtrl.updateFighter(fighterB);

      // O cinturão troca de mãos (ou não) antes de contarmos as consequências.
      // Empate em luta de título: o campeão retém automaticamente (regra real
      // do MMA) — não chamamos resolveTitleFight, então o mapa de campeões da
      // promoção simplesmente não muda.
      let titleOutcome = null;
      if (fight.titleWeightClass && this.titleService && !result.isDraw) {
        titleOutcome = await this.titleService.resolveTitleFight(
          promo, fight.titleWeightClass, result.winnerId, result.loserId, absWeekNow, playerFighterId
        );
        result.titleRetained = titleOutcome.retained;
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

  async _settlePlayerFight(fight, result, promo, absWeekNow, titleOutcome = null) {
    const { booking } = fight;
    const fighter = fight.fighterA; // o lutador do jogador é sempre o córner A
    const isDraw = !!result.isDraw;
    const won = !isDraw && result.winnerId === fighter.id;

    // Épico F1: hype da coletiva vira bônus na bolsa
    const hypeBonus = (fighter.pcHype || 0) * HYPE_PURSE_RATIO;
    const grossPurse = booking.purse + (won ? booking.winBonus : 0) + hypeBonus;
    // Limpa o hype após usar — não acumular para a próxima luta
    fighter.pcHype = 0;

    // §A.2/§C.1: o corte já não é da academia — primeiro o contrato de
    // promoção (purseShare do atleta), depois o empresário (se tiver um).
    const afterPurseShare = Math.round(grossPurse * (fighter.purseShare ?? 0.8));
    const { managerCut, netPurse, manager } = this.managerService
      ? await this.managerService.applyCut(fighter, afterPurseShare)
      : { managerCut: 0, netPurse: afterPurseShare, manager: null };

    fighter.addTransaction(absWeekNow, `Bolsa — ${promo.short}${manager ? ` (empresário: -$${managerCut.toLocaleString()})` : ''}${hypeBonus > 0 ? ' (c/ hype)' : ''}`, netPurse);
    fighter.careerEarnings = (fighter.careerEarnings || 0) + grossPurse;

    if (isDraw) {
      // Empate não conta como vitória nem derrota no cartel.
      await this.notifService.add('info', '🤝 Empate', `Você empatou com ${result.fighterBName} (${result.method}) no ${promo.nextEventName()}. Bolsa líquida: $${netPurse.toLocaleString()}.`);
    } else if (won) {
      const isFinish = result.method && !result.method.startsWith('Decision');
      await this.notifService.add('success', '🏆 Vitória!', `Você venceu ${result.winnerId === result.fighterAId ? result.fighterBName : result.fighterAName} por ${result.method} no ${promo.nextEventName()}. Bolsa líquida: $${netPurse.toLocaleString()}.${hypeBonus > 0 ? ` ($${hypeBonus.toLocaleString()} de bônus de hype)` : ''}`);
      if (this.careerLogService && isFinish) {
        await this.careerLogService.publish('finish', absWeekNow, promo.tier === 1 ? 70 : 45, { opponentName: result.fighterBName === fighter.name ? result.fighterAName : result.fighterBName, method: result.method, promo: promo.short });
      }
    } else {
      await this.notifService.add('warning', 'Derrota', `Você foi derrotado por ${result.winnerName} (${result.method}). Bolsa líquida: $${netPurse.toLocaleString()}.`);
    }

    // Título em empate: o campeão retém automaticamente (regra real do MMA) —
    // resolveTitleFight nunca foi chamado, então o mapa de campeões não mudou.
    if (fight.titleWeightClass && isDraw) {
      const division = getWeightClassName(fight.titleWeightClass);
      await this.notifService.add(
        'info',
        '🛡️ Cinturão Mantido (Empate)',
        booking.titleRole === TITLE_ROLE.DEFENSE
          ? `Você empatou e mantém o cinturão ${division} do ${promo.short}.`
          : `Você empatou pelo cinturão ${division} — o campeão atual mantém o título.`
      );
    }

    // Expõe dados financeiros no resultado para a tela pós-luta
    result._purse = grossPurse;
    result._netPurse = netPurse;
    result._managerCut = managerCut;
    result._hypeBonus = hypeBonus;
    result._won = won;

    // O cinturão é a única coisa que pesa mais que a bolsa.
    if (titleOutcome) {
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
          await this.careerLogService.publish('title_won', absWeekNow, titleOutcome.retained ? 60 : 95, { division, promo: promo.short, defense: titleOutcome.retained });
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

  // Ofertas aceitas desta promoção cuja luta é nesta semana (ou atrasada)
  async _getBookings(promotionId, absWeekNow) {
    const accepted = await this.db.getIndex('offers', 'status', OFFER_STATUS.ACCEPTED);
    return accepted.filter(o => o.promotionId === promotionId && o.eventAbsWeek <= absWeekNow);
  }

  async _buildAiCard(promotionId, excludeIds, absWeekNow) {
    const rosterData = await this.db.getIndex('fighters', 'organizationId', promotionId);
    const available = rosterData
      .map(d => new Fighter(d))
      .filter(f => f.status === 'roster' && !excludeIds.has(f.id) && f.availableFromAbsWeek <= absWeekNow);

    const byWeight = {};
    for (const f of available) {
      (byWeight[f.weightClass] ||= []).push(f);
    }

    // Pareia vizinhos de rating dentro de cada divisão, alternando
    // divisões para variar os cards de evento para evento.
    const divisionPairs = [];
    for (const fighters of Object.values(byWeight)) {
      fighters.sort((a, b) => b.overallRating - a.overallRating);
      const pairs = [];
      for (let i = 0; i + 1 < fighters.length; i += 2) {
        pairs.push([fighters[i], fighters[i + 1]]);
      }
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
        divisionPairs.splice(idx % divisionPairs.length, 1);
      } else {
        idx++;
      }
    }

    return card;
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

  // §C.3 — pressão psicológica da luta (0-100): escala pressurePerformer/
  // bigEventNervous/composure em SimulationEngine em vez do antigo binário
  // isBigEvent (só tier 1). Sinais disponíveis aqui: título em jogo, palco
  // de elite, reencontro, sequência em risco de qualquer lado, e — agora
  // que RivalryService está disponível (§D.3) — rivalidade tipo 'grudge'
  // entre os dois: uma revanche contra o rival que te provocou pesa mais.
  async _computePressureLevel(fight, promo) {
    let pressure = 0;
    if (fight.titleWeightClass) pressure += 50;
    if (promo.tier === 1) pressure += 20;
    if (fight.booking?.isReencounter) pressure += 15;
    if ((fight.fighterA.winStreak || 0) >= 3) pressure += 10;
    if ((fight.fighterB.winStreak || 0) >= 3) pressure += 10;
    if (this.rivalryService) {
      const rivalry = await this.rivalryService.getRivalryBetween(fight.fighterA.id, fight.fighterB.id);
      if (rivalry?.type === 'grudge') pressure += RIVALRY_CONFIG.GRUDGE_PRESSURE_BONUS;
    }
    return Math.min(100, pressure);
  }

  // Suspensão médica pós-luta: aplicada a TODOS os lutadores (jogador e IA)
  // para respeitar o afastamento mínimo entre lutas real do MMA.
  _applySuspension(fighter, result, absWeekNow) {
    const won = result.winnerId === fighter.id;
    const weeks = computeSuspensionWeeks(result.method, won);
    const suspendedUntil = absWeekNow + weeks;
    const injuryUntil = fighter.injury?.untilAbsWeek || 0;
    fighter.availableFromAbsWeek = Math.max(suspendedUntil, injuryUntil);
  }

  _rollInjury(fighter, result, absWeekNow) {
    const won = result.winnerId === fighter.id;
    const isFinish = result.method && !result.method.startsWith('Decision');

    let chance = won ? WORLD_CONFIG.INJURY_CHANCE_WINNER : WORLD_CONFIG.INJURY_CHANCE_LOSER;
    if (!won && isFinish) chance += WORLD_CONFIG.INJURY_CHANCE_FINISH_BONUS;
    if (fighter.hasDNA('injuryProne')) chance += WORLD_CONFIG.INJURY_CHANCE_PRONE_BONUS;

    if (Math.random() >= chance) return;

    const weeks = WORLD_CONFIG.INJURY_WEEKS_MIN +
      Math.floor(Math.random() * (WORLD_CONFIG.INJURY_WEEKS_MAX - WORLD_CONFIG.INJURY_WEEKS_MIN + 1));

    fighter.injury = {
      untilAbsWeek: absWeekNow + weeks,
      description: `Lesionado por ${weeks} semanas`,
      // Volta exatamente para onde estava.
      resumeStatus: fighter.status,
    };
    fighter.status = 'injured';

    // §B.1 — injuryProne se descobre na 2ª lesão em menos de 52 semanas.
    if (fighter.hasDNA('injuryProne') && !fighter.isDiscovered('injuryProne')
      && fighter.injuryCount >= 1
      && (absWeekNow - fighter.lastInjuryAbsWeek) < DNA_DISCOVERY_CONFIG.INJURY_PRONE_WINDOW_WEEKS) {
      fighter.discoverTrait('injuryProne');
    }
    fighter.injuryCount = (fighter.injuryCount || 0) + 1;
    fighter.lastInjuryAbsWeek = absWeekNow;

    // §B.2 — lesão mais severa (mais semanas fora) rola chance de sequela
    // permanente: reduz o TETO de alguns atributos pro resto da carreira,
    // com uma pequena compensação mental (a dor ensina a lutar diferente).
    const scarChance = weeks >= WORLD_CONFIG.SCAR_SEVERE_WEEKS_THRESHOLD
      ? WORLD_CONFIG.SCAR_CHANCE_SEVERE
      : WORLD_CONFIG.SCAR_CHANCE_LIGHT;
    if (Math.random() < scarChance) {
      const template = PERMANENT_SCAR_TABLE[Math.floor(Math.random() * PERMANENT_SCAR_TABLE.length)];
      fighter.permanentScars.push({
        bodyPart: template.bodyPart,
        attributeCeilings: { ...template.attributeCeilings },
        compensation: { ...template.compensation },
        fromFightId: result.id,
        atAbsWeek: absWeekNow,
      });
      for (const [attr, bonus] of Object.entries(template.compensation)) {
        fighter.attributes[attr] = Math.min(fighter.effectiveCeiling(attr), (fighter.attributes[attr] || 50) + bonus);
      }
    }
  }

  async _recoverInjuries(absWeekNow, playerFighterId) {
    const injured = await this.db.getIndex('fighters', 'status', 'injured');
    for (const data of injured) {
      if (!data.injury || data.injury.untilAbsWeek > absWeekNow) continue;
      const fighter = new Fighter(data);
      fighter.status = fighter.injury.resumeStatus || 'roster';
      fighter.injury = null;
      await this.db.put('fighters', fighter);
      if (fighter.id === playerFighterId) {
        await this.notifService.add('success', 'Recuperado', `${fighter.name} está liberado pelo departamento médico.`);
      }
    }
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

      await this.fighterCtrl.updateFighter(f);
    }

    const count = WORLD_CONFIG.DRAFT_MIN +
      Math.floor(Math.random() * (WORLD_CONFIG.DRAFT_MAX - WORLD_CONFIG.DRAFT_MIN + 1));
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
      if (ACADEMIES.length > 0 && Math.random() < 0.4) {
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
    const activeCount = allNow.filter(f => f.status !== 'retired' && f.status !== 'dead').length;
    if (activeCount > WORLD_CONFIG.POPULATION_CAP) {
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
    }

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
}
