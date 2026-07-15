# Sistema de Customização do Lutador — Plano de Implementação

> **Para workers:** Use `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.

**Objetivo:** Adicionar 3 camadas de customização ao lutador: Estilos mecânicos, Moveset com proficiência, e Teia de Perks.

**Arquitetura:** Config-driven. Dados de estilos/golpes/perks em `game-config.js`, estado no `Fighter` model, lógica de resolução num `style-service.js` novo. A simulação consome um `FightProfile` resolvido (não o fighter bruto).

**Stack:** JS puro (ES Modules), sem frameworks, sem testes automatizados (verificação manual no navegador).

## Arquivos do projeto

### Criar
- `js/services/style-service.js` — resolve Fighter → FightProfile

### Modificar
- `js/config/game-config.js` — +FIGHTING_STYLES, +MOVES, +PERKS, +STYLE_SWITCH_CONFIG
- `js/models/fighter.js` — +style, moveset[], moveProficiency{}, level, xp, perkPoints, perks[]
- `js/controllers/simulation.js` — consumir FightProfile
- `js/controllers/game-controller.js` — +gainWeeklyXP
- `js/controllers/training-camp.js` — +proficiency gain
- `js/services/tape-service.js` — estilo é público
- `js/services/data-generator.js` — IA fighters com estilo+moveset
- `js/views/fighter-profile.js` — UI de estilo + moveset + perks
- `js/views/dashboard.js` — exibir nível/estilo
- `js/views/live-fight-hub.js` — exibir golpes do round
- `js/views/training-camp.js` — opção de foco em proficiência

---

## Task 1: Config Data — Estilos, Golpes e Perks

**Files:**
- Modify: `js/config/game-config.js` (append before `export function absWeek` at line 726)

**Interfaces:**
- Produces: `FIGHTING_STYLES`, `MOVES`, `PERKS`, `STYLE_SWITCH_CONFIG`, `LEVEL_CONFIG` exports

- [ ] **Step 1: Adicionar FIGHTING_STYLES**

Append ANTES de `export function absWeek` (antes da linha 726):

Open `js/config/game-config.js` and add at line 725 (before the blank line before `export function absWeek`):

```js
// ============================================================
// SISTEMA DE CUSTOMIZAÇÃO — Estilos, Golpes e Perks
// ============================================================

export const FIGHTING_STYLES = {
  boxer: {
    id: 'boxer', label: 'Boxer',
    desc: 'Soco afiado, footwork preciso. Perfura defesas no 1-2.',
    bonusAttrs: ['boxing', 'headMovement', 'footwork'],
    evolutionRate: { striking: 1.3, grappling: 0.8, physical: 1.0, mental: 1.0 },
    matchup: { advantage: ['muayThai'], disadvantage: ['wrestler'] },
    stylePerkId: 'fastHands',
    poolMoves: ['jab', 'cross', 'hook', 'uppercut', 'overhand', 'bodyShot', 'takedown'],
  },
  muayThai: {
    id: 'muayThai', label: 'Muay Thai',
    desc: 'Oito armas. Joelhadas, cotoveladas, clinque mortal.',
    bonusAttrs: ['muayThai', 'clinch', 'kickboxing'],
    evolutionRate: { striking: 1.2, grappling: 1.1, physical: 1.0, mental: 0.9 },
    matchup: { advantage: ['wrestler'], disadvantage: ['boxer'] },
    stylePerkId: 'eightWeapons',
    poolMoves: ['jab', 'cross', 'legKick', 'lowKick', 'headKick', 'elbow', 'knee', 'clinchKnee', 'takedown'],
  },
  wrestler: {
    id: 'wrestler', label: 'Wrestler',
    desc: 'Queda, controle, ground and pound. Ninguém te tira do chão.',
    bonusAttrs: ['wrestling', 'takedowns', 'takedownDefense', 'strength'],
    evolutionRate: { striking: 0.8, grappling: 1.4, physical: 1.2, mental: 0.9 },
    matchup: { advantage: ['boxer'], disadvantage: ['muayThai', 'bjj'] },
    stylePerkId: 'groundAndPound',
    poolMoves: ['jab', 'cross', 'takedown', 'singleLeg', 'doubleLeg', 'slam', 'groundAndPound'],
  },
  bjj: {
    id: 'bjj', label: 'BJJ',
    desc: 'Finalização letal. Do guard à montada, você tem o golpe.',
    bonusAttrs: ['bjj', 'submissionOffense', 'submissionDefense', 'groundControl'],
    evolutionRate: { striking: 0.7, grappling: 1.5, physical: 0.9, mental: 1.1 },
    matchup: { advantage: ['wrestler'], disadvantage: ['boxer'] },
    stylePerkId: 'berimbolo',
    poolMoves: ['takedown', 'groundAndPound', 'armbar', 'guillotine', 'rearNaked', 'triangle'],
  },
  freestyle: {
    id: 'freestyle', label: 'Freestyle',
    desc: 'Versátil. Sem especialidade, sem fraqueza.',
    bonusAttrs: ['fightIQ', 'adaptability'],
    evolutionRate: { striking: 1.0, grappling: 1.0, physical: 1.0, mental: 1.3 },
    matchup: { advantage: [], disadvantage: [] },
    stylePerkId: 'versatility',
    poolMoves: ['jab', 'cross', 'hook', 'uppercut', 'legKick', 'lowKick', 'takedown', 'singleLeg', 'armbar', 'rearNaked', 'groundAndPound'],
  },
};

export const STYLE_SWITCH_CONFIG = {
  LOCK_WEEKS: 4,
  COST: 500,
};
```

- [ ] **Step 2: Adicionar MOVES**

```js
export const MOVES = {
  jab:         { name: 'Jab',     type: 'strike',     baseAttr: 'boxing',             staminaCost: 3,  damage: 1.0, tags: ['quick', 'range'] },
  cross:       { name: 'Cross',   type: 'strike',     baseAttr: 'boxing',             staminaCost: 5,  damage: 1.4, tags: ['power', 'range'] },
  hook:        { name: 'Hook',    type: 'strike',     baseAttr: 'power',              staminaCost: 6,  damage: 1.6, tags: ['power', 'close'] },
  uppercut:    { name: 'Uppercut',type: 'strike',     baseAttr: 'power',              staminaCost: 6,  damage: 1.5, tags: ['power', 'close'] },
  overhand:    { name: 'Overhand',type: 'strike',     baseAttr: 'power',              staminaCost: 7,  damage: 1.8, tags: ['power', 'risky'] },
  bodyShot:    { name: 'Body Shot',type: 'strike',    baseAttr: 'cardio',             staminaCost: 4,  damage: 1.0, tags: ['body', 'setup'] },
  legKick:     { name: 'Leg Kick', type: 'strike',    baseAttr: 'kickboxing',         staminaCost: 4,  damage: 0.8, tags: ['range', 'body'] },
  lowKick:     { name: 'Low Kick', type: 'strike',    baseAttr: 'kickboxing',         staminaCost: 5,  damage: 1.0, tags: ['range', 'cripple'] },
  headKick:    { name: 'Head Kick',type: 'strike',    baseAttr: 'kickboxing',         staminaCost: 8,  damage: 2.0, tags: ['power', 'risky'] },
  elbow:       { name: 'Cotovelada',type: 'strike',   baseAttr: 'muayThai',           staminaCost: 6,  damage: 1.7, tags: ['power', 'close', 'cut'] },
  knee:        { name: 'Joelhada',type: 'strike',     baseAttr: 'muayThai',           staminaCost: 5,  damage: 1.5, tags: ['power', 'close'] },
  clinchKnee:  { name: 'Clinch Knee',type: 'strike',  baseAttr: 'muayThai',           staminaCost: 4,  damage: 1.3, tags: ['clinch', 'body'] },
  takedown:    { name: 'Queda',   type: 'takedown',   baseAttr: 'takedowns',          staminaCost: 6,  damage: 0,   tags: ['grappling'] },
  singleLeg:   { name: 'Single Leg',type: 'takedown', baseAttr: 'takedowns',          staminaCost: 7,  damage: 0,   tags: ['grappling', 'speed'] },
  doubleLeg:   { name: 'Double Leg',type: 'takedown', baseAttr: 'takedowns',          staminaCost: 8,  damage: 0,   tags: ['grappling', 'power'] },
  slam:        { name: 'Slam',    type: 'takedown',   baseAttr: 'strength',           staminaCost: 9,  damage: 1.2, tags: ['grappling', 'power'] },
  armbar:      { name: 'Armbar',  type: 'submission', baseAttr: 'submissionOffense',  staminaCost: 7,  damage: 0,   tags: ['submission'] },
  guillotine:  { name: 'Guilhotina',type: 'submission',baseAttr: 'submissionOffense', staminaCost: 7,  damage: 0,   tags: ['submission'] },
  rearNaked:   { name: 'Mata-Leão',type: 'submission',baseAttr: 'submissionOffense',  staminaCost: 6,  damage: 0,   tags: ['submission'] },
  triangle:    { name: 'Triângulo',type: 'submission',baseAttr: 'submissionOffense',  staminaCost: 8,  damage: 0,   tags: ['submission', 'guard'] },
  groundAndPound: { name: 'Ground and Pound', type: 'strike', baseAttr: 'power',      staminaCost: 5,  damage: 1.3, tags: ['ground'] },
};
```

- [ ] **Step 3: Adicionar PERKS**

```js
export const PERKS = {
  fastHands: {
    id: 'fastHands', name: 'Mão Rápida', category: 'striking',
    desc: 'Combinações de 2+ golpes gastam 15% menos stamina',
    requirements: { attrs: { speed: 50 }, style: null, level: 1, perks: [] },
    effect: { type: 'stamina_combo_reduction', value: 0.85 },
  },
  heavyHands: {
    id: 'heavyHands', name: 'Pé Pesado', category: 'striking',
    desc: 'Dano de power golpes +10%',
    requirements: { attrs: { power: 60 }, style: null, level: 2, perks: [] },
    effect: { type: 'power_multiplier', value: 1.10 },
  },
  lightningJab: {
    id: 'lightningJab', name: 'Jab de Raios', category: 'striking',
    desc: 'Jab gasta 20% menos stamina e acerta 10% mais',
    requirements: { attrs: { boxing: 50, speed: 45 }, style: null, level: 1, perks: [] },
    effect: { type: 'move_buff', moveId: 'jab', staminaMult: 0.80, damageMult: 1.10 },
  },
  crossRespect: {
    id: 'crossRespect', name: 'Cruzado de Respeito', category: 'striking',
    desc: 'Cross tem +15% de chance de knockdown',
    requirements: { attrs: { boxing: 65, power: 55 }, style: 'boxer', level: 3, perks: ['heavyHands'] },
    effect: { type: 'move_buff', moveId: 'cross', kdChanceBonus: 0.15 },
  },
  comboLightning: {
    id: 'comboLightning', name: 'Combinação Relâmpago', category: 'striking',
    desc: 'Combos de 3+ golpes têm +20% de velocidade',
    requirements: { attrs: { boxing: 70, speed: 60 }, style: null, level: 4, perks: ['fastHands', 'heavyHands'] },
    effect: { type: 'stamina_combo_reduction', value: 0.70 },
  },
  knockoutArtist: {
    id: 'knockoutArtist', name: 'Nocauteador', category: 'striking',
    desc: '+8% chance de KO quando oponente está atordoado',
    requirements: { attrs: { power: 70 }, style: null, level: 5, perks: ['heavyHands', 'crossRespect'] },
    effect: { type: 'ko_chance_bonus', value: 0.08 },
  },
  bornFinisher: {
    id: 'bornFinisher', name: 'Finalizador Nato', category: 'grappling',
    desc: 'Finalizações no ground têm +12% de chance de sucesso',
    requirements: { attrs: { submissionOffense: 55, groundControl: 50 }, style: null, level: 2, perks: [] },
    effect: { type: 'submission_chance_mult', value: 1.12 },
  },
  iceOnGround: {
    id: 'iceOnGround', name: 'Gelo no Chão', category: 'grappling',
    desc: 'Nunca é finalizado quando está cansado (stamina < 30)',
    requirements: { attrs: { submissionDefense: 60, composure: 50 }, style: null, level: 3, perks: [] },
    effect: { type: 'never_submitted_low_stamina', value: true },
  },
  suffocatingPressure: {
    id: 'suffocatingPressure', name: 'Pressão Sufocante', category: 'grappling',
    desc: 'Ground control drena 20% mais stamina do oponente',
    requirements: { attrs: { wrestling: 60, groundControl: 55 }, style: null, level: 3, perks: [] },
    effect: { type: 'ground_stamina_drain_mult', value: 1.20 },
  },
  ironBody: {
    id: 'ironBody', name: 'Corpo de Ferro', category: 'physical',
    desc: 'Dano físico recebido -8%',
    requirements: { attrs: { durability: 60, strength: 50 }, style: null, level: 2, perks: [] },
    effect: { type: 'damage_taken_reduction', value: 0.92 },
  },
  warTank: {
    id: 'warTank', name: 'Tanque de Guerra', category: 'physical',
    desc: 'Cardio regenera 10% entre rounds (em vez de cair)',
    requirements: { attrs: { cardio: 65, recovery: 55 }, style: null, level: 3, perks: ['ironBody'] },
    effect: { type: 'cardio_regeneration', value: 0.10 },
  },
  endlessGas: {
    id: 'endlessGas', name: 'Fôlego Infinito', category: 'physical',
    desc: 'Stamina decai 15% menos por round',
    requirements: { attrs: { cardio: 70, recovery: 65 }, style: null, level: 4, perks: ['warTank'] },
    effect: { type: 'stamina_decay_reduction', value: 0.85 },
  },
  coldCalculator: {
    id: 'coldCalculator', name: 'Frio Calculista', category: 'mental',
    desc: 'Composure +10% em rounds de decisão (3o/5o round)',
    requirements: { attrs: { composure: 55, fightIQ: 55 }, style: null, level: 2, perks: [] },
    effect: { type: 'composure_late_rounds', value: 1.10 },
  },
  killerInstinct: {
    id: 'killerInstinct', name: 'Instinto Assassino', category: 'mental',
    desc: '+10% striking nos 2 minutos finais de cada round',
    requirements: { attrs: { aggression: 60, composure: 50 }, style: null, level: 3, perks: [] },
    effect: { type: 'striking_late_round', value: 1.10 },
  },
  lionsHeart: {
    id: 'lionsHeart', name: 'Coração de Leão', category: 'mental',
    desc: 'Se perder, morale cai 50% menos',
    requirements: { attrs: { determination: 40 }, style: null, level: 2, perks: [] },
    effect: { type: 'morale_loss_reduction', value: 0.50 },
  },
  eightWeapons: {
    id: 'eightWeapons', name: 'Oito Armas', category: 'style',
    desc: 'Joelhada e cotovelada no clinch têm +15% de dano',
    requirements: { attrs: {}, style: 'muayThai', level: 1, perks: [] },
    effect: { type: 'style_perk', moveBonus: { elbow: 1.15, knee: 1.15, clinchKnee: 1.15 } },
  },
  groundAndPound: {
    id: 'groundAndPound', name: 'Ground and Pound', category: 'style',
    desc: 'Ground strikes têm +15% de dano e +10% knockdown chance',
    requirements: { attrs: {}, style: 'wrestler', level: 1, perks: [] },
    effect: { type: 'style_perk', moveBonus: { groundAndPound: 1.15 }, kdChanceBonus: 0.10 },
  },
  berimbolo: {
    id: 'berimbolo', name: 'Berimbolo', category: 'style',
    desc: 'Tentativas de finalização têm +12% de chance a partir do round 2',
    requirements: { attrs: {}, style: 'bjj', level: 1, perks: [] },
    effect: { type: 'style_perk', subChanceLateRounds: 0.12 },
  },
  versatility: {
    id: 'versatility', name: 'Versatilidade', category: 'style',
    desc: '10% de chance de anular vantagem de estilo do oponente',
    requirements: { attrs: {}, style: 'freestyle', level: 1, perks: [] },
    effect: { type: 'style_perk', nullifyMatchupChance: 0.10 },
  },
};
```

- [ ] **Step 4: Adicionar LEVEL_CONFIG**

```js
export const LEVEL_CONFIG = {
  XP_PER_LEVEL: 100,
  XP_PER_FIGHT: 20,
  XP_PER_WIN_BONUS: 10,
  XP_PER_WEEK_TRAINED: 5,
  PERK_POINT_PER_LEVEL: 1,
  PERK_POINT_EVERY_N_LEVELS: 3,
  PERK_POINT_MILESTONES: {
    firstWin: 1,
    fiveWins: 1,
    firstTitleShot: 1,
    firstBelt: 2,
    firstDefense: 1,
  },
  MAX_LEVEL: 50,
};
```

- [ ] **Step 5: Verificar**

Abra o jogo no navegador. Abra o console. Digite:
```js
const cfg = await import('/js/config/game-config.js');
console.log(cfg.FIGHTING_STYLES, cfg.MOVES, cfg.PERKS, cfg.LEVEL_CONFIG);
```
Cada objeto deve aparecer sem erros.

---

## Task 2: Fighter Model — Novos Campos

**Files:**
- Modify: `js/models/fighter.js`

**Interfaces:**
- Consumes: `LEVEL_CONFIG` de game-config.js
- Produces: Fighter com `style`, `moveset[]`, `moveProficiency{}`, `level`, `xp`, `perkPoints`, `perks[]` + getters/setters

- [ ] **Step 1: Adicionar import**

Em `js/models/fighter.js`, depois de `import { DNA_DISCOVERY_CONFIG } from '../config/game-config.js';` (linha 3), adicione:

```js
import { LEVEL_CONFIG } from '../config/game-config.js';
```

- [ ] **Step 2: Adicionar campos no constructor**

Depois de `this.pcDoneForOfferId = data.pcDoneForOfferId || null;` (linha 127), antes do `}`:

```js
    this.style = data.style || 'freestyle';
    this.moveset = data.moveset || [];
    this.moveProficiency = data.moveProficiency || {};
    this.styleLockedUntilAbsWeek = data.styleLockedUntilAbsWeek || 0;
    this.level = data.level || 1;
    this.xp = data.xp || 0;
    this.perkPoints = data.perkPoints || 0;
    this.perks = data.perks || [];
```

- [ ] **Step 3: Adicionar métodos auxiliares**

Antes de `}` final da classe (antes da linha 477), adicione:

```js
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
      if (gained % LEVEL_CONFIG.PERK_POINT_EVERY_N_LEVELS === 0) {
        this.perkPoints++;
      }
    }
    if (this.level >= LEVEL_CONFIG.MAX_LEVEL) this.xp = 0;
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
    for (const [attr, min] of Object.entries(req.attrs)) {
      if ((this.attributes[attr] || 0) < min) return false;
    }
    for (const pre of req.perks) {
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
```

- [ ] **Step 4: Verificar no console**

Carregue o jogo. No console:
```js
const { default: app } = await import('/js/app.js');
const f = app.gameController.playerFighter;
console.log(f.style, f.moveset, f.level, f.perks, f.perkPoints);
```
Não deve dar erro de referência.

---

## Task 3: Style Service

**Files:**
- Create: `js/services/style-service.js`

**Interfaces:**
- Produces: `StyleService.resolveFighter(fighter) → FightProfile`, `resolveMatchup(pA, pB) → {bonusA, bonusB}`, `randomStyle()`, `randomMoveset(styleId, count)`

- [ ] **Step 1: Criar o arquivo**

```js
// js/services/style-service.js
import { FIGHTING_STYLES, MOVES, PERKS } from '../config/game-config.js';

export class StyleService {
  static resolveFighter(fighter) {
    const style = FIGHTING_STYLES[fighter.style] || FIGHTING_STYLES.freestyle;
    const activePerks = fighter.perks.map(id => PERKS[id]).filter(Boolean);

    const mods = {
      powerMultiplier: 1,
      staminaComboReduction: 1,
      koChanceBonus: 0,
      submissionChanceMult: 1,
      damageTakenReduction: 1,
      groundStaminaDrainMult: 1,
      staminaDecayReduction: 1,
      composureLateRounds: 1,
      strikingLateRound: 1,
      moraleLossReduction: 1,
      neverSubmittedLowStamina: false,
      moveBuffs: {},
      kdChanceBonus: 0,
      subChanceLateRounds: 0,
      nullifyMatchupChance: 0,
      cardioRegeneration: 0,
    };

    for (const perk of activePerks) {
      const e = perk.effect;
      switch (e.type) {
        case 'power_multiplier': mods.powerMultiplier *= e.value; break;
        case 'stamina_combo_reduction': mods.staminaComboReduction = Math.min(mods.staminaComboReduction, e.value); break;
        case 'ko_chance_bonus': mods.koChanceBonus += e.value; break;
        case 'submission_chance_mult': mods.submissionChanceMult *= e.value; break;
        case 'damage_taken_reduction': mods.damageTakenReduction *= e.value; break;
        case 'ground_stamina_drain_mult': mods.groundStaminaDrainMult *= e.value; break;
        case 'stamina_decay_reduction': mods.staminaDecayReduction *= e.value; break;
        case 'composure_late_rounds': mods.composureLateRounds *= e.value; break;
        case 'striking_late_round': mods.strikingLateRound *= e.value; break;
        case 'morale_loss_reduction': mods.moraleLossReduction = Math.min(mods.moraleLossReduction, e.value); break;
        case 'never_submitted_low_stamina': mods.neverSubmittedLowStamina = true; break;
        case 'cardio_regeneration': mods.cardioRegeneration = Math.max(mods.cardioRegeneration, e.value); break;
        case 'move_buff':
          mods.moveBuffs[e.moveId] = mods.moveBuffs[e.moveId] || {};
          if (e.staminaMult) mods.moveBuffs[e.moveId].staminaMult = e.staminaMult;
          if (e.damageMult) mods.moveBuffs[e.moveId].damageMult = e.damageMult;
          if (e.kdChanceBonus) mods.moveBuffs[e.moveId].kdChanceBonus = (mods.moveBuffs[e.moveId].kdChanceBonus || 0) + e.kdChanceBonus;
          break;
        case 'style_perk':
          if (e.moveBonus) {
            for (const [moveId, mult] of Object.entries(e.moveBonus)) {
              mods.moveBuffs[moveId] = mods.moveBuffs[moveId] || {};
              mods.moveBuffs[moveId].damageMult = (mods.moveBuffs[moveId].damageMult || 1) * mult;
            }
          }
          if (e.kdChanceBonus) mods.kdChanceBonus += e.kdChanceBonus;
          if (e.subChanceLateRounds) mods.subChanceLateRounds = Math.max(mods.subChanceLateRounds, e.subChanceLateRounds);
          if (e.nullifyMatchupChance) mods.nullifyMatchupChance = Math.max(mods.nullifyMatchupChance, e.nullifyMatchupChance);
          break;
      }
    }

    const moveData = {};
    for (const moveId of fighter.moveset) {
      const def = MOVES[moveId];
      if (!def) continue;
      const prof = fighter.getMoveProficiency(moveId);
      const buff = mods.moveBuffs[moveId] || {};
      moveData[moveId] = {
        def,
        proficiency: prof,
        damageMult: (1 + prof / 200) * (buff.damageMult || 1),
        staminaMult: (1 - prof / 300) * (buff.staminaMult || 1),
        kdChanceBonus: (buff.kdChanceBonus || 0) + mods.kdChanceBonus,
      };
    }

    return {
      styleId: fighter.style,
      style,
      matchupAdvantage: style.matchup.advantage,
      matchupDisadvantage: style.matchup.disadvantage,
      evolutionRate: style.evolutionRate,
      moveData,
      perks: fighter.perks,
      mods,
    };
  }

  static resolveMatchup(profileA, profileB) {
    let bonusA = 0, bonusB = 0;

    if (profileA.mods.nullifyMatchupChance > 0 && Math.random() < profileA.mods.nullifyMatchupChance) {
      return { bonusA: 0, bonusB: 0 };
    }
    if (profileB.mods.nullifyMatchupChance > 0 && Math.random() < profileB.mods.nullifyMatchupChance) {
      return { bonusA: 0, bonusB: 0 };
    }

    if (profileA.matchupAdvantage.includes(profileB.styleId)) bonusA = 3;
    else if (profileA.matchupDisadvantage.includes(profileB.styleId)) bonusA = -2;

    if (profileB.matchupAdvantage.includes(profileA.styleId)) bonusB = 3;
    else if (profileB.matchupDisadvantage.includes(profileA.styleId)) bonusB = -2;

    return { bonusA, bonusB };
  }

  static randomStyle() {
    const keys = Object.keys(FIGHTING_STYLES);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  static randomMoveset(styleId, count = 6) {
    const style = FIGHTING_STYLES[styleId];
    if (!style) return [];
    const shuffled = [...style.poolMoves].sort(() => Math.random() - 0.5);
    const moveset = [];
    const hasTD = style.poolMoves.some(m => MOVES[m]?.type === 'takedown');
    const tdMove = style.poolMoves.find(m => MOVES[m]?.type === 'takedown');
    if (hasTD && tdMove) moveset.push(tdMove);
    for (const m of shuffled) {
      if (moveset.length >= count) break;
      if (!moveset.includes(m)) moveset.push(m);
    }
    return moveset;
  }
}
```

- [ ] **Step 2: Verificar**

No console:
```js
const { StyleService } = await import('/js/services/style-service.js');
console.log(StyleService.randomStyle());
console.log(StyleService.randomMoveset('boxer', 4));
```

---

## Task 4: Simulação — Integração com FightProfile

**Files:**
- Modify: `js/controllers/simulation.js`

- [ ] **Step 1: Adicionar import**

Depois de `import { clamp } from '../utils/helpers.js';`:

```js
import { StyleService } from '../services/style-service.js';
```

- [ ] **Step 2: Resolver FightProfile no início de simulateFight**

Em `simulateFight()`, na linha 70 (`const maxRounds = fiveRounds ? 5 : 3;`), ANTES dela adicione:

```js
    const profileA = StyleService.resolveFighter(fighterA);
    const profileB = StyleService.resolveFighter(fighterB);
    const matchup = StyleService.resolveMatchup(profileA, profileB);
```

- [ ] **Step 3: Modificar linhas 114-115 (stamina decay)**

Substitua:
```js
const staminaFactorA = Math.max(10, staminaA * (1 - (r - 1) * 0.12) - staminaDebtA);
const staminaFactorB = Math.max(10, staminaB * (1 - (r - 1) * 0.12) - staminaDebtB);
```
Por:
```js
const staminaDecayA = (profileA?.mods.staminaDecayReduction || 1);
const staminaDecayB = (profileB?.mods.staminaDecayReduction || 1);
const staminaFactorA = Math.max(10, staminaA * (1 - (r - 1) * 0.12 * staminaDecayA) - staminaDebtA);
const staminaFactorB = Math.max(10, staminaB * (1 - (r - 1) * 0.12 * staminaDecayB) - staminaDebtB);
```

- [ ] **Step 4: Passar profiles para _calcRoundPerformance**

Linha 117 vira:
```js
const perfA = this._calcRoundPerformance(fighterA, fighterB, pressureLevel, staminaFactorA, cornerModA, plan, planEdge, profileA, matchup.bonusA);
```

Linha 118 vira:
```js
const perfB = this._calcRoundPerformance(fighterB, fighterA, pressureLevel, staminaFactorB, null, planB, planEdgeB, profileB, matchup.bonusB);
```

- [ ] **Step 5: Modificar assinatura de _calcRoundPerformance**

Linha 371, mude de:
```js
static _calcRoundPerformance(fighter, opponent, pressureLevel, staminaFactor, cornerMod = null, plan = null, planEdge = 0) {
```
Para:
```js
static _calcRoundPerformance(fighter, opponent, pressureLevel, staminaFactor, cornerMod = null, plan = null, planEdge = 0, profile = null, matchupBonus = 0) {
```

- [ ] **Step 6: Usar profile dentro de _calcRoundPerformance**

Dentro de `_calcRoundPerformance`, ANTES de `const fatiguePenalty` (linha 374), adicione:

```js
    const prof = profile || StyleService.resolveFighter(fighter);
    const mods = prof.mods;
```

Substitua `const styleAdvantage = this._styleMatchup(fighter, opponent);` (linha 425) por:

```js
    const styleAdvantage = matchupBonus;
```

- [ ] **Step 7: Passar profiles para _genRoundStats**

Modifique a assinatura de `_genRoundStats` (linha 477):
```js
static _genRoundStats(fighterA, fighterB, perfA, perfB, round, profileA = null, profileB = null) {
```

Modifique a chamada (linha 125):
```js
const roundStats = this._genRoundStats(fighterA, fighterB, perfA, perfB, r, profileA, profileB);
```

- [ ] **Step 8: Aplicar kdChanceBonus em _genRoundStats**

Modifique as linhas 494-495 de:
```js
const kdChanceA = Math.max(0, (perfA.striking - perfB.striking) * 0.02 * powerFactorA - 0.1 + Math.random() * 0.08);
const kdChanceB = Math.max(0, (perfB.striking - perfA.striking) * 0.02 * powerFactorB - 0.1 + Math.random() * 0.08);
```
Para:
```js
const kdBonusA = (profileA?.mods.kdChanceBonus || 0);
const kdBonusB = (profileB?.mods.kdChanceBonus || 0);
const kdChanceA = Math.max(0, (perfA.striking - perfB.striking) * 0.02 * powerFactorA - 0.1 + Math.random() * 0.08 + kdBonusA);
const kdChanceB = Math.max(0, (perfB.striking - perfA.striking) * 0.02 * powerFactorB - 0.1 + Math.random() * 0.08 + kdBonusB);
```

- [ ] **Step 9: Verificar**

Carregue o jogo, inicie um save, avance semanas até ter uma luta. O jogo não deve crashar. `profileA` e `profileB` devem ser resolvidos sem erro.

---

## Task 5: Game Controller — XP

**Files:**
- Modify: `js/controllers/game-controller.js`

- [ ] **Step 1: Adicionar XP semanal em processWeek**

Dentro de `processWeek()`, localize a seção onde o lutador do jogador é obtido (procure por `playerFighter`). Após `_applyWeeklyTraining`, adicione:

```js
    if (playerFighter) {
      playerFighter.addXP(LEVEL_CONFIG.XP_PER_WEEK_TRAINED);
    }
```

- [ ] **Step 2: Adicionar XP por luta**

Dentro de `processWeek()`, na seção onde o resultado da luta do jogador é processado, adicione:

```js
    if (result && result.winnerId) {
      const xpGain = LEVEL_CONFIG.XP_PER_FIGHT + (result.winnerId === playerFighter.id ? LEVEL_CONFIG.XP_PER_WIN_BONUS : 0);
      playerFighter.addXP(xpGain);
    }
```

- [ ] **Step 3: Adicionar import**

No topo, se não houver:
```js
import { LEVEL_CONFIG } from '../config/game-config.js';
```

---

## Task 6: Training Camp — Proficiência

**Files:**
- Modify: `js/controllers/training-camp.js`

- [ ] **Step 1: Adicionar ganho de proficiência**

Localize onde o camp aplica ganhos de atributos. Após aplicar os ganhos, adicione:

```js
    if (fighter.moveset && fighter.moveset.length > 0) {
      const profGain = { light: 1, moderate: 2, intense: 3 }[campConfig.intensity] || 1;
      const shuffled = [...fighter.moveset].sort(() => Math.random() - 0.5);
      const count = Math.min(2, shuffled.length);
      for (let i = 0; i < count; i++) {
        fighter.gainProficiency(shuffled[i], profGain);
      }
    }
```

---

## Task 7: Data Generator — IA Fighters

**Files:**
- Modify: `js/services/data-generator.js`

- [ ] **Step 1: Importar StyleService**

```js
import { StyleService } from './style-service.js';
```

- [ ] **Step 2: Atribuir estilo + moveset na criação**

Na função que cria lutadores, após definir atributos e antes do return:

```js
    fighter.style = StyleService.randomStyle();
    fighter.moveset = StyleService.randomMoveset(fighter.style, 6);
```

---

## Task 8: Tape Service — Estilo é Público

**Files:**
- Modify: `js/services/tape-service.js`

- [ ] **Step 1: Importar FIGHTING_STYLES**

```js
import { FIGHTING_STYLES } from '../config/game-config.js';
```

- [ ] **Step 2: Adicionar estilo ao tapeOf()**

Dentro do objeto retornado por `tapeOf()`:

```js
    style: fighter.style,
    styleLabel: FIGHTING_STYLES[fighter.style]?.label || 'Freestyle',
```

---

## Task 9: View — Fighter Profile (Estilo + Moveset)

**Files:**
- Modify: `js/views/fighter-profile.js`

- [ ] **Step 1: Adicionar seção de estilo e moveset**

No método de render, após exibir os atributos, construa e adicione:

```js
const style = FIGHTING_STYLES[fighter.style] || FIGHTING_STYLES.freestyle;
html += `
  <div class="fighter-custom-section">
    <h3>Estilo de Luta: ${style.label}</h3>
    <p>${style.desc}</p>
    <div class="style-bonuses">
      ${style.bonusAttrs.map(a => `<span class="badge badge-info">${a}</span>`).join(' ')}
    </div>
    <div class="moveset-section">
      <h4>Moveset (${fighter.moveset.length}/${fighter.getMaxMoves()})</h4>
      <div class="moveset-grid">
        ${fighter.moveset.map(moveId => {
          const move = MOVES[moveId];
          const prof = fighter.getMoveProficiency(moveId);
          return `<div class="move-card">
            <span>${move?.name || moveId}</span>
            <div class="progress-bar"><div style="width:${prof}%"></div></div>
            <span>${Math.round(prof)}%</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
```

- [ ] **Step 2: Adicionar import**

```js
import { FIGHTING_STYLES, MOVES, PERKS, STYLE_SWITCH_CONFIG } from '../config/game-config.js';
```

---

## Task 10: View — Fighter Profile (Perks)

**Files:**
- Modify: `js/views/fighter-profile.js`

- [ ] **Step 1: Adicionar seção de perks**

Após a seção de moveset:

```js
html += `
  <div class="perks-section">
    <h3>Perks (${fighter.perkPoints} pontos restantes)</h3>
    <div class="perk-teia">
      ${Object.entries(PERKS).map(([id, perk]) => {
        const owned = fighter.hasPerk(id);
        const canLearn = fighter.canLearnPerk(id);
        const classes = ['perk-node'];
        if (owned) classes.push('owned');
        else if (canLearn && fighter.perkPoints > 0) classes.push('available');
        else classes.push('locked');
        return `<div class="${classes.join(' ')}" data-perk-id="${id}">
          <strong>${perk.name}</strong>
          <small>${perk.desc}</small>
          ${!owned && canLearn && fighter.perkPoints > 0
            ? '<button class="btn btn-sm btn-success btn-learn-perk">Aprender</button>'
            : ''}
          ${owned ? '<span class="badge badge-success">Ativo</span>' : ''}
        </div>`;
      }).join('')}
    </div>
  </div>`;
```

- [ ] **Step 2: Event listener**

```js
this.container.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-learn-perk');
  if (!btn) return;
  const node = btn.closest('.perk-node');
  const perkId = node.dataset.perkId;
  if (fighter.learnPerk(perkId)) {
    this.render();
  }
});
```

---

## Task 11: View — Dashboard (Nível + Estilo)

**Files:**
- Modify: `js/views/dashboard.js`

- [ ] **Step 1: Importar FIGHTING_STYLES**

```js
import { FIGHTING_STYLES } from '../config/game-config.js';
```

- [ ] **Step 2: Adicionar estilo + nível no card**

No card do lutador, após o nome:

```js
const style = FIGHTING_STYLES[fighter.style] || FIGHTING_STYLES.freestyle;
const xpPct = Math.round(fighter.xpProgress * 100);
html += `
  <div class="d-flex align-items-center gap-2 mt-1">
    <span class="badge bg-primary">Nv.${fighter.level}</span>
    <span class="badge bg-secondary">${style.label}</span>
    <div class="flex-grow-1"><div class="progress" style="height:6px">
      <div class="progress-bar" style="width:${xpPct}%"></div>
    </div></div>
    <small>${xpPct}%</small>
  </div>`;
```

---

## Task 12: View — Training Camp (Foco em Golpe)

**Files:**
- Modify: `js/views/training-camp.js`

- [ ] **Step 1: Importar MOVES**

```js
import { MOVES } from '../config/game-config.js';
```

- [ ] **Step 2: Adicionar seletor de foco**

No formulário de configuração do camp:

```js
if (fighter.moveset && fighter.moveset.length > 0) {
  html += `
    <div class="mb-2">
      <label>Foco em golpe específico:</label>
      <select class="form-select" id="camp-proficiency-focus">
        <option value="">Nenhum (distribuído)</option>
        ${fighter.moveset.map(moveId => {
          const move = MOVES[moveId];
          const prof = fighter.getMoveProficiency(moveId);
          return `<option value="${moveId}">${move?.name || moveId} (${Math.round(prof)}%)</option>`;
        }).join('')}
      </select>
    </div>`;
}
```

---

## Self-Review Checklist

1. **Spec coverage:** Todos os elementos do spec estão cobertos — FIGHTING_STYLES (Task 1), MOVES (Task 1), PERKS (Task 1), LEVEL_CONFIG (Task 1), Fighter fields (Task 2), StyleService (Task 3), Simulation hooks (Task 4), XP system (Task 5), Camp proficiency (Task 6), AI fighters (Task 7), Tape (Task 8), UI (Tasks 9-12). Nenhum gap.

2. **No placeholders:** Todo passo tem código real e verificável.

3. **Type consistency:** `fighter.style` é string consistente entre Fighter model, StyleService, e views. `FightProfile.mods` shape consistente entre resolveFighter() e simulation. `PERKS[].effect.type` consistente entre config e o switch em resolveFighter().

4. **Scope:** Apenas fighter customization. Sem refactors além do necessário.
