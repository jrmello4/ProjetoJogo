import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { POSITIONS } from '../js/config/card-config.js';
import { CombatStage } from '../js/motion/combat-stage.js';
import { CardCombatView } from '../js/views/card-combat-view.js';
import { AppearanceEditor } from '../js/views/appearance-editor.js';
import { DEFAULT_APPEARANCE } from '../js/config/appearance-config.js';
import { DashboardView } from '../js/views/dashboard.js';

const fighter = { id: 'a', name: 'Ana', position: POSITIONS.RANGE };

describe('combat presentation contracts', () => {
  it('keeps card information and its ready/blocked state explicit in the hand', () => {
    const view = new CardCombatView();
    const html = view._renderCardHand({
      activesA: ['jab', 'cross'],
      cooldownsA: { cross: 2 },
      usesA: {},
      fighterA: fighter,
    }, 'A');

    expect(html).toContain('data-card-state="ready"');
    expect(html).toContain('data-card-state="blocked"');
    expect(html).toContain('card-rarity--standard');
    expect(html).toContain('card-rarity--rare');
    expect(html).toContain('card-condition');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('is-drawn');

    const exhausted = new CardCombatView()._renderCardHand({
      activesA: ['jab'],
      cooldownsA: {},
      usesA: { jab: 0 },
      fighterA: fighter,
    }, 'A');
    expect(exhausted).toContain('data-card-state="discarded"');
    expect(exhausted).toContain('is-discarded');
  });

  it('ships a result beat in the arena without coupling it to combat rules', () => {
    const html = CombatStage.buildHTML({ name: 'Ana' }, { name: 'Bia' });

    expect(html).toContain('data-cs-outcome');
    expect(html).toContain('data-cs-outcome-title');
    expect(html).toContain('data-cs-outcome-method');
  });

  it('makes appearance selection visible and accessible in the creation editor', () => {
    const html = AppearanceEditor.render({ ...DEFAULT_APPEARANCE });

    expect(html).toContain('appearance-preview-status');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-live="polite"');
  });

  it('keeps the closed side drawer out of the accessibility tree', async () => {
    const [shell, layout] = await Promise.all([
      readFile(new URL('../index.html', import.meta.url), 'utf8'),
      readFile(new URL('../js/views/layout.js', import.meta.url), 'utf8'),
    ]);

    expect(shell).toMatch(/id="drawer"[^>]*aria-hidden="true"[^>]*inert/);
    expect(layout).toContain("drawer.removeAttribute('aria-hidden')");
    expect(layout).toContain("drawer.setAttribute('aria-hidden', 'true')");
  });

  it('does not reopen a rivalry modal after the tracked event was viewed', () => {
    const rivalryPrompt = {
      eventId: 'rivalry:r-1:20',
      rivalName: 'Marcos Ribeiro',
      choices: [{ key: 'ignore', text: 'Ignorar' }],
      viewedAbsWeek: null,
    };

    expect(DashboardView.getDecisionOverlayHtml({ rivalryPrompt }))
      .toMatchObject({ type: 'rivalry', eventId: 'rivalry:r-1:20' });
    expect(DashboardView.getDecisionOverlayHtml({
      rivalryPrompt: { ...rivalryPrompt, viewedAbsWeek: 20 },
    })).toBeNull();
  });
});
