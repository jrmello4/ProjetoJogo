# Career Mode Fase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Balance progression (player slower, AI faster), make social media/rivalries unpredictable, add contextual manager/academy offers, and add a visual calendar timeline.

**Architecture:** Changes span 16 files across 5 independent phases. Phase 1 (balance) is pure config + service tuning. Phases 2-3 (social/rivalry) extend existing prompt systems with probabilistic/contextual outcomes. Phase 4 (managers/academies) extends RetentionService with milestone triggers. Phase 5 (calendar) is a new view.

**Tech Stack:** ES modules (JS), no framework, IndexedDB-like store, weekly tick system.

## Global Constraints
- All numbers must come from game-config.js or existing config objects, never hardcoded
- Reuse existing prompt/pending patterns (SocialMedia pending state, RetentionService approach system)
- Follow existing ES module import pattern
- Use `clamp()` from helpers.js for all value clamping
- Existing fight flow: `processWeek()` in game-controller.js orchestrates all subsystems

---

## Phase 1: #4 Balanceamento

### Task 1: Config tuning — financeiro

**Files:** Modify `js/config/game-config.js`

- [ ] **Step 1: Read existing config values**

```bash
grep -n "weeklyFee\|weeklyCost\|PURSE\[2\]" js/config/game-config.js
```

Expected: find `ACADEMIES[2].weeklyFee: 800`, `LIFESTYLE_TIERS.luxurious.weeklyCost: 1500`, `OFFER_CONFIG.PURSE[2].base: 3500`

- [ ] **Step 2: Edit config values**

In `js/config/game-config.js`, find `ACADEMIES` array index 2 (Elite Combat Team): change `weeklyFee: 800` to `weeklyFee: 1200`.

Find `LIFESTYLE_TIERS.luxurious.weeklyCost`: change `1500` to `2500`.

Find `OFFER_CONFIG.PURSE[2].base`: change `3500` to `2800`.

- [ ] **Step 3: Commit**

```bash
git add js/config/game-config.js
git commit -m "balance: aperto financeiro — academia elite 1200/sem, luxo 2500/sem, bolsa tier2 2800"
```

### Task 2: Reduzir ganho semanal de treino e aumentar peso de derrotas

**Files:** Modify `js/controllers/game-controller.js` (`_applyWeeklyTraining`), Modify `js/models/fighter.js` (add temporary debuff fields), Modify `js/controllers/simulation.js` (morale loss on decision loss)

- [ ] **Step 1: Edit `_applyWeeklyTraining` gainChance**

In `js/controllers/game-controller.js`, find `_applyWeeklyTraining` method. Change:

```js
const gainChance = Math.min(0.9, 0.35 + (fighter.hidden.discipline / 100) * 0.4 + facilityBonus + specialtyBonus);
```

To:

```js
let gainChance = Math.min(0.9, 0.20 + (fighter.hidden.discipline / 100) * 0.4 + facilityBonus + specialtyBonus);
const attrVal = fighter.attributes[attr] || 50;
if (attrVal >= 85) gainChance *= 0.25;
else if (attrVal >= 70) gainChance *= 0.5;
```

- [ ] **Step 2: Add temporary debuff fields to Fighter model**

In `js/models/fighter.js`, in the constructor, after `this.lastFightAbsWeek = data.lastFightAbsWeek || 0;`, add:

```js
this.tempDebuffs = data.tempDebuffs || []; // { affectedAttr, value, untilAbsWeek, reason }
```

- [ ] **Step 3: Add `applyTempDebuff` and `recoverTempDebuffs` methods to Fighter**

In `js/models/fighter.js`, after the `updatePopularity` method, add:

```js
applyTempDebuff(attr, value, durationWeeks, absWeekNow, reason) {
  this.tempDebuffs.push({
    affectedAttr: attr,
    value,
    untilAbsWeek: absWeekNow + durationWeeks,
    reason,
  });
}

recoverTempDebuffs(absWeekNow) {
  if (!this.tempDebuffs?.length) return;
  const active = this.tempDebuffs.filter(d => d.untilAbsWeek > absWeekNow);
  const recovered = this.tempDebuffs.filter(d => d.untilAbsWeek <= absWeekNow);
  for (const debuff of recovered) {
    this.attributes[debuff.affectedAttr] = Math.min(99, (this.attributes[debuff.affectedAttr] || 50) + Math.abs(debuff.value));
  }
  this.tempDebuffs = active;
}
```

Then in `recover()` method, at the end add: `this.recoverTempDebuffs(absWeekNow);` — but `recover()` doesn't take absWeekNow. Need to modify.

Actually, simpler: call `recoverTempDebuffs` in `processWeek` after training. Or just handle recovery passively. Let me just add the field and apply/recover in simulation.js.

- [ ] **Step 4: Apply KO/TKO chin/durability loss in simulation.js**

In `js/controllers/simulation.js`, find `_updateFighter` method (around line 596). Inside the `loss` branch (where `outcome === 'loss'`), after `fighter.applyMoraleChange(-12);`:

```js
// Épico D — derrota por decisão: moral cai o dobro
if (method && method.startsWith('Decision')) {
  fighter.applyMoraleChange(-12); // extra -12 on top of the existing -12 = -24 total
}
```

For KO/TKO damage, inside the same `loss` branch, after the morale changes, add:

```js
if (method && (method.startsWith('KO') || method.startsWith('TKO'))) {
  fighter.attributes.chin = clamp(fighter.attributes.chin - 2, 1, 99);
  fighter.attributes.durability = clamp(fighter.attributes.durability - 1, 1, 99);
}
```

Note: The existing code (lines 315-316) already applies permanent chin/durability damage for accumulated KOs. This new code adds a temporary 2-point chin and 1-point durability drop on each KO loss.

- [ ] **Step 5: Commit**

```bash
git add js/controllers/game-controller.js js/models/fighter.js js/controllers/simulation.js
git commit -m "balance: gainChance 0.35→0.20, decaimento por nivel, derrota KO danifica chin/durability"
```

### Task 3: Evolução semanal para IA

**Files:** Modify `js/services/world-service.js` (add `_evolveAIFighters`)

- [ ] **Step 1: Add `_evolveAIFighters` method to WorldService**

In `js/services/world-service.js`, before the closing `}` of the class, add:

```js
// Evolução semanal para IA — compensa o fato de que apenas o jogador
// tem _applyWeeklyTraining. Roda a cada 4 semanas: fighters de IA ganham
// uma versão light do evolve() pós-luta para não estagnarem entre lutas.
// Jovens (< 30) têm o dobro da chance de insight.
async _evolveAIFighters(absWeekNow) {
  if (absWeekNow % 4 !== 0) return;
  const all = await this.fighterCtrl.getAllFighters();
  for (const data of all) {
    if (data.id === this._playerFighterId) continue;
    if (data.status === 'retired' || data.status === 'injured') continue;
    const fighter = new Fighter(data);
    const isYoung = (fighter.age || 30) < 30;
    let evolved = false;
    for (const key of Object.keys(fighter.attributes)) {
      if (Math.random() > (isYoung ? 0.15 : 0.08)) continue;
      const gain = Math.random() * 1.5 + 0.3;
      fighter.attributes[key] = Math.min(gain + (fighter.attributes[key] || 50), fighter.effectiveCeiling(key));
      evolved = true;
    }
    if (evolved) {
      await this.fighterCtrl.updateFighter(fighter);
    }
  }
}
```

Note: Need to add `this._playerFighterId` as a class field. Add it in the constructor: `this._playerFighterId = null;` and set it in processWeek via parameter.

Actually simpler: `_evolveAIFighters` already has access to `playerFighterId` if we pass it or store it. Let me just add a parameter.

Actually, let me just check the method signature. The cleanest way: add `playerFighterId` parameter to `_evolveAIFighters` and pass it from `processWeek`.

Wait, `processWeek` already receives `playerFighterId`. So:

```js
async _evolveAIFighters(absWeekNow, playerFighterId) {
  if (absWeekNow % 4 !== 0) return;
  const all = await this.fighterCtrl.getAllFighters();
  for (const data of all) {
    if (data.id === playerFighterId) continue;
    if (data.status === 'retired' || data.status === 'injured') continue;
    ...
  }
}
```

And call it at the end of `processWeek`:

```js
await this._evolveAIFighters(absWeekNow, playerFighterId);
```

- [ ] **Step 2: Add call to `_evolveAIFighters` in `processWeek`**

In `js/services/world-service.js`, inside `processWeek`, after the `_checkInterimTitles` call (line 89), add:

```js
await this._evolveAIFighters(absWeekNow, playerFighterId);
```

- [ ] **Step 3: Commit**

```bash
git add js/services/world-service.js
git commit -m "balance: evolucao semanal para IA a cada 4 semanas, jovens 2x insight"
```

---

## Phase 2: #9 Social Media Imprevisível

### Task 4: Social Media probabilístico + hints não-numéricos

**Files:** Modify `js/controllers/social-media.js` (both `getChoices` and `applyChoice`)

- [ ] **Step 1: Edit `getChoices` — hints não-numéricos**

In `js/controllers/social-media.js`, replace the hints in `getChoices()`:

```js
// Before:
choices.push({
  key: 'provoke',
  text: `Provocar ${rivalName || 'seu rival'} publicamente`,
  hint: `Popularidade +${SOCIAL_CONFIG.PROVOKE_POPULARITY}, risco de moral`,
});

// After:
choices.push({
  key: 'provoke',
  text: `Provocar ${rivalName || 'seu rival'} publicamente`,
  hint: 'Pode aumentar sua popularidade, mas é arriscado',
});
```

Similarly update all other hints:
- `title_shot`: from `'Só rende bem se você já tem crédito para isso'` to `'Depende do seu momento na carreira...'`
- `respond_critics`: from `'Pequeno e neutro'` to `'Uma resposta segura, sem grandes riscos'`
- `stay_quiet`: from `'Moral +${SOCIAL_CONFIG.STAY_QUIET_MORALE}'` to `'Postura profissional, sempre uma escolha sólida'`

- [ ] **Step 2: Edit `applyChoice` — resultados probabilísticos**

Replace the entire `applyChoice` method body with the probabilistic version from the spec. Key changes:

```js
static applyChoice(fighter, key, { plausibleTitleContender = false, streakActive = false, lostRecent = false } = {}) {
  switch (key) {
    case 'provoke': {
      const basePop = 2 + Math.floor(Math.random() * 4);        // 2-5
      const baseMorale = -(1 + Math.floor(Math.random() * 5));  // -1 a -5
      const viral = fighter.popularity > 50 && Math.random() < 0.08;
      const streakBonus = streakActive ? 2 : 0;
      const lossPenalty = lostRecent ? 2 : 0;
      fighter.updatePopularity(basePop + (viral ? 6 : 0) + streakBonus);
      fighter.applyMoraleChange(baseMorale - lossPenalty);
      return {
        provoked: true,
        effects: { popularity: basePop + (viral ? 6 : 0) + streakBonus, morale: baseMorale - lossPenalty },
        viral,
      };
    }
    case 'title_shot': {
      if (plausibleTitleContender) {
        const pop = 1 + Math.floor(Math.random() * 4); // 1-4
        fighter.updatePopularity(pop);
        return { provoked: false, effects: { popularity: pop, morale: 0 } };
      }
      const moralePenalty = -(2 + Math.floor(Math.random() * 5)); // -2 a -6
      fighter.applyMoraleChange(moralePenalty);
      return { provoked: false, effects: { popularity: 0, morale: moralePenalty } };
    }
    case 'respond_critics': {
      const pop = Math.floor(Math.random() * 3); // 0-2
      fighter.updatePopularity(pop);
      return { provoked: false, effects: { popularity: pop, morale: 0 } };
    }
    case 'stay_quiet':
    default: {
      const morale = 1 + Math.floor(Math.random() * 4); // 1-4
      fighter.applyMoraleChange(morale);
      return { provoked: false, effects: { popularity: 0, morale } };
    }
  }
}
```

- [ ] **Step 3: Update `_rollSocialMediaPrompt` in game-controller to pass streak/loss context**

In `js/controllers/game-controller.js`, find `_rollSocialMediaPrompt`. The method already calls `socialMediaService.processWeek`. But `processWeek` later calls `resolveSocialPrompt` which calls `SocialMedia.applyChoice`. 

The context (streakActive, lostRecent) needs to be computed in `resolveSocialPrompt` since that's where `applyChoice` is called. Add before the result:

```js
const streakActive = (fighter.winStreak || 0) >= 2;
const lostRecent = fighter.lastFightAbsWeek && (now - fighter.lastFightAbsWeek) <= 4 && (fighter.record.losses > 0);
const result = SocialMedia.applyChoice(fighter, choice, { 
  plausibleTitleContender,
  streakActive, 
  lostRecent 
});
```

- [ ] **Step 4: Handle viral result in `resolveSocialPrompt`**

After `applyChoice`, if `result.viral` is true, add:

```js
if (result.viral) {
  await this.notifService.add('headline', '🔥 Viral!', 'Seu post explodiu nas redes sociais! Popularidade extra e novos olhos no seu trabalho.');
  await this.careerLogService.publish(fighter.id, 'viral', now, 65, {});
}
```

- [ ] **Step 5: Commit**

```bash
git add js/controllers/social-media.js js/controllers/game-controller.js
git commit -m "feat: social media probabilistico com hints nao-numericos e viralizacao"
```

---

## Phase 3: #8 Rivalidades com Escolhas Não-Óbvias

### Task 5: Prompt semanal de rivalidade

**Files:** Modify `js/services/rivalry-service.js` (new `rollInteraction`), Modify `js/controllers/game-controller.js` (roll + resolve), Modify `js/views/dashboard.js` (display prompt)

- [ ] **Step 1: Add `rollInteraction` method to RivalryService**

In `js/services/rivalry-service.js`, before the closing `}`, add:

```js
// Gera um prompt de interação com rival. Retorna null se não houver
// prompt esta semana, ou um objeto { rivalryId, rivalName, rivalPersonality,
//   choices: [{ key, text }] }.
// Gatilho: intensidade >= 3, chance 30%.
async rollInteraction(fighter, rivalFighter, now) {
  if (Math.random() > 0.3) return null;
  const rivalries = await this.getRivalries(fighter.id);
  const rivalry = rivalries.find(r => r.intensity >= 3);
  if (!rivalry) return null;

  // Determinar personalidade do rival — busca na academia dele
  const rivalPersonality = rivalFighter?.academyId
    ? (ACADEMIES.find(a => a.id === rivalFighter.academyId)?.headCoach?.personality || 'cautious')
    : 'cautious';

  return {
    rivalryId: rivalry.id,
    rivalName: rivalFighter?.name || 'Rival',
    rivalPersonality,
    rivalPop: rivalFighter?.popularity || 0,
    choices: [
      { key: 'provoke', text: `Provocar ${rivalFighter?.name || 'o rival'} — "você não está no meu nível"` },
      { key: 'respect', text: `Respeitar ${rivalFighter?.name || 'o rival'} — "é um guerreiro, mas vou vencer"` },
      { key: 'ignore', text: 'Ignorar — sem comentários' },
    ],
  };
}
```

Need to import `ACADEMIES` at the top of the file. Add to the existing import line:

```js
import { ACADEMIES, MANAGERS, EXPECTATION_CONFIG, RIVALRY_CONFIG } from '../config/game-config.js';
```

- [ ] **Step 2: Add `resolveRivalryInteraction` method to GameController**

In `js/controllers/game-controller.js`, after `resolveSocialPrompt`, add:

```js
async resolveRivalryInteraction(choice) {
  const fighter = await this.getPlayerFighter();
  if (!fighter) return { ok: false, reason: 'Nenhum lutador ativo.' };

  const state = await this.db.get('gameState', 'rivalry-prompt');
  if (!state) return { ok: false, reason: 'Nenhum prompt pendente.' };
  await this.db.delete('gameState', 'rivalry-prompt');

  const seasonState = await this.seasonService.getState();
  const now = absWeek(seasonState);

  // Buscar rival e rivalidade
  const rival = await this.fighterCtrl.getFighter(state.rivalFighterId);
  const rivalryData = await this.db.get('rivalries', state.rivalryId);
  if (!rivalryData) return { ok: false, reason: 'Rivalidade não encontrada.' };
  const rivalry = new Rivalry(rivalryData);

  const fighterPop = fighter.popularity || 0;
  const rivalPop = rival?.popularity || 0;
  const lostLastFight = fighter.record?.losses > 0
    && fighter.lastFightAbsWeek && (now - fighter.lastFightAbsWeek) <= 8;
  const wonLastFight = fighter.lastFightAbsWeek
    && (fighter.record?.wins || 0) > 0
    && (now - fighter.lastFightAbsWeek) <= 8;

  const personality = state.rivalPersonality || 'cautious';
  const isUnderdog = fighterPop < rivalPop - 10;
  const intensityGain = 1 + Math.floor(Math.random() * 3);
  let popChange = 0;
  let moraleChange = 0;
  let finalIntensityGain = 0;

  switch (choice) {
    case 'provoke':
      if (personality === 'aggressive') {
        finalIntensityGain = intensityGain + 1;
        popChange = isUnderdog ? 3 : 0;
      } else if (personality === 'cautious') {
        finalIntensityGain = 0; // rival ignora
        popChange = 0;
      } else { // analytical
        finalIntensityGain = 1;
        popChange = 1;
      }
      if (wonLastFight) finalIntensityGain += 1;
      if (lostLastFight) popChange -= 2;
      if (lostLastFight) moraleChange = -3;
      rivalry.type = 'competitive';
      break;

    case 'respect':
      if (personality === 'aggressive') {
        finalIntensityGain = -1;
      } else if (personality === 'cautious') {
        finalIntensityGain = 0;
        popChange = 2;
      } else { // analytical
        finalIntensityGain = 0;
        popChange = 1;
      }
      moraleChange = 2;
      break;

    case 'ignore':
    default:
      finalIntensityGain = personality === 'analytical' ? 0 : 0;
      popChange = 0;
      moraleChange = 1;
      break;
  }

  fighter.updatePopularity(popChange);
  fighter.applyMoraleChange(moraleChange);

  if (finalIntensityGain > 0) {
    rivalry.increaseIntensity(finalIntensityGain);
  } else if (finalIntensityGain < 0) {
    rivalry.intensity = Math.max(1, rivalry.intensity + finalIntensityGain);
  }

  const actionLabel = { provoke: 'provocação', respect: 'respeito', ignore: 'ignorou' }[choice] || choice;
  rivalry.addEvent('interaction', `${fighter.name} ${actionLabel} ${state.rivalName} — intensidade ${finalIntensityGain > 0 ? '+' : ''}${finalIntensityGain}`);

  await this.db.put('rivalries', rivalry);
  await this.fighterCtrl.updateFighter(fighter);

  const messages = {
    provoke: `Você provocou ${state.rivalName}.${finalIntensityGain > 0 ? ` A rivalidade esquentou!` : ' O rival ignorou.'}`,
    respect: `Você respeitou ${state.rivalName}. Moral e popularidade ajustadas.`,
    ignore: 'Você ignorou a provocação. Postura profissional.',
  };
  await this.notifService.add('info', 'Rivalidade', messages[choice] || '');

  return { ok: true, choice, effects: { popChange, moraleChange, intensityGain: finalIntensityGain } };
}
```

Need to import `Rivalry` at the top of game-controller if not already. Check: at line 23, `import { Rivalry } from '../models/rivalry.js';` — should already be there.

- [ ] **Step 3: Add weekly roll in `processWeek`**

In `js/controllers/game-controller.js`, in `processWeek`, after the social media prompt roll (after line 430), add:

```js
// Rivalidade — prompt semanal
if (fighter.status !== 'retired') {
  const rivalries = await this.rivalryService.getRivalries(fighter.id);
  const topRivalry = rivalries.sort((a, b) => b.intensity - a.intensity)[0];
  if (topRivalry && topRivalry.intensity >= 3) {
    const rivalId = topRivalry.fighterAId === fighter.id ? topRivalry.fighterBId : topRivalry.fighterAId;
    const rival = await this.fighterCtrl.getFighter(rivalId);
    if (rival) {
      const interaction = await this.rivalryService.rollInteraction(fighter, rival, now);
      if (interaction) {
        await this.db.put('gameState', { id: 'rivalry-prompt', ...interaction, rivalFighterId: rivalId });
        if (interaction.choices.length > 0) {
          await this.notifService.add('warning', '⚔️ Rivalidade', `${rival.name} está provocando você nas redes. Como reagir?`);
        }
      }
    }
  }
}
```

- [ ] **Step 4: Add rivalry prompt card to dashboard view**

In `js/views/dashboard.js`, find where social media prompt is rendered. Add a similar card for rivalry prompt. Look for the social media prompt section and add after it:

```js
// Rivalry interaction card
if (data.rivalryPrompt) {
  html += `
    <div class="card rivalidade-card">
      <div class="card-header">
        <span class="card-title">⚔️ Rivalidade</span>
      </div>
      <div class="card-body">
        <p>${data.rivalryPrompt.rivalName} está provocando você. Como reagir?</p>
        <div class="flex gap-2" style="flex-wrap:wrap">
          ${data.rivalryPrompt.choices.map(c => `
            <button class="btn btn-sm rivalry-choice" data-choice="${c.key}" data-rivalry-id="${data.rivalryPrompt.rivalryId}">
              ${c.text}
            </button>
          `).join('')}
        </div>
      </div>
    </div>`;
}
```

And add event listener in the dashboard render handler (in app.js) for `.rivalry-choice` clicks, similar to social media prompt buttons.

- [ ] **Step 5: Add rivalry prompt handler in app.js renderDashboard**

In `js/app.js`, in the dashboard render section, add competitor for `.rivalry-choice`:

```js
document.querySelectorAll('.rivalry-choice').forEach(btn => {
  btn.addEventListener('click', async () => {
    const choice = btn.dataset.choice;
    const result = await this.game.resolveRivalryInteraction(choice);
    if (result.ok) {
      this.notificationService.add('info', 'Rivalidade', 'Sua escolha teve efeito na rivalidade.');
    }
    // Re-render para remover o card
    const route = this.currentRoute || 'dashboard';
    this.navigateTo(route);
  });
});
```

- [ ] **Step 6: Pass rivalry prompt data to dashboard**

In `js/controllers/game-controller.js`, in `getDashboard()` method, add rivalry prompt reading:

```js
let rivalryPrompt = null;
try {
  const rp = await this.db.get('gameState', 'rivalry-prompt');
  if (rp && rp.choices) rivalryPrompt = rp;
} catch { /* ok */ }
```

And include it in the return data.

- [ ] **Step 7: Commit**

```bash
git add js/services/rivalry-service.js js/controllers/game-controller.js js/views/dashboard.js js/app.js
git commit -m "feat: rivalidades com escolhas contextuais nao-obvias e prompt semanal"
```

---

## Phase 4: #5+#6 Empresários e Academias Contextuais

### Task 6: Gatilhos de milestones no RetentionService

**Files:** Modify `js/services/retention-service.js` (new `_checkMilestoneTriggers`), Modify `js/controllers/game-controller.js` (call it)

- [ ] **Step 1: Add `_checkMilestoneTriggers` method to RetentionService**

In `js/services/retention-service.js`, before `generateApproaches`, add:

```js
// Gera abordagens baseadas em milestones de carreira, não apenas baixa
// confiança/sinergia. Roda ANTES de generateApproaches para que sondagens
// por mérito tenham prioridade sobre sondagens por insatisfação.
async _checkMilestoneTriggers(now, fighter) {
  const approaches = await this._loadApproaches();
  if (approaches.some(a => !a.resolved)) return []; // já tem pendente

  const triggers = [];

  // Empresário — streak de 3+ (vitórias consecutivas sem derrota)
  const streak = fighter.winStreak || 0;
  if (streak >= 3 && !fighter.managerId) {
    triggers.push({ type: 'manager', reason: 'win_streak', targetId: 'manager-aggressive', targetName: 'Marcelo Duarte' });
  }

  // Empresário — cinturão conquistado (acabou de ganhar)
  const belts = await this.titleService.beltsOf(fighter.id);
  if (belts.length > 0 && !fighter.managerId) {
    triggers.push({ type: 'manager', reason: 'belt_won', targetId: 'manager-loyal', targetName: 'Renata Alves' });
  }

  // Empresário — nocaute recente (últimas 8 semanas)
  if (!fighter.managerId) {
    triggers.push({ type: 'manager', reason: 'rising', targetId: 'manager-conservative', targetName: 'João Bittencourt' });
  }

  // Academia — derrota recente
  const lostRecently = fighter.lastFightAbsWeek && (now - fighter.lastFightAbsWeek) <= 8
    && (fighter.record?.losses || 0) > 0;
  if (lostRecently) {
    const targetBlackTiger = ACADEMIES.find(a => a.id === 'academy-blacktiger');
    if (targetBlackTiger && fighter.academyId !== 'academy-blacktiger') {
      triggers.push({ type: 'academy', reason: 'recent_loss', targetId: 'academy-blacktiger', targetName: targetBlackTiger.name });
    }
  }

  // Academia — 2+ vitórias consecutivas (tenta subir de nível)
  if (streak >= 2) {
    const currentAcademy = ACADEMIES.find(a => a.id === fighter.academyId);
    const currentLevel = currentAcademy?.facilityLevel || 1;
    const betterAcademy = ACADEMIES.filter(a => a.id !== fighter.academyId && a.facilityLevel > currentLevel)
      .sort((a, b) => a.facilityLevel - b.facilityLevel)[0];
    if (betterAcademy) {
      triggers.push({ type: 'academy', reason: 'rising', targetId: betterAcademy.id, targetName: betterAcademy.name });
    }
  }

  // Academia — rival mudou
  const rivalries = await this.rivalryService?.getRivalries(fighter.id) || [];
  for (const r of rivalries) {
    const rivalId = r.fighterAId === fighter.id ? r.fighterBId : r.fighterAId;
    const rivalFighter = await this.fighterCtrl.getFighter(rivalId);
    if (rivalFighter?.academyId && rivalFighter.academyId !== fighter.academyId) {
      const rivalAcademy = ACADEMIES.find(a => a.id === rivalFighter.academyId);
      if (rivalAcademy) {
        triggers.push({ type: 'academy', reason: 'rival_there', targetId: rivalAcademy.id, targetName: rivalAcademy.name });
      }
    }
  }

  // Converter triggers em abordagens (com 40% de chance cada)
  const created = [];
  for (const t of triggers) {
    if (Math.random() > 0.4) continue;
    // Não criar abordagem duplicada para o mesmo alvo
    if (created.some(c => c.targetId === t.targetId)) continue;

    const reasonLabels = {
      win_streak: `${t.targetName} notou sua sequência de vitórias e quer conversar.`,
      belt_won: `${t.targetName} viu sua conquista do cinturão. Quer representar você.`,
      rising: t.type === 'manager'
        ? `${t.targetName} está de olho na sua ascensão. Quer fazer uma proposta.`
        : `${t.targetName} acompanhou sua evolução. Quer te levar para o próximo nível.`,
      recent_loss: `${t.targetName} acredita que pode reconstruir sua carreira. Quer te treinar.`,
      rival_there: `${t.targetName} quer te contratar. Seu rival já treina lá.`,
    };

    const approach = {
      id: generateId(),
      targetType: t.type,
      rivalId: t.targetId,
      rivalName: t.targetName,
      rivalScore: 0,
      reason: t.reason,
      contextMessage: reasonLabels[t.reason] || `${t.targetName} entrou em contato.`,
      deadlineAbsWeek: now + 2,
      createdAt: now,
      resolved: false,
      response: null,
    };
    created.push(approach);
  }

  if (created.length > 0) {
    const all = await this._loadApproaches();
    all.push(...created);
    await this._saveApproaches(all);
    for (const a of created) {
      await this.notifService.add('warning', '📩 Proposta', a.contextMessage);
    }
  }

  return created;
}
```

Need to add `rivalryService` to the constructor of RetentionService. Currently it takes `(db, fighterCtrl, notifService, titleService, managerService, careerLogService)`. Add `rivalryService = null` parameter and `this.rivalryService = rivalryService;`.

- [ ] **Step 2: Wire `RetentionService` with RivalryService in game-controller**

In `js/controllers/game-controller.js`, find where `RetentionService` is instantiated (constructor or init), and pass `this.rivalryService`:

```js
this.retentionService = new RetentionService(
  this.db, this.fighterCtrl, this.notifService, this.titleService,
  this.managerService, this.careerLogService, this.rivalryService
);
```

- [ ] **Step 3: Call `_checkMilestoneTriggers` in generateApproaches or processWeek**

In `js/controllers/game-controller.js`, in `processWeek`, after `retentionService.generateApproaches` (line 404), add:

```js
await this.retentionService._checkMilestoneTriggers(now, fighter);
```

- [ ] **Step 4: Add context message to dashboard display**

In `js/views/dashboard.js`, find where the approach card is rendered. Look for the sondagem section and add the context message. Find the existing code that displays `data.pendingApproach` and add `approach.contextMessage` as a description paragraph. Look for text like "Sondagem Recebida" or "demonstrou interesse".

Approach: find the `.retention-respond` or `.retention-action` buttons in the dashboard and add a `<p class="text-sm">${approach.contextMessage}</p>` above the action buttons.

But this depends on `getDashboard` returning the approach with its context. Check what `getDashboard` returns — it should have `pendingApproach` which now includes `contextMessage`.

- [ ] **Step 5: Commit**

```bash
git add js/services/retention-service.js js/controllers/game-controller.js js/views/dashboard.js
git commit -m "feat: empresarios e academias contextuais por milestones de carreira"
```

---

## Phase 5: #7 Calendário Visual

### Task 7: GameController.getCalendarData

**Files:** Create `js/views/calendar.js`, Modify `js/controllers/game-controller.js` (new `getCalendarData`), Modify `js/app.js` (calendar route), Modify `js/views/layout.js` (calendar nav tab)

- [ ] **Step 1: Add `getCalendarData` method to GameController**

In `js/controllers/game-controller.js`, add after `getDashboard`:

```js
async getCalendarData() {
  const fighter = await this.getPlayerFighter();
  if (!fighter) return null;
  const season = await this.seasonService.getState();
  const now = absWeek(season);
  const startedAt = season.startedAt;

  const bookings = await this.offerService.getAccepted();
  const booking = bookings.find(b => b.fighterId === fighter.id);
  const promotions = await this.worldService.getPromotions();

  const entries = [];
  const lookahead = 26; // mostrar 26 semanas à frente

  for (let w = now; w <= now + lookahead; w++) {
    const weekNum = ((w - 1) % 52) + 1;
    const yearNum = Math.ceil(w / 52);
    const label = `Sem ${weekNum}, Ano ${yearNum}`;

    let weekType = 'training';
    let details = null;
    let icon = '💪';

    // Luta marcada
    if (booking && w === booking.eventAbsWeek) {
      weekType = 'fight';
      icon = '🥊';
      details = `Luta vs ${booking.opponentName} (${booking.promotionName})`;
      if (booking.isTitleFight) {
        weekType = 'title_fight';
        icon = '🏆';
      }
    }

    // Suspensão médica
    if (fighter.availableFromAbsWeek && w < fighter.availableFromAbsWeek && w > now) {
      weekType = 'suspended';
      icon = '❌';
      details = 'Suspensão médica';
    }

    // Camp (week before fight)
    if (booking && w >= booking.eventAbsWeek - 4 && w < booking.eventAbsWeek && w > now) {
      weekType = 'camp';
      icon = '🔥';
      details = `Camp — luta em ${booking.eventAbsWeek - w} sem`;
    }

    // Eventos de promoção
    for (const promo of promotions) {
      if (promo.nextEventAbsWeek && Math.abs(promo.nextEventAbsWeek - w) <= 2) {
        // próximo evento relevante
      }
    }

    entries.push({
      absWeek: w,
      weekType,
      label,
      icon,
      details,
      isFightWeek: weekType === 'fight' || weekType === 'title_fight',
      isCurrentWeek: w === now,
      isPastWeek: w < now,
    });
  }

  return {
    currentWeek: now,
    entries,
    upcomingFight: booking ? {
      opponentName: booking.opponentName,
      promotionName: booking.promotionName,
      absWeek: booking.eventAbsWeek,
      isTitleFight: !!booking.isTitleFight,
    } : null,
  };
}
```

- [ ] **Step 2: Create calendar view**

Create `js/views/calendar.js`:

```js
import { absWeekToDate } from '../config/game-config.js';

export function renderCalendar(calendarData) {
  if (!calendarData) {
    return `<div class="card"><div class="card-body"><p class="text-center text-muted">Nenhum dado disponível.</p></div></div>`;
  }

  const { currentWeek, entries, upcomingFight } = calendarData;

  const entriesHtml = entries.map(e => {
    const classes = [
      'calendar-entry',
      e.isCurrentWeek ? 'calendar-entry--current' : '',
      e.isPastWeek ? 'calendar-entry--past' : '',
      e.isFightWeek ? 'calendar-entry--fight' : '',
      `calendar-entry--${e.weekType}`,
    ].filter(Boolean).join(' ');

    return `
      <div class="${classes}">
        <div class="calendar-entry-week">${e.label}</div>
        <div class="calendar-entry-icon">${e.icon}</div>
        <div class="calendar-entry-detail">${e.details || '&nbsp;'}</div>
      </div>`;
  }).join('');

  return `
    <div class="page-header">
      <h2>📅 Calendário</h2>
      <p class="text-muted text-sm">Próximas semanas da sua carreira</p>
    </div>
    ${upcomingFight ? `
      <div class="card calendar-upcoming" style="border-left:4px solid var(--danger);margin-bottom:1.5rem">
        <div class="card-body">
          <strong>🥊 Próxima Luta:</strong> ${upcomingFight.opponentName} · ${upcomingFight.promotionName}
          ${upcomingFight.isTitleFight ? ' 🏆' : ''}
        </div>
      </div>
    ` : `
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-body text-muted text-sm">
          Nenhuma luta marcada no momento.
        </div>
      </div>
    `}
    <div class="calendar-legend" style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;font-size:0.8rem">
      <span>💪 Treino</span>
      <span>🔥 Camp</span>
      <span>🥊 Luta</span>
      <span>🏆 Cinturão</span>
      <span>❌ Suspensão</span>
    </div>
    <div class="calendar-grid">
      ${entriesHtml}
    </div>`;
}
```

- [ ] **Step 3: Add calendar CSS**

In the game's main CSS file (likely `css/app.css` or `css/styles.css`), add the calendar styling. Check if there's a specific CSS file used.

Add minimal inline styles in the view or add to the main CSS. For simplicity, add to the existing CSS. Check which CSS file is loaded in index.html.

```bash
grep -n "\.css" index.html | head -5
```

Then append to the appropriate CSS file:

```css
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.5rem;
}
.calendar-entry {
  padding: 0.5rem;
  border-radius: 6px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.calendar-entry--current {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 10%, var(--bg-card));
}
.calendar-entry--past {
  opacity: 0.5;
}
.calendar-entry--fight {
  border-color: var(--danger);
}
.calendar-entry--title_fight {
  border-color: var(--warning);
  background: color-mix(in srgb, var(--warning) 15%, var(--bg-card));
}
.calendar-entry--suspended {
  border-color: var(--text-muted);
}
.calendar-entry--camp {
  border-color: var(--warning);
}
.calendar-entry-week {
  font-weight: 600;
  color: var(--text);
}
.calendar-entry-icon {
  font-size: 1.5rem;
}
.calendar-entry-detail {
  font-size: 0.75rem;
  color: var(--text-secondary);
  min-height: 1em;
}
```

- [ ] **Step 4: Add calendar route to app.js**

In `js/app.js`, find the `navigateTo` method. Add a case:

```js
case 'calendar':
  await LayoutView.render(renderCalendar(await this.game.getCalendarData()));
  this._bindCalendarButtons?.();
  break;
```

Add import at top: `import { renderCalendar } from './views/calendar.js';`

- [ ] **Step 5: Add calendar nav tab to layout.js**

In `js/views/layout.js`, find the sidebar navigation HTML. Add a calendar link after the dashboard link:

```html
<a class="nav-link" data-view="calendar" href="#">
  <span class="nav-icon">📅</span>
  <span class="nav-label">Calendário</span>
</a>
```

This needs to be in the HTML template where the sidebar is defined. Look for the sidebar HTML — it's probably in index.html or generated by layout.js. Check which.

- [ ] **Step 6: Commit**

```bash
git add js/views/calendar.js js/controllers/game-controller.js js/app.js
git commit -m "feat: calendario visual com timeline semanal e cards de evento"
```
