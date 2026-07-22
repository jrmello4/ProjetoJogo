import { describe, expect, it } from 'vitest';
import { SidebarState } from '../js/runtimes/SidebarState.js';

describe('SidebarState', () => {
  const fighter = { id: 'player-1' };

  it('mostra as rotas de preparação somente para uma luta ativa do jogador', () => {
    const state = SidebarState.compute(fighter, [
      { fighterId: 'player-1', status: 'accepted', completed: false },
      { fighterId: 'other-fighter', status: 'accepted', completed: false },
    ]);

    expect(state.hasUpcomingFight).toBe(true);
    expect(state.sections.find(section => section.id === 'next-fight-section')?.items.map(item => item.view))
      .toEqual(['training', 'opponent', 'fight-plan', 'fight']);
  });

  it('esconde as rotas contextuais depois que a luta termina', () => {
    const state = SidebarState.compute(fighter, [
      { fighterId: 'player-1', status: 'accepted', completed: true },
    ]);

    expect(state.hasUpcomingFight).toBe(false);
    expect(state.sections.some(section => section.id === 'next-fight-section')).toBe(false);
  });
});
