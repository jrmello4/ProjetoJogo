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
    const isClose = Math.abs((result.totalScoreA || 0) - (result.totalScoreB || 0)) < 10;
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

  // Épico F1: a provocação na coletiva de imprensa esquenta a rivalidade
  // antes da luta acontecer. Quanto maior o hype, maior o heat gerado.
  // Se não existe rivalidade ainda, cria uma com intensity baseada no hype.
  async addPressConferenceHeat(fighterAId, fighterBId, hypeLevel, promotionId = null) {
    const existing = await this.getRivalryBetween(fighterAId, fighterBId);
    const intensityGain = Math.ceil(hypeLevel / 8); // hype 15 → +2, hype 25 → +4

    if (existing) {
      const rivalry = new Rivalry(existing);
      const oldIntensity = rivalry.intensity;
      rivalry.increaseIntensity(intensityGain);
      const heatLabel = rivalry.intensity > oldIntensity ? 'intensificou' : 'permanece';
      rivalry.addEvent('press_conference', `Provocação na coletiva — hype ${hypeLevel} (${heatLabel} para ${rivalry.intensity})`);
      await this.db.put('rivalries', rivalry);
      return rivalry;
    }

    // Hype mínimo para criar rivalidade pré-luta
    if (hypeLevel < 15) return null;

    const rivalry = new Rivalry({
      id: 'rvl-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      fighterAId,
      fighterBId,
      intensity: Math.min(intensityGain, 3),
      type: hypeLevel >= 22 ? 'personal' : 'competitive',
      history: [{ type: 'press_conference', description: `Rivalidade nascida na coletiva — provocação gerou hype ${hypeLevel}` }],
    });

    await this.db.put('rivalries', rivalry);
    return rivalry;
  }
}