import { FightOffer, OFFER_STATUS } from '../models/fight-offer.js';
import { Fighter } from '../models/fighter.js';
import { generateId, clamp } from '../utils/helpers.js';
import { getWeightClassName } from '../utils/helpers.js';
import { OFFER_CONFIG, NEGOTIATION_CONFIG, TITLE_CONFIG, TITLE_ROLE, RIVALRY_CONFIG } from '../config/game-config.js';

// Ciclo de vida das ofertas de luta: geração semanal pelas promoções,
// expiração, aceite e recusa.
export class OfferService {
  constructor(db, fighterCtrl, notifService, titleService = null, contractService = null, rivalryService = null) {
    this.db = db;
    this.fighterCtrl = fighterCtrl;
    this.notifService = notifService;
    this.titleService = titleService;
    this.contractService = contractService;
    this.rivalryService = rivalryService;
  }

  async getAll() {
    const data = await this.db.getAll('offers');
    return data.map(d => new FightOffer(d));
  }

  async getPending() {
    const data = await this.db.getIndex('offers', 'status', OFFER_STATUS.PENDING);
    return data.map(d => new FightOffer(d)).sort((a, b) => b.purse - a.purse);
  }

  async getAccepted() {
    const data = await this.db.getIndex('offers', 'status', OFFER_STATUS.ACCEPTED);
    return data.map(d => new FightOffer(d)).sort((a, b) => a.eventAbsWeek - b.eventAbsWeek);
  }

  async getHistory(limit = 12) {
    const all = await this.getAll();
    return all
      .filter(o => !o.isPending && !o.isAccepted)
      .sort((a, b) => b.createdAtAbsWeek - a.createdAtAbsWeek)
      .slice(0, limit);
  }

  async accept(offerId, absWeekNow) {
    const data = await this.db.get('offers', offerId);
    if (!data || data.status !== OFFER_STATUS.PENDING) return null;

    const offer = new FightOffer(data);
    offer.status = OFFER_STATUS.ACCEPTED;
    await this.db.put('offers', offer);

    const weeksOut = offer.eventAbsWeek - absWeekNow;
    await this.notifService.add('success', 'Luta Fechada!', `${offer.opponentName} em ${weeksOut} semana${weeksOut === 1 ? '' : 's'} pelo ${offer.promotionName}. Hora do camp!`);
    return offer;
  }

  // Negociação de bolsa: uma tentativa por oferta. Quanto maior o pedido
  // frente à força de barganha (popularidade + reputação da academia atual
  // + estilo do empresário, §C.1), maior o risco de a promoção recusar ou
  // cancelar a oferta. `managerMods`: { leverageBonus, rescindBonus } —
  // ver ManagerService.negotiationModifiers.
  async negotiate(offerId, bumpIndex, fighter, academyReputation = 50, managerMods = { leverageBonus: 0, rescindBonus: 0 }) {
    const data = await this.db.get('offers', offerId);
    if (!data || data.status !== OFFER_STATUS.PENDING) return { ok: false, reason: 'Oferta indisponível.' };

    const offer = new FightOffer(data);
    if (offer.negotiated) return { ok: false, reason: 'Você já negociou esta oferta.' };

    const bump = NEGOTIATION_CONFIG.BUMP_OPTIONS[bumpIndex];
    if (bump == null) return { ok: false, reason: 'Opção de negociação inválida.' };

    const leverage = clamp(
      (fighter?.popularity || 0) / 100 * 0.6 + (academyReputation || 0) / 100 * 0.4 + (managerMods.leverageBonus || 0),
      0, 1
    );
    const acceptCeiling = leverage * NEGOTIATION_CONFIG.BASE_ACCEPT_LEVERAGE;

    offer.negotiated = true;

    if (bump <= acceptCeiling) {
      offer.purse = Math.round(offer.purse * (1 + bump) / 50) * 50;
      offer.winBonus = Math.round(offer.winBonus * (1 + bump) / 50) * 50;
      await this.db.put('offers', offer);
      return { ok: true, outcome: 'accepted', offer };
    }

    if (bump <= acceptCeiling + NEGOTIATION_CONFIG.RESCIND_MARGIN) {
      offer.purse = Math.round(offer.purse * (1 + acceptCeiling) / 50) * 50;
      offer.winBonus = Math.round(offer.winBonus * (1 + acceptCeiling) / 50) * 50;
      await this.db.put('offers', offer);
      return { ok: true, outcome: 'countered', offer };
    }

    if (Math.random() < NEGOTIATION_CONFIG.RESCIND_CHANCE + (managerMods.rescindBonus || 0)) {
      offer.status = OFFER_STATUS.DECLINED;
      await this.db.put('offers', offer);
      return { ok: true, outcome: 'rescinded', offer };
    }

    await this.db.put('offers', offer);
    return { ok: true, outcome: 'refused', offer };
  }

  async decline(offerId) {
    const data = await this.db.get('offers', offerId);
    if (!data || data.status !== OFFER_STATUS.PENDING) return null;

    const offer = new FightOffer(data);
    offer.status = OFFER_STATUS.DECLINED;
    await this.db.put('offers', offer);
    return offer;
  }

  // Épico D: cancela uma luta já aceita (ex: lesão no camp)
  async cancelBooking(offerId) {
    const data = await this.db.get('offers', offerId);
    if (!data || data.status !== OFFER_STATUS.ACCEPTED) return null;

    const offer = new FightOffer(data);
    offer.status = OFFER_STATUS.CANCELLED;
    await this.db.put('offers', offer);
    return offer;
  }

  // Épico B: ao assinar contrato exclusivo, cancela ofertas de luta
  // pendentes de outras promoções — atleta comprometido não pode ter
  // propostas concorrentes na mesa.
  async cancelOffersNotFrom(fighterId, promoId) {
    const pending = await this.getPending();
    const toCancel = pending.filter(o => o.fighterId === fighterId && o.promotionId !== promoId);
    for (const offer of toCancel) {
      offer.status = OFFER_STATUS.CANCELLED;
      await this.db.put('offers', offer);
    }
    return toCancel.length;
  }

  async expireOld(absWeekNow) {
    const pending = await this.getPending();
    for (const offer of pending) {
      if (offer.expiresAbsWeek > absWeekNow) continue;
      offer.status = OFFER_STATUS.EXPIRED;
      await this.db.put('offers', offer);
      await this.notifService.add('warning', 'Oferta Expirada', `A oferta do ${offer.promotionName} para lutar contra ${offer.opponentName} expirou sem resposta.`);
    }
  }

  // Geração semanal: promoções procuram o lutador do jogador, se ele está
  // livre, e enviam uma proposta compatível com o nível dele.
  async generateWeekly(absWeekNow, fighter, academyReputation, promotions) {
    const open = [...(await this.getPending()), ...(await this.getAccepted())];
    const busyFighterIds = new Set(open.map(o => o.fighterId));
    const targetedOpponentIds = new Set(open.map(o => o.opponentId));
    const created = [];

    if (busyFighterIds.has(fighter.id)) return created;
    if (fighter.status === 'injured' || fighter.status === 'retired') return created;
    if (fighter.availableFromAbsWeek > absWeekNow) return created; // ainda em suspensão médica
    if (fighter.fatigue >= 70) return created; // ninguém oferece luta a atleta esgotado
    if (Math.random() > OFFER_CONFIG.WEEKLY_OFFER_CHANCE) return created;

    // Uma chance de cinturão sempre atropela a oferta comum da semana.
    const titleOffer = await this._tryTitleOffer(fighter, academyReputation, promotions, absWeekNow, targetedOpponentIds);
    if (titleOffer) {
      created.push(titleOffer);
      return created;
    }

    // Épico B: contrato exclusivo limita ofertas à promoção contratante
    let availablePromotions;
    if (fighter.promotionContract?.status === 'active') {
      const contractPromo = promotions.find(p => p.id === fighter.promotionContract.promotionId);
      availablePromotions = contractPromo ? [contractPromo] : [];
    } else {
      // Sem contrato: só recebe ofertas do circuito regional (tier 3)
      availablePromotions = promotions.filter(p => p.tier === 3);
    }
    if (availablePromotions.length === 0) return created;

    const tier = this._pickTier(fighter, academyReputation);
    const candidates = availablePromotions.filter(p => p.tier === tier);
    if (candidates.length === 0) return created;
    const promo = candidates[Math.floor(Math.random() * candidates.length)];

    const opponent = await this._pickOpponent(promo.id, fighter, targetedOpponentIds, absWeekNow);
    if (!opponent) return created;

    // Épico F4: reencontro — o adversário já treinou na SUA academia atual
    const isReencounter = fighter.academyId && (opponent.previousAcademyIds || []).includes(fighter.academyId);

    const eventAbsWeek = this._nextEventWeek(promo, absWeekNow);

    // Épico B: usar bolsa do contrato se tiver contrato ativo
    let rawPurse, winBonus;
    if (fighter.promotionContract?.status === 'active') {
      rawPurse = fighter.promotionContract.basePurse;
      winBonus = fighter.promotionContract.winBonus;
    } else {
      const purseCfg = OFFER_CONFIG.PURSE[promo.tier];
      rawPurse = purseCfg.base + fighter.popularity * purseCfg.perPop;
      winBonus = Math.round((rawPurse * OFFER_CONFIG.WIN_BONUS_RATIO) / 50) * 50;
    }
    const purse = Math.round(rawPurse / 50) * 50;

    const offer = new FightOffer({
      id: generateId(),
      promotionId: promo.id,
      promotionName: promo.name,
      tier: promo.tier,
      fighterId: fighter.id,
      opponentId: opponent.id,
      opponentName: opponent.name,
      opponentRecord: { ...opponent.record },
      opponentOverall: opponent.overallRating,
      opponentStyle: opponent.fightingStyle,
      weightClass: fighter.weightClass,
      purse,
      winBonus,
      eventAbsWeek,
      expiresAbsWeek: absWeekNow + OFFER_CONFIG.EXPIRY_WEEKS,
      isReencounter, // Épico F4
      createdAtAbsWeek: absWeekNow,
    });

    await this.db.put('offers', offer);

    // Épico F3: notificação de reencontro
    if (isReencounter) {
      await this.notifService.add('headline', 'Reencontro!',
        `${opponent.name} (ex-colega da sua academia) pode cruzar seu caminho! A rivalidade está armada.`);
    }
    created.push(offer);

    await this.notifService.add('offer', '📩 Nova Oferta de Luta', `${promo.name} quer você contra ${opponent.name} — bolsa de $${purse.toLocaleString()}.`);

    return created;
  }

  // Primeiro evento da promoção que respeite o tempo mínimo de camp.
  _nextEventWeek(promo, absWeekNow) {
    let week = promo.nextEventAbsWeek;
    while (week - absWeekNow < OFFER_CONFIG.MIN_WEEKS_NOTICE) {
      week += promo.cadenceWeeks;
    }
    return week;
  }

  // Tiers que o lutador já destravou (3 é sempre acessível).
  _unlockedTiers(fighter, academyReputation) {
    const gates = OFFER_CONFIG.TIER_GATES;
    const wins = fighter.record.wins;

    const unlocked = [3];
    if ((fighter.popularity >= gates[2].popularity || wins >= gates[2].wins) && academyReputation >= gates[2].gymRep) {
      unlocked.push(2);
    }
    if ((fighter.popularity >= gates[1].popularity || wins >= gates[1].wins) && academyReputation >= gates[1].gymRep) {
      unlocked.push(1);
    }
    return unlocked;
  }

  // Tier mais alto que o lutador destrava; com sorte a oferta vem dele,
  // senão desce um degrau (mantém tier 3 sempre acessível).
  _pickTier(fighter, academyReputation) {
    const unlocked = this._unlockedTiers(fighter, academyReputation);
    const best = Math.min(...unlocked);
    if (best < 3 && Math.random() < OFFER_CONFIG.TOP_TIER_CHANCE) return best;
    // desce um tier a partir do melhor (nunca abaixo de 3)
    return Math.min(3, best + (Math.random() < 0.5 ? 0 : 1));
  }

  // Chance de cinturão. Prioriza a promoção mais prestigiada. Defender um
  // cinturão nunca depende do gate de tier — você já está lá dentro.
  async _tryTitleOffer(fighter, academyReputation, promotions, absWeekNow, excludeIds) {
    if (!this.titleService) return null;

    const unlocked = new Set(this._unlockedTiers(fighter, academyReputation));

    // Contrato exclusivo ativo trava TODAS as ofertas — inclusive as de
    // cinturão — na promoção contratante. Sem isto, um lutador que ainda
    // detém (ou é o desafiante mandatório de) um cinturão numa promoção
    // ANTIGA recebe ofertas de título dela que atropelam (return early)
    // as ofertas da promoção com quem ele acabou de assinar — e ele nunca
    // recebe uma luta da liga nova. Espelha a mesma trava de generateWeekly.
    let candidatePromos = promotions;
    if (fighter.promotionContract?.status === 'active') {
      const contractPromo = promotions.find(p => p.id === fighter.promotionContract.promotionId);
      candidatePromos = contractPromo ? [contractPromo] : [];
    }
    const ordered = [...candidatePromos].sort((a, b) => a.tier - b.tier);

    for (const promo of ordered) {
      const isDefending = promo.isChampion(fighter.id, fighter.weightClass);
      if (!isDefending && !unlocked.has(promo.tier)) continue;

      const eventAbsWeek = this._nextEventWeek(promo, absWeekNow);
      const chance = await this.titleService.findOpportunity(fighter, promo, eventAbsWeek, absWeekNow, excludeIds);
      if (!chance) continue;

      const { opponent, role, weightClass } = chance;
      const purseCfg = OFFER_CONFIG.PURSE[promo.tier];
      const base = purseCfg.base + fighter.popularity * purseCfg.perPop;
      const purse = Math.round((base * TITLE_CONFIG.PURSE_MULTIPLIER) / 50) * 50;
      const winBonus = Math.round((purse * OFFER_CONFIG.WIN_BONUS_RATIO * TITLE_CONFIG.WIN_BONUS_MULTIPLIER) / 50) * 50;

      const offer = new FightOffer({
        id: generateId(),
        promotionId: promo.id,
        promotionName: promo.name,
        tier: promo.tier,
        fighterId: fighter.id,
        opponentId: opponent.id,
        opponentName: opponent.name,
        opponentRecord: { ...opponent.record },
        opponentOverall: opponent.overallRating,
        opponentStyle: opponent.fightingStyle,
        weightClass,
        purse,
        winBonus,
        eventAbsWeek,
        expiresAbsWeek: absWeekNow + OFFER_CONFIG.EXPIRY_WEEKS,
        createdAtAbsWeek: absWeekNow,
        isTitleFight: true,
        titleRole: role,
      });

      await this.db.put('offers', offer);

      const division = getWeightClassName(weightClass);
      const headline = role === TITLE_ROLE.DEFENSE
        ? `🛡️ Defesa de Cinturão`
        : role === TITLE_ROLE.VACANT
          ? `🏆 Cinturão Vago em Disputa`
          : `🏆 Chance de Cinturão!`;
      const body = role === TITLE_ROLE.DEFENSE
        ? `${promo.name} marcou a defesa do cinturão ${division} de ${fighter.name} contra ${opponent.name}.`
        : role === TITLE_ROLE.VACANT
          ? `${fighter.name} disputa o cinturão ${division} vago do ${promo.short} contra ${opponent.name}.`
          : `${fighter.name} desafia ${opponent.name} pelo cinturão ${division} do ${promo.short}. Bolsa de $${purse.toLocaleString()}.`;

      await this.notifService.add('achievement', headline, body);
      return offer;
    }

    return null;
  }

  async _pickOpponent(promotionId, fighter, excludeIds, absWeekNow) {
    // Rivalidade quente vende ingresso: a promoção tenta priorizar a
    // revanche contra o rival ativo antes de sortear qualquer outro
    // adversário — senão a rivalidade fica só um número que nunca vira luta.
    if (Math.random() < RIVALRY_CONFIG.REMATCH_CHANCE) {
      const rival = await this._pickRivalOpponent(fighter, excludeIds, absWeekNow);
      if (rival) return rival;
    }

    // Épico F3: de vez em quando a promoção arma o REENCONTRO — um ex-atleta da
    // sua academia (hoje em outra equipe) volta como adversário. Só dispara se
    // existir um candidato elegível na divisão; senão cai na seleção normal.
    if (Math.random() < OFFER_CONFIG.REUNION_CHANCE) {
      const reunion = await this._pickReunionOpponent(fighter, excludeIds, absWeekNow);
      if (reunion) return reunion;
    }

    const rosterData = await this.db.getIndex('fighters', 'organizationId', promotionId);
    const candidates = rosterData
      .map(d => new Fighter(d))
      .filter(f =>
        f.status === 'roster' &&
        f.weightClass === fighter.weightClass &&
        !excludeIds.has(f.id) &&
        f.availableFromAbsWeek <= absWeekNow
      );

    if (candidates.length === 0) return null;

    // Prefere adversário de nível próximo. Fora da janela, a promoção NUNCA
    // desce (item 4): quem está acima do roster inteiro enfrenta os melhores
    // disponíveis — o topo do tier é um teto de verdade, não uma esteira de
    // presas fáceis. Só oferece alguém mais fraco se você for o mais fraco.
    const inWindow = candidates.filter(f =>
      Math.abs(f.overallRating - fighter.overallRating) <= OFFER_CONFIG.OPPONENT_OVR_WINDOW
    );
    let pool;
    if (inWindow.length > 0) {
      pool = inWindow;
    } else {
      const above = candidates.filter(f => f.overallRating >= fighter.overallRating);
      const source = above.length > 0 ? above : candidates;
      pool = source.sort((a, b) =>
        Math.abs(a.overallRating - fighter.overallRating) -
        Math.abs(b.overallRating - fighter.overallRating)
      ).slice(0, 3);
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Rival ativo mais intenso (>= REMATCH_MIN_INTENSITY) que ainda esteja
  // disponível e na mesma divisão. Retorna null se não houver nenhum —
  // rivalidade leve não força revanche, só uma de verdade "Intensa"+.
  async _pickRivalOpponent(fighter, excludeIds, absWeekNow) {
    if (!this.rivalryService) return null;
    // Em empate de intensidade, sorteia — sem o `|| Math.random()-0.5`,
    // Array.sort é estável e a rivalidade mais ANTIGA (chegou primeiro no
    // array) sempre vence o empate, travando a revanche sempre no mesmo
    // rival mesmo com outro igualmente intenso disponível.
    const rivalries = (await this.rivalryService.getRivalries(fighter.id))
      .filter(r => r.intensity >= RIVALRY_CONFIG.REMATCH_MIN_INTENSITY)
      .sort((a, b) => (b.intensity - a.intensity) || (Math.random() - 0.5));

    for (const r of rivalries) {
      const rivalId = r.fighterAId === fighter.id ? r.fighterBId : r.fighterAId;
      if (excludeIds.has(rivalId)) continue;
      const rival = await this.fighterCtrl.getFighter(rivalId);
      if (!rival || rival.status !== 'roster' || rival.weightClass !== fighter.weightClass) continue;
      if ((rival.availableFromAbsWeek || 0) > absWeekNow) continue;
      return rival;
    }
    return null;
  }

  // Épico F3: procura um ex-atleta da sua academia, hoje em outra equipe, na
  // mesma divisão, para o reencontro. Prefere o de nível mais próximo (duelo
  // competitivo). Retorna null se não houver ninguém elegível.
  async _pickReunionOpponent(fighter, excludeIds, absWeekNow) {
    if (!fighter.academyId) return null;
    const all = await this.fighterCtrl.getAllFighters();
    const candidates = all.filter(f =>
      (f.previousAcademyIds || []).includes(fighter.academyId) &&
      f.academyId !== fighter.academyId &&         // não está mais na sua academia atual
      f.status !== 'retired' && f.status !== 'injured' &&
      f.weightClass === fighter.weightClass &&
      f.id !== fighter.id &&
      !excludeIds.has(f.id) &&
      (f.availableFromAbsWeek || 0) <= absWeekNow
    );
    if (candidates.length === 0) return null;

    candidates.sort((a, b) =>
      Math.abs(a.overallRating - fighter.overallRating) -
      Math.abs(b.overallRating - fighter.overallRating)
    );
    return candidates[0];
  }
}
