import { Promotion } from '../models/promotion.js';
import { Fighter } from '../models/fighter.js';
import { Event } from '../models/event.js';
import { OFFER_STATUS } from '../models/fight-offer.js';
import { SimulationEngine } from '../controllers/simulation.js';
import { DataGenerator } from './data-generator.js';
import { HallOfFame } from './hall-of-fame.js';
import { generateId, getWeightClassName } from '../utils/helpers.js';
import {
  GYM_CONFIG,
  RIVAL_GYMS,
  WORLD_CONFIG,
  CORE_WEIGHT_CLASSES,
  TITLE_CONFIG,
  TITLE_ROLE,
  HYPE_PURSE_RATIO,
  absWeekToDate,
  computeSuspensionWeeks,
} from '../config/game-config.js';

// Motor do mundo vivo: cada promoção de IA agenda e realiza os próprios
// eventos. Lutas do jogador entram nos cards via ofertas aceitas.
export class WorldService {
  constructor(db, fighterCtrl, notifService, titleService = null, scoutingService = null, contractService = null) {
    this.db = db;
    this.fighterCtrl = fighterCtrl;
    this.notifService = notifService;
    this.titleService = titleService;
    this.scoutingService = scoutingService;
    this.contractService = contractService;
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
  // envolvem lutadores do jogador (para a transmissão ao vivo).
  // cornerHooks (opcional): repassado à simulação das lutas do jogador para
  // permitir instruções de córner ao vivo entre rounds (ver app.js).
  async processWeek(absWeekNow, startedAt, gym, cornerHooks = null) {
    await this._recoverInjuries(absWeekNow);
    if (this.titleService) await this.titleService.reconcileBelts();

    const promotions = await this.getPromotions();
    const playerEvents = [];
    const aiHeadlines = [];

    for (const promo of promotions) {
      if (absWeekNow < promo.nextEventAbsWeek) continue;

      const outcome = await this._runEvent(promo, absWeekNow, startedAt, gym, cornerHooks);
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
    await this._processYearEnd(absWeekNow, startedAt);
    // G1: verificar cinturões interinos (toda semana)
    await this._checkInterimTitles(absWeekNow, promotions);

    return { playerEvents };
  }

  async _runEvent(promo, absWeekNow, startedAt, gym, cornerHooks = null) {
    const bookings = await this._getBookings(promo.id, absWeekNow);
    const playerFighterIds = new Set();
    const bookedIds = new Set();
    const fights = [];

    // 1) Lutas do jogador (ofertas aceitas para este evento)
    for (const booking of bookings) {
      const fighter = await this.fighterCtrl.getFighter(booking.fighterId);
      let opponent = await this.fighterCtrl.getFighter(booking.opponentId);

      // gymId !== GYM_CONFIG.ID cobre o caso de o atleta ter sido roubado
      // por uma academia rival (ou dispensado) depois de aceitar a luta
      if (!fighter || fighter.gymId !== GYM_CONFIG.ID || fighter.status === 'injured' || fighter.status === 'retired') {
        booking.status = OFFER_STATUS.CANCELLED;
        await this.db.put('offers', booking);
        await this.notifService.add('warning', 'Luta Cancelada', `${booking.opponentName ? 'A luta contra ' + booking.opponentName : 'Uma luta'} foi cancelada — seu atleta não pôde competir.`);
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
      const aiTitle = await this.titleService.pickAiTitleFight(promo, absWeekNow, bookedIds);
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
      const result = await SimulationEngine.simulateFight(fighterA, fighterB, promo.tier === 1, hooks, gamePlan, fightDateISO);
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
          promo, fight.titleWeightClass, result.winnerId, result.loserId, absWeekNow
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
        await this._settlePlayerFight(fight, result, promo, gym, absWeekNow, titleOutcome);
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

  async _settlePlayerFight(fight, result, promo, gym, absWeekNow, titleOutcome = null) {
    const { booking } = fight;
    const fighter = fight.fighterA; // lutador do jogador é sempre o córner A
    const isDraw = !!result.isDraw;
    const won = !isDraw && result.winnerId === fighter.id;

    // Épico F1: hype da coletiva vira bônus na bolsa
    const hypeBonus = (fighter.pcHype || 0) * HYPE_PURSE_RATIO;
    const totalPurse = booking.purse + (won ? booking.winBonus : 0) + hypeBonus;
    // Limpa o hype após usar — não acumular para a próxima luta
    fighter.pcHype = 0;

    // Épico A: usa purseShare do atleta em vez de managerCut fixo da academia
    const managerCut = 1 - (fighter.purseShare ?? 0.8);
    const gymCut = Math.round(totalPurse * managerCut);

    gym.addTransaction(absWeekNow, `Comissão — ${fighter.name} (${promo.short})${hypeBonus > 0 ? ' (c/ hype)' : ''}`, gymCut);
    gym.totalPurseEarnings += gymCut;
    fighter.careerEarnings = (fighter.careerEarnings || 0) + totalPurse;

    if (isDraw) {
      // Empate não conta como vitória nem derrota no cartel da academia.
      await this.notifService.add('info', '🤝 Empate', `${fighter.name} empatou com ${result.fighterBName} (${result.method}) no ${promo.nextEventName()}. Comissão: $${gymCut.toLocaleString()}.`);
    } else if (won) {
      gym.wins++;
      const isFinish = result.method && !result.method.startsWith('Decision');
      let rep = GYM_CONFIG.REP_PER_WIN + (GYM_CONFIG.REP_TIER_BONUS[promo.tier] || 0);
      if (isFinish) rep += GYM_CONFIG.REP_PER_FINISH;
      gym.updateReputation(rep);
      await this.notifService.add('success', '🏆 Vitória!', `${fighter.name} venceu ${result.winnerId === result.fighterAId ? result.fighterBName : result.fighterAName} por ${result.method} no ${promo.nextEventName()}. Comissão: $${gymCut.toLocaleString()}.${hypeBonus > 0 ? ` ($${hypeBonus.toLocaleString()} de bônus de hype)` : ''}`);
    } else {
      gym.losses++;
      gym.updateReputation(GYM_CONFIG.REP_PER_LOSS);
      await this.notifService.add('warning', 'Derrota', `${fighter.name} foi derrotado por ${result.winnerName} (${result.method}). Comissão da bolsa: $${gymCut.toLocaleString()}.`);
    }

    // Título em empate: o campeão retém automaticamente (regra real do MMA) —
    // resolveTitleFight nunca foi chamado, então o mapa de campeões não mudou.
    if (fight.titleWeightClass && isDraw) {
      const division = getWeightClassName(fight.titleWeightClass);
      await this.notifService.add(
        'info',
        '🛡️ Cinturão Mantido (Empate)',
        booking.titleRole === TITLE_ROLE.DEFENSE
          ? `${fighter.name} empatou e mantém o cinturão ${division} do ${promo.short}.`
          : `${fighter.name} empatou pelo cinturão ${division} — o campeão atual mantém o título.`
      );
    }

    // O cinturão é a única coisa que pesa mais que a bolsa.
    if (titleOutcome) {
      const division = titleOutcome.division;
      if (won) {
        const rep = titleOutcome.retained ? TITLE_CONFIG.REP_ON_DEFENSE : TITLE_CONFIG.REP_ON_TITLE_WIN;
        gym.updateReputation(rep);
        await this.notifService.add(
          'achievement',
          titleOutcome.retained ? '🛡️ Cinturão Defendido!' : '🏆 CAMPEÃO!',
          titleOutcome.retained
            ? `${fighter.name} defendeu o cinturão ${division} do ${promo.short} pela ${titleOutcome.defenses}ª vez.`
            : `${fighter.name} é o novo campeão ${division} do ${promo.name}. A academia inteira sente.`
        );
      } else {
        gym.updateReputation(TITLE_CONFIG.REP_ON_TITLE_LOSS);
        await this.notifService.add(
          'warning',
          booking.titleRole === TITLE_ROLE.DEFENSE ? '💔 Cinturão Perdido' : 'Chance Desperdiçada',
          booking.titleRole === TITLE_ROLE.DEFENSE
            ? `${fighter.name} perdeu o cinturão ${division} para ${result.winnerName}.`
            : `${fighter.name} não conquistou o cinturão ${division}. Vai precisar reconstruir o cartel.`
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
      await this.contractService.consumeFight(fighter.id, isDraw ? null : won);
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
      // Volta exatamente para onde estava. Derivar de `gymId` fazia um atleta
      // de academia RIVAL voltar como 'gym' — status do jogador.
      resumeStatus: fighter.status,
    };
    fighter.status = 'injured';
  }

  async _recoverInjuries(absWeekNow) {
    const injured = await this.db.getIndex('fighters', 'status', 'injured');
    for (const data of injured) {
      if (!data.injury || data.injury.untilAbsWeek > absWeekNow) continue;
      const fighter = new Fighter(data);
      fighter.status = fighter.injury.resumeStatus || (fighter.gymId ? 'gym' : 'roster');
      fighter.injury = null;
      await this.db.put('fighters', fighter);
      if (fighter.gymId === GYM_CONFIG.ID) {
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
        // Bug anterior: a condição era `champ.status !== 'injured'`, que
        // também vale pra um campeão SAUDÁVEL recém-recuperado — como
        // `_recoverInjuries` roda antes disto no mesmo processWeek, o
        // interino tomava o cinturão do campeão de volta sem nenhuma luta.
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
  async _processYearEnd(absWeekNow, startedAt = null) {
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
        const wasGymFighter = f.gymId === GYM_CONFIG.ID;
        f.gymId = null;
        // Fase 1: ex-atletas do jogador nunca são purgados do banco (abaixo).
        if (wasGymFighter) f.wasPlayerFighter = true;

        // Campeão que pendura as luvas deixa o cinturão vago.
        const vacated = this.titleService ? await this.titleService.vacateBeltsOf(f.id) : [];

        const eligibility = HallOfFame.checkEligibility(f);
        if (eligibility.eligible) {
          const existing = await this.db.get('hallOfFame', f.id);
          if (!existing) {
            const entry = HallOfFame.induct(f, inGameNowISO);
            entry.id = f.id;
            await this.db.put('hallOfFame', entry);
          }
        }

        if (wasGymFighter) {
          await this.notifService.add('hall-of-fame', '🏆 Aposentadoria',
            `${f.name} pendurou as luvas aos ${age} anos após uma carreira histórica. Clique para ver a cerimônia.`);
          // Marca o último aposentado para a tela de cerimônia
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

    // Fase 1: distribui prospects para rivais (40%) ou como agentes livres
    const rivalGyms = RIVAL_GYMS.filter(g => g.id !== GYM_CONFIG.ID);
    let distributed = 0;
    for (const p of prospects) {
      if (rivalGyms.length > 0 && Math.random() < 0.4) {
        const rival = rivalGyms[Math.floor(Math.random() * rivalGyms.length)];
        p.gymId = rival.id;
        p.status = 'roster';
        p.organizationId = rival.promotionId || null;
        distributed++;
      }
      await this.db.put('fighters', p);
    }

    // Fase 1: teto de populacao — aposenta veteranos IA irrelevantes se excedeu
    const allNow = await this.fighterCtrl.getAllFighters();
    const activeCount = allNow.filter(f => f.status !== 'retired' && f.status !== 'dead').length;
    if (activeCount > WORLD_CONFIG.POPULATION_CAP) {
      const toTrim = activeCount - WORLD_CONFIG.POPULATION_CAP;
      const candidates = allNow
        .filter(f => f.gymId !== GYM_CONFIG.ID && (f.age || 28) >= 32 && f.overallRating < 60)
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

    const msg = `${count} jovens prospectos chegaram ao mercado${distributed > 0 ? ` (${distributed} ja contratados por academias rivais)` : ''}.`;
    await this.notifService.add('success', 'Nova Safra', msg);
  }

  // Fase 1: mantém o store 'fighters' limitado. Aposentados de IA sem relevância
  // (nunca foram do jogador, não entraram no Hall da Fama) não têm valor de jogo
  // e só pesam nas leituras semanais de getAllFighters(). Lendas e ex-atletas do
  // jogador são preservados. Rivalidades órfãs do purgado também são removidas.
  async _purgeForgettableRetired() {
    const all = await this.fighterCtrl.getAllFighters();
    const retired = all.filter(f => f.status === 'retired');
    if (retired.length === 0) return 0;

    const rivalries = await this.db.getAll('rivalries');
    let purged = 0;
    for (const f of retired) {
      if (f.wasPlayerFighter) continue;                 // ex-atleta do jogador
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
