import { describe, expect, it } from 'vitest';
import { RivalryService } from '../js/services/rivalry-service.js';

function memoryDb() {
  const records = new Map();
  return {
    async getAll() { return [...records.values()]; },
    async put(_store, record) { records.set(record.id, structuredClone(record)); },
  };
}

describe('RivalryService decay', () => {
  it('preserva rivalidade recém-nascida durante a janela de descoberta', async () => {
    const db = memoryDb();
    const service = new RivalryService(db);
    const rivalry = await service.createRivalry('a', 'b', 'competitive', { atAbsWeek: 12 });

    await service.decayAll(1, 16);
    expect((await service.getRivalryBetween('a', 'b')).intensity).toBe(rivalry.intensity);

    await service.decayAll(1, 40);
    expect((await service.getRivalryBetween('a', 'b')).intensity).toBe(rivalry.intensity - 1);
  });
});
