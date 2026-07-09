import { clamp, generateId } from '../utils/helpers.js';
import { RIVAL_GYM_CONFIG, GYM_CONFIG, EXPECTATION_CONFIG } from '../config/game-config.js';

// Épico A: retenção de atletas contra assédio de academias rivais.
//
// Fluxo: sondagem (rival demonstra interesse) → resposta (4 opções)
// → resolução (chance de reter baseada em loyalty, morale, trust).
//
// Dados persistidos em gameState doc { id: 'retention', approaches: [...] }
// Cada approach: { id, fighterId, rivalGymId, rivalGymName, rivalRep,
//   deadlineAbsWeek, createdAt, resolved: false, response: null }
const APPROACH_DEADLINE_WEEKS = 2;

export class RetentionService {
  constructor(db, fighterCtrl, notifService) {
    this.db = db;
    this.fighterCtrl = fighterCtrl;
    this.notifService = notifService;
  }

  // ===== Sondagem =====
  // Gera sondagens de rivais para atletas elegíveis (mesma lógica do antigo
  // assédio direto, mas em vez de transferir, registra um approach).
  async generateApproaches(absWeekNow, gym, team) {
    const approaches = await this._loadApproaches();
    const rivalGyms = await this._getRivalGyms();
    if (rivalGyms.length === 0) return [];

    const order = [...team].sort(() => Math.random() - 0.5);
    let newApproaches = 0;

    for (const fighter of order) {
      if (newApproaches >= 1) break; // max 1 approach por semana
      if (fighter.status === 'injured' || fighter.status === 'retired') continue;
      if (fighter.loyalty >= 80) continue; // lealdade alta protege

      const tenureWeeks = absWeekNow - (fighter.gymJoinedAbsWeek || absWeekNow);
      if (tenureWeeks < RIVAL_GYM_CONFIG.MIN_TENURE_WEEKS) continue;

      // Já tem approach ativo para este lutador?
      if (approaches.some(a => a.fighterId === fighter.id && !a.resolved)) continue;

      const rival = rivalGyms[Math.floor(Math.random() * rivalGyms.length)];
      const repEdge = Math.min(RIVAL_GYM_CONFIG.POACH_REP_EDGE_CAP,
        Math.max(0, rival.reputation - gym.reputation));
      let chance = RIVAL_GYM_CONFIG.POACH_BASE_CHANCE
        + ((100 - fighter.morale) / 100) * RIVAL_GYM_CONFIG.POACH_MORALE_WEIGHT
        + (repEdge / 100) * RIVAL_GYM_CONFIG.POACH_REP_WEIGHT;

      // Épico F2: atleta com expectativa urgente é alvo muito mais fácil
      if (fighter.expectation?.urgency >= 3) {
        chance += EXPECTATION_CONFIG.RIVAL_APPROACH_BONUS;
      }

      if (Math.random() >= chance) continue;

      approaches.push({
        id: generateId(),
        fighterId: fighter.id,
        fighterName: fighter.name,
        rivalGymId: rival.id,
        rivalGymName: rival.name,
        rivalRep: rival.reputation,
        deadlineAbsWeek: absWeekNow + APPROACH_DEADLINE_WEEKS,
        createdAt: absWeekNow,
        resolved: false,
        response: null,
      });
      newApproaches++;

      await this.notifService.add(
        'warning',
        '🔍 Sondagem Recebida',
        `${rival.name} demonstrou interesse em ${fighter.name}! Você tem ${APPROACH_DEADLINE_WEEKS} semanas para reagir na aba Minha Equipe.`
      );
    }

    if (newApproaches > 0) {
      await this._saveApproaches(approaches);
    }

    return approaches.filter(a => !a.resolved);
  }

  // ===== Resposta =====
  // 4 opções: renegociar, bônus de permanência, promessa, deixar ir.
  // Efeitos imediatos (cash, purseShare, loyalty) aplicados aqui.
  // A resolução (stayed/left) acontece em processWeek() via _resolveApproach,
  // EXCETO para "Deixar Ir" que libera o atleta imediatamente.
  // Retorna { success, outcome, message }
  async respond(absWeekNow, approachId, responseType, fighter, gym) {
    const approaches = await this._loadApproaches();
    const approach = approaches.find(a => a.id === approachId);
    if (!approach || approach.resolved) return { success: false, outcome: 'not_found' };

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
        outcome = this._renegotiate(fighter, gym, approach);
        break;
      case 'stay_bonus':
        outcome = this._stayBonus(fighter, gym, approach, absWeekNow);
        break;
      case 'promise':
        outcome = this._makePromise(fighter, approach, absWeekNow);
        break;
      case 'let_go': {
        // "Deixar Ir" é imediato — transfere o atleta para a rival
        outcome = this._letGo(fighter, gym, approach);
        const prevStatus = fighter.status;
        // F3: registra a passagem pela sua academia — arma o reencontro futuro.
        if (fighter.gymId && !fighter.previousGymIds.includes(fighter.gymId)) {
          fighter.previousGymIds.push(fighter.gymId);
        }
        fighter.status = 'rival';
        fighter.gymId = approach.rivalGymId;
        approach.resolved = true;
        await this.fighterCtrl.updateFighter(fighter);
        break;
      }
      default:
        outcome = { success: false, outcome: 'invalid' };
    }

    await this._saveApproaches(approaches);
    return { ...outcome, approach };
  }

  // Renegociar: aumenta purseShare do atleta (você abre mão de comissão)
  _renegotiate(fighter, gym, approach) {
    const boost = 0.05; // +5% de share para o atleta
    fighter.purseShare = Math.min(fighter.purseShare + boost, 0.95);
    fighter.loyalty = clamp(fighter.loyalty + 10, 0, 100);
    fighter.morale = clamp(fighter.morale + 10, 0, 100);

    return {
      success: true,
      outcome: 'renegotiated',
      message: `${fighter.name} recebeu +5% de participação na bolsa. Lealdade e moral subiram.`,
    };
  }

  // Bônus de permanência: pagamento imediato
  _stayBonus(fighter, gym, approach, absWeekNow) {
    const bonus = Math.round(1500 + fighter.popularity * 50);
    if (gym.cash < bonus) {
      return {
        success: false,
        outcome: 'insufficient_funds',
        message: `Bônus de permanência custa R$${bonus.toLocaleString('pt-BR')}. Saldo insuficiente.`,
      };
    }

    gym.addTransaction(absWeekNow, `Bônus permanência: ${fighter.name}`, -bonus);
    fighter.loyalty = clamp(fighter.loyalty + 20, 0, 100);
    fighter.morale = clamp(fighter.morale + 15, 0, 100);

    return {
      success: true,
      outcome: 'bonus_paid',
      message: `${fighter.name} recebeu R$${bonus.toLocaleString('pt-BR')} de bônus de permanência. Lealdade e moral subiram bastante.`,
    };
  }

  // Fazer uma promessa: sem custo agora, mas tem que cumprir depois
  _makePromise(fighter, approach, absWeekNow) {
    // Tipos de promessa possíveis
    const promiseTypes = [
      { kind: 'title_shot', label: 'Disputa de cinturão', deadlineWeeks: 26 },
      { kind: 'promotion_raise', label: 'Subir de tier', deadlineWeeks: 20 },
      { kind: 'more_fights', label: 'Lutar com mais frequência', deadlineWeeks: 16 },
    ];

    // Escolhe a promessa mais relevante para o atleta
    const chosen = promiseTypes[Math.floor(Math.random() * promiseTypes.length)];

    // Captura linha de base para verificação de cumprimento
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
      message: `Você prometeu "${chosen.label}" para ${fighter.name} nas próximas ${chosen.deadlineWeeks} semanas. Cumpra ou a lealdade despencará.`,
    };
  }

  // Deixar ir: atleta sai, leva o cinturão se tiver
  _letGo(fighter, gym, approach) {
    const prevStatus = fighter.status;
    // Não setamos gymId = rival.id aqui — o RivalGymService já cuida
    // da transferência na sua processWeek quando o approach expira sem
    // retenção bem-sucedida (ver _resolveApproach).
    // Aqui apenas marcamos que o jogador autorizou a saída.
    gym.reputation = Math.max(0, gym.reputation - 2);

    return {
      success: true,
      outcome: 'released',
      message: `${fighter.name} foi liberado. A academia perdeu 2 pontos de reputação.`,
    };
  }

  // ===== Resolução da retenção =====
  // Roda no fechamento das abordagens expiradas: calcula se o atleta fica
  // baseado em loyalty, morale, oferta do rival, trust da academia.
  // Retorna true se o atleta ficou, false se saiu.
  async _resolveApproach(approach, fighter, gym) {
    const loyaltyFactor = fighter.loyalty / 100; // 0..1
    const moraleFactor = fighter.morale / 100; // 0..1
    const trustFactor = gym.trust / 100; // 0..1
    const repFactor = Math.min(1, (gym.reputation - approach.rivalRep + 50) / 100);
    const tenureFactor = Math.min(1, ((approach.deadlineAbsWeek - (fighter.gymJoinedAbsWeek || approach.deadlineAbsWeek)) / 52));

    // Chance base: 40% + contribuições
    let retentionChance = 0.4
      + (loyaltyFactor * 0.2)   // lealdade adiciona até 20%
      + (moraleFactor * 0.15)   // moral adiciona até 15%
      + (trustFactor * 0.1)     // trust adiciona até 10%
      + (repFactor * 0.1)       // reputação relativa adiciona até 10%
      + (tenureFactor * 0.05);  // tempo de casa adiciona até 5%

    // Épico F2: atleta com expectativa não atendida é mais difícil de reter
    if (fighter.expectation?.urgency >= 3) {
      retentionChance -= EXPECTATION_CONFIG.RIVAL_RETENTION_PENALTY;
    }

    // Se o jogador respondeu, bônus adicional
    const responseBonus = approach.response === 'renegotiate' ? 0.15
      : approach.response === 'stay_bonus' ? 0.20
      : approach.response === 'promise' ? 0.10
      : approach.response === 'let_go' ? -0.30
      : 0;

    const finalChance = clamp(retentionChance + responseBonus, 0, 0.95);
    const stayed = Math.random() < finalChance;

    if (!stayed) {
      // Atleta sai
      const belts = []; // placeholder — titleService.beltsOf seria chamado aqui
      // F3: registra a passagem pela sua academia — arma o reencontro futuro.
      if (fighter.gymId && !fighter.previousGymIds.includes(fighter.gymId)) {
        fighter.previousGymIds.push(fighter.gymId);
      }
      fighter.status = 'rival';
      fighter.gymId = approach.rivalGymId;
      gym.reputation = Math.max(0, gym.reputation - 1);

      this.notifService.add(
        'warning',
        '💔 Atleta Perdido',
        `${fighter.name} não resistiu à proposta da ${approach.rivalGymName} e deixou a academia.`
      );
    } else {
      // Atleta fica
      fighter.loyalty = clamp(fighter.loyalty + 5, 0, 100);
      this.notifService.add(
        'success',
        '✅ Atleta Retido',
        `${fighter.name} decidiu ficar na academia. A lealdade cresceu.`
      );
    }

    return stayed;
  }

  // ===== Processamento semanal =====
  // 1. Verifica approaches expirados (não respondidos) e resolve
  // 2. Verifica promessas vencidas
  async processWeek(absWeekNow, gym) {
    const approaches = await this._loadApproaches();
    const resolved = [];

    for (const approach of approaches) {
      if (approach.resolved) continue;

      if (absWeekNow > approach.deadlineAbsWeek) {
        // Approach expirou sem resposta — resolver automaticamente
        const fighter = await this.fighterCtrl.getFighter(approach.fighterId);
        if (fighter) {
          const stayed = await this._resolveApproach(approach, fighter, gym);
          await this.fighterCtrl.updateFighter(fighter);
          resolved.push({ ...approach, outcome: stayed ? 'stayed' : 'left' });
        }
        approach.resolved = true;
        approach.response = 'expired';
      } else if (approach.response && !approach.responseOutcome) {
        // Já respondido — processar resolução
        const fighter = await this.fighterCtrl.getFighter(approach.fighterId);
        if (fighter) {
          const stayed = await this._resolveApproach(approach, fighter, gym);
          await this.fighterCtrl.updateFighter(fighter);
          approach.responseOutcome = stayed ? 'stayed' : 'left';
          approach.resolved = true;
          resolved.push({ ...approach, outcome: approach.responseOutcome });
        }
      }
    }

    // Verificar promessas de todos os atletas da equipe
    const team = await this._getTeam();
    for (const fighter of team) {
      if (!fighter.promises || fighter.promises.length === 0) continue;

      for (const promise of fighter.promises) {
        if (promise.kept) continue;

        // Verificar se a promessa foi cumprida
        let fulfilled = false;
        const b = promise.baseline || { titlesWon: 0, contractTier: 0, totalFights: 0 };

        if (promise.kind === 'title_shot') {
          fulfilled = (fighter.titlesWon || 0) > b.titlesWon;
        } else if (promise.kind === 'promotion_raise') {
          const currentTier = fighter.promotionContract?.tier || 0;
          fulfilled = currentTier > b.contractTier;
        } else if (promise.kind === 'more_fights') {
          const currentFights = (fighter.record?.wins || 0) + (fighter.record?.losses || 0);
          fulfilled = currentFights >= b.totalFights + 2; // pelo menos 2 lutas
        }

        if (fulfilled) {
          promise.kept = true;
          fighter.loyalty = clamp(fighter.loyalty + 20, 0, 100);
          gym.trust = clamp(gym.trust + 10, 0, 100);

          this.notifService.add(
            'success',
            '✅ Promessa Cumprida!',
            `Você cumpriu a promessa "${promise.label || promise.kind}" para ${fighter.name}! Lealdade e confiança aumentaram.`
          );

          await this.fighterCtrl.updateFighter(fighter);
        } else if (absWeekNow > promise.deadlineAbsWeek) {
          // Promessa quebrada — não cumprida dentro do prazo
          promise.kept = false;
          fighter.loyalty = clamp(fighter.loyalty - 25, 0, 100);
          gym.trust = clamp(gym.trust - 10, 0, 100);

          this.notifService.add(
            'danger',
            '⚠️ Promessa Quebrada',
            `Você não cumpriu a promessa "${promise.label || promise.kind}" para ${fighter.name}. Lealdade e confiança caíram drasticamente.`
          );

          await this.fighterCtrl.updateFighter(fighter);
        }
        // Se ainda dentro do prazo: não faz nada, espera
      }
    }

    await this._saveApproaches(approaches);
    return resolved;
  }

  // ===== Recompra (buyout) =====
  // Atleta que saiu pode voltar, com custo alto e chance baseada em
  // como ele está na academia rival.
  async buyout(fighter, gym, absWeekNow) {
    if (fighter.status !== 'rival' && fighter.gymId === GYM_CONFIG.ID) {
      return { success: false, message: `${fighter.name} já está na sua academia.` };
    }

    const cost = Math.round(5000 + fighter.overallRating * 400 + (fighter.popularity || 0) * 100);
    if (gym.cash < cost) {
      return { success: false, message: `Recomprar ${fighter.name} custa R$${cost.toLocaleString('pt-BR')}. Saldo insuficiente.` };
    }

    // Chance base: 30% + moral do atleta na rival + relacionamento anterior
    const moralePenalty = fighter.morale ? (100 - fighter.morale) / 100 * 0.3 : 0.15;
    const loyaltyMemory = (fighter.loyalty || 50) / 100 * 0.2;
    const buyoutChance = 0.3 + moralePenalty + loyaltyMemory;

    if (Math.random() < buyoutChance) {
      gym.addTransaction(absWeekNow, `Recompra: ${fighter.name}`, -cost);
      fighter.status = 'gym';
      fighter.gymId = GYM_CONFIG.ID;
      fighter.gymJoinedAbsWeek = absWeekNow;
      fighter.loyalty = clamp((fighter.loyalty || 50) + 10, 0, 100);
      await this.fighterCtrl.updateFighter(fighter);

      return {
        success: true,
        cost,
        message: `${fighter.name} voltou! Custo: R$${cost.toLocaleString('pt-BR')}.`,
      };
    }

    return {
      success: false,
      message: `${fighter.name} recusou voltar. Talvez ele esteja feliz onde está.`,
    };
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

  async _getRivalGyms() {
    try {
      const all = await this.db.getAll('organization');
      return all.filter(o => o.id.startsWith('rivalgym-'));
    } catch {
      return [];
    }
  }

  async _getTeam() {
    try {
      const team = await this.fighterCtrl.getByGym(GYM_CONFIG.ID);
      return team.filter(f => f.status === 'gym' || f.status === 'roster');
    } catch {
      return [];
    }
  }
}
