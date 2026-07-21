import { describe, it, expect } from 'vitest';
import { FightOutcome } from '../js/controllers/fight-outcome.js';
import { makeFighter } from './fixtures.js';

describe('FightOutcome._applyAccumulatedDamage', () => {
  it('reassigns damage without throwing on back-to-back KOs (regression: const damage TDZ crash)', () => {
    const winner = makeFighter({ id: 'a' });
    const loser = makeFighter({ id: 'b' });
    const result = { method: 'KO', fighterAId: 'a', fighterBId: 'b', totalScoreA: 80, totalScoreB: 40 };

    const chinBefore = loser.attributes.chin;
    expect(() => {
      FightOutcome._applyAccumulatedDamage(winner, loser, result);
      FightOutcome._applyAccumulatedDamage(winner, loser, result);
    }).not.toThrow();
    expect(loser.attributes.chin).toBeLessThan(chinBefore);
  });

  it('ignores decisions — no permanent damage applied', () => {
    const winner = makeFighter({ id: 'a' });
    const loser = makeFighter({ id: 'b' });
    const result = { method: 'Decision (Unanimous)', fighterAId: 'a', fighterBId: 'b', totalScoreA: 60, totalScoreB: 55 };
    const chinBefore = loser.attributes.chin;

    FightOutcome._applyAccumulatedDamage(winner, loser, result);
    expect(loser.attributes.chin).toBe(chinBefore);
  });
});
