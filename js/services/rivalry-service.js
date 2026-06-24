import { Rivalry } from '../models/rivalry.js';

export class RivalryService {
  constructor(db) {
    this.db = db;
  }

  async getRivalries(fighterId) {
    const all = await this.db.getAll('rivalries');
    return all.filter(r =>
      r.active && (r.fighterAId === fighterId || r.fighterBId === fighterId)
    );
  }

  async getRivalryBetween(fighterAId, fighterBId) {
    const all = await this.db.getAll('rivalries');
    return all.find(r =>
      r.active &&
      ((r.fighterAId === fighterAId && r.fighterBId === fighterBId) ||
       (r.fighterAId === fighterBId && r.fighterBId === fighterAId))
    ) || null;
  }

  async createRivalry(fighterAId, fighterBId, type = 'competitive') {
    const existing = await this.getRivalryBetween(fighterAId, fighterBId);
    if (existing) return existing;

    const rivalry = new Rivalry({
      id: 'rvl-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      fighterAId,
      fighterBId,
      intensity: 1,
      type,
      history: [{ type: 'created', description: 'Rivalidade formada após luta' }],
    });

    await this.db.put('rivalries', rivalry);
    return rivalry;
  }

  async checkPostFight(fighterA, fighterB, result, isMainCard) {
    const existing = await this.getRivalryBetween(fighterA.id, fighterB.id);

    if (existing) {
      // Wrap plain DB object in Rivalry instance
      const rivalry = new Rivalry(existing);
      rivalry.increaseIntensity(1);
      rivalry.addEvent('rematch', `Rematch — ${result.winnerName} venceu`);
      await this.db.put('rivalries', rivalry);
      return rivalry;
    }

    // Criar nova rivalidade se luta foi close ou main card
    const isClose = Math.abs(result.stats.diff) < 10;
    const shouldCreate = isMainCard || isClose;

    if (shouldCreate) {
      const type = isClose ? 'competitive' : 'personal';
      return await this.createRivalry(fighterA.id, fighterB.id, type);
    }

    return null;
  }

  async getAllActive() {
    const all = await this.db.getAll('rivalries');
    return all.filter(r => r.active);
  }
}