# MMA Manager — PRD de Execução

> **Fonte de verdade do que falta construir.** Substitui `ROADMAP_FUTURE.md` e
> `TODO_REMAINING.md`, que descrevem o modo organização (pré-pivot) e afirmam
> coisas que não são mais verdade.
>
> Última atualização: 08/07/2026 (revisão de alinhamento com o código)

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
**cinturões com desafiante mandatório**, e **névoa de guerra + scouting +
plano de jogo**.

**Bugs P0 resolvidos:** B1 (camp filtra por gymId) ✅, B2 (lesão não é mais
permanente) ✅, B3 (anti-exploit parcial — cooldown, custo, bloqueio) ⚠️

**Épicos completos:** B (contrato exclusivo com promoção) ✅, A (retenção
com sondagem + resposta) ✅, C (atributos 8→24) ✅

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

### B3. O Acampamento é um exploit (parcialmente mitigado)

Proteções já aplicadas no `app.js:800-850`:
- **Cooldown semanal** (`fighter.lastTrainedAbsWeek === absWeekNow`) — impede spam
- **Custo financeiro** (`GYM_CONFIG.WEEKLY_COACHING_PER_FIGHTER * 2`) — paga do caixa
- **Treino pesado bloqueado sem luta marcada** — heavy exige booking ativo

Ainda pendente: o camp continua sendo um botão manual em vez de uma
configuração que roda dentro de `processWeek()`. Ver Épico D.

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

### B6. `PressConference` é órfã
`app.js:renderPressConference()` renderiza usando `team[0]` e o primeiro
booking, sem ligação real. O menu lateral já tem link ("Coletiva" em
`index.html:113`), mas a lógica não usa o evento/lutador corretos.
Ver Épico F.

**Critério de aceite dos P0:** nenhum atleta pode ficar permanentemente
lesionado; a aba Acampamento lista os atletas; nenhum clique repetido concede
ganho ilimitado.

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

### Design
O camp deixa de ser um botão e vira **a preparação daquela luta**, configurada
uma vez e executada semana a semana dentro de `processWeek()`.

- Só existe se o atleta **tem luta marcada**. Sem luta, a aba mostra o motivo.
- Você escolhe **intensidade** (leve / moderada / intensa) e **foco**, e paga
  um custo semanal.
- **Sparring partner:** escolhe um companheiro de equipe. Bônus se o peso for
  próximo e se o **arquétipo dele imitar o do adversário** — e você só sabe o
  arquétipo do adversário **se tiver estudado** (Fatia 2). Isso faz a
  composição do elenco importar: você para de colecionar OVR e passa a montar
  um time.
- Intensidade alta acelera ganho e **aumenta risco de lesão** — com objeto
  `injury` correto, e **cancelando a luta** se acontecer.

### Critérios de aceite
- Impossível ficar permanentemente lesionado.
- Impossível ganhar atributo clicando repetidamente.
- Camp sem luta marcada é bloqueado com explicação.
- Sparring com arquétipo certo dá vantagem mensurável na luta.

---

## 6. Épico E — O Corpo (corte de peso, dano, declínio)

Três features, um tema: **o corpo cobra**. Todas mexem no pós-luta e na virada
de ano — por isso vão juntas.

### E1. Corte de peso como decisão
`fighter.weightCut` (`naturalWeight`, `ease`, `lastCutImpact`) **já existe no
modelo** e já é aplicado na luta. O jogador só não tem agência.

- Permitir subir/descer de divisão.
- Descer: adversários menores, mas corte brutal (penalidade de cardio) e
  **risco de não bater o peso** → multa (20–30% da bolsa), luta vira
  casadinho, **cinturão sai de jogo**.
- Subir: mais saudável, oponentes maiores.

### E2. Dano acumulado
Cada derrota por KO/TKO raspa `chin` e `durability` **permanentemente**.
Guerreiro que faz muitas guerras acaba cedo. Dá consequência de longo prazo à
instrução "Recuar e Pontuar" — que deixa de ser covardia e vira gestão de
carreira.

### E3. Declínio por idade
`Fighter.evolve()` hoje **só faz atributo subir**. Ninguém decai, nunca.
Após ~33 anos, decaimento anual modulado por `hidden.determination` e pelo dano
acumulado. Dá peso real à aposentadoria e ao Hall da Fama.

**Patch:** `theBody`.

---

## 7. Épico F — A Narrativa

Por último de propósito: um inbox é chato se nada dramático acontece. Depois
dos épicos anteriores, acontece muita coisa.

- **Coletiva de imprensa** ligada à luta marcada (hoje é órfã, B6). Provocar
  aumenta hype (bolsa + rivalidade), mas motiva o adversário.
- **Expectativas dos atletas.** Você é dono da academia, não tem chefe — mas
  seus atletas são seus chefes. Um cara 5-0 sem chance de título fica
  insatisfeito, `morale` cai, `loyalty` cai, e ele **vira alvo fácil das
  rivais** (Épico A). É a pressão do "conselho", invertida.
- **Inbox no estilo FM**, com manchetes, callouts, provocações.
- **O reencontro.** Atleta roubado por uma rival aparece como adversário do
  seu — e o pôster de luta anuncia exatamente isso.

---

## 8. Backlog adicional

| # | Item | Por quê |
|---|---|---|
| G1 | **Cinturão interino** quando o campeão passa muito tempo lesionado | Hoje o cinturão congela e a divisão para |
| G2 | **Tela de ranking de desafiantes** por promoção/divisão | A fila já existe em `TitleService.contenderRanking()`, mas o jogador só vê o nº1 |
| G3 | **Gráfico de carreira** (OVR ao longo do tempo) e head-to-head | Os dados de `fighter.fights` já estão lá |
| G4 | **Slots de save** / múltiplas carreiras | Uma carreira só é frágil |
| G5 | **Cerimônia de aposentadoria** + Hall da Fama enriquecido | Fecha o arco emocional |
| G6 | Revisar `RankingService._rankingScore` para a tela global de Rankings | Foi reescrito para a fila do cinturão; a tela global usa o mesmo score, verificar se faz sentido |
| G7 | Substituir emojis dos ícones por marcas tipográficas | Único elemento indisciplinado do design system |

---

## 9. Estado atual e ordem recomendada

### O que já foi implementado
- **P0 B1, B2** — resolvidos (camp filtra por gymId, lesão não é mais permanente)
- **P0 B3** — mitigado (cooldown, custo, heavy bloqueado sem luta), redesign completo pendente
- **Épico B** — contratos exclusivos com promoção ✅
- **Épico A** — retenção contra academias rivais ✅  
- **Épico C** — atributos expandidos para 24 ✅

### Próximos passos (ordem recomendada)

```
Epic D (camp real)  →  P0 B3 (exploit final)  →  Epic E (o corpo)
                     →  Epic F (narrativa)  →  backlog
```

**Por quê nesta ordem:** O camp (D) é a maior reclamação restante e bloqueia
o B3 completo. E (corpo) adiciona profundidade pós-luta e longevidade. F
precisa que tudo tenha acontecido para ter o que narrar.

---

## 10. Decisões em aberto (precisam do dono do produto)

1. **Contrato:** ✅ **DECIDIDO** — 3 a 8 lutas (baseado em popularidade), exclusividade total, implementado.
2. **Retenção:** `APPROACH_DEADLINE_WEEKS = 2` no código. Subir para 3?
3. **Atributos:** ✅ **DECIDIDO** — 24 implementados, todos lidos na simulação.
4. **Balanceamento pendente:** com $35.000 de caixa inicial, dissecar um
   adversário custa $12.000 (1.500 + 3.500 + 7.000). Está caro demais no
   começo? (Ainda aberto)
5. **Chance de título:** o piso atual é 2 vitórias na promoção + ser o
   desafiante mandatório. Com suspensões de 8–16 semanas, isso dá ~1 ano de
   carreira. Rápido ou lento demais? (Ainda aberto)
