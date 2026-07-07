import { Fighter } from '../models/fighter.js';
import { Contract } from '../models/contract.js';
import { DB } from '../services/db.js';
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

  // Lutadores treinados por uma academia (equipe do jogador)
  async getTeam(gymId) {
    const all = await this.db.getIndex('fighters', 'gymId', gymId);
    return all.map(d => new Fighter(d)).filter(f => f.status !== 'retired');
  }

  async recruitToGym(fighterId, gymId, absWeekNow = 0) {
    const fighter = await this.getFighter(fighterId);
    if (!fighter) return null;

    fighter.gymId = gymId;
    fighter.gymJoinedAbsWeek = absWeekNow;
    fighter.status = 'gym';
    fighter.organizationId = null;
    fighter.contract = null;
    fighter.applyMoraleChange(10);

    await this.db.put('fighters', fighter);
    return new Fighter(fighter);
  }

  async releaseFromGym(fighterId) {
    const fighter = await this.getFighter(fighterId);
    if (!fighter) return false;

    fighter.gymId = null;
    fighter.status = 'free';

    await this.db.put('fighters', fighter);
    return true;
  }

  async saveFighter(fighter) {
    await this.db.put('fighters', fighter);
  }

  async hireFighter(fighterId, organizationId, contractData) {
    const fighter = await this.getFighter(fighterId);
    if (!fighter) return null;

    const contract = new Contract(contractData);

    fighter.status = 'roster';
    fighter.organizationId = organizationId;
    fighter.contract = contract;
    fighter.applyMoraleChange(10);

    await this.db.put('fighters', fighter);
    return new Fighter(fighter);
  }

  async fireFighter(fighterId) {
    const fighter = await this.getFighter(fighterId);
    if (!fighter) return false;

    fighter.status = 'free';
    fighter.organizationId = null;
    fighter.contract = null;

    await this.db.put('fighters', fighter);
    return true;
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
