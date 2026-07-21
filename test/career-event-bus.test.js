import { describe, expect, it } from 'vitest';
import { CareerEventBus } from '../js/services/career-event-bus.js';

describe('CareerEventBus', () => {
  it('entrega eventos em ordem, inclui wildcard e mantém histórico limitado', async () => {
    const bus = new CareerEventBus({ maxHistory: 2, clock: () => '2030-01-01T00:00:00.000Z' });
    const calls = [];
    bus.subscribe('FIGHT_COMPLETED', event => calls.push(`fight:${event.payload.id}`));
    bus.subscribe('*', event => calls.push(`all:${event.type}`));

    await bus.emit('FIGHT_COMPLETED', { id: 'a' });
    await bus.emit('WEEK_PROCESSED', { week: 1 });
    await bus.emit('WEEK_PROCESSED', { week: 2 });

    expect(calls).toEqual(['fight:a', 'all:FIGHT_COMPLETED', 'all:WEEK_PROCESSED', 'all:WEEK_PROCESSED']);
    expect(bus.recent()).toHaveLength(2);
    expect(bus.getStats().lastEvent.payload.week).toBe(2);
  });

  it('remove handlers por unsubscribe', async () => {
    const bus = new CareerEventBus();
    const seen = [];
    const unsubscribe = bus.subscribe('X', () => seen.push('x'));
    expect(unsubscribe()).toBe(true);
    await bus.emit('X');
    expect(seen).toEqual([]);
  });
});
