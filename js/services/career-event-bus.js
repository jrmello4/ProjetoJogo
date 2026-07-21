// Barramento de eventos de domínio da carreira.
//
// O mundo continua podendo processar uma luta de ponta a ponta, mas as
// consequências que pertencem a outros sistemas passam a reagir a fatos
// imutáveis ("uma luta terminou") em vez de depender da ordem de chamadas
// entre controllers. O histórico em memória também serve ao painel de debug.

export const CAREER_EVENT_TYPES = Object.freeze({
  FIGHT_COMPLETED: 'FIGHT_COMPLETED',
  WEEK_PROCESSED: 'WEEK_PROCESSED',
});

export class CareerEventBus {
  constructor({ maxHistory = 300, clock = () => new Date().toISOString() } = {}) {
    this.maxHistory = maxHistory;
    this.clock = clock;
    this.listeners = new Map();
    this.history = [];
    this.sequence = 0;
  }

  subscribe(type, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('CareerEventBus.subscribe requer um handler.');
    }

    const handlers = this.listeners.get(type) || new Set();
    handlers.add(handler);
    this.listeners.set(type, handlers);
    return () => this.unsubscribe(type, handler);
  }

  unsubscribe(type, handler) {
    const handlers = this.listeners.get(type);
    if (!handlers) return false;
    const removed = handlers.delete(handler);
    if (handlers.size === 0) this.listeners.delete(type);
    return removed;
  }

  async emit(type, payload = {}) {
    const event = Object.freeze({
      id: `career-event-${++this.sequence}`,
      type,
      occurredAt: this.clock(),
      payload: Object.freeze({ ...payload }),
    });

    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }

    // A ordem é determinística: handlers que gravam consequências no banco
    // terminam antes do próximo sistema observar o mesmo evento.
    const handlers = [
      ...(this.listeners.get(type) || []),
      ...(this.listeners.get('*') || []),
    ];
    for (const handler of handlers) {
      await handler(event);
    }

    return event;
  }

  recent(limit = 30) {
    return this.history.slice(-Math.max(0, limit));
  }

  getStats() {
    return {
      eventCount: this.history.length,
      listenerCount: [...this.listeners.values()].reduce((sum, handlers) => sum + handlers.size, 0),
      lastEvent: this.history[this.history.length - 1] || null,
    };
  }
}
