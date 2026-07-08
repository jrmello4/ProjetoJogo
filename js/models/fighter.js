import { clamp } from '../utils/helpers.js';
import { Contract } from './contract.js';

const DNA_TRAIT_NAMES = {
  pressurePerformer: 'Cresce sob pressão',
  bigEventNervous: 'Medo em grandes eventos',
  exceptionalRecovery: 'Recuperação excepcional',
  injuryProne: 'Tendência a lesões',
  emotionallyUnstable: 'Instável emocionalmente',
};

const POPULARITY_TIERS = [
  { min: 80, label: 'Superstar' },
  { min: 60, label: 'Popular' },
  { min: 40, label: 'Conhecido' },
  { min: 20, label: 'Desconhecido' },
  { min: 0, label: 'Novato' },
];

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
    this.dna = data.dna || this._defaultDNA();
    this.popularity = data.popularity ?? Math.floor(Math.random() * 30) + 15;
    this.weightCut = data.weightCut || this._defaultWeightCut();
    this.status = data.status;
    this.organizationId = data.organizationId;
    this.gymId = data.gymId || null; // academia que treina o lutador
    this.gymJoinedAbsWeek = data.gymJoinedAbsWeek || 0; // carência anti-assédio de rivais
    this.injury = data.injury || null; // { untilAbsWeek, description }
    this.trainingFocus = data.trainingFocus || 'striking'; // foco individual de treino semanal
    this.availableFromAbsWeek = data.availableFromAbsWeek || 0; // suspensão médica pós-luta
    this.lastTrainedAbsWeek = data.lastTrainedAbsWeek || 0; // cooldown semanal do acampamento
    this.promotionContract = data.promotionContract || null; // contrato exclusivo com promoção (Épico B)
    this.loyalty = data.loyalty ?? 50; // 0-100, Épico A — retenção
    this.purseShare = data.purseShare ?? 0.8; // fração da bolsa que fica com o atleta (1 - managerCut)
    this.promises = data.promises || []; // { kind, deadlineAbsWeek, madeAtAbsWeek, kept }

    // Cartel por promoção: { [promoId]: { wins, losses } }. Chance de título
    // exige vitórias DENTRO da promoção — cartel de outro circuito não conta.
    this.promoRecord = data.promoRecord || {};
    this.titlesWon = data.titlesWon ?? 0;
    this.titleShotCooldownUntil = data.titleShotCooldownUntil ?? 0;
    this.contract = data.contract ? new Contract(data.contract) : null;
    this.fights = [...(data.fights || [])];
    this.ranking = data.ranking || 0;
    this.morale = data.morale || 75;
    this.fatigue = data.fatigue || 0;
    this.createdAt = data.createdAt;
  }

  _defaultDNA() {
    return {
      pressurePerformer: false,
      bigEventNervous: false,
      exceptionalRecovery: false,
      injuryProne: false,
      emotionallyUnstable: false,
    };
  }

  _defaultWeightCut() {
    return {
      naturalWeight: Math.floor(Math.random() * 15) + 1,
      ease: Math.floor(Math.random() * 60) + 20,
      lastCutImpact: 0,
    };
  }

  get totalFights() {
    return this.record.wins + this.record.losses + this.record.draws;
  }

  get winRate() {
    return this.totalFights > 0 ? (this.record.wins / this.totalFights) * 100 : 0;
  }

  // fights[0] é a luta mais recente (unshift no SimulationEngine)
  get winStreak() {
    let streak = 0;
    for (const f of this.fights) {
      if (!f.won) break;
      streak++;
    }
    return streak;
  }

  recordIn(promotionId) {
    return this.promoRecord[promotionId] || { wins: 0, losses: 0 };
  }

  registerPromoResult(promotionId, won) {
    const rec = this.recordIn(promotionId);
    this.promoRecord[promotionId] = {
      wins: rec.wins + (won ? 1 : 0),
      losses: rec.losses + (won ? 0 : 1),
    };
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

  get dnaTraits() {
    return Object.entries(this.dna)
      .filter(([_, v]) => v)
      .map(([key]) => ({ key, label: DNA_TRAIT_NAMES[key] || key }));
  }

  get popularityTier() {
    for (const tier of POPULARITY_TIERS) {
      if (this.popularity >= tier.min) return tier.label;
    }
    return POPULARITY_TIERS[POPULARITY_TIERS.length - 1].label;
  }

  hasDNA(trait) {
    return !!this.dna[trait];
  }

  evolve() {
    const rate = Math.min(0.95, (this.hidden.evolution / 100) * (this.hidden.discipline / 100) * 1.3);
    const potentialGap = (this.hidden.potential - this.averageSkill) * 0.15;
    const isYoung = (this.age || 30) < 30;

    for (const key of Object.keys(this.attributes)) {
      const growth = Math.random() < rate
        ? Math.min(potentialGap + 1.5, Math.random() * 4 + 1)
        : Math.random() * 0.8;
      const multiplier = isYoung ? 1.5 : 1.0;
      this.attributes[key] = clamp(
        Math.round(this.attributes[key] + growth * multiplier),
        0, 99
      );
    }

    this.attributes.fightIQ = clamp(
      Math.round(this.attributes.fightIQ + (Math.random() * 2 + 0.5)),
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
    const multiplier = this.dna.emotionallyUnstable ? 2.0 : 1.0;
    this.morale = clamp(this.morale + Math.round(amount * multiplier), 0, 100);
  }

  applyWeightCutImpact() {
    const diff = this.weightCut.naturalWeight;
    const ease = this.weightCut.ease / 100;
    const impact = diff * (1 - ease);
    this.attributes.cardio = clamp(this.attributes.cardio - Math.round(impact * 0.5), 0, 99);
    this.weightCut.lastCutImpact = impact;
  }

  recoverFromWeightCut() {
    this.attributes.cardio = clamp(
      this.attributes.cardio + Math.round(this.weightCut.lastCutImpact * 0.3),
      0, 99
    );
    this.weightCut.lastCutImpact = 0;
  }

  applyPostFightEffects() {
    if (this.dna.exceptionalRecovery) {
      this.fatigue = clamp(this.fatigue - 15, 0, 100);
    }
  }

  updatePopularity(amount) {
    this.popularity = clamp(this.popularity + amount, 0, 100);
  }
}
