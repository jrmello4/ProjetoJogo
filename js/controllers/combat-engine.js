// js/controllers/combat-engine.js
import { ACTIVE_CARDS, PASSIVE_CARDS, POSITIONS, POSITION_TRANSITIONS } from '../config/card-config.js';

export class CombatEngine {
  constructor() {
    this.state = null;
  }

  _initState(fighterA, fighterB, fiveRounds, loadoutA, loadoutB) {
    const maxRounds = fiveRounds ? 5 : 3;
    return {
      fighterA: { ref: fighterA, position: POSITIONS.DISTANCE, stamina: 100 },
      fighterB: { ref: fighterB, position: POSITIONS.DISTANCE, stamina: 100 },
      maxRounds,
      currentRound: 0,
      roundTurn: 0,
      maxTurnsPerRound: 4, // 3-5; fixed at 4 for now
      turnOwner: 'A', // 'A' or 'B' — who acts this turn
      currentTurn: 0, // total turns in fight
      ended: false,
      winner: null,
      loser: null,
      finishMethod: null,
      finishRound: 0,
      isDraw: false,
      rounds: [],
      roundScores: [], // [{ scoreA, scoreB }] — cumulative per round
      cooldownsA: {},  // { cardId: remainingTurns }
      cooldownsB: {},
      usesA: {},       // { cardId: usesRemaining }
      usesB: {},
      turnLog: [],     // all actions taken this fight
      // Passive effects
      passivesA: (loadoutA.passive || []).map(id => PASSIVE_CARDS[id]).filter(Boolean),
      passivesB: (loadoutB.passive || []).map(id => PASSIVE_CARDS[id]).filter(Boolean),
      // Active card IDs
      activesA: loadoutA.active || [],
      activesB: loadoutB.active || [],
      staminaDebtA: 0,
      staminaDebtB: 0,
    };
  }

  *runFight(fighterA, fighterB, fiveRounds, loadoutA, loadoutB) {
    this.state = this._initState(fighterA, fighterB, fiveRounds, loadoutA, loadoutB);
    const s = this.state;

    for (let r = 1; r <= s.maxRounds; r++) {
      if (s.ended) break;
      s.currentRound = r;
      s.roundTurn = 0;

      // Stamina decay at round start
      if (r > 1) {
        s.fighterA.stamina = Math.max(15, s.fighterA.stamina - 10);
        s.fighterB.stamina = Math.max(15, s.fighterB.stamina - 10);
      }

      // Reset turn alternation: player (A) always starts each round
      s.turnOwner = 'A';

      while (s.roundTurn < s.maxTurnsPerRound && !s.ended) {
        s.roundTurn++;
        s.currentTurn++;
        const owner = s.turnOwner;
        this._tickCooldowns(owner === 'A' ? s.cooldownsA : s.cooldownsB);
        // Alternate turns: player acts, opponent acts, alternates (2 ações
        // por turno). Toggle after ticking the current owner's cooldowns,
        // before yielding, so the yielded `owner` field reflects the side
        // that just acted while `s.turnOwner` is already primed for the
        // next iteration.
        s.turnOwner = owner === 'A' ? 'B' : 'A';
        yield { type: 'turn', round: r, turn: s.roundTurn, owner };
      }

      // Round end — score the round
      if (!s.ended) {
        yield { type: 'roundEnd', round: r };
      }
    }

    // Fight end — decision
    if (!s.ended) {
      this._computeDecision();
    }

    return this._buildResult();
  }

  _tickCooldowns(cooldowns) {
    for (const cardId of Object.keys(cooldowns)) {
      if (cooldowns[cardId] > 0) {
        cooldowns[cardId]--;
      }
      if (cooldowns[cardId] <= 0) {
        delete cooldowns[cardId];
      }
    }
  }

  getAvailableCards(state, side) {
    const actives = side === 'A' ? state.activesA : state.activesB;
    const cooldowns = side === 'A' ? state.cooldownsA : state.cooldownsB;
    const uses = side === 'A' ? state.usesA : state.usesB;
    const fighter = side === 'A' ? state.fighterA : state.fighterB;

    return actives
      .map(id => {
        const card = ACTIVE_CARDS[id];
        if (!card) return null;
        // Check cooldown
        if ((cooldowns[id] || 0) > 0) return null;
        // Check uses remaining
        const remaining = uses[id];
        if (remaining !== undefined && remaining <= 0) return null;
        // Check position requirement
        if (!card.positions.includes(fighter.position)) return null;
        return { card, remaining };
      })
      .filter(Boolean);
  }

  /**
   * @param {string} side
   * @param {string} cardId
   * @param {{ applyMove?: boolean }} [opts] — applyMove defaults true.
   *   When false, cooldown/uses still consume but moveTo + partner sync
   *   are deferred (adapter applies after both sides have acted so a
   *   defense card can still be legal against a same-beat takedown).
   */
  playCard(side, cardId, opts = {}) {
    const applyMove = opts.applyMove !== false;
    const s = this.state;
    const card = ACTIVE_CARDS[cardId];
    if (!card) return { error: 'unknownCard' };

    const fighter = side === 'A' ? s.fighterA : s.fighterB;
    const cooldowns = side === 'A' ? s.cooldownsA : s.cooldownsB;
    const uses = side === 'A' ? s.usesA : s.usesB;

    // Validate position
    if (!card.positions.includes(fighter.position)) {
      return { error: 'wrongPosition', required: card.positions, current: fighter.position };
    }

    // Validate cooldown
    if ((cooldowns[cardId] || 0) > 0) {
      return { error: 'cooldown', remaining: cooldowns[cardId] };
    }

    // Validate uses
    const remaining = uses[cardId];
    if (remaining !== undefined && remaining <= 0) {
      return { error: 'noUses' };
    }

    // Apply cooldown
    cooldowns[cardId] = card.cooldown;

    // Track uses for limited cards
    if (card.maxUses !== Infinity) {
      uses[cardId] = (uses[cardId] ?? card.maxUses) - 1;
    }

    // Handle movement + partner sync (takedown → opponent on bottom, etc.)
    if (applyMove && card.moveTo) {
      fighter.position = card.moveTo;
      this._syncPartnerPosition(side, card.moveTo);
    }

    s.turnLog.push({ round: s.currentRound, turn: s.currentTurn, side, cardId });
    return { success: true, card, pendingMove: card.moveTo || null };
  }

  /**
   * Apply a card's moveTo + partner sync after both sides have acted.
   * No-op if the card has no moveTo.
   */
  applyCardMove(side, cardId) {
    const card = ACTIVE_CARDS[cardId];
    if (!card?.moveTo) return { success: false };
    const s = this.state;
    const fighter = side === 'A' ? s.fighterA : s.fighterB;
    fighter.position = card.moveTo;
    this._syncPartnerPosition(side, card.moveTo);
    return { success: true, moveTo: card.moveTo };
  }

  moveManual(side, targetPosition) {
    const s = this.state;
    const fighter = side === 'A' ? s.fighterA : s.fighterB;
    const allowed = POSITION_TRANSITIONS[fighter.position];
    if (!allowed || !allowed.includes(targetPosition)) {
      return { error: 'invalidTransition', from: fighter.position, to: targetPosition };
    }
    fighter.position = targetPosition;
    this._syncPartnerPosition(side, targetPosition);
    s.turnLog.push({ round: s.currentRound, turn: s.currentTurn, side, move: targetPosition });
    return { success: true };
  }

  /**
   * Keep both fighters in a coherent shared phase.
   * - Top control ⇒ partner on guard (bottom)
   * - Guard control ⇒ partner on top
   * - Standing up to clinch from the mat ⇒ partner also stands to clinch
   * - Entering clinch from range ⇒ partner joins clinch
   * Standing-range transitions (distance↔range) only move the actor.
   */
  _syncPartnerPosition(side, targetPosition) {
    const s = this.state;
    if (!s) return;
    const other = side === 'A' ? s.fighterB : s.fighterA;
    const isGround = (p) => p === POSITIONS.GROUND_TOP || p === POSITIONS.GROUND_GUARD;

    if (targetPosition === POSITIONS.GROUND_TOP) {
      other.position = POSITIONS.GROUND_GUARD;
      return;
    }
    if (targetPosition === POSITIONS.GROUND_GUARD) {
      other.position = POSITIONS.GROUND_TOP;
      return;
    }
    if (targetPosition === POSITIONS.CLINCH) {
      // Stand-up or clinch entry: both share the clinch pocket
      if (isGround(other.position) || other.position === POSITIONS.RANGE || other.position === POSITIONS.DISTANCE) {
        other.position = POSITIONS.CLINCH;
      }
    }
  }

  _addRoundScore(scoreA, scoreB) {
    this.state.roundScores.push({ scoreA, scoreB });
  }

  _computeDecision() {
    const s = this.state;

    // Simulate 3 judges. Each judge independently reads the objective
    // round scores (s.roundScores is never mutated here), but on very
    // close, non-dominant rounds (margin of 1 — a 10-9-type round) each
    // judge has a small independent chance to score it even instead, or
    // to flip it the other way — so split decisions (2-1) are reachable
    // instead of every judge always agreeing.
    const scorecards = [0, 1, 2].map(() => {
      let a = 0, b = 0;
      for (const rd of s.roundScores) {
        let scoreA = rd.scoreA;
        let scoreB = rd.scoreB;
        const margin = Math.abs(scoreA - scoreB);
        if (margin === 1) {
          const roll = Math.random();
          if (roll < 0.10) {
            // Score the close round even instead of its actual result.
            scoreA = scoreB = Math.max(scoreA, scoreB);
          } else if (roll < 0.15) {
            // Flip a very close round the other way.
            [scoreA, scoreB] = [scoreB, scoreA];
          }
        }
        a += scoreA;
        b += scoreB;
      }
      return { a, b };
    });

    const votesA = scorecards.filter(j => j.a > j.b).length;
    const votesB = scorecards.filter(j => j.b > j.a).length;

    if (votesA >= 2 || votesB >= 2) {
      const aWins = votesA >= 2;
      s.winner = aWins ? s.fighterA.ref : s.fighterB.ref;
      s.loser = s.winner === s.fighterA.ref ? s.fighterB.ref : s.fighterA.ref;
      s.finishMethod = votesA === 3 || votesB === 3 ? 'Decision (Unanimous)' : 'Decision (Split)';
    } else {
      s.isDraw = true;
      s.finishMethod = 'Decision (Draw)';
    }
    s.finishRound = s.maxRounds;
  }

  // Maps internal finish reasons to human-readable method strings.
  // _computeDecision already sets state.finishMethod to a final decision
  // string ('Decision (Unanimous)' / 'Decision (Split)' / 'Decision (Draw)') —
  // those pass through unchanged. Other code paths (not implemented by this
  // task's pure state machine) may instead set a raw finish type like
  // 'ko' / 'tko' / 'submission'; those get mapped to their display form.
  _methodString(finishMethod) {
    if (!finishMethod) return 'Decision (Unanimous)';
    const rawTypeToLabel = {
      ko: 'KO',
      tko: 'TKO',
      submission: 'Submission',
    };
    return rawTypeToLabel[finishMethod] || finishMethod;
  }

  _buildResult() {
    const s = this.state;
    const method = this._methodString(s.finishMethod);
    return {
      id: null,
      fighterAId: s.fighterA.ref.id,
      fighterBId: s.fighterB.ref.id,
      fighterAName: s.fighterA.ref.name,
      fighterBName: s.fighterB.ref.name,
      winnerId: s.isDraw ? null : s.winner.id,
      winnerName: s.isDraw ? null : s.winner.name,
      loserId: s.isDraw ? null : s.loser.id,
      loserName: s.isDraw ? null : s.loser.name,
      isDraw: s.isDraw,
      method,
      round: s.finishRound,
      eventId: null,
      date: null,
      stats: {
        sigStrikesA: 0, sigStrikesB: 0,
        knockdownsA: 0, knockdownsB: 0,
        takedownsA: 0, takedownsB: 0,
        subAttemptsA: 0, subAttemptsB: 0,
        controlTimeA: 0, controlTimeB: 0,
      },
      rounds: s.roundScores.map((rd, i) => ({
        round: i + 1,
        scoreA: rd.scoreA,
        scoreB: rd.scoreB,
        finished: false,
        ...(s.roundDetails?.[i + 1] || { roundLog: [], moments: [] }),
      })),
      totalScoreA: s.roundScores.reduce((sum, rd) => sum + rd.scoreA, 0),
      totalScoreB: s.roundScores.reduce((sum, rd) => sum + rd.scoreB, 0),
      scorecards: null,
      _cardTurnLog: s.turnLog, // internal — for card UI replay
    };
  }
}
