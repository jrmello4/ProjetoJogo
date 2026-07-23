import { describe, expect, it } from 'vitest';
import { CombatAdapter } from '../js/controllers/combat-adapter.js';
import { formatCombatDamage, formatCombatNumber } from '../js/utils/helpers.js';

describe('combat number presentation boundary', () => {
  it('removes floating-point residue and keeps at most one decimal', () => {
    expect(formatCombatDamage(10.649999999999999)).toBe('10.6');
    expect(formatCombatDamage(1.6499999999999997)).toBe('1.6');
    expect(formatCombatDamage(4.000000000000001)).toBe('4');
    expect(formatCombatDamage(-0)).toBe('0');
  });

  it('fails closed for invalid values and supports other combat precisions', () => {
    expect(formatCombatDamage(Number.NaN)).toBe('0');
    expect(formatCombatDamage(Number.POSITIVE_INFINITY)).toBe('0');
    expect(formatCombatNumber(9.876, 2)).toBe('9.88');
  });

  it('sanitizes the round log consumed by feeds, results and history', () => {
    const adapter = new CombatAdapter();
    const state = {
      fighterA: { ref: { id: 'player' } },
      fighterB: { ref: { id: 'rival', name: 'Rival' } },
    };
    adapter._recordRoundAction(state, 1, {
      cardA: { name: 'Jab', type: 'strike' },
      cardB: { name: 'Chute', type: 'strike' },
      damageA: 10.649999999999999,
      damageB: 1.6499999999999997,
    }, null, null);

    const details = state.roundActionLog[1].map(entry => entry.detail).join(' ');
    expect(details).toContain('10.6 de dano');
    expect(details).toContain('1.6 de dano');
    expect(details).not.toMatch(/999999|0000000000001/);
  });
});
