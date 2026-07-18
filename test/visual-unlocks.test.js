import { describe, it, expect } from 'vitest';
import { VisualIdentityService } from '../js/services/visual-identity-service.js';
import { VISUAL_UNLOCKS } from '../js/config/visual-identity-config.js';
import { PortraitService } from '../js/services/portrait-service.js';

describe('visual unlocks + autoEvolve', () => {
  it('catalog has title_chain and street_simple', () => {
    expect(VISUAL_UNLOCKS.title_chain).toBeTruthy();
    expect(VISUAL_UNLOCKS.street_simple.check({})).toBe(true);
  });

  it('syncUnlocks grants street_simple always and title_chain after titles', () => {
    const f = {
      id: 'u1', age: 25, popularity: 20,
      record: { wins: 2, losses: 1, draws: 0 },
      visualUnlocks: [],
    };
    let r = VisualIdentityService.syncUnlocks(f);
    expect(r.newly).toContain('street_simple');
    expect(f.visualUnlocks).toContain('street_simple');

    f.titlesWon = 1;
    f.wasChampion = true;
    r = VisualIdentityService.syncUnlocks(f);
    expect(r.newly).toContain('title_chain');
    expect(f.visualUnlocks).toContain('champion_suit');
  });

  it('onTitleResolved marks wasChampion and unlocks title gear', () => {
    const f = {
      id: 'champ-1', age: 28, popularity: 60,
      titlesWon: 1,
      record: { wins: 12, losses: 1, draws: 0 },
      visualUnlocks: ['street_simple'],
      visualAutoEvolve: false,
      appearance: PortraitService._normalize({ hairStyle: 2 }),
    };
    const r = VisualIdentityService.onTitleResolved(f, { retained: false });
    expect(f.wasChampion).toBe(true);
    expect(f.visualUnlocks).toContain('title_chain');
    expect(r.newly.length).toBeGreaterThan(0);
    // without autoEvolve, appearance not force-equipped for player with lock-ish save
    // (appearance exists, autoEvolve false → shouldEquip false unless force for AI)
  });

  it('autoEvolve equips title chain patch on reward', () => {
    const f = {
      id: 'champ-2', age: 29, popularity: 75,
      titlesWon: 1,
      wasChampion: true,
      record: { wins: 14, losses: 2, draws: 0 },
      visualUnlocks: [],
      visualAutoEvolve: true,
      appearance: PortraitService._normalize({ accessory: 0, outfitStyle: 3 }),
    };
    const r = VisualIdentityService.applyCareerVisualRewards(f, {
      preferUnlockIds: ['title_chain'],
    });
    expect(f.visualUnlocks).toContain('title_chain');
    expect(r.appearance).toBeTruthy();
    expect(r.appearance.accessory).toBe(16);
  });

  it('listUnlockStatus marks locked vs unlocked', () => {
    const f = { id: 'x', titlesWon: 0, popularity: 10, visualUnlocks: ['street_simple'] };
    const list = VisualIdentityService.listUnlockStatus(f);
    const street = list.find(u => u.id === 'street_simple');
    const chain = list.find(u => u.id === 'title_chain');
    expect(street.unlocked).toBe(true);
    expect(chain.unlocked).toBe(false);
  });

  it('buildEraImaginePrompts returns 4 contexts', () => {
    const eras = VisualIdentityService.buildEraImaginePrompts({
      id: 'img', age: 30, popularity: 50,
      record: { wins: 8, losses: 3, draws: 0 },
    });
    expect(eras).toHaveLength(4);
    expect(eras.every(e => e.prompt && e.label)).toBe(true);
  });

  it('heat affects resolveForRender brows without saving', () => {
    const f = {
      id: 'hot', age: 27, popularity: 40, narrativeHeat: 20,
      record: { wins: 6, losses: 2, draws: 0 },
    };
    const a = VisualIdentityService.resolveForRender(f, 'default');
    expect(a.browStyle).toBe(1);
    expect(a.mouthStyle).toBe(6);
  });

  it('yearlyTick respects visualAutoEvolve false with appearance', () => {
    const appearance = PortraitService._normalize({ hairStyle: 5, accessory: 0 });
    const f = {
      id: 'p', age: 36, popularity: 50,
      appearance: { ...appearance },
      visualAutoEvolve: false,
      visualLock: false,
      record: { wins: 10, losses: 5, draws: 0 }, totalFights: 15,
    };
    const tick = VisualIdentityService.yearlyTick(f, () => 0.01);
    expect(tick.appearance).toBeNull();
    expect(f.appearance.hairStyle).toBe(5);
  });
});
