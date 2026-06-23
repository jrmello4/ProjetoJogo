import { Gaussian } from '../utils/gaussian.js';

export class SimulationEngine {
  static simulateFight(fighterA, fighterB) {
    const perfA = this._calculatePerformance(fighterA, fighterB);
    const perfB = this._calculatePerformance(fighterB, fighterA);

    const diff = perfA.score - perfB.score;
    const winProb = Gaussian.probability(perfA.score, perfB.score);

    const winner = Math.random() < winProb ? fighterA : fighterB;
    const loser = winner === fighterA ? fighterB : fighterA;

    const method = this._determineFinish(winner, loser, perfA, perfB, diff);
    const round = this._determineRound(perfA, perfB, method);

    const result = {
      id: null,
      fighterAId: fighterA.id,
      fighterBId: fighterB.id,
      fighterAName: fighterA.name,
      fighterBName: fighterB.name,
      winnerId: winner.id,
      winnerName: winner.name,
      loserId: loser.id,
      loserName: loser.name,
      method: method.method,
      round,
      eventId: null,
      date: new Date().toISOString(),
      stats: {
        perfA: Math.round(perfA.score),
        perfB: Math.round(perfB.score),
        diff: Math.round(diff),
      },
    };

    this._updateFighter(winner, loser, true, method, round);
    this._updateFighter(loser, winner, false, method, round);

    return result;
  }

  static _calculatePerformance(fighter, opponent) {
    const fatigueFactor = 1 - (fighter.fatigue / 200);
    const moraleFactor = 0.7 + (fighter.morale / 100) * 0.3;
    const determinationFactor = 0.8 + (fighter.hidden.determination / 100) * 0.2;

    const technique = fighter.techniqueScore * fatigueFactor;
    const cardio = fighter.attributes.cardio * fatigueFactor * moraleFactor;
    const iq = fighter.attributes.fightIQ * determinationFactor;
    const chin = fighter.attributes.chin;

    const styleAdvantage = this._styleMatchup(fighter, opponent);

    const baseScore =
      technique * 0.35 +
      cardio * 0.2 +
      iq * 0.2 +
      chin * 0.05 +
      styleAdvantage * 10;

    const noise = Gaussian.random(0, 8);
    const finalScore = baseScore + noise;

    return {
      score: finalScore,
      technique,
      cardio,
      iq,
      chin,
    };
  }

  static _styleMatchup(attacker, defender) {
    let advantage = 0;

    if (attacker.fightingStyle === 'Wrestling' && defender.fightingStyle === 'Boxing') {
      advantage += 3;
    } else if (attacker.fightingStyle === 'BJJ' && defender.fightingStyle === 'Kickboxing') {
      advantage += 3;
    } else if (attacker.fightingStyle === 'Boxing' && defender.fightingStyle === 'BJJ') {
      advantage += 2;
    } else if (attacker.fightingStyle === 'Kickboxing' && defender.fightingStyle === 'Wrestling') {
      advantage += 2;
    }

    const skillDiff = attacker.techniqueScore - defender.techniqueScore;
    advantage += skillDiff * 0.1;

    return advantage;
  }

  static _determineFinish(winner, loser, perfW, perfL, diff) {
    const strikeDiff = winner.strikingScore - loser.strikingScore;
    const grappleDiff = winner.grapplingScore - loser.grapplingScore;
    const chinFactor = loser.attributes.chin / 100;

    const rand = Math.random();

    if (diff > 25 && rand < 0.6) {
      if (strikeDiff > 5) return { method: 'KO', type: 'strike' };
      return { method: 'TKO', type: 'strike' };
    }

    if (diff > 15 && rand < 0.4) {
      if (grappleDiff > 5 && rand < 0.5) {
        return { method: 'Submission', type: 'grapple' };
      }
      if (rand < 0.3) {
        return { method: 'TKO', type: 'strike' };
      }
    }

    if (rand < 0.15 && strikeDiff > 10 && chinFactor < 0.5) {
      return { method: 'KO', type: 'strike' };
    }

    if (rand < 0.2 && grappleDiff > 10) {
      return { method: 'Submission', type: 'grapple' };
    }

    if (rand < 0.3) {
      return { method: 'TKO', type: 'strike' };
    }

    return { method: 'Decision', type: 'decision' };
  }

  static _determineRound(perfA, perfB, method) {
    const scoreDiff = Math.abs(perfA.score - perfB.score);
    const cardioAvg = (perfA.cardio + perfB.cardio) / 2;

    if (method.type === 'decision') {
      return 3;
    }

    if (scoreDiff > 30) {
      return Math.random() < 0.5 ? 1 : 2;
    }

    if (scoreDiff > 20) {
      const r = Math.random();
      if (r < 0.3) return 1;
      if (r < 0.7) return 2;
      return 3;
    }

    if (cardioAvg < 40) {
      return Math.random() < 0.4 ? 3 : Math.random() < 0.7 ? 2 : 1;
    }

    const r = Math.random();
    if (r < 0.2) return 1;
    if (r < 0.5) return 2;
    return 3;
  }

  static _updateFighter(fighter, opponent, won, method, round) {
    if (won) {
      fighter.record.wins++;
      fighter.applyMoraleChange(8);
    } else {
      fighter.record.losses++;
      fighter.applyMoraleChange(-10);
    }

    fighter.applyFatigue(20 + round * 5);
    fighter.evolve();

    fighter.fights.unshift({
      opponent: opponent.name,
      result: won ? 'W' : 'L',
      method: method.method,
      round,
      date: new Date().toISOString(),
      won,
    });

    if (fighter.fights.length > 50) {
      fighter.fights = fighter.fights.slice(0, 50);
    }
  }
}
