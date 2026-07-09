# Prompt de execução — MMA Manager (foco: Épico F)

> Cole este texto no início de uma sessão nova do Claude Code para continuar o
> desenvolvimento. Ele briefa o estado atual, prioriza o Épico F e carrega as
> convenções obrigatórias do projeto.

---

Você é um agente de engenharia continuando o desenvolvimento do **MMA Manager**,
um jogo de gestão de MMA em **JavaScript puro** (ES modules, sem build), com
IndexedDB, Three.js + GSAP + Lenis + Rive via CDN. Trabalhe e escreva em **pt-BR**.

## Fonte de verdade
Leia **`docs/PRD.md`** antes de tocar em qualquer código — é a fonte de verdade
do que falta. Seções mais importantes para esta missão:
- **Seção 0** — convenções obrigatórias (LEIA E OBEDEÇA)
- **Seção 7** — Épico F (narrativa) ← seu foco principal
- **Seção 9** — roadmap consolidado Fases 0–2
- **Seção 11** — padrão de performance das cenas 3D

## Estado atual (NÃO refazer)
O núcleo de carreira está completo: Épicos **A** (retenção), **B** (contratos
exclusivos), **C** (24 atributos), **D** (acampamento real no tick semanal),
**E** (o corpo: corte de peso, dano permanente, declínio por idade). Bugs P0
(B1, B2, B3, B6) resolvidos. Performance das cenas 3D corrigida. **Não
reimplemente nada disso** — confirme no código se tiver dúvida.

## FOCO PRINCIPAL: Épico F — A Narrativa
É o único épico central ainda aberto. Entregue em **fatias verticais**, nesta ordem:

**Fatia F1 — Hype da coletiva → bolsa/rivalidade (COMECE AQUI).**
A coletiva já está ligada à luta real (`js/app.js` → `renderPressConference`), e
`PressConference.applyEffects` (`js/controllers/press-conference.js`) já aplica
efeitos ao atleta. O que **falta** é o hype gerar **consequência**: aumentar a
bolsa da oferta/booking, alimentar a rivalidade (`js/services/rivalry-service.js`)
e motivar o adversário. É a menor fatia que entrega drama observável — o
encanamento (rivalidades, bolsa da oferta) já existe.

**Fatia F2 — Expectativas dos atletas.**
Um atleta invicto sem chance de título fica insatisfeito: `morale` e `loyalty`
caem e ele vira alvo fácil das academias rivais (amarra com o Épico A /
retenção). É a pressão do "conselho", invertida — seus atletas são seus chefes.

**Fatia F3 — Inbox estilo FM + o reencontro.**
Inbox com manchetes, callouts, provocações. E "o reencontro": um atleta roubado
por uma rival reaparece como adversário do seu, anunciado no pôster de luta.

Faça **uma fatia por vez**, com playtest entre elas (ver Regra de Ouro abaixo).

## Depois do Épico F: roadmap Fases 0–2 (seção 9 do PRD)
- **Fase 0** — Backlog G-series (seção 8). Começar por **G5** (cerimônia de
  aposentadoria), **G2** (tela de desafiantes), **G3** (gráfico de carreira).
  Dados já existem; é só superfície. (Pode ser feito em paralelo/antes de F se
  quiser vitórias rápidas.)
- **Fase 1** — **Regeneração do Mundo** (keystone da longevidade). Safra anual de
  prospects no circuito regional, patch aditivo `worldRegen`, teto de população.
  Critério: simular 20 anos sem o mundo colapsar.
- **Fase 2** — **Live Fight Hub** (play-by-play da luta, pilar recomendado) OU
  Academia como negócio (alternativa). Decisão pendente (seção 10, item 8).

**Escopo trava na Fase 2.** NÃO comece Fase 3 (regiões, eras, mídia) nem
doping/empresários — estão estacionados de propósito.

## Convenções obrigatórias (quebrar = bug)
- **Migração aditiva** via `gameState.meta.patches` em
  `GameController._applyPatches()`. Campo novo com default NÃO precisa recriar o
  mundo. **NÃO bumpe `WORLD_SCHEMA`** a menos que a forma do mundo mude de
  verdade — isso apaga a carreira do jogador.
- **`gameState` exige `id`** — todo `db.put('gameState', x)` precisa de `x.id`,
  senão lança `DataError`.
- **Nunca animar `opacity` do `#mainContent`** — um render concorrente mata a
  timeline e deixa a página em branco com o HTML no DOM. Ver `motion-engine.js`
  e `layout.js`.
- **`await LayoutView.render(html)` antes de registrar listeners** — o render é
  assíncrono (GSAP) com guarda de sequência (`_renderSeq`).
- **Cenas Three.js**: flag `disposed` + cancelar `rAF` no dispose + auto-descarte
  quando o canvas sai do DOM + cap de 30fps + `pixelRatio` ≤ 1.5. Ver seção 11.
- **Cores**: `--red`/`--belt` são preenchimento; `--red-ink`/`--belt-ink` são
  para texto (contraste ≥ 4.5:1). Ouro (`--belt`) só em cinturões e bônus.

## Regra de Ouro (a mais importante do processo)
**Uma fatia vertical por vez, com playtest entre elas.** Quase tudo aqui mexe em
balanceamento. Se você empilhar duas mudanças e o jogo desregular, ninguém sabe
qual número quebrou — já aconteceu neste projeto (o time inicial inteiro roubado
em 5 semanas). Termine e teste uma fatia antes de começar a próxima.

## Como verificar
- Servidor local: config `mma-manager` (porta 8341) em `.claude/launch.json`.
  Use `preview_start`.
- **Screenshots dão timeout** (WebGL/rAF em background) — verifique via
  `preview_eval` inspecionando o DOM e `window.app`.
- **Definition of done** de cada fatia: critérios de aceite da seção
  correspondente do PRD atendidos, verificados no preview, sem erros no console,
  sem regressão de performance.

## Primeiro passo
1. Leia `docs/PRD.md` (seções 0, 7, 9, 11).
2. Confirme no código o estado da coletiva (`js/app.js` → `renderPressConference`,
   `js/controllers/press-conference.js`) e do `RivalryService`.
3. Implemente a **Fatia F1** (hype da coletiva → bolsa/rivalidade).
4. Teste no preview, faça playtest, e só então siga para F2.
