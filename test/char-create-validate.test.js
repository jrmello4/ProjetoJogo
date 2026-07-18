import { describe, it, expect } from 'vitest';
import { validateCharCreateStep } from '../js/utils/char-create-validate.js';
import { ARCHETYPES, ORIGINS, DIFFICULTIES } from '../js/config/game-config.js';

function baseDraft(overrides = {}) {
  return {
    name: 'Ana Silva',
    weightClass: 'Lightweight',
    archetype: 'generalist',
    origin: Object.keys(ORIGINS)[0],
    difficultyId: 'normal',
    academyId: 'academy-blacktiger',
    managerId: 'manager-loyal',
    challengeMode: null,
    ...overrides,
  };
}

const ctx = {
  hasCompletedCareer: false,
  academies: [{ id: 'academy-blacktiger' }, { id: 'academy-fortaleza' }],
  managers: [{ id: 'manager-loyal' }, { id: 'manager-aggressive' }],
};

describe('validateCharCreateStep (shipped wizard gate)', () => {
  it('blocks empty name on step 1 (no silent Lutador Anônimo)', () => {
    const r = validateCharCreateStep(baseDraft({ name: '   ' }), 1, ctx);
    expect(r.ok).toBe(false);
    expect(r.field).toBe('name');
  });

  it('blocks empty name on Start (all)', () => {
    const r = validateCharCreateStep(baseDraft({ name: '' }), 'all', ctx);
    expect(r.ok).toBe(false);
    expect(r.field).toBe('name');
  });

  it('accepts a real name on step 1', () => {
    expect(validateCharCreateStep(baseDraft(), 1, ctx).ok).toBe(true);
  });

  it('blocks Heavyweight without completed career', () => {
    const r = validateCharCreateStep(baseDraft({ weightClass: 'Heavyweight' }), 1, ctx);
    expect(r.ok).toBe(false);
    expect(r.field).toBe('weightClass');
  });

  it('allows Heavyweight after completed career', () => {
    const r = validateCharCreateStep(
      baseDraft({ weightClass: 'Heavyweight' }),
      1,
      { ...ctx, hasCompletedCareer: true }
    );
    expect(r.ok).toBe(true);
  });

  it('step 2 requires valid archetype and origin', () => {
    expect(validateCharCreateStep(baseDraft({ archetype: 'nope' }), 2, ctx).ok).toBe(false);
    expect(validateCharCreateStep(baseDraft({ origin: 'nope' }), 2, ctx).ok).toBe(false);
    expect(validateCharCreateStep(baseDraft(), 2, ctx).ok).toBe(true);
    expect(Object.keys(ARCHETYPES).length).toBeGreaterThan(0);
  });

  it('step 3 requires academy and manager from ctx lists', () => {
    expect(validateCharCreateStep(baseDraft({ academyId: 'x' }), 3, ctx).ok).toBe(false);
    expect(validateCharCreateStep(baseDraft({ managerId: 'x' }), 3, ctx).ok).toBe(false);
    expect(validateCharCreateStep(baseDraft(), 3, ctx).ok).toBe(true);
  });

  it('blocks challenge mode without completed career on Start', () => {
    const r = validateCharCreateStep(baseDraft({ challengeMode: 'do_zero' }), 'all', ctx);
    expect(r.ok).toBe(false);
    expect(r.field).toBe('challengeMode');
  });

  it('allows challenge mode after completed career', () => {
    const r = validateCharCreateStep(
      baseDraft({ challengeMode: 'do_zero' }),
      'all',
      { ...ctx, hasCompletedCareer: true }
    );
    expect(r.ok).toBe(true);
  });

  it('happy path all with normal difficulty', () => {
    expect(DIFFICULTIES.some(d => d.id === 'normal')).toBe(true);
    expect(validateCharCreateStep(baseDraft(), 'all', ctx).ok).toBe(true);
  });
});
