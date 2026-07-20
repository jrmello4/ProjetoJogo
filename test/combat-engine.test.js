// test/combat-engine.test.js
import { describe, it, expect } from 'vitest';
import { CombatEngine } from '../js/controllers/combat-engine.js';
import { CombatResolver } from '../js/controllers/combat-resolver.js';
import { AICombat } from '../js/controllers/ai-combat.js';
import { ACTIVE_CARDS, getDefaultLoadout } from '../js/config/card-config.js';

// Helper to create a minimal fighter
function createFighter(id, name, overrides = {}) {
  return {
    id,
    name,
    attributes: {
      boxing: 50, kickboxing: 50, muayThai: 50, wrestling: 50, bjj: 50,
      power: 50, speed: 50, strength: 50, durability: 50, recovery: 50,
      chin: 50, cardio: 50, fightIQ: 50,
      footwork: 50, headMovement: 50, clinch: 50,
      takedowns: 50, takedownDefense: 50, groundControl: 50,
      submissionOffense: 50, submissionDefense: 50,
      composure: 50, aggression: 50, adaptability: 50,
      ...overrides,
    },
    style: 'freestyle',
    record: { wins: 0, losses: 0, draws: 0 },
  };
}

describe('CombatEngine', () => {
  it('should initialize state correctly', () => {
    const engine = new CombatEngine();
    const fighterA = createFighter(1, 'Player');
    const fighterB = createFighter(2, 'Opponent');
    const loadout = getDefaultLoadout('balanced');

    const state = engine._initState(fighterA, fighterB, false, loadout, loadout);

    expect(state.fighterA.ref.id).toBe(1);
    expect(state.fighterB.ref.id).toBe(2);
    expect(state.maxRounds).toBe(3); // fiveRounds = false
    expect(state.fighterA.position).toBe('distance');
    expect(state.fighterA.stamina).toBe(100);
  });

  it('should load default loadout for striker game plan', () => {
    const loadout = getDefaultLoadout('striker');
    expect(loadout.active).toContain('jab');
    expect(loadout.active).toContain('cross');
    expect(loadout.active).toContain('overhand');
    expect(loadout.active).toContain('highKick');
  });
});

describe('CombatResolver', () => {
  it('should calculate damage based on fighter attributes', () => {
    const fighter = createFighter(1, 'Test', { boxing: 80, power: 70 });
    const card = ACTIVE_CARDS.cross;
    const damage = CombatResolver.calcCardDamage(card, fighter);
    // cross uses boxing*0.6 + power*0.4 = 80*0.6 + 70*0.4 = 48+28 = 76% of base
    expect(damage).toBeCloseTo(25 * 0.76, 1);
  });

  it('should score a round correctly', () => {
    const turns = [
      { winner: 'A', effectiveA: 50, effectiveB: 20, margin: 30, rawDamageA: 40, rawDamageB: 15, damageA: 45, damageB: 18 },
      { winner: 'A', effectiveA: 45, effectiveB: 25, margin: 20, rawDamageA: 35, rawDamageB: 20, damageA: 40, damageB: 22 },
      { winner: 'A', effectiveA: 55, effectiveB: 15, margin: 40, rawDamageA: 45, rawDamageB: 10, damageA: 50, damageB: 12 },
    ];
    const score = CombatResolver.scoreRound(turns);
    // totalEffectiveA=150, totalEffectiveB=60 -> margin=90, which is > 70,
    // so the dominance override applies (10-7), not the plain turn-count
    // 10-9. This was verified by hand-tracing scoreRound's own threshold
    // logic (margin > 70 -> loserScore 7), independent of the Task 3 fix.
    expect(score.scoreA).toBe(10);
    expect(score.scoreB).toBe(7);
  });
});

describe('AICombat', () => {
  it('should select a card from available pool', () => {
    const cards = [
      { card: ACTIVE_CARDS.jab, remaining: Infinity },
      { card: ACTIVE_CARDS.cross, remaining: Infinity },
    ];
    const selected = AICombat.selectCard(cards, {
      fighterB: { position: 'range', stamina: 100 },
    }, []);
    expect(selected).toBeTruthy();
    expect(selected.id).toBeDefined();
  });
});
