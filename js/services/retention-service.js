import { clamp, generateId, formatCurrency } from '../utils/helpers.js';
import { ACADEMIES, MANAGERS, EXPECTATION_CONFIG, RETENTION_CONFIG } from '../config/game-config.js';

// §A.4/§C.1 — sondagem/lealdade contra troca de academia OU de empresário.
// Mesmo motor do antigo "assédio de academias rivais" (Épico A), com o
// sujeito trocado: antes uma Academy rival sondava um atleta DO SEU
// roster; agora uma Academy ou um Manager rival sonda VOCÊ.
//
// Dados persistidos em gameState doc { id: 'retention', approaches: [...] }
// approach: { id, targetType: 'academy'|'manager', rivalId, rivalName,
//   rivalScore, deadlineAbsWeek, createdAt, resolved, response }
export class RetentionService {
  constructor(db, fighterCtrl, notifService, titleService, managerService = null, careerLogService = null, rivalryService = null) {
    this.db = db;
    this.fighterCtrl = fighterCtrl;
    this.notifService = notifService;
    this.titleService = titleService;
    this.managerService = managerService;
    this.careerLogService = careerLogService;
    this.rivalryService = rivalryService;
  }

  // ===== Sondagem =====
  async generateApproaches(absWeekNow, fighter) {
    const approaches = await this._loadApproaches();
    if (fighter.status === 'injured' || fighter.status === 'retired') return approaches.filter(a => !a.resolved);
    if (approaches.some(a => !a.resolved)) return approaches.filter(a => !a.resolved); // 1 sondagem ativa por vez

    const tenureWeeks = absWeekNow - (fighter.academyJoinedAbsWeek || absWeekNow);
    const candidates = [];
    if (fighter.academyId && tenureWeeks >= 8 && fighter.coachSynergy < 80) {
      const rivals = ACADEMIES.filter(a => a.id !== fighter.academyId);
      if (rivals.length > 0) candidates.push({ targetType: 'academy', pool: rivals, trust: fighter.coachSynergy });
    }
    if (fighter.managerId) {
      const manager = this.managerService ? await this.managerService.getManager(fighter.managerId) : null;
      if (manager && manager.trust < 80) {
        const rivals = MANAGERS.filter(m => m.id !== fighter.managerId);
        if (rivals.length > 0) candidates.push({ targetType: 'manager', pool: rivals, trust: manager.trust });
      }
    }
    if (candidates.length === 0) return [];

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    let chance = RETENTION_CONFIG.BASE_APPROACH_CHANCE
      + ((100 - chosen.trust) / 100) * RETENTION_CONFIG.LOW_TRUST_CHANCE_SCALE;
    if (fighter.expectation?.urgency >= 3) chance += EXPECTATION_CONFIG.RIVAL_APPROACH_BONUS;
    if (Math.random() >= chance) return [];

    const rival = chosen.pool[Math.floor(Math.random() * chosen.pool.length)];
    const approach = {
      id: generateId(),
      targetType: chosen.targetType,
      rivalId: rival.id,
      rivalName: rival.name,
      rivalScore: chosen.targetType === 'academy' ? rival.reputation : rival.connections,
      deadlineAbsWeek: absWeekNow + RETENTION_CONFIG.APPROACH_DEADLINE_WEEKS,
      createdAt: absWeekNow,
      resolved: false,
      response: null,
    };
    approaches.push(approach);
    await this._saveApproaches(approaches);

    await this.notifService.add(
      'warning',
      '🔍 Sondagem Recebida',
      chosen.targetType === 'academy'
        ? `${rival.name} demonstrou interesse em te treinar! Você tem ${RETENTION_CONFIG.APPROACH_DEADLINE_WEEKS} semanas para reagir.`
        : `${rival.name} quer ser seu empresário! Você tem ${RETENTION_CONFIG.APPROACH_DEADLINE_WEEKS} semanas para reagir.`
    );

    return approaches.filter(a => !a.resolved);
  }

  // ===== Resposta =====
  // 4 opções: renegociar, bônus de permanência, promessa, deixar ir.
  async respond(absWeekNow, approachId, responseType, fighter) {
    const approaches = await this._loadApproaches();
    const approach = approaches.find(a => a.id === approachId);
    if (!approach || approach.resolved) return { success: false, outcome: 'not_found' };
    if (approach.response) return { success: false, outcome: 'already_responded' };

    if (absWeekNow > approach.deadlineAbsWeek) {
      approach.resolved = true;
      approach.response = 'expired';
      await this._saveApproaches(approaches);
      return { success: false, outcome: 'expired' };
    }

    approach.response = responseType;
    approach.respondedAt = absWeekNow;

    let outcome;
    switch (responseType) {
      case 'renegotiate':
        outcome = await this._renegotiate(fighter, approach);
        break;
      case 'stay_bonus':
        outcome = this._stayBonus(fighter, approach, absWeekNow);
        break;
      case 'promise':
        outcome = this._makePromise(fighter, approach, absWeekNow);
        break;
      case 'let_go':
        outcome = await this._letGo(fighter, approach, absWeekNow);
        approach.resolved = true;
        break;
      default:
        outcome = { success: false, outcome: 'invalid' };
    }

    await this._saveApproaches(approaches);
    return { ...outcome, approach };
  }

  // Renegociar: (academia) desconto na mensalidade / (empresário) corte menor
  async _renegotiate(fighter, approach) {
    if (approach.targetType === 'academy') {
      fighter.coachSynergy = clamp(fighter.coachSynergy + 10, 0, 100);
      fighter.morale = clamp(fighter.morale + 10, 0, 100);
      return { success: true, outcome: 'renegotiated', message: 'Vocês reafirmaram o combinado. Sinergia e moral subiram.' };
    }
    const manager = this.managerService ? await this.managerService.getManager(fighter.managerId) : null;
    if (manager) {
      manager.cut = Math.max(0.05, manager.cut - 0.02);
      manager.updateTrust(10);
      await this.db.put('organization', manager);
    }
    fighter.morale = clamp(fighter.morale + 10, 0, 100);
    return { success: true, outcome: 'renegotiated', message: `${manager?.name || 'Seu empresário'} reduziu o corte em 2%. Moral subiu.` };
  }

  // Bônus de permanência — gesto de retenção da academia/empresário atual
  _stayBonus(fighter, approach, absWeekNow) {
    const bonus = Math.round(1500 + fighter.popularity * 50);
    fighter.addTransaction(absWeekNow, `Bônus de permanência (${approach.targetType === 'academy' ? 'academia' : 'empresário'})`, bonus);
    fighter.loyalty = clamp(fighter.loyalty + 20, 0, 100);
    fighter.morale = clamp(fighter.morale + 15, 0, 100);

    return {
      success: true,
      outcome: 'bonus_paid',
      message: `Você recebeu ${formatCurrency(bonus)} de bônus de permanência. Lealdade e moral subiram bastante.`,
    };
  }

  // Fazer uma promessa: sem custo agora, mas tem que cumprir depois
  _makePromise(fighter, approach, absWeekNow) {
    const promiseTypes = [
      { kind: 'title_shot', label: 'Disputa de cinturão', deadlineWeeks: 26 },
      { kind: 'promotion_raise', label: 'Subir de tier', deadlineWeeks: 20 },
      { kind: 'more_fights', label: 'Lutar com mais frequência', deadlineWeeks: 16 },
    ];
    const chosen = promiseTypes[Math.floor(Math.random() * promiseTypes.length)];
    const baseline = {
      titlesWon: fighter.titlesWon || 0,
      contractTier: fighter.promotionContract?.tier || 0,
      totalFights: (fighter.record?.wins || 0) + (fighter.record?.losses || 0),
    };

    fighter.promises.push({
      kind: chosen.kind,
      label: chosen.label,
      deadlineAbsWeek: absWeekNow + chosen.deadlineWeeks,
      madeAtAbsWeek: absWeekNow,
      kept: false,
      baseline,
    });
    fighter.loyalty = clamp(fighter.loyalty + 5, 0, 100);

    return {
      success: true,
      outcome: 'promise_made',
      promiseType: chosen.kind,
      promiseLabel: chosen.label,
      deadlineAbsWeek: absWeekNow + chosen.deadlineWeeks,
      message: `Você prometeu "${chosen.label}" para si mesmo nas próximas ${chosen.deadlineWeeks} semanas. Cumpra ou a lealdade despencará.`,
    };
  }

  // Deixar ir: aceita a sondagem imediatamente — troca de academia/empresário
  //
  // Muta o `fighter` em memória em vez de chamar fighterCtrl.setAcademy()
  // (que faz seu próprio fetch-mutate-save): o caller (respond()/processWeek())
  // salva esse mesmo objeto logo depois, e um save duplo sobrescreveria
  // academyJoinedAbsWeek/previousAcademyIds com os valores obsoletos deste
  // objeto, fazendo o período de carência de generateApproaches() nunca
  // resetar após uma troca.
  async _letGo(fighter, approach, absWeekNow) {
    if (approach.targetType === 'academy') {
      if (fighter.academyId && fighter.academyId !== approach.rivalId && !fighter.previousAcademyIds.includes(fighter.academyId)) {
        fighter.previousAcademyIds.push(fighter.academyId);
      }
      fighter.academyId = approach.rivalId;
      fighter.academyJoinedAbsWeek = absWeekNow;
      fighter.coachSynergy = Math.round(fighter.coachSynergy * 0.4); // SYNERGY_CONFIG.CARRY_OVER_RATIO
      if (this.careerLogService) {
        await this.careerLogService.publish(fighter.id, 'academy_switch', absWeekNow, 40, { academyName: approach.rivalName });
      }
      return { success: true, outcome: 'switched', message: `Você trocou para ${approach.rivalName}.` };
    }
    if (this.managerService) {
      if (fighter.managerId) {
        const termResult = await this.managerService.terminate(fighter, absWeekNow, 0);
        if (!termResult.ok) return { success: false, outcome: 'insufficient_funds', message: termResult.reason };
      }
      await this.managerService.hire(fighter, approach.rivalId, absWeekNow);
    } else {
      fighter.managerId = approach.rivalId;
    }
    return { success: true, outcome: 'switched', message: `${approach.rivalName} agora é seu empresário.` };
  }

  // ===== Resolução automática (sondagem expira sem resposta) =====
  async _resolveApproach(approach, fighter, absWeekNow) {
    const trust = approach.targetType === 'academy'
      ? fighter.coachSynergy
      : (this.managerService ? (await this.managerService.getManager(fighter.managerId))?.trust ?? 50 : 50);

    const loyaltyFactor = fighter.loyalty / 100;
    const moraleFactor = fighter.morale / 100;
    const trustFactor = trust / 100;
    const tenureFactor = Math.min(1, ((absWeekNow - (fighter.academyJoinedAbsWeek || absWeekNow)) / 52));

    let retentionChance = 0.5
      + (loyaltyFactor * 0.2)
      + (moraleFactor * 0.15)
      + (trustFactor * 0.1)
      + (tenureFactor * 0.05);

    if (fighter.expectation?.urgency >= 3) retentionChance -= EXPECTATION_CONFIG.RIVAL_RETENTION_PENALTY;

    const stayed = Math.random() < clamp(retentionChance, 0, 0.95);
    if (!stayed) {
      if (approach.targetType === 'academy') {
        // Muta em memória em vez de chamar setAcademy() — ver comentário em _letGo().
        if (fighter.academyId && fighter.academyId !== approach.rivalId && !fighter.previousAcademyIds.includes(fighter.academyId)) {
          fighter.previousAcademyIds.push(fighter.academyId);
        }
        fighter.academyId = approach.rivalId;
        fighter.academyJoinedAbsWeek = absWeekNow;
        fighter.coachSynergy = Math.round(fighter.coachSynergy * 0.4);
        if (this.careerLogService) {
          await this.careerLogService.publish(fighter.id, 'academy_switch', absWeekNow, 40, { academyName: approach.rivalName });
        }
        this.notifService.add('warning', '💔 Você Trocou de Academia', `${approach.rivalName} te convenceu — você deixou sua academia anterior.`);
      } else {
        if (this.managerService) await this.managerService.hire(fighter, approach.rivalId, absWeekNow);
        else fighter.managerId = approach.rivalId;
        this.notifService.add('warning', '💔 Você Trocou de Empresário', `${approach.rivalName} te convenceu a assinar.`);
      }
    } else {
      fighter.loyalty = clamp(fighter.loyalty + 5, 0, 100);
      this.notifService.add('success', '✅ Você Ficou', 'Você decidiu manter o que já tinha. A lealdade cresceu.');
    }

    return stayed;
  }

  // ===== Processamento semanal =====
  async processWeek(absWeekNow, fighter) {
    const approaches = await this._loadApproaches();
    const resolved = [];

    for (const approach of approaches) {
      if (approach.resolved) continue;

      if (absWeekNow > approach.deadlineAbsWeek) {
        const stayed = await this._resolveApproach(approach, fighter, absWeekNow);
        await this.fighterCtrl.updateFighter(fighter);
        resolved.push({ ...approach, outcome: stayed ? 'stayed' : 'left' });
        approach.resolved = true;
        approach.response = 'expired';
      } else if (approach.response && !approach.responseOutcome && approach.response !== 'let_go') {
        const stayed = await this._resolveApproach(approach, fighter, absWeekNow);
        await this.fighterCtrl.updateFighter(fighter);
        approach.responseOutcome = stayed ? 'stayed' : 'left';
        approach.resolved = true;
        resolved.push({ ...approach, outcome: approach.responseOutcome });
      }
    }

    // Promessas
    if (fighter.promises && fighter.promises.length > 0) {
      for (const promise of fighter.promises) {
        if (promise.resolved) continue;
        let fulfilled = false;
        const b = promise.baseline || { titlesWon: 0, contractTier: 0, totalFights: 0 };

        if (promise.kind === 'title_shot') fulfilled = (fighter.titlesWon || 0) > b.titlesWon;
        else if (promise.kind === 'promotion_raise') fulfilled = (fighter.promotionContract?.tier || 0) > b.contractTier;
        else if (promise.kind === 'more_fights') fulfilled = ((fighter.record?.wins || 0) + (fighter.record?.losses || 0)) >= b.totalFights + 2;

        if (fulfilled) {
          promise.kept = true;
          promise.resolved = true;
          fighter.loyalty = clamp(fighter.loyalty + 20, 0, 100);
          this.notifService.add('success', '✅ Promessa Cumprida!', `Você cumpriu a promessa "${promise.label || promise.kind}"! Lealdade subiu bastante.`);
          await this.fighterCtrl.updateFighter(fighter);
        } else if (absWeekNow > promise.deadlineAbsWeek) {
          promise.kept = false;
          promise.resolved = true;
          fighter.loyalty = clamp(fighter.loyalty - 25, 0, 100);
          this.notifService.add('danger', '⚠️ Promessa Quebrada', `Você não cumpriu a promessa "${promise.label || promise.kind}". Lealdade caiu drasticamente.`);
          await this.fighterCtrl.updateFighter(fighter);
        }
      }
    }

    await this._saveApproaches(approaches);
    return resolved;
  }

  // A sondagem ativa no momento (no máximo 1 por vez, ver generateApproaches),
  // ainda sem resposta do jogador nem expirada — o que a UI mostra pra dar
  // as 4 opções (renegociar/bônus/promessa/deixar ir).
  async getPending() {
    const approaches = await this._loadApproaches();
    return approaches.find(a => !a.resolved && !a.response) || null;
  }

  // ===== Helpers de banco =====
  async _loadApproaches() {
    try {
      const doc = await this.db.get('gameState', 'retention');
      return doc ? doc.approaches || [] : [];
    } catch {
      return [];
    }
  }

  async _saveApproaches(approaches) {
    await this.db.put('gameState', { id: 'retention', approaches });
  }

  // ===== Gatilhos contextuais por mérito (Épico E — #5/#6) =====
  // Gera sondagens baseadas em milestones da carreira, não apenas baixa
  // sinergia/confiança. Roda semanalmente, respeitando o limite de 1
  // sondagem ativa por vez.
  async _checkMilestoneTriggers(now, fighter) {
    const approaches = await this._loadApproaches();
    if (approaches.some(a => !a.resolved)) return [];

    const triggers = [];
    const recentFight = fighter.latestFightResult;
    const weeksSinceFight = now - (fighter.lastFightAbsWeek || 0);
    const recentWin = recentFight?.won === true && weeksSinceFight <= RETENTION_CONFIG.RECENT_RESULT_WINDOW_WEEKS;
    const recentLoss = recentFight?.won === false && weeksSinceFight <= RETENTION_CONFIG.RECENT_RESULT_WINDOW_WEEKS;
    const recentKnockout = recentWin
      && weeksSinceFight <= RETENTION_CONFIG.RECENT_FINISH_WINDOW_WEEKS
      && /^(KO|TKO)/.test(recentFight.method || '');
    const canApproachManager = (managerId) => fighter.managerId !== managerId;

    // Empresário — streak de 3+ (vitórias consecutivas sem derrota)
    const streak = fighter.winStreak || 0;
    if (streak >= RETENTION_CONFIG.MANAGER_STREAK_MIN && canApproachManager('manager-aggressive')) {
      triggers.push({ type: 'manager', reason: 'win_streak', targetId: 'manager-aggressive', targetName: 'Marcelo Duarte' });
    }

    // Empresário — cinturão conquistado
    const belts = this.titleService ? await this.titleService.beltsOf(fighter.id) : [];
    if (belts.length > 0 && canApproachManager('manager-loyal')) {
      triggers.push({ type: 'manager', reason: 'belt_won', targetId: 'manager-loyal', targetName: 'Renata Alves' });
    }

    // Empresário — um nocaute recente e uma ascensão de fama são fatos de
    // carreira. A antiga condição "sem empresário" disparava uma abordagem
    // artificial toda semana e deixava o sistema invisível no onboarding.
    if (recentKnockout && canApproachManager('manager-conservative')) {
      triggers.push({ type: 'manager', reason: 'recent_knockout', targetId: 'manager-conservative', targetName: 'João Bittencourt' });
    }
    if ((fighter.popularity || 0) >= RETENTION_CONFIG.MANAGER_POPULARITY_THRESHOLD && canApproachManager('manager-aggressive')) {
      triggers.push({ type: 'manager', reason: 'popularity_rise', targetId: 'manager-aggressive', targetName: 'Marcelo Duarte' });
    }
    if (fighter.promotionContract?.status === 'active' && fighter.promotionContract.tier <= 2 && canApproachManager('manager-aggressive')) {
      triggers.push({ type: 'manager', reason: 'new_league', targetId: 'manager-aggressive', targetName: 'Marcelo Duarte' });
    }

    // Academia — derrota recente (últimas 8 semanas)
    if (recentLoss && fighter.academyId !== 'academy-blacktiger') {
      triggers.push({ type: 'academy', reason: 'recent_loss', targetId: 'academy-blacktiger', targetName: 'Black Tiger Team' });
    }

    // Academia — 2+ vitórias consecutivas (tenta subir de nível)
    const currentLevel = ACADEMIES.find(a => a.id === fighter.academyId)?.facilityLevel || 1;
    const betterAcademy = ACADEMIES.filter(a => a.id !== fighter.academyId && a.facilityLevel > currentLevel)
      .sort((a, b) => a.facilityLevel - b.facilityLevel)[0];
    if (streak >= RETENTION_CONFIG.ACADEMY_STREAK_MIN && betterAcademy) {
      triggers.push({ type: 'academy', reason: 'rising', targetId: betterAcademy.id, targetName: betterAcademy.name });
    }
    if (fighter.coachSynergy < RETENTION_CONFIG.LOW_SYNERGY_THRESHOLD && betterAcademy) {
      triggers.push({ type: 'academy', reason: 'coach_strain', targetId: betterAcademy.id, targetName: betterAcademy.name });
    }

    // Academia — rival mudou para uma academia diferente
    const rivalries = this.rivalryService ? await this.rivalryService.getRivalries(fighter.id) : [];
    for (const r of rivalries) {
      const rivalId = r.fighterAId === fighter.id ? r.fighterBId : r.fighterAId;
      const rivalFighter = await this.fighterCtrl.getFighter(rivalId);
      if (rivalFighter?.academyId && rivalFighter.academyId !== fighter.academyId) {
        const rivalAcademyName = ACADEMIES.find(a => a.id === rivalFighter.academyId)?.name || rivalFighter.academyId;
        triggers.push({ type: 'academy', reason: 'rival_there', targetId: rivalFighter.academyId, targetName: rivalAcademyName });
      }
    }

    // Empresário — uma rivalidade que chamou atenção e um post viral tornam
    // a abordagem uma consequência do mundo, não uma rolagem isolada.
    const famousRivalry = rivalries.some(r => r.intensity >= RETENTION_CONFIG.FAMOUS_RIVALRY_INTENSITY);
    if (famousRivalry && canApproachManager('manager-aggressive')) {
      triggers.push({ type: 'manager', reason: 'famous_rivalry', targetId: 'manager-aggressive', targetName: 'Marcelo Duarte' });
    }
    const recentLog = this.careerLogService
      ? await this.careerLogService.recentSince(now, RETENTION_CONFIG.RECENT_FINISH_WINDOW_WEEKS)
      : [];
    if (recentLog.some(e => e.fighterId === fighter.id && e.type === 'viral') && canApproachManager('manager-conservative')) {
      triggers.push({ type: 'manager', reason: 'viral', targetId: 'manager-conservative', targetName: 'João Bittencourt' });
    }

    const reasonLabels = {
      win_streak: (t) => `${t.targetName} notou sua sequência de vitórias e quer conversar.`,
      belt_won: (t) => `${t.targetName} viu sua conquista do cinturão. Quer representar você.`,
      rising: (t) => t.type === 'manager'
        ? `${t.targetName} está de olho na sua ascensão. Quer fazer uma proposta.`
        : `${t.targetName} acompanhou sua evolução. Quer te levar para o próximo nível.`,
      recent_loss: (t) => `${t.targetName} acredita que pode reconstruir sua carreira. Quer te treinar.`,
      rival_there: (t) => `${t.targetName} quer te contratar. Seu rival já treina lá.`,
      recent_knockout: (t) => `${t.targetName} viu seu nocaute recente e quer transformar esse momento em carreira.`,
      popularity_rise: (t) => `${t.targetName} percebeu que seu nome cresceu. Quer negociar sua próxima fase.`,
      new_league: (t) => `${t.targetName} quer representar você neste novo nível de competição.`,
      coach_strain: (t) => `${t.targetName} soube que sua relação com o técnico esfriou e oferece um novo ambiente.`,
      famous_rivalry: (t) => `${t.targetName} quer capitalizar a rivalidade que colocou você em evidência.`,
      viral: (t) => `${t.targetName} viu seu alcance explodir nas redes e quer levar sua carreira ao próximo nível.`,
    };

    // No máximo uma sondagem contextual. A mesma causa/entidade entra em
    // cooldown, evitando duplicatas e respeitando a decisão anterior.
    const eligible = triggers.filter(t => !approaches.some(a =>
      a.targetType === t.type
      && a.rivalId === t.targetId
      && a.reason === t.reason
      && now < (a.createdAt || 0) + RETENTION_CONFIG.CONTEXTUAL_COOLDOWN_WEEKS
    ));
    if (eligible.length === 0 || Math.random() > RETENTION_CONFIG.CONTEXTUAL_OFFER_CHANCE) return [];

    const t = eligible[Math.floor(Math.random() * eligible.length)];
    const label = reasonLabels[t.reason];
    const contextMessage = typeof label === 'function' ? label(t) : label;
    const approach = {
      id: generateId(),
      targetType: t.type,
      rivalId: t.targetId,
      rivalName: t.targetName,
      rivalScore: 0,
      reason: t.reason,
      contextMessage,
      deadlineAbsWeek: now + RETENTION_CONFIG.APPROACH_DEADLINE_WEEKS,
      createdAt: now,
      resolved: false,
      response: null,
    };

    approaches.push(approach);
    await this._saveApproaches(approaches);
    await this.notifService.add('warning', '📩 Proposta', approach.contextMessage);
    return [approach];
  }
}
