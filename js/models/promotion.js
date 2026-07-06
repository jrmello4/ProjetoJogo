import { TIER_LABELS } from '../config/game-config.js';

// Organização de MMA controlada pela IA. Persiste no store 'organization'.
// Agenda e realiza os próprios eventos; envia ofertas aos lutadores do jogador.
export class Promotion {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.short = data.short || data.name;
    this.tier = data.tier ?? 3;
    this.reputation = data.reputation ?? 30;
    this.cadenceWeeks = data.cadenceWeeks ?? 3;
    this.rosterSize = data.rosterSize ?? 16;
    this.eventsHosted = data.eventsHosted ?? 0;
    this.nextEventAbsWeek = data.nextEventAbsWeek ?? 2;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  get tierLabel() {
    return TIER_LABELS[this.tier] || 'Regional';
  }

  nextEventName() {
    return `${this.short} ${this.eventsHosted + 1}`;
  }
}
