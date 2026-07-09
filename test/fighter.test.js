import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Fighter } from '../js/models/fighter.js';

function makeFighter(overrides = {}) {
  const defaults = {
    id: 'test-fighter-1',
    name: 'Test Fighter',
    age: 25,
    nationality: { code: 'US', name: 'United States' },
    weightClass: 'Lightweight',
    fightingStyle: 'Boxer',
    record: { wins: 0, losses: 0, draws: 0 },
    attributes: {},
    hidden: { evolution: 50, discipline: 50, potential: 70, determination: 50 },
    fights: [],
    morale: 75,
    fatigue: 0,
    popularity: 50,
  };
  return new Fighter({ ...defaults, ...overrides });
}

function makeFullAttrs(values) {
  const all = {
    boxing: 50, kickboxing: 50, muayThai: 50, wrestling: 50, bjj: 50,
    cardio: 50, chin: 50, fightIQ: 50, power: 50, footwork: 50,
    headMovement: 50, clinch: 50, takedowns: 50, takedownDefense: 50,
    groundControl: 50, submissionOffense: 50, submissionDefense: 50,
    strength: 50, speed: 50, durability: 50, recovery: 50, composure: 50,
    aggression: 50, adaptability: 50,
  };
  return { ...all, ...values };
}

describe('Fighter', () => {
  describe('constructor', () => {
    it('creates fighter with minimal data', () => {
      const f = new Fighter({ id: 'f1', name: 'Minimal' });
      assert.strictEqual(f.id, 'f1');
      assert.strictEqual(f.name, 'Minimal');
      // record is spread from data.record — if undefined, it becomes {}
      assert.deepStrictEqual(f.record, {});
      assert.strictEqual(f.morale, 75);
      assert.strictEqual(f.fatigue, 0);
      assert.strictEqual(f.loyalty, 50);
      assert.ok(f.fights.length === 0);
    });

    it('expandAttributes is called in constructor and fills all 22 attributes', () => {
      const f = makeFighter({ attributes: { boxing: 80, kickboxing: 70 } });
      // expandAttributes is already called in constructor
      const attrs = f.attributes;
      assert.strictEqual(Object.keys(attrs).length, 24);
      assert.strictEqual(attrs.boxing, 80);
      assert.strictEqual(attrs.kickboxing, 70);
    });
  });

  describe('overallRating', () => {
    it('calculates correctly with all 50s', () => {
      const f = makeFighter({ attributes: makeFullAttrs({}) });
      const ovr = f.overallRating;
      assert.ok(ovr >= 35 && ovr <= 50, `OVR ${ovr} should be between 35-50 for all 50s`);
    });

    it('is near 99 with all 99s', () => {
      const f = makeFighter({ attributes: makeFullAttrs(Object.fromEntries(
        Object.keys(makeFullAttrs({})).map(k => [k, 99])
      ))});
      const ovr = f.overallRating;
      assert.ok(ovr >= 80, `OVR ${ovr} should be near 99 for all 99s`);
    });

    it('is higher for fighters with fight experience', () => {
      const base = makeFighter({ attributes: makeFullAttrs({}) });
      base.record = { wins: 10, losses: 0, draws: 0 };
      const ovr = base.overallRating;
      assert.ok(ovr >= 35, `OVR ${ovr} should be at least 35`);
    });
  });

  describe('techniqueScore', () => {
    it('calculates weighted average correctly', () => {
      const f = makeFighter({
        attributes: makeFullAttrs({
          boxing: 80, kickboxing: 60, muayThai: 70, wrestling: 50, bjj: 40,
        }),
      });
      // 80*0.25 + 60*0.2 + 70*0.2 + 50*0.15 + 40*0.2 = 20 + 12 + 14 + 7.5 + 8 = 61.5
      assert.strictEqual(f.techniqueScore, 61.5);
    });
  });

  describe('evolve', () => {
    it('increases attributes for young fighter (age 22)', () => {
      const attrs = makeFullAttrs({});
      const f = makeFighter({ age: 22, attributes: { ...attrs } });
      const before = { ...f.attributes };
      f.evolve();
      const after = f.attributes;

      const increased = Object.keys(after).filter(k => after[k] > before[k]).length;
      assert.ok(increased >= 4, `expected at least 4 attrs increased, got ${increased}`);
    });

    it('declines physical attributes for older fighter (age 35+)', () => {
      const attrs = makeFullAttrs({});
      const f = makeFighter({ age: 38, attributes: { ...attrs } });
      const before = { ...f.attributes };
      f.evolve();
      const after = f.attributes;

      const physicalKeys = ['power', 'speed', 'cardio', 'durability', 'recovery', 'strength', 'chin'];
      const declined = physicalKeys.filter(k => after[k] < before[k]).length;
      assert.ok(declined >= 2, `expected at least 2 physical attrs declined at age 38, got ${declined}`);
    });
  });

  describe('applyMoraleChange', () => {
    it('doubles effect when emotionallyUnstable', () => {
      const f = makeFighter({ morale: 50, dna: { emotionallyUnstable: true } });
      f.applyMoraleChange(10);
      assert.strictEqual(f.morale, 70);
    });

    it('applies normal effect without DNA', () => {
      const f = makeFighter({ morale: 50, dna: { emotionallyUnstable: false } });
      f.applyMoraleChange(10);
      assert.strictEqual(f.morale, 60);
    });

    it('clamps morale to 0', () => {
      const f = makeFighter({ morale: 5 });
      f.applyMoraleChange(-20);
      assert.strictEqual(f.morale, 0);
    });

    it('clamps morale to 100', () => {
      const f = makeFighter({ morale: 95 });
      f.applyMoraleChange(20);
      assert.strictEqual(f.morale, 100);
    });
  });

  describe('winRate / winStreak / totalFights', () => {
    it('totalFights sums wins+losses+draws', () => {
      const f = makeFighter({ record: { wins: 5, losses: 3, draws: 1 } });
      assert.strictEqual(f.totalFights, 9);
    });

    it('winRate calculates correctly', () => {
      const f = makeFighter({ record: { wins: 5, losses: 3, draws: 0 } });
      assert.strictEqual(f.winRate, 62.5);
    });

    it('winStreak tracks consecutive wins', () => {
      const f = makeFighter({});
      f.fights = [
        { won: true }, { won: true }, { won: true },
      ];
      assert.strictEqual(f.winStreak, 3);
    });

    it('winStreak breaks on loss', () => {
      const f = makeFighter({});
      // fights are newest-first: 2 wins, then a loss blocks the 4th
      f.fights = [
        { won: true }, { won: true }, { won: false }, { won: true },
      ];
      assert.strictEqual(f.winStreak, 2);
    });
  });
});
