import { clamp } from '../utils/helpers.js';

// Converte o resultado já calculado da luta em sinais visuais. Não decide
// combate, portanto o 3D nunca altera a simulação: ele só torna a história da
// luta legível durante a transmissão.
export class FightFeedbackService {
  static fromRound(round, previous = null) {
    if (!round) {
      return { dominance: 0, fatigue: 0, danger: 0, critical: false, turnaround: false };
    }

    const scoreDelta = (round.scoreA || 0) - (round.scoreB || 0);
    const strikesDelta = (round.sigStrikesA || 0) - (round.sigStrikesB || 0);
    const grapplingDelta = ((round.takedownsA || 0) - (round.takedownsB || 0)) * 2
      + ((round.subAttemptsA || 0) - (round.subAttemptsB || 0)) * 2;
    const knockdownDelta = (round.knockdownsA || 0) - (round.knockdownsB || 0);
    const dominance = clamp((scoreDelta * 0.2 + strikesDelta * 0.08 + grapplingDelta * 0.18 + knockdownDelta * 0.5), -1, 1);
    const fatigue = clamp(((round.round || 1) - 1) * 0.16 + (round.injuries?.length || 0) * 0.12, 0, 1);
    const danger = clamp(Math.abs(knockdownDelta) * 0.6 + Math.max(0, Math.abs(dominance) - 0.45), 0, 1);
    const turnaround = !!previous
      && Math.abs(previous.dominance) >= 0.32
      && Math.abs(dominance) >= 0.32
      && Math.sign(previous.dominance) !== Math.sign(dominance);

    return {
      dominance,
      fatigue,
      danger,
      critical: danger >= 0.6 || Math.abs(dominance) >= 0.75,
      turnaround,
    };
  }
}
