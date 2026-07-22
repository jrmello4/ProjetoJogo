import { HudState } from '../runtimes/HudState.js';

const numericRank = (label) => {
  const match = String(label || '').match(/#(\d+)/);
  return match ? Number(match[1]) : null;
};

export class GameFeedback {
  static diff(beforeData, afterData) {
    const before = HudState.compute(beforeData || {});
    const after = HudState.compute(afterData || {});
    if (!before.ready || !after.ready) {
      return Object.freeze({ weekLabel: after.weekLabel, changes: [], hasChanges: false });
    }

    const changes = [];
    const addDelta = (key, icon, label, from, to, tone = 'neutral') => {
      if (from === to) return;
      changes.push(Object.freeze({ key, icon, label, from, to, delta: to - from, tone }));
    };

    addDelta('cash', 'cash', 'Caixa', before.cash, after.cash, after.cash >= before.cash ? 'positive' : 'negative');
    addDelta('energy', 'energy', 'Energia', before.energy, after.energy, after.energy >= before.energy ? 'positive' : 'negative');
    addDelta('morale', 'morale', 'Moral', before.morale, after.morale, after.morale >= before.morale ? 'positive' : 'negative');
    addDelta('offers', 'offer', 'Ofertas', before.pendingOffers, after.pendingOffers, after.pendingOffers > before.pendingOffers ? 'positive' : 'neutral');

    const beforeRank = numericRank(before.rankLabel);
    const afterRank = numericRank(after.rankLabel);
    if (beforeRank !== null && afterRank !== null && beforeRank !== afterRank) {
      changes.push(Object.freeze({
        key: 'rank', icon: 'rank', label: 'Ranking',
        from: beforeRank, to: afterRank, delta: beforeRank - afterRank,
        tone: afterRank < beforeRank ? 'positive' : 'negative',
      }));
    }

    const beforeCountdown = before.nextFight?.weeksToFight ?? null;
    const afterCountdown = after.nextFight?.weeksToFight ?? null;
    if (beforeCountdown !== afterCountdown && afterCountdown !== null) {
      changes.push(Object.freeze({
        key: 'countdown', icon: 'fight', label: 'Próxima luta',
        from: beforeCountdown, to: afterCountdown,
        delta: beforeCountdown === null ? 0 : afterCountdown - beforeCountdown,
        tone: afterCountdown === 0 ? 'warning' : 'neutral',
      }));
    }

    return Object.freeze({
      weekLabel: after.weekLabel,
      changes: Object.freeze(changes),
      hasChanges: changes.length > 0,
    });
  }
}
