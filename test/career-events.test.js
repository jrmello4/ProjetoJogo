import { describe, expect, it, vi } from 'vitest';
import { CAREER_EVENT, CareerEvents } from '../js/services/career-events.js';

describe('CareerEvents', () => {
  it('entrega o mesmo fato aos assinantes específicos e globais', async () => {
    const events = new CareerEvents();
    const received = [];
    events.on(CAREER_EVENT.FIGHT_ACCEPTED, event => received.push(event));
    events.on('*', event => received.push(event));

    const emitted = await events.emit(CAREER_EVENT.FIGHT_ACCEPTED, { offerId: 'offer-1' });

    expect(received).toHaveLength(2);
    expect(received[0]).toBe(emitted);
    expect(emitted.payload).toEqual({ offerId: 'offer-1' });
    expect(Object.isFrozen(emitted)).toBe(true);
    expect(Object.isFrozen(emitted.payload)).toBe(true);
  });

  it('mantém as reações independentes quando uma delas falha', async () => {
    const events = new CareerEvents();
    const healthyListener = vi.fn();
    events.on(CAREER_EVENT.FIGHT_COMPLETED, () => { throw new Error('reaction failed'); });
    events.on(CAREER_EVENT.FIGHT_COMPLETED, healthyListener);

    await events.emit(CAREER_EVENT.FIGHT_COMPLETED, { resultId: 'fight-1' });

    expect(healthyListener).toHaveBeenCalledTimes(1);
  });
});
