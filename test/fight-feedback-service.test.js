import { describe, expect, it } from 'vitest';
import { FightFeedbackService } from '../js/services/fight-feedback-service.js';

describe('FightFeedbackService', () => {
  it('traduz domínio e knockdown em perigo visual', () => {
    const state = FightFeedbackService.fromRound({
      round: 2, scoreA: 10, scoreB: 8,
      sigStrikesA: 42, sigStrikesB: 12,
      takedownsA: 2, takedownsB: 0,
      knockdownsA: 1, knockdownsB: 0,
    });

    expect(state.dominance).toBeGreaterThan(0);
    expect(state.danger).toBeGreaterThanOrEqual(0.6);
    expect(state.critical).toBe(true);
  });

  it('marca virada quando o domínio troca de corner', () => {
    const first = FightFeedbackService.fromRound({ round: 1, scoreA: 10, scoreB: 8, sigStrikesA: 35, sigStrikesB: 10 });
    const second = FightFeedbackService.fromRound({ round: 2, scoreA: 8, scoreB: 10, sigStrikesA: 8, sigStrikesB: 38 }, first);
    expect(second.turnaround).toBe(true);
  });
});
