import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

describe('premium visual pass', () => {
  it('gives every combat card an explicit rarity and readiness state', async () => {
    const source = await read('../js/views/card-combat-view.js');

    expect(source).toContain('function deriveRarity(card)');
    expect(source).toContain('card-rarity--${rarity.tier}');
    expect(source).toContain('card-rarity-seal');
    expect(source).toContain('card-condition');
  });

  it('keeps the fighter creator and combat motion inside the premium system', async () => {
    const [editor, stage, css] = await Promise.all([
      read('../js/views/appearance-editor.js'),
      read('../js/motion/combat-stage.js'),
      read('../css/premium-pass.css'),
    ]);

    expect(editor).toContain('appearance-preview--studio');
    expect(stage).toContain("classList.add('cs-heavy-impact')");
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
