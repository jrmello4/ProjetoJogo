import { describe, it, expect } from 'vitest';
import {
  APPEARANCE_CATEGORIES,
  DEFAULT_APPEARANCE,
  HAIR_STYLES,
  BEARD_STYLES,
  OUTFIT_STYLES,
  FACE_SHAPES,
} from '../js/config/appearance-config.js';
import { PortraitService } from '../js/services/portrait-service.js';

describe('appearance catalog expansion', () => {
  it('exposes rich hair / beard / outfit / face catalogs', () => {
    expect(HAIR_STYLES.length).toBeGreaterThanOrEqual(20);
    expect(BEARD_STYLES.length).toBeGreaterThanOrEqual(10);
    expect(OUTFIT_STYLES.length).toBeGreaterThanOrEqual(8);
    expect(FACE_SHAPES.length).toBeGreaterThanOrEqual(5);
    expect(APPEARANCE_CATEGORIES.length).toBeGreaterThanOrEqual(16);
  });

  it('keeps legacy index 0 meaning stable for original hair styles', () => {
    expect(HAIR_STYLES[0].label).toBe('Careca');
    expect(HAIR_STYLES[3].label).toBe('Moicano');
    expect(BEARD_STYLES[0].label).toBe('Limpo');
    expect(OUTFIT_STYLES[0].id).toBe('octagon');
  });

  it('DEFAULT_APPEARANCE has every category key', () => {
    for (const cat of APPEARANCE_CATEGORIES) {
      expect(DEFAULT_APPEARANCE).toHaveProperty(cat.key);
      expect(DEFAULT_APPEARANCE[cat.key]).toBe(0);
    }
  });
});

describe('PortraitService (shipped render path)', () => {
  it('normalize clamps unknown keys and out-of-range indices', () => {
    const a = PortraitService._normalize({
      hairStyle: 999,
      skinTone: -1,
      faceShape: 1,
      nonsense: 3,
    });
    expect(a.hairStyle).toBe(0);
    expect(a.skinTone).toBe(0);
    expect(a.faceShape).toBe(1);
    expect(a).not.toHaveProperty('nonsense');
    for (const cat of APPEARANCE_CATEGORIES) {
      expect(a[cat.key]).toBeGreaterThanOrEqual(0);
      expect(a[cat.key]).toBeLessThan(cat.options.length);
    }
  });

  it('render returns SVG with portrait class for every outfit + hair sample', () => {
    for (let outfit = 0; outfit < OUTFIT_STYLES.length; outfit++) {
      const svg = PortraitService.render({ ...DEFAULT_APPEARANCE, outfitStyle: outfit }, { size: 64 });
      expect(svg).toContain('<svg');
      expect(svg).toContain('class="portrait');
      expect(svg).toContain('</svg>');
    }
    for (let h = 0; h < HAIR_STYLES.length; h++) {
      const svg = PortraitService.render({ ...DEFAULT_APPEARANCE, hairStyle: h }, { size: 48 });
      expect(svg).toContain('<svg');
    }
  });

  it('appearanceFor is stable for same id and differs across ids', () => {
    const a = PortraitService.appearanceFor({ id: 'f-alpha' });
    const b = PortraitService.appearanceFor({ id: 'f-alpha' });
    const c = PortraitService.appearanceFor({ id: 'f-beta' });
    expect(a).toEqual(b);
    // high chance different; if equal on all keys still ok if rare — check hair or face
    const same = APPEARANCE_CATEGORIES.every(cat => a[cat.key] === c[cat.key]);
    expect(same).toBe(false);
  });

  it('uses persisted appearance when present', () => {
    const custom = { ...DEFAULT_APPEARANCE, hairStyle: 3, outfitStyle: 4 };
    const a = PortraitService.appearanceFor({ id: 'x', appearance: custom });
    expect(a.hairStyle).toBe(3);
    expect(a.outfitStyle).toBe(4);
  });

  it('veteran bias tends toward scars or grey more than pure random seed alone', () => {
    // Sample many veteran fighters — should see elevated scar/grey rates vs young clean
    let vetScar = 0;
    let youngScar = 0;
    const n = 80;
    for (let i = 0; i < n; i++) {
      const vet = PortraitService.appearanceFor({
        id: `vet-${i}`,
        age: 40,
        totalFights: 30,
        popularity: 40,
        fightingStyle: 'wrestler',
      });
      const young = PortraitService.appearanceFor({
        id: `young-${i}`,
        age: 21,
        totalFights: 1,
        popularity: 10,
        fightingStyle: 'boxer',
      });
      if (vet.scarStyle > 0) vetScar++;
      if (young.scarStyle > 0) youngScar++;
    }
    // Veterans should accumulate more scars on average (probabilistic but strong with bias)
    expect(vetScar).toBeGreaterThan(youngScar);
  });

  it('describe returns readable identity lines', () => {
    const d = PortraitService.describe(DEFAULT_APPEARANCE);
    expect(d.hair).toBeTruthy();
    expect(d.style).toContain('Octógono');
  });

  it('catalogStats reports huge combinatorial space', () => {
    const s = PortraitService.catalogStats();
    expect(s.categories).toBe(APPEARANCE_CATEGORIES.length);
    // log10(combos) >> 10 means millions+ combinations
    expect(s.combosLog10).toBeGreaterThan(12);
  });
});
