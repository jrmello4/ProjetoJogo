import { clamp } from '../utils/helpers.js';
import { FACILITY_LEVELS } from '../config/game-config.js';

// Um lugar no mundo onde se treina MMA — sem dono. Substitui Gym (negócio
// do jogador) + RivalGym (versão leve de IA) do modo academia antigo.
// Persiste no store 'organization' (mesmo padrão de Promotion), id
// prefixado 'academy-'. Qualquer Fighter (jogador ou IA) aponta pra uma
// via `fighter.academyId`.
export class Academy {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.reputation = data.reputation ?? 30;
    this.facilityLevel = data.facilityLevel ?? 1;
    this.weeklyFee = data.weeklyFee ?? 200;
    this.philosophy = data.philosophy || '';
    this.specialties = data.specialties || { striking: 0, grappling: 0, cardio: 0 };
    this.headCoach = data.headCoach || { name: 'Treinador', personality: 'analytical' };
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  get facility() {
    return FACILITY_LEVELS[Math.min(this.facilityLevel, FACILITY_LEVELS.length) - 1];
  }

  specialtyBonus(focus) {
    return this.specialties[focus] || 0;
  }

  updateReputation(change) {
    this.reputation = clamp(this.reputation + change, 0, 100);
  }
}
