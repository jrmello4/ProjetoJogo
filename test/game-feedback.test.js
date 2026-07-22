import { describe, expect, it } from 'vitest';
import { GameFeedback } from '../js/services/game-feedback.js';

const snapshot = (overrides = {}) => ({
  fighter: {
    id: 'player-1', name: 'Alex', cash: 1000, energy: 80, morale: 60,
    record: { wins: 1, losses: 0, draws: 0 },
    ...(overrides.fighter || {}),
  },
  now: overrides.now ?? 5,
  pendingOffers: overrides.pendingOffers || [],
  bookings: overrides.bookings || [],
  contenderStatus: overrides.contenderStatus || { rank: 8 },
});

describe('GameFeedback.diff', () => {
  it('calcula deltas semanais de forma pura', () => {
    const before = snapshot();
    const after = snapshot({
      now: 6,
      fighter: { cash: 1400, energy: 65, morale: 66 },
      pendingOffers: [{ fighterId: 'player-1' }],
      contenderStatus: { rank: 6 },
    });
    const beforeCopy = structuredClone(before);

    const feedback = GameFeedback.diff(before, after);

    expect(feedback.hasChanges).toBe(true);
    expect(feedback.changes.find(change => change.key === 'cash')?.delta).toBe(400);
    expect(feedback.changes.find(change => change.key === 'energy')?.delta).toBe(-15);
    expect(feedback.changes.find(change => change.key === 'rank')).toMatchObject({ delta: 2, tone: 'positive' });
    expect(feedback.changes.find(change => change.key === 'offers')?.delta).toBe(1);
    expect(before).toEqual(beforeCopy);
  });

  it('não cria overlay quando nada relevante mudou', () => {
    expect(GameFeedback.diff(snapshot(), snapshot())).toMatchObject({ hasChanges: false, changes: [] });
  });

  it('identifica a chegada da semana da luta', () => {
    const before = snapshot({ bookings: [{ fighterId: 'player-1', status: 'accepted', eventAbsWeek: 6, opponentName: 'Bia' }] });
    const after = snapshot({ now: 6, bookings: [{ fighterId: 'player-1', status: 'accepted', eventAbsWeek: 6, opponentName: 'Bia' }] });

    expect(GameFeedback.diff(before, after).changes.find(change => change.key === 'countdown'))
      .toMatchObject({ to: 0, tone: 'warning' });
  });
});
