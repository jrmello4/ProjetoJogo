// js/controllers/combat-resolver.js
import { ACTIVE_CARDS, PASSIVE_CARDS } from '../config/card-config.js';

export class CombatResolver {
  // Calculate damage from a card based on fighter attributes
  static calcCardDamage(card, fighter) {
    const attr = fighter.attributes || {};
    let damageMult = 0;
    for (const [attrName, weight] of Object.entries(card.damageAttrs)) {
      damageMult += (attr[attrName] ?? 50) / 100 * weight;
    }
    return card.baseDamage * Math.max(0.1, damageMult);
  }

  // Apply passive card effects to damage
  static applyPassiveDamageMods(rawDamage, card, passives) {
    let modified = rawDamage;
    for (const passive of passives) {
      if (passive.effect.type === 'damageMult' && card.tags) {
        const tagMatch = passive.effect.tags.some(t => card.tags.includes(t));
        if (tagMatch) {
          modified *= (1 + passive.effect.value);
        }
      }
    }
    return modified;
  }

  static resolveTurn(state, cardIdA, cardIdB) {
    const cardA = ACTIVE_CARDS[cardIdA];
    const cardB = ACTIVE_CARDS[cardIdB];
    if (!cardA || !cardB) return { error: 'invalid cards' };

    const fighterA = state.fighterA;
    const fighterB = state.fighterB;

    // Calculate damage
    const rawDamageA = this.calcCardDamage(cardA, fighterA.ref);
    const rawDamageB = this.calcCardDamage(cardB, fighterB.ref);

    const damageA = this.applyPassiveDamageMods(rawDamageA, cardA, state.passivesA);
    const damageB = this.applyPassiveDamageMods(rawDamageB, cardB, state.passivesB);

    // Apply stamina drain — using a card costs stamina
    const staminaCostA = this._staminaCost(cardA);
    const staminaCostB = this._staminaCost(cardB);
    fighterA.stamina = Math.max(0, fighterA.stamina - staminaCostA);
    fighterB.stamina = Math.max(0, fighterB.stamina - staminaCostB);

    // Determine who lands more effectively
    // Comparison: effective damage with stamina factor
    const staminaFactorA = fighterA.stamina / 100;
    const staminaFactorB = fighterB.stamina / 100;

    const effectiveA = damageA * staminaFactorA;
    const effectiveB = damageB * staminaFactorB;

    // Enhanced position bonus: certain positions give bonuses on certain card types
    const positionBonusA = this._positionBonus(fighterA.position, cardA);
    const positionBonusB = this._positionBonus(fighterB.position, cardB);

    const totalA = effectiveA * (1 + positionBonusA);
    const totalB = effectiveB * (1 + positionBonusB);

    // Apply stamina debt for aggressive cards
    state.staminaDebtA += (cardA.tags?.includes('heavy') ? 5 : 0);
    state.staminaDebtB += (cardB.tags?.includes('heavy') ? 5 : 0);

    return {
      cardA, cardB,
      rawDamageA, rawDamageB,
      damageA, damageB,
      effectiveA: totalA,
      effectiveB: totalB,
      winner: totalA >= totalB ? 'A' : 'B',
      margin: Math.abs(totalA - totalB),
    };
  }

  static _staminaCost(card) {
    if (card.tags?.includes('heavy')) return 8;
    if (card.tags?.includes('light')) return 3;
    if (card.type === 'submission') return 10;
    if (card.type === 'takedown') return 6;
    return 5;
  }

  static _positionBonus(position, card) {
    // Being in the right position for your card type gives a bonus
    if (card.type === 'strike' && (position === 'range' || position === 'clinch')) return 0.10;
    if (card.type === 'grappling' && (position === 'clinch' || position.startsWith('ground'))) return 0.10;
    if (card.type === 'takedown' && position === 'range') return 0.10;
    return 0;
  }

  static checkFinish(state, turnResult, round) {
    const margin = turnResult.margin;
    const fighterA = state.fighterA.ref;
    const fighterB = state.fighterB.ref;

    // Base finish chance increases with margin and round number
    const finishChance = Math.min(0.4, 0.02 + margin * 0.005 + round * 0.02);
    if (Math.random() > finishChance) return null;

    // Determine who gets finished
    const loserSide = turnResult.winner === 'A' ? 'B' : 'A';
    const winnerSide = turnResult.winner;
    const loser = loserSide === 'A' ? fighterA : fighterB;
    const winner = winnerSide === 'A' ? fighterA : fighterB;

    // Check loser's durability
    const chin = (loser.attributes?.chin ?? 50) / 100;
    const durability = (loser.attributes?.durability ?? 50) / 100;
    const toughness = (chin + durability) / 2;

    // Determine finish method
    let method = null;
    if (turnResult.margin > 30 && toughness < 0.6) {
      method = 'KO';
    } else if (turnResult.margin > 20) {
      method = 'TKO';
    } else if (turnResult.cardA?.type === 'submission' || turnResult.cardB?.type === 'submission') {
      const subOff = (winner.attributes?.submissionOffense ?? 50) / 100;
      const subDef = (loser.attributes?.submissionDefense ?? 50) / 100;
      if (subOff > subDef && Math.random() < 0.3) {
        method = 'Submission';
      }
    }

    if (method) {
      state.ended = true;
      state.winner = winner;
      state.loser = loser;
      state.finishMethod = method;
      state.finishRound = round;
    }

    return method ? { winner, loser, method } : null;
  }

  static scoreRound(roundTurns) {
    // Each turn has a winner. Count who won more turns.
    const winsA = roundTurns.filter(t => t.winner === 'A').length;
    const winsB = roundTurns.filter(t => t.winner === 'B').length;

    // Also factor in effective damage margin for dominance
    const totalEffectiveA = roundTurns.reduce((sum, t) => sum + t.effectiveA, 0);
    const totalEffectiveB = roundTurns.reduce((sum, t) => sum + t.effectiveB, 0);
    const effDiff = totalEffectiveA - totalEffectiveB;
    const margin = Math.abs(effDiff);

    // 10-point must
    let scoreA = 10, scoreB = 9; // A wins round by default
    if (winsB > winsA) {
      scoreA = 9; scoreB = 10; // B wins round
    }
    if (winsA === winsB) {
      scoreA = 10; scoreB = 10; // even round
    }

    // Dominance adjustment
    if (margin > 40) {
      if (effDiff > 0) scoreB = 8; // 10-8 round
      else scoreA = 8;
    }
    if (margin > 70) {
      if (effDiff > 0) scoreB = 7; // 10-7 round
      else scoreA = 7;
    }

    return { scoreA, scoreB, margin, totalEffectiveA, totalEffectiveB };
  }
}
