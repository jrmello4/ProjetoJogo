import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  PROMOTIONS,
  WORLD_CONFIG,
  CORE_WEIGHT_CLASSES,
} from '../js/config/game-config.js';
import { DataGenerator } from '../js/services/data-generator.js';
import { WorldService } from '../js/services/world-service.js';
import { makeFighter } from './fixtures.js';

// Baselines antigos (pré-aumento de população). Guardrails de regressão:
// o mundo não pode voltar a caber em 172 assinados + 14 free agents.
const OLD_SIGNED_CAPACITY = 172;
const OLD_FREE_AGENT_POOL = 14;

function signedCapacity() {
  return PROMOTIONS.reduce((sum, p) => sum + p.rosterSize, 0);
}

describe('world population knobs (shipped config)', () => {
  it('signed roster capacity is at least 1.5× the old baseline (172)', () => {
    const signed = signedCapacity();
    expect(signed).toBeGreaterThan(OLD_SIGNED_CAPACITY);
    expect(signed).toBeGreaterThanOrEqual(Math.ceil(OLD_SIGNED_CAPACITY * 1.5));
  });

  it('free-agent pool and min exceed the old free-agent baseline', () => {
    expect(WORLD_CONFIG.FREE_AGENT_POOL).toBeGreaterThan(OLD_FREE_AGENT_POOL);
    expect(WORLD_CONFIG.FREE_AGENT_MIN).toBeLessThanOrEqual(WORLD_CONFIG.FREE_AGENT_POOL);
    expect(WORLD_CONFIG.FREE_AGENT_MIN).toBeGreaterThan(0);
  });

  it('POPULATION_CAP sits above signed + free-agent seed (room for growth)', () => {
    const baselineActive = signedCapacity() + WORLD_CONFIG.FREE_AGENT_POOL;
    expect(WORLD_CONFIG.POPULATION_CAP).toBeGreaterThan(baselineActive);
  });

  it('annual draft bounds are ordered and non-zero', () => {
    expect(WORLD_CONFIG.DRAFT_MIN).toBeGreaterThan(0);
    expect(WORLD_CONFIG.DRAFT_MAX).toBeGreaterThanOrEqual(WORLD_CONFIG.DRAFT_MIN);
  });
});

describe('DataGenerator.generatePromotionRoster (shipped)', () => {
  it('length equals each promo rosterSize and covers every CORE_WEIGHT_CLASSES entry', () => {
    for (const promo of PROMOTIONS) {
      const roster = DataGenerator.generatePromotionRoster(promo, CORE_WEIGHT_CLASSES);
      expect(roster.length).toBe(promo.rosterSize);

      if (promo.rosterSize >= CORE_WEIGHT_CLASSES.length) {
        const classes = new Set(roster.map(f => f.weightClass));
        for (const wc of CORE_WEIGHT_CLASSES) {
          expect(classes.has(wc)).toBe(true);
        }
      }
    }
  });

  it('full world signed generation totals signed capacity (deterministic count)', () => {
    let total = 0;
    for (const promo of PROMOTIONS) {
      total += DataGenerator.generatePromotionRoster(promo, CORE_WEIGHT_CLASSES).length;
    }
    expect(total).toBe(signedCapacity());
    // Second pass — same structural total from config loops
    let total2 = 0;
    for (const promo of PROMOTIONS) {
      total2 += DataGenerator.generatePromotionRoster(promo, CORE_WEIGHT_CLASSES).length;
    }
    expect(total2).toBe(total);
  });
});

describe('WorldService draft + population cap (shipped paths)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('_annualDraftCount stays within DRAFT_MIN..DRAFT_MAX for edge RNG', () => {
    const ws = new WorldService();
    expect(ws._annualDraftCount(() => 0)).toBe(WORLD_CONFIG.DRAFT_MIN);
    expect(ws._annualDraftCount(() => 0.999999)).toBe(WORLD_CONFIG.DRAFT_MAX);
    for (let i = 0; i < 40; i++) {
      const n = ws._annualDraftCount();
      expect(n).toBeGreaterThanOrEqual(WORLD_CONFIG.DRAFT_MIN);
      expect(n).toBeLessThanOrEqual(WORLD_CONFIG.DRAFT_MAX);
    }
  });

  it('_trimPopulationIfNeeded retires enough non-player candidates over POPULATION_CAP', async () => {
    const cap = WORLD_CONFIG.POPULATION_CAP;
    const overBy = 12;
    const putCalls = [];
    const ws = new WorldService();
    ws.db = {
      put: async (store, row) => {
        putCalls.push({ store, row });
      },
    };

    // Player (must never trim) + weak old IA above cap
    const all = [
      makeFighter({
        id: 'player-1',
        age: 40,
        status: 'roster',
        attributes: { striking: 40, grappling: 40, cardio: 40 },
      }),
    ];
    for (let i = 0; i < cap + overBy; i++) {
      all.push(makeFighter({
        id: `ai-${i}`,
        age: 34,
        status: 'roster',
        attributes: { striking: 35, grappling: 35, cardio: 35 },
      }));
    }

    const activeBefore = all.filter(f => f.status !== 'retired' && f.status !== 'dead').length;
    expect(activeBefore).toBeGreaterThan(cap);

    const trimmed = await ws._trimPopulationIfNeeded(all, 'player-1');
    expect(trimmed).toBeGreaterThanOrEqual(overBy);

    const activeAfter = all.filter(f => f.status !== 'retired' && f.status !== 'dead').length;
    expect(activeAfter).toBeLessThanOrEqual(cap);
    expect(all.find(f => f.id === 'player-1').status).not.toBe('retired');
    expect(putCalls.every(c => c.store === 'fighters')).toBe(true);
    expect(putCalls.length).toBe(trimmed);
  });

  it('_trimPopulationIfNeeded is a no-op when under the cap', async () => {
    const ws = new WorldService();
    ws.db = { put: async () => { throw new Error('should not write'); } };
    const all = [
      makeFighter({ id: 'a', status: 'roster', age: 34 }),
      makeFighter({ id: 'b', status: 'roster', age: 34 }),
    ];
    expect(await ws._trimPopulationIfNeeded(all, 'a')).toBe(0);
  });
});
