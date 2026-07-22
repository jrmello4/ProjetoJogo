# Mapa de Responsabilidades — game-controller.js → Nova Arquitetura

> Documento de planejamento da extração. Nenhum código é alterado nesta etapa.
> Data: 2026-07-22
> Contexto: Reestruturação em 5 Pilares (CARREIRA, PREPARAÇÃO, COMBATE, CONSEQUÊNCIAS, LEGADO)

---

## 1. VISÃO GERAL DO game-controller.js

**Arquivo:** `js/controllers/game-controller.js`
**Tamanho:** ~2050 linhas, 31K+ tokens
**Papel atual:** Orquestrador monolítico — inicializa tudo, processa o tick semanal inteiro,
e serve como facade para todas as queries do dashboard.

**Três grandes problemas de responsabilidade:**

| Problema | Impacto |
|----------|---------|
| `init()` cria 20+ serviços inline | Qualquer mudança exige tocar neste método |
| `processWeek()` faz 30+ operações diferentes | ~400 linhas, impossível de testar isoladamente |
| `getDashboard()` coleta dados de 15+ fontes | ~150 linhas, acoplamento view x serviço direto |

---

## 2. MAPA DETALHADO — CADA RESPONSABILIDADE COM DESTINO

### 2.1 INICIALIZAÇÃO (constructor + init + bootstrap)

| Código atual | Responsabilidade | Destino | Justificativa |
|---|---|---|---|
| `constructor()` (L74-99) | Declara propriedades | **CareerRuntime** | Runtime assume a orquestração |
| `init()` L101-150 | Cria 20+ serviços + registra handlers + bootstrap/migrate | **CareerRuntime.init()** | Extrair em blocos: (1) criar serviços, (2) registrar eventos, (3) bootstrap/migrate |
| `_bootstrapNewWorld()` (L317-395) | Cria promoções, roster, academias, empresários, FAs, cinturões | **CareerRuntime.bootstrapWorld()** | Operação única de setup do mundo |
| `_migrateWorld()` (L208-241) | Migração de schema | **SaveService.migrate()** | Já é quase isolado — só precisa do DB |
| `_applySchemaMigration()` (L243-259) | Migração individual por versão | **SaveService.applyMigration()** | |
| `_applyPatches()` (L191-202) | Patches pós-migração | **SaveService.applyPatches()** | |
| `_registerDomainReactions()` (L152-188) | CareerEvents handlers (notificações + careerLog + narrativeChain) | **CareerRuntime.init()** + **ConsequencePipeline** | A parte de narrativeChain pós-FIGHT_COMPLETED pertence ao pipeline de consequências |
| `_registerCareerEventHandlers()` (L261-282) | CareerEventBus handlers (rivalidade pós-luta + sinergia) | **CareerRuntime.init()** + **RivalryService** (já escuta eventos) | |

### 2.2 SERVIÇOS DE DOMÍNIO (queries day-to-day)

| Código atual | Responsabilidade | Destino | Justificativa |
|---|---|---|---|
| `getPlayerFighter()` (L589-591) | Busca lutador do jogador | **CareerRuntime.getPlayer()** | Delega para FighterController |
| `getAcademies()` (L488-491) | Lista academias | **CareerRuntime.getAcademies()** | Query de domínio da carreira |
| `getAcademy()` (L493-497) | Busca academia por ID | **CareerRuntime.getAcademy()** | |
| `getPlayerAcademy()` (L499-502) | Academia do jogador | **CareerRuntime.getPlayerAcademy()** | |
| `getManagers()` (L537-539) | Lista empresários | **CareerRuntime.getManagers()** | |
| `getPlayerManager()` (L541-544) | Empresário do jogador | **CareerRuntime.getPlayerManager()** | |
| `getMilestones()` (L1579-1603) | Lista definições de milestones | **CareerRuntime.getMilestones()** | |
| `_findFightOffer()` (L1985-1992) | Helper de busca de oferta | **OfferService** (ou CareerRuntime helper) | Operação de dados pura |

### 2.3 AÇÕES DO JOGADOR — CARREIRA (muta estado)

| Código atual | Responsabilidade | Destino | Justificativa |
|---|---|---|---|
| `createPlayerFighter()` (L401-477) | Cria personagem | **CareerRuntime.createPlayer()** | OR: app.js chama diretamente + FighterController |
| `_ensureInitialOffers()` (L479-485) | Gera ofertas iniciais | **CareerRuntime.createPlayer()** (inline) | |
| `switchAcademy()` (L511-534) | Troca de academia | **CareerRuntime.switchAcademy()** | Orquestra Academy model + careerLog |
| `hireManager()` (L546-553) | Contrata empresário | **CareerRuntime.hireManager()** | |
| `terminateManager()` (L555-562) | Demite empresário | **CareerRuntime.terminateManager()** | |
| `setLifestyle()` (L565-586) | Define padrão de vida | **CareerRuntime.setLifestyle()** | |
| `changeWeightClass()` (L1996-2049) | Mudança de peso | **CareerRuntime.changeWeightClass()** | Orquestra titleService + offerService |
| `getSigningConflict()` (L1657-1661) | Verifica conflito cinturão-contrato | **CareerRuntime.getSigningConflict()** | |
| `signContractWithVacate()` (L1666-1681) | Assina contrato + vaga cinturão | **CareerRuntime.signContract()** | |

### 2.4 AÇÕES DO JOGADOR — OFERTAS + PATROCÍNIOS

| Código atual | Responsabilidade | Destino | Justificativa |
|---|---|---|---|
| `acceptOffer()` (L1399-1417) | Aceita oferta de luta | **CareerRuntime.acceptOffer()** | Orquestra OfferService + partners + onboarding |
| `declineOffer()` (L1422-1437) | Recusa oferta | **CareerRuntime.declineOffer()** | Orquestra OfferService + partners + careerLog |
| `negotiateOffer()` (L1557-1564) | Negocia bolsa | **CareerRuntime.negotiateOffer()** | |
| `setBait()` (L1442-1455) | Define isca | **PreparationRuntime.setBait()** | É estratégia de luta, pertence à preparação |
| `acceptSponsorOffer()` (L1567-1572) | Aceita patrocínio | **CareerRuntime.acceptSponsor()** | SponsorService |
| `declineSponsorOffer()` (L1574-1576) | Recusa patrocínio | **CareerRuntime.declineSponsor()** | |

### 2.5 PREPARAÇÃO (CAMP + TREINO + SCOUTING)

| Código atual | Responsabilidade | Destino | Justificativa |
|---|---|---|---|
| `_applyWeeklyTraining()` (L1109-1135) | Treino semanal automático | **PreparationRuntime.applyWeeklyTraining()** | |
| `resolveWeeklyTraining()` (L1237-1272) | Resolve escolha de treino semanal | **PreparationRuntime.resolveWeeklyTraining()** | |
| `_applyWeeklyCamp()` (L1274-1351) | Processa camp semanal | **PreparationRuntime.processCamp()** |
| `setTrainingFocus()` (L1353-1360) | Define foco de treino | **PreparationRuntime.setTrainingFocus()** | |
| `studyOpponent()` (L1363-1375) | Estuda adversário (scouting) | **PreparationRuntime.studyOpponent()** | ScoutingService |
| `setGamePlan()` (L1377-1393) | Define plano de luta | **PreparationRuntime.setGamePlan()** | OfferService |
| `opponentDossier()` (L1457-1494) | Dossiê do oponente | **PreparationRuntime.opponentDossier()** | Agrega scouting + tape + manager |
| `_theirRead()` (L1503-1544) | "O que eles sabem de você" | **PreparationRuntime.theirRead()** | TapeService + scouting |
| `setWeeklyActivity()` (L1547-1554) | Atividade de lazer | **PreparationRuntime.setActivity()** | |

### 2.6 PESAGEM

| Código atual | Responsabilidade | Destino | Justificativa |
|---|---|---|---|
| `resolveWeighIn()` (L1155-1222) | Resolve pesagem | **PreparationRuntime.resolveWeighIn()** | Parte da preparação pré-luta |
| `_autoResolveDueWeighIn()` (L1147-1153) | Auto-pesagem semanal | **PreparationRuntime.autoResolveWeighIn()** | |

### 2.7 PROCESSWEEK — O GRANDE TICK SEMANAL

Este é o coração do problema. O `processWeek()` (L595-999) faz ~30 operações
sequenciais. Aqui está cada uma:

| Ordem | Operação | Destino | Observação |
|---|---|---|---|
| 1 | Snapshot pré-semana | **CareerRuntime.processWeek()** | Estado inicial |
| 2 | `_autoResolveDueWeighIn()` | → **PreparationRuntime** | Chamada dentro do tick |
| 3 | `worldService.processWeek()` | → **CareerRuntime** (delega para WorldService) | O tick do mundo continua sendo do WorldService |
| 4 | Re-busca do fighter | **CareerRuntime.processWeek()** | Necessário porque WorldService alterou o fighter |
| 5 | XP por luta | → **CareerRuntime** (pós-luta) | Level/XP |
| 6 | Super fight, title defense, double champion tracking | → **ConsequencePipeline** | Processado como consequência da luta |
| 7 | Last fight pending | → **CareerController** (ou ConsequencePipeline) | Fim de carreira |
| 8 | `offerService.expireOld()` | → **CareerRuntime** | Manutenção semanal |
| 9 | `offerService.generateWeekly()` | → **CareerRuntime** | Geração semanal |
| 10 | `contractService.generateOffers()` | → **CareerRuntime** | Geração semanal |
| 11 | `FinanceController.applyWeeklyEconomy()` | → **CareerRuntime** | Custo semanal |
| 12 | `FinanceController.applyWeeklyServices()` | → **CareerRuntime** | Serviços opcionais |
| 13 | Passive income (retired) | → **CareerRuntime** | |
| 14 | `sponsorService.processWeek()` | → **CareerRuntime** | |
| 15 | `_applyWeeklyTraining()` | → **PreparationRuntime** | Treino semanal |
| 16 | Weekly training prompt check | → **PreparationRuntime** | |
| 17 | XP por treino | → **CareerRuntime** | Level/XP |
| 18 | `careerCtrl.processInjuryStages()` | → **ConsequencePipeline** | Lesão como consequência |
| 19 | `TapeService.decayIdle()` | → **PreparationRuntime** | Tape decay |
| 20 | `narrativeCtrl.checkExpectations()` | → **ConsequencePipeline** | Expectativas |
| 21 | `_applyWeeklyCamp()` | → **PreparationRuntime** | Camp semanal |
| 22 | Camp cancelado por lesão | → **PreparationRuntime** | |
| 23 | `careerCtrl.checkMilestones()` | → **ConsequencePipeline** | Marcos da carreira |
| 24 | `narrativeCtrl.generateHeadlines()` | → **ConsequencePipeline** | Notícias pós-luta |
| 25 | `narrativeCtrl.generateCallouts()` | → **ConsequencePipeline** | Provocações |
| 26 | `narrativeCtrl.processRivalArcs()` | → **ConsequencePipeline** | Arcos de rival |
| 27 | `FinanceController.applyWeeklyActivity()` | → **CareerRuntime** | Lazer semanal |
| 28 | `narrativeCtrl.rollSocialMediaPrompt()` | → **ConsequencePipeline** | Redes sociais |
| 29 | Rivalry interaction prompt | → **ConsequencePipeline** | |
| 30 | Narrative event prompt (a cada ~5 semanas) | → **ConsequencePipeline** | |
| 31 | `podcastService.processWeek()` | → **LegacyRuntime** | |
| 32 | `CrowdService.applyWeeklyDecay()` | → **ConsequencePipeline** | |
| 33 | Year review (a cada 52 semanas) | → **LegacyRuntime** | |
| 34 | "Até o Fim" mechanics | → **ConsequencePipeline** | |
| 35 | `fighter.checkNumericDiscovery()` | → **ConsequencePipeline** | DNA |
| 36 | DNA discovery → careerLog | → **ConsequencePipeline** | |
| 37 | Retirement window check | → **CareerController** (ou CareerRuntime) | |
| 38 | End-of-career prompt | → **CareerController** | |
| 39 | Forced retirement | → **CareerController** | |
| 40 | `fighterCtrl.updateFighter()` | → **CareerRuntime** (salva no fim) | |
| 41 | Cash negative check | → **CareerRuntime** | Warning |
| 42 | `seasonService.commitWeekAdvance()` | → **CareerRuntime** | Avança semana |
| 43 | `careerEventBus.emit(WEEK_PROCESSED)` | → **CareerRuntime** | Notifica todos |

### 2.8 SIMULATE WEEKS (fast-forward)

| Código atual | Responsabilidade | Destino | Justificativa |
|---|---|---|---|
| `simulateWeeks()` (L1002-1105) | Simulação automática de N semanas | **CareerRuntime.simulateWeeks()** | Orquestra o mesmo fluxo do processWeek + auto-accept |

### 2.9 NARRATIVA / CONSEQUÊNCIAS (resolução de prompts do jogador)

| Código atual | Responsabilidade | Destino | Justificativa |
|---|---|---|---|
| `resolveSocialPrompt()` (L1137-1141) | Resolve post de rede social | → **NarrativeController** (já delega) | Já está no lugar certo |
| `resolveRivalryInteraction()` (L1224-1228) | Resolve interação de rivalidade | → **NarrativeController** (já delega) | |
| `resolveNarrativeChoice()` (L1230-1234) | Resolve evento narrativo | → **NarrativeController** (já delega) | |
| `resolveRehabChoice()` (L1799-1803) | Escolha de reabilitação | → **CareerController** (já delega) | |
| `resolveEndCareer()` (L1805-1807) | Escolha de fim de carreira | → **CareerController** (já delega) | |
| `dismissOnboarding()` (L1977-1982) | Dispensa onboarding | → **CareerRuntime** | |

### 2.10 DASHBOARD — A GRANDE QUERY

| Código atual | Responsabilidade | Destino | Justificativa |
|---|---|---|---|
| `getDashboard()` (L1810-1973) | Agrega dados de 15+ fontes para a view inicial | **CareerRuntime.getDashboard()** | Permanece como query agregadora, mas extrai blocos para sub-runtimes |

**Sub-responsabilidades do getDashboard():**

| Sub-consulta | Destino |
|---|---|
| Fighter + academy + manager | CareerRuntime |
| Pending offers + bookings | CareerRuntime (OfferService) |
| Promotions | CareerRuntime (WorldService) |
| Past events | CareerRuntime (EventController) |
| Milestones | CareerRuntime |
| Rankings + champions | CareerRuntime (RankingService) |
| Belts + contender status | CareerRuntime (TitleService) |
| Weigh-in prompt | PreparationRuntime |
| Social prompt | ConsequencePipeline (SocialMediaService) |
| Rivalry prompt | ConsequencePipeline |
| Narrative prompt | ConsequencePipeline |
| Weekly training prompt | PreparationRuntime |
| Podcast + year review | LegacyRuntime |
| Crowd snapshot | ConsequencePipeline (CrowdService) |
| Media compare (rival) | ConsequencePipeline (RivalryService) |
| Pending rehab | CareerRuntime (CareerController) |
| Readiness | PreparationRuntime |
| Narrative chains | ConsequencePipeline |
| Onboarding | CareerRuntime |
| End career prompt | CareerRuntime (CareerController) |

### 2.11 CALENDÁRIO

| Código atual | Responsabilidade | Destino | Justificativa |
|---|---|---|---|
| `getCalendarData()` (L1684-1765) | Dados do calendário visual | **CareerRuntime.getCalendar()** | Agrega booking + promoções + status médico |

### 2.12 DEBUG

| Código atual | Responsabilidade | Destino | Justificativa |
|---|---|---|---|
| `getDebugSnapshot()` (L305-311) | Snapshot de depuração | **DebugService** (já existe) | |

### 2.13 COACH SYNERGY (pós-luta)

| Código atual | Responsabilidade | Destino | Justificativa |
|---|---|---|---|
| `_applyCoachSynergyFromFight()` (L284-303) | Sinergia com técnico baseada em seguir instruções do corner | **ConsequencePipeline** | Consequência de luta |

---

## 3. O QUE NÃO MEXE (KEEP)

Estes serviços já estão bem isolados e não precisam de mudanças:

| Serviço | Motivo |
|---|---|
| `WorldService` | Já é chamado via `processWeek()`. Só mudar quem chama. |
| `FighterController` | CRUD puro, baixo acoplamento |
| `InjuryService` | Já foi extraído na Fase 14 |
| `RivalryService` | Autocontido |
| `SocialMediaService` | Já abstraído |
| `PodcastService` | Já abstraído |
| `YearReviewService` | Já abstraído |
| `BiographyService` | Já abstraído |
| `HallOfFame` | Já abstraído |
| `CareerLogService` | Já abstraído |
| `CareerEventBus` | Já abstraído |
| `SaveService` | Já abstraído |
| `CombatEngine`, `CombatResolver`, `CombatAdapter` | Já isolados |
| `FinanceController` (static methods) | Funções puras, sem estado |

---

## 4. PLANO DE EXTRAÇÃO SEGURO

### Princípios

1. **Nunca mover lógica e mudar comportamento no mesmo commit.**
2. **Cada Runtime começa como wrapper** que chama o game-controller existente.
3. **Views continuam chamando `game.xxx()`** — o facade permanece até tudo estar migrado.
4. **Remover do game-controller só no fim**, quando nenhuma view mais o chama diretamente.

### Extração em ondas

```
ONDA 0: Criar estrutura (zero mudança de lógica)
  ├── Criar pasta js/runtimes/
  ├── Criar CareerRuntime (vazio, só esqueleto)
  ├── Criar PreparationRuntime (vazio)
  └── Criar LegacyRuntime (vazio)

ONDA 1: CareerRuntime — inicialização + queries estáveis
  ├── Mover init() → CareerRuntime.init() (todo o setup de serviços)
  ├── Mover bootstrap → CareerRuntime.bootstrapWorld()
  ├── Mover getPlayerFighter, getAcademies, getAcademy, getManagers etc.
  └── game-controller.init() vira: this.runtime = new CareerRuntime(); await this.runtime.init()

ONDA 2: CareerRuntime — processWeek (parte 1: mundo + economia)
  ├── Extrair blocos 1-14 do processWeek para CareerRuntime
  ├── Extrair simulateWeeks
  └── game-controller.processWeek() chama CareerRuntime.processWeek()

ONDA 3: PreparationRuntime — camp + treino + scouting
  ├── Mover _applyWeeklyTraining, resolveWeeklyTraining, _applyWeeklyCamp
  ├── Mover studyOpponent, setGamePlan, opponentDossier, _theirRead
  ├── Mover setTrainingFocus, setWeeklyActivity
  └── Mover resolveWeighIn, _autoResolveDueWeighIn

ONDA 4: ConsequencePipeline — chain de handlers do CareerEventBus
  ├── Criar pipeline sequencial: FIGHT_COMPLETED → [injury, narrative, rivalry, ranking, finance, careerLog, nChain]
  ├── Extrair blocos 5-7, 18, 20, 23-30, 34-36 do processWeek
  └── Registrar handlers no CareerEventBus

ONDA 5: LegacyRuntime — podcast + yearReview + biografia + HoF
  ├── Mover podcastService.processWeek
  ├── Mover yearReviewService.processYearEnd
  └── Registrar no CareerEventBus (WEEK_PROCESSED)

ONDA 6: Dashboard — query agregadora
  ├── Extrair getDashboard para CareerRuntime
  └── Cada sub-consulta chama o Runtime dono do dado

ONDA 7: game-controller.js vira facade puro
  ├── Cada método público do game-controller delega para o Runtime correspondente
  └── app.js importa os Runtimes diretamente (opcional)
```

### Risco "novo monólito"

**Problema:** `CareerRuntime` pode virar o novo `game-controller.js` se não houver
disciplina.

**Mitigação:**
1. CareerRuntime **não contém lógica de domínio** — só orquestra chamadas para
   os serviços especializados.
2. Toda branch condicional (`if fighter.status === 'injured'`) permanece no
   serviço dono da regra, não no Runtime.
3. Limite de 200 linhas por método de Runtime. Se um método crescer, extrair
   para um sub-método ou serviço.
4. `processWeek()` do CareerRuntime vira uma sequência de chamadas nomeadas:

```js
// NO CareerRuntime — NÃO o monolito atual
async processWeek(cornerHooks) {
  const snapshot = await this._snapshot()
  await this.preparation.autoResolveWeighIn(snapshot)
  const world = await this.world.tick(snapshot.now, snapshot.fighter)
  const fighter = await this.getPlayer()
  await this._postFightProcessing(world, fighter)
  await this.economy.processWeek(fighter)
  await this.preparation.processWeek(fighter)
  await this.consequences.processWeek(fighter, world)
  await this.legacy.processWeek(fighter)
  await this._finalize(snapshot, fighter, world)
}
```

---

## 5. DEPENDÊNCIAS CRÍTICAS

| Dependência | Por que é crítica |
|---|---|
| `WorldService` precisa do `RivalryService` no construtor | WorldService usa rivalry para hype de revanche. Se mudar a ordem de init, quebra. |
| `processWeek()` busca fighter ANTES e DEPOIS do WorldService | A re-busca é essencial — WorldService muta o fighter. |
| `NotificationService` é usado por TODO mundo | Deve ser singleton injetado em todos os Runtimes. |
| `CareerLogService` é usado por TODO mundo | Mesmo tratamento do NotificationService. |
| `CareerEventBus` é o backbone de comunicação entre runtimes | Não mudar interface. Só adicionar assinaturas. |

---

## 6. RESUMO DA MIGRAÇÃO

| De | Para | Responsabilidades |
|---|---|---|
| game-controller.js | **CareerRuntime** | 35+ responsabilidades (init, bootstrap, tick principal, queries, ações) |
| game-controller.js | **PreparationRuntime** | 12 responsabilidades (camp, treino, scouting, tape, pesagem) |
| game-controller.js | **ConsequencePipeline** | 15+ responsabilidades (pós-luta: lesão, narrativa, rivalidade, ranking, DNA, expectativas) |
| game-controller.js | **LegacyRuntime** | 3 responsabilidades (podcast, year review) |
| game-controller.js → NarrativeController | (já está no lugar) | Social, rivalidade, narrativa — só mudar quem chama |

**Nenhum serviço existente é movido ou fundido.** Eles continuam nos mesmos
arquivos. Só a orquestração muda.
