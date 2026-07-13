# Carreira sistêmica de 1 lutador — Design

> Sucessor direto do MMA Manager (modo treinador/academia). Substitui também a
> tentativa de pivot narrativo em `CONCEITO_RPG.md`/`FATIA_VERTICAL.md` — esses
> dois documentos ficam como histórico, não como direção ativa.
>
> Gancho: você não é mais dono de uma academia com 3 atletas. Você **é** o
> lutador — do primeiro contrato profissional à aposentadoria. O mundo simulado
> (promoções, cinturões, IA controlando centenas de lutadores) continua
> existindo por baixo; a câmera é que muda de "gerente" para "carreira".

Escopo escolhido: **big bang**. Este documento cobre a fundação estrutural, o
retrofit de cada sistema já existente para o contexto de 1 lutador, e as
mecânicas novas pedidas — tudo numa passada só, sem fatiar em specs
separados. O tradeoff aceito: documento grande, implementação em várias
etapas internas (ver Seção G).

---

## 0. O que já existe e não precisa ser reinventado

Auditoria do motor atual (`js/`) — importante porque o prompt original pede
"não repita ideias existentes", e boa parte do que parecia faltar já está
construído:

| Sistema já pronto | Arquivo | Fica gym-agnóstico? |
|---|---|---|
| Atributos (21 stats), DNA oculto (potential/discipline/determination + 5 traços booleanos) | `models/fighter.js` | Sim — já é por lutador |
| Declínio por idade (curvas físico vs técnico vs mental) | `models/fighter.js` (`_applyAgeDecline`) | Sim |
| Corte de peso (naturalWeight/ease/impact) | `models/fighter.js` | Sim |
| Névoa de guerra / scouting em 4 níveis | `services/scouting-service.js` | Sim (adaptar só a regra "seus atletas = nível 3 sempre") |
| Lealdade, promessas, expectativas de atleta | `models/fighter.js` + `services/retention-service.js` | Sim (reescopar de "seu roster" pra "você") |
| Rivalidades (intensidade, histórico) | `models/rivalry.js` + `services/rivalry-service.js` | Sim |
| Hype de coletiva → bônus de bolsa | `controllers/press-conference.js` | Sim |
| Contratos de promoção (tiers, corte, renovação) | `services/contract-service.js` | Sim |
| Rankings, cinturões, interinos | `services/ranking.js`, `services/title-service.js` | Sim |
| Hall da Fama, purga de aposentados irrelevantes | `services/hall-of-fame.js`, `world-service.js` | Sim |
| Mundo vivo (5 promoções, elencos de IA, tier movement, draft anual) | `services/world-service.js` | Sim |
| Patrocínios com metas | `services/sponsor-service.js` | **Não** — hoje é 100% por `gym` |
| Economia (caixa, ledger, aluguel, mensalidade de alunos) | `models/gym.js` | **Não** — é o núcleo do que muda |
| Recrutamento de agentes livres pro "seu time" | `views/market.js` | **Não se aplica** — sem elenco |
| Gerenciar múltiplos atletas | `views/roster.js` | **Não se aplica** |
| Academias rivais roubando SEU elenco | `services/rival-gym-service.js` | **Não se aplica** como está — vira outra coisa |

Conclusão: a simulação profunda (a parte cara de fazer bem) já existe e é
reaproveitável quase 100%. O trabalho real é (1) a fundação estrutural
abaixo e (2) as mecânicas novas das Seções B–E.

---

## A. Fundação estrutural

### A.1 — `Academy` substitui `Gym` + `RivalGym`

Hoje `Gym` (singleton, `id: GYM_CONFIG.ID = 'gym-player'`) é dono de negócio:
caixa, ledger, treinadores contratados, nível de instalação, olheiro.
`RivalGym` é a versão leve pra IA: nome, reputação, contratações, atletas
roubados.

Novo model único `Academy` (`js/models/academy.js`), representando um LUGAR
no mundo, sem dono:

```js
class Academy {
  id;              // 'academy-<slug>'
  name;
  reputation;       // 0-100, como hoje
  facilityLevel;    // 1-4, reaproveita FACILITY_LEVELS
  specialties;      // { striking: 0-100, grappling: 0-100, cardio: 0-100 } — qualidade do treino, substitui COACH_CONFIG por contratação
  headCoach;        // { name, personality: 'aggressive'|'cautious'|'analytical' } — ver Seção C.2
  philosophy;       // tag curta pra flavor/UI: 'tradicional' | 'moderna' | 'agressiva'
  weeklyFee;        // custo semanal pra treinar lá — substitui WEEKLY_RENT/COACHING
  rosterSize;       // quantos lutadores (IA) treinam lá — só flavor/lore
}
```

`RIVAL_GYMS` (hoje 3 academias fixas) vira o catálogo inicial de opções —
crescer pra 6-8 depois é conteúdo, não arquitetura nova. Toda `Fighter`
(sua ou de IA) aponta pra uma `Academy` via `academyId` (renomeia
`gymId` → `academyId` em todo o código, é find-and-replace mecânico).

### A.2 — Dinheiro sai da Academia, vai pro lutador

`Fighter` ganha dois campos novos: `cash` (saldo gasto) e `ledger` (extrato,
mesma forma de `Gym.ledger` hoje: `{absWeek, label, amount}`). `Academy` não
guarda dinheiro nenhum.

Consequência em cascata (todo arquivo abaixo lê/escreve `gym.cash` ou
`gym.addTransaction` hoje e passa a ler/escrever `fighter.cash`/
`fighter.addTransaction` — método novo em `Fighter`, idêntico ao que existe
em `Gym`):

- `world-service.js::_settlePlayerFight` — comissão vira 100% sua (não há
  mais `managerCut` de academia — ver Manager na Seção C.1 pro novo dono
  desse corte).
- `sponsor-service.js` — contrato lê `fighter.record`/`fighter.popularity`
  em vez de `gym.wins`/`gym.reputation`. Ver Seção E.2.
- `retention-service.js` — bônus de permanência sai do seu caixa pessoal.
- `contract-service.js::terminate` — multa sai do seu caixa.
- `training-camp.js` — custo semanal de camp (`CAMP_CONFIG.WEEKLY_COST`)
  vira despesa pessoal.
- Treinar numa `Academy` específica passa a cobrar `academy.weeklyFee`
  semanalmente do seu `cash` — trocar de academia é decisão econômica real.

### A.3 — O que morre (código removido, sem substituto 1:1)

- `views/market.js` + a rota `'market'` em `app.js` + `game.recruitFighter`/
  `recruitFee` em `game-controller.js` — recrutar pro "seu time" não existe.
- `views/roster.js` + a rota `'roster'` — perfil do seu único lutador
  (`fighter-profile.js`, já existe) vira a tela "seu roster".
- `services/rival-gym-service.js` inteiro — a metade 1 (rivais recrutando
  agentes livres do mercado) é flavor de mundo, migra pra dentro de
  `world-service.js` como um headline ocasional sem mecânica própria. A
  metade 2 (sondar/roubar SEU atleta) não morre — vira o sistema de
  Lealdade da Seção C (ver A.4).
- Contratar/demitir treinador como compra avulsa (`AcademyView`
  facility/coach hire) — treinador bom é atributo da `Academy` que você
  ESCOLHE, não uma linha de compra.
- `GYM_CONFIG.STUDENT_INCOME_*` (mensalidade de alunos) — não existe mais
  "sua escola", não há renda passiva de alunos.

### A.4 — `RetentionService` é reaproveitado, não descartado

A sondagem/lealdade/promessa/buyout já é, estruturalmente, "um rival tenta
te tirar de onde você está". Trocar o motor `[fighter pertence à MINHA
academia]` por `[EU sou o fighter]` é o mesmo sistema com o sujeito
trocado: em vez de uma `Academy` rival sondar um atleta do seu roster pra
roubá-lo, uma `Academy` rival (ou um `Manager` rival, Seção C.1) sonda VOCÊ
pra trocar de academia/empresário. As 4 respostas (renegociar, bônus de
permanência, promessa, deixar ir) continuam fazendo sentido 1:1.

### A.5 — Decisão técnica: reset de save

Merge de `Gym`+`RivalGym` em `Academy`, `gymId`→`academyId`, dinheiro saindo
de `Gym` pra `Fighter` — quebra o formato de save atual sem meio-termo
razoável (migração aditiva não cobre "a entidade dona do dinheiro mudou").
Projeto não publicou pra público ainda (`build-itch.js` é de hoje). Decisão:
**reset limpo**, sem migração. `save-service.js` não precisa de lógica de
versão pra este corte — só bump de uma constante de versão do save pra
saves antigos serem rejeitados com mensagem clara em vez de crashar.

### A.6 — Como identificar "o lutador do jogador"

Hoje isso é ownership: `fighter.gymId === GYM_CONFIG.ID`. Sem posse de
academia, vira identidade: `gameState` ganha doc singleton
`{id: 'career', playerFighterId, ...}`. Todo ponto do código que hoje
filtra "meu atleta" por `gymId === GYM_CONFIG.ID` passa a comparar
`fighter.id === career.playerFighterId` — mais simples que antes (chave
primária, não índice secundário). `FighterController.getTeam(gymId)`
morre; vira `getPlayerFighter()` (busca direta por id).

### A.7 — Onboarding e criação de personagem

`app.js::_maybeShowOnboarding` hoje pergunta nome da ACADEMIA + dificuldade
+ mostra os 3 atletas iniciais. Novo fluxo (mecânico, não visual — telas
ficam pra implementação):

1. Nome do lutador, nacionalidade, categoria de peso.
2. Arquétipo inicial (Striker/Grappler/Brawler/Generalista) — aplica um
   viés leve nos `attributes` iniciais via `Fighter.expandAttributes`
   (já suporta pesos por atributo-base; arquétipo vira um preset de
   quais atributos recebem o "jitter" mais alto).
   Origem esportiva (Kickboxing/Judô/Wrestling/Muay Thai/BJJ/Boxe) —
   mesma lógica, mapeia pra 2-3 atributos técnicos com viés positivo.
3. Dificuldade (`DIFFICULTIES`, já existe) define `cash` inicial pessoal
   em vez de `gym.cash`.
4. Escolha da primeira `Academy` (ver Seção E.3) — decisão de carreira
   desde o dia 1, não facilitação.

DNA oculto (`hidden.potential/discipline/determination` + os 5 traços
booleanos) continua gerado nos bastidores como hoje — só que agora nem
o PRÓPRIO jogador vê os valores exatos de cara (ver Seção B.1).

---

## B. Corpo & carreira

### B.1 — Auto-descoberta de DNA (NOVO)

**Mecanismo.** Hoje `knowledgeOf(fighter, gym)` retorna nível 3 (visão
total) sempre que `fighter.gymId === GYM_CONFIG.ID` — ou seja, você vê 100%
do seu próprio lutador desde o primeiro dia. Isso muda: `Fighter` ganha
`discoveredTraits: []` (subset de `dna` + os 3 hidden numéricos). Sem
estar em `discoveredTraits`, a interface mostra faixa/rótulo vago
("parece ter boa recuperação?") em vez do valor exato — a MESMA função
`ScoutingService.blur()` já usada pra adversários, só que aplicada a você
mesmo agora.

**Gatilhos de descoberta** (cada um é um evento, não um menu):
- `exceptionalRecovery` revela-se na primeira vez que o lutador se
  recupera rápido de um corte de treino pesado ou de uma lesão curta.
- `injuryProne` revela-se após a 2ª lesão em menos de 52 semanas.
- `pressurePerformer`/`bigEventNervous` revelam-se na primeira luta de
  tier 1 ou disputa de cinturão (ver B.3/C.3 — hoje esses dois traços
  são definidos em `DNA_TRAIT_NAMES` mas não achei nenhum código que os
  LEIA de fato; implementar a leitura é parte desta mecânica, não só a
  descoberta).
- `emotionallyUnstable` revela-se após a 1ª sequência de 3+ oscilações
  grandes de moral em poucas semanas.
- `potential`/`discipline`/`determination` (numéricos) revelam-se em
  faixas (Baixo/Médio/Alto/Elite, reaproveita `POTENTIAL_TIERS`) conforme
  o número de lutas cresce — sua evolução real ao longo do tempo é a
  única forma de estimá-los, igual um atleta de verdade só descobre seu
  teto competindo.

**Conecta com:** scouting (mesma função `blur`), press conference (uma
pergunta pode ser "o que te motiva?" e a resposta empurra a descoberta de
`determination` mais cedo), Manager (Seção C.1 — um empresário
"perceptivo" acelera descobertas).

**Decisões que cria:** arriscar um camp mais intenso pra "descobrir" seu
teto mais rápido vs jogar seguro e descobrir devagar; confiar ou não no
discurso do técnico sobre seu próprio potencial (ele pode errar — ver C.2).

**Consequência curto prazo:** o jogador não sabe se está investindo num
prospecto elite ou num lutador mediano nas primeiras temporadas — cada
carreira nova é genuinamente incerta, não uma otimização de planilha
visível desde o início.

**Consequência longo prazo:** a narrativa de "eu não sabia que tinha esse
potencial" ou "descobri tarde demais que era frágil" emerge do próprio
jogo, sem escrever roteiro nenhum — é literalmente o pedido do prompt
original (histórias emergentes via sistemas, não script).

### B.2 — Lesões com sequelas permanentes (NOVO)

**Mecanismo.** Hoje `_rollInjury` em `world-service.js` só define
`untilAbsWeek` — o lutador volta 100% igual depois. Nova camada: toda
lesão tem `severity` (leve/moderada/grave, derivado das mesmas chances
que já existem — finish bonus, injuryProne bonus) e lesões
moderadas/graves rolam uma chance de `permanentScar`:

```js
fighter.permanentScars.push({
  bodyPart: 'joelho' | 'mão' | 'costela' | 'cervical',
  attributeCeilings: { takedowns: -8, wrestling: -5 }, // teto reduzido, não valor atual
  compensation: { fightIQ: +3 }, // adapta o estilo — dor ensina
  fromFightId,
  atAbsWeek,
});
```

`attributeCeilings` não reduz o atributo na hora — reduz o TETO que
`evolve()` consegue alcançar dali pra frente (mexe no clamp máximo, não
no valor). `compensation` é o "aprendeu a lutar diferente" — pequeno
ganho compensatório em atributo mental, nunca físico.

**Conecta com:** evolução (`Fighter.evolve()` passa a respeitar
`effectiveCeiling(attr)` em vez de fixo 99), plano de jogo (um lutador
com sequela de joelho vira `weakVs: 'grappler'` de fato, não só de nome),
auto-descoberta (a sequela É um gatilho de descoberta de `injuryProne`).

**Decisões que cria:** aceitar uma luta de última hora sabendo que uma
lesão feia agora pode custar 5% de teto de wrestling pro resto da
carreira; mudar de arquétipo (de grappler pra striker) depois de uma
sequela de joelho, em vez de insistir no que já não funciona mais.

**Consequência curto/longo prazo:** curto — decisão tensa de arriscar
ou não uma luta com dor. Longo — a curva de carreira de cada lutador
fica torta de um jeito diferente; dois lutadores com o mesmo DNA inicial
terminam fisicamente diferentes dependendo de QUANDO e COMO se
machucaram, não só quantas vezes.

**Por que melhora a experiência:** hoje lesão é só "pausa temporária";
isso a transforma em marca de carreira — o tipo de coisa que aparece no
documentário final (Seção B.3) com peso real.

### B.3 — Legado & documentário de carreira (NOVO — capstone)

**Mecanismo.** Na aposentadoria, gerar uma tela estruturada em capítulos
(Ascensão / Auge / Declínio / Legado), cada um puxando dados que JÁ
existem e já são coletados: primeira luta (`fighter.fights[last]`),
maior sequência (`winStreak` histórico, precisa registrar o pico —
hoje só o atual), maior zebra (maior gap de `overallRating` vencido —
dado já existe em `fights[]`, falta só calcular o máximo), rivalidades
(`rivalry-service.js` já tem `history`), cinturões (`titlesWon`,
`HallOfFame.checkEligibility`), sequelas (`permanentScars` da B.2),
traços de DNA descobertos (`discoveredTraits` da B.1).

Isto é essencialmente um agregador sobre o **motor de histórias
emergentes** central (Seção F) — não introduz estado novo, só uma view
que consome o que o careerLog já registrou continuamente.

**Conecta com:** tudo — é o único sistema que LÊ de todos os outros e não
escreve em nenhum.

**Decisões que cria:** nenhuma direta (é pós-jogo) — mas a EXPECTATIVA de
"isso vai aparecer no meu documentário" influencia decisões durante a
carreira (aceitar a revanche por orgulho, não só por bolsa).

**Consequência:** dá peso emocional ao fim de uma carreira que hoje só
tem a cerimônia de Hall da Fama (`retirement-ceremony.js`, já existe,
mas é genérica) — vira específica e pessoal pra CADA carreira jogada.

---

## C. Mente & relações

### C.1 — Empresário / Manager (NOVO, entidade própria)

**Mecanismo.** Novo model `js/models/manager.js`:

```js
class Manager {
  id; name;
  style;        // 'aggressive' | 'conservative' | 'loyal'
  cut;          // % da bolsa — substitui o managerCut que hoje vivia em Gym
  trust;        // 0-100, cresce/cai com decisões (parecido com gym.trust hoje)
  connections;  // bônus de chance de oferta de patrocínio/tier acima
}
```

Você contrata um `Manager` (catálogo de poucos nomes, como as `Academy`s)
em vez de aceitar ofertas de promoção diretamente. `aggressive` negocia
bolsas maiores (`NEGOTIATION_CONFIG` já existente passa a ser executado
pelo manager, com leverage maior) mas queima pontes com promoções que
recusam (`RESCIND_CHANCE` sobe); `conservative` aceita mais fácil, bolsas
menores, quase nunca gera atrito; `loyal` nunca te trai (nunca some com
uma % maior escondida) mas tem pior faro pra oportunidades.

**Conecta com:** economia pessoal (o `cut` dele é retirado ANTES do seu
`cash`, no lugar onde hoje `managerCut` da `Gym` saía), scouting (manager
"perceptivo" acelera auto-descoberta de DNA, ver B.1), retenção (um
manager pode ser sondado por um EMPRESÁRIO RIVAL, reaproveitando o motor
da Seção A.4 mais uma vez, agora pra troca de empresário em vez de
academia).

**Decisões que cria:** trocar de manager no meio da carreira (multa de
rescisão, igual `ContractService.terminate` hoje) buscando um estilo mais
alinhado com a fase atual (agressivo quando jovem e querendo subir rápido,
leal quando veterano e querendo estabilidade); tolerar um corte maior por
um manager com mais conexões.

**Consequência curto/longo prazo:** curto — bolsa líquida diferente a
cada luta dependendo do manager. Longo — um manager agressivo pode abrir
portas mais cedo mas deixar você "queimado" com 2 promoções por rescisões
malsucedidas, fechando caminhos pro resto da carreira.

**Por que melhora a experiência:** hoje o corte de bolsa é um número fixo
sem rosto (`GYM_CONFIG.MANAGER_CUT`). Dar personalidade a quem fica com
aquela fatia transforma um imposto invisível em uma relação com trade-off.

### C.2 — Sinergia técnico-atleta (COMPLETA sistema já citado no CONCEITO_RPG.md, nunca implementado)

**Mecanismo.** Cada `Academy` tem `headCoach: { name, personality }`.
Novo campo em `Fighter`: `coachSynergy` (0-100, um único valor "atual",
não um histórico por academia). Ao trocar de `Academy`, o valor não
zera: `coachSynergy = Math.round(coachSynergy * 0.4)` — treinador novo
não começa do total zero de confiança, mas também não herda a sinergia
antiga inteira.
Cresce com: seguir o conselho do córner e vencer o round; declina com:
ignorar o conselho e perder o round.

`personality` determina o COMPORTAMENTO do conselho em `CORNER_INSTRUCTIONS`:
- `analytical`: sugestões precisas mesmo com sinergia baixa, mas frias
  (sem bônus de moral).
- `aggressive`: sempre sugere pressionar, ótimo bônus se sinergia alta,
  péssimo (te deixa exausto) se sinergia baixa.
- `cautious`: sugestões conservadoras, raramente erra mas raramente
  também dá o bônus grande.

Sinergia baixa faz a sugestão do córner ter chance de ser **genérica ou
errada** (lê o adversário pior do que o `GAME_PLANS` real sugeriria) —
mecanicamente, embaralha o `strongVs`/`weakVs` do conselho mostrado com
probabilidade inversa à sinergia.

"Lutar no instinto" (ignorar o córner por completo) já é possível
implicitamente (o jogador pode ignorar o botão sugerido); formalizar como
opção explícita que usa `fighter.attributes.composure`/`fightIQ` direto
em vez de qualquer bônus de córner — arriscado com sinergia alta (joga
fora um bônus bom), sensato com sinergia baixa (o córner ia te atrapalhar
mesmo).

**Conecta com:** escolha de academia (Seção E.3 — trocar de academia
custa sinergia), psicologia (C.3 — baixa sinergia amplifica
`bigEventNervous` em momentos de pressão), DNA (`adaptability` alto
reduz a penalidade de sinergia baixa — lutador se vira sozinho).

**Decisões que cria:** seguir o córner mesmo discordando (construção de
sinergia de longo prazo) vs confiar no próprio instinto agora
(ganho/perda imediata); ficar numa academia com técnico ruim mas
sinergia alta vs trocar pra uma com técnico melhor e começar do zero de
confiança.

**Consequência:** curto — instrução de round pode sair furada com
sinergia baixa, perdendo rounds "por falta de comunicação" (eco direto da
frase do prompt original). Longo — carreiras que ficam numa academia só
desenvolvem uma relação técnica quase narrativa; carreiras que trocam
muito de academia nunca atingem o teto de bônus de sinergia.

### C.3 — Psicologia de momento crítico (ESTENDE leitura de DNA já existente)

**Mecanismo.** Correção após ler `controllers/simulation.js`:
`pressurePerformer`/`bigEventNervous` JÁ são lidos em
`SimulationEngine._calcRoundPerformance` (±10% flat quando `isBigEvent`) —
não é código morto como uma leitura inicial sugeriu. O que falta: hoje
"big event" é binário (`promo.tier === 1`, decidido em
`world-service.js::_runEvent`). Passa a ser um `pressureLevel` gradiente
(0-100) somando peso por: luta de título, revanche, sequência em risco,
primeira luta num tier novo, rivalidade `grudge` (D.3). `pressurePerformer`/
`bigEventNervous` escalam com esse gradiente em vez do flat ±10%;
`composureFactor` (já calculado em `_calcRoundPerformance`, hoje só
aplicado dentro do `if (isBigEvent)`) passa a aplicar sempre, também
escalando com `pressureLevel` em vez de tudo-ou-nada.

**Conecta com:** auto-descoberta (B.1 — esses dois traços só se
descobrem EXATAMENTE num momento de pressão alta, o que faz a descoberta
ser dramática por natureza), sinergia (C.2 — baixa sinergia amplifica o
efeito de `bigEventNervous`), rivalidades (D.3 — luta de rivalidade
intensa conta como pressão alta).

**Decisões que cria:** nenhuma escolha direta do jogador aqui (é
consequência, não input) — mas empurra decisões ADJACENTES: um lutador
que se descobriu `bigEventNervous` faz o jogador evitar acelerar rumo a
título (fica mais devagar de propósito) ou dobrar a aposta em treino
mental.

**Consequência:** a MESMA luta de título é vivida de forma
estatisticamente diferente dependendo do DNA oculto do seu lutador —
gera o tipo de "esse cara sempre trava nos grandes palcos" que vira
identidade de carreira sem ser escrito à mão.

---

## D. Mundo & narrativa emergente

### D.1 — Motor de histórias emergentes / careerLog (NOVO — peça central, ver Seção F)

Descrito em detalhe na Seção F por ser transversal a tudo. Resumo: um
log append-only de eventos notáveis (título, zebra, sequência, revanche,
descoberta de DNA, sequela permanente, troca de manager/academia) que
todo outro sistema PUBLICA nele e que imprensa (D.2), documentário (B.3)
e rivalidades (D.3) CONSOMEM dele — ninguém mais inventa "momento
memorável" com sua própria lógica isolada.

### D.2 — Redes sociais como sistema contínuo (ESTENDE press-conference existente)

**Mecanismo.** Hoje `PressConference` só dispara na semana de luta.
Estende o MESMO motor (`applyEffects`, hype, `RIVALRY_HYPE_THRESHOLD`)
pra rodar em cadência leve TAMBÉM em semanas livres: 1-2 vezes por mês,
uma notificação tipo "publicar nas redes" com 3-4 opções curtas
(provocar rival ativo, pedir title shot, responder crítica, ficar quieto).
Reaproveita `pcHype`, `applyMoraleChange`, `rivalryService`.

**Conecta com:** rivalidades (provocar sem luta marcada AINDA cria/
aumenta intensidade, puxando uma disputa antes mesmo da promoção marcar
o confronto), patrocínio (D.2 alimenta E.2 — marcas de imagem reagem ao
seu tom público), careerLog (toda postagem de alto impacto vira entrada).

**Decisões que cria:** manter perfil de "profissional quieto" (sponsors
de imagem conservadora gostam, mas hype/audiência cresce devagar) vs
"provocador" (audiência e bolsa por hype sobem, mas quebra cláusula de
patrocinador de imagem limpa, ver E.2).

**Consequência curto/longo prazo:** curto — pequeno ganho/risco por
semana. Longo — sua persona pública vira um ativo (ou passivo) que
precede sua chegada em cada evento — a IMPRENSA reage à sua história
acumulada, não só ao card da semana.

### D.3 — Rivalidades com origem e identidade (ESTENDE `Rivalry` existente)

**Mecanismo.** `Rivalry.type` hoje é sempre `'competitive'` hardcoded.
Passa a derivar do careerLog (D.1): se nasceu de uma provocação nas redes
(D.2) → `type: 'grudge'`; se nasceu de uma decisão dividida polêmica →
`type: 'robbery'`; se é puro choque de ranking sem faísca pessoal →
`type: 'competitive'` (como hoje). Cada tipo muda o TOM das notificações
já existentes e ativa `pressureLevel` mais alto na revanche (C.3).

**Conecta com:** careerLog (fonte da origem), psicologia (pressão extra
em revanche de grudge), imprensa (D.2 — perguntas de coletiva mudam de
tom conforme o tipo de rivalidade).

**Decisões que cria:** alimentar uma rivalidade de grudge publicamente
(bolsa maior na revanche, mas pressão psicológica maior também) vs
desescalar (menos hype, luta "mais limpa" mentalmente).

**Consequência:** trilogias de grudge viram genuinamente memoráveis
porque carregam contexto acumulado real, não só um contador de
intensidade subindo.

---

## E. Negócio & decisões de carreira

### E.1 — Custo de vida pessoal (NOVO)

**Mecanismo.** `Fighter` ganha `lifestyleTier` (Modesto/Confortável/
Luxuoso), cada um com upkeep semanal fixo debitado do `cash` pessoal
(reaproveita o padrão de `weeklyExpenses` que `Gym` já tem hoje, só que
por lutador). Subir de tier dá pequeno bônus de moral/popularidade
(mídia gosta de ver sucesso "aparente") mas cria dependência: descer de
tier depois de ter subido custa moral (perda de status é pior que nunca
ter ganho). Popularidade alta EMPURRA sugestão de subir (tentação, não
obrigação).

**Conecta com:** popularidade (`popularityTier` já existe, vira gatilho
de tentação), manager (C.1 — manager `aggressive` empurra lifestyle mais
caro "pra manter a imagem"), sequência de derrotas (perder com lifestyle
alto e caixa caindo é o aperto real).

**Decisões que cria:** subir o padrão de vida no auge (sente bem, mas
é um compromisso semanal que continua existindo numa fase de baixa) vs
manter modesto (menos volátil, menos "aparência de sucesso").

**Consequência curto/longo prazo:** curto — mais uma linha na economia
semanal. Longo — é o mecanismo sistêmico do "atleta que ganhou muito e
morreu pobre" — clássico do esporte, emergente aqui em vez de
escrito.

### E.2 — Patrocínio pessoal com cláusula de imagem (ESTENDE `SponsorService`)

**Mecanismo.** Reaproveita quase tudo de `sponsor-service.js` — só troca
a fonte de dados de `gym.wins`/`gym.reputation` pra
`fighter.record`/`fighter.popularity`. O que é novo: `SPONSOR_BRANDS`
ganha um campo `imageClause: 'clean' | 'villain' | null`. Marca `clean`
cancela o contrato (com penalidade de reputação) se D.2 registrar
`type: 'provocador'` demais num período; marca `villain` paga BEM mas
exige o oposto (precisa manter hype/provocação ativa, senão não renova).

**Conecta com:** redes sociais (D.2 é o gatilho de quebra/cumprimento),
economia pessoal (E.1 — patrocínio é a principal renda passiva que
sobra sem o `gym` de "mensalidade de alunos").

**Decisões que cria:** aceitar um contrato `villain` lucrativo que te
força a manter uma persona pública específica, mesmo quando não bate
com o que você quer fazer numa fase da carreira.

**Consequência:** dinheiro fácil de patrocínio de imagem vem com corda
no pescoço — trade-off real em vez de renda passiva sem custo.

### E.3 — Escolha de academia como aposta de carreira (ESTENDE Seção A.1)

**Mecanismo.** Trocar de `Academy` (a qualquer momento, com custo de
sinergia perdida, ver C.2) é decisão explícita, não upgrade linear.
Academia cara (facilityLevel alto) dá `trainingBonus` melhor mas
`weeklyFee` mais alto E come mais sinergia ao entrar (impessoal, "mais um
número"); academia pequena/barata cresce sinergia mais rápido (atenção
individual) mas teto de `trainingBonus` mais baixo.

**Conecta com:** tudo de C (sinergia, manager) e A.2 (seu caixa pessoal
paga a mensalidade).

**Decisões que cria:** ficar numa academia pequena onde você é
prioridade vs entrar numa academia grande onde os recursos são melhores
mas você é "mais um" — é literalmente o texto do prompt original
("academias pequenas oferecem atenção individual, academias grandes têm
melhores profissionais"), agora com números por trás.

**Consequência:** não existe "melhor academia" universal — depende de
que fase de carreira e que DNA (um lutador com `adaptability` alto sofre
menos com academia grande/impessoal).

---

## F. Integração cruzada — o motor de histórias emergentes (`careerLog`)

Peça de infraestrutura que faz TUDO acima realmente conversar entre si,
em vez de cada sistema ter sua própria noção isolada de "isso foi
importante".

**Formato** (documento único em `gameState`, padrão idêntico ao que
`scouting`/`sponsors` já usam — sem store novo no IndexedDB):

```js
{ id: 'careerLog', entries: [
  { type: 'title_won'|'upset'|'streak'|'rematch'|'dna_discovered'|
          'permanent_scar'|'academy_switch'|'manager_switch'|'rivalry_born',
    atAbsWeek, magnitude, // 0-100, usado pra ranquear "o que mais importa"
    data: { ... específico do tipo ... } }
]}
```

**Quem publica:** `world-service.js` (título/zebra/sequência),
`fighter.js`/B.1 (descoberta de DNA), B.2 (sequela), C.1 (troca de
manager), E.3 (troca de academia), `rivalry-service.js` (D.3).

**Quem consome:** documentário final (B.3), imprensa (D.2 — perguntas de
coletiva podem referenciar entradas recentes de alta magnitude),
notificações (headline "Giro do MMA" já existente em `world-service.js`
pode citar entradas de outros lutadores também, não só do jogador).

Sem isto, cada sistema novo (B.3, D.2, D.3) reinventaria sua própria
lógica de "o que foi memorável" — o careerLog é o que garante que duas
carreiras jogadas de formas diferentes produzam documentários/imprensa/
rivalidades genuinamente distintos, cumprindo o pedido central do prompt
original.

---

## G. Arquitetura técnica & plano de migração

### G.1 — Arquivos removidos
`views/market.js`, `views/roster.js`, `services/rival-gym-service.js`,
`models/rival-gym.js` (funde em `academy.js`).

### G.2 — Arquivos novos
`models/academy.js`, `models/manager.js`, `services/manager-service.js`,
`services/career-log-service.js` (leitura/escrita do doc `careerLog`).

### G.3 — Arquivos com rework estrutural (não tri­viais)
`models/gym.js` → funde pra dentro de `academy.js` (remove cash/ledger/
wins/losses/coaches-como-compra; ganha specialties/headCoach/philosophy).
`models/fighter.js` (ganha `cash`, `ledger`, `discoveredTraits`,
`permanentScars`, `academyId` no lugar de `gymId`, `managerId`).
`services/sponsor-service.js` (fonte de dados gym→fighter).
`services/retention-service.js` (reescopo pra 1 lutador, A.4 — passa a
aceitar um `targetType: 'academy'|'manager'` pra servir também C.1).
`services/world-service.js` (todo ponto que checa `GYM_CONFIG.ID`/
`gym.cash`/`gym.addTransaction` — são ~8 pontos, listados na Seção A.2).
`controllers/simulation.js` (`isBigEvent` binário → `pressureLevel`
gradiente, C.3; `_calcRoundPerformance` já faz quase tudo, é extensão
pontual, não reescrita).
`app.js` (remove rotas market/roster, reescreve onboarding pra criação de
personagem A.6, atualiza toda leitura de `gym`→`fighter.cash`).
`config/game-config.js` (`GYM_CONFIG`→ dividido entre config de `Academy`
e config de economia pessoal; `RIVAL_GYMS`→ vira catálogo de `ACADEMIES`).

### G.4 — Save
Reset limpo (A.5) — bump de versão em `save-service.js`, sem migração
aditiva pra este corte.

### G.5 — Fora de escopo desta rodada (backlog "algum dia")
- Crescer o catálogo de academias além de 3-6 nomes (conteúdo, não
  arquitetura — fácil de adicionar depois).
- Multiplayer/comparação de carreiras entre jogadores.
- Qualquer coisa do `CONCEITO_RPG.md`/`FATIA_VERTICAL.md` (medidores
  Ambição/Lealdade/Integridade/Sombra, bifurcação estrela/gângster) —
  documentos ficam como histórico, não como trabalho pendente.
