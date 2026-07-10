import { generateId, clamp, formatCurrency } from '../utils/helpers.js';
import { OFFER_CONFIG, PROMOTIONS, GYM_CONFIG, TIER_LABELS } from '../config/game-config.js';

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
  async generateOffers(fighter, absWeekNow, gym) {
    if (fighter.promotionContract?.status === 'active') return; // já tem contrato

    const targetTier = this._currentTier(fighter);
    if (targetTier >= 3) return; // ainda não bate nem o gate de tier 2

    const gate = OFFER_CONFIG.TIER_GATES[targetTier];
    const eligible = this._checkGate(fighter, targetTier, gate, gym?.reputation || 50);
    if (!eligible) return; // bate wins/popularidade mas a reputação da academia ainda não acompanha

    // Buscar promoções do tier alvo
    const promos = PROMOTIONS.filter(p => p.tier === targetTier);
    if (promos.length === 0) return;

    // Gera uma proposta por promoção
    const offers = promos.map(promo => this._buildProposal(fighter, promo, absWeekNow));

    // Salva como documento de gameState
    const key = `contract-offer-${fighter.id}`;
    const existing = await this._getProposals(fighter.id);
    const allOffers = [...(existing || []), ...offers];

    await this.db.put('gameState', {
      id: key,
      fighterId: fighter.id,
      offers: allOffers,
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

  // Consome uma luta do contrato - chamado após settlePlayerFight
  async consumeFight(fighterId, won, gym = null, absWeekNow = null) {
    const fighter = await this.fighterCtrl.getFighter(fighterId);
    if (!fighter || !fighter.promotionContract) return;

    const contract = fighter.promotionContract;
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
      await this._handleExpiration(fighter, gym, absWeekNow ?? contract.signedAtAbsWeek);
      return;
    }

    await this.fighterCtrl.updateFighter(fighter);
  }

  // Ao expirar um contrato: se o cartel/popularidade do lutador já bate o
  // gate do tier acima, gera propostas do tier de cima (+ opção de renovar
  // no atual) em vez de renovar sozinho para sempre no mesmo tier — sem
  // isso, um campeão que nunca perde 2 seguidas jamais era reavaliado e
  // ficava preso no tier em que assinou o primeiro contrato.
  async _handleExpiration(fighter, gym, absWeekNow) {
    const oldContract = fighter.promotionContract;
    const targetTier = oldContract.tier - 1;
    const gate = targetTier >= 1 ? OFFER_CONFIG.TIER_GATES[targetTier] : null;
    const eligible = gate && this._checkGate(fighter, targetTier, gate, gym?.reputation ?? 50);

    if (!eligible) {
      await this._autoRenew(fighter);
      return;
    }

    const currentPromo = PROMOTIONS.find(p => p.id === oldContract.promotionId);
    const higherPromos = PROMOTIONS.filter(p => p.tier === targetTier);
    const offers = higherPromos.map(promo => this._buildProposal(fighter, promo, absWeekNow));
    if (currentPromo) {
      offers.push(this._buildProposal(fighter, currentPromo, absWeekNow));
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
      '🎉 Chance de Subir de Tier!',
      `${fighter.name} encerrou o contrato com ${oldContract.promotionName} credenciado para o próximo nível. Proposta(s) de ${TIER_LABELS[targetTier]} chegaram — escolha na aba Ofertas.`
    );
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

  // Renovação automática com termos melhores
  async _autoRenew(fighter) {
    if (!fighter.promotionContract) return;

    const oldContract = fighter.promotionContract;
    const promo = PROMOTIONS.find(p => p.id === oldContract.promotionId);
    if (!promo) return;

    // Renovação: mais lutas, bolsa maior
    const newLength = this._contractLength(fighter);
    const purseBoost = 1 + (fighter.popularity ?? 0) / 200; // até 1.5x
    const newBase = Math.round(oldContract.basePurse * purseBoost);

    fighter.promotionContract = {
      ...oldContract,
      fightsTotal: newLength,
      fightsRemaining: newLength,
      basePurse: newBase,
      winBonus: Math.round(newBase * 0.5),
      status: 'active',
      consecutiveLosses: 0,
    };

    await this.notifService.add(
      'success',
      'Contrato Renovado!',
      `${fighter.name} renovou com ${promo.name} — ${newLength} lutas, bolsa de ${formatCurrency(newBase)}.`
    );

    await this.fighterCtrl.updateFighter(fighter);
  }

  // Rescisão antecipada com multa — gym é passado pelo caller
  async terminate(fighter, absWeekNow, gym) {
    if (fighter.promotionContract?.status !== 'active') return false;

    const contract = fighter.promotionContract;
    const fine = Math.round(contract.fightsRemaining * contract.basePurse * 0.5);

    if (gym.cash < fine) {
      await this.notifService.add(
        'danger',
        'Multa alta demais',
        `Rescindir com ${contract.promotionName} custa ${formatCurrency(fine)}. Saldo insuficiente.`
      );
      return false;
    }

    gym.addTransaction(absWeekNow, `Multa rescisória: ${fighter.name}`, -fine);

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

  _checkGate(fighter, targetTier, gate, gymRep) {
    const wins = fighter.record?.wins || 0;
    const pop = fighter.popularity || 0;

    const meetsWins = wins >= gate.wins;
    const meetsPop = pop >= gate.popularity;
    if (!meetsWins && !meetsPop) return false;

    return gymRep >= gate.gymRep;
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
