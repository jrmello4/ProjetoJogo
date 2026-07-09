import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, generateId, getNationalityFlag, formatCurrency, round } from '../js/utils/helpers.js';

describe('Helpers', () => {
  describe('clamp', () => {
    it('returns value within bounds', () => {
      assert.strictEqual(clamp(5, 0, 10), 5);
    });

    it('clamps below minimum', () => {
      assert.strictEqual(clamp(-1, 0, 10), 0);
    });

    it('clamps above maximum', () => {
      assert.strictEqual(clamp(15, 0, 10), 10);
    });

    it('handles boundary values', () => {
      assert.strictEqual(clamp(50, 50, 100), 50);
      assert.strictEqual(clamp(100, 50, 100), 100);
    });
  });

  describe('generateId', () => {
    it('produces unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateId());
      }
      assert.strictEqual(ids.size, 1000);
    });

    it('returns a string', () => {
      const id = generateId();
      assert.strictEqual(typeof id, 'string');
      assert.ok(id.length > 5);
    });
  });

  describe('getNationalityFlag', () => {
    it('returns flag emoji for valid 2-letter code', () => {
      const flag = getNationalityFlag('BR');
      assert.strictEqual(typeof flag, 'string');
      assert.ok(flag.length >= 2);
    });

    it('returns empty string for empty input', () => {
      assert.strictEqual(getNationalityFlag(''), '');
    });

    it('returns empty string for invalid length', () => {
      assert.strictEqual(getNationalityFlag('USA'), '');
    });

    it('returns empty string for null', () => {
      assert.strictEqual(getNationalityFlag(null), '');
    });

    it('returns empty string for undefined', () => {
      assert.strictEqual(getNationalityFlag(undefined), '');
    });
  });

  describe('formatCurrency', () => {
    it('formats positive number', () => {
      const result = formatCurrency(1500);
      assert.ok(result.includes('1,500') || result.includes('1.500'));
    });

    it('formats zero', () => {
      assert.strictEqual(formatCurrency(0), '$0');
    });
  });

  describe('round', () => {
    it('rounds to specified decimal places', () => {
      assert.strictEqual(round(1.2345, 2), 1.23);
    });

    it('rounds to 0 decimals', () => {
      assert.strictEqual(round(1.5, 0), 2);
    });

    it('defaults to 1 decimal place', () => {
      assert.strictEqual(round(1.2345), 1.2);
    });
  });
});
