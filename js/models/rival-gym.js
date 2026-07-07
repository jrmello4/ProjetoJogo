import { clamp } from '../utils/helpers.js';

// Academia rival controlada por IA. Persiste no store 'organization'
// (mesmo padrão das promoções), id prefixado com 'rivalgym-'.
export class RivalGym {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.reputation = data.reputation ?? 30;
    this.signings = data.signings ?? 0; // agentes livres recrutados no mercado
    this.poachedFromPlayer = data.poachedFromPlayer ?? 0; // atletas roubados da sua equipe
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  updateReputation(change) {
    this.reputation = clamp(this.reputation + change, 0, 100);
  }
}
