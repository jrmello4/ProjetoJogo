# Career Mode — Fase 2: Balanceamento, Contexto e Profundidade

## Escopo

6 itens independentes implementados em sequência:
1. **#4** Balanceamento geral (jogo muito fácil)
2. **#9** Social Media imprevisível
3. **#8** Rivalidades com escolhas não-óbvias
4. **#5+#6** Empresários e Academias contextuais
5. **#7** Calendário visual

---

## #4 — Balanceamento Geral

### Problema
- Jogador treina 52x/ano com 65-90% chance de ganho por atributo
- IA evolui só via `evolve()` pós-luta (~3-6x/ano), com taxa de ~16%
- Jogador ganha ~100-140 pontos/ano de treino, IA ~40-50/ano
- Derrotas não têm consequência (moral recupera em 2-3 semanas)
- Dinheiro fácil (bolsa tier 2 ~$3500+ com custo semanal ~$800)

### Mudanças

**A) Diminuir ganho semanal do jogador**
Arquivo: `js/controllers/game-controller.js` — `_applyWeeklyTraining`
- `gainChance` base: 0.35 → 0.20
- Atributo >= 70: chance * 0.5
- Atributo >= 85: chance * 0.25

**B) Evolução semanal para IA**
Arquivo: `js/services/world-service.js`
- Novo método `_evolveAIFighters(now)` chamado no fim de `processWeek()`
- Para cada fighter IA (não-player, não-retired, não-champion com contrato ativo):
  - Se `now % 4 === 0` (a cada 4 semanas): roda `fighter.evolve()` light
  - Jovens (< 30): chance 2x de insight raro

**C) Consequências de derrota**
Arquivo: `js/controllers/simulation.js` — `_updateFighter` ou pós-luta
- KO/TKO sofrido: `chin -= 2`, `durability -= 1` por 4 semanas (fragilidade temporária)
- Derrota por decisão: `morale` cai -24 (antes -12), recupera metade na semana seguinte
- Derrota recente (últimas 4 sem): -5 popularidade cumulativo por derrota adicional

**D) Aperto financeiro**
Arquivo: `js/config/game-config.js`
- `ACADEMIES`: Elite Combat Team weeklyFee 800 → 1200
- `LIFESTYLE_TIERS.luxurious.weeklyCost`: 1500 → 2000
- `OFFER_CONFIG.PURSE[2].base`: 3500 → 2800

---

## #9 — Social Media Imprevisível

### Problema
- 100% determinístico: cada opção tem efeito fixo
- Hints mostram números exatos
- Sem variação, sem contexto, sem surpresa

### Mudanças

**A) Hints não-numéricos**
Arquivo: `js/controllers/social-media.js` — `getChoices()`

| Key | Hint atual | Novo hint |
|-----|-----------|-----------|
| provoke | "Popularidade +3, risco de moral" | "Pode aumentar sua popularidade, mas é arriscado" |
| title_shot | "Só rende bem se você tem crédito" | "Depende do seu momento na carreira..." |
| respond_critics | "Pequeno e neutro" | "Uma resposta segura, sem grandes riscos" |
| stay_quiet | "Moral +3" | "Postura profissional, sempre uma escolha sólida" |

**B) Resultados probabilísticos**
Arquivo: `js/controllers/social-media.js` — `applyChoice()`

```js
case 'provoke': {
  const basePop = 2 + Math.floor(Math.random() * 4);   // 2-5
  const baseMorale = -(1 + Math.floor(Math.random() * 5)); // -1 a -5
  const viral = fighter.popularity > 50 && Math.random() < 0.08;
  const lostRecent = /* perdeu luta nas últimas 4 sem? */;
  return {
    popularity: basePop + (viral ? 6 : 0) + (streakActive ? 2 : 0),
    morale: baseMorale - (lostRecent ? 2 : 0),
    viral: viral,
    provoked: true,
  };
}
case 'title_shot': {
  if (plausible) {
    const pop = 1 + Math.floor(Math.random() * 4); // 1-4
    return { popularity: pop, provoked: false };
  }
  const moralePenalty = -(2 + Math.floor(Math.random() * 5)); // -2 a -6
  return { morale: moralePenalty, provoked: false };
}
case 'respond_critics': {
  const pop = Math.floor(Math.random() * 3); // 0-2
  return { popularity: pop, provoked: false };
}
case 'stay_quiet': {
  const morale = 1 + Math.floor(Math.random() * 4); // 1-4
  return { morale, provoked: false };
}
```

**C) Moduladores contextuais**
- Se `sponsorService` tem contrato 'clean': `provoke` reduz contador de provocações
- Se está em streak: multiplicador 1.5x nos ganhos de popularidade
- Se perdeu luta nas últimas 4 semanas: multiplicador 0.5x nos ganhos

---

## #8 — Rivalidades com Escolhas Não-Óbvias

### Problema
- Rivalidades só "existem" — não há prompts de interação
- Nenhuma escolha do jogador durante a rivalidade
- Efeitos previsíveis e desconectados de personalidade

### Mudanças

**A) Prompt semanal de rivalidade**
Arquivo: `js/services/rivalry-service.js`

Novo método `rollInteraction(fighter, rival, now)`:
- Gatilho: rivalidade ativa, intensidade >= 3, fighter sem luta na semana
- Chance: 30% por semana
- Retorna um prompt com 3 opções OU null

```js
const interaction = await rivalryService.rollInteraction(playerFighter, rivalFighter, now);
if (interaction) {
  // armazena no estado pendente (reúso do sistema SocialMedia)
  await this.db.put('gameState', { id: 'rivalry-prompt', ...interaction });
}
```

**B) Opções e efeitos contextuais**

3 opções sempre presentes:
```
A) Provocar — "você não está no meu nível"
B) Respeitar — "ele é um guerreiro, mas vou vencer"
C) Ignorar — sem comentários
```

Efeitos modulados por 4 dimensões:

1. **Personalidade do rival** (de `ACADEMIES.headCoach.personality`):
   - `aggressive`: provocar sobe intensidade +2 a +4; respeitar reduz -1; ignorar mantém
   - `cautious`: provocar não altera intensidade (rival ignora); respeitar +2 popularidade
   - `analytical`: provocar vira 'robbery' na próxima luta se perder; ignorar é seguro

2. **Momento da carreira** (último resultado):
   - Vitória recente: intensidade +1 extra em provocar
   - Derrota recente: provocar perde -2 popularidade (soa amargo)

3. **Fama relativa**:
   - Jogador menos famoso: provocar ganha +3 popularidade (underdog)
   - Jogador mais famoso: provocar sem bônus (esperado)

4. **Histórico do confronto**:
   - Perdeu o último: provocar sobe +1 intensidade extra, chance de virar 'grudge'

**C) Resultados probabilísticos**
- Faixas em vez de valores fixos: `intensityGain = 1 + Math.floor(Math.random() * 3)`
- Chance de efeito colateral: 5% de provocar viralizar (+5 pop, rival aleatório aparece)
- Não exibir números nos hints

**D) Exibição**
- Reúso do mesmo card/lógica de prompt do SocialMedia no dashboard
- `GameController.resolveRivalryInteraction(choice)` — busca fighter, aplica, salva

---

## #5 e #6 — Empresários e Academias Contextuais

### Problema
- Empresários: catálogo fixo de 3, sem ofertas contextuais por performance
- Academias: `switchAcademy()` manual ou sondagem por baixa sinergia — nunca por conquista
- Ambos deveriam reagir à carreira

### Mudanças

**A) Gatilhos unificados no RetentionService**

Estender `generateApproaches()` com `_checkMilestoneTriggers()`:

```js
async _checkMilestoneTriggers(now, fighter) {
  const triggers = [];

  // Empresário — streak de 3+
  if (fighter.record.wins - fighter.lastFightLosses >= 3) {
    triggers.push({ type: 'manager_milestone', reason: 'win_streak', target: 'manager-aggressive' });
  }
  // Empresário — cinturão conquistado
  const belts = await this.titleService.beltsOf(fighter.id);
  if (belts.length > 0 && /* conquistou recentemente */) {
    triggers.push({ type: 'manager_milestone', reason: 'belt_won', target: 'manager-loyal' });
  }
  // Empresário — nocaute recente
  if (/* último resultado foi KO/TKO */) {
    triggers.push({ type: 'manager_milestone', reason: 'ko_win', target: 'manager-conservative' });
  }

  // Academia — derrota recente
  if (/* perdeu luta nas últimas 4 sem */) {
    triggers.push({ type: 'academy_milestone', reason: 'recent_loss', target: 'academy-blacktiger' });
  }
  // Academia — 2+ vitórias consecutivas
  if (fighter.record.wins >= 2 && fighter.lastFightLosses === 0) {
    const nextTier = // academia de facilityLevel maior
    triggers.push({ type: 'academy_milestone', reason: 'rising', target: nextTier });
  }
  // Academia — rival mudou
  const rivalries = await this.rivalryService.getRivalries(fighter.id);
  for (const r of rivalries) {
    const rivalFighter = await this.fighterCtrl.getFighter(r.fighterAId === fighter.id ? r.fighterBId : r.fighterAId);
    if (rivalFighter?.academyId && rivalFighter.academyId !== fighter.academyId) {
      triggers.push({ type: 'academy_milestone', reason: 'rival_there', target: rivalFighter.academyId });
    }
  }

  return triggers;
}
```

**B) Criação da abordagem**
- Quando um trigger é encontrado, criar `pendingApproach` igual ao sistema atual
- Adicionar `data.reason` e `data.origin` para contexto na UI
- Se já existe approach pendente, não sobrescrever (respeitar o que veio primeiro)
- Chance base: 40% por trigger por semana (não é garantido — mercado não é instantâneo)

**C) Exibição**
- Dashboard: card "Proposta de [empresário/academia]" com texto contextual
- Ex: "João Bittencourt notou seu último nocaute e quer conversar sobre representação."
- Ex: "A Elite Combat Team está de olho na sua ascensão. Quer fazer um teste?"
- Mesmas 4 opções de resposta: renegociar, bônus, promessa, trocar

---

## #7 — Calendário Visual

### Conceito
Nova aba no menu principal que mostra uma timeline semanal com ícones, dividindo visualmente o ano e destacando eventos importantes.

### Fonte dos dados
`GameController.getCalendarData(now, fighter)` computa:

```js
{
  currentWeek: now,
  entries: [
    {
      absWeek: number,
      weekType: 'training' | 'camp' | 'recovery' | 'fight' | 'suspended' | 'press_conf' | 'sponsor',
      label: string,       // "Semana 12, Ano 2"
      icon: string,         // emoji
      details: string|null, // "Luta vs João (AFC)" | null
      isFightWeek: boolean,
      isCurrentWeek: boolean,
      isPastWeek: boolean,
    }
  ],
  upcomingFight: { opponentName, promotionName, absWeek, isTitleFight } | null,
  nextEvents: [ /* promo events */ ]
}
```

### Layout
- Scroll vertical, semanas em grid de cards
- Card atual destacado (borda/background diferente)
- Semanas futuras com opacidade reduzida
- Cada card: número da semana + ícone do evento + label opcional
- Card de luta expandido com detalhes (oponente, promoção, link para perfil)
- Tooltip/expansão ao clicar em uma semana

### View
Arquivo: `js/views/calendar.js`

```js
export function renderCalendar(calendarData) {
  // Gera HTML da timeline
  // Destaque para semana atual
  // Cards de luta clicáveis
}
```

### Integração
- Adicionar aba "Calendário" no menu (layout.js)
- Rota em `app.js` `navigateTo('calendar')` → `renderCalendar()`
- Chamar `GameController.getCalendarData()` no render

### Estados
- **Semana sem eventos**: só treino normal
- **Semana com luta**: card expandido com detalhes
- **Suspensão**: cor cinza com tooltip "Suspensão médica — N semanas restantes"
- **Camp**: cor laranja com tooltip "Intensidade: moderada/intensa"
- **Sem evento especial**: layout padrão
- **Carregando**: spinner

### Reúso
- Usa `SUSPENSION_CONFIG` e `computeSuspensionWeeks()` já existentes
- Usa `offerService.getAccepted()` para luta marcada
- Usa `fighter.trainingFocus` e `CAMP_CONFIG` para semanas de camp

---

## Arquivos modificados (completos)

| Item | Arquivos | Tipo |
|------|----------|------|
| #4 | `js/config/game-config.js` | Config tuning |
| #4 | `js/controllers/game-controller.js` | Training gain reduction |
| #4 | `js/services/world-service.js` | AI weekly evolution |
| #4 | `js/models/fighter.js` | Temporary stat penalties |
| #4 | `js/controllers/simulation.js` | Loss consequences |
| #9 | `js/controllers/social-media.js` | Probabilistic outcomes |
| #9 | `js/config/game-config.js` | Social config tuning |
| #8 | `js/services/rivalry-service.js` | Interaction prompts |
| #8 | `js/controllers/game-controller.js` | Resolve rivalry prompt |
| #8 | `js/views/dashboard.js` | Rivalry prompt card |
| #5+#6 | `js/services/retention-service.js` | Milestone triggers |
| #5+#6 | `js/controllers/game-controller.js` | Process triggers |
| #7 | `js/views/calendar.js` | New view |
| #7 | `js/app.js` | Calendar route |
| #7 | `js/views/layout.js` | Calendar tab |
| #7 | `js/controllers/game-controller.js` | Calendar data |
