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

    // Cinturões: { [weightClass]: fighterId | null }. null = vago.
    this.champions = data.champions || {};
    // Defesas do campeão ATUAL de cada divisão (zera na troca de mãos).
    this.titleDefenses = data.titleDefenses || {};
    this.titleFightsHosted = data.titleFightsHosted ?? 0;

    this.createdAt = data.createdAt || new Date().toISOString();
  }

  get tierLabel() {
    return TIER_LABELS[this.tier] || 'Regional';
  }

  nextEventName() {
    return `${this.short} ${this.eventsHosted + 1}`;
  }

  championOf(weightClass) {
    return this.champions[weightClass] || null;
  }

  isChampion(fighterId, weightClass) {
    return !!fighterId && this.champions[weightClass] === fighterId;
  }

  defensesOf(weightClass) {
    return this.titleDefenses[weightClass] ?? 0;
  }

  // Coroa um novo campeão. Se for o mesmo lutador, é uma defesa.
  crown(fighterId, weightClass) {
    const retained = this.champions[weightClass] === fighterId;
    this.champions[weightClass] = fighterId;
    this.titleDefenses[weightClass] = retained ? this.defensesOf(weightClass) + 1 : 0;
    return { retained, defenses: this.titleDefenses[weightClass] };
  }

  vacate(weightClass) {
    this.champions[weightClass] = null;
    this.titleDefenses[weightClass] = 0;
  }

  // Divisões em que este lutador tem cinturão nesta promoção
  beltsHeldBy(fighterId) {
    return Object.entries(this.champions)
      .filter(([, id]) => id && id === fighterId)
      .map(([wc]) => wc);
  }
}
