import { Fighter } from '../models/fighter.js';
import { Contract } from '../models/contract.js';
import { generateId } from '../utils/helpers.js';

export class FighterController {
  constructor(db) {
    this.db = db;
  }

  async getAllFighters() {
    const data = await this.db.getAll('fighters');
    return data.map(d => new Fighter(d));
  }

  async getFighter(id) {
    const data = await this.db.get('fighters', id);
    return data ? new Fighter(data) : null;
  }

  async getRoster(organizationId) {
    const all = await this.db.getIndex('fighters', 'organizationId', organizationId);
    return all.map(d => new Fighter(d));
  }

  async getFreeAgents() {
    const all = await this.db.getIndex('fighters', 'status', 'free');
    return all.map(d => new Fighter(d));
  }

  // O lutador do jogador — identidade (career.playerFighterId), não posse
  // de academia. Ver spec §A.6.
  async getPlayerFighter() {
    const career = await this.db.get('gameState', 'career');
    if (!career?.playerFighterId) return null;
    return await this.getFighter(career.playerFighterId);
  }

  async setPlayerFighterId(fighterId) {
    await this.db.put('gameState', { id: 'career', playerFighterId: fighterId });
  }

  // Troca de academia (substitui recruitToGym — não é mais "ser recrutado
  // por um negócio", é escolher onde treinar). Registra a academia anterior
  // pra detecção de reencontro (Épico F4) e reseta parcialmente a sinergia
  // com o técnico (§C.2, SYNERGY_CONFIG.CARRY_OVER_RATIO é aplicado pelo
  // chamador, que já tem acesso à config).
  async setAcademy(fighterId, academyId, absWeekNow = 0) {
    const fighter = await this.getFighter(fighterId);
    if (!fighter) return null;

    if (fighter.academyId && fighter.academyId !== academyId && !fighter.previousAcademyIds.includes(fighter.academyId)) {
      fighter.previousAcademyIds.push(fighter.academyId);
    }
    fighter.academyId = academyId;
    fighter.academyJoinedAbsWeek = absWeekNow;

    await this.db.put('fighters', fighter);
    return new Fighter(fighter);
  }

  async saveFighter(fighter) {
    await this.db.put('fighters', fighter);
  }

  async updateFighter(fighter) {
    await this.db.put('fighters', fighter);
  }

  async getFightersByWeight(weightClass) {
    const all = await this.db.getIndex('fighters', 'weightClass', weightClass);
    return all.map(d => new Fighter(d));
  }

  async getFightersByStatus(status) {
    const all = await this.db.getIndex('fighters', 'status', status);
    return all.map(d => new Fighter(d));
  }

  async createFighter(data) {
    const fighter = new Fighter({
      ...data,
      id: data.id || generateId(),
    });
    await this.db.put('fighters', fighter);
    return fighter;
  }

  async renewContract(fighterId, newContractData) {
    const fighter = await this.getFighter(fighterId);
    if (!fighter) return null;
    const contract = new Contract(newContractData);
    fighter.contract = contract;
    fighter.applyMoraleChange(5);
    await this.db.put('fighters', fighter);
    return new Fighter(fighter);
  }

  async removeFighter(id) {
    await this.db.delete('fighters', id);
  }
}
