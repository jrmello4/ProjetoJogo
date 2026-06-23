export class Organization {
  constructor(data) {
    this.id = data.id || 'org-001';
    this.name = data.name || 'Nova Fight Promotions';
    this.money = data.money || 500000;
    this.reputation = data.reputation || 50;
    this.roster = data.roster || [];
    this.eventsHosted = data.eventsHosted || 0;
    this.champions = data.champions || [];
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  addMoney(amount) {
    this.money += amount;
  }

  spendMoney(amount) {
    this.money -= amount;
  }

  canAfford(amount) {
    return this.money >= amount;
  }

  updateReputation(change) {
    this.reputation = Math.max(0, Math.min(100, this.reputation + change));
  }
}
