# Fase 1 — Melhorias de Alto Impacto — Plano de Implementação

> **Para workers:** Use superpowers:subagent-driven-development ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).
>
> **Baseado no spec:** `docs/superpowers/specs/2026-07-16-conselho-especialistas-analise-completa.md`

**Goal:** Implementar as 6 melhorias de maior impacto e menor esforço no MMA Manager.

**Arquitetura:** Modificações cirúrgicas em arquivos existentes, sem reestruturação. Cada melhoria é independente.

**Tech Stack:** Vanilla JS + IndexedDB + GSAP (animações)

## Global Constraints
- Não quebrar compatibilidade de saves existentes
- Seguir o padrão MVC já estabelecido
- Código em pt-BR para UI, mas nomes de variáveis/classes em inglês (padrão existente)
- Manter estilo de comentários com referências ao design spec

---

### Task 1: Momentos Críticos na Simulação de Luta

**Files:**
- Modify: `js/controllers/simulation.js` — adicionar sistema de momentos críticos
- Modify: `js/views/live-fight-hub.js` — exibir momentos críticos na UI
- Modify: `js/config/game-config.js` — adicionar configurações de momentos

**Interfaces:**
- Consumes: `SimulationEngine._simulateRound()` (já existe)
- Produces: `result.criticalMoments[]` — array de objetos { type, attacker, defender, attrTested, success, description }

#### Passo 1: Adicionar constantes de configuração

**File:** `js/config/game-config.js`

Adicionar ao final do arquivo (antes do último export, se houver):

```js
// CONFIGURAÇÃO DE MOMENTOS CRÍTICOS (Fase 1)
// Cada round pode ter 2-4 momentos discretos que são exibidos ao jogador.
export const MOMENT_CONFIG = {
  MOMENTS_PER_ROUND_MIN: 2,
  MOMENTS_PER_ROUND_MAX: 4,
  // Chance base de cada tipo de momento ocorrer (soma não precisa ser 1)
  MOMENT_TYPES: {
    strike: { weight: 40, attrOffense: 'power', attrDefense: 'chin' },
    takedown: { weight: 20, attrOffense: 'takedowns', attrDefense: 'takedownDefense' },
    submission: { weight: 10, attrOffense: 'submissionOffense', attrDefense: 'submissionDefense' },
    clinch: { weight: 15, attrOffense: 'clinch', attrDefense: 'clinch' },
    knockdown: { weight: 15, attrOffense: 'power', attrDefense: 'chin' },
  },
};
```

#### Passo 2: Implementar gerador de momentos críticos

**File:** `js/controllers/simulation.js`

Adicionar método estático no `SimulationEngine`:

```js
// Gera momentos críticos para um round entre dois lutadores.
// fighterA/fighterB: objetos Fighter.
// momentumA/momentumB: vantagem acumulada (0-100) de cada lado no round.
// Retorna: [{ type, actorId, targetId, description, success }]
static _generateCriticalMoments(fighterA, fighterB, momentumA, momentumB, roundNum) {
  const { MOMENT_CONFIG } = require('../config/game-config.js');
  const total = MOMENT_CONFIG.MOMENTS_PER_ROUND_MIN +
    Math.floor(Math.random() * (MOMENT_CONFIG.MOMENTS_PER_ROUND_MAX - MOMENT_CONFIG.MOMENTS_PER_ROUND_MIN + 1));

  const moments = [];
  const types = Object.entries(MOMENT_CONFIG.MOMENT_TYPES);

  for (let i = 0; i < total; i++) {
    // Escolhe tipo com base nos pesos
    const totalWeight = types.reduce((s, [, v]) => s + v.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosenType = null;
    for (const [key, cfg] of types) {
      roll -= cfg.weight;
      if (roll <= 0) { chosenType = { key, ...cfg }; break; }
    }
    if (!chosenType) continue;

    // Decide quem é o agressor (momentum determina)
    const attacker = Math.random() < (momentumA / (momentumA + momentumB + 1)) ? fighterA : fighterB;
    const defender = attacker.id === fighterA.id ? fighterB : fighterA;

    const atkVal = attacker.attributes[chosenType.attrOffense] ?? 50;
    const defVal = defender.attributes[chosenType.attrDefense] ?? 50;
    const successChance = clamp(atkVal / (atkVal + defVal) * 0.8 + 0.1, 0.05, 0.95);
    const success = Math.random() < successChance;

    moments.push({
      type: chosenType.key,
      actorId: attacker.id,
      actorName: attacker.name,
      targetId: defender.id,
      targetName: defender.name,
      attrTested: { offense: chosenType.attrOffense, defense: chosenType.attrDefense },
      success,
      round: roundNum,
    });
  }

  return moments;
}
```

#### Passo 3: Modificar _simulateRound para gerar momentos

**File:** `js/controllers/simulation.js`

No método `_simulateRound` (ou onde o round é simulado), após calcular as pontuações do round, adicionar:

```js
// Geração de momentos críticos para exibição (Fase 1)
const moments = SimulationEngine._generateCriticalMoments(
  fighterA, fighterB, momentumA, momentumB, roundNum
);
```

E incluir `moments` no objeto retornado pelo round.

#### Passo 4: Exibir momentos críticos no LiveFightHub

**File:** `js/views/live-fight-hub.js`

Adicionar método para renderizar momentos:

```js
// Fase 1: Renderiza momentos críticos do round como cards rolantes
static _renderMoments(moments, playerFighterId) {
  if (!moments || moments.length === 0) return '';

  return moments.map(m => {
    const isPlayerActor = m.actorId === playerFighterId;
    const isPlayerTarget = m.targetId === playerFighterId;
    const successColor = m.success ? 'var(--success)' : 'var(--danger)';
    const icon = this._momentIcon(m.type);

    return `
      <div class="moment-card" style="border-left: 3px solid ${successColor}; padding: 0.5rem 0.75rem; margin-bottom: 0.5rem; background: var(--mat-high); border-radius: 2px;">
        <div class="flex items-center justify-between">
          <span class="text-sm">${icon} ${m.actorName} ${m.success ? 'acertou' : 'tentou'} <strong>${this._momentLabel(m.type)}</strong> ${m.success ? 'em' : 'contra'} ${m.targetName}</span>
          <span class="text-xs ${m.success ? 'text-success' : 'text-muted'}">${m.success ? 'Sucesso' : 'Falha'}</span>
        </div>
        <div class="text-xs text-muted mt-1">${m.attrTested.offense} ${m.success ? '>' : '<'} ${m.attrTested.defense} · Round ${m.round}</div>
      </div>
    `;
  }).join('');
}

static _momentIcon(type) {
  const icons = {
    strike: '👊', takedown: '🏋️', submission: '🔒',
    clinch: '🤼', knockdown: '💥',
  };
  return icons[type] || '⚔️';
}

static _momentLabel(type) {
  const labels = {
    strike: 'golpe', takedown: 'queda', submission: 'finalização',
    clinch: 'clinch', knockdown: 'nocaute',
  };
  return labels[type] || 'ação';
}
```

Modificar o método `render` (ou o método que popula rounds) para incluir momentos:

```js
// Dentro do loop de rounds, após renderizar o round summary:
if (round.moments) {
  html += `<div class="round-moments" style="margin-top: 0.5rem">`;
  html += this._renderMoments(round.moments, playerFighterId);
  html += `</div>`;
}
```

---

### Task 2: Graduação do Bônus de Plano por Nível de Scouting

**Files:**
- Modify: `js/controllers/simulation.js` — método `_planEdge`
- Modify: `js/services/scouting-service.js` — método `knowledgeOf` (consulta)
- Modify: `js/config/game-config.js` — constantes de bônus escalonado

**Interfaces:**
- Consumes: `ScoutingService.knowledgeOf(fighter, playerFighterId)`
- Produces: `_planEdge(plan, opponent, scoutingLevel)` — edge escalonado por scouting

#### Passo 1: Adicionar constantes

**File:** `js/config/game-config.js`

```js
// Escalonamento de bônus do plano de jogo por nível de scouting (Fase 1)
// Nível 0 (escuro) = bônus/penalidade cheio
// Nível 1 (rosto) = 85%
// Nível 2 (faixas) = 70%
// Nível 3 (números) = 50%
// Nível 4 (completo) = 30% (já sabe tudo, execução decide)
export const SCOUTING_PLAN_EDGE_RATIOS = [1.0, 0.85, 0.70, 0.50, 0.30];
```

#### Passo 2: Modificar _planEdge

**File:** `js/controllers/simulation.js`

Modificar a assinatura e implementação de `_planEdge`:

```js
static _planEdge(plan, opponent, scoutingLevel = 0) {
  if (!plan.strongVs && !plan.weakVs) return 0;

  const a = opponent.attributes;
  const striking = opponent.strikingScore;
  const grappling = opponent.grapplingScore;
  const gap = striking - grappling;

  const traits = new Set();
  if (gap > 6) traits.add('striker');
  else if (gap < -6) traits.add('grappler');
  if (a.cardio >= 60) traits.add('highCardio');
  else if (a.cardio <= 45) traits.add('lowCardio');
  if (a.fightIQ >= 60) traits.add('highIq');
  else if (a.fightIQ <= 45) traits.add('lowIq');
  if ((a.power ?? 50) >= 65) traits.add('powerful');
  if ((a.takedowns ?? 50) >= 65) traits.add('wrestler');
  if ((a.submissionOffense ?? 50) >= 65) traits.add('submission');
  if ((a.speed ?? 50) >= 65) traits.add('fast');
  if ((a.composure ?? 50) <= 40) traits.add('nervous');

  let rawEdge = 0;
  if (plan.strongVs && traits.has(plan.strongVs)) rawEdge = GAME_PLAN_EDGE.strong;
  else if (plan.weakVs && traits.has(plan.weakVs)) rawEdge = GAME_PLAN_EDGE.weak;

  // Escalona pelo nível de scouting (Fase 1)
  const ratio = SCOUTING_PLAN_EDGE_RATIOS[clamp(scoutingLevel, 0, 4)] ?? 1.0;
  return Math.round(rawEdge * ratio);
}
```

#### Passo 3: Atualizar chamada em _settlePlayerFight

**File:** `js/services/world-service.js`

Localizar onde `_planEdge` é chamado e passar `scoutingLevel`:

```js
// Antes:
const planEdge = SimulationEngine._planEdge(bestPlan, opponent);

// Depois:
const scoutingLevel = await this.scoutingService?.knowledgeOf(opponent, playerFighterId, hasBaseline) ?? 0;
const planEdge = SimulationEngine._planEdge(bestPlan, opponent, scoutingLevel);
```

---

### Task 3: Bônus Pós-Luta (FOTN/POTN)

**Files:**
- Modify: `js/services/world-service.js` — adicionar cálculo de bônus
- Modify: `js/controllers/game-controller.js` — aplicar bônus
- Modify: `js/config/game-config.js` — config de bônus

**Interfaces:**
- Consumes: `result` da luta (método, rounds, scores)
- Produces: `bonusEvents[]` — bônus aplicados ao fighter

#### Passo 1: Configuração

**File:** `js/config/game-config.js`

```js
// Bônus pós-luta (Fase 1)
export const POST_FIGHT_BONUSES = {
  FIGHT_OF_NIGHT: { label: 'Fight of the Night', purseBonus: 0.50, popularityGain: 5 },
  PERFORMANCE_OF_NIGHT: { label: 'Performance of the Night', purseBonus: 0.50, popularityGain: 3 },
};
```

#### Passo 2: Implementar cálculo no WorldService

**File:** `js/services/world-service.js`

Adicionar método:

```js
// Fase 1: Calcula bônus pós-luta baseado na qualidade da luta
_calculatePostFightBonuses(result, fighterA, fighterB) {
  const bonuses = [];
  const { POST_FIGHT_BONUSES } = require('../config/game-config.js');

  // Performance of the Night: KO/TKO rápido ou submissão no 1º round
  const isQuickFinish = result.round === 1 &&
    (result.method?.startsWith('KO') || result.method?.startsWith('TKO') || result.method === 'Submission');
  if (isQuickFinish) {
    bonuses.push({
      type: 'performance',
      label: POST_FIGHT_BONUSES.PERFORMANCE_OF_NIGHT.label,
      purseBonus: POST_FIGHT_BONUSES.PERFORMANCE_OF_NIGHT.purseBonus,
      popularityGain: POST_FIGHT_BONUSES.PERFORMANCE_OF_NIGHT.popularityGain,
      winnerId: result.winnerId,
    });
  }

  // Fight of the Night: 3+ rounds, scores próximos, muito dano trocado
  const totalRounds = result.rounds?.length || result.round || 3;
  const scoreDiff = Math.abs((result.totalScoreA || 0) - (result.totalScoreB || 0));
  const isFOTN = totalRounds >= 3 && scoreDiff < 15;
  if (isFOTN) {
    bonuses.push({
      type: 'fight_of_night',
      label: POST_FIGHT_BONUSES.FIGHT_OF_NIGHT.label,
      purseBonus: POST_FIGHT_BONUSES.FIGHT_OF_NIGHT.purseBonus,
      popularityGain: POST_FIGHT_BONUSES.FIGHT_OF_NIGHT.popularityGain,
      winnerId: result.winnerId,
      // Bônus de FOTN vai para ambos os lutadores
      bothFighters: true,
    });
  }

  return bonuses;
}
```

#### Passo 3: Aplicar bônus no fluxo pós-luta

**File:** `js/controllers/game-controller.js`

Após `_settlePlayerFight` (onde a bolsa é paga), adicionar:

```js
// Fase 1: Bônus pós-luta
const bonuses = worldService._calculatePostFightBonuses(result, fighter, opponent);
for (const bonus of bonuses) {
  let recipient;
  if (bonus.bothFighters) {
    // Aplica ao jogador
    recipient = fighter;
    const bonusValue = Math.round(result.purse * bonus.purseBonus);
    recipient.addTransaction(absWeekNow, `🎭 ${bonus.label}`, bonusValue);
    recipient.updatePopularity(bonus.popularityGain);
    recipient.fightNightBonuses = (recipient.fightNightBonuses || 0) + 1;

    // Aplica ao oponente (se ainda existe no banco)
    if (opponent) {
      opponent.addTransaction(absWeekNow, `🎭 ${bonus.label}`, bonusValue);
      await this.fighterCtrl.updateFighter(opponent);
    }
  } else if (bonus.winnerId === fighter.id) {
    const bonusValue = Math.round(result.purse * bonus.purseBonus);
    fighter.addTransaction(absWeekNow, `🏅 ${bonus.label}`, bonusValue);
    fighter.updatePopularity(bonus.popularityGain);
    fighter.performanceBonuses = (fighter.performanceBonuses || 0) + 1;
  }
}
```

---

### Task 4: Posição no Card

**Files:**
- Modify: `js/models/fight-offer.js` — adicionar campo `cardPosition`
- Modify: `js/services/offer-service.js` — determinar posição no card
- Modify: `js/views/offers.js` — exibir posição no card
- Modify: `js/config/game-config.js` — threshold de popularidade por posição

**Interfaces:**
- Consumes: `fighter.popularity`, `offer.isTitleFight`
- Produces: `offer.cardPosition` — 'main_event' | 'co_main' | 'featured_prelim' | 'preliminary'

#### Passo 1: Configuração

**File:** `js/config/game-config.js`

```js
// Posição no card (Fase 1)
export const CARD_POSITION = {
  main_event: { label: 'Main Event', shortLabel: 'Main', badge: 'badge-danger', popMin: 80 },
  co_main: { label: 'Co-Main Event', shortLabel: 'Co-Main', badge: 'badge-warning', popMin: 60 },
  featured_prelim: { label: 'Featured Prelim', shortLabel: 'Featured', badge: 'badge-info', popMin: 35 },
  preliminary: { label: 'Preliminar', shortLabel: 'Prelim', badge: 'badge-secondary', popMin: 0 },
};
```

#### Passo 2: Adicionar campo ao FightOffer

**File:** `js/models/fight-offer.js`

No construtor, adicionar:

```js
this.cardPosition = data.cardPosition || 'preliminary';
```

#### Passo 3: Determinar posição no card

**File:** `js/services/offer-service.js`

No método `generateWeekly`, após criar a oferta, adicionar:

```js
// Fase 1: Determinar posição no card
const { CARD_POSITION } = require('../config/game-config.js');
let cardPosition = 'preliminary';
if (offer.isTitleFight) {
  cardPosition = 'main_event';
} else {
  const pop = fighter.popularity || 0;
  if (pop >= CARD_POSITION.main_event.popMin) cardPosition = 'main_event';
  else if (pop >= CARD_POSITION.co_main.popMin) cardPosition = 'co_main';
  else if (pop >= CARD_POSITION.featured_prelim.popMin) cardPosition = 'featured_prelim';
}
offer.cardPosition = cardPosition;
```

Também adicionar no método `_tryTitleOffer` — definir `cardPosition = 'main_event'` para lutas de título.

#### Passo 4: Exibir na UI

**File:** `js/views/offers.js`

No template de oferta, após o nome da promoção, adicionar:

```js
const { CARD_POSITION } = require('../config/game-config.js');
const posCfg = CARD_POSITION[offer.cardPosition] || CARD_POSITION.preliminary;
const cardBadge = `<span class="badge ${posCfg.badge}" style="font-size:0.6rem">${posCfg.shortLabel}</span>`;
```

E incluir `cardBadge` no HTML da oferta.

---

### Task 5: Microdecisões de Treino Semanal

**Files:**
- Create: `js/controllers/weekly-training.js` — novo controller de treino semanal
- Modify: `js/app.js` — conectar nova tela
- Modify: `js/config/game-config.js` — opções de treino semanal

**Interfaces:**
- Consumes: `fighter.fatigue`, `fighter.morale`, `fighter.academy`
- Produces: modificações em `fighter.attributes`, `fighter.fatigue`, `fighter.morale`

#### Passo 1: Configuração

**File:** `js/config/game-config.js`

```js
// Microdecisões de treino semanal (Fase 1)
export const WEEKLY_TRAINING_CHOICES = {
  intense: {
    label: 'Treino Intenso',
    description: 'Ganho acelerado, risco de lesão +20%',
    attrMult: 1.5, fatigueGain: 15, moraleEffect: -2,
    injuryRisk: 0.20,
  },
  technical: {
    label: 'Treino Técnico',
    description: 'Progressão de golpes, risco baixo',
    attrMult: 1.0, fatigueGain: 8, moraleEffect: 0,
    injuryRisk: 0.08,
  },
  active_recovery: {
    label: 'Recuperação Ativa',
    description: 'Pouco ganho, recupera fadiga rápido',
    attrMult: 0.5, fatigueGain: -10, moraleEffect: 3,
    injuryRisk: 0.02,
  },
  partners: {
    label: 'Trabalho com Parceiro',
    description: 'Foco em vínculo e osmose',
    attrMult: 0.7, fatigueGain: 10, moraleEffect: 2,
    injuryRisk: 0.12,
    bondBoost: true,
  },
};

export const WEEKLY_TRAINING_FREQUENCY = 4; // A cada N semanas sem luta
```

#### Passo 2: Criar controller de treino semanal

**File:** `js/controllers/weekly-training.js`

```js
import { clamp } from '../utils/helpers.js';
import { WEEKLY_TRAINING_CHOICES } from '../config/game-config.js';
import { TrainingPartnersService } from '../services/training-partners-service.js';

// Fase 1: Microdecisões de treino semanal.
// Em semanas sem luta, o jogador escolhe o tipo de treino.
// Isso substitui o treino automático genérico.
export class WeeklyTrainingController {
  // Retorna as opções disponíveis esta semana
  static getChoices(fighter) {
    const choices = [];

    for (const [key, cfg] of Object.entries(WEEKLY_TRAINING_CHOICES)) {
      choices.push({
        key,
        label: cfg.label,
        description: cfg.description,
        attrMult: cfg.attrMult,
        fatigueGain: cfg.fatigueGain,
        moraleEffect: cfg.moraleEffect,
        injuryRisk: cfg.injuryRisk,
        bondBoost: cfg.bondBoost || false,
      });
    }

    return choices;
  }

  // Aplica o treino escolhido
  static applyChoice(fighter, choiceKey, academy, teammates) {
    const cfg = WEEKLY_TRAINING_CHOICES[choiceKey];
    if (!cfg) return null;

    const focus = fighter.trainingFocus || 'striking';
    const focusMeta = TRAINING_FOCUS_META[focus];
    const academyBonus = academy?.specialties?.[focus] || 0;

    // Ganho de atributo base
    let gains = {};
    if (focusMeta?.attrs) {
      for (const attr of focusMeta.attrs) {
        const gain = Math.round((2 + Math.random() * 3) * cfg.attrMult * (1 + academyBonus));
        const ceiling = fighter.effectiveCeiling(attr);
        const before = fighter.attributes[attr] || 50;
        fighter.attributes[attr] = clamp(before + gain, 0, ceiling);
        gains[attr] = fighter.attributes[attr] - before;
      }
    }

    // Fadiga
    fighter.fatigue = clamp(fighter.fatigue + cfg.fatigueGain, 0, 100);

    // Moral
    fighter.morale = clamp(fighter.morale + cfg.moraleEffect, 0, 100);

    // Risco de lesão
    let injured = false;
    if (Math.random() < cfg.injuryRisk) {
      fighter.status = 'injured';
      fighter.injury = {
        untilAbsWeek: (fighter.injury?.untilAbsWeek || 0) + Math.ceil(Math.random() * 3),
        description: 'Lesão leve durante treino',
        resumeStatus: 'active',
      };
      injured = true;
    }

    // Bônus de vínculo (opção partners)
    let bondGains = [];
    if (cfg.bondBoost && teammates.length > 0) {
      const partner = teammates[Math.floor(Math.random() * teammates.length)];
      const currentBond = TrainingPartnersService.bondOf(fighter, partner.id);
      TrainingPartnersService._setBond(fighter, partner.id, Math.min(100, currentBond + 5));
      bondGains.push({ partnerName: partner.name, newBond: currentBond + 5 });
    }

    return { gains, fatigueDelta: cfg.fatigueGain, moraleDelta: cfg.moraleEffect, injured, bondGains };
  }
}
```

#### Passo 3: Integrar no fluxo semanal

**File:** `js/controllers/game-controller.js`

No método que processa a semana (onde `_applyWeeklyTraining` é chamado), modificar para verificar se há prompt de treino semanal:

```js
// Fase 1: Se não está em camp e não tem luta esta semana, verificar se
// é uma semana de microdecisão de treino
const weeksSinceLastFight = (fighter.fights?.length > 0)
  ? absWeek(state) - (fighter.fights[0]?.absWeek || absWeek(state))
  : 999;
if (!booking && weeksSinceLastFight % WEEKLY_TRAINING_FREQUENCY === 0 && fighter.status !== 'injured') {
  // Sinalizar que o jogador precisa escolher o treino esta semana
  // (a UI mostrará o prompt no início da próxima renderização)
  state.pendingTrainingChoice = true;
}
```

#### Passo 4: Adicionar handler na UI

**File:** `js/app.js`

Adicionar handler para o prompt de treino semanal (disparado quando `state.pendingTrainingChoice === true`):

```js
// Fase 1: Prompt de treino semanal
if (state.pendingTrainingChoice) {
  const choices = WeeklyTrainingController.getChoices(fighter);
  // Mostrar modal/overlay com as opções
  showTrainingChoiceModal(choices, async (choice) => {
    const teammates = await trainingPartnersService.getTeammates(fighter);
    const academy = await academyService.getAcademy(fighter.academyId);
    const result = WeeklyTrainingController.applyChoice(fighter, choice, academy, teammates);
    await fighterCtrl.updateFighter(fighter);
    state.pendingTrainingChoice = false;
    renderView('dashboard');
  });
}
```

---

### Task 6: Eventos Narrativos do CareerLog

**Files:**
- Modify: `js/services/career-log-service.js` — adicionar seleção de eventos jogáveis
- Modify: `js/views/notifications.js` — exibir eventos narrativos com escolhas
- Modify: `js/config/game-config.js` — pool de eventos narrativos

**Interfaces:**
- Consumes: `CareerLogService.topByMagnitude()`, estado atual do fighter
- Produces: escolha do jogador → efeitos (moral, popularidade, etc.)

#### Passo 1: Pool de eventos narrativos

**File:** `js/config/game-config.js`

```js
// Eventos narrativos (Fase 1) — pool de momentos que viram escolhas jogáveis
export const NARRATIVE_EVENTS = {
  after_loss: [
    {
      prompt: 'Após a derrota, a imprensa quer saber: o que aconteceu?',
      choices: [
        { text: 'Assumir a culpa — "Não estava no meu melhor"', effects: { morale: -3, popularity: 3 } },
        { text: ' culpar a preparação — "O camp foi mal planejado"', effects: { morale: -5, popularity: 1 } },
        { text: 'Prometer voltar mais forte', effects: { morale: 5, popularity: 2 } },
        { text: 'Recusar entrevistas e focar no treino', effects: { morale: 8, popularity: -2 } },
      ],
    },
  ],
  after_win_streak: [
    {
      prompt: 'Você está embalado! A mídia fala em title shot. Como responde?',
      choices: [
        { text: 'Confiar que o momento chegou — "Mereço essa chance"', effects: { morale: 5, popularity: 3, hype: 5 } },
        { text: 'Manter os pés no chão — "Luta por luta"', effects: { morale: 3, popularity: 5 } },
        { text: 'Provocar o campeão publicamente', effects: { morale: 2, popularity: 8, hype: 10, heat: 3 } },
      ],
    },
  ],
  injury_return: [
    {
      prompt: 'Você voltou de lesão. Sente o ringue diferente?',
      choices: [
        { text: 'Voltar cauteloso — "Vou readquirindo o ritmo"', effects: { morale: 3, composure: 2 } },
        { text: 'Ignorar o medo — "Mesma agressão de sempre"', effects: { morale: -2, power: 2 } },
        { text: 'Mudar o estilo para proteger a lesão', effects: { morale: 1, awareness: 3 } },
      ],
    },
  ],
  rival_victory: [
    {
      prompt: 'Seu rival venceu uma luta importante. Como reage?',
      choices: [
        { text: 'Parabenizar — "Respeito onde merece"', effects: { morale: 2, popularity: 3 } },
        { text: 'Minimizar — "Ele não enfrentou ninguém ainda"', effects: { popularity: 5, heat: 4 } },
        { text: 'Pedir a luta agora — "Marca logo"', effects: { hype: 8, heat: 5, popularity: 2 } },
      ],
    },
  ],
  title_reign: [
    {
      prompt: 'Ser campeão muda tudo. Como você lida com o alvo nas costas?',
      choices: [
        { text: 'Treinar mais que nunca — "Ninguém tira isso de mim"', effects: { morale: 5, discipline: 3 } },
        { text: 'Aproveitar o momento — "Toda atenção, todo o glamour"', effects: { popularity: 5, discipline: -2 } },
        { text: 'Ser um campeão ativo — "Defender contra qualquer um"', effects: { popularity: 3, morale: 3, heat: 2 } },
      ],
    },
  ],
};
```

#### Passo 2: Adicionar seleção de evento no CareerLogService

**File:** `js/services/career-log-service.js`

```js
import { NARRATIVE_EVENTS } from '../config/game-config.js';

// Fase 1: Seleciona um evento narrativo relevante baseado no estado do fighter
selectNarrativeEvent(fighter) {
  const events = [];

  // Após derrota recente (última luta = derrota)
  const lastFight = fighter.fights?.[0];
  if (lastFight && lastFight.won === false) {
    events.push(...NARRATIVE_EVENTS.after_loss);
  }

  // Sequência de vitórias
  const streak = fighter.winStreak || 0;
  if (streak >= 3) {
    events.push(...NARRATIVE_EVENTS.after_win_streak);
  }

  // Retorno de lesão
  const recentInjuries = (fighter.fights || [])
    .filter(f => f.wasInjured).length;
  if (recentInjuries > 0) {
    events.push(...NARRATIVE_EVENTS.injury_return);
  }

  // Rival venceu (checar na última semana de world events)
  // (precisa de dados do worldService)

  // É campeão
  if (fighter.ranking === 1 || (fighter.titlesWon || 0) > 0) {
    events.push(...NARRATIVE_EVENTS.title_reign);
  }

  if (events.length === 0) return null;
  return events[Math.floor(Math.random() * events.length)];
}
```

#### Passo 3: Integrar no fluxo semanal

**File:** `js/app.js` (ou `js/controllers/game-controller.js`)

A cada ~5 semanas, verificar se há evento narrativo:

```js
// Fase 1: Evento narrativo semanal
if (absWeek(state) % 5 === 0 && fighter.status !== 'retired') {
  const event = await careerLogService.selectNarrativeEvent(fighter);
  if (event) {
    // Mostrar modal com o evento e opções
    showNarrativeEventModal(event, async (choiceIndex) => {
      const choice = event.choices[choiceIndex];
      // Aplicar efeitos
      for (const [stat, value] of Object.entries(choice.effects)) {
        if (stat === 'morale') fighter.morale = clamp(fighter.morale + value, 0, 100);
        else if (stat === 'popularity') fighter.popularity = clamp(fighter.popularity + value, 0, 100);
        else if (stat === 'hype') fighter.pcHype = (fighter.pcHype || 0) + value;
        else if (stat === 'heat') { /* registra para sistema de rivalidade */ }
        else if (fighter.attributes[stat] !== undefined) {
          fighter.attributes[stat] = clamp((fighter.attributes[stat] || 50) + value, 0, 100);
        }
      }
      await fighterCtrl.updateFighter(fighter);
      await careerLogService.publish(fighter.id, 'narrative_choice', absWeek(state), 30, {
        prompt: event.prompt,
        choice: choice.text,
      });
    });
  }
}
```

---

## Ordem de Execução Recomendada

1. **Task 3** (Bônus Pós-Luta) — menor esforço, impacto imediato na economia
2. **Task 4** (Posição no Card) — apenas adiciona campo + badge, sem tocar em lógica de simulação
3. **Task 2** (Graduação de Scouting) — modifica 1 arquivo de simulação + passa parâmetro
4. **Task 1** (Momentos Críticos) — modifica simulação + UI, médio esforço
5. **Task 6** (Eventos Narrativos) — novo sistema, médio esforço
6. **Task 5** (Microdecisões de Treino) — novo controller, maior esforço

---

## Verificação

Após cada task:
1. Rodar `npm test` (se existir) para verificar regressão
2. Verificar no navegador se a UI renderiza sem erros
3. Avançar 1 semana para verificar se o sistema roda sem quebrar

Após todas as tasks:
4. Criar nova carreira, jogar 10+ semanas
5. Aceitar oferta, configurar camp, lutar
6. Verificar bônus pós-luta, momentos críticos, posição no card
7. Salvar e recarregar — verificar persistência
