import { describe, it, expect, vi, afterEach } from 'vitest';
import { WorldService } from '../js/services/world-service.js';
import { makeFighter } from './fixtures.js';

function fighters(n, overrides = () => ({})) {
  return Array.from({ length: n }, (_, i) => makeFighter({ id: `f${i}`, name: `F${i}`, ...overrides(i) }));
}

describe('WorldService._pairDivision', () => {
  afterEach(() => vi.restoreAllMocks());

  it('pairs rating neighbors when chaos does not roll (normal path)', () => {
    const ws = new WorldService();
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // acima de qualquer chance de caos
    const list = fighters(6);
    const pairs = ws._pairDivision(list, { tier: 2 });
    expect(pairs).toEqual([[list[0], list[1]], [list[2], list[3]], [list[4], list[5]]]);
  });

  it('never crashes and always pairs everyone (or leaves one odd fighter out) across many rolls', () => {
    const ws = new WorldService();
    for (let i = 0; i < 50; i++) {
      const list = fighters(6, () => ({ age: 20 + Math.floor(Math.random() * 20) }));
      const pairs = ws._pairDivision(list, { tier: 3 });
      const paired = pairs.flat();
      expect(new Set(paired).size).toBe(paired.length); // ninguém lutando duas vezes
      expect(paired.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('elite tier (1) is more conservative than regional (3) — fewer chaos pairings over many rolls', () => {
    const ws = new WorldService();
    const rolls = Array.from({ length: 2000 }, () => Math.random());
    let restore = vi.spyOn(Math, 'random');
    let i = 0;
    restore.mockImplementation(() => rolls[i++ % rolls.length]);

    const countChaos = (tier) => {
      i = 0;
      let chaos = 0;
      for (let n = 0; n < 200; n++) {
        const list = fighters(6, (idx) => ({ age: idx === 0 ? 40 : 22 }));
        const pairs = ws._pairDivision(list, { tier });
        // caos = par cujo primeiro elemento não é vizinho de rating natural
        if (pairs[0] && pairs[0][0] === list[0] && pairs[0][1] !== list[1]) chaos++;
      }
      return chaos;
    };

    const eliteChaos = countChaos(1);
    const regionalChaos = countChaos(3);
    expect(regionalChaos).toBeGreaterThanOrEqual(eliteChaos);
  });
});

describe('WorldService._buildEventHeadlines / upset detection', () => {
  it('uses the top-billing (last) result for the headline, not the first prelim', () => {
    const ws = new WorldService();
    const prelim = { isDraw: false, winnerId: 'a', fighterAId: 'a', fighterBId: 'b', fighterAName: 'A', fighterBName: 'B', winnerName: 'A', method: 'Decision (Unanimous)', ratingA: 60, ratingB: 58 };
    const mainEvent = { isDraw: false, winnerId: 'c', fighterAId: 'c', fighterBId: 'd', fighterAName: 'C', fighterBName: 'D', winnerName: 'C', method: 'KO (Punches)', ratingA: 80, ratingB: 78 };
    const outcome = { event: { name: 'Card 12' }, results: [prelim, mainEvent] };

    const headlines = ws._buildEventHeadlines(outcome);
    expect(headlines[0]).toContain('C venceu D');
    expect(headlines[0]).not.toContain('A venceu B');
  });

  it('flags an upset when the loser out-rated the winner by the configured gap', () => {
    const ws = new WorldService();
    const upsetFight = { isDraw: false, winnerId: 'b', fighterAId: 'a', fighterBId: 'b', fighterAName: 'A', fighterBName: 'B', winnerName: 'B', method: 'Submission', ratingA: 85, ratingB: 60 };
    expect(ws._isUpset(upsetFight)).toBe(true);
    expect(ws._formatHeadline('Card 1', upsetFight)).toContain('ZEBRA');
  });

  it('does not flag a close, non-upset fight', () => {
    const ws = new WorldService();
    const evenFight = { isDraw: false, winnerId: 'a', fighterAId: 'a', fighterBId: 'b', fighterAName: 'A', fighterBName: 'B', winnerName: 'A', method: 'Decision (Split)', ratingA: 70, ratingB: 68 };
    expect(ws._isUpset(evenFight)).toBe(false);
    expect(ws._formatHeadline('Card 1', evenFight)).not.toContain('ZEBRA');
  });

  it('surfaces a secondary upset headline from a non-top fight', () => {
    const ws = new WorldService();
    const top = { isDraw: false, winnerId: 'c', fighterAId: 'c', fighterBId: 'd', fighterAName: 'C', fighterBName: 'D', winnerName: 'C', method: 'Decision (Unanimous)', ratingA: 75, ratingB: 74 };
    const upset = { isDraw: false, winnerId: 'b', fighterAId: 'a', fighterBId: 'b', fighterAName: 'A', fighterBName: 'B', winnerName: 'B', method: 'KO (Punches)', ratingA: 85, ratingB: 60 };
    const outcome = { event: { name: 'Card 12' }, results: [upset, top] };

    const headlines = ws._buildEventHeadlines(outcome);
    expect(headlines).toHaveLength(2);
    expect(headlines[1]).toContain('ZEBRA');
  });
});
