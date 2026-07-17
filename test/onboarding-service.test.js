import { describe, it, expect } from 'vitest';
import { OnboardingService } from '../js/services/onboarding-service.js';
import { makeFighter } from './fixtures.js';

describe('OnboardingService', () => {
  it('shows the banner with the first incomplete step for a brand new fighter', () => {
    const fighter = makeFighter();
    expect(OnboardingService.shouldShow(fighter)).toBe(true);
    expect(OnboardingService.activeStep(fighter).id).toBe('offerAccepted');
    expect(OnboardingService.progress(fighter)).toEqual({ done: 0, total: 4 });
  });

  it('advances to the next step once a step is marked done', () => {
    const fighter = makeFighter();
    OnboardingService.markOfferAccepted(fighter);
    expect(OnboardingService.activeStep(fighter).id).toBe('campConfigured');
    expect(OnboardingService.progress(fighter).done).toBe(1);
  });

  it('derives the fight step from win/loss/draw record without needing a flag', () => {
    const fighter = makeFighter({ record: { wins: 1, losses: 0, draws: 0 } });
    OnboardingService.markOfferAccepted(fighter);
    OnboardingService.markCampConfigured(fighter);
    OnboardingService.markWeighedIn(fighter);
    expect(OnboardingService.isComplete(fighter)).toBe(true);
    expect(OnboardingService.shouldShow(fighter)).toBe(false);
  });

  it('stays hidden after an explicit dismiss even with steps incomplete', () => {
    const fighter = makeFighter();
    OnboardingService.dismiss(fighter);
    expect(OnboardingService.shouldShow(fighter)).toBe(false);
  });

  it('marking a step twice is a no-op (idempotent)', () => {
    const fighter = makeFighter();
    OnboardingService.markOfferAccepted(fighter);
    OnboardingService.markOfferAccepted(fighter);
    expect(OnboardingService.progress(fighter).done).toBe(1);
  });
});
