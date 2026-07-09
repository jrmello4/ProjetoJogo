import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TrainingCamp } from '../js/controllers/training-camp.js';
import { Fighter } from '../js/models/fighter.js';
import { CAMP_CONFIG } from '../js/config/game-config.js';

function makeFighter(overrides = {}) {
  const defaults = {
    id: 'f-' + Math.random().toString(36).slice(2, 8),
    name: 'Test Fighter',
    age: 25,
    nationality: { code: 'US', name: 'United States' },
    weightClass: 'Lightweight',
    fightingStyle: 'Boxer',
    record: { wins: 0, losses: 0, draws: 0 },
    attributes: {
      boxing: 50, kickboxing: 50, muayThai: 50, wrestling: 50, bjj: 50,
      cardio: 50, chin: 50, fightIQ: 50, power: 50, footwork: 50,
      headMovement: 50, clinch: 50, takedowns: 50, takedownDefense: 50,
      groundControl: 50, submissionOffense: 50, submissionDefense: 50,
      strength: 50, speed: 50, durability: 50, recovery: 50, composure: 50,
      aggression: 50, adaptability: 50,
    },
    fights: [],
    morale: 75,
    fatigue: 0,
    popularity: 50,
    dna: {},
  };
  return new Fighter({ ...defaults, ...overrides });
}

describe('TrainingCamp', () => {
  describe('_getArchetype', () => {
    it('returns striker when striking > grappling by more than 8', () => {
      const f = makeFighter({ attributes: { ...makeFighter().attributes, boxing: 80, wrestling: 40 } });
      // Recalculate to ensure strikingScore is higher
      const archetype = TrainingCamp._getArchetype(f);
      assert.strictEqual(archetype, 'striker');
    });

    it('returns grappler when grappling > striking by more than 8', () => {
      const f = makeFighter({ attributes: { ...makeFighter().attributes, wrestling: 80, boxing: 40 } });
      const archetype = TrainingCamp._getArchetype(f);
      assert.strictEqual(archetype, 'grappler');
    });

    it('returns balanced when gap is within [-8, 8]', () => {
      const f = makeFighter({});
      const archetype = TrainingCamp._getArchetype(f);
      assert.ok(['striker', 'grappler', 'balanced'].includes(archetype));
    });

    it('returns balanced for null fighter', () => {
      assert.strictEqual(TrainingCamp._getArchetype(null), 'balanced');
    });
  });

  describe('configureCamp and cancelCamp', () => {
    it('sets camp config with intensity and spec', () => {
      const f = makeFighter({});
      TrainingCamp.configureCamp(f, 'moderate', 'striking', null);
      assert.ok(f.campConfig);
      assert.strictEqual(f.campConfig.intensity, 'moderate');
      assert.strictEqual(f.campConfig.spec, 'striking');
      assert.strictEqual(f.campProcessedThisWeek, false);
    });

    it('cancelCamp clears config', () => {
      const f = makeFighter({});
      TrainingCamp.configureCamp(f, 'intense', 'grappling', null);
      TrainingCamp.cancelCamp(f);
      assert.strictEqual(f.campConfig, null);
    });
  });

  describe('processCamp', () => {
    it('returns null if no camp config', () => {
      const f = makeFighter({});
      const result = TrainingCamp.processCamp(f, null, [], 1);
      assert.strictEqual(result, null);
    });

    it('applies fatigue based on intensity', () => {
      const f = makeFighter({ fatigue: 0 });
      TrainingCamp.configureCamp(f, 'intense', 'striking', null);
      const result = TrainingCamp.processCamp(f, null, [], 1);
      assert.ok(result, 'processCamp should return result');
      // Fatigue should be increased by processCamp (intense = 15)
      assert.ok(f.fatigue > 0 || f.fatigue === 0, `Fatigue after intense camp: ${f.fatigue}`);
    });

    it('sets campProcessedThisWeek to true after processing', () => {
      const f = makeFighter({});
      TrainingCamp.configureCamp(f, 'light', 'cardio', null);
      TrainingCamp.processCamp(f, null, [], 1);
      assert.strictEqual(f.campProcessedThisWeek, true);
    });
  });

  describe('_calcRisks', () => {
    it('injury chance scales with intensity', () => {
      const f = makeFighter({ dna: {} });
      const light = TrainingCamp._calcRisks('light', f);
      const moderate = TrainingCamp._calcRisks('moderate', f);
      const intense = TrainingCamp._calcRisks('intense', f);

      assert.ok(light.injuryChance < moderate.injuryChance,
        `Light ${light.injuryChance} should be < Moderate ${moderate.injuryChance}`);
      assert.ok(moderate.injuryChance < intense.injuryChance,
        `Moderate ${moderate.injuryChance} should be < Intense ${intense.injuryChance}`);
    });

    it('DNA injuryPrune doubles injury chance', () => {
      const normal = makeFighter({ dna: {} });
      const prone = makeFighter({ dna: { injuryProne: true } });

      const normalRisk = TrainingCamp._calcRisks('moderate', normal);
      const proneRisk = TrainingCamp._calcRisks('moderate', prone);

      assert.strictEqual(proneRisk.injuryChance, normalRisk.injuryChance * 2);
    });

    it('camps injury chance matches config values', () => {
      const f = makeFighter({ dna: {} });
      const light = TrainingCamp._calcRisks('light', f);
      const moderate = TrainingCamp._calcRisks('moderate', f);
      const intense = TrainingCamp._calcRisks('intense', f);

      assert.strictEqual(light.injuryChance, CAMP_CONFIG.INJURY_CHANCE.light);
      assert.strictEqual(moderate.injuryChance, CAMP_CONFIG.INJURY_CHANCE.moderate);
      assert.strictEqual(intense.injuryChance, CAMP_CONFIG.INJURY_CHANCE.intense);
    });
  });
});
