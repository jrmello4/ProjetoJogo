import { describe, expect, it } from 'vitest';
import { RivalryService } from '../js/services/rivalry-service.js';

function memoryDb() {
  const stores = new Map();
  const recordsFor = (store) => {
    if (!stores.has(store)) stores.set(store, new Map());
    return stores.get(store);
  };
  return {
    async getAll(store) { return [...recordsFor(store).values()].map(value => structuredClone(value)); },
    async get(store, id) {
      const value = recordsFor(store).get(id);
      return value ? structuredClone(value) : undefined;
    },
    async put(store, record) { recordsFor(store).set(record.id, structuredClone(record)); },
    async delete(store, id) { recordsFor(store).delete(id); },
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

describe('RivalryService interaction ledger', () => {
  it('requires cooldown and a real context change before repeating a prompt', async () => {
    const db = memoryDb();
    const service = new RivalryService(db);
    const rivalry = await service.createRivalry('player', 'rival', 'competitive', {
      atAbsWeek: 10,
      initialIntensity: 3,
    });

    expect(await service.canGenerateInteraction('player', rivalry, 10)).toBe(true);

    const prompt = {
      id: 'rivalry-prompt',
      eventId: 'event-1',
      rivalryId: rivalry.id,
      contextKey: service.interactionContext(rivalry),
      createdAbsWeek: 10,
      viewedAbsWeek: null,
    };
    await db.put('gameState', prompt);
    await service.recordInteractionGenerated('player', rivalry, prompt);

    expect(await service.canGenerateInteraction('player', rivalry, 50)).toBe(false);
    expect(await service.markInteractionViewed('player', 'event-1', 10)).toEqual({ ok: true });
    expect((await db.get('gameState', 'rivalry-prompt')).status).toBe('viewed');

    rivalry.increaseIntensity(1, 12);
    rivalry.addEvent('press_conference', 'Novo contexto');
    expect(await service.canGenerateInteraction('player', rivalry, 12)).toBe(false);
    expect(await service.canGenerateInteraction('player', rivalry, 16)).toBe(true);

    await service.markInteractionResolved('player', prompt, rivalry, 16, 'ignore');
    expect(await service.canGenerateInteraction('player', rivalry, 40)).toBe(false);

    rivalry.increaseIntensity(1, 41);
    rivalry.addEvent('rematch', 'A rivalidade mudou de contexto');
    expect(await service.canGenerateInteraction('player', rivalry, 41)).toBe(true);
  });
});
