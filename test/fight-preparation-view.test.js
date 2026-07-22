import { describe, expect, it } from 'vitest';
import { OffersView } from '../js/views/offers.js';

const offer = {
  id: 'offer-1', opponentName: 'Bia', promotionName: 'Apex',
  eventAbsWeek: 8, gamePlan: 'balanced', isTitleFight: false,
};

describe('contextual fight screens', () => {
  it('renders a dedicated fight-night screen instead of falling back to the dashboard', () => {
    const html = OffersView.renderFightDay(offer, 6);
    expect(html).toContain('Combate');
    expect(html).toContain('Bia');
    expect(html).toContain('data-fight-day-advance');
  });

  it('renders dedicated empty states when no fight is booked', () => {
    expect(OffersView.renderOpponentStudy(null, null, null)).toContain('Marque uma luta');
    expect(OffersView.renderFightPlan(null, null, null)).toContain('Marque uma luta');
  });
});
