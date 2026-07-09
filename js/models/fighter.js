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
    this.attributes = Fighter.expandAttributes(data.attributes || {});
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
    this.lastFightAbsWeek = data.lastFightAbsWeek || 0; // Épico F2: última semana com luta
    this.promotionContract = data.promotionContract || null; // contrato exclusivo com promoção (Épico B)
    this.loyalty = data.loyalty ?? 50; // 0-100, Épico A — retenção
    this.purseShare = data.purseShare ?? 0.8; // fração da bolsa que fica com o atleta (1 - managerCut)
    this.promises = data.promises || []; // { kind, deadlineAbsWeek, madeAtAbsWeek, kept }

    // Épico D: configuração do acampamento semanal (persistida, não botão manual)
    this.campConfig = data.campConfig || null; // { intensity, spec, sparringPartnerId } ou null
    this.campProcessedThisWeek = data.campProcessedThisWeek || false; // já foi processado no loop semanal

    // Épico F2: expectativas dos atletas
    this.expectation = data.expectation || null; // { kind: 'title_shot'|'move_up_tier'|'more_fights'|'better_pay', sinceAbsWeek, urgency: 1-3 }
    this.lastExpectationCheck = data.lastExpectationCheck || 0;

    // Épico F4: academias por onde passou (para detecção de reencontro)
    this.previousGymIds = data.previousGymIds || [];

    // G5: tracking de carreira
    this.careerEarnings = data.careerEarnings || 0;
    this.fightNightBonuses = data.fightNightBonuses || 0;
    this.performanceBonuses = data.performanceBonuses || 0;

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
    // Épico F1: hype acumulado na coletiva de imprensa — vira bônus na bolsa
    this.pcHype = data.pcHype || 0;
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
    const primary = (
      this.attributes.boxing * 0.4 +
      this.attributes.kickboxing * 0.3 +
      this.attributes.muayThai * 0.3
    );
    const secondary = (
      this.attributes.power * 0.15 +
      this.attributes.footwork * 0.1 +
      this.attributes.headMovement * 0.1 +
      this.attributes.clinch * 0.05 +
      this.attributes.speed * 0.15 +
      this.attributes.aggression * 0.05
    );
    return primary * 0.7 + secondary * 0.3;
  }

  get grapplingScore() {
    const primary = (
      this.attributes.wrestling * 0.5 +
      this.attributes.bjj * 0.5
    );
    const secondary = (
      this.attributes.takedowns * 0.15 +
      this.attributes.takedownDefense * 0.1 +
      this.attributes.groundControl * 0.15 +
      this.attributes.submissionOffense * 0.1 +
      this.attributes.submissionDefense * 0.1 +
      this.attributes.strength * 0.1
    );
    return primary * 0.7 + secondary * 0.3;
  }

  get overallRating() {
    const skill = this.averageSkill * 0.5;
    const iq = this.attributes.fightIQ * 0.1;
    const cardio = this.attributes.cardio * 0.05;
    const chin = this.attributes.chin * 0.05;
    const phys = (this.attributes.strength + this.attributes.speed + this.attributes.durability + this.attributes.recovery) / 4 * 0.1;
    const ment = (this.attributes.composure + this.attributes.aggression + this.attributes.adaptability) / 3 * 0.05;
    const exp = Math.min(10, this.totalFights * 0.5) * 0.05;
    return Math.round(skill + iq + cardio + chin + phys + ment + exp);
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

  static expandAttributes(attrs) {
    const avg = (Object.values(attrs).length > 0)
      ? Object.values(attrs).reduce((a, b) => a + b, 0) / Object.values(attrs).length
      : 50;

    const jitter = () => Math.round(clamp(avg + (Math.random() * 20 - 10), 1, 99));
    const spread = (base, maxOff = 15) => Math.round(clamp(base + (Math.random() * maxOff * 2 - maxOff), 1, 99));

    return {
      // === Existentes (8) ===
      boxing: attrs.boxing ?? jitter(),
      kickboxing: attrs.kickboxing ?? jitter(),
      muayThai: attrs.muayThai ?? jitter(),
      wrestling: attrs.wrestling ?? jitter(),
      bjj: attrs.bjj ?? jitter(),
      cardio: attrs.cardio ?? jitter(),
      chin: attrs.chin ?? jitter(),
      fightIQ: attrs.fightIQ ?? jitter(),

      // === Novos — Em pé (4) ===
      power: attrs.power ?? spread(attrs.boxing || avg, 12),
      footwork: attrs.footwork ?? spread(attrs.kickboxing || avg, 12),
      headMovement: attrs.headMovement ?? spread(attrs.boxing || avg, 10),
      clinch: attrs.clinch ?? spread(attrs.muayThai || avg, 12),

      // === Novos — Chão (5) ===
      takedowns: attrs.takedowns ?? spread(attrs.wrestling || avg, 12),
      takedownDefense: attrs.takedownDefense ?? spread(attrs.wrestling || avg, 12),
      groundControl: attrs.groundControl ?? spread(attrs.wrestling || avg, 12),
      submissionOffense: attrs.submissionOffense ?? spread(attrs.bjj || avg, 12),
      submissionDefense: attrs.submissionDefense ?? spread(attrs.bjj || avg, 12),

      // === Novos — Físico (4) ===
      strength: attrs.strength ?? spread(attrs.wrestling || avg, 14),
      speed: attrs.speed ?? spread(attrs.kickboxing || avg, 12),
      durability: attrs.durability ?? spread(attrs.chin || avg, 10),
      recovery: attrs.recovery ?? spread(attrs.cardio || avg, 12),

      // === Novos — Mental (3) ===
      composure: attrs.composure ?? spread(attrs.fightIQ || avg, 12),
      aggression: attrs.aggression ?? jitter(),
      adaptability: attrs.adaptability ?? spread(attrs.fightIQ || avg, 12),
    };
  }

  hasDNA(trait) {
    return !!this.dna[trait];
  }

  evolve() {
    const age = this.age || 30;

    // E3: declínio por idade — após ~33 anos, o corpo começa a cair
    if (age >= 33) {
      this._applyAgeDecline(age);
      return;
    }

    const rate = Math.min(0.95, (this.hidden.evolution / 100) * (this.hidden.discipline / 100) * 1.3);
    const potentialGap = (this.hidden.potential - this.averageSkill) * 0.15;
    const isYoung = age < 30;

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

  // Épico E3: declínio anual após ~33 anos
  _applyAgeDecline(age) {
    // A taxa de declínio aumenta com a idade
    // 33-35: declínio leve, 36-38: moderado, 39+: acelerado
    let declineRate;
    if (age >= 40) declineRate = 0.7;
    else if (age >= 37) declineRate = 0.5;
    else if (age >= 35) declineRate = 0.3;
    else declineRate = 0.15;

    // determination retarda o declínio
    const determinationFactor = 1 - (this.hidden?.determination || 50) / 300;
    declineRate *= determinationFactor;

    // Atributos físicos declinam mais que os técnicos
    const physicalAttrs = ['power', 'speed', 'cardio', 'durability', 'recovery', 'strength', 'chin'];
    const skillAttrs = ['boxing', 'kickboxing', 'muayThai', 'wrestling', 'bjj', 'footwork', 'headMovement',
      'clinch', 'takedowns', 'takedownDefense', 'groundControl', 'submissionOffense', 'submissionDefense'];

    for (const key of Object.keys(this.attributes)) {
      let attrDecline = declineRate;
      if (physicalAttrs.includes(key)) attrDecline *= 1.4;
      if (skillAttrs.includes(key)) attrDecline *= 0.7;
      if (key === 'fightIQ' || key === 'composure') attrDecline *= 0.3; // mente declina lentamente

      const decay = Math.random() < 0.8
        ? Math.random() * attrDecline * 2 + 1
        : 0;

      this.attributes[key] = clamp(
        Math.round(this.attributes[key] - decay),
        1, 99
      );
    }
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
