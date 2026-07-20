import { clamp } from '../utils/helpers.js';
import { Contract } from './contract.js';
import { DNA_DISCOVERY_CONFIG } from '../config/game-config.js';
import { LEVEL_CONFIG, FIGHTING_STYLES, PERKS } from '../config/game-config.js';

const LEDGER_LIMIT = 120;

export const DNA_TRAIT_NAMES = {
  pressurePerformer: 'Cresce sob pressão',
  bigEventNervous: 'Medo em grandes eventos',
  exceptionalRecovery: 'Recuperação excepcional',
  injuryProne: 'Tendência a lesões',
  emotionallyUnstable: 'Instável emocionalmente',
  potential: 'Potencial',
  discipline: 'Disciplina',
  determination: 'Determinação',
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
    // Aparência visual (appearance-config.js). null = deriva do hash do id
    // (PortraitService / VisualIdentityService) — só o jogador persiste a dele.
    this.appearance = data.appearance || null;
    // Identidade visual (visual-identity-config.js): arquétipo + era.
    // visualLock=true impede blend automático no jogador.
    // visualAutoEvolve=true permite evolução por eventos/ano.
    this.visualArchetype = data.visualArchetype || null;
    this.visualStage = data.visualStage || null;
    this.visualLock = data.visualLock ?? false;
    this.visualAutoEvolve = data.visualAutoEvolve ?? false;
    this.visualUnlocks = Array.isArray(data.visualUnlocks) ? [...data.visualUnlocks] : [];
    this.wasChampion = data.wasChampion ?? false;
    this.titlesWon = data.titlesWon ?? data.careerTitles ?? 0;
    this.weightCut = data.weightCut || this._defaultWeightCut();
    this.status = data.status;
    this.organizationId = data.organizationId;
    this.academyId = data.academyId || null; // academia onde o lutador treina hoje
    this.academyJoinedAbsWeek = data.academyJoinedAbsWeek || 0; // carência anti-assédio + base da sinergia
    // P2.2: backward compat — old format { untilAbsWeek, description } → new stage format
    this.injury = data.injury || null;
    if (this.injury && !this.injury.stage) {
      this.injury = {
        stage: 'rest',
        restUntilAbsWeek: this.injury.untilAbsWeek,
        rehabEndAbsWeek: 0,
        description: this.injury.description || 'Lesionado',
        rehabCost: 0,
        rehabChosen: false,
        resumeStatus: this.injury.resumeStatus || 'active',
      };
    }
    this.trainingFocus = data.trainingFocus || 'striking'; // foco individual de treino semanal
    this.availableFromAbsWeek = data.availableFromAbsWeek || 0; // suspensão médica pós-luta
    this.lastTrainedAbsWeek = data.lastTrainedAbsWeek || 0; // cooldown semanal do acampamento
    this.lastFightAbsWeek = data.lastFightAbsWeek || 0; // Épico F2: última semana com luta
    this.promotionContract = data.promotionContract || null; // contrato exclusivo com promoção (Épico B)
    this.loyalty = data.loyalty ?? 50; // 0-100, Épico A — retenção
    this.purseShare = data.purseShare ?? 0.8; // fração da bolsa que fica com o atleta (1 - managerCut)

    // Economia pessoal (não há mais academia-negócio do jogador, §A.2)
    this.cash = data.cash ?? 0;
    this.ledger = data.ledger || []; // {absWeek, label, amount}
    this.lifestyleTier = data.lifestyleTier || 'modest'; // §E.1
    this.everReachedLifestyle = data.everReachedLifestyle || { modest: true, comfortable: false, luxurious: false };
    this.hiredServices = data.hiredServices || []; // serviços opcionais contratados: 'physio' | 'nutritionist' | 'psychologist'
    this.weeklyActivity = data.weeklyActivity || null; // atividade de lazer da semana
    this.campStrategyBonus = data.campStrategyBonus || 0; // bônus de estratégia do camp (próxima luta)
    this.scoutingBoost = data.scoutingBoost || 0; // bônus temporário de scouting

    // Empresário (§C.1) e sinergia com o técnico da academia atual (§C.2)
    this.managerId = data.managerId || null;
    this.coachSynergy = data.coachSynergy ?? 40;

    // O Livro Sobre Você (Fase 3): a fita pública deste lutador — o que o
    // mundo consegue observar de fora. Só o que é visível numa transmissão:
    // qual plano ele trouxe, sob que holofote. Nunca atributos ocultos.
    // A forma canônica vive em TapeService.defaultTape(); repeti-la aqui
    // criaria duas fontes de verdade, então o serviço materializa sob demanda
    // (TapeService.tapeOf) e o construtor só preserva o que veio do save.
    this.tape = data.tape || null;

    // A sala de treino viva (Fase 3b). `bonds`: o vínculo com cada companheiro
    // de academia. `sparredWith`: quantas semanas você dividiu o tatame com
    // cada um — é o que faz um ex-parceiro te ler melhor que qualquer fita.
    this.bonds = data.bonds || {};
    this.sparredWith = data.sparredWith || {};

    // Auto-descoberta de DNA (§B.1): chaves de `dna`/hidden numéricos já
    // reveladas ao jogador. Sem estar aqui, a interface mostra faixa/rótulo
    // vago em vez do valor exato — mesma função de blur do scouting.
    this.discoveredTraits = data.discoveredTraits || [];
    // Marca a 1ª luta em promoção tier 1 — gatilho de descoberta de
    // pressurePerformer/bigEventNervous (§B.1), independente de título em
    // jogo (o outro gatilho, esse já reconhecível por fight.titleWeightClass).
    this.reachedTier1 = data.reachedTier1 || false;

    // Sequelas permanentes de lesão (§B.2): { bodyPart, attributeCeilings,
    // compensation, fromFightId, atAbsWeek }. attributeCeilings reduz o
    // TETO de evolve(), não o valor atual.
    this.permanentScars = data.permanentScars || [];
    this.injuryCount = data.injuryCount || 0;
    this.sequelae = data.sequelae || []; // [{ attr, reduction, description, date }] — P10.1
    this.lastInjuryAbsWeek = data.lastInjuryAbsWeek || 0;
    // Nocautes/TKOs seguidos (zera em qualquer vitória ou decisão) — gatilho
    // de exame neurológico extra e aviso de aposentadoria (CONSECUTIVE_KO_CONFIG).
    this.consecutiveKoTkoLosses = data.consecutiveKoTkoLosses || 0;

    // Épico D: configuração do acampamento semanal (persistida, não botão manual)
    this.campConfig = data.campConfig || null; // { intensity, spec, sparringPartnerId } ou null
    this.campProcessedThisWeek = data.campProcessedThisWeek || false; // já foi processado no loop semanal
    // Prontidão (item 4): pontos de camp acumulados na janela do booking
    // atual. Incrementa a cada semana de camp COM luta marcada, zera quando
    // a luta é liquidada. É o maior componente do score de prontidão.
    this.campReadinessPoints = data.campReadinessPoints || 0;

    // P7.4 — onboarding guiado. Cada flag vira true na primeira vez que a
    // ação correspondente acontece (ver OnboardingService); "lutar" não
    // precisa de flag própria porque totalFights já responde por ela.
    // `dismissed` esconde o banner pra sempre, mesmo com passos incompletos.
    this.onboarding = data.onboarding || { offerAccepted: false, campConfigured: false, weighedIn: false, dismissed: false };

    // Épico F2: expectativas dos atletas
    this.expectation = data.expectation || null; // { kind: 'title_shot'|'move_up_tier'|'more_fights'|'better_pay', sinceAbsWeek, urgency: 1-3 }
    this.lastExpectationCheck = data.lastExpectationCheck || 0;

    // Épico F4: academias por onde passou (para detecção de reencontro)
    this.previousAcademyIds = data.previousAcademyIds || [];

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
    // Id da luta marcada cuja coletiva já foi feita. A coletiva é única por
    // luta: sem isto dava pra reentrar na aba e responder as mesmas perguntas
    // de novo, acumulando pcHype (→ bônus de bolsa) sem limite — dinheiro
    // infinito. Zera junto com pcHype quando a luta é liquidada.
    this.pcDoneForOfferId = data.pcDoneForOfferId || null;
    this.style = data.style || 'freestyle';
    this.moveset = data.moveset || [];
    // Task 9 — pool persistente de cartas descobertas em camp (Foco: Card
    // Discovery). Array de card-id strings. Sem sistema de slot/equip ainda
    // (escopo futuro não definido) — só o "descobriu, entrou no pool".
    this.cardPool = data.cardPool || [];
    this.moveProficiency = data.moveProficiency || {};
    this.styleLockedUntilAbsWeek = data.styleLockedUntilAbsWeek || 0;
    this.level = data.level || 1;
    this.xp = data.xp || 0;
    this.perkPoints = data.perkPoints || 0;
    this.perks = data.perks || [];

    // P5.3: Fim de carreira com escolhas
    this.lastFightPending = data.lastFightPending || false;
    this.lastFightBonus = data.lastFightBonus || 1.0;
    this.fightTilEnd = data.fightTilEnd || false;
    this.passiveIncome = data.passiveIncome || 0;

    // Persona pública / torcida — heat (vilão) e hype narrativo. Sem estes
    // campos no construtor, escolhas de imprensa sumiam no próximo load.
    this.narrativeHeat = data.narrativeHeat || 0;
    this.narrativeHype = data.narrativeHype || 0;
    this.publicPersona = data.publicPersona || 'neutral'; // face | heel | neutral
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

  // O espelho de winStreak. Um empate quebra as duas sequências — ele não é
  // derrota, então não pode contar como uma.
  get loseStreak() {
    let streak = 0;
    for (const f of this.fights) {
      if (f.won !== false) break;
      streak++;
    }
    return streak;
  }

  // `fights` é persistido em ordem decrescente (a mais nova entra no índice
  // 0). Centralizar essa leitura impede que sistemas de narrativa confundam
  // "tem alguma derrota no cartel" com "perdeu a última luta".
  get latestFightResult() {
    return this.fights[0] || null;
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

  // Item 4 — lutar não treina o corpo, treina a CABEÇA. A versão anterior
  // rodava ganho de até +6 em TODOS os ~25 atributos a cada luta — era o
  // motor da bola de neve que deixava o jogador intocável só clicando
  // "simular". Agora a experiência de luta rende fightIQ/composure/
  // adaptability (o que uma luta de verdade ensina); atributo físico e
  // técnico cresce no treino semanal e no camp — as telas.
  evolve() {
    const age = this.age || 30;

    // E3: declínio por idade — após ~33 anos, o corpo começa a cair
    if (age >= 33) {
      this._applyAgeDecline(age);
      return;
    }

    for (const key of ['fightIQ', 'composure', 'adaptability']) {
      const gain = Math.random() < 0.6 ? Math.round(Math.random() * 2) : 0; // 0-2
      this.attributes[key] = clamp(
        Math.round(this.attributes[key] + gain),
        0, this.effectiveCeiling(key)
      );
    }
  }

  // §B.2 — sequelas permanentes de lesão reduzem o TETO de evolução de
  // certos atributos (não o valor atual). Sem sequela nesse atributo, o
  // teto continua 99.
  effectiveCeiling(attr) {
    let ceiling = 99;
    for (const scar of this.permanentScars) {
      if (scar.attributeCeilings && attr in scar.attributeCeilings) {
        ceiling += scar.attributeCeilings[attr];
      }
    }
    // Nutricionista: +3 no teto efetivo (recuperação mais eficiente)
    if (this.hiredServices?.includes('nutritionist')) {
      ceiling = Math.min(ceiling + 3, 99);
    }
    return clamp(ceiling, 1, 99);
  }

  // P10.1 — aplica sequela mecânica de lesão: redução permanente no atributo.
  applySequelae(attr, description) {
    const reduction = Math.floor(Math.random() * 2) + 1; // 1-3
    this.attributes[attr] = Math.max(1, (this.attributes[attr] || 50) - reduction);
    this.sequelae.push({
      attr,
      reduction,
      description,
      date: new Date().toISOString(),
    });
  }

  // ===== Economia pessoal (§A.2) =====
  addTransaction(absWeek, label, amount) {
    this.cash += amount;
    this.ledger.unshift({ absWeek, label, amount });
    if (this.ledger.length > LEDGER_LIMIT) {
      this.ledger.length = LEDGER_LIMIT;
    }
  }

  // ===== Auto-descoberta de DNA (§B.1) =====
  isDiscovered(traitKey) {
    return this.discoveredTraits.includes(traitKey);
  }

  discoverTrait(traitKey) {
    if (!this.discoveredTraits.includes(traitKey)) {
      this.discoveredTraits.push(traitKey);
    }
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
    const applied = Math.round(amount * multiplier);
    this.morale = clamp(this.morale + applied, 0, 100);

    // §B.1 — emotionallyUnstable se descobre na primeira oscilação grande
    // de moral (o próprio traço dobra a variação — é essa dramaticidade
    // que o denuncia, não um contador de eventos à parte).
    if (this.dna.emotionallyUnstable && !this.isDiscovered('emotionallyUnstable')
      && Math.abs(applied) >= DNA_DISCOVERY_CONFIG.BIG_MORALE_SWING_THRESHOLD) {
      this.discoverTrait('emotionallyUnstable');
    }
  }

  applyWeightCutImpact(impactMultiplier = 1) {
    const diff = this.weightCut.naturalWeight;
    const ease = this.weightCut.ease / 100;
    const impact = diff * (1 - ease) * impactMultiplier;
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
      // §B.1 — descoberto no primeiro recuo rápido de fadiga pós-luta.
      this.discoverTrait('exceptionalRecovery');
    }
  }

  // §B.1 — potential/discipline/determination revelam-se em bloco depois
  // de lutas suficientes: sua evolução real vira a única forma de
  // estimá-los, como um atleta de verdade só descobre o próprio teto
  // competindo. Idempotente — seguro chamar toda semana.
  checkNumericDiscovery() {
    if (this.totalFights < DNA_DISCOVERY_CONFIG.NUMERIC_REVEAL_AT_FIGHTS) return;
    this.discoverTrait('potential');
    this.discoverTrait('discipline');
    this.discoverTrait('determination');
  }

  updatePopularity(amount) {
    this.popularity = clamp(this.popularity + amount, 0, 100);
  }

  getStyle() {
    return this.style;
  }

  getMoveProficiency(moveId) {
    return this.moveProficiency[moveId] || 0;
  }

  gainProficiency(moveId, amount) {
    const current = this.getMoveProficiency(moveId);
    this.moveProficiency[moveId] = Math.min(100, current + amount);
  }

  addXP(amount) {
    this.xp += amount;
    const needed = LEVEL_CONFIG.XP_PER_LEVEL;
    let gained = 0;
    while (this.xp >= needed && this.level < LEVEL_CONFIG.MAX_LEVEL) {
      this.xp -= needed;
      this.level++;
      gained++;
      if (this.level % LEVEL_CONFIG.PERK_POINT_EVERY_N_LEVELS === 0) {
        this.perkPoints++;
      }
    }
    if (this.level >= LEVEL_CONFIG.MAX_LEVEL) this.xp = 0;
    return gained; // quantos níveis subiu
  }

  addPerkPointMilestone(milestoneKey) {
    const pts = LEVEL_CONFIG.PERK_POINT_MILESTONES[milestoneKey];
    if (pts) this.perkPoints += pts;
  }

  hasPerk(perkId) {
    return this.perks.includes(perkId);
  }

  canLearnPerk(perkId) {
    const perk = PERKS[perkId];
    if (!perk) return false;
    if (this.hasPerk(perkId)) return false;
    const req = perk.requirements;
    if (req.style && req.style !== this.style) return false;
    if (req.level && this.level < req.level) return false;
    for (const [attr, min] of Object.entries(req.attrs || {})) {
      if ((this.attributes[attr] || 0) < min) return false;
    }
    for (const pre of req.perks || []) {
      if (!this.hasPerk(pre)) return false;
    }
    return true;
  }

  learnPerk(perkId) {
    if (!this.canLearnPerk(perkId)) return false;
    if (this.perkPoints <= 0) return false;
    this.perks.push(perkId);
    this.perkPoints--;
    return true;
  }

  getMaxMoves() {
    return 8;
  }

  canEquipMove(moveId) {
    const style = FIGHTING_STYLES[this.style];
    if (!style) return false;
    return style.poolMoves.includes(moveId);
  }

  equipMoveset(moveIds) {
    const valid = moveIds.filter(id => this.canEquipMove(id));
    this.moveset = valid.slice(0, this.getMaxMoves());
  }

  get xpProgress() {
    return this.xp / LEVEL_CONFIG.XP_PER_LEVEL;
  }

  get xpNeeded() {
    return LEVEL_CONFIG.XP_PER_LEVEL - this.xp;
  }
}
