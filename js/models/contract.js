export class Contract {
  constructor(data) {
    this.pursePerFight = data.pursePerFight || 10000;
    this.duration = data.duration || 3;
    this.victoryBonus = data.victoryBonus || 5000;
    this.fightsRemaining = data.fightsRemaining || data.duration;
    this.signedAt = data.signedAt || new Date().toISOString();
  }

  get totalValue() {
    return this.pursePerFight * this.duration + this.victoryBonus * this.duration;
  }

  get isActive() {
    return this.fightsRemaining > 0;
  }

  useFight() {
    this.fightsRemaining--;
  }

  getFighterPay(won) {
    let pay = this.pursePerFight;
    if (won) {
      pay += this.victoryBonus;
    }
    return pay;
  }
}
