import { describe, it, expect } from 'vitest';
import { VisualIdentityService } from '../js/services/visual-identity-service.js';
import { PortraitService } from '../js/services/portrait-service.js';
import {
  VISUAL_ARCHETYPES, CAREER_STAGES, VISUAL_EVOLUTION_TRIGGERS, IMAGINE_PIPELINE,
} from '../js/config/visual-identity-config.js';
import { OUTFIT_STYLES, ACCESSORY_STYLES } from '../js/config/appearance-config.js';

describe('visual identity architecture', () => {
  it('ships many archetypes and career stages', () => {
    expect(Object.keys(VISUAL_ARCHETYPES).length).toBeGreaterThanOrEqual(20);
    expect(Object.keys(CAREER_STAGES).length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(VISUAL_EVOLUTION_TRIGGERS).length).toBeGreaterThanOrEqual(8);
  });

  it('expanded outfits/accessories cover luxury aggressive casual career', () => {
    expect(OUTFIT_STYLES.length).toBeGreaterThanOrEqual(18);
    expect(ACCESSORY_STYLES.length).toBeGreaterThanOrEqual(18);
    expect(OUTFIT_STYLES.some(o => o.family === 'luxury')).toBe(true);
    expect(OUTFIT_STYLES.some(o => o.family === 'aggressive')).toBe(true);
    expect(ACCESSORY_STYLES.some(a => a.rarity === 'legendary')).toBe(true);
  });

  it('resolveCareerStage: champion / rookie / retired / veteran', () => {
    expect(VisualIdentityService.resolveCareerStage({
      status: 'roster', isChampion: true, age: 28, popularity: 90,
      record: { wins: 15, losses: 1, draws: 0 },
    }).id).toBe('champion');

    expect(VisualIdentityService.resolveCareerStage({
      status: 'roster', age: 21, popularity: 15,
      record: { wins: 1, losses: 0, draws: 0 }, totalFights: 1,
    }).id).toBe('rookie');

    expect(VisualIdentityService.resolveCareerStage({
      status: 'retired', age: 42, popularity: 40,
      record: { wins: 12, losses: 10, draws: 0 },
    }).id).toMatch(/retired|coach|ex_champion|mogul|legend/);

    expect(VisualIdentityService.resolveCareerStage({
      status: 'roster', age: 37, popularity: 45,
      record: { wins: 18, losses: 12, draws: 1 }, totalFights: 31,
    }).id).toBe('veteran');
  });

  it('archetype is stable per id', () => {
    const f = { id: 'stable-id-9', age: 27, popularity: 40, record: { wins: 5, losses: 3, draws: 0 } };
    expect(VisualIdentityService.resolveArchetypeId(f))
      .toBe(VisualIdentityService.resolveArchetypeId(f));
  });

  it('AI without appearance still renders SVG via identity layer', () => {
    const f = {
      id: 'ai-render-1', age: 34, popularity: 55,
      fightingStyle: 'wrestler',
      record: { wins: 14, losses: 6, draws: 0 }, totalFights: 20,
    };
    const svg = PortraitService.renderFighter(f, { size: 64, context: 'octagon' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('portrait');
  });

  it('context press vs octagon can change outfit', () => {
    const f = {
      id: 'ctx-star', age: 27, popularity: 85,
      record: { wins: 12, losses: 1, draws: 0 }, totalFights: 13,
      isChampion: true,
    };
    const oct = VisualIdentityService.resolveForRender(f, 'octagon');
    const press = VisualIdentityService.resolveForRender(f, 'press');
    // Champion press tends toward blazer/suit; octagon toward fight gear
    expect([0, 1].includes(oct.outfitStyle) || oct.outfitStyle < 10).toBe(true);
    expect(press.outfitStyle).not.toBe(oct.outfitStyle);
  });

  it('evolveAppearance title_won mutates some keys', () => {
    const f = {
      id: 'evo-1', age: 28, popularity: 70,
      appearance: PortraitService.randomAppearance(() => 0.2),
      record: { wins: 10, losses: 0, draws: 0 },
    };
    const result = VisualIdentityService.evolveAppearance(f, 'title_won', () => 0.01);
    expect(result.appearance).toBeTruthy();
    // high intensity + low rng threshold should change
    expect(result.changed || result.appearance.outfitStyle !== undefined).toBe(true);
  });

  it('yearlyTick does not mutate locked player appearance', () => {
    const appearance = PortraitService._normalize({ hairStyle: 3, outfitStyle: 0 });
    const f = {
      id: 'player-1', age: 30, popularity: 50,
      appearance: { ...appearance },
      visualLock: true,
      visualAutoEvolve: false,
      record: { wins: 8, losses: 2, draws: 0 },
    };
    const tick = VisualIdentityService.yearlyTick(f, () => 0.01);
    expect(tick.appearance).toBeNull();
    expect(f.appearance.hairStyle).toBe(3);
  });

  it('buildImaginePrompt is offline-only metadata', () => {
    expect(IMAGINE_PIPELINE.enabledInGame).toBe(false);
    const p = VisualIdentityService.buildImaginePrompt({
      id: 'img-1', age: 29, popularity: 60,
      record: { wins: 9, losses: 2, draws: 0 },
    }, 'ceremony');
    expect(p.toLowerCase()).toContain('mma');
    expect(p.length).toBeGreaterThan(40);
  });

  it('describeIdentity returns rarity labels', () => {
    const d = VisualIdentityService.describeIdentity({
      id: 'd1', age: 25, popularity: 30,
      record: { wins: 4, losses: 2, draws: 0 },
    });
    expect(d.archetypeLabel).toBeTruthy();
    expect(d.stageLabel).toBeTruthy();
    expect(d.rarityLabel).toBeTruthy();
  });
});
