import { describe, it, expect, vi, afterEach } from 'vitest';
import { rollInjurySeverity, computeSuspensionWeeks, INJURY_SEVERITY, SUSPENSION_CONFIG } from '../js/config/game-config.js';
import { WeeklyTrainingController } from '../js/controllers/weekly-training.js';
import { WEEKLY_TRAINING_CHOICES } from '../js/config/game-config.js';
import { formatWeeks } from '../js/utils/helpers.js';
import { makeFighter } from './fixtures.js';

describe('formatWeeks', () => {
  it('singularizes exactly 1 week (regression: old code always said "1 semanas")', () => {
    expect(formatWeeks(1)).toBe('1 semana');
  });

  it('pluralizes everything else', () => {
    expect(formatWeeks(0)).toBe('0 semanas');
    expect(formatWeeks(2)).toBe('2 semanas');
    expect(formatWeeks(26)).toBe('26 semanas');
  });
});

describe('rollInjurySeverity', () => {
  afterEach(() => vi.restoreAllMocks());

  it('always returns a valid type/label/weeks shape within the full pool', () => {
    for (let i = 0; i < 200; i++) {
      const r = rollInjurySeverity();
      expect(INJURY_SEVERITY[r.type]).toBeTruthy();
      expect(r.label).toBe(INJURY_SEVERITY[r.type].label);
      expect(r.weeks).toBeGreaterThanOrEqual(INJURY_SEVERITY[r.type].weeksMin);
      expect(r.weeks).toBeLessThanOrEqual(INJURY_SEVERITY[r.type].weeksMax);
    }
  });

  it('respects an allowed-types filter — never returns an excluded type', () => {
    for (let i = 0; i < 100; i++) {
      const r = rollInjurySeverity(['bruise', 'cut']);
      expect(['bruise', 'cut']).toContain(r.type);
    }
  });

  it('can roll the rare fracture tier when it is the only allowed type', () => {
    const r = rollInjurySeverity(['fracture']);
    expect(r.type).toBe('fracture');
    expect(r.weeks).toBeGreaterThanOrEqual(16);
  });

  it('fracture is reachable from the unrestricted pool (regression: weighted loop must not skip the last entry)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const r = rollInjurySeverity();
    expect(r.type).toBe('fracture');
  });
});

describe('computeSuspensionWeeks — KO tratado à parte de TKO/Submissão', () => {
  it('KO loss gets the longer suspension (report: nocaute é mais grave que TKO)', () => {
    expect(computeSuspensionWeeks('KO (Punches)', false)).toBe(SUSPENSION_CONFIG.KO_LOSS_WEEKS);
  });

  it('TKO loss and Submission loss share the shorter tier', () => {
    expect(computeSuspensionWeeks('TKO (Punches)', false)).toBe(SUSPENSION_CONFIG.TKO_SUBMISSION_LOSS_WEEKS);
    expect(computeSuspensionWeeks('Submission', false)).toBe(SUSPENSION_CONFIG.TKO_SUBMISSION_LOSS_WEEKS);
  });

  it('winning by finish and losing by decision are unaffected by the KO/TKO split', () => {
    expect(computeSuspensionWeeks('KO (Punches)', true)).toBe(SUSPENSION_CONFIG.FINISH_WIN_WEEKS);
    expect(computeSuspensionWeeks('Decision (Unanimous)', false)).toBe(SUSPENSION_CONFIG.DECISION_WEEKS);
  });

  it('never exceeds the pre-existing 16-week ceiling SPONSOR_BRANDS.goalWeeks was calibrated against', () => {
    const outcomes = [
      computeSuspensionWeeks('KO (Punches)', false),
      computeSuspensionWeeks('TKO (Punches)', false),
      computeSuspensionWeeks('Submission', false),
      computeSuspensionWeeks('KO (Punches)', true),
      computeSuspensionWeeks('Decision (Unanimous)', false),
    ];
    for (const weeks of outcomes) expect(weeks).toBeLessThanOrEqual(16);
  });
});

describe('WeeklyTrainingController.applyChoice — injury duration regression', () => {
  it('sets restUntilAbsWeek relative to the CURRENT week, not a tiny absolute week number', () => {
    // Bug real: a versão antiga fazia (fighter.injury?.restUntilAbsWeek || 0)
    // + 1..3 — com injury null, virava restUntilAbsWeek = 1..3 (uma semana
    // ABSOLUTA no início do jogo). Numa carreira em semana 200, isso "curava"
    // a lesão no tick seguinte, não em 1-3 semanas de verdade.
    vi.spyOn(Math, 'random').mockReturnValue(0); // força o branch de lesão (< injuryRisk sempre que risk > 0)
    const fighter = makeFighter({ attributes: { striking: 50 } });
    const intenseKey = Object.keys(WEEKLY_TRAINING_CHOICES).find(k => WEEKLY_TRAINING_CHOICES[k].injuryRisk > 0);
    const absWeekNow = 200;

    const result = WeeklyTrainingController.applyChoice(fighter, intenseKey, null, [], absWeekNow);

    expect(result.injured).toBe(true);
    expect(fighter.injury.restUntilAbsWeek).toBeGreaterThan(absWeekNow);
    vi.restoreAllMocks();
  });
});
