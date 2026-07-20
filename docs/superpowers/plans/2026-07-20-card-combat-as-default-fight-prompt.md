# Prompt: Tornar o combate por cartas o sistema oficial de luta

## Contexto

Este projeto (MMA career sim, vanilla JS/ES modules, vitest) tem DOIS motores de luta hoje:

1. **`js/controllers/simulation.js`** (`SimulationEngine.simulateFight`) — motor antigo, passivo/estatístico. É o único caminho REAL usado pelo jogo hoje, chamado em `js/services/world-service.js:348` dentro de `_runEvent()`.
2. **Sistema de combate por cartas** (branch `feat/roguelike-deckbuilder`, já mergeado em `main` em 2026-07-20, 22 commits) — motor de turno ativo com cartas, posições, cooldowns, IA. Totalmente funcional, mas hoje só é alcançável via `?cardCombat=true` na URL + chamada manual no console (`app.runCardFight(...)`). NÃO está ligado ao fluxo real de luta.

**Tarefa:** ligar o sistema de cartas como o motor OFICIAL e padrão de luta, substituindo `SimulationEngine.simulateFight` no caminho real (`world-service.js:348`), pra qualquer jogador que jogue normalmente (sem flag, sem console) já jogue de cartas.

Leia primeiro:
- `docs/superpowers/specs/2026-07-20-roguelike-deckbuilder-design.md` (design original)
- `docs/superpowers/plans/2026-07-20-roguelike-deckbuilder-plan.md` (plano das 12 tasks já implementadas)

## Arquitetura já existente (não redesenhar do zero)

- `js/config/card-config.js` — `POSITIONS`, `ACTIVE_CARDS`, `PASSIVE_CARDS`, `DEFAULT_LOADOUTS`, `getDefaultLoadout(gamePlanKey)`.
- `js/controllers/combat-engine.js` — `CombatEngine`. **O método gerador `*runFight()` é código morto — NINGUÉM o consome.** O loop real de turno vive reimplementado manualmente em `combat-adapter.js`. Não tente usar o generator.
- `js/controllers/combat-resolver.js` — `CombatResolver.resolveTurn/checkFinish/scoreRound`.
- `js/controllers/ai-combat.js` — `AICombat.selectCard/selectMoveAction/selectLoadout`. `selectLoadout(state, tapeData)` já sabe counter-picar via `TapeService` (Task 12).
- `js/controllers/combat-adapter.js` — `CombatAdapter.runFight(fighterA, fighterB, fiveRounds, gamePlanKey, promoTier, isTitleFight)`. Hoje **sempre espera clique do jogador (side A) via Promise** (`_waitForPlayerAction`). Isso é o maior obstáculo pra virar padrão — ver seção "Decisão de arquitetura" abaixo.
- `js/services/tape-service.js` — `getFavoredPlanData(fighter)` (novo, Task 12).
- `js/services/card-reward-service.js`, `js/services/meta-progression-service.js` — recompensa pós-luta e meta-progressão entre carreiras (IndexedDB, store `gameState`, chave `'metaProgression'`).
- `js/views/card-combat-view.js` — UI de combate. Renderiza via `container.innerHTML` — hoje é chamada com um `#fight-container` criado ad-hoc (`app.js`'s `runCardFight`), não com o `#mainContent` real do `LayoutView`.
- `CombatEngine._buildResult()` já produz o formato de retorno compatível com o que `world-service.js` espera de `simulateFight()` (mesmos campos: `fighterAId/BId`, `winnerId`, `method`, `round`, `stats`, `rounds`, `totalScoreA/B` etc.) — isso foi verificado/mantido em todas as 12 tasks. Confirme que ainda bate exatamente com o que `world-service.js` lê do resultado antes de trocar a chamada.

## O bloqueio real: `_runEvent` roda tanto ao vivo quanto em fast-forward silencioso

`world-service.js._runEvent()` (chamado por `processWeek()`) é usado em DOIS modos:

1. **Avançar Semana (ao vivo)** — jogador está na tela, pode interagir. Hoje isso já é parcialmente interativo: `cornerHooks` (passado só quando existe UI ao vivo) permite `onFightStart`/`onRoundEnd` pausarem e esperarem escolha do jogador — ver `world-service.js:298-304`.
2. **Simular Período / fast-forward (`GameController.simulateWeeks(N)`)** — roda várias semanas em lote, SEM UI, sem `cornerHooks`. É testado por `test/simulate-week.test.js` (60 semanas seguidas, fake-indexeddb) — **esse teste não pode quebrar**.

`CombatAdapter.runFight` hoje SEMPRE pausa esperando clique de `side A`, mesmo sem UI — isso trava fast-forward pra sempre (a Promise nunca resolve).

### Decisão de arquitetura já tomada (não precisa perguntar de novo)

Quando `cornerHooks` for `null` (fast-forward, sem UI — mesmo sinal que o código já usa hoje pra saber se está ao vivo), o lado A (jogador) também deve ser controlado por `AICombat.selectCard`/`selectMoveAction`, exatamente como o lado B — reaproveitando 100% do motor já construído, sem esperar clique nenhum, resolvendo a luta inteira de forma síncrona/instantânea. Isso significa:

- Adicionar um parâmetro `interactive = true` em `CombatAdapter.runFight(...)`. Quando `false`, a "jogada do jogador" cada turno vem de `AICombat.selectCard`/`selectMoveAction` chamado pra side A (não de `_waitForPlayerAction`), e nenhuma renderização de UI/DOM precisa acontecer (pule `this.view.render`/`update`/`_showTurnResult`/`_showCardReward`/`_showCornerOffer` quando `interactive === false` — ou torne-os no-op).
- Quando `interactive === true` (ao vivo, `cornerHooks` presente), o jogador joga de verdade via UI, igual já funciona hoje no `runCardFight` de dev/teste.

## O que precisa ser feito

1. **`combat-adapter.js`**: adicionar suporte a modo não-interativo (`interactive` flag) conforme acima, sem quebrar o modo interativo existente.
2. **`world-service.js`**: na `_runEvent()`, pra fight que tem `fight.booking` (a luta do jogador — mesma condição que já gate ia `cornerHooks`/`tactics` hoje), trocar a chamada de `SimulationEngine.simulateFight(...)` por um caminho que usa `CombatAdapter` + `CombatEngine`/`CombatResolver`/`AICombat`, passando `interactive: !!cornerHooks`. Lutas de IA-vs-IA (sem `fight.booking`) continuam no motor antigo — não precisam de UI de cartas nunca, não vale o custo de portar.
3. **`app.js`**: no ponto onde hoje `LiveFightHubView.render(fA, fB, playerResult)` mostra o REPLAY de um resultado já computado (por volta de `app.js:1054`, dentro do handler pós-`processWeek`), isso precisa mudar de modelo: hoje a luta é computada TODA antes, depois animada. Com cartas ao vivo, a luta PRECISA acontecer ao vivo (esperando clique) ANTES do resto da semana ser processado — ou seja, o ponto de entrada da UI de combate por cartas precisa entrar DENTRO do fluxo de `processWeek`/`_runEvent`, não depois. Avalie se dá pra manter a UI de cartas rodando via `cornerHooks.onFightStart`-like hook (que já é `await`ado dentro de `_runEvent`) — provavelmente a forma mais limpa é fazer o `cornerHooks` que `app.js` passa pra `processWeek` incluir uma referência de container/callback que deixa `world-service.js` chamar a UI de cartas ao vivo ali mesmo, via `await`, antes de seguir pro resto do processamento da semana.
4. Manter formato de retorno 100% compatível — todo o resto de `_runEvent` (título, purse, TapeService.recordFight, notificações, rivalidades) continua lendo `result` do jeito que já lê hoje.
5. **Não apagar `simulation.js`** — luta de IA-vs-IA (sem jogador) continua usando ele. Só a luta do jogador troca de motor.
6. Rodar `npx vitest run` no final — TEM que passar, especialmente `test/simulate-week.test.js` (60 semanas de fast-forward, é o teste que valida que `processWeek()`/`simulateWeeks()` não quebraram).
7. Testar manualmente no browser (preview): criar personagem, aceitar uma luta, clicar "Avançar Semana", confirmar que a tela de combate por cartas aparece de verdade e é jogável (clicar carta, ver resultado, luta termina, resto da semana processa normal).

## Processo recomendado

Use `superpowers:subagent-driven-development` (ou `superpowers:writing-plans` + `superpowers:executing-plans` se preferir sessão separada) — este é um plano do tipo "toque grande em arquivo crítico" (o `world-service.js` real, usado por TODA luta do jogo), então merece o mesmo rigor de implementador+revisor por tarefa que as 12 tasks anteriores tiveram, com fix-and-re-review quando o revisor achar problema. Não pule etapas de teste — este é o ponto de maior risco de regressão do projeto inteiro até agora.

## O que NÃO fazer

- Não invente sistema novo de fast-forward — reaproveite `AICombat` pros dois lados.
- Não apague `simulation.js` (ainda serve pra IA-vs-IA).
- Não quebre `test/simulate-week.test.js`.
- Não mude o formato de retorno que `world-service.js` espera sem atualizar todos os call sites que leem `result`.
