import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { GameController } from '../js/controllers/game-controller.js';

describe('GameController facade', () => {
  it('expõe todo método chamado diretamente pelo App', async () => {
    const appSource = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
    const calledMethods = [...appSource.matchAll(/this\.game\.([A-Za-z_$][\w$]*)\s*\(/g)]
      .map(match => match[1]);
    const facadeMethods = Object.getOwnPropertyNames(GameController.prototype);

    expect([...new Set(calledMethods)].filter(method => !facadeMethods.includes(method))).toEqual([]);
  });

  it('preserva as ações de reabilitação e fim de carreira após a extração dos runtimes', async () => {
    const game = new GameController();
    const calls = [];
    game.runtime = {
      resolveRehabChoice: async (choice) => {
        calls.push(['rehab', choice]);
        return { ok: true, choice };
      },
      resolveEndCareer: async (fighterId, choice) => {
        calls.push(['retirement', fighterId, choice]);
        return { ok: true, choice };
      },
    };

    await expect(game.resolveRehabChoice('fast')).resolves.toEqual({ ok: true, choice: 'fast' });
    await expect(game.resolveEndCareer('fighter-1', 'commentator')).resolves.toEqual({ ok: true, choice: 'commentator' });
    expect(calls).toEqual([
      ['rehab', 'fast'],
      ['retirement', 'fighter-1', 'commentator'],
    ]);
  });
});
