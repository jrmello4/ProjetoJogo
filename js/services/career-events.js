import { generateId } from '../utils/helpers.js';

// Eventos de domínio são fatos que já aconteceram. Eles não substituem os
// serviços existentes; fornecem uma fronteira para que novos sistemas reajam
// sem acoplar OfferService, WorldService e a interface entre si.
export const CAREER_EVENT = Object.freeze({
  FIGHT_OFFERED: 'FIGHT_OFFERED',
  FIGHT_ACCEPTED: 'FIGHT_ACCEPTED',
  FIGHT_DECLINED: 'FIGHT_DECLINED',
  FIGHT_CANCELLED: 'FIGHT_CANCELLED',
  FIGHT_COMPLETED: 'FIGHT_COMPLETED',
  FIGHT_WON: 'FIGHT_WON',
  FIGHT_LOST: 'FIGHT_LOST',
  INJURY_SUSTAINED: 'INJURY_SUSTAINED',
});

export class CareerEvents {
  constructor() {
    this.listeners = new Map();
  }

  on(type, listener) {
    if (typeof listener !== 'function') throw new TypeError('Listener de evento inválido.');
    const bucket = this.listeners.get(type) || new Set();
    bucket.add(listener);
    this.listeners.set(type, bucket);
    return () => bucket.delete(listener);
  }

  // Executa cada reação em ordem. Uma reação com falha não desfaz o fato já
  // persistido (por exemplo, a oferta já foi aceita), mas também não impede
  // as demais reações independentes de receberem o mesmo evento.
  async emit(type, payload = {}) {
    const event = Object.freeze({
      id: generateId(),
      type,
      occurredAt: new Date().toISOString(),
      payload: Object.freeze({ ...payload }),
    });
    const listeners = [
      ...(this.listeners.get(type) || []),
      ...(this.listeners.get('*') || []),
    ];
    const outcomes = await Promise.allSettled(
      listeners.map(listener => Promise.resolve().then(() => listener(event)))
    );
    const failures = outcomes.filter(outcome => outcome.status === 'rejected');
    if (failures.length) {
      console.error(`Falharam ${failures.length} reação(ões) para ${type}.`, failures.map(failure => failure.reason));
    }
    return event;
  }
}
