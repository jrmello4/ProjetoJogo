import { beforeEach, describe, expect, it } from 'vitest';
import { SaveService } from '../js/services/save-service.js';

const STORES = ['fighters', 'organization', 'events', 'fights', 'rivalries', 'hallOfFame', 'offers'];

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
});
