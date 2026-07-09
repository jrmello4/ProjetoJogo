// Oferta de luta enviada por uma promoção a um lutador da academia.
// Ciclo de vida: pending -> accepted -> completed
//                pending -> declined | expired
export const OFFER_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled', // ex.: adversário lesionado sem substituto
};

export class FightOffer {
  constructor(data) {
    this.id = data.id;
    this.promotionId = data.promotionId;
    this.promotionName = data.promotionName;
    this.tier = data.tier ?? 3;
    this.fighterId = data.fighterId; // lutador da academia
    this.opponentId = data.opponentId;
    this.opponentName = data.opponentName;
    this.opponentRecord = data.opponentRecord || null; // snapshot p/ exibição
    this.opponentOverall = data.opponentOverall ?? null;
    this.opponentStyle = data.opponentStyle || null;
    this.weightClass = data.weightClass;
    this.purse = data.purse ?? 0;
    this.winBonus = data.winBonus ?? 0;
    this.eventAbsWeek = data.eventAbsWeek; // semana absoluta da luta
    this.expiresAbsWeek = data.expiresAbsWeek; // deadline para responder
    this.status = data.status || OFFER_STATUS.PENDING;
    this.resultId = data.resultId || null;
    this.negotiated = data.negotiated || false; // negociação de bolsa é uma tentativa única

    // Disputa de cinturão. titleRole diz de que lado você está:
    // 'challenge' (desafia), 'defense' (defende), 'vacant' (cinturão vago).
    this.isTitleFight = data.isTitleFight || false;
    this.titleRole = data.titleRole || null;

    // Plano de jogo escolhido durante o camp. Vale por toda a luta.
    this.gamePlan = data.gamePlan || 'balanced';

    // Épico F4: o reencontro — adversário foi da academia
    this.isReencounter = data.isReencounter || false;

    this.createdAtAbsWeek = data.createdAtAbsWeek ?? 1;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  get isPending() {
    return this.status === OFFER_STATUS.PENDING;
  }

  get isAccepted() {
    return this.status === OFFER_STATUS.ACCEPTED;
  }

  get totalPotential() {
    return this.purse + this.winBonus;
  }
}
