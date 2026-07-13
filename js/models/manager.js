import { clamp } from '../utils/helpers.js';

// Empresário do lutador — negocia contratos e patrocínios em troca de um
// corte da bolsa. Ver spec §C.1. Persiste no store 'organization'
// (mesmo padrão de Academy/Promotion), id prefixado 'manager-'.
export class Manager {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.style = data.style || 'conservative'; // 'aggressive' | 'conservative' | 'loyal'
    this.cut = data.cut ?? 0.1;
    this.connections = data.connections ?? 40;
    this.trust = data.trust ?? 50;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  updateTrust(change) {
    this.trust = clamp(this.trust + change, 0, 100);
  }
}
