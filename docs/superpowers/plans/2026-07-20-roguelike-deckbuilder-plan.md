# Roguelike Deckbuilder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the MMA Manager from a passive simulation into an active card-combat roguelike where the player plays cards each turn of a fight.

**Architecture:** Three phases. Phase 1 builds the core turn-based combat engine with positions, cards, cooldowns, and a basic AI — producing a playable fight. Phase 2 adds card acquisition (training rewards, fight rewards) and meta-progression (global pool, perks). Phase 3 adds corner/coach skills and deeper AI via the Tape Service.

**Tech Stack:** Vanilla JS (ES Modules), no framework. CSS for card UI. IndexedDB for cross-run persistence.

## Global Constraints

- All existing game systems NOT mentioned in the spec remain untouched (academies, offers, promotions, injuries, popularity, social media, rivalries)
- The old `simulation.js` is replaced, not modified — the new combat engine sits in a new file, the old one is deleted after Phase 3
- The return shape of `simulateFight()` must remain compatible with `world-service.js` usage (see Architecture)
- OVR/lutador attributes remain the damage anchor — cards scale with fighter stats, never replace them
- Cooldown: active cards have cooldown in turns, basic cards have unlimited uses per fight, specials have limited uses

---
## Phase 1 — Core Combat Engine

This phase produces a playable fight from start to finish. The player has a hardcoded loadout (no card acquisition yet). Fights use the new turn-based card system.

### File Structure

**New files:**
- `js/config/card-config.js` — Card definitions (ACTIVE_CARDS, PASSIVE_CARDS, POSITIONS)
- `js/controllers/combat-engine.js` — Turn loop, round management, state machine
- `js/controllers/combat-resolver.js` — Card execution, damage calc, movement, position transitions
- `js/controllers/ai-combat.js` — AI card selection logic
- `js/views/card-combat-view.js` — UI: card hand, position tracker, action buttons
- `js/controllers/combat-adapter.js` — Adapter between new combat engine and old world-service API

**Modified files:**
- `js/app.js` — Wire new combat flow
- `js/views/events.js` — Update corner UI to show position
- `css/components.css` — Card UI styles
- `css/main.css` — Combat layout styles

### Task 1: Card Config — Data Definitions

**Files:**
- Create: `js/config/card-config.js`

**Interfaces:**
- Produces: `POSITIONS`, `POSITION_TRANSITIONS`, `ACTIVE_CARDS`, `PASSIVE_CARDS`, `DEFAULT_LOADOUTS`, `getDefaultLoadout(gamePlanKey)` — all exported constants and helpers

- [ ] **Step 1: Define position constants**

```js
// js/config/card-config.js
export const POSITIONS = {
  DISTANCE: 'distance',
  RANGE: 'range',
  CLINCH: 'clinch',
  GROUND_TOP: 'groundTop',
  GROUND_GUARD: 'groundGuard',
};

// Which positions you can move to manually (costs 1 action)
export const POSITION_TRANSITIONS = {
  [POSITIONS.DISTANCE]: [POSITIONS.RANGE],
  [POSITIONS.RANGE]: [POSITIONS.DISTANCE, POSITIONS.CLINCH],
  [POSITIONS.CLINCH]: [POSITIONS.RANGE, POSITIONS.GROUND_TOP, POSITIONS.GROUND_GUARD],
  [POSITIONS.GROUND_TOP]: [POSITIONS.CLINCH, POSITIONS.GROUND_GUARD],
  [POSITIONS.GROUND_GUARD]: [POSITIONS.CLINCH, POSITIONS.GROUND_TOP],
};
```

- [ ] **Step 2: Define active cards**

```js
export const ACTIVE_CARDS = {
  jab: {
    id: 'jab',
    name: 'Jab',
    type: 'strike',
    description: 'Golpe rápido e direto',
    positions: [POSITIONS.RANGE],
    moveTo: null,         // no movement
    cooldown: 1,
    maxUses: Infinity,
    baseDamage: 15,
    damageAttrs: { boxing: 0.7, speed: 0.3 },
    tags: ['light', 'fast'],
  },
  cross: {
    id: 'cross',
    name: 'Cruz',
    type: 'strike',
    description: 'Soco reto de trás, potente',
    positions: [POSITIONS.RANGE],
    moveTo: null,
    cooldown: 2,
    maxUses: Infinity,
    baseDamage: 25,
    damageAttrs: { boxing: 0.6, power: 0.4 },
    tags: ['heavy', 'power'],
  },
  overhand: {
    id: 'overhand',
    name: 'Overhand',
    type: 'strike',
    description: 'Soco curvado que fecha distância',
    positions: [POSITIONS.DISTANCE],
    moveTo: POSITIONS.RANGE,
    cooldown: 3,
    maxUses: 3,
    baseDamage: 35,
    damageAttrs: { boxing: 0.4, power: 0.6 },
    tags: ['heavy', 'engage', 'power'],
  },
  highKick: {
    id: 'highKick',
    name: 'Chute Alto',
    type: 'strike',
    description: 'Chute na cabeça, alto risco',
    positions: [POSITIONS.DISTANCE, POSITIONS.RANGE],
    moveTo: null,
    cooldown: 3,
    maxUses: 3,
    baseDamage: 40,
    damageAttrs: { kickboxing: 0.5, power: 0.3, speed: 0.2 },
    tags: ['heavy', 'risky'],
  },
  doubleLeg: {
    id: 'doubleLeg',
    name: 'Queda Dupla',
    type: 'takedown',
    description: 'Fechada dupla, leva ao chão',
    positions: [POSITIONS.RANGE],
    moveTo: POSITIONS.GROUND_TOP,
    cooldown: 3,
    maxUses: 2,
    baseDamage: 0,
    damageAttrs: { wrestling: 0.6, strength: 0.4 },
    tags: ['engage', 'grappling'],
  },
  takedownDefense: {
    id: 'takedownDefense',
    name: 'Defesa de Queda',
    type: 'defense',
    description: 'Bloqueia tentativa de queda',
    positions: [POSITIONS.RANGE, POSITIONS.CLINCH, POSITIONS.DISTANCE],
    moveTo: null,
    cooldown: 1,
    maxUses: Infinity,
    baseDamage: 0,
    damageAttrs: { wrestling: 0.5, takedownDefense: 0.5 },
    tags: ['defense', 'grappling'],
  },
  // Specials — limited use
  rearNaked: {
    id: 'rearNaked',
    name: 'Mata-leão',
    type: 'submission',
    description: 'Finalização pelas costas',
    positions: [POSITIONS.GROUND_TOP],
    moveTo: null,
    cooldown: 4,
    maxUses: 2,
    baseDamage: 100,
    damageAttrs: { bjj: 0.6, submissionOffense: 0.4 },
    tags: ['submission', 'finish'],
  },
  clinchKnee: {
    id: 'clinchKnee',
    name: 'Joelhada no Clinch',
    type: 'strike',
    description: 'Joelhada curta no clinch',
    positions: [POSITIONS.CLINCH],
    moveTo: null,
    cooldown: 2,
    maxUses: Infinity,
    baseDamage: 20,
    damageAttrs: { muayThai: 0.6, strength: 0.4 },
    tags: ['closeRange'],
  },
  legKick: {
    id: 'legKick',
    name: 'Chute na Perna',
    type: 'strike',
    description: 'Diminui a mobilidade do oponente',
    positions: [POSITIONS.DISTANCE, POSITIONS.RANGE],
    moveTo: null,
    cooldown: 2,
    maxUses: Infinity,
    baseDamage: 12,
    damageAttrs: { kickboxing: 0.5, power: 0.3, speed: 0.2 },
    tags: ['light', 'debuff'],
  },
  singleLeg: {
    id: 'singleLeg',
    name: 'Queda de Uma Perna',
    type: 'takedown',
    description: 'Queda rápida de uma perna',
    positions: [POSITIONS.RANGE],
    moveTo: POSITIONS.GROUND_TOP,
    cooldown: 2,
    maxUses: 3,
    baseDamage: 0,
    damageAttrs: { wrestling: 0.5, speed: 0.5 },
    tags: ['engage', 'grappling'],
  },
  elbowStrike: {
    id: 'elbowStrike',
    name: 'Cotovelada',
    type: 'strike',
    description: 'Corte profundo, alto dano',
    positions: [POSITIONS.CLINCH, POSITIONS.GROUND_TOP],
    moveTo: null,
    cooldown: 3,
    maxUses: 3,
    baseDamage: 30,
    damageAttrs: { muayThai: 0.5, power: 0.5 },
    tags: ['heavy', 'cut'],
  },
  groundAndPound: {
    id: 'groundAndPound',
    name: 'Ground and Pound',
    type: 'strike',
    description: 'Socos no chão',
    positions: [POSITIONS.GROUND_TOP],
    moveTo: null,
    cooldown: 2,
    maxUses: Infinity,
    baseDamage: 22,
    damageAttrs: { boxing: 0.3, power: 0.4, wrestling: 0.3 },
    tags: ['ground'],
  },
  armbar: {
    id: 'armbar',
    name: 'Chave de Braço',
    type: 'submission',
    description: 'Finalização de braço',
    positions: [POSITIONS.GROUND_TOP, POSITIONS.GROUND_GUARD],
    moveTo: null,
    cooldown: 4,
    maxUses: 1,
    baseDamage: 100,
    damageAttrs: { bjj: 0.7, submissionOffense: 0.3 },
    tags: ['submission', 'finish'],
  },
};
```

- [ ] **Step 3: Define passive cards**

```js
export const PASSIVE_CARDS = {
  heavyHands: {
    id: 'heavyHands',
    name: 'Mão Pesada',
    description: '+15% dano em golpes de poder',
    type: 'passive',
    effect: { type: 'damageMult', tags: ['power'], value: 0.15 },
  },
  solidBase: {
    id: 'solidBase',
    name: 'Base Sólida',
    description: '+20% defesa de queda quando em Alcance',
    type: 'passive',
    effect: { type: 'takedownDefenseBonus', position: POSITIONS.RANGE, value: 0.20 },
  },
  bloodCold: {
    id: 'bloodCold',
    name: 'Sangue Frio',
    description: '-1 cooldown nas cartas especiais quando perdendo',
    type: 'passive',
    effect: { type: 'cooldownReductionLoser', value: 1 },
  },
  dirtyFight: {
    id: 'dirtyFight',
    name: 'Jogo Sujo',
    description: '+25% chance de penalidade no oponente',
    type: 'passive',
    effect: { type: 'foulChance', value: 0.25 },
  },
  student: {
    id: 'student',
    name: 'Estudioso',
    description: 'No primeiro turno, revela carta do oponente',
    type: 'passive',
    effect: { type: 'revealFirstTurn' },
  },
  marathon: {
    id: 'marathon',
    name: 'Maratona',
    description: '-10% fadiga por round',
    type: 'passive',
    effect: { type: 'fatigueReduction', value: 0.10 },
  },
};
```

- [ ] **Step 4: Define default loadouts per game plan**

```js
export const DEFAULT_LOADOUTS = {
  striker: {
    active: ['jab', 'cross', 'overhand', 'highKick', 'legKick'],
    passive: ['heavyHands'],
  },
  grappler: {
    active: ['jab', 'doubleLeg', 'singleLeg', 'clinchKnee', 'takedownDefense'],
    passive: ['solidBase'],
  },
  pressure: {
    active: ['jab', 'cross', 'overhand', 'clinchKnee', 'groundAndPound'],
    passive: ['marathon'],
  },
  patient: {
    active: ['jab', 'cross', 'takedownDefense', 'legKick', 'elbowStrike'],
    passive: ['student'],
  },
  balanced: {
    active: ['jab', 'cross', 'doubleLeg', 'takedownDefense', 'legKick'],
    passive: ['solidBase'],
  },
};

export function getDefaultLoadout(gamePlanKey) {
  return DEFAULT_LOADOUTS[gamePlanKey] || DEFAULT_LOADOUTS.balanced;
}
```

- [ ] **Step 5: Commit**

```bash
git add js/config/card-config.js
git commit -m "feat: card config with positions, active cards, passive cards, and default loadouts"
```

### Task 2: Combat State Machine — Turn Loop and Round Management

**Files:**
- Create: `js/controllers/combat-engine.js`

**Interfaces:**
- Consumes: `ACTIVE_CARDS`, `PASSIVE_CARDS`, `POSITIONS`, `POSITION_TRANSITIONS`, `getDefaultLoadout()` from `card-config.js`
- Produces: `class CombatEngine` with `startFight(fighterA, fighterB, fiveRounds, loadoutA, loadoutB)` → `async generator` or callback-based loop

- [ ] **Step 1: Create CombatEngine class with fight setup**

The engine manages:
- Fighters and their attributes
- Positions (each fighter has a position, starts at DISTANCE)
- Cooldown tracking per card
- Uses remaining per card (for specials)
- Turn counter, round counter
- Score tracking (10-point must)
- Stamina tracking
- Loadouts (active cards + passive cards)

```js
// js/controllers/combat-engine.js
import { ACTIVE_CARDS, PASSIVE_CARDS, POSITIONS, POSITION_TRANSITIONS } from '../config/card-config.js';

export class CombatEngine {
  constructor() {
    this.state = null;
  }

  _initState(fighterA, fighterB, fiveRounds, loadoutA, loadoutB) {
    const maxRounds = fiveRounds ? 5 : 3;
    return {
      fighterA: { ref: fighterA, position: POSITIONS.DISTANCE, stamina: 100 },
      fighterB: { ref: fighterB, position: POSITIONS.DISTANCE, stamina: 100 },
      maxRounds,
      currentRound: 0,
      roundTurn: 0,
      maxTurnsPerRound: 4, // 3-5; fixed at 4 for now
      turnOwner: 'A', // 'A' or 'B' — who acts this turn
      currentTurn: 0, // total turns in fight
      ended: false,
      winner: null,
      loser: null,
      finishMethod: null,
      finishRound: 0,
      isDraw: false,
      rounds: [],
      roundScores: [], // [{ scoreA, scoreB }] — cumulative per round
      cooldownsA: {},  // { cardId: remainingTurns }
      cooldownsB: {},
      usesA: {},       // { cardId: usesRemaining }
      usesB: {},
      turnLog: [],     // all actions taken this fight
      // Passive effects
      passivesA: (loadoutA.passive || []).map(id => PASSIVE_CARDS[id]).filter(Boolean),
      passivesB: (loadoutB.passive || []).map(id => PASSIVE_CARDS[id]).filter(Boolean),
      // Active card IDs
      activesA: loadoutA.active || [],
      activesB: loadoutB.active || [],
      staminaDebtA: 0,
      staminaDebtB: 0,
    };
  }
}
```

- [ ] **Step 2: Implement turn loop**

```js
  *runFight(fighterA, fighterB, fiveRounds, loadoutA, loadoutB) {
    this.state = this._initState(fighterA, fighterB, fiveRounds, loadoutA, loadoutB);
    const s = this.state;

    for (let r = 1; r <= s.maxRounds; r++) {
      if (s.ended) break;
      s.currentRound = r;
      s.roundTurn = 0;

      // Stamina decay at round start
      if (r > 1) {
        s.fighterA.stamina = Math.max(15, s.fighterA.stamina - 10);
        s.fighterB.stamina = Math.max(15, s.fighterB.stamina - 10);
      }

      // Reset turn alternation: player (A) always starts each round
      s.turnOwner = 'A';

      while (s.roundTurn < s.maxTurnsPerRound && !s.ended) {
        s.roundTurn++;
        s.currentTurn++;
        this._tickCooldowns(s.turnOwner === 'A' ? s.cooldownsA : s.cooldownsB);
        yield { type: 'turn', round: r, turn: s.roundTurn, owner: s.turnOwner };
      }

      // Round end — score the round
      if (!s.ended) {
        yield { type: 'roundEnd', round: r };
      }
    }

    // Fight end — decision
    if (!s.ended) {
      this._computeDecision();
    }

    return this._buildResult();
  }
```

- [ ] **Step 3: Implement cooldown ticking, playCard, and move actions**

```js
  _tickCooldowns(cooldowns) {
    for (const cardId of Object.keys(cooldowns)) {
      if (cooldowns[cardId] > 0) {
        cooldowns[cardId]--;
      }
      if (cooldowns[cardId] <= 0) {
        delete cooldowns[cardId];
      }
    }
  }

  getAvailableCards(state, side) {
    const actives = side === 'A' ? state.activesA : state.activesB;
    const cooldowns = side === 'A' ? state.cooldownsA : state.cooldownsB;
    const uses = side === 'A' ? state.usesA : state.usesB;
    const fighter = side === 'A' ? state.fighterA : state.fighterB;

    return actives
      .map(id => {
        const card = ACTIVE_CARDS[id];
        if (!card) return null;
        // Check cooldown
        if ((cooldowns[id] || 0) > 0) return null;
        // Check uses remaining
        const remaining = uses[id];
        if (remaining !== undefined && remaining <= 0) return null;
        // Check position requirement
        if (!card.positions.includes(fighter.position)) return null;
        return { card, remaining };
      })
      .filter(Boolean);
  }

  playCard(side, cardId) {
    const s = this.state;
    const card = ACTIVE_CARDS[cardId];
    if (!card) return { error: 'unknownCard' };

    const fighter = side === 'A' ? s.fighterA : s.fighterB;
    const cooldowns = side === 'A' ? s.cooldownsA : s.cooldownsB;
    const uses = side === 'A' ? s.usesA : s.usesB;

    // Validate position
    if (!card.positions.includes(fighter.position)) {
      return { error: 'wrongPosition', required: card.positions, current: fighter.position };
    }

    // Validate cooldown
    if ((cooldowns[cardId] || 0) > 0) {
      return { error: 'cooldown', remaining: cooldowns[cardId] };
    }

    // Validate uses
    const remaining = uses[cardId];
    if (remaining !== undefined && remaining <= 0) {
      return { error: 'noUses' };
    }

    // Apply cooldown
    cooldowns[cardId] = card.cooldown;

    // Track uses for limited cards
    if (card.maxUses !== Infinity) {
      uses[cardId] = (uses[cardId] ?? card.maxUses) - 1;
    }

    // Handle movement
    if (card.moveTo) {
      fighter.position = card.moveTo;
    }

    s.turnLog.push({ round: s.currentRound, turn: s.currentTurn, side, cardId });
    return { success: true, card };
  }

  moveManual(side, targetPosition) {
    const s = this.state;
    const fighter = side === 'A' ? s.fighterA : s.fighterB;
    const allowed = POSITION_TRANSITIONS[fighter.position];
    if (!allowed || !allowed.includes(targetPosition)) {
      return { error: 'invalidTransition', from: fighter.position, to: targetPosition };
    }
    fighter.position = targetPosition;
    s.turnLog.push({ round: s.currentRound, turn: s.currentTurn, side, move: targetPosition });
    return { success: true };
  }
```

- [ ] **Step 4: Implement decision computation (10-point must)**

```js
  _addRoundScore(scoreA, scoreB) {
    this.state.roundScores.push({ scoreA, scoreB });
  }

  _computeDecision() {
    const s = this.state;
    const totalA = s.roundScores.reduce((sum, rd) => sum + rd.scoreA, 0);
    const totalB = s.roundScores.reduce((sum, rd) => sum + rd.scoreB, 0);

    // Simulate 3 judges
    const scorecards = [0, 1, 2].map(() => {
      let a = 0, b = 0;
      for (const rd of s.roundScores) {
        a += rd.scoreA;
        b += rd.scoreB;
      }
      return { a, b };
    });

    const votesA = scorecards.filter(j => j.a > j.b).length;
    const votesB = scorecards.filter(j => j.b > j.a).length;

    if (votesA >= 2 || votesB >= 2) {
      const aWins = votesA >= 2;
      s.winner = aWins ? s.fighterA.ref : s.fighterB.ref;
      s.loser = s.winner === s.fighterA.ref ? s.fighterB.ref : s.fighterA.ref;
      s.finishMethod = votesA === 3 || votesB === 3 ? 'Decision (Unanimous)' : 'Decision (Split)';
    } else {
      s.isDraw = true;
      s.finishMethod = 'Decision (Draw)';
    }
    s.finishRound = s.maxRounds;
  }
```

- [ ] **Step 5: Build result object (matching old simulateFight return shape)**

```js
  _buildResult() {
    const s = this.state;
    const method = this._methodString(s.finishMethod);
    return {
      id: null,
      fighterAId: s.fighterA.ref.id,
      fighterBId: s.fighterB.ref.id,
      fighterAName: s.fighterA.ref.name,
      fighterBName: s.fighterB.ref.name,
      winnerId: s.isDraw ? null : s.winner.id,
      winnerName: s.isDraw ? null : s.winner.name,
      loserId: s.isDraw ? null : s.loser.id,
      loserName: s.isDraw ? null : s.loser.name,
      isDraw: s.isDraw,
      method,
      round: s.finishRound,
      eventId: null,
      date: null,
      stats: {
        sigStrikesA: 0, sigStrikesB: 0,
        knockdownsA: 0, knockdownsB: 0,
        takedownsA: 0, takedownsB: 0,
        subAttemptsA: 0, subAttemptsB: 0,
        controlTimeA: 0, controlTimeB: 0,
      },
      rounds: s.roundScores.map((rd, i) => ({
        round: i + 1,
        scoreA: rd.scoreA,
        scoreB: rd.scoreB,
        finished: false,
        roundLog: [],
        moments: [],
      })),
      totalScoreA: s.roundScores.reduce((sum, rd) => sum + rd.scoreA, 0),
      totalScoreB: s.roundScores.reduce((sum, rd) => sum + rd.scoreB, 0),
      scorecards: null,
      _cardTurnLog: s.turnLog, // internal — for card UI replay
    };
  }
```

- [ ] **Step 6: Commit**

```bash
git add js/controllers/combat-engine.js
git commit -m "feat: combat engine with turn loop, positions, cooldowns, and card play"
```

### Task 3: Card Resolver — Damage Calculation and Finish Checks

**Files:**
- Create: `js/controllers/combat-resolver.js`

**Interfaces:**
- Consumes: `ACTIVE_CARDS`, `PASSIVE_CARDS` from `card-config.js`, `CombatEngine` state
- Produces: `class CombatResolver` with `resolveTurn(state, cardA, cardB)`, `resolveFinish(state, round)`

- [ ] **Step 1: Create CombatResolver with damage calculation**

```js
// js/controllers/combat-resolver.js
import { ACTIVE_CARDS, PASSIVE_CARDS } from '../config/card-config.js';

export class CombatResolver {
  // Calculate damage from a card based on fighter attributes
  static calcCardDamage(card, fighter) {
    const attr = fighter.attributes || {};
    let damageMult = 0;
    for (const [attrName, weight] of Object.entries(card.damageAttrs)) {
      damageMult += (attr[attrName] ?? 50) / 100 * weight;
    }
    return card.baseDamage * Math.max(0.1, damageMult);
  }

  // Apply passive card effects to damage
  static applyPassiveDamageMods(rawDamage, card, passives) {
    let modified = rawDamage;
    for (const passive of passives) {
      if (passive.effect.type === 'damageMult' && card.tags) {
        const tagMatch = passive.effect.tags.some(t => card.tags.includes(t));
        if (tagMatch) {
          modified *= (1 + passive.effect.value);
        }
      }
    }
    return modified;
  }
}
```

- [ ] **Step 2: Implement turn resolution (A plays card, B plays card, compare)**

```js
  static resolveTurn(state, cardIdA, cardIdB) {
    const cardA = ACTIVE_CARDS[cardIdA];
    const cardB = ACTIVE_CARDS[cardIdB];
    if (!cardA || !cardB) return { error: 'invalid cards' };

    const fighterA = state.fighterA;
    const fighterB = state.fighterB;

    // Calculate damage
    const rawDamageA = this.calcCardDamage(cardA, fighterA.ref);
    const rawDamageB = this.calcCardDamage(cardB, fighterB.ref);

    const damageA = this.applyPassiveDamageMods(rawDamageA, cardA, state.passivesA);
    const damageB = this.applyPassiveDamageMods(rawDamageB, cardB, state.passivesB);

    // Apply stamina drain — using a card costs stamina
    const staminaCostA = this._staminaCost(cardA);
    const staminaCostB = this._staminaCost(cardB);
    fighterA.stamina = Math.max(0, fighterA.stamina - staminaCostA);
    fighterB.stamina = Math.max(0, fighterB.stamina - staminaCostB);

    // Determine who lands more effectively
    // Comparison: effective damage with stamina factor
    const staminaFactorA = fighterA.stamina / 100;
    const staminaFactorB = fighterB.stamina / 100;

    const effectiveA = damageA * staminaFactorA;
    const effectiveB = damageB * staminaFactorB;

    // Enhanced position bonus: certain positions give bonuses on certain card types
    const positionBonusA = this._positionBonus(fighterA.position, cardA);
    const positionBonusB = this._positionBonus(fighterB.position, cardB);

    const totalA = effectiveA * (1 + positionBonusA);
    const totalB = effectiveB * (1 + positionBonusB);

    // Apply stamina debt for aggressive cards
    state.staminaDebtA += (cardA.tags?.includes('heavy') ? 5 : 0);
    state.staminaDebtB += (cardB.tags?.includes('heavy') ? 5 : 0);

    return {
      cardA, cardB,
      rawDamageA, rawDamageB,
      damageA, damageB,
      effectiveA: totalA,
      effectiveB: totalB,
      winner: totalA >= totalB ? 'A' : 'B',
      margin: Math.abs(totalA - totalB),
    };
  }

  static _staminaCost(card) {
    if (card.tags?.includes('heavy')) return 8;
    if (card.tags?.includes('light')) return 3;
    if (card.type === 'submission') return 10;
    if (card.type === 'takedown') return 6;
    return 5;
  }

  static _positionBonus(position, card) {
    // Being in the right position for your card type gives a bonus
    if (card.type === 'strike' && (position === 'range' || position === 'clinch')) return 0.10;
    if (card.type === 'grappling' && (position === 'clinch' || position.startsWith('ground'))) return 0.10;
    if (card.type === 'takedown' && position === 'range') return 0.10;
    return 0;
  }
```

- [ ] **Step 3: Implement finish check (KO/TKO/Submission)**

```js
  static checkFinish(state, turnResult, round) {
    const margin = turnResult.margin;
    const fighterA = state.fighterA.ref;
    const fighterB = state.fighterB.ref;

    // Base finish chance increases with margin and round number
    const finishChance = Math.min(0.4, 0.02 + margin * 0.005 + round * 0.02);
    if (Math.random() > finishChance) return null;

    // Determine who gets finished
    const loserSide = turnResult.winner === 'A' ? 'B' : 'A';
    const winnerSide = turnResult.winner;
    const loser = loserSide === 'A' ? fighterA : fighterB;
    const winner = winnerSide === 'A' ? fighterA : fighterB;

    // Check loser's durability
    const chin = (loser.attributes?.chin ?? 50) / 100;
    const durability = (loser.attributes?.durability ?? 50) / 100;
    const toughness = (chin + durability) / 2;

    // Determine finish method
    let method = null;
    if (turnResult.margin > 30 && toughness < 0.6) {
      method = 'KO';
    } else if (turnResult.margin > 20) {
      method = 'TKO';
    } else if (turnResult.cardA?.type === 'submission' || turnResult.cardB?.type === 'submission') {
      const subOff = (winner.attributes?.submissionOffense ?? 50) / 100;
      const subDef = (loser.attributes?.submissionDefense ?? 50) / 100;
      if (subOff > subDef && Math.random() < 0.3) {
        method = 'Submission';
      }
    }

    if (method) {
      state.ended = true;
      state.winner = winner;
      state.loser = loser;
      state.finishMethod = method;
      state.finishRound = round;
    }

    return method ? { winner, loser, method } : null;
  }
```

- [ ] **Step 4: Implement 10-point must scoring for a round**

```js
  static scoreRound(roundTurns) {
    // Each turn has a winner. Count who won more turns.
    const winsA = roundTurns.filter(t => t.winner === 'A').length;
    const winsB = roundTurns.filter(t => t.winner === 'B').length;

    // Also factor in effective damage margin for dominance
    const totalEffectiveA = roundTurns.reduce((sum, t) => sum + t.effectiveA, 0);
    const totalEffectiveB = roundTurns.reduce((sum, t) => sum + t.effectiveB, 0);
    const effDiff = totalEffectiveA - totalEffectiveB;
    const margin = Math.abs(effDiff);

    // 10-point must
    let scoreA = 10, scoreB = 9; // A wins round by default
    if (winsB > winsA) {
      scoreA = 9; scoreB = 10; // B wins round
    }
    if (winsA === winsB) {
      scoreA = 10; scoreB = 10; // even round
    }

    // Dominance adjustment
    if (margin > 40) {
      if (effDiff > 0) scoreB = 8; // 10-8 round
      else scoreA = 8;
    }
    if (margin > 70) {
      if (effDiff > 0) scoreB = 7; // 10-7 round
      else scoreA = 7;
    }

    return { scoreA, scoreB, margin, totalEffectiveA, totalEffectiveB };
  }
```

- [ ] **Step 5: Commit**

```bash
git add js/controllers/combat-resolver.js
git commit -m "feat: combat resolver with damage calculation, finish checks, and scoring"
```

### Task 4: Basic AI Card Selection

**Files:**
- Create: `js/controllers/ai-combat.js`

**Interfaces:**
- Consumes: `ACTIVE_CARDS`, `POSITIONS` from `card-config.js`, `CombatEngine.getAvailableCards()`
- Produces: `class AICombat` with `selectCard(state, side, difficulty)` → `{ cardId, type }` and `selectMoveAction(state, side)` → `targetPosition | null`

- [ ] **Step 1: Create AICombat class with basic card selection**

The AI selects cards based on simple heuristics:
- If at distance → prefer engage cards (overhand, doubleLeg, singleLeg)
- If at range → prefer strikes
- If in clinch → prefer clinchKnee or takedowns
- If on ground top → prefer groundAndPound or submission
- Random-weighted, weighted by card effectiveness

```js
// js/controllers/ai-combat.js
import { ACTIVE_CARDS, POSITIONS } from '../config/card-config.js';

export class AICombat {
  // Select a card for the AI to play
  static selectCard(availableCards, state, opponentAvailableCards) {
    if (!availableCards.length) return null;

    const fighter = state.fighterB; // AI is always side B
    const position = fighter.position;

    // Prioritize cards based on position
    const allCards = availableCards.map(ac => ac.card);
    const positionCards = allCards.filter(c => c.positions.includes(position));

    if (positionCards.length === 0 && allCards.length > 0) {
      // Shouldn't happen if available cards are already filtered, but fallback
      return allCards[Math.floor(Math.random() * allCards.length)];
    }

    // Weight by damage and type
    let weighted = positionCards.map(c => {
      let weight = c.baseDamage + 10;
      // Prefer engage cards when far
      if (position === POSITIONS.DISTANCE && c.moveTo) weight *= 1.5;
      // Prefer submissions on ground
      if (position === POSITIONS.GROUND_TOP && c.type === 'submission') weight *= 1.3;
      // Prefer finish attempts late
      if (c.type === 'submission' || c.tags?.includes('heavy')) weight *= 1.2;
      // Always some randomness
      weight *= 0.5 + Math.random();
      return { card: c, weight };
    });

    const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
    let roll = Math.random() * totalWeight;
    const selected = weighted.find(w => { roll -= w.weight; return roll <= 0; });

    return selected ? selected.card : positionCards[0];
  }

  // Decide whether AI should move manually
  static selectMoveAction(availableCards, state) {
    const fighter = state.fighterB;
    const position = fighter.position;

    // If at distance and no engage card available, move to range
    if (position === POSITIONS.DISTANCE) {
      const hasEngage = availableCards.some(ac => ac.card.moveTo);
      if (!hasEngage) return POSITIONS.RANGE;
    }

    // If at range and opponent is grappler, try to keep distance
    const opponent = state.fighterA.ref;
    if (position === POSITIONS.RANGE && (opponent.style === 'wrestler' || opponent.style === 'bjj')) {
      // Stay at range, don't move
    }

    return null; // Don't move
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/controllers/ai-combat.js
git commit -m "feat: basic AI combat card selection with position-based heuristics"
```

### Task 5: Combat UI — Card Hand, Position Tracker, Action Buttons

**Files:**
- Create: `js/views/card-combat-view.js`
- Modify: `css/components.css`, `css/main.css`

**Interfaces:**
- Consumes: `CombatEngine` state, `ACTIVE_CARDS` from `card-config.js`
- Produces: Renders DOM elements for the combat UI. Exports `renderCombatView(container, engineState, onCardPlay, onMove, onPass)`, `updateCombatView(container, engineState)`

- [ ] **Step 1: Create card-combat-view.js with render functions**

```js
// js/views/card-combat-view.js
import { ACTIVE_CARDS, PASSIVE_CARDS, POSITIONS, POSITION_TRANSITIONS } from '../config/card-config.js';

export class CardCombatView {
  constructor() {
    this.handlers = null;
  }

  render(container, engineState, actions) {
    this.handlers = actions;
    container.innerHTML = `
      <div class="combat-container">
        <div class="combat-header">
          <div class="position-tracker">${this._renderPositionTracker(engineState)}</div>
          <div class="round-display">Round ${engineState.currentRound} / ${engineState.maxRounds}</div>
          <div class="stamina-display">
            <div class="stamina-bar">
              <label>${engineState.fighterA.ref.name}</label>
              <div class="stamina-fill" style="width:${engineState.fighterA.stamina}%"></div>
            </div>
            <div class="stamina-bar">
              <label>${engineState.fighterB.ref.name}</label>
              <div class="stamina-fill opponent" style="width:${engineState.fighterB.stamina}%"></div>
            </div>
          </div>
        </div>
        <div class="card-hand">
          ${this._renderCardHand(engineState, 'A')}
        </div>
        <div class="action-bar">
          ${this._renderActionButtons(engineState)}
        </div>
        <div class="turn-result hidden"></div>
        <div class="turn-log">
          ${this._renderTurnLog(engineState)}
        </div>
      </div>
    `;

    // Bind card click events
    container.querySelectorAll('.card-item:not(.disabled)').forEach(el => {
      el.addEventListener('click', () => {
        const cardId = el.dataset.cardId;
        if (this.handlers?.onCardPlay) this.handlers.onCardPlay(cardId);
      });
    });

    // Bind move buttons
    container.querySelectorAll('.move-btn').forEach(el => {
      el.addEventListener('click', () => {
        const pos = el.dataset.position;
        if (this.handlers?.onMove) this.handlers.onMove(pos);
      });
    });

    // Bind pass button
    const passBtn = container.querySelector('.pass-btn');
    if (passBtn) {
      passBtn.addEventListener('click', () => {
        if (this.handlers?.onPass) this.handlers.onPass();
      });
    }
  }

  _renderPositionTracker(state) {
    const posA = state.fighterA.position;
    const posB = state.fighterB.position;
    const posNames = {
      [POSITIONS.DISTANCE]: 'Distância',
      [POSITIONS.RANGE]: 'Alcance',
      [POSITIONS.CLINCH]: 'Clinch',
      [POSITIONS.GROUND_TOP]: 'Chão (Topo)',
      [POSITIONS.GROUND_GUARD]: 'Chão (Guarda)',
    };
    return `
      <div class="position-tracker-inner">
        <div class="position-tag player">${posNames[posA] || posA || 'Distância'}</div>
        <span class="position-vs">vs</span>
        <div class="position-tag opponent">${posNames[posB] || posB || 'Distância'}</div>
      </div>
    `;
  }

  _renderCardHand(state, side) {
    const actives = side === 'A' ? state.activesA : state.activesB;
    const cooldowns = side === 'A' ? state.cooldownsA : state.cooldownsB;
    const uses = side === 'A' ? state.usesA : state.usesB;
    const fighter = side === 'A' ? state.fighterA : state.fighterB;

    return actives.map(id => {
      const card = ACTIVE_CARDS[id];
      if (!card) return '';
      const onCooldown = (cooldowns[id] || 0) > 0;
      const remaining = uses[id];
      const noUses = remaining !== undefined && remaining <= 0;
      const wrongPos = !card.positions.includes(fighter.position);
      const disabled = onCooldown || noUses || wrongPos;
      const posNames = {
        [POSITIONS.DISTANCE]: 'Distância',
        [POSITIONS.RANGE]: 'Alcance',
        [POSITIONS.CLINCH]: 'Clinch',
        [POSITIONS.GROUND_TOP]: 'Topo',
        [POSITIONS.GROUND_GUARD]: 'Guarda',
      };

      return `
        <div class="card-item ${disabled ? 'disabled' : ''} ${card.type}" data-card-id="${card.id}">
          <div class="card-name">${card.name}</div>
          <div class="card-desc">${card.description}</div>
          <div class="card-meta">
            <span class="card-pos">${card.positions.map(p => posNames[p]).join('/')}</span>
            <span class="card-dmg">${card.baseDamage}</span>
            ${onCooldown ? `<span class="card-cd">CD:${cooldowns[id]}</span>` : ''}
            ${card.maxUses !== Infinity ? `<span class="card-uses">${remaining ?? card.maxUses}/${card.maxUses}</span>` : ''}
            ${card.moveTo ? `<span class="card-move">→ ${posNames[card.moveTo]}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  _renderActionButtons(state) {
    const fighter = state.fighterA;
    const allowed = POSITION_TRANSITIONS[fighter.position] || [];
    const posNames = {
      [POSITIONS.DISTANCE]: 'Avançar (Distância → Alcance)',
      [POSITIONS.RANGE]: 'Recuar (Alcance → Distância) / Clinch',
      [POSITIONS.CLINCH]: 'Sair (Clinch → Alcance) / Cair (Clinch → Chão)',
      [POSITIONS.GROUND_TOP]: 'Levantar (Chão → Clinch)',
      [POSITIONS.GROUND_GUARD]: 'Levantar (Chão → Clinch)',
    };
    // Show only valid transitions from current position
    return `
      <button class="pass-btn">Passar Turno</button>
      ${allowed.map(pos => `<button class="move-btn" data-position="${pos}">Ir para ${posNames[pos] || pos}</button>`).join('')}
    `;
  }

  _renderTurnLog(state) {
    const log = state.turnLog || [];
    const lastFew = log.slice(-6);
    return `
      <div class="turn-log-title">Ações</div>
      <div class="turn-log-entries">
        ${lastFew.map(entry => {
          const card = entry.cardId ? ACTIVE_CARDS[entry.cardId] : null;
          const text = card ? `${entry.side === 'A' ? 'Jogador' : 'IA'} usou ${card.name}` :
            entry.move ? `${entry.side === 'A' ? 'Jogador' : 'IA'} moveu para ${entry.move}` : '';
          return `<div class="turn-log-entry">${text}</div>`;
        }).join('')}
      </div>
    `;
  }

  update(container, engineState) {
    // Re-render the whole view — in Phase 2 optimize with targeted updates
    const actions = this.handlers;
    this.render(container, engineState, actions);
  }
}
```

- [ ] **Step 2: Add CSS for combat UI**

In `css/main.css`, add:

```css
.combat-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  max-width: 800px;
  margin: 0 auto;
}

.combat-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.position-tracker {
  text-align: center;
}

.position-tracker-inner {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm);
  background: var(--surface);
  border-radius: var(--radius);
}

.position-tag {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.85em;
}

.position-tag.player { background: var(--corner-red, #c0392b); color: white; }
.position-tag.opponent { background: var(--corner-blue, #2980b9); color: white; }
.position-vs { color: var(--text-muted); font-weight: 700; }

.stamina-display {
  display: flex;
  gap: var(--space-md);
}

.stamina-bar {
  flex: 1;
}

.stamina-bar label {
  font-size: 0.8em;
  margin-bottom: 2px;
  display: block;
}

.stamina-fill {
  height: 8px;
  background: var(--success, #27ae60);
  border-radius: 4px;
  transition: width 0.3s;
}

.stamina-fill.opponent { background: var(--corner-blue, #2980b9); }

.card-hand {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  justify-content: center;
}

.card-item {
  width: 140px;
  padding: var(--space-sm);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s;
  background: var(--surface);
  user-select: none;
}

.card-item:hover:not(.disabled) {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.card-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.card-item.strike { border-left: 3px solid var(--corner-red, #c0392b); }
.card-item.takedown { border-left: 3px solid var(--amber, #e67e22); }
.card-item.submission { border-left: 3px solid var(--gold, #f1c40f); }
.card-item.defense { border-left: 3px solid var(--corner-blue, #2980b9); }

.card-name {
  font-weight: 700;
  font-size: 0.95em;
  margin-bottom: 2px;
}

.card-desc {
  font-size: 0.75em;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 0.7em;
  color: var(--text-muted);
}

.card-cd { color: var(--warning, #e67e22); font-weight: 600; }
.card-uses { color: var(--corner-red, #c0392b); font-weight: 600; }
.card-move { color: var(--success, #27ae60); }

.action-bar {
  display: flex;
  gap: var(--space-sm);
  justify-content: center;
  flex-wrap: wrap;
}

.move-btn, .pass-btn {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  cursor: pointer;
  font-size: 0.85em;
  transition: background 0.15s;
}

.move-btn:hover, .pass-btn:hover {
  background: var(--accent);
  color: white;
}

.turn-result {
  text-align: center;
  padding: var(--space-sm);
  font-weight: 600;
  font-size: 0.85em;
}

.turn-result.hidden {
  display: none;
}

.turn-log {
  max-height: 120px;
  overflow-y: auto;
  font-size: 0.8em;
}

.turn-log-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.turn-log-entry {
  padding: 2px 0;
  border-bottom: 1px solid var(--border-alt, rgba(255,255,255,0.05));
}
```

- [ ] **Step 3: Commit**

```bash
git add js/views/card-combat-view.js css/main.css
git commit -m "feat: combat UI with card hand, position tracker, stamina bars, and action buttons"
```

### Task 6: Adapter and Integration — Wire New Combat into Existing Game

**Files:**
- Create: `js/controllers/combat-adapter.js`
- Modify: `js/app.js`, `js/views/events.js`

**Interfaces:**
- Consumes: `CombatEngine`, `CombatResolver`, `AICombat`, `CardCombatView`, `getDefaultLoadout()` from card-config
- Produces: `async function runCardFight(fighterA, fighterB, promo, gamePlanKey)` → returns result matching old `simulateFight()` shape

- [ ] **Step 1: Create CombatAdapter**

```js
// js/controllers/combat-adapter.js
import { CombatEngine } from './combat-engine.js';
import { CombatResolver } from './combat-resolver.js';
import { AICombat } from './ai-combat.js';
import { ACTIVE_CARDS, POSITIONS, getDefaultLoadout } from '../config/card-config.js';
import { CardCombatView } from '../views/card-combat-view.js';

export class CombatAdapter {
  constructor() {
    this.engine = new CombatEngine();
    this.view = new CardCombatView();
    this.container = null;
  }

  setContainer(container) {
    this.container = container;
  }

  async runFight(fighterA, fighterB, fiveRounds, gamePlanKey) {
    const loadoutA = getDefaultLoadout(gamePlanKey);
    const loadoutB = getDefaultLoadout('balanced'); // AI uses balanced for now

    const s = this.engine._initState(fighterA, fighterB, fiveRounds, loadoutA, loadoutB);
    const state = s;

    // Render initial state
    this.view.render(this.container, state, {
      onCardPlay: (cardId) => this._onPlayerCardSelected(cardId),
      onMove: (pos) => this._onPlayerMove(pos),
      onPass: () => this._onPlayerPass(),
    });

    const roundTurns = [];

    for (let r = 1; r <= state.maxRounds; r++) {
      if (state.ended) break;
      state.currentRound = r;
      state.roundTurn = 0;

      if (r > 1) {
        state.fighterA.stamina = Math.max(15, state.fighterA.stamina - 10);
        state.fighterB.stamina = Math.max(15, state.fighterB.stamina - 10);
      }

      state.turnOwner = 'A';

      while (state.roundTurn < state.maxTurnsPerRound && !state.ended) {
        state.roundTurn++;
        state.currentTurn++;

        // Tick cooldown for player (A) at start of their turn
        this.engine._tickCooldowns(state.cooldownsA);

        // PLAYER TURN (A): wait for card selection via UI
        this.view.update(this.container, state);
        const playerAction = await this._waitForPlayerAction(state);

        if (playerAction.type === 'card') {
          this.engine.playCard('A', playerAction.cardId);
        } else if (playerAction.type === 'move') {
          this.engine.moveManual('A', playerAction.position);
        }
        // 'pass' = do nothing

        // Tick cooldown for AI
        this.engine._tickCooldowns(state.cooldownsB);

        // AI TURN (B): AI selects card
        const availB = this.engine.getAvailableCards(state, 'B');
        const aiCard = AICombat.selectCard(availB, state, []);
        if (aiCard) {
          this.engine.playCard('B', aiCard.id);
        }

        // Resolve the turn: compare player's card vs AI's card
        // If player passed or moved (no card), use a basic fallback
        const cardA = playerAction.type === 'card' ? ACTIVE_CARDS[playerAction.cardId] : null;
        const cardB = aiCard || null;

        if (cardA && cardB) {
          const turnResult = CombatResolver.resolveTurn(state, cardA.id, cardB.id);
          roundTurns.push(turnResult);

          // Show turn result briefly
          this._showTurnResult(turnResult);

          // Check for finish
          const finish = CombatResolver.checkFinish(state, turnResult, r);
          if (finish) {
            state.ended = true;
            state.finishMethod = finish.method;
            break;
          }
        } else if (cardA && !cardB) {
          // Player attacked, AI had no card — player wins turn uncontested
          roundTurns.push({
            winner: 'A', margin: 30, effectiveA: 20, effectiveB: 0,
            cardA, cardB: null, damageA: 15, damageB: 0,
          });
        }

        state.turnOwner = state.turnOwner === 'A' ? 'B' : 'A';
      }

      // Score the round
      if (!state.ended && roundTurns.length > 0) {
        const roundScore = CombatResolver.scoreRound(roundTurns);
        state.roundScores.push(roundScore);
        roundTurns.length = 0; // reset for next round
      }
    }

    if (!state.ended) {
      this.engine._computeDecision();
    }

    return this.engine._buildResult();
  }

  // Promise-based wait for player to click a card/move/pass button
  _waitForPlayerAction(state) {
    return new Promise(resolve => {
      this._pendingAction = resolve;
      this.view.update(this.container, state);
    });
  }

  _onPlayerCardSelected(cardId) {
    if (this._pendingAction) {
      const resolve = this._pendingAction;
      this._pendingAction = null;
      resolve({ type: 'card', cardId });
    }
  }

  _onPlayerMove(position) {
    if (this._pendingAction) {
      const resolve = this._pendingAction;
      this._pendingAction = null;
      resolve({ type: 'move', position });
    }
  }

  _onPlayerPass() {
    if (this._pendingAction) {
      const resolve = this._pendingAction;
      this._pendingAction = null;
      resolve({ type: 'pass' });
    }
  }

  _showTurnResult(turnResult) {
    const el = this.container.querySelector('.turn-result');
    if (!el) return;
    const winner = turnResult.winner === 'A' ? 'Você' : 'Oponente';
    const cardA = turnResult.cardA?.name || 'nada';
    const cardB = turnResult.cardB?.name || 'nada';
    el.textContent = `Você jogou ${cardA} vs ${cardB} do oponente — ${winner} venceu o turno!`;
    el.classList.remove('hidden');
    // Brief flash, then clear
    setTimeout(() => el.classList.add('hidden'), 1500);
  }
}
```

- [ ] **Step 2: Wire into app.js**

In `js/app.js`, add a new path for card combat:

```js
// Near the top of app.js or in the processWeek handler
import { CombatAdapter } from './controllers/combat-adapter.js';

// In the appropriate method (e.g., around line 962 where cornerHooks is built):
// Replace or supplement the simulation call with the card combat version

// For now, add as a toggle — old simulation is default, card combat is opt-in:
async runCardFight(fighterA, fighterB, promo, gamePlanKey) {
  const adapter = new CombatAdapter();
  adapter.setContainer(document.getElementById('fight-container'));
  const fiveRounds = promo.tier === 1;
  return adapter.runFight(fighterA, fighterB, fiveRounds, gamePlanKey);
}
```

- [ ] **Step 3: Update events.js to show card combat intro**

In `js/views/events.js`, update `renderCornerFightIntro` or add a new export:

```js
export function renderCardFightIntro(container, fighterA, fighterB) {
  container.innerHTML = `
    <div class="fight-intro">
      <div class="fighter-card">
        <div class="fighter-name red">${fighterA.name}</div>
        <div class="fighter-record">${fighterA.record?.wins || 0}V ${fighterA.record?.losses || 0}D</div>
      </div>
      <div class="vs-badge">VS</div>
      <div class="fighter-card">
        <div class="fighter-name blue">${fighterB.name}</div>
        <div class="fighter-record">${fighterB.record?.wins || 0}V ${fighterB.record?.losses || 0}D</div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 4: Commit**

```bash
git add js/controllers/combat-adapter.js js/app.js js/views/events.js
git commit -m "feat: combat adapter wiring card combat into game flow"
```

### Task 7: Integration Test — Playable Fight End-to-End

**Files:**
- Modify: `js/app.js` — wire button/toggle to start card combat
- Test: Manual browser test or vitest test

- [ ] **Step 1: Add a temporary debug toggle in app.js**

```js
// In the developer/settings panel or hidden behind a URL param
// ?cardCombat=true enables the new system
if (new URLSearchParams(window.location.search).has('cardCombat')) {
  window.__useCardCombat = true;
}
```

This allows testing the new system without breaking existing game flow.

- [ ] **Step 2: Write vitest test for combat engine**

```js
// test/combat-engine.test.js
import { describe, it, expect } from 'vitest';
import { CombatEngine } from '../js/controllers/combat-engine.js';
import { CombatResolver } from '../js/controllers/combat-resolver.js';
import { AICombat } from '../js/controllers/ai-combat.js';
import { ACTIVE_CARDS, getDefaultLoadout } from '../js/config/card-config.js';

// Helper to create a minimal fighter
function createFighter(id, name, overrides = {}) {
  return {
    id,
    name,
    attributes: {
      boxing: 50, kickboxing: 50, muayThai: 50, wrestling: 50, bjj: 50,
      power: 50, speed: 50, strength: 50, durability: 50, recovery: 50,
      chin: 50, cardio: 50, fightIQ: 50,
      footwork: 50, headMovement: 50, clinch: 50,
      takedowns: 50, takedownDefense: 50, groundControl: 50,
      submissionOffense: 50, submissionDefense: 50,
      composure: 50, aggression: 50, adaptability: 50,
      ...overrides,
    },
    style: 'freestyle',
    record: { wins: 0, losses: 0, draws: 0 },
  };
}

describe('CombatEngine', () => {
  it('should initialize state correctly', () => {
    const engine = new CombatEngine();
    const fighterA = createFighter(1, 'Player');
    const fighterB = createFighter(2, 'Opponent');
    const loadout = getDefaultLoadout('balanced');

    const state = engine._initState(fighterA, fighterB, false, loadout, loadout);

    expect(state.fighterA.ref.id).toBe(1);
    expect(state.fighterB.ref.id).toBe(2);
    expect(state.maxRounds).toBe(3); // fiveRounds = false
    expect(state.fighterA.position).toBe('distance');
    expect(state.fighterA.stamina).toBe(100);
  });

  it('should load default loadout for striker game plan', () => {
    const loadout = getDefaultLoadout('striker');
    expect(loadout.active).toContain('jab');
    expect(loadout.active).toContain('cross');
    expect(loadout.active).toContain('overhand');
    expect(loadout.active).toContain('highKick');
  });
});

describe('CombatResolver', () => {
  it('should calculate damage based on fighter attributes', () => {
    const fighter = createFighter(1, 'Test', { boxing: 80, power: 70 });
    const card = ACTIVE_CARDS.cross;
    const damage = CombatResolver.calcCardDamage(card, fighter);
    // cross uses boxing*0.6 + power*0.4 = 80*0.6 + 70*0.4 = 48+28 = 76% of base
    expect(damage).toBeCloseTo(25 * 0.76, 1);
  });

  it('should score a round correctly', () => {
    const turns = [
      { winner: 'A', effectiveA: 50, effectiveB: 20, margin: 30, rawDamageA: 40, rawDamageB: 15, damageA: 45, damageB: 18 },
      { winner: 'A', effectiveA: 45, effectiveB: 25, margin: 20, rawDamageA: 35, rawDamageB: 20, damageA: 40, damageB: 22 },
      { winner: 'A', effectiveA: 55, effectiveB: 15, margin: 40, rawDamageA: 45, rawDamageB: 10, damageA: 50, damageB: 12 },
    ];
    const score = CombatResolver.scoreRound(turns);
    expect(score.scoreA).toBe(10);
    expect(score.scoreB).toBe(9);
  });
});

describe('AICombat', () => {
  it('should select a card from available pool', () => {
    const cards = [
      { card: ACTIVE_CARDS.jab, remaining: Infinity },
      { card: ACTIVE_CARDS.cross, remaining: Infinity },
    ];
    const selected = AICombat.selectCard(cards, {
      fighterB: { position: 'range', stamina: 100 },
    }, []);
    expect(selected).toBeTruthy();
    expect(selected.id).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run test/combat-engine.test.js
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add test/combat-engine.test.js
git commit -m "test: combat engine unit tests for init, damage, scoring, and AI"
```

---

## Phase 2 — Card Acquisition and Meta-Progression

This phase adds the ability to acquire cards through training and fight rewards, plus the cross-run pool and perks system.

### Task 8: Post-Fight Card Rewards

**Files:**
- Modify: `js/controllers/combat-adapter.js`
- Modify: `js/services/world-service.js` (or the post-fight handler)
- Create: `js/services/card-reward-service.js`

- [ ] **Step 1: Create card-reward-service.js**

```js
// js/services/card-reward-service.js
import { ACTIVE_CARDS, PASSIVE_CARDS } from '../config/card-config.js';

// Rarity pools based on promotion tier
const REWARD_POOLS = {
  1: { // Elite — best cards
    active: ['overhand', 'highKick', 'rearNaked', 'armbar', 'groundAndPound', 'elbowStrike'],
    passive: ['heavyHands', 'bloodCold', 'dirtyFight', 'student', 'marathon'],
    picks: 3,
  },
  2: { // National — medium cards
    active: ['doubleLeg', 'singleLeg', 'clinchKnee', 'elbowStrike', 'cross'],
    passive: ['solidBase', 'marathon', 'heavyHands'],
    picks: 3,
  },
  3: { // Regional — basic cards
    active: ['jab', 'cross', 'legKick', 'takedownDefense', 'singleLeg', 'clinchKnee'],
    passive: ['solidBase', 'marathon'],
    picks: 2,
  },
};

export class CardRewardService {
  static getRewardOptions(promoTier) {
    const pool = REWARD_POOLS[promoTier] || REWARD_POOLS[3];
    const actives = pool.active.map(id => ACTIVE_CARDS[id]).filter(Boolean);
    const passives = pool.passive.map(id => PASSIVE_CARDS[id]).filter(Boolean);

    // Shuffle and pick
    const shuffled = [...actives, ...passives].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, pool.picks);
  }

  static getTitleReward() {
    // Title fights give a special powerful card
    const titleCards = ['rearNaked', 'armbar', 'overhand'];
    const cardId = titleCards[Math.floor(Math.random() * titleCards.length)];
    return ACTIVE_CARDS[cardId];
  }
}
```

- [ ] **Step 2: Integrate reward selection into post-fight flow**

After a fight is resolved, show a card selection modal:

```js
async function showCardReward(container, options) {
  return new Promise(resolve => {
    container.innerHTML = `
      <div class="reward-modal">
        <h2>Recompensa</h2>
        <p>Escolha uma carta para adicionar ao seu pool:</p>
        <div class="reward-options">
          ${options.map((card, i) => `
            <button class="reward-card" data-index="${i}">
              <div class="reward-card-name">${card.name}</div>
              <div class="reward-card-desc">${card.description}</div>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    container.querySelectorAll('.reward-card').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index);
        resolve(options[idx]);
      });
    });
  });
}
```

- [ ] **Step 3: Update combat-adapter to return earned cards**

After `runFight`, if player won, return available reward options.

- [ ] **Step 4: Commit**

### Task 9: Training Camp Card Acquisition

**Files:**
- Modify: `js/controllers/training-camp.js`
- Modify: `js/views/training-camp.js`

- [ ] **Step 1: Add card focus option to training camp**

In the training camp view, add a "Card Focus" option that lets the player choose between:
- Attribute training (existing system)
- Card discovery (shows 2-3 cards from the academy's pool, player picks one to add to their loadout)

- [ ] **Step 2: Implement academy-specific card pools**

```js
const ACADEMY_CARD_POOLS = {
  // Academies have card pools based on their specialty
  'striking': { active: ['jab', 'cross', 'overhand', 'highKick', 'legKick'] },
  'grappling': { active: ['doubleLeg', 'singleLeg', 'clinchKnee', 'rearNaked', 'armbar'] },
  'balanced': { active: ['jab', 'cross', 'doubleLeg', 'takedownDefense', 'legKick'] },
};
```

- [ ] **Step 3: Wire card selection into loadout**

When a card is acquired, add it to the fighter's persistent card pool. The player can equip/unequip from their pool within slot limits.

- [ ] **Step 4: Commit**

### Task 10: Meta-Progressão — Global Pool and Perks

**Files:**
- Create: `js/services/meta-progression-service.js`

- [ ] **Step 1: Create MetaProgressionService**

```js
// js/services/meta-progression-service.js
export class MetaProgressionService {
  constructor(db) {
    this.db = db;
    this.globalPool = new Set(); // card IDs discovered across runs
    this.legacyPoints = 0;
    this.unlockedPerks = [];
  }

  async load() {
    // Load from IndexedDB
    const data = await this.db.get('metaProgression') || {};
    this.globalPool = new Set(data.globalPool || []);
    this.legacyPoints = data.legacyPoints || 0;
    this.unlockedPerks = data.perks || [];
  }

  async save() {
    await this.db.put('metaProgression', {
      globalPool: [...this.globalPool],
      legacyPoints: this.legacyPoints,
      perks: this.unlockedPerks,
    });
  }

  addToGlobalPool(cardId) {
    this.globalPool.add(cardId);
    this.save();
  }

  addLegacyPoints(points) {
    this.legacyPoints += points;
    this.save();
  }

  unlockPerk(perkId, cost) {
    if (this.legacyPoints < cost) return false;
    this.legacyPoints -= cost;
    this.unlockedPerks.push(perkId);
    this.save();
    return true;
  }

  getAvailableCards() {
    return [...this.globalPool];
  }
}
```

- [ ] **Step 2: Integrate legacy points from fight achievements**

After a fight ends, grant legacy points based on:
- Win: +10 points
- KO/Submission: +5 bonus
- Title win: +50 bonus

- [ ] **Step 3: Add perks screen between runs**

A simple screen showing available perks and their costs, with unlock buttons.

- [ ] **Step 4: Commit**

---

## Phase 3 — Corner/Coach Skills and Deeper AI

### Task 11: Corner Coach Skills

**Files:**
- Modify: `js/controllers/combat-adapter.js`
- Modify: `js/views/card-combat-view.js`
- Create: `js/config/coach-config.js`

- [ ] **Step 1: Define coach skills**

```js
export const COACH_SKILLS = {
  motivational: {
    name: 'Motivacional',
    description: 'Recupera 1 uso de carta especial',
    effect: { type: 'restoreSpecialUses', value: 1 },
  },
  strategist: {
    name: 'Estrategista',
    description: 'Revela posição do oponente no próximo round',
    effect: { type: 'revealPosition' },
  },
  finisher: {
    name: 'Finalizador',
    description: '+20% chance de finalização',
    effect: { type: 'finishChanceBonus', value: 0.20 },
  },
};
```

- [ ] **Step 2: Add corner phase between rounds in combat-engine**

After `yield { type: 'roundEnd' }`, the engine pauses for corner input. The coach skill is offered.

- [ ] **Step 3: Wire into UI and commit**

### Task 12: Tape Service Integration for AI

**Files:**
- Modify: `js/controllers/ai-combat.js`
- Modify: `js/services/tape-service.js`

- [ ] **Step 1: AI reads player's historical card usage**

The Tape Service already tracks game plans across fights. Extend it to track which card types the player favors. The AI can then counter: if player uses mostly strikes, AI uses takedown-defense-heavy loadout.

- [ ] **Step 2: AI loadout selection based on scouting**

```js
// In AICombat
static selectLoadout(state, tapeData) {
  if (!tapeData || tapeData.exposure < 30) {
    return getDefaultLoadout('balanced'); // Unknown player → balanced
  }

  // Counter player's favorite strategies
  if (tapeData.favoredPlan === 'striker') {
    return getDefaultLoadout('grappler'); // Counter striking with grappling
  }
  // etc.
}
```

- [ ] **Step 3: Commit and cleanup old simulation.js**

After verifying Phase 3 works, remove the old `js/controllers/simulation.js` and references.

---

> **Plan complete.** Execution options below.
