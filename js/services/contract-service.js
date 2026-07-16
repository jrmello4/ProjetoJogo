import { generateId, formatCurrency } from '../utils/helpers.js';
import { OFFER_CONFIG, PROMOTIONS, TIER_LABELS } from '../config/game-config.js';

// Ciclo de vida dos contratos exclusivos com promoções (Épico B).
// Fluxo: proposta → aceite → vigência → expiração/corte/rescisão.
export class ContractService {
  constructor(db, fighterCtrl, notifService) {
    this.db = db;
    this.fighterCtrl = fighterCtrl;
    this.notifService = notifService;
  }

  // Calcula duração do contrato baseada na popularidade do lutador
  _contractLength(fighter) {
    const pop = fighter.popularity ?? 0;
    if (pop >= 80) return 8;
    if (pop >= 60) return 6;
    if (pop >= 40) return 5;
    if (pop >= 20) return 4;
    return 3;
  }

  // Gera propostas de contrato quando o lutador atinge os gates de tier.
  // Sem contrato, o lutador só recebe lutas avulsas do circuito regional
  // (OfferService cai pro tier 3 incondicionalmente) — isto aqui é o único
  // caminho pra tirá-lo de lá. `_currentTier` já devolve o tier MAIS ALTO
  // cujo gate de vitórias/popularidade o lutador bate (1 = elite); a
  // proposta é para ESSE tier, não um acima dele.
  async generateOffers(fighter, absWeekNow, academyReputation = 50) {
    if (fighter.promotionContract?.status === 'active') return; // já tem contrato

    // Já existe um bloco de propostas ativo (não expirado)? Não gera outro.
    // Sem esta trava, generateOffers rodava TODA semana e ACRESCENTAVA um
    // novo par de propostas (uma por promoção do tier) ao doc — em 4 semanas
    // o lutador via 8 propostas, 4 cópias idênticas de cada promoção. Deixa
    // o bloco atual de pé até ser aceito, recusado ou expirar.
    const key = `contract-offer-${fighter.id}`;
    const existingDoc = await this.db.get('gameState', key);
    if (existingDoc?.offers?.length && absWeekNow < (existingDoc.expiresAt ?? Infinity)) return;

    const targetTier = this._currentTier(fighter);
    if (targetTier >= 3) return; // ainda não bate nem o gate de tier 2

    const gate = OFFER_CONFIG.TIER_GATES[targetTier];
    const eligible = this._checkGate(fighter, targetTier, gate, academyReputation);
    if (!eligible) return; // bate wins/popularidade mas a reputação da academia ainda não acompanha

    // Buscar promoções do tier alvo
    const promos = PROMOTIONS.filter(p => p.tier === targetTier);
    if (promos.length === 0) return;

    // Uma proposta por promoção — SUBSTITUI o bloco anterior (que aqui só
    // pode estar expirado, pela trava acima), nunca empilha em cima dele.
    const offers = promos.map(promo => this._buildProposal(fighter, promo, absWeekNow));

    await this.db.put('gameState', {
      id: key,
      fighterId: fighter.id,
      offers,
      createdAt: absWeekNow,
      expiresAt: absWeekNow + 3,
    });

    await this.notifService.add(
      'contract',
      'Proposta de Contrato!',
      `${fighter.name} recebeu proposta(s) de contrato exclusivo! Verifique na aba Ofertas.`
    );
  }

  // Busca propostas pendentes de um lutador
  async _getProposals(fighterId) {
    try {
      const doc = await this.db.get('gameState', `contract-offer-${fighterId}`);
      return doc ? doc.offers : null;
    } catch {
      return null;
    }
  }

  // Aceita uma proposta, remove as concorrentes
  async accept(fighterId, promoId, absWeekNow) {
    const fighter = await this.fighterCtrl.getFighter(fighterId);
    if (!fighter) return null;

    const key = `contract-offer-${fighterId}`;
    const doc = await this.db.get('gameState', key);
    if (!doc) return null;

    const proposal = doc.offers.find(o => o.promotionId === promoId);
    if (!proposal) return null;

    fighter.promotionContract = {
      promotionId: proposal.promotionId,
      promotionName: proposal.promotionName,
      tier: proposal.tier,
      fightsTotal: proposal.fightsTotal,
      fightsRemaining: proposal.fightsTotal,
      basePurse: proposal.basePurse,
      winBonus: proposal.winBonus,
      exclusive: true,
      titleClause: proposal.titleClause || false,
      signedAtAbsWeek: absWeekNow,
      status: 'active',
      consecutiveLosses: 0,
    };

    await this.fighterCtrl.updateFighter(fighter);

    // Remove propostas concorrentes
    await this.db.delete('gameState', key);

    await this.notifService.add(
      'success',
      'Contrato Fechado!',
      `${fighter.name} agora é exclusivo do ${proposal.promotionName}.`
    );

    return fighter;
  }

  // Recusa todas as propostas de contrato
  async decline(fighterId) {
    const key = `contract-offer-${fighterId}`;
    try {
      await this.db.delete('gameState', key);
    } catch { /* ok se não existir */ }
  }

  // Adia a decisão sobre uma proposta de contrato.
  // A proposta fica em espera (postponed = true) e o jogador pode aceitá-la
  // depois quando o conflito (ex: cinturão de outra promoção) for resolvido.
  // O generateOffers não gera novas propostas enquanto o doc existir,
  // portanto o lutador não recebe propostas concorrentes enquanto adia.
  async postpone(fighterId) {
    const key = `contract-offer-${fighterId}`;
    try {
      const doc = await this.db.get('gameState', key);
      if (doc && !doc.postponed) {
        doc.postponed = true;
        doc.expiresAt = (doc.expiresAt || 0) + 52; // +1 ano para não expirar enquanto adia
        await this.db.put('gameState', doc);
      }
    } catch { /* ok */ }
  }

  // Consome uma luta do contrato - chamado após settlePlayerFight
  async consumeFight(fighterId, won, absWeekNow = null, academyReputation = 50) {
    const fighter = await this.fighterCtrl.getFighter(fighterId);
    if (!fighter || !fighter.promotionContract) return;

    const contract = fighter.promotionContract;
    if (contract.status !== 'active') return;
    contract.fightsRemaining--;

    // won === null → empate: não é vitória nem derrota, não mexe na sequência.
    if (won === true) {
      contract.consecutiveLosses = 0;
    } else if (won === false) {
      contract.consecutiveLosses = (contract.consecutiveLosses || 0) + 1;
    }

    // Controle de corte: 2 derrotas seguidas
    if (contract.consecutiveLosses >= 2 && contract.fightsRemaining > 0) {
      await this._checkCut(fighter);
      return;
    }

    // Contrato expirou - verificar se o lutador já bate o gate do tier
    // acima antes de renovar automaticamente no mesmo tier de sempre.
    if (contract.fightsRemaining <= 0) {
      contract.status = 'expired';
      await this._handleExpiration(fighter, academyReputation, absWeekNow ?? contract.signedAtAbsWeek);
      return;
    }

    await this.fighterCtrl.updateFighter(fighter);
  }

  // Ao expirar um contrato: SEMPRE força uma escolha na aba Ofertas — nunca
  // renova sozinho em silêncio. Se o cartel/popularidade bate o gate do
  // tier acima, a proposta de cima entra ao lado da renovação; senão, só a
  // renovação aparece. A renovação nunca é PIOR que o contrato que acabou
  // de terminar (_buildRenewalProposal aplica o piso) — sem isso, uma queda
  // de popularidade entre a assinatura e o fim do contrato (uma derrota já
  // basta) recalculava lutas/bolsa pra baixo e prendia o lutador numa
  // espiral de contratos cada vez piores, sem o jogador nunca ver a tela.
  async _handleExpiration(fighter, academyReputation, absWeekNow) {
    const oldContract = fighter.promotionContract;
    const targetTier = oldContract.tier - 1;
    const gate = targetTier >= 1 ? OFFER_CONFIG.TIER_GATES[targetTier] : null;
    const eligible = gate && this._checkGate(fighter, targetTier, gate, academyReputation ?? 50);

    const currentPromo = PROMOTIONS.find(p => p.id === oldContract.promotionId);
    const offers = [];

    if (eligible) {
      const higherPromos = PROMOTIONS.filter(p => p.tier === targetTier);
      offers.push(...higherPromos.map(promo => this._buildProposal(fighter, promo, absWeekNow)));
    }
    if (currentPromo) {
      offers.push(this._buildRenewalProposal(fighter, currentPromo, oldContract, absWeekNow));
    }

    const key = `contract-offer-${fighter.id}`;
    await this.db.put('gameState', {
      id: key,
      fighterId: fighter.id,
      offers,
      createdAt: absWeekNow,
      expiresAt: absWeekNow + 3,
    });

    await this.fighterCtrl.updateFighter(fighter);

    await this.notifService.add(
      'contract',
      eligible ? '🎉 Chance de Subir de Tier!' : 'Contrato Expirado',
      eligible
        ? `${fighter.name} encerrou o contrato com ${oldContract.promotionName} credenciado para o próximo nível. Proposta(s) de ${TIER_LABELS[targetTier]} chegaram — escolha na aba Ofertas.`
        : `${fighter.name} encerrou o contrato com ${oldContract.promotionName}. Escolha renovar na aba Ofertas.`
    );
  }

  // Renovação no mesmo tier: nunca pior que o contrato anterior. Sem este
  // piso, uma popularidade que caiu um pouco entre a assinatura e o fim do
  // contrato (uma derrota já basta) recalculava lutas/bolsa pra baixo — o
  // jogador via o cartel dele MELHORAR e o contrato PIORAR.
  _buildRenewalProposal(fighter, promo, oldContract, absWeekNow) {
    const base = this._buildProposal(fighter, promo, absWeekNow);
    const basePurse = Math.max(base.basePurse, Math.round(oldContract.basePurse * 1.05));
    return {
      ...base,
      fightsTotal: Math.max(base.fightsTotal, oldContract.fightsTotal),
      basePurse,
      winBonus: Math.max(base.winBonus, Math.round(basePurse * OFFER_CONFIG.WIN_BONUS_RATIO)),
    };
  }

  // Corte por duas derrotas seguidas
  async _checkCut(fighter) {
    const contract = fighter.promotionContract;
    const promo = PROMOTIONS.find(p => p.id === contract.promotionId);
    if (!promo) return;

    // Chance de corte baseada no tier e popularidade do lutador
    const cutChance = promo.tier === 1 ? 0.3 : promo.tier === 2 ? 0.25 : 0.2;
    const popMod = Math.max(0, 1 - (fighter.popularity ?? 0) / 100);

    if (Math.random() < cutChance * (1 + popMod)) {
      contract.status = 'released';

      await this.notifService.add(
        'warning',
        'Cortado!',
        `${fighter.name} foi cortado do ${contract.promotionName} após ${contract.consecutiveLosses} derrota(s) seguida(s).`
      );

      // Cortado = sem contrato
      fighter.promotionContract = null;
    }

    await this.fighterCtrl.updateFighter(fighter);
  }

  // Rescisão antecipada com multa — sai do caixa pessoal do lutador (§A.2)
  async terminate(fighter, absWeekNow) {
    if (fighter.promotionContract?.status !== 'active') return false;

    const contract = fighter.promotionContract;
    const fine = Math.round(contract.fightsRemaining * contract.basePurse * 0.5);

    if (fighter.cash < fine) {
      await this.notifService.add(
        'danger',
        'Multa alta demais',
        `Rescindir com ${contract.promotionName} custa ${formatCurrency(fine)}. Saldo insuficiente.`
      );
      return false;
    }

    fighter.addTransaction(absWeekNow, `Multa rescisória: ${fighter.name}`, -fine);

    contract.status = 'terminated';
    fighter.promotionContract = contract;
    await this.fighterCtrl.updateFighter(fighter);

    await this.notifService.add(
      'warning',
      'Contrato Rescindido',
      `${fighter.name} rescindiu com ${contract.promotionName}. Multa de ${formatCurrency(fine)} paga.`
    );

    return true;
  }

  // Determina o tier atual do lutador baseado no contrato
  currentTier(fighter) {
    if (fighter.promotionContract?.status === 'active') {
      return fighter.promotionContract.tier;
    }
    return this._currentTier(fighter);
  }

  // Helpers internos
  _currentTier(fighter) {
    const wins = fighter.record?.wins || 0;
    const pop = fighter.popularity || 0;

    const gates = OFFER_CONFIG.TIER_GATES;
    if ((pop >= gates[1].popularity || wins >= gates[1].wins)) return 1;
    if ((pop >= gates[2].popularity || wins >= gates[2].wins)) return 2;
    return 3;
  }

  _checkGate(fighter, targetTier, gate, academyReputation) {
    const wins = fighter.record?.wins || 0;
    const pop = fighter.popularity || 0;

    const meetsWins = wins >= gate.wins;
    const meetsPop = pop >= gate.popularity;
    if (!meetsWins && !meetsPop) return false;

    return academyReputation >= gate.gymRep;
  }

  _buildProposal(fighter, promo, absWeekNow) {
    const length = this._contractLength(fighter);
    const purseConfig = OFFER_CONFIG.PURSE[promo.tier];
    const basePurse = purseConfig.base + Math.round((fighter.popularity || 0) * purseConfig.perPop);

    return {
      id: generateId(),
      promotionId: promo.id,
      promotionName: promo.name,
      tier: promo.tier,
      fightsTotal: length,
      basePurse,
      winBonus: Math.round(basePurse * OFFER_CONFIG.WIN_BONUS_RATIO),
      titleClause: promo.tier <= 2,
      createdAt: absWeekNow,
    };
  }

}
