import { clamp } from '../utils/helpers.js';

export class Fighter {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.age = data.age;
    this.nationality = data.nationality;
    this.weightClass = data.weightClass;
    this.fightingStyle = data.fightingStyle;
    this.record = { ...data.record };
    this.attributes = { ...data.attributes };
    this.hidden = { ...data.hidden };
    this.status = data.status;
    this.organizationId = data.organizationId;
    this.contract = data.contract ? { ...data.contract } : null;
    this.fights = [...(data.fights || [])];
    this.ranking = data.ranking || 0;
    this.morale = data.morale || 75;
    this.fatigue = data.fatigue || 0;
    this.createdAt = data.createdAt;
  }

  get totalFights() {
    return this.record.wins + this.record.losses + this.record.draws;
  }

  get winRate() {
    return this.totalFights > 0 ? (this.record.wins / this.totalFights) * 100 : 0;
  }

  get averageSkill() {
    const attrs = Object.values(this.attributes);
    return attrs.reduce((a, b) => a + b, 0) / attrs.length;
  }

  get techniqueScore() {
    return (
      this.attributes.boxing * 0.25 +
      this.attributes.kickboxing * 0.2 +
      this.attributes.muayThai * 0.2 +
      this.attributes.wrestling * 0.15 +
      this.attributes.bjj * 0.2
    );
  }

  get strikingScore() {
    return (
      this.attributes.boxing * 0.4 +
      this.attributes.kickboxing * 0.3 +
      this.attributes.muayThai * 0.3
    );
  }

  get grapplingScore() {
    return (
      this.attributes.wrestling * 0.5 +
      this.attributes.bjj * 0.5
    );
  }

  get overallRating() {
    const skill = this.averageSkill * 0.6;
    const iq = this.attributes.fightIQ * 0.15;
    const cardio = this.attributes.cardio * 0.1;
    const chin = this.attributes.chin * 0.05;
    const exp = Math.min(10, this.totalFights * 0.5) * 0.1;
    return Math.round(skill + iq + cardio + chin + exp);
  }

  evolve() {
    const rate = (this.hidden.evolution / 100) * (this.hidden.discipline / 100);
    const potentialGap = (this.hidden.potential - this.averageSkill) * 0.1;

    for (const key of Object.keys(this.attributes)) {
      const growth = Math.random() < rate
        ? Math.min(potentialGap + 1, Math.random() * 3 + 0.5)
        : Math.random() * 0.5;
      this.attributes[key] = clamp(
        Math.round(this.attributes[key] + growth),
        0, 99
      );
    }

    this.attributes.fightIQ = clamp(
      Math.round(this.attributes.fightIQ + (Math.random() * 1.5 + 0.3)),
      0, 99
    );
  }

  recover() {
    this.fatigue = Math.max(0, this.fatigue - 15);
    this.morale = clamp(this.morale + 5, 0, 100);
  }

  applyFatigue(amount) {
    this.fatigue = clamp(this.fatigue + amount, 0, 100);
  }

  applyMoraleChange(amount) {
    this.morale = clamp(this.morale + amount, 0, 100);
  }
}
