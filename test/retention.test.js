import { describe, expect, it } from 'vitest';
import { NarrativeChainService } from '../js/services/narrative-chain-service.js';
import { NotificationService } from '../js/services/notification-service.js';
import { WorldService, WORLD_HISTORY_LIMITS } from '../js/services/world-service.js';

function memoryDb(seed = {}) {
  const stores = new Map(Object.entries(seed).map(([name, rows]) => [
    name,
    new Map(rows.map(row => [row.id, structuredClone(row)])),
  ]));
  const recordsFor = (store) => {
    if (!stores.has(store)) stores.set(store, new Map());
    return stores.get(store);
  };
  return {
    async getAll(store) {
      return [...recordsFor(store).values()].map(value => structuredClone(value));
    },
    async get(store, id) {
      const value = recordsFor(store).get(id);
      return value ? structuredClone(value) : undefined;
    },
    async add(store, value) { recordsFor(store).set(value.id, structuredClone(value)); },
    async put(store, value) { recordsFor(store).set(value.id, structuredClone(value)); },
    async delete(store, id) { recordsFor(store).delete(id); },
  };
}

describe('long-career retention', () => {
  it('hard-caps notifications even if the player never marks them as read', async () => {
    const notifications = Array.from({ length: 260 }, (_, index) => ({
      id: `n-${index}`,
      type: 'info',
      title: 'Evento',
      message: 'Mensagem',
      read: false,
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    }));
    const db = memoryDb({ notifications });

    await new NotificationService(db).clearOld();

    expect((await db.getAll('notifications'))).toHaveLength(250);
  });

  it('bounds world history while preserving an old player event', async () => {
    const count = WORLD_HISTORY_LIMITS.completedEvents + 10;
    const events = Array.from({ length: count }, (_, index) => ({
      id: `event-${index}`,
      absWeek: index + 1,
      date: new Date(Date.UTC(2020, 0, index + 1)).toISOString(),
      status: 'completed',
      results: [{
        fighterAId: index === 0 ? 'player' : `ai-a-${index}`,
        fighterBId: `ai-b-${index}`,
      }],
    }));
    const fights = events.map((event, index) => ({
      id: `fight-${index}`,
      eventId: event.id,
      fighterId: index === 0 ? 'player' : `ai-a-${index}`,
      absWeek: event.absWeek,
      date: event.date,
    }));
    const db = memoryDb({ events, fights });
    const world = new WorldService(db, {}, null);

    const result = await world._pruneWorldHistory('player');

    expect(result.eventsRemoved).toBe(9);
    expect(await db.get('events', 'event-0')).toBeTruthy();
    expect(await db.get('fights', 'fight-0')).toBeTruthy();
    expect((await db.getAll('events')).length).toBeLessThanOrEqual(
      WORLD_HISTORY_LIMITS.completedEvents + WORLD_HISTORY_LIMITS.playerEvents
    );
  });

  it('caps persisted consequence chains', async () => {
    const chains = Array.from({ length: 190 }, (_, index) => ({
      id: `chain-${index}`,
      fighterId: 'player',
      absWeek: index,
    }));
    const db = memoryDb({ narrativeChains: chains });
    const service = new NarrativeChainService(db);

    await service._prune('player');

    expect(await db.getAll('narrativeChains')).toHaveLength(180);
  });
});
