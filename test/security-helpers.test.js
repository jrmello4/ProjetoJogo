import { describe, it, expect } from 'vitest';
import { escapeHtml, sanitizePlayerName, formatDate, formatDateShort } from '../js/utils/helpers.js';
import { resolveSafePath, ROOT } from '../server.js';
import path from 'path';

describe('escapeHtml / sanitizePlayerName', () => {
  it('escapa tags e aspas perigosas', () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
    expect(escapeHtml(`O'Reilly & "Filho"`)).toContain('&#39;');
    expect(escapeHtml(`O'Reilly & "Filho"`)).toContain('&amp;');
    expect(escapeHtml(null)).toBe('');
  });

  it('sanitizePlayerName remove HTML e limita tamanho', () => {
    expect(sanitizePlayerName('<script>alert(1)</script>Hero')).toBe('Hero');
    expect(sanitizePlayerName('  João   Silva  ')).toBe('João Silva');
    expect(sanitizePlayerName('a'.repeat(100)).length).toBe(30);
    expect(sanitizePlayerName('   ')).toBe('Lutador Anônimo');
    expect(sanitizePlayerName('<b>X</b>')).toBe('X');
    expect(sanitizePlayerName(`O'Connor-Jr.`)).toBe(`O'Connor-Jr.`);
  });

  it('formatDate não lança em data inválida', () => {
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDateShort(undefined)).toBe('—');
  });
});

describe('server resolveSafePath — path traversal', () => {
  it('aceita arquivos dentro da raiz', () => {
    const p = resolveSafePath('/index.html');
    expect(p).toBe(path.resolve(ROOT, 'index.html'));
  });

  it('bloqueia traversal com encoding aninhado e segmentos inválidos', () => {
    // Node URL colapsa %2e%2e “simples” para dentro da raiz (ainda seguro).
    // Encoding aninhado %2e%2e%2f… sobrevive ao parser e cai no nosso filtro.
    expect(resolveSafePath('/%2e%2e%2f%2e%2e%2fpackage.json')).toBeNull();
    // Colapso legítimo: /js/../index.html → /index.html sob ROOT
    expect(resolveSafePath('/js/../index.html')).toBe(path.resolve(ROOT, 'index.html'));
    // Continua sob ROOT após colapso do URL — não é escape do sandbox
    expect(resolveSafePath('/%2e%2e/package.json')).toBe(path.resolve(ROOT, 'package.json'));
  });

  it('bloqueia null byte', () => {
    expect(resolveSafePath('/index.html\0.jpg')).toBeNull();
  });

  it('mapeia / para index.html', () => {
    expect(resolveSafePath('/')).toBe(path.resolve(ROOT, 'index.html'));
  });
});
