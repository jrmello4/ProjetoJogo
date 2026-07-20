import { ACTIVE_CARDS, POSITIONS } from '../config/card-config.js';

export class AICombat {
  // Select a card for the AI to play
  static selectCard(availableCards, state, opponentAvailableCards) {
    if (!availableCards.length) return null;

    const fighter = state.fighterB; // AI is always side B
    const position = fighter.position;

    // Prioritize cards based on position
    const allCards = availableCards.map(ac => ac.card);
    const positionCards = allCards.filter(c => c.positions.includes(position));

    if (positionCards.length === 0 && allCards.length > 0) {
      // Shouldn't happen if available cards are already filtered, but fallback
      return allCards[Math.floor(Math.random() * allCards.length)];
    }

    // Weight by damage and type
    let weighted = positionCards.map(c => {
      let weight = c.baseDamage + 10;
      // Prefer engage cards when far
      if (position === POSITIONS.DISTANCE && c.moveTo) weight *= 1.5;
      // Prefer submissions on ground
      if (position === POSITIONS.GROUND_TOP && c.type === 'submission') weight *= 1.3;
      // Prefer finish attempts late
      if (c.type === 'submission' || c.tags?.includes('heavy')) weight *= 1.2;
      // Always some randomness
      weight *= 0.5 + Math.random();
      return { card: c, weight };
    });

    const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
    let roll = Math.random() * totalWeight;
    const selected = weighted.find(w => { roll -= w.weight; return roll <= 0; });

    return selected ? selected.card : positionCards[0];
  }

  // Decide whether AI should move manually
  static selectMoveAction(availableCards, state) {
    const fighter = state.fighterB;
    const position = fighter.position;

    // If at distance and no engage card available, move to range
    if (position === POSITIONS.DISTANCE) {
      const hasEngage = availableCards.some(ac => ac.card.moveTo);
      if (!hasEngage) return POSITIONS.RANGE;
    }

    // If at range and opponent is grappler, try to keep distance
    const opponent = state.fighterA.ref;
    if (position === POSITIONS.RANGE && (opponent.style === 'wrestler' || opponent.style === 'bjj')) {
      // Stay at range, don't move
    }

    return null; // Don't move
  }
}
