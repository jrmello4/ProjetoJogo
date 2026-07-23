import { beforeEach, describe, expect, it } from 'vitest';
import { SaveService } from '../js/services/save-service.js';

const STORES = ['fighters', 'organization', 'events', 'fights', 'rivalries', 'hallOfFame', 'offers', 'narrativeChains'];

function validSave(overrides = {}) {
  return {
    version: 4,
    ...Object.fromEntries(STORES.map(store => [store, []])),
    fighters: [{ id: 'player-1', name: 'Tester' }],
    gameState: [
      { id: 'state', week: 4, year: 1 },
      { id: 'meta', mode: 'career-1-fighter', schemaVersion: 5, patches: [] },
      { id: 'career', playerFighterId: 'player-1' },
    ],
    ...overrides,
  };
}

describe('SaveService.importSave', () => {
  beforeEach(() => {
    const values = new Map();
    globalThis.localStorage = {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key),
      clear: () => values.clear(),
    };
  });

  it('valida antes de substituir e envia todas as stores numa única operação', async () => {
    const calls = [];
    const service = new SaveService({ replaceStores: async snapshot => calls.push(snapshot) });

    await service.importSave(JSON.stringify(validSave()));

    expect(calls).toHaveLength(1);
    expect(Object.keys(calls[0]).sort()).toEqual([...STORES, 'gameState'].sort());
    expect(calls[0].gameState.find(record => record.id === 'career').playerFighterId).toBe('player-1');
  });

  it('rejeita save inválido antes de alterar qualquer store', async () => {
    const calls = [];
    const service = new SaveService({ replaceStores: async snapshot => calls.push(snapshot) });
    const corrupt = validSave({ fighters: [{ id: 'duplicado' }, { id: 'duplicado' }] });

    await expect(service.importSave(JSON.stringify(corrupt))).rejects.toThrow('id duplicado');
    expect(calls).toHaveLength(0);
  });

  it('migrates a save from before narrative chains existed', async () => {
    const calls = [];
    const service = new SaveService({ replaceStores: async snapshot => calls.push(snapshot) });
    const legacy = validSave();
    delete legacy.narrativeChains;

    await service.importSave(JSON.stringify(legacy));

    expect(calls).toHaveLength(1);
    expect(calls[0].narrativeChains).toEqual([]);
  });

  it('round-trips a career export through the validated importer', async () => {
    const snapshot = validSave({
      events: [{ id: 'event-1', name: 'Noite de luta' }],
      fights: [{ id: 'fight-1', fighterAId: 'player-1' }],
    });
    const source = new Map(Object.entries(snapshot));
    const sourceDb = { getAll: async store => structuredClone(source.get(store) || []) };
    const imported = [];
    const targetDb = { replaceStores: async data => imported.push(data) };

    const exported = await new SaveService(sourceDb).exportSave();
    await new SaveService(targetDb).importSave(exported);

    expect(imported).toHaveLength(1);
    expect(imported[0].events).toEqual(snapshot.events);
    expect(imported[0].fights).toEqual(snapshot.fights);
    expect(imported[0].gameState.find(item => item.id === 'career').playerFighterId).toBe('player-1');
  });
});
