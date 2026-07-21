import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { GameController } from '../js/controllers/game-controller.js';

describe('migração de schema da carreira', () => {
  it('atualiza save v4 sem reinicializar o lutador existente', async () => {
    const original = new GameController();
    await original.init();
    const created = await original.createPlayerFighter({
      name: 'Legacy Career',
      weightClass: 'Lightweight',
      archetype: 'generalist',
      origin: null,
      difficultyId: 'normal',
      academyId: 'academy-blacktiger',
      managerId: null,
    });

    const oldMeta = await original.db.get('gameState', 'meta');
    await original.db.put('gameState', { ...oldMeta, schemaVersion: 4, migrationHistory: [] });

    const upgraded = new GameController();
    const player = await upgraded.init();
    const migratedMeta = await upgraded.db.get('gameState', 'meta');

    expect(player.id).toBe(created.id);
    expect(migratedMeta.schemaVersion).toBe(5);
    expect(migratedMeta.migrationHistory).toContainEqual(expect.objectContaining({ from: 4, to: 5 }));
  });
});
