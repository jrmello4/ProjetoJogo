import { describe, expect, it } from 'vitest';
import { HudState } from '../js/runtimes/HudState.js';

const fighter = {
  id: 'player-1',
  name: 'Alex Silva',
  cash: 12500,
  energy: 72.4,
  morale: 61.8,
  record: { wins: 4, losses: 1, draws: 0 },
};

describe('HudState', () => {
  it('fica oculto antes da criação do lutador', () => {
    expect(HudState.compute({ now: 1 })).toMatchObject({ ready: false });
  });

  it('projeta os indicadores persistentes sem alterar o lutador', () => {
    const original = structuredClone(fighter);
    const state = HudState.compute({ fighter, now: 8, contenderStatus: { rank: 7 } });

    expect(state).toMatchObject({
      ready: true,
      fighterName: 'Alex Silva',
      recordLabel: '4-1-0',
      rankLabel: '#7',
      cash: 12500,
      energy: 72,
      morale: 62,
      pendingOffers: 0,
      nextFight: null,
    });
    expect(fighter).toEqual(original);
  });

  it('mostra a luta ativa mais próxima e ignora booking de outro atleta', () => {
    const state = HudState.compute({
      fighter,
      now: 10,
      bookings: [
        { fighterId: 'other', status: 'accepted', eventAbsWeek: 10, opponentName: 'Outro' },
        { fighterId: fighter.id, status: 'accepted', eventAbsWeek: 14, opponentName: 'Bia', isTitleFight: true },
      ],
    });

    expect(state.nextFight).toMatchObject({ opponentName: 'Bia', weeksToFight: 4, isTitleFight: true });
  });

  it('sinaliza oferta, lesão, cinturão e aposentadoria', () => {
    const state = HudState.compute({
      fighter: { ...fighter, status: 'retired', injury: { stage: 'rehab' }, titlesWon: 1 },
      now: 20,
      pendingOffers: [{ fighterId: fighter.id }],
      belts: [{ id: 'belt-1' }],
    });

    expect(state).toMatchObject({
      rankLabel: 'CAMPEAO',
      pendingOffers: 1,
      injuryActive: true,
      retired: true,
      canAdvance: false,
    });
  });
});
