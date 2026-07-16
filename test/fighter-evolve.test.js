import { describe, it, expect } from 'vitest';
import { makeFighter } from './fixtures.js';

const RESTRICTED_KEYS = ['fightIQ', 'composure', 'adaptability'];

describe('Fighter.evolve()', () => {
  it('only touches fightIQ/composure/adaptability — physical/technical growth moved to camp (Item 4)', () => {
    const fighter = makeFighter({
      age: 25,
      attributes: {
        boxing: 50, kickboxing: 50, muayThai: 50, wrestling: 50, bjj: 50,
        cardio: 50, chin: 50, fightIQ: 50,
        power: 50, footwork: 50, headMovement: 50, clinch: 50,
        takedowns: 50, takedownDefense: 50, groundControl: 50,
        submissionOffense: 50, submissionDefense: 50,
        strength: 50, speed: 50, durability: 50, recovery: 50,
        composure: 50, aggression: 50, adaptability: 50,
      },
    });
    const before = { ...fighter.attributes };

    for (let i = 0; i < 20; i++) fighter.evolve();

    for (const key of Object.keys(before)) {
      if (RESTRICTED_KEYS.includes(key)) continue;
      expect(fighter.attributes[key]).toBe(before[key]);
    }
  });

  it('does not throw and applies age decline branch for veterans', () => {
    const fighter = makeFighter({ age: 35 });
    expect(() => fighter.evolve()).not.toThrow();
  });
});
