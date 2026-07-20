// js/services/card-reward-service.js
import { ACTIVE_CARDS, PASSIVE_CARDS } from '../config/card-config.js';

// Rarity pools based on promotion tier
const REWARD_POOLS = {
  1: { // Elite — best cards
    active: ['overhand', 'highKick', 'rearNaked', 'armbar', 'groundAndPound', 'elbowStrike'],
    passive: ['heavyHands', 'bloodCold', 'dirtyFight', 'student', 'marathon'],
    picks: 3,
  },
  2: { // National — medium cards
    active: ['doubleLeg', 'singleLeg', 'clinchKnee', 'elbowStrike', 'cross'],
    passive: ['solidBase', 'marathon', 'heavyHands'],
    picks: 3,
  },
  3: { // Regional — basic cards
    active: ['jab', 'cross', 'legKick', 'takedownDefense', 'singleLeg', 'clinchKnee'],
    passive: ['solidBase', 'marathon'],
    picks: 2,
  },
};

// Fisher-Yates shuffle — `[...arr].sort(() => Math.random() - 0.5)` is a
// well-known biased shuffle (it does not produce a uniform random
// permutation; comparator sort implementations are free to call the
// comparator an uneven number of times per element, so early/late array
// entries end up over/under-represented). This produces a correct uniform
// random permutation instead.
function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export class CardRewardService {
  static getRewardOptions(promoTier) {
    const pool = REWARD_POOLS[promoTier] || REWARD_POOLS[3];
    const actives = pool.active.map(id => ACTIVE_CARDS[id]).filter(Boolean);
    const passives = pool.passive.map(id => PASSIVE_CARDS[id]).filter(Boolean);

    // Shuffle and pick
    const shuffled = shuffle([...actives, ...passives]);
    return shuffled.slice(0, pool.picks);
  }

  static getTitleReward() {
    // Title fights give a special powerful card
    const titleCards = ['rearNaked', 'armbar', 'overhand'];
    const cardId = titleCards[Math.floor(Math.random() * titleCards.length)];
    return ACTIVE_CARDS[cardId];
  }
}
