import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('PWA offline shell', () => {
  it('declara manifesto local e registra o worker de produção', async () => {
    const [manifestSource, index, service] = await Promise.all([
      readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'),
      readFile(new URL('../index.html', import.meta.url), 'utf8'),
      readFile(new URL('../js/services/pwa-service.js', import.meta.url), 'utf8'),
    ]);
    const manifest = JSON.parse(manifestSource);
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.icons[0].src).toBe('assets/icon.svg');
    expect(index).toContain('rel="manifest"');
    expect(service).toContain("register('./sw.js')");
  });

  it('versiona o cache pelo conteúdo e só usa o shell como fallback de navegação', async () => {
    const [build, server] = await Promise.all([
      readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8'),
      readFile(new URL('../server.js', import.meta.url), 'utf8'),
    ]);
    expect(build).toContain("createHash('sha256')");
    expect(build).toContain("event.request.mode === 'navigate'");
    expect(build).toContain("new Response('Offline', { status: 503");
    expect(build).toContain("assets/icon.svg");
    expect(build).toContain("assets/cinematics");
    expect(build).toContain("career-arena-");
    expect(server).toContain("fileName === 'sw.js'");
    expect(server).toContain("extension === '.webmanifest'");
  });
});
