import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../js/controllers/simulation.js';
import { makeFighter } from './fixtures.js';

describe('SimulationEngine._applyAccumulatedDamage', () => {
  it('reassigns damage without throwing on back-to-back KOs (regression: const damage TDZ crash)', () => {
    const winner = makeFighter({ id: 'a' });
    const loser = makeFighter({ id: 'b' });
    const result = { method: 'KO', fighterAId: 'a', fighterBId: 'b', totalScoreA: 80, totalScoreB: 40 };

    const chinBefore = loser.attributes.chin;
    expect(() => {
      SimulationEngine._applyAccumulatedDamage(winner, loser, result);
      SimulationEngine._applyAccumulatedDamage(winner, loser, result);
    }).not.toThrow();
    expect(loser.attributes.chin).toBeLessThan(chinBefore);
  });

  it('ignores decisions — no permanent damage applied', () => {
    const winner = makeFighter({ id: 'a' });
    const loser = makeFighter({ id: 'b' });
    const result = { method: 'Decision (Unanimous)', fighterAId: 'a', fighterBId: 'b', totalScoreA: 60, totalScoreB: 55 };
    const chinBefore = loser.attributes.chin;

    SimulationEngine._applyAccumulatedDamage(winner, loser, result);
    expect(loser.attributes.chin).toBe(chinBefore);
  });
});

describe('SimulationEngine.simulateFight', () => {
  it('resolves to a winner/method without throwing across repeated runs', async () => {
    for (let i = 0; i < 10; i++) {
      const fighterA = makeFighter({ id: 'a', name: 'A' });
      const fighterB = makeFighter({ id: 'b', name: 'B' });
      const result = await SimulationEngine.simulateFight(fighterA, fighterB);
      expect(result).toBeTruthy();
      expect(result.method).toBeTruthy();
      if (!result.isDraw) {
        expect([result.fighterAId, result.fighterBId]).toContain(result.winnerId);
      }
    }
  });
});
