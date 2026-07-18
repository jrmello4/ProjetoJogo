import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { GameController } from '../js/controllers/game-controller.js';
import { ORIGINS, FIGHTING_STYLES, MOVES } from '../js/config/game-config.js';

// Regressão: a origem esportiva escolhida na criação de personagem tem que
// definir o estilo MECÂNICO do lutador (fighter.style), não só o rótulo.
// Antes, data.style ficava o randomStyle() do gerador — jogador escolhia
// Boxe e nascia Wrestler (ou qualquer outro dos 5, na sorte).
describe('createPlayerFighter — origem define o estilo de luta', () => {
  for (const [originKey, origin] of Object.entries(ORIGINS)) {
    it(`origem ${origin.label} vira estilo ${origin.styleKey}`, async () => {
      const game = new GameController();
      await game.init();

      const fighter = await game.createPlayerFighter({
        name: `Teste ${origin.label}`,
        weightClass: 'Lightweight',
        archetype: 'generalist',
        origin: originKey,
        difficultyId: 'normal',
        academyId: 'academy-blacktiger',
        managerId: null,
      });

      expect(fighter.style).toBe(origin.styleKey);

      // Moveset coerente com o estilo novo (todo golpe vem do pool do
      // estilo) e com proficiência válida — regenerado junto com o estilo.
      const pool = FIGHTING_STYLES[origin.styleKey].poolMoves;
      expect(fighter.moveset.length).toBeGreaterThan(0);
      for (const m of fighter.moveset) {
        expect(pool).toContain(m);
        expect(MOVES[m]).toBeTruthy();
        expect(fighter.moveProficiency[m]).toBeGreaterThanOrEqual(10);
        expect(fighter.moveProficiency[m]).toBeLessThanOrEqual(100);
      }
    });
  }
});
