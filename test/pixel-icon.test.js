import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { SidebarState } from '../js/runtimes/SidebarState.js';
import { ICON_MAP } from '../js/services/notification-service.js';
import { PixelIcon, PIXEL_ICON_KEYS } from '../js/views/pixel-icon.js';

describe('PixelIcon', () => {
  it('possui símbolo e manifesto para toda chave pública', async () => {
    const [sprite, manifestSource] = await Promise.all([
      readFile(new URL('../assets/pixel/ui-icons.svg', import.meta.url), 'utf8'),
      readFile(new URL('../assets/pixel/manifest.json', import.meta.url), 'utf8'),
    ]);
    const manifest = JSON.parse(manifestSource);
    for (const key of PIXEL_ICON_KEYS) {
      expect(sprite).toContain(`id="icon-${key}"`);
      expect(manifest.icons).toContain(key);
    }
  });

  it('mantém fontes, atlas, molduras e cenas do manifesto locais', async () => {
    const manifest = JSON.parse(await readFile(new URL('../assets/pixel/manifest.json', import.meta.url), 'utf8'));
    const assetPaths = [
      manifest.font.file,
      manifest.font.license,
      ...Object.values(manifest.atlases),
      ...Object.values(manifest.frames),
      ...Object.values(manifest.scenes),
    ];
    await Promise.all(assetPaths.map(path => expect(
      readFile(new URL(`../assets/pixel/${path}`, import.meta.url))
    ).resolves.toBeTruthy()));
  });

  it('cobre todos os ícones usados pela sidebar contextual', () => {
    const state = SidebarState.compute(
      { id: 'player-1' },
      [{ fighterId: 'player-1', status: 'accepted', completed: false }],
      []
    );
    const keys = state.sections.flatMap(section => section.items.map(item => item.icon));
    expect(keys.every(key => PIXEL_ICON_KEYS.includes(key))).toBe(true);
    expect(Object.values(ICON_MAP).every(key => PIXEL_ICON_KEYS.includes(key))).toBe(true);
  });

  it('usa fallback seguro e converte emoji legado', () => {
    expect(PixelIcon.render('nao-existe')).toContain('#icon-unknown');
    expect(PixelIcon.replaceLegacy('🏆 Campeão')).toContain('#icon-title');
    expect(PixelIcon.replaceLegacy('🏆 Campeão')).not.toContain('🏆');
    expect(PixelIcon.replaceLegacy('🔍 Estudar')).toContain('#icon-scout');
  });

  it('remove a dependência de Rive do shell', async () => {
    const [index, layout] = await Promise.all([
      readFile(new URL('../index.html', import.meta.url), 'utf8'),
      readFile(new URL('../js/views/layout.js', import.meta.url), 'utf8'),
    ]);
    expect(`${index}\n${layout}`).not.toMatch(/data-rive|riveManager|rive\.js/);
  });
});
