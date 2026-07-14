# O Livro Sobre Você — Fase 3 (sistema-âncora)

> Fase 1 entregou a carreira sistêmica de 1 lutador. Fase 2 entregou
> balanceamento, imprevisibilidade e contexto. Esta fase entrega **o
> sistema que muda o formato do arco de carreira inteiro**.

## A tese

**O plano que te faz vencer é o mesmo que te faz previsível.**

Hoje o scouting é uma via de mão única: você estuda o adversário, o mundo
nunca estuda você. E o adversário luta literalmente **sem plano de jogo**
(`simulation.js:91` — `_calcRoundPerformance(fighterB, ..., null)`). Essa é
a maior alavanca não usada do motor.

Este sistema faz o mundo te ler de volta. Sua carreira fica mais difícil na
exata proporção do seu sucesso — e a única saída é se reinventar, iscar, ou
aceitar ser decifrado.

Efeito colateral desejado: resolve o problema #4 da Fase 2 ("jogo fácil
demais") de forma **diegética**. A dificuldade não sobe por um multiplicador
de config; sobe porque as pessoas descobriram como você luta.

---

## 1. A fita — `Fighter.tape`

Todo lutador (jogador **e** IA) carrega uma fita. Ela registra só o que é
observável de fora — nunca atributos ocultos.

```js
// models/fighter.js
this.tape = data.tape || {
  planHistory: [],        // últimos gamePlanKey usados, mais recente no índice 0
  planMastery: {},        // { striker: 0-100, grappler: 0-100, ... }
  exposure: 0,            // 0-100 — o quanto o mundo te conhece
  weapon: null,           // { planKey, mastery: 0-100, revealed: bool }
  figuredOutAtAbsWeek: 0, // marca de "decifrado" (careerLog, uma vez por ciclo)
  winsSinceFiguredOut: 0, // para o gatilho de 'reinvention'
  lastReadQuality: 0,     // leitura sofrida na última luta — usada pelo careerLog
};
```

### `exposure`

Cresce a cada luta:

```
ganho = EXPOSURE_BASE_PER_FIGHT
      + popularity * EXPOSURE_POPULARITY_SCALE
      + (tier 1 ? EXPOSURE_TIER1_BONUS : 0)
      + (luta de título ? EXPOSURE_TITLE_BONUS : 0)
```

Escalado por `EXPOSURE_ROOKIE_SCALE` enquanto o lutador tiver menos de
`EXPOSURE_ROOKIE_FIGHTS` lutas — **ninguém estuda um novato**. Essa rampa é a
mitigação principal do risco de dificuldade (Seção 8).

Cai `EXPOSURE_IDLE_DECAY`/semana depois de `EXPOSURE_IDLE_AFTER_WEEKS` sem
lutar — sumir do mapa te torna um enigma de novo, com o custo óbvio de não
estar lutando.

**Despenca `EXPOSURE_NEW_WEAPON_DROP` quando você revela uma arma nova.** O
mundo precisa te reestudar do zero.

### `signature`

Derivada, não persistida: o gameplan que aparece em ≥ `SIGNATURE_THRESHOLD`
(60%) das últimas `SIGNATURE_WINDOW` (5) lutas. Se você varia, `signature =
null` → você é **imprevisível** e não existe counter pra trazer contra você.

`balanced` é um caso especial: é a ausência de plano. Pode virar signature,
mas **não tem counter** (`COUNTER_OF.balanced` não existe) e **não acumula
`planMastery`**. Lutar sempre balanced é seguro e medíocre — de propósito.

### `planMastery`

Repetir um plano o afia: `+PLAN_MASTERY_PER_USE` por luta usando-o,
`-PLAN_MASTERY_DECAY_PER_FIGHT` nos outros. Vira bônus de vantagem:
`PLAN_MASTERY_MAX_BONUS * mastery/100` (até +8%/round).

Aqui mora a tese: **especializar te dá força e te entrega.**

---

## 2. O adversário te lê

### `TapeService.readQuality(opponent, target, ctx)`

```
readQuality = clamp(
  (target.tape.exposure / 100)
  * (0.5 + opponent.attributes.fightIQ / READ_IQ_SCALE)
  * (0.7 + academiaDoOponente.reputation / 100 * 0.3)
  + (rivalidade ativa ? READ_RIVALRY_BONUS : 0)
, 0, 1)
```

O rival ganha `READ_RIVALRY_BONUS` de graça — ele te conhece por fora da fita.
**Uma trilogia fica progressivamente brutal.**

### A escolha de plano da IA

Se `readQuality >= READ_THRESHOLD` **e** você tem `signature` counterável, o
adversário traz `COUNTER_OF[signature]`. Senão, `balanced` (o comportamento
de hoje).

```js
const COUNTER_OF = {
  striker: 'grappler',   // você mantém em pé → ele te derruba
  grappler: 'striker',   // você derruba → ele faz sprawl e troca
  pressure: 'patient',   // você sufoca → ele te espera e contragolpeia
  patient: 'grappler',   // você espera → ele te leva pro chão e não te dá o erro
};
```

`patient → grappler` (e não `pressure`) porque o contragolpeador vive do erro
do outro; quem te leva pro chão não comete o erro que você espera.

### A vantagem que isso gera

O motor já calcula `_planEdge(plano, adversárioReal)` — vantagem por atributos.
A leitura entra por cima, e **tudo escala com a confiança dele**:

```
edgeB = clamp(
  readQuality × (_planEdge(planoB, jogador) + TAPE_READ_EDGE),
  EDGE_FLOOR, EDGE_CEIL
)
```

A multiplicação por `readQuality` não é enfeite: sem ela, o adversário ganhava o
`_planEdge` inteiro no instante em que cruzava o limiar, e a dificuldade da
carreira virava um degrau em vez de uma curva (medido — ver Seção 8).

---

## 3. As três saídas

Todas passam pela mesma variável final (`edgeA` / `edgeB`), o que mantém o
motor de luta limpo: `TapeService` decide, `SimulationEngine` aplica.

### (a) Instalar arma nova — no camp

Novo `spec` de camp: `install_weapon`, com um `weaponTarget` (um `gamePlanKey`).
Só é oferecido se a **academia sabe ensinar** aquilo (usa `Academy.specialties`).

```
ganhoDeMaestriaPorSemana =
  WEAPON_INSTALL_BASE
  * (0.5 + coachSynergy/100 * WEAPON_SYNERGY_SCALE)   // técnico com quem você briga instala devagar
  * (1 + especialidadeDaAcademia/100 * WEAPON_ACADEMY_SPEC_BONUS)
  * (1 - max(0, idade - WEAPON_AGE_PENALTY_FROM) * WEAPON_AGE_PENALTY_PER_YEAR)  // velho não aprende truque novo
  * (0.7 + discipline/100 * 0.6)
```

**Usar a arma antes da hora (`mastery < WEAPON_READY_MASTERY`)**: os
modificadores do plano vêm parciais — `mod_efetivo = 1 + (mod - 1) *
(mastery / READY)` — e você ainda leva `-WEAPON_RAW_PENALTY * (1 - fator)` de
vantagem. Arma crua é pior que não ter plano.

**A estreia da arma (`revealed === false`)**: o adversário estudou o *velho*
você. A leitura dele **inverte**:

```
edgeB = GAME_PLAN_EDGE.weak * readQuality   // quanto mais ele confiou na fita, pior pra ele
edgeA += WEAPON_SURPRISE_BONUS
```

Depois disso: `revealed = true`, `exposure -= EXPOSURE_NEW_WEAPON_DROP`,
careerLog `weapon_revealed`. A arma vira um plano normal e pode virar sua
nova signature — e o ciclo recomeça.

**O custo real**: semanas de camp instalando arma são semanas **não** gastas
em condicionamento e estudo do adversário. Você chega pior pra *esta* luta pra
ganhar as *próximas três*. Reinventar cedo custa vitórias agora; reinventar
tarde é reinventar sem corpo.

### (b) Isca — no pré-luta

Flag `bait` na `FightOffer`, ao lado do `gamePlan`. Só habilitada se você
**tem** uma signature (não dá pra fingir uma reputação que você não tem) e o
plano escolhido **não é** ela.

```
chanceDeAcerto = clamp(BAIT_BASE + fightIQ * BAIT_IQ_SCALE, 0.05, 0.90)
```

- **Acertou**: ele se comprometeu a counter-ar um estilo que você não trouxe e
  fica fora de posição. `edgeB = BAIT_OPPONENT_PENALTY * readQuality`,
  `edgeA += BAIT_REWARD * readQuality`.
- **Errou**: você abandonou sua melhor arma por nada.
  `edgeA += BAIT_PENALTY`, e a leitura dele continua valendo.

A isca **não te deixa mais forte — ela deixa ELE fora de posição.** Essa
distinção não é semântica: a primeira versão premiava o jogador, e a isca ficou
medida como negativa para todo perfil (Seção 8). O prêmio tem que estar do lado
de quem se comprometeu.

`fightIQ` é **oculto**. Descobrir que seu lutador é burro na hora de iscar
custa uma luta — e é uma história.

E o detalhe que faz a isca ser uma decisão de verdade: **iscar um adversário
que não te leu é burrice pura.** Se `readQuality` é baixa, não há compromisso
pra explorar; você só jogou fora sua signature. Saber *quando* iscar depende
de saber o quanto ele te leu — que é exatamente a informação da Seção 4.

### (c) Ser imprevisível de graça

Variar de plano mantém `signature = null` → não existe counter. O custo é não
acumular `planMastery`. É a saída dos pobres, e ela funciona — só não te dá
uma arma que ganha luta sozinha.

---

## 4. O que o jogador vê

O dossiê pré-luta ganha um bloco espelho: **"O que eles sabem sobre você"** —
sua exposure, sua signature percebida, e o plano que o adversário
provavelmente vai trazer.

**Essa informação passa pela mesma névoa do scouting.** A precisão depende do
que o seu time consegue levantar (nível de scouting sobre o adversário +
empresário com `givesBaselineScouting`). Com informação ruim, a predição pode
vir **errada** — e iscar com base numa predição errada é desastre.

Isso transforma empresário e academia em **contra-inteligência**: o quanto
você sabe do que eles sabem sobre você.

---

## 5. Cruzamentos com os sistemas existentes

| Sistema | Como conversa |
|---|---|
| **Declínio (idade)** | Velho não instala arma nova (`WEAPON_AGE_PENALTY`), mas `fightIQ` sobe com a idade → **o veterano sobrevive de isca, não de arma nova**. Arco de carreira emergente, sem roteiro. |
| **Sinergia técnico-atleta** | `coachSynergy` é o multiplicador de velocidade de instalação. Trocar de técnico no meio de uma reinvenção é uma decisão cara e real. |
| **Academia** | `specialties` define **quais armas existem pra você**. A academia deixa de ser um número de bônus e vira o limite do seu vocabulário técnico. |
| **Rivalidade** | Rival tem `READ_RIVALRY_BONUS`. Trilogias ficam brutais. Uma revanche contra alguém que já te leu exige arma nova ou isca. |
| **careerLog / documentário** | 3 tipos novos: `weapon_revealed`, `figured_out`, `reinvention`. O documentário final ganha **segundo ato de verdade** — a queda e a reinvenção, não só a subida. |
| **Balanceamento (#4)** | Dificuldade que escala com o sucesso, de forma diegética. |
| **DNA oculto** | `fightIQ` e `discipline` (ocultos) governam isca e instalação. Mais dois motivos pra descobrir seu próprio lutador. |

## 6. Eventos de careerLog

- **`weapon_revealed`** — a estreia da arma nova. *"A noite em que ele mostrou o wrestling."*
- **`figured_out`** — 2 derrotas seguidas com `lastReadQuality >= FIGURED_OUT_READ` nas duas. *"O mundo abriu o livro sobre ele."* Grava `figuredOutAtAbsWeek`.
- **`reinvention`** — `REINVENTION_WINS` (3) vitórias seguidas depois de um `figured_out`. *"Ele voltou outro lutador."*

## 7. Arquitetura

**Novo**: `js/services/tape-service.js` — classe estática, sem `db`. Toda a
lógica de leitura, isca, arma e maestria vive aqui e é testável isoladamente.

API:
- `TapeService.signatureOf(fighter)` → `planKey | null`
- `TapeService.readQuality(opponent, target, ctx)` → `0..1`
- `TapeService.resolveTactics({ player, opponent, gamePlanKey, bait, rivalryIntensity, opponentAcademy })` → `{ opponentPlanKey, edgeA, edgeB, planModFactorA, readQuality, baitOutcome, weaponReveal }`
- `TapeService.recordFight(fighter, { gamePlanKey, promoTier, isTitleFight, readQuality })`
- `TapeService.decayIdle(fighter, absWeekNow)`
- `TapeService.installProgress(fighter, academy)` → maestria ganha na semana

**Modificados**:
- `models/fighter.js` — campo `tape`
- `models/fight-offer.js` — campo `bait`
- `controllers/simulation.js` — `simulateFight` aceita `tactics`; `perfB` passa a receber plano e vantagem. **Sem `tactics`, o comportamento é idêntico ao de hoje** (a IA luta balanced, edge B = 0) — a mudança é aditiva.
- `services/world-service.js` — chama `TapeService.resolveTactics` antes da luta do jogador e `recordFight` depois (nos dois lutadores)
- `controllers/training-camp.js` — spec `install_weapon`
- `controllers/game-controller.js` — decay semanal, `setBait`, dossiê espelho, careerLog
- `config/game-config.js` — `TAPE_CONFIG`, `COUNTER_OF`
- `views/offers.js` — bloco "O que eles sabem sobre você" + toggle de isca
- `views/training-camp.js` — seleção de arma

## 8. Risco, medição e o que a medição refutou

O risco declarado era: dar vantagem de plano ao adversário — que hoje luta sem
plano nenhum — sobe a dificuldade de forma abrupta.

**O harness (2000 lutas por célula) refutou três suposições do design original.**
Registrado aqui porque os números que este documento propunha estavam errados, e
o motivo importa mais que os valores finais.

### O motor é hipersensível a vantagem

Medido: **~3 pontos percentuais de taxa de vitória por 0.01 de `edge`.** Todo
número deste sistema teve que encolher. `TAPE_READ_EDGE` caiu de 0.10 para 0.03,
`EDGE_CEIL` de 0.15 para 0.12.

### A dificuldade era um degrau, não uma curva

A primeira versão fazia o adversário ganhar o `_planEdge` de atributos **inteiro**
no instante em que cruzava `READ_THRESHOLD`. Resultado: a vitória caía de 83% para
65% **num único passo de exposição**. Correção: a vantagem dele escala com a
confiança — `edgeB = readQuality × (_planEdge + TAPE_READ_EDGE)`.

Curva final (striker puro, adversário de OVR igual):

| exposição | 0% | 25% | 50% | 75% | 100% |
|---|---|---|---|---|---|
| vitória | 82.2% | 83.4% | 82.0% | 77.6% | 74.8% |

Queda de ~7.4pp ao longo da carreira, suave. Arma nova na estreia: **88.3%** (+13.5pp).

### A isca estava morta

Medida em três perfis, a isca era **negativa para todos** (−6.7pp a −17.3pp),
inclusive o veterano. Causa: iscar custa o bônus de `planMastery` (até +0.08),
enquanto o counter evitado valia menos que isso. Ninguém jamais a usaria.

A correção não foi premiar mais o jogador — foi **punir o adversário que se
comprometeu** (`BAIT_OPPONENT_PENALTY`) e prender a chance de verdade ao
`fightIQ`. Resultado:

| perfil | aguenta o counter | isca | delta |
|---|---|---|---|
| especialista (fightIQ 62) | 69.7% | 63.0% | **−6.7pp** |
| completo (base ampla) | 80.5% | 68.5% | **−12.0pp** |
| veterano (fightIQ 88) | 74.4% | 81.4% | **+7.0pp** |

É exatamente o arco que a Seção 5 prometia: **o veterano sobrevive de leitura,
o especialista precisa da arma nova — que é justamente o que a idade tira dele.**
O design não foi roteirizado; ele caiu da matemática.

### A academia não era um limite

A 0.15, `WEAPON_MIN_SPECIALTY` deixava a Fortaleza (nível 2) ensinando as mesmas
4 armas que a Elite (nível 3) — a academia virava só um preço diferente. A 0.20
vira uma escada real:

| academia | armas que sabe ensinar |
|---|---|
| Black Tiger (nível 1) | **nenhuma** — reinventar-se exige sair de lá |
| Fortaleza (nível 2) | 3 (sem `pressure`) |
| Elite (nível 3) | 4 |

E `WEAPON_INSTALL_BASE` caiu de 14 para 7: a 14 a arma ficava pronta em **3
semanas** — barato demais. A 7, um jovem na Elite gasta ~6 semanas (um camp
inteiro) e um veterano de 37 gasta ~9 (**mais que um camp**). A promessa de que
o velho não se reinventa por arma nova virou verdade mecânica, não texto.

### Mitigações que sobreviveram

1. **Rampa de novato** (`EXPOSURE_ROOKIE_SCALE`): leitura quase nula nas
   primeiras 8 lutas. O começo da carreira não muda.
2. **`READ_THRESHOLD`**: leitura fraca não vira plano nenhum.
3. **Teto de vantagem** (`EDGE_CEIL`), abaixo do que o jogador já conseguia
   contra a IA. É simetria, não punição.

Harness de balanceamento: reprodutível com Node sobre `js/` (ESM), sem DOM —
`TapeService` e `SimulationEngine` são puros de propósito, justamente para isto.

## 9. Fora de escopo

- Repertório técnico substituindo atributos planos (a "Opção C" — reescrita do
  motor de luta). Fica pra decisão futura.
- Sala de treino viva / sparring partners como pessoas (a "Opção B"). É a
  próxima fase, e este sistema já deixa o gancho pronto: **o companheiro que
  sai da academia leva o seu livro pro adversário.**
