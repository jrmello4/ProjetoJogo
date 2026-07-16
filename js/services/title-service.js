import { Promotion } from '../models/promotion.js';
import { Fighter } from '../models/fighter.js';
import { Academy } from '../models/academy.js';
import { RankingService } from './ranking.js';
import { getWeightClassName } from '../utils/helpers.js';
import { TITLE_CONFIG, TITLE_ROLE, CORE_WEIGHT_CLASSES } from '../config/game-config.js';

// Cinturões: quem detém, quem desafia, e o que acontece quando o cinturão
// troca de mãos. Toda a regra de título vive aqui — nem o OfferService nem
// o WorldService precisam saber como um campeão é coroado.
export class TitleService {
  constructor(db, fighterCtrl, notifService) {
    this.db = db;
    this.fighterCtrl = fighterCtrl;
    this.notifService = notifService;
  }

  async _promotions() {
    const all = await this.db.getAll('organization');
    return all.filter(o => o.id.startsWith('promo-')).map(o => new Promotion(o)).sort((a, b) => a.tier - b.tier);
  }

  async _rosterOf(promotionId, weightClass) {
    const data = await this.db.getIndex('fighters', 'organizationId', promotionId);
    return data.map(d => new Fighter(d)).filter(f => f.weightClass === weightClass);
  }

  // ===== Migração aditiva =====
  // Coroa os campeões iniciais a partir do ranking do próprio elenco de cada
  // promoção. Roda uma vez; não recria o mundo, então o save sobrevive.
  async seedBelts() {
    const promotions = await this._promotions();

    for (const promo of promotions) {
      for (const wc of CORE_WEIGHT_CLASSES) {
        if (promo.champions[wc] !== undefined) continue; // já semeado

        const roster = (await this._rosterOf(promo.id, wc)).filter(f => f.status === 'roster');
        if (roster.length === 0) {
          promo.champions[wc] = null;
          promo.titleDefenses[wc] = 0;
          continue;
        }

        // Lutadores sem luta ficam fora de calculateRankings — nesse caso o
        // melhor OVR assume o cinturão.
        const ranked = RankingService.calculateRankings(roster);
        const best = ranked.length > 0
          ? ranked[0].fighter
          : [...roster].sort((a, b) => b.overallRating - a.overallRating)[0];

        promo.champions[wc] = best.id;
        promo.titleDefenses[wc] = 0;

        const champ = await this.fighterCtrl.getFighter(best.id);
        if (champ) {
          champ.titlesWon = (champ.titlesWon || 0) + 1;
          await this.fighterCtrl.updateFighter(champ);
        }
      }

      await this.db.put('organization', promo);
    }
  }

  // ===== Consulta =====

  // Todos os cinturões do mundo, com o campeão resolvido. Para a tela de Rankings.
  async getBeltMap(playerFighterId = null) {
    const promotions = await this._promotions();
    const belts = [];

    for (const promo of promotions) {
      for (const wc of CORE_WEIGHT_CLASSES) {
        const champId = promo.championOf(wc);
        const champion = champId ? await this.fighterCtrl.getFighter(champId) : null;
        const contenders = await this.contenderRanking(promo, wc);
        belts.push({
          promotionId: promo.id,
          promotionName: promo.name,
          promotionShort: promo.short,
          tier: promo.tier,
          weightClass: wc,
          champion,
          defenses: promo.defensesOf(wc),
          isPlayerFighter: !!playerFighterId && champion?.id === playerFighterId,
          topContender: contenders[0] || null,
          contenders: contenders.slice(0, 5),
        });
      }
    }
    return belts;
  }

  // Onde este lutador está na fila do cinturão, na promoção em que está
  // melhor colocado. É a informação que explica por que a chance não vem.
  async contenderStatusOf(fighter) {
    const promotions = await this._promotions();
    let best = null;

    for (const promo of promotions) {
      const wc = fighter.weightClass;
      if (promo.isChampion(fighter.id, wc)) {
        return { promotionShort: promo.short, weightClass: wc, rank: 0, isChampion: true, defenses: promo.defensesOf(wc) };
      }
      const competes = fighter.promoRecord && fighter.promoRecord[promo.id];
      if (!competes) continue;

      const rank = await this.contenderRankOf(promo, wc, fighter.id);
      if (rank == null) continue;
      if (!best || rank < best.rank || (rank === best.rank && promo.tier < best.tier)) {
        best = { promotionShort: promo.short, weightClass: wc, rank, isChampion: false, tier: promo.tier };
      }
    }
    return best;
  }

  // Cinturões de um lutador: [{ promotionId, promotionShort, weightClass, defenses }]
  // promotionId é o que identifica a promoção de forma confiável — comparar
  // por nome de exibição é frágil (ver getSigningConflict).
  async beltsOf(fighterId) {
    const promotions = await this._promotions();
    const out = [];
    for (const promo of promotions) {
      for (const wc of promo.beltsHeldBy(fighterId)) {
        out.push({ promotionId: promo.id, promotionShort: promo.short, promotionName: promo.name, tier: promo.tier, weightClass: wc, defenses: promo.defensesOf(wc) });
      }
    }
    return out;
  }

  // ===== Ranking de desafiantes =====
  // Quem "compete nesta promoção": o elenco dela mais qualquer lutador de
  // academia (sua ou rival) que já tenha cartel ali. É esta lista, ordenada,
  // que decide quem disputa o cinturão — não o número de vitórias.
  async contenderRanking(promo, weightClass) {
    const all = await this.fighterCtrl.getAllFighters();
    const champId = promo.championOf(weightClass);

    const pool = all.filter(f =>
      f.weightClass === weightClass &&
      f.status !== 'retired' &&
      f.id !== champId &&
      (f.organizationId === promo.id || (f.promoRecord && f.promoRecord[promo.id]))
    );
    if (pool.length === 0) return [];

    const ranked = RankingService.calculateRankings(pool);
    if (ranked.length > 0) return ranked.map(r => r.fighter);
    return [...pool].sort((a, b) => b.overallRating - a.overallRating);
  }

  async contenderRankOf(promo, weightClass, fighterId) {
    const ranked = await this.contenderRanking(promo, weightClass);
    const i = ranked.findIndex(f => f.id === fighterId);
    return i === -1 ? null : i + 1;
  }

  _isAvailable(f, byAbsWeek) {
    return f.status !== 'retired' && (f.availableFromAbsWeek || 0) <= byAbsWeek;
  }

  // Já perdeu para o campeão atual nas últimas lutas? Vai para o fim da fila.
  // `f.won === false` (não `!f.won`) — um empate (`won: null`) não é derrota;
  // não deve punir o desafiante na fila do cinturão.
  _recentlyLostTo(fighter, championId) {
    if (!championId) return false;
    return fighter.fights
      .slice(0, TITLE_CONFIG.REMATCH_BLOCK_FIGHTS)
      .some(f => f.opponentId === championId && f.won === false);
  }

  // O desafiante mandatório: o mais bem ranqueado que esteja livre e que
  // ainda não tenha sido batido pelo campeão. Se sobrar só quem já perdeu,
  // a revanche acontece — o cinturão precisa ser defendido.
  async mandatoryChallenger(promo, weightClass, byAbsWeek, excludeIds = new Set()) {
    const champId = promo.championOf(weightClass);
    const ranked = await this.contenderRanking(promo, weightClass);

    const available = ranked.filter(f => this._isAvailable(f, byAbsWeek) && !excludeIds.has(f.id));
    if (available.length === 0) return null;

    const fresh = available.filter(f => !this._recentlyLostTo(f, champId));
    return (fresh.length > 0 ? fresh : available)[0];
  }

  // O campeão ainda está apto a defender? Só o fim da carreira tira um
  // cinturão. Trocar de academia não muda nada no circuito — o campeão
  // segue campeão, sua academia é que perdeu um. Lesão e suspensão
  // apenas o deixam ocupado.
  async _resolveActiveChampion(promo, weightClass, availableByAbsWeek) {
    const champId = promo.championOf(weightClass);
    if (!champId) return null;

    const champ = await this.fighterCtrl.getFighter(champId);
    const retired = !champ || champ.status === 'retired';

    if (retired) {
      promo.vacate(weightClass);
      await this.db.put('organization', promo);
      return null;
    }
    if ((champ.availableFromAbsWeek || 0) > availableByAbsWeek) return { champ, busy: true };
    return { champ, busy: false };
  }

  // ===== Oportunidade de título para um lutador da academia =====
  // Retorna { promo, weightClass, role, opponent } ou null.
  async findOpportunity(fighter, promo, eventAbsWeek, absWeekNow, excludeIds = new Set()) {
    const wc = fighter.weightClass;
    if (absWeekNow < (fighter.titleShotCooldownUntil || 0)) return null;

    // Você é o campeão: a promoção marca a defesa contra o mandatório.
    if (promo.isChampion(fighter.id, wc)) {
      const challenger = await this.mandatoryChallenger(promo, wc, eventAbsWeek, excludeIds);
      if (!challenger) return null;
      return { promo, weightClass: wc, role: TITLE_ROLE.DEFENSE, opponent: challenger };
    }

    // Piso de credencial: precisa ter construído algo dentro desta promoção
    // e não pode estar vindo de derrota.
    const rec = fighter.recordIn(promo.id);
    if (rec.wins < TITLE_CONFIG.SHOT_MIN_PROMO_WINS) return null;
    if (fighter.winStreak < TITLE_CONFIG.SHOT_MIN_STREAK) return null;

    const rank = await this.contenderRankOf(promo, wc, fighter.id);
    if (rank == null) return null;

    // Fora do top 5 só entra fenômeno em ascensão — e mesmo assim ele ainda
    // precisa ser o mandatório (todos acima ocupados ou já batidos).
    if (rank > TITLE_CONFIG.CONTENDER_MAX_RANK && fighter.winStreak < TITLE_CONFIG.LONGSHOT_MIN_STREAK) return null;

    const active = await this._resolveActiveChampion(promo, wc, eventAbsWeek);

    if (!active) {
      // Cinturão vago: os dois melhores disponíveis disputam.
      const first = await this.mandatoryChallenger(promo, wc, eventAbsWeek, excludeIds);
      if (!first) return null;
      const second = await this.mandatoryChallenger(promo, wc, eventAbsWeek, new Set([...excludeIds, first.id]));
      if (!second) return null;
      if (first.id !== fighter.id && second.id !== fighter.id) return null;
      const rival = first.id === fighter.id ? second : first;
      return { promo, weightClass: wc, role: TITLE_ROLE.VACANT, opponent: rival };
    }

    if (active.busy) return null; // campeão em suspensão médica

    // A regra que faltava: a chance é do desafiante mandatório, não de quem
    // simplesmente empilhou vitórias.
    const mandatory = await this.mandatoryChallenger(promo, wc, eventAbsWeek, excludeIds);
    if (!mandatory || mandatory.id !== fighter.id) return null;

    return { promo, weightClass: wc, role: TITLE_ROLE.CHALLENGE, opponent: active.champ };
  }

  // ===== Disputa de cinturão entre lutadores da IA =====
  async pickAiTitleFight(promo, absWeekNow, excludeIds, playerFighterId = null) {
    const isTitleEvent = (promo.eventsHosted + 1) % TITLE_CONFIG.AI_TITLE_FIGHT_EVERY === 0;
    if (!isTitleEvent) return null;

    // Divisões em ordem aleatória: a promoção não defende sempre a mesma.
    const divisions = [...CORE_WEIGHT_CLASSES].sort(() => Math.random() - 0.5);

    for (const wc of divisions) {
      const active = await this._resolveActiveChampion(promo, wc, absWeekNow);

      if (active && !active.busy) {
        // O campeão jogador não é escalado pela IA — ele decide se defende.
        if (active.champ.id === playerFighterId) continue;
        if (excludeIds.has(active.champ.id)) continue;

        const challenger = await this.mandatoryChallenger(promo, wc, absWeekNow, excludeIds);
        if (!challenger || challenger.id === playerFighterId) continue; // o jogador decide suas lutas
        return { fighterA: active.champ, fighterB: challenger, weightClass: wc, role: TITLE_ROLE.DEFENSE };
      }

      if (!active) {
        // Cinturão vago: os dois melhores disputam.
        const first = await this.mandatoryChallenger(promo, wc, absWeekNow, excludeIds);
        if (!first || first.id === playerFighterId) continue;
        const second = await this.mandatoryChallenger(promo, wc, absWeekNow, new Set([...excludeIds, first.id]));
        if (!second || second.id === playerFighterId) continue;
        return { fighterA: first, fighterB: second, weightClass: wc, role: TITLE_ROLE.VACANT };
      }
    }
    return null;
  }

  // ===== Resolução =====
  // Troca (ou mantém) o cinturão. Devolve o que aconteceu para quem chamar
  // aplicar reputação/popularidade e disparar conquistas.
  async resolveTitleFight(promo, weightClass, winnerId, loserId, absWeekNow, playerFighterId = null) {
    const previousChampId = promo.championOf(weightClass);
    const { retained, defenses } = promo.crown(winnerId, weightClass);
    promo.titleFightsHosted++;
    await this.db.put('organization', promo);

    const winner = await this.fighterCtrl.getFighter(winnerId);
    const loser = await this.fighterCtrl.getFighter(loserId);
    const division = getWeightClassName(weightClass);

    if (winner) {
      if (!retained) winner.titlesWon = (winner.titlesWon || 0) + 1;
      winner.updatePopularity(retained ? TITLE_CONFIG.POPULARITY_ON_DEFENSE : TITLE_CONFIG.POPULARITY_ON_TITLE_WIN);
      await this.fighterCtrl.updateFighter(winner);
      await this._bumpAcademyReputation(winner.academyId, retained ? TITLE_CONFIG.REP_ON_DEFENSE : TITLE_CONFIG.REP_ON_TITLE_WIN);
    }

    if (loser) {
      // Quem perde uma luta de título — desafiante frustrado ou campeão
      // destronado — precisa reconstruir antes de pedir outra chance.
      loser.titleShotCooldownUntil = absWeekNow + TITLE_CONFIG.SHOT_COOLDOWN_WEEKS;
      await this.fighterCtrl.updateFighter(loser);

      // Só pesa a reputação da academia se o perdedor estava DEFENDENDO —
      // um desafiante que fracassa nunca teve o cinturão pra perder.
      if (previousChampId === loserId) {
        await this._bumpAcademyReputation(loser.academyId, TITLE_CONFIG.REP_ON_TITLE_LOSS);
      }
    }

    const playerInvolved = !!playerFighterId && (winner?.id === playerFighterId || loser?.id === playerFighterId);

    // Notícia do mundo só quando o jogador não está envolvido — se estiver,
    // quem narra é o WorldService, com o peso que o momento merece.
    if (!playerInvolved && winner) {
      await this.notifService.add(
        'info',
        retained ? '🛡️ Cinturão Defendido' : '🏆 Novo Campeão',
        retained
          ? `${winner.name} defendeu o cinturão ${division} do ${promo.short} (${defenses}ª defesa).`
          : `${winner.name} é o novo campeão ${division} do ${promo.short}.`
      );
    }

    return { retained, defenses, winner, loser, division, promo };
  }

  // Cinturão interino nasce quando o campeão de verdade cai fora por muito
  // tempo entre a oferta de título e a luta (loop "sempre lutando com o
  // campeão machucado"): em vez da luta virar treino qualquer sem valor,
  // ela já vale o interino. Não mexe em promo.champions — o titular
  // continua titular, só ocupado; _checkInterimTitles (semanal) promove o
  // interino a definitivo se o titular nunca mais voltar (aposentar).
  async resolveInterimTitleFight(promo, weightClass, winnerId, loserId, absWeekNow) {
    promo.crownInterim(winnerId, weightClass, absWeekNow);
    await this.db.put('organization', promo);

    const winner = await this.fighterCtrl.getFighter(winnerId);
    const loser = await this.fighterCtrl.getFighter(loserId);
    const division = getWeightClassName(weightClass);

    if (winner) {
      winner.updatePopularity(TITLE_CONFIG.POPULARITY_ON_DEFENSE);
      await this.fighterCtrl.updateFighter(winner);
      await this._bumpAcademyReputation(winner.academyId, TITLE_CONFIG.REP_ON_DEFENSE);
    }
    if (loser) {
      loser.titleShotCooldownUntil = absWeekNow + TITLE_CONFIG.SHOT_COOLDOWN_WEEKS;
      await this.fighterCtrl.updateFighter(loser);
    }

    return { retained: false, defenses: 0, winner, loser, division, promo, interim: true };
  }

  // A academia sente o peso do cinturão que passa por ela: sobe com título
  // conquistado/defendido, cai quando um dos seus perde o que tinha. É o
  // único jeito de uma academia destravar o gate de reputação da Elite —
  // sem isto, `academyReputation` fica travado no valor de bootstrap para
  // sempre e só a Elite Combat Team (que já nasce com 55) chega lá.
  async _bumpAcademyReputation(academyId, delta) {
    if (!academyId || !delta) return;
    const data = await this.db.get('organization', academyId);
    if (!data) return;
    const academy = new Academy(data);
    academy.updateReputation(delta);
    await this.db.put('organization', academy);
  }

  // Empate numa defesa de título: o campeão retém automaticamente (regra
  // real do MMA — ver comentário em WorldService._settlePlayerFight), mas
  // isso não passa por resolveTitleFight/crown(), então sem isto a defesa
  // bem-sucedida nunca contava no placar de defesas do campeão.
  async recordDrawDefense(promo, weightClass) {
    const champId = promo.championOf(weightClass);
    if (!champId) return null;

    promo.titleDefenses[weightClass] = promo.defensesOf(weightClass) + 1;
    await this.db.put('organization', promo);

    const champ = await this.fighterCtrl.getFighter(champId);
    if (champ) await this._bumpAcademyReputation(champ.academyId, TITLE_CONFIG.REP_ON_DEFENSE);

    return promo.defensesOf(weightClass);
  }

  // Varredura semanal: só a aposentadoria (ou o desaparecimento do lutador)
  // deixa um cinturão vago. Trocar de academia NÃO mexe no cinturão — o
  // campeão continua campeão, só treina em outro lugar.
  async reconcileBelts() {
    const promotions = await this._promotions();
    const vacated = [];

    for (const promo of promotions) {
      let changed = false;
      for (const [wc, champId] of Object.entries(promo.champions)) {
        if (!champId) continue;
        const champ = await this.fighterCtrl.getFighter(champId);
        const retired = !champ || champ.status === 'retired';
        if (!retired) continue;

        promo.vacate(wc);
        changed = true;
        vacated.push({ promotionShort: promo.short, weightClass: wc, name: champ?.name });
      }
      if (changed) await this.db.put('organization', promo);
    }

    for (const v of vacated) {
      await this.notifService.add(
        'info',
        'Cinturão Vago',
        `${v.name || 'O campeão'} se aposentou. O cinturão ${getWeightClassName(v.weightClass)} do ${v.promotionShort} está vago.`
      );
    }
    return vacated;
  }

  // Aposentadoria / saída do circuito: o cinturão vaga.
  // `exceptPromotionId`: promoção cujo cinturão NÃO deve vagar. Usado ao
  // assinar contrato exclusivo (§C.3) — você abre mão dos cinturões das
  // OUTRAS promoções, mas obviamente mantém o da promoção com quem assinou
  // (caso de re-assinatura sendo campeão dela).
  async vacateBeltsOf(fighterId, exceptPromotionId = null) {
    const promotions = await this._promotions();
    const vacated = [];
    for (const promo of promotions) {
      if (exceptPromotionId && promo.id === exceptPromotionId) continue;
      const belts = promo.beltsHeldBy(fighterId);
      if (belts.length === 0) continue;
      for (const wc of belts) promo.vacate(wc);
      await this.db.put('organization', promo);
      vacated.push(...belts.map(wc => ({ promotionShort: promo.short, weightClass: wc })));
    }
    return vacated;
  }
}
