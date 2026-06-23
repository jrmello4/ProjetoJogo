export class Event {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.date = data.date;
    this.mainCard = data.mainCard || [];
    this.prelimCard = data.prelimCard || [];
    this.status = data.status || 'scheduled';
    this.results = data.results || [];
    this.revenue = data.revenue || 0;
    this.expenses = data.expenses || 0;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  get totalFights() {
    return this.mainCard.length + this.prelimCard.length;
  }

  get allFights() {
    return [
      ...this.mainCard.map(f => ({ ...f, card: 'main' })),
      ...this.prelimCard.map(f => ({ ...f, card: 'prelim' })),
    ];
  }

  addResult(result) {
    this.results.push(result);
  }

  isComplete() {
    return this.results.length === this.totalFights;
  }
}
