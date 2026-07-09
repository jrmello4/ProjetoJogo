import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../js/controllers/simulation.js';
import { GAME_PLANS, GAME_PLAN_EDGE } from '../js/config/game-config.js';

function makeOpponent(striking = 50, grappling = 50, overrides = {}) {
  return {
    strikingScore: striking,
    grapplingScore: grappling,
    attributes: {
      cardio: 50,
      fightIQ: 50,
      power: 50,
      takedowns: 50,
      submissionOffense: 50,
      speed: 50,
      composure: 50,
      ...overrides,
    },
  };
}

describe('Game Plan Edge (SimulationEngine._planEdge)', () => {
  it('balanced plan has no edge', () => {
    const plan = GAME_PLANS.balanced;
    const opponent = makeOpponent(60, 40);
    const edge = SimulationEngine._planEdge(plan, opponent);
    assert.strictEqual(edge, 0);
  });

  it('striker plan strong vs grappler', () => {
    const plan = GAME_PLANS.striker;
    const opponent = makeOpponent(40, 60); // grappling > striking by 20 (> 6)
    const edge = SimulationEngine._planEdge(plan, opponent);
    assert.strictEqual(edge, GAME_PLAN_EDGE.strong);
  });

  it('striker plan weak vs striker', () => {
    const plan = GAME_PLANS.striker;
    const opponent = makeOpponent(70, 50); // striking > grappling by 20 (> 6)
    const edge = SimulationEngine._planEdge(plan, opponent);
    assert.strictEqual(edge, GAME_PLAN_EDGE.weak);
  });

  it('grappler plan strong vs striker', () => {
    const plan = GAME_PLANS.grappler;
    const opponent = makeOpponent(70, 40); // striking > grappling by 30 (> 6)
    const edge = SimulationEngine._planEdge(plan, opponent);
    assert.strictEqual(edge, GAME_PLAN_EDGE.strong);
  });

  it('pressure plan strong vs lowCardio', () => {
    const plan = GAME_PLANS.pressure;
    const opponent = makeOpponent(50, 50, { cardio: 40 });
    const edge = SimulationEngine._planEdge(plan, opponent);
    assert.strictEqual(edge, GAME_PLAN_EDGE.strong);
  });

  it('patient plan strong vs lowIq', () => {
    const plan = GAME_PLANS.patient;
    const opponent = makeOpponent(50, 50, { fightIQ: 40 });
    const edge = SimulationEngine._planEdge(plan, opponent);
    assert.strictEqual(edge, GAME_PLAN_EDGE.strong);
  });

  it('detects powerful trait from expanded attributes', () => {
    const plan = GAME_PLANS.striker;
    const opponent = makeOpponent(70, 40, { power: 70 }); // power >= 65
    // striking > grappling by 30 → traits: striker, powerful
    // striker plan strongVs: grappler, weakVs: striker
    // opponent has 'striker' trait → weak
    const edge = SimulationEngine._planEdge(plan, opponent);
    assert.strictEqual(edge, GAME_PLAN_EDGE.weak);
  });

  it('detects wrestler trait from takedowns', () => {
    // Grappler plan strongVs 'striker', weakVs 'grappler'
    // Create a striker opponent (striking > grappling by > 6)
    const plan = GAME_PLANS.grappler;
    const opponent = makeOpponent(70, 40, { takedowns: 60 }); // striking > grappling
    const edge = SimulationEngine._planEdge(plan, opponent);
    assert.strictEqual(edge, GAME_PLAN_EDGE.strong);
  });
});
