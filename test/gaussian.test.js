import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Gaussian } from '../js/utils/gaussian.js';

describe('Gaussian', () => {
  it('random produces values in reasonable range', () => {
    const samples = [];
    for (let i = 0; i < 10000; i++) {
      samples.push(Gaussian.random(0, 1));
    }
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const avg = samples.reduce((s, v) => s + v, 0) / samples.length;

    assert.ok(min >= -5, `min ${min} should be >= -5`);
    assert.ok(max <= 5, `max ${max} should be <= 5`);
    assert.ok(Math.abs(avg) < 0.15, `avg ${avg} should be near 0`);
  });

  it('clamp wraps gaussian values within bounds', () => {
    for (let i = 0; i < 1000; i++) {
      const v = Gaussian.clamp(-3, 3, 0, 2);
      assert.ok(v >= -3, `value ${v} should be >= -3`);
      assert.ok(v <= 3, `value ${v} should be <= 3`);
    }
  });

  it('clamp with tight bounds returns only the bound value', () => {
    for (let i = 0; i < 100; i++) {
      assert.strictEqual(Gaussian.clamp(10, 10), 10);
    }
  });

  it('probability favors higher score', () => {
    const high = Gaussian.probability(80, 50);
    const low = Gaussian.probability(50, 80);
    assert.ok(high > 0.5, `P(80,50)=${high} should be > 0.5`);
    assert.ok(low < 0.5, `P(50,80)=${low} should be < 0.5`);
  });

  it('probability with equal scores is 0.5', () => {
    assert.strictEqual(Gaussian.probability(50, 50), 0.5);
  });

  it('probability is asymptotic near 1 for extreme mismatch', () => {
    const p = Gaussian.probability(1000, 0);
    assert.ok(p > 0.999, `P(1000,0)=${p} should be > 0.999`);
  });
});
