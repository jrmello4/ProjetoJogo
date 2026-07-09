# MMA Manager — PRD de Execução

> **Fonte de verdade do que falta construir.** Substitui `ROADMAP_FUTURE.md` e
> `TODO_REMAINING.md`, que descrevem o modo organização (pré-pivot) e afirmam
> coisas que não são mais verdade.
>
> Última atualização: 09/07/2026 (revisão de alinhamento com o código —
> Épicos D e E concluídos, correção de performance das cenas 3D)

### Changelog desta revisão (09/07/2026)

- **Épico D (Acampamento de verdade): ✅ CONCLUÍDO.** O camp virou configuração
  que roda dentro de `_applyWeeklyTraining()` — não é mais botão manual. Fecha
  de vez o bug/exploit B3.
- **Épico E (O Corpo): ✅ CONCLUÍDO.** E1 (mudança de divisão), E2 (dano
  permanente por KO/TKO) e E3 (declínio por idade) todos implementados e lidos
  pela simulação.
- **B6 (coletiva órfã): ✅ RESOLVIDO.** `renderPressConference()` agora usa o
  booking real, o adversário real e a promoção real.
- **Performance: ✅ CORRIGIDO.** As cenas Three.js acumulavam loops `rAF`
  zumbis a cada navegação (o jogo travava com o tempo de jogo). Ver seção 11.
- **Restante:** o miolo da narrativa (Épico F além da coletiva), o backlog
  (seção 8) e **dois épicos novos consolidados** de um roadmap antigo. O núcleo
  de simulação/carreira está completo.
- **Roadmap consolidado (Fases 0–2) adicionado à seção 9.** Fundiu o backlog
  G1–G7, os "buracos de gênero" e o roadmap antigo numa lista só, eliminando
  duplicatas. Item novo crítico que não estava em nenhuma lista:
  **Regeneração do Mundo** (o pool de lutadores não se renova — com aposentadoria
  e declínio ativos, a carreira longa esvazia). Escopo travado **até a Fase 2**;
  Fase 3 (regiões, eras, mídia) e itens de "tempero" (doping, empresários) ficam
  explicitamente estacionados.

---

## ⚠️ REALITY CHECK (playtest de 09/07/2026)

> **Este bloco é a fonte de verdade mais atual.** As seções 7–9 abaixo descrevem
> vários itens como "a construir", mas um playtest revelou que **grande parte já
> está implementada no working tree (não commitada)**. Quando este bloco e as
> seções antigas divergirem, **este bloco vence**. A reconciliação completa das
> seções fica para depois de commitar e validar.

**Já implementado no working tree (verificado no playtest):**
- **Épico F parcial** — F1 (hype da coletiva → bônus de bolsa via
  `HYPE_PURSE_RATIO` + heat na rivalidade) ligado ponta a ponta; F2
  (`GameController._checkExpectations`) e F3 (`_generateCallouts`, inbox de
  callouts) parcialmente construídos.
- **Fase 1 — Regeneração do Mundo** — funciona: safra anual (`generateProspect`),
  patch aditivo `worldRegen`, teto de população (`POPULATION_CAP = 300`) que
  segura o nº de ativos, aposentadorias por idade.
- **Fase 2 — Live Fight Hub** — construído (`js/views/live-fight-hub.js`) e
  integrado no `advanceWeek`; a simulação emite beats por round (`roundLog`).
- **G5 — Cerimônia de aposentadoria** — construída
  (`js/views/retirement-ceremony.js`), disparada por notificação.
- **G3 (base)** — a simulação já grava `fighterRating` por luta; falta a tela do
  gráfico.

**Bug de crash encontrado e corrigido no playtest:**
- `GameController._generateCallouts` chamava `this.fighterCtrl.getAll()`
  (inexistente) → travava ~30% dos avanços de semana. Corrigido para
  `getAllFighters()`. ✅

**Bugs cosméticos corrigidos:**
- Live Fight Hub usava o keyframe `pulse` (inexistente → `livePulse`) e tinha um
  `<div>` vazio no ramo de vitória do lutador B. `_genRoundBeats` estava numa
  linha só — reformatado. ✅

**Balanceamento a validar (NÃO é bug, é calibração — regra de ouro):**
- Influxo de **~70 novos lutadores/ano**, muito acima do `DRAFT_MIN/MAX` (5–10) —
  há outra fonte de geração (mercado/rivais) somando ~60/ano. O nº de ativos
  estabiliza no cap de 300 em ~2 anos, mas os registros de **aposentados se
  acumulam no banco sem teto** (perf de carreira muito longa). Precisa de uma
  passada de balanceamento dedicada.

**Ainda aberto de verdade:** terminar/polir o Épico F (F2/F3), validar o balance
da regeneração, a tela do gráfico G3, e a decisão emoji vs. G7 (as telas novas
usam emoji fartamente).

---

## 0. Como usar este documento

**Uma fatia por vez.** Cada épico abaixo é uma fatia vertical: um recorte
completo e jogável. Não implemente "todos os P0" nem "todo o épico C" em
paralelo — cada fatia mexe no balanceamento, e três sistemas meio-prontos
não fazem um jogo.

**Playtest entre fatias.** Se três coisas mudam de uma vez e o jogo fica fácil
demais, ninguém sabe qual número está errado. Já aconteceu neste projeto: na
primeira versão das academias rivais, o time inicial inteiro foi roubado em 5
semanas, e só descobrimos porque a fatia foi testada isolada.

### Convenções obrigatórias do projeto

| Regra | Onde | Por quê |
|---|---|---|
| **Migração aditiva** via `gameState.meta.patches` | `GameController._applyPatches()` | Campo novo com default não precisa recriar o mundo. **Não bumpe `WORLD_SCHEMA`** a menos que a forma do mundo mude de verdade — isso mata a carreira do jogador. |
| **`--red`/`--belt` são preenchimento; `--red-ink`/`--belt-ink` são tipo** | `css/main.css` | `--red` em texto pequeno dá 3.32:1, abaixo do mínimo de 4.5:1. |
| **Nunca animar `opacity` do `#mainContent`** | `js/motion/motion-engine.js` | Um render concorrente mata a timeline e deixa a página invisível com o HTML no DOM. |
| **Ouro (`--belt`) só em cinturões e bônus** | tudo | É a única coisa que merece ouro. |
| **`gameState` exige `id`** | qualquer `db.put('gameState', x)` | Sem `id`, o `put` lança `DataError`. |

### Estado atual (o que já existe)

Modo treinador: você é dono de academia. 5 promoções de IA (tiers 1–3) rodam
os próprios eventos e enviam ofertas de luta. Já implementado: ofertas +
negociação de bolsa, treino individual por atleta, estrutura da academia
(instalações, treinadores, olheiro), instruções de córner ao vivo, suspensão
médica pós-luta, simulação de período, academias rivais, patrocínios,
**cinturões com desafiante mandatório**, **névoa de guerra + scouting +
plano de jogo**, **acampamento de luta com sparring por arquétipo**, e o
**ciclo de vida do atleta** (corte de peso, dano permanente, declínio por idade,
aposentadoria).

**Bugs P0 resolvidos:** B1 (camp filtra por gymId) ✅, B2 (lesão não é mais
permanente) ✅, B3 (exploit fechado — camp agora roda no `processWeek`) ✅,
B6 (coletiva ligada à luta real) ✅

**Épicos completos:** B (contrato exclusivo com promoção) ✅, A (retenção
com sondagem + resposta) ✅, C (atributos 8→24) ✅, **D (acampamento de
verdade) ✅**, **E (o corpo: peso, dano, declínio) ✅**

**Único épico restante:** F (narrativa) — parcialmente entregue (coletiva
ligada), faltam expectativas dos atletas, inbox e o reencontro.

---

## 1. P0 — Bugs (corrigir antes de qualquer feature nova)

### B1. (RESOLVIDO) A aba Acampamento não listava atletas
`js/views/training-camp.js:5` filtrar por `f.status === 'roster'`.
No modo academia os atletas do jogador têm `status === 'gym'`. O `<select>` nascia vazio — a aba parecia quebrada porque **estava**.

**Correção:** agora filtra por `f.gymId === GYM_CONFIG.ID`. ✅ Resolvido entre PRD 1.0 e o código atual.

### B2. (RESOLVIDO) O Acampamento produzia lesão PERMANENTE
`js/controllers/training-camp.js:19` fazia `fighter.status = 'injured'` mas
**nunca criava o objeto `fighter.injury'** nem setava `availableFromAbsWeek`.
`WorldService._recoverInjuries()` começa com `if (!data.injury || ...) continue`
→ o atleta nunca se recuperava. Ficava lesionado até o fim da carreira.

**Correção:** agora cria objeto `injury` no mesmo formato de
`WorldService._rollInjury`: `{ untilAbsWeek, description, resumeStatus }`
e seta `availableFromAbsWeek`. ✅ Resolvido (sem cancelamento automático de booking — pendente para Épico D).

### B3. (RESOLVIDO) O Acampamento era um exploit

O problema de raiz era o camp ser um **botão manual** que concedia ganho a cada
clique. Isso acabou: com o Épico D, o camp virou uma **configuração**
(`fighter.campConfig`) que roda **uma vez por semana** dentro de
`GameController._applyWeeklyTraining()`, junto com o resto do tick. Não existe
mais clique que dê atributo — você configura intensidade/foco/sparring e o
ganho acontece no avanço de semana, com custo semanal e risco de lesão.

Proteções que continuam valendo: custo financeiro por semana de camp e
intensidade `intense` bloqueada sem luta marcada. ✅ Resolvido junto com o Épico D.

### B4. `models/contract.js` é principalmente código legado do modo organização
`fighter.contract` só era setado por `FighterController.hireFighter()`, que
não é mais chamado. O campo `fighter.contract` ainda é inicializado em
`fighter.js:52` para compatibilidade reversa de saves antigos, mas o novo
sistema de contratos (Épico B) usa `fighter.promotionContract` diretamente.
**Decisão:** manter como está (backward compat) ou remover o campo legado
numa migração futura.

### B5. Docs desatualizados
`ROADMAP_FUTURE.md` e `TODO_REMAINING.md` descrevem o modo organização e
afirmam que o Camp está "IMPLEMENTADO ✅". Já receberam banner de superado.

### B6. (RESOLVIDO) `PressConference` estava órfã
`app.js:renderPressConference()` agora resolve o **booking real** (`upcoming[0]`),
encontra `fighterA` por `booking.fighterId`, busca o adversário real por
`booking.opponentId` e a promoção real por `booking.promotionId`. Se não há luta
marcada, cai num fallback explícito ("Nenhuma luta marcada") em vez de mostrar
dados errados. ✅ Resolvido. O que ainda pertence ao Épico F é o efeito da
provocação no hype/bolsa/rivalidade, não a ligação com a luta.

**Critério de aceite dos P0: ✅ TODOS ATENDIDOS.** Nenhum atleta fica
permanentemente lesionado (B2); a aba Acampamento lista os atletas (B1); nenhum
clique repetido concede ganho — o camp roda no tick semanal (B3); a coletiva usa
a luta real (B6). Sobra só a decisão de arquivamento de B4 (campo `contract`
legado), sem impacto de jogo.

---

## 2. Épico B — Contrato exclusivo com promoção

> ✅ **IMPLEMENTADO.** `js/services/contract-service.js` gerencia propostas,
> aceite, vigência, corte por derrotas e renovação. `OfferService.generateWeekly()`
> respeita a exclusividade. Ver seções B4 e seção 9 sobre o estado atual.
>
> *"Não acho legal lutar no Pride e no Global só porque sou atleta nacional.
> Deveria escolher lutar em apenas uma, de minha escolha, e melhor contrato."*

### Problema
`OfferService._pickTier()` sorteia um **tier** e depois sorteia **qualquer
promoção daquele tier**. O mesmo atleta recebe ofertas da PFC e da GCE na mesma
semana e luta nas duas. Isso não existe no MMA e destrói a noção de carreira.

### Design
- **Sem contrato** → você só recebe lutas avulsas do **circuito regional**
  (tier 3). É o começo de todo mundo.
- Ao cumprir os gates de um tier superior (`OFFER_CONFIG.TIER_GATES`), uma ou
  duas promoções daquele tier enviam uma **proposta de contrato** (não uma
  luta): N lutas, bolsa base, bônus de vitória, cláusula de título,
  exclusividade.
- **O jogador escolhe uma.** As outras propostas somem. Enquanto o contrato
  vigorar, o atleta **só recebe ofertas daquela promoção**.
- Cumprir o contrato → renovação com termos melhores (proporcional ao cartel
  construído lá dentro).
- **Duas derrotas seguidas** dentro do contrato → risco de corte (`released`),
  volta ao circuito regional.
- Rescindir antes do fim → multa (`fightsRemaining * basePurse * 0.5`).
- Subir de tier = negociar a saída ou cumprir o contrato até o fim. É uma
  **decisão de carreira**, não um sorteio.

### Dados
```js
// js/models/fighter.js  (campo novo, default null)
fighter.promotionContract = {
  promotionId, promotionName, tier,
  fightsTotal, fightsRemaining,
  basePurse, winBonus,
  exclusive: true,
  titleClause: false,      // chance de título garantida se virar mandatório
  signedAtAbsWeek,
  status: 'active',        // 'active' | 'expired' | 'released' | 'terminated'
};
```
Propostas ficam em `gameState` docs com chave `contract-offer-{fighterId}`,
cada um com `{ id, fighterId, offers: [...], expiresAt }` — **não** criar
store novo, para não bumpar a versão do IndexedDB.

### Mudanças
| Arquivo | O que muda |
|---|---|
| `js/services/offer-service.js` | `generateWeekly`: se `fighter.promotionContract?.status === 'active'`, `promotions = [contractPromo]` e a bolsa vem do contrato. Senão, só tier 3. |
| `js/services/contract-service.js` (**novo**) | gerar propostas, aceitar, recusar, consumir luta, renovar, cortar, rescindir. |
| `js/services/world-service.js` | `_settlePlayerFight` decrementa `fightsRemaining`; conta derrotas seguidas. |
| `js/views/offers.js` | seção "Propostas de Contrato" acima das ofertas de luta. |
| `js/views/roster.js` | linha de contrato no cartão (`3/4 lutas · PFC`). |

**Patch de migração:** `promotionContracts` — atletas existentes começam sem
contrato (nada a derivar).

### Critérios de aceite
- Com contrato ativo, **nunca** chega oferta de outra promoção. (teste
  automatizado: gerar ofertas 50× e afirmar `promotionId` único)
- Sem contrato, só chegam ofertas de tier 3.
- Ao chegar aos gates de tier 2, chega uma proposta de contrato (não uma luta).
- Aceitar uma proposta remove as concorrentes.
- Cumprir o contrato dispara proposta de renovação melhor.
- Duas derrotas seguidas podem gerar corte.

---

## 3. Épico A — Retenção: brigar para não perder o atleta

> ✅ **IMPLEMENTADO.** `js/services/retention-service.js` gerencia sondagens,
> respostas (renegociar, bônus, promessa, deixar ir), resolução e recompra.
> `RivalGymService.processWeek()` agora gera approaches em vez de transferir
> direto. Prazo de resposta: `APPROACH_DEADLINE_WEEKS = 2` no código.
>
> > *"Eles simplesmente levam os meus atletas, sem uma oportunidade de tentar
> trazer eles de volta, ou renegociar contrato."*

### Problema
`RivalGymService.processWeek()` rola um dado e **transfere o atleta na hora**.
O jogador não tem contra-jogo. É a única mecânica do jogo em que algo
importante acontece sem decisão.

### Design — o assédio vira um evento de duas etapas

**1. Sondagem.** A rival demonstra interesse. Notificação. O jogador tem
`APPROACH_DEADLINE_WEEKS` (sugestão: 3) para reagir. Aparece um card em
*Minha Equipe*.

**2. Resposta.** Quatro opções:

| Opção | Custo | Efeito |
|---|---|---|
| **Renegociar** | receita futura | aumenta `fighter.purseShare` (você abre mão de parte da sua comissão) |
| **Bônus de permanência** | caixa agora | salto imediato de `loyalty` e `morale` |
| **Fazer uma promessa** | nada agora | ex.: "disputa de cinturão em 26 semanas", "subir de liga". Cumprir → `loyalty` sobe muito. **Quebrar → o atleta fica praticamente irretível.** |
| **Deixar ir** | reputação | o atleta sai (e leva o cinturão, se tiver) |

**3. Resolução.** Chance de retenção = f(`loyalty`, `morale`, quanto você
ofereceu vs. a rival, sua reputação vs. a dela, e `gym.trust` — o histórico de
promessas cumpridas).

**4. Recompra (buyout).** Atleta que já saiu pode voltar: custo alto,
chance baseada em como ele está na rival (moral, lutas recebidas, cinturão).
Fecha o arco emocional — inclusive o do reencontro no octógono.

### Dados
```js
fighter.loyalty      = 50;                 // 0..100, cresce com tempo, vitórias, promessas cumpridas
fighter.purseShare   = 1 - GYM_CONFIG.MANAGER_CUT;  // 0.8 por padrão
fighter.promises     = [];                 // [{ kind, deadlineAbsWeek, madeAtAbsWeek, kept }]
gym.trust            = 50;                 // reputação de treinador que cumpre o que promete
```
Sondagens em `gameState` doc `{ id: 'retention', approaches: [...] }`.

**Economia:** `WorldService._settlePlayerFight` passa a usar
`gymCut = totalPurse * (1 - fighter.purseShare)` em vez de `gym.managerCut`.

### Critérios de aceite
- Nenhum atleta muda de academia sem que o jogador tenha tido pelo menos uma
  semana para reagir.
- Promessa quebrada derruba `loyalty` e `gym.trust` de forma observável.
- Recompra existe e pode falhar.
- Um campeão que sai **mantém o cinturão** (regra já vigente — não regredir).

**Patch:** `retention`.

---

## 4. Épico C — Atributos expandidos (8 → 24)

> ✅ **IMPLEMENTADO.** `Fighter.expandAttributes()` gera os 24 atributos com
> derivação + ruído gaussiano. `SimulationEngine._calcRoundPerformance()` e
> `_genRoundStats()` leem todos os 24. `_checkRoundFinish()` usa `power`,
> `submissionOffense/Defense`, `durability`. Scouting revela os expandidos
> no nível 2+. Patch de migração: `expandedAttributes` em `GameController`.
>
> *"Gostaria de mais estatísticas para os lutadores, não apenas essas 8."*

### Princípio inegociável
**Todo atributo novo tem que ser lido pela simulação.** Atributo que só aparece
na ficha é enfeite, e enfeite deixa o jogo pior, não melhor.

### Os 24 (os 8 atuais preservados, marcados com \*)

**Em pé (7):** `boxing`\*, `kickboxing`\*, `muayThai`\*, `power`, `footwork`,
`headMovement`, `clinch`

**Chão (7):** `wrestling`\*, `bjj`\*, `takedowns`, `takedownDefense`,
`groundControl`, `submissionOffense`, `submissionDefense`

**Físico (6):** `cardio`\*, `chin`\*, `strength`, `speed`, `durability`,
`recovery`

**Mental (4):** `fightIQ`\*, `composure`, `aggression`, `adaptability`

### Onde cada um entra na simulação

| Atributo | Uso |
|---|---|
| `power` | chance de knockdown e de KO (hoje derivada só de `strikingScore`) |
| `footwork` / `headMovement` | reduz golpes significativos sofridos |
| `clinch` | trocação no clinch; ponte entre em pé e chão |
| `takedowns` vs `takedownDefense` | **duelo que decide ONDE a luta acontece** — a mudança mais importante deste épico |
| `groundControl` | tempo de controle, pontuação de round no chão |
| `submissionOffense` / `submissionDefense` | tentativas e sucesso de finalização |
| `strength` | bônus em clinch, quedas e controle |
| `speed` | iniciativa, acerto, evasão |
| `durability` | resistência a TKO por castigo acumulado (≠ `chin`, que é KO súbito) |
| `recovery` | recupera stamina entre rounds; encurta suspensão |
| `composure` | resiste a ser finalizado quando está em apuros |
| `aggression` | volume e chance de finalizar, ao custo de cardio e de expor o queixo |
| `adaptability` | quanto a instrução de córner e o plano de jogo realmente pegam |

`adaptability` amarra este épico à Fatia 2: um atleta com leitura baixa não
executa bem o plano que você escolheu.

### Migração (derivar, não sortear)
Patch `expandedAttributes`: cada atributo novo é derivado dos existentes +
ruído gaussiano, para que os 189 lutadores do save atual ganhem valores
plausíveis sem recriar o mundo. Exemplos:
```
takedowns        = clamp(wrestling + N(0,6))
takedownDefense  = clamp(wrestling*0.6 + bjj*0.2 + fightIQ*0.2 + N(0,6))
power            = clamp(avg(boxing, muayThai) + N(0,8))
headMovement     = clamp(boxing*0.6 + fightIQ*0.4 + N(0,6))
durability       = clamp(chin*0.7 + cardio*0.3 + N(0,6))
composure        = clamp(fightIQ*0.6 + chin*0.4 + N(0,6))   // +8 se pressurePerformer, −8 se bigEventNervous
recovery         = clamp(cardio*0.7 + chin*0.3 + N(0,6))    // +10 se exceptionalRecovery
aggression       = clamp(50 + N(0,15))
adaptability     = clamp(fightIQ*0.8 + N(0,8))
```

### Riscos (ler antes de começar)
1. `Fighter.overallRating`, `techniqueScore`, `strikingScore` e
   `grapplingScore` serão reponderados. **Isso muda todos os rankings, e o
   ranking decide quem disputa cinturão.** Rodar depois de um playtest, nunca
   junto com outra fatia.
2. `DataGenerator` precisa gerar os 24 de forma coerente (um wrestler tem
   `takedowns` alto e `headMovement` baixo — não sortear independente).
3. A névoa (`ScoutingService.blur`) precisa cobrir os 24.
4. A ficha do lutador precisa **agrupar** (Em pé / Chão / Físico / Mental).
   Os cartões de Minha Equipe e Recrutar continuam mostrando só os 4 resumos.

### Critérios de aceite
- Um wrestler puro vence um trocador puro no chão e perde em pé, de forma
  mensurável (rodar 400 simulações e comparar).
- Nenhum dos 24 atributos fica sem leitura na simulação.
- O save antigo sobrevive à migração com atributos plausíveis.

---

## 5. Épico D — Acampamento de verdade (corrige B1/B2/B3)

> ✅ **IMPLEMENTADO.** `js/controllers/training-camp.js` expõe `configureCamp`,
> `cancelCamp` e `processCamp`. O processamento roda dentro de
> `GameController._applyWeeklyTraining()` (a partir de `js/controllers/game-controller.js:599`),
> lendo `fighter.campConfig` a cada semana. Config na aba Acampamento
> (`js/views/training-camp.js`). Parâmetros em `CAMP_CONFIG` (`game-config.js`).

### Design (como ficou)
O camp deixou de ser um botão e virou **a preparação daquela luta**, configurada
uma vez (`fighter.campConfig = { intensity, spec, sparringPartnerId }`) e
executada semana a semana dentro do tick.

- **Intensidade** (leve / moderada / intensa) e **foco** (`striking`,
  `grappling`, `cardio`, `chin`) definem os atributos que sobem e a magnitude
  (`GAIN_MULTIPLIER`). `intense` exige booking ativo.
- **Sparring partner:** um companheiro de equipe. Bônus de peso próximo
  (`SPARRING_CLOSE_WEIGHT_BONUS`) e bônus se o **arquétipo dele imitar o do
  adversário** (`SPARRING_MATCH_BONUS`) — o arquétipo do adversário só é
  conhecido via scouting. Faz a composição do elenco importar.
- **Risco:** `_calcRisks` rola lesão e overtraining por semana, modulados por
  DNA (`injuryProne` dobra, `exceptionalRecovery` corta pela metade). Lesão em
  camp `intense` **cancela a luta** (`CAMP_INJURY_CANCELS_FIGHT`). O objeto
  `injury` é criado no formato correto, então a recuperação funciona (fecha B2).

### Critérios de aceite — ✅ todos atendidos
- Impossível ficar permanentemente lesionado. ✅
- Impossível ganhar atributo clicando repetidamente — ganho só no tick. ✅
- Camp `intense` sem luta marcada é bloqueado com explicação. ✅
- Sparring com arquétipo certo dá bônus de ganho mensurável. ✅

---

## 6. Épico E — O Corpo (corte de peso, dano, declínio)

> ✅ **IMPLEMENTADO (E1, E2, E3).** Três features, um tema: **o corpo cobra**.
> Nenhuma precisou de patch de migração — todas operam sobre campos que já
> existem, aplicando efeitos a partir do momento em que rodam. O `theBody` que o
> PRD 1.0 previa **não foi necessário** (não há campo novo a derivar em saves
> antigos).

### E1. Corte de peso como decisão — ✅
Mudança de divisão implementada em `app.js:showFighterProfile()` (handler
`.change-weight-class`, botão em `views/fighter-profile.js:266`). Subir/descer
ajusta atributos (subir: −power/−strength, +speed/+cardio; descer: o inverso) e
cobra um custo do caixa com lançamento na transação da academia. `fighter.weightCut`
(`naturalWeight`, `ease`, `lastCutImpact`) continua sendo aplicado na simulação.

### E2. Dano acumulado — ✅
Implementado na simulação (`controllers/simulation.js:188-210`): derrota por
**KO/TKO raspa `chin` e `durability` permanentemente** (`durability` leva ~70%
do dano do `chin`), com `clamp(…, 1, 99)`. Guerreiro que faz muitas guerras
acaba cedo — dá consequência de longo prazo à instrução "Recuar e Pontuar".

### E3. Declínio por idade — ✅
`Fighter.evolve()` agora ramifica: a partir de **33 anos** chama
`_applyAgeDecline()` (`models/fighter.js:276-310`). Taxa cresce com a idade
(0.15 → 0.7 dos 33 aos 40+), **retardada por `hidden.determination`**. Atributos
físicos caem mais (×1.4), técnicos menos (×0.7), mente quase nada
(`fightIQ`/`composure` ×0.3). Alimenta a aposentadoria (`world-service.js`
pendura as luvas e vaga o cinturão) e o Hall da Fama.

---

## 7. Épico F — A Narrativa (⚠️ ÚNICO ÉPICO ABERTO)

Por último de propósito: um inbox é chato se nada dramático acontece. Depois
dos épicos anteriores, acontece muita coisa. Este é agora o **único épico
grande restante** — o núcleo de simulação/carreira está completo.

- **Coletiva de imprensa — ✅ ligada à luta real (B6).** O que **falta**: a
  provocação hoje aplica efeitos ao próprio atleta (`PressConference.applyEffects`),
  mas ainda **não** converte hype em bolsa maior nem alimenta a rivalidade nem
  motiva o adversário. Esse é o próximo passo concreto do épico.
- **Expectativas dos atletas.** ⬜ Você é dono da academia, não tem chefe — mas
  seus atletas são seus chefes. Um cara 5-0 sem chance de título fica
  insatisfeito, `morale` cai, `loyalty` cai, e ele **vira alvo fácil das
  rivais** (Épico A). É a pressão do "conselho", invertida.
- **Inbox no estilo FM**, ⬜ com manchetes, callouts, provocações.
- **O reencontro.** ⬜ Atleta roubado por uma rival aparece como adversário do
  seu — e o pôster de luta anuncia exatamente isso.

### Próximo passo sugerido para F
Comece pelo **hype da coletiva → bolsa/rivalidade**, porque a coletiva já está
ligada e o encanamento (rivalidades, bolsa da oferta) já existe. É a menor fatia
vertical que entrega drama observável sem construir o inbox inteiro de uma vez.

---

## 8. Backlog adicional (= **Fase 0** do roadmap da seção 9)

Itens menores cujos **dados já existem** — falta só a superfície. Priorizados
na Fase 0 (seção 9): começar por **G5, G2, G3** (melhor custo-benefício).

| # | Item | Por quê |
|---|---|---|
| G1 | **Cinturão interino** quando o campeão passa muito tempo lesionado | Hoje o cinturão congela e a divisão para |
| G2 | **Tela de ranking de desafiantes** por promoção/divisão | A fila já existe em `TitleService.contenderRanking()`, mas o jogador só vê o nº1 |
| G3 | **Gráfico de carreira** (OVR ao longo do tempo) e head-to-head | Os dados de `fighter.fights` já estão lá |
| G4 | **Slots de save** / múltiplas carreiras | Uma carreira só é frágil |
| G5 | **Cerimônia de aposentadoria** + Hall da Fama enriquecido | Fecha o arco emocional; casa com o declínio/aposentadoria do Épico E |
| G6 | Revisar `RankingService._rankingScore` para a tela global de Rankings | Foi reescrito para a fila do cinturão; a tela global usa o mesmo score, verificar se faz sentido |
| G7 | Substituir emojis dos ícones por marcas tipográficas | Único elemento indisciplinado do design system |

---

## 9. Estado atual e ordem recomendada

### O que já foi implementado
- **P0 B1, B2, B3, B6** — todos resolvidos (ver seção 1)
- **Épico A** — retenção contra academias rivais ✅
- **Épico B** — contratos exclusivos com promoção ✅
- **Épico C** — atributos expandidos para 24 ✅
- **Épico D** — acampamento de verdade (roda no tick semanal) ✅
- **Épico E** — o corpo: corte de peso, dano permanente, declínio por idade ✅
- **Performance** — cenas 3D não vazam mais loops `rAF` (seção 11) ✅

### Roadmap consolidado — Fases 0 a 2

Este roadmap funde **três listas** que diziam quase a mesma coisa: o backlog
G1–G7 (seção 8), os "buracos de gênero" levantados na revisão de 09/07 e um
roadmap antigo (Sistema Médico, Academias Dinâmicas, Live Fight Hub, Regiões,
Eras, etc.). A maioria dos itens do roadmap antigo é **duplicata** dos buracos
de gênero com outro nome — foram unificados. **Escopo travado até a Fase 2.**

```
Fase 0  →  Backlog G-series (superfície sobre dados que já existem)
Fase 1  →  Regeneração do Mundo   (a keystone da longevidade)
Fase 2  →  Live Fight Hub          (a luta como espetáculo)  [pilar recomendado]
```

**Por que nesta ordem.** Com D e E fechados, o núcleo de carreira está completo.
A Fase 0 fecha buracos visíveis quase de graça. A Fase 1 é **existencial**: com
aposentadoria e declínio ativos, um mundo de pool fixo esvazia numa carreira
longa — regeneração é o que torna o jogo jogável por décadas, e é pré-requisito
de qualquer sistema futuro de "mundo vivo" (Regiões, Eras, Scouts). A Fase 2 é a
maior alavanca de **emoção**: a luta é o clímax da semana e hoje termina num
recap de texto.

> **Regra de ouro (repetida de propósito):** uma fatia por vez, com playtest
> entre elas. Quase todo item abaixo mexe em balanceamento; empilhar dois sem
> testar isolado repete o "roubo do time inicial em 5 semanas".

---

#### Fase 0 — Backlog G-series
Ver seção 8. Ordem: **G5** (cerimônia de aposentadoria — casa com o Épico E que
acabou de fechar) → **G2** (tela de desafiantes) → **G3** (gráfico de carreira)
→ demais conforme der. Nenhum precisa de sistema novo; é apresentação sobre
dados que já estão no banco.

---

#### Fase 1 — Regeneração do Mundo (a keystone)

> **Item novo, não estava em nenhuma lista.** O "Sistema de Scouts" do roadmap
> antigo é a camada de *descoberta*; esta é a de *oferta*. Um olheiro só tem o
> que garimpar se o mundo criar prospects novos.

**Problema.** O mundo nasce com um pool fixo de lutadores. Com o Épico E,
atletas envelhecem, decaem e se aposentam — o pool só encolhe. Numa carreira
longa, os rankings viram asilo, o circuito regional seca e não há mais quem
recrutar. A profundidade que E adicionou trabalha contra a longevidade sem isto.

**Design.**
- Toda **virada de ano** nasce uma safra de prospects jovens (18–23 anos) no
  circuito regional (tier 3), como agentes livres e/ou roster das academias de IA.
- Volume calibrado para **repor + crescer de leve** (nascem ligeiramente mais do
  que se aposentam). Distribuição de potencial gaussiana enviesada pra baixo: a
  maioria é medíocre, poucos são cracks.
- Prospects entram **crus** — atributos baixos, `hidden.potential` variado. É o
  scouting/olheiro que revela o talento (amarra com a névoa de guerra existente).
- Nacionalidade cosmética por ora, com o hook pronto pra **Regiões** (Fase 3).
- **Teto de população:** se o pool passar de um limite, aposentar veteranos de
  IA irrelevantes — o mundo não pode crescer sem limite (custo de simulação e
  memória; ver seção 11).

**Dados.**
```js
// gameState doc de controle — NÃO criar store novo
{ id: 'worldGen', lastGenAbsWeek, totalGenerated }
```
Novos lutadores vão pro store `fighters` existente com `status` de agente livre
ou roster de rival. **Patch de migração `worldRegen`** inicializa o doc de
controle — aditivo, não recria o mundo, não bumpa `WORLD_SCHEMA`.

**Mudanças.**
| Arquivo | O que muda |
|---|---|
| `js/services/data-generator.js` | `generateProspect(absWeek)` reutilizando a geração coerente dos 24 atributos, com idade baixa e potencial variado. |
| `js/services/world-service.js` | na virada de ano: gerar a safra, inserir no mundo, distribuir alguns às rivais; aplicar o teto de população. |
| `js/controllers/game-controller.js` | patch `worldRegen` + leitura/escrita do doc `worldGen`. |

**Critérios de aceite.**
- Simular **20 anos** e o nº de lutadores ativos por divisão fica estável ou
  cresce de leve — nunca colapsa.
- Prospects jovens aparecem no circuito regional todo ano.
- Um "crack" (potencial alto) é raro e só se revela via scouting.
- Save antigo sobrevive (patch aditivo).
- Simulação de período longo **não** fica exponencialmente mais lenta (teto de
  pool respeitado).

**Patch:** `worldRegen`.

---

#### Fase 2 — Live Fight Hub (a luta como espetáculo)

**Problema.** A luta é o clímax da semana, mas o desfecho é um recap de texto. O
momento de maior emoção do jogo está subrepresentado.

**Design.**
- A simulação já roda **round a round** internamente; o Hub expõe isso como um
  **play-by-play ritmado** — eventos revelados em sequência com timing,
  reaproveitando o `_playLiveBroadcast` (revelação temporizada já existe).
- **Beats destacados:** knockdown, quase-finalização, virada, corte, round 10-8.
  A simulação passa a emitir esses momentos, não só o placar final do round.
- Placar dos juízes ao vivo, stamina/dano visível, tensão crescente.
- **Integra com o córner:** entre rounds você já dá instrução; o Hub mostra o
  efeito dela no round seguinte.
- Botão **pular** para quem quer velocidade. Sem 3D novo — a força é o
  texto/estado bem ritmado sobre o face-off que já existe.

**Dados.** A simulação passa a retornar um **log de beats** por round
(`result.roundLog = [{ type, fighterId, detail }]`), **aditivo** ao formato
atual — o Hub *apresenta*, não altera o resultado. Nenhum store novo.

**Mudanças.**
| Arquivo | O que muda |
|---|---|
| `js/controllers/simulation.js` | emitir os beats (os números já são calculados; só expor os eventos-chave). |
| `js/views/` (novo `live-fight-hub.js` ou estender `events.js`) | render play-by-play temporizado, reusando `_playLiveBroadcast`. |
| `js/app.js` (`advanceWeek`) | rotear a luta do jogador pro Hub em vez do recap direto. |

**Critérios de aceite.**
- A luta do jogador é assistível round a round, com beats destacados, terminando
  no **mesmo resultado** que a simulação já produziria.
- Knockdown/quase-finalização aparecem como **momento**, não como linha perdida.
- Dá pra pular.
- **Não regride performance** — segue o padrão da seção 11 (sem `rAF` vazando).

**Alternativa de Fase 2** (se preferir profundidade a espetáculo): *Academia como
negócio* — receita de mensalidade de alunos comuns, staff estendido
(fisioterapeuta, nutricionista, cutman) e academias de IA que evoluem. Decisão
registrada na seção 10.

---

### Fora do escopo atual (estacionado)
Não fazer agora, mas registrado para não se perder: **Fase 3** — Regiões, Eras,
Histórias Emergentes, Mídia/Redes Sociais (a maioria só brilha depois de
Regeneração + uma boa luta). E o **tempero de baixo valor estrutural** — Doping
e Empresários-com-personalidade — que ficam por último ou nunca.

---

## 10. Decisões em aberto (precisam do dono do produto)

1. **Contrato:** ✅ **DECIDIDO** — 3 a 8 lutas (baseado em popularidade), exclusividade total, implementado.
2. **Retenção:** `APPROACH_DEADLINE_WEEKS = 2` no código. Subir para 3? (Ainda aberto)
3. **Atributos:** ✅ **DECIDIDO** — 24 implementados, todos lidos na simulação.
4. **Balanceamento pendente:** com $35.000 de caixa inicial, dissecar um
   adversário custa $12.000 (1.500 + 3.500 + 7.000). Está caro demais no
   começo? (Ainda aberto)
5. **Chance de título:** o piso atual é 2 vitórias na promoção + ser o
   desafiante mandatório. Com suspensões de 8–16 semanas, isso dá ~1 ano de
   carreira. Rápido ou lento demais? (Ainda aberto)
6. **Camp (novo):** a mudança de divisão (E1) custa $5.000 fixos e ajusta
   atributos na hora, sem "risco de não bater o peso" nem tornar a divisão
   uma aposta. Manter simples ou adicionar a penalidade de corte prevista no
   design original? (Ainda aberto)
7. **Declínio (novo):** o corte começa aos 33. Para um elenco jovem isso pode
   demorar muito a aparecer no jogo; para veteranos comprados no mercado, pode
   ser abrupto. Validar a curva num playtest longo. (Ainda aberto)
8. **Pilar da Fase 2 (novo):** o roadmap recomenda **Live Fight Hub** (emoção da
   luta). A alternativa é **Academia como negócio** (profundidade estratégica).
   Só um por vez. Qual? (Recomendado: Live Fight Hub — amplifica toda luta já
   simulada. Ainda aberto)
9. **Calibração da Regeneração (novo):** quantos prospects por ano (repor vs.
   crescer), qual o teto de população do mundo e a partir de que idade um
   newgen deixa de ser "prospect". Definir no playtest de 20 anos. (Ainda aberto)

---

## 11. Performance — cenas 3D (corrigido em 09/07/2026)

### Sintoma
O jogo ficava progressivamente travado quanto mais se jogava.

### Causa
As três cenas Three.js (`three-arena.js`, `three-background.js`,
`three-faceoff.js`) tinham loops `requestAnimationFrame` que **nunca morriam**:

- `dispose()` **não cancelava o `rAF`** — só liberava GPU. O loop continuava.
- A navegação troca `#mainContent.innerHTML`, removendo o canvas do DOM **sem
  avisar a cena**. O loop seguia renderizando num canvas invisível.
- Resultado: cada visita ao Dashboard criava uma arena nova enquanto as antigas
  continuavam rodando. Depois de N navegações, N cenas 3D concorrendo pela GPU.
- Bônus: cada arena registrava listeners de mouse/touch/resize no `window` que
  nunca eram removidos.

### Correção
Padrão agora obrigatório para toda cena 3D (ver memória `padrao-cena-3d-raf`):

- Flag `this.disposed` + `this._rafId` guardado e **cancelado** no `dispose()`;
  `animate()` vira no-op depois do dispose.
- `animate()` checa `renderer.domElement.isConnected` no topo: se o canvas saiu
  do DOM, a cena se **auto-descarta** (arena/faceoff) ou se **religa ao
  container** (o fundo de partículas — que antes sumia após a 1ª navegação).
- **Cap de 30fps** (`_lastFrame` + 33ms) nas cenas decorativas — metade do custo
  de GPU, imperceptível.
- Resolução reduzida: `pixelRatio` máx. 2 → **1.5** na arena e **1** no fundo;
  shadow map 1024 → **512**.
- Listeners de `window` coletados e removidos no `dispose()`.

### Critério de aceite — ✅
Navegar repetidamente entre telas **não acumula** loops nem canvases; o custo de
GPU fica constante em vez de crescer com o tempo de jogo. Verificado no preview.
