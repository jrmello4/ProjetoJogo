# Fatia vertical mínima — *A Virada*

> **O que é uma fatia vertical:** o menor pedaço do jogo que é *completo de ponta a ponta*.
> Não é uma demo capenga nem um monte de sistemas soltos. É um jogo pequeno, jogável do início
> ao fim, com começo, meio e fim de verdade — só que curto. Se a fatia emociona, o jogo inteiro
> vai emocionar. Se a fatia não segura, descobrimos isso em semanas, não em dois anos.

> **A regra de ouro deste projeto:** construa a fatia inteira ANTES de expandir qualquer coisa.
> Nada de quatro eixos, nada de mundo grande, nada de "só mais um sistema". Um caminho, do
> começo ao fim, funcionando. Depois expande.

---

## A fatia em uma frase

Um lutador dedicado tem a grande chance roubada por uma injustiça — e, ao longo de umas poucas
cenas e lutas, as escolhas do jogador o levam a **subir como estrela** ou **cair como gângster**,
terminando num de dois finais curtos e marcantes.

Ou seja: pegamos **UM** dos quatro eixos (o sonho roubado, o mais fácil de escrever e o mais
universal) e o levamos até o fim, com a bifurcação estrela/gângster funcionando de verdade.

---

## O que ENTRA na fatia

| Elemento | Escopo mínimo |
|---|---|
| **Ato 1 — a subida** | 2 a 3 cenas curtas: quem você é, seu sonho, uma primeira luta que você vence |
| **A virada** | 1 cena forte: a injustiça (o sonho roubado). O momento que o jogador nunca esquece |
| **O meio — a escolha** | 3 a 4 cenas de diálogo com escolhas que movem os medidores |
| **O ponto sem volta** | 1 cena climática: a decisão final que crava estrela ou gângster |
| **Os finais** | 2 finais curtos (1 tela cada), servidos pelos medidores |
| **Combate por turnos** | 2 a 3 lutas ao todo, sistema simples: ações, leitura do adversário, fôlego |
| **Sistema de medidores** | Os 4 medidores (Ambição, Lealdade, Integridade, Sombra) rodando por baixo |
| **1 personagem de apoio** | Um só (ex: o mentor OU o rival). Não uma cidade de NPCs |

## O que NÃO entra na fatia (backlog "algum dia")

- Os outros três eixos (perda, traição, condenação) — só depois que a fatia funcionar
- Mundo explorável / vários ambientes — a fatia é linear
- Vários personagens de apoio — um só na fatia
- Sistema de economia, academia, patrocínios (isso era o MMA Manager, não este jogo)
- Sprites animados / combate visual — retratos parados + texto na fatia
- Áudio elaborado — no máximo uns efeitos simples

---

## Como o combate funciona na fatia (o mínimo que emociona)

Combate por turnos, **a serviço da narrativa**. Cada luta é um capítulo, não grind.

- O jogador vê o próprio lutador e o adversário (retratos + barras de vida/fôlego).
- A cada turno, escolhe uma **ação**: atacar (agressivo), defender (recupera fôlego),
  ler o adversário (revela a próxima intenção dele), golpe especial (custa fôlego).
- O adversário tem uma **intenção** que o jogador pode antecipar se "ler" — recompensa
  jogar com atenção, não no piloto automático.
- O resultado usa o **motor de simulação do MMA Manager** (atributos + curvas gaussianas)
  por baixo, mas apresentado turno a turno em vez de simulado de uma vez.
- Vitória/derrota alimenta a narrativa (e às vezes os medidores).

> Reaproveitamento direto: `js/utils/gaussian.js`, a lógica de `simulation.js` e de
> `fighter.js` viram a base do cálculo de cada golpe. A camada nova é só a apresentação
> por turnos + as escolhas de ação.

---

## Como o sistema de medidores funciona na fatia

Quatro números invisíveis, começando em zero: **Ambição, Lealdade, Integridade, Sombra.**

- Cada escolha de diálogo empurra um ou dois medidores (ex: "pega o dinheiro sujo" → +Ambição,
  +Sombra, −Integridade).
- O jogador **nunca vê os números.** Ele vê escolhas com peso.
- No **ponto sem volta**, o jogo lê os medidores e oferece a cena final coerente com quem o
  jogador virou. Se Sombra/Ambição dominam, o caminho gângster parece natural. Se
  Integridade/Lealdade dominam, o caminho estrela parece merecido.
- O **final** é escolhido pela combinação dos medidores no fim.

> Reaproveitamento: é a mesma ideia da "névoa de guerra" e dos atributos do MMA Manager —
> valores guardados no estado que condicionam o que aparece na tela. A engenharia já existe.

---

## Estrutura técnica da fatia (web)

Mantém a arquitetura que já funciona no projeto anterior, enxugada para o RPG:

```
/js
  /core        → estado do jogo, save (IndexedDB), medidores
  /scenes      → cada cena narrativa (dados: texto, escolhas, efeitos nos medidores)
  /combat      → motor de luta por turnos (reaproveita gaussian + fighter)
  /views       → render das telas: diálogo, combate, final
  app.js       → o loop: qual cena mostrar, ler escolha, aplicar efeito, avançar
```

Ideia central: as **cenas são dados, não código.** Cada cena é um objeto com texto, retrato,
escolhas, e o que cada escolha faz nos medidores e para onde leva. Isso deixa a escrita da
história separada da engenharia — dá pra adicionar cenas sem mexer no motor. É o que torna a
expansão pros quatro eixos barata depois.

---

## Como o jogo cresce DEPOIS da fatia (o roteiro)

Só avance para a próxima etapa quando a anterior estiver **jogável e testada**.

**Etapa 1 — A fatia (o foco agora).**
Um eixo (sonho roubado), do início ao fim, com bifurcação e dois finais. Objetivo: provar que a
experiência emociona e que os sistemas funcionam. Se aqui não segura, mudamos o conceito — e é
ótimo descobrir isso barato.

**Etapa 2 — Aprofundar o eixo.**
Mais cenas no mesmo eixo, mais uma ou duas lutas, um segundo personagem de apoio. O caminho fica
mais rico sem ainda multiplicar. Testar com pessoas reais (3–5).

**Etapa 3 — O segundo eixo.**
Adicionar a perda OU a traição. Como as cenas são dados, é repetir o molde — escrever conteúdo
novo sobre a mesma engenharia. Aqui a rejogabilidade real começa a aparecer.

**Etapa 4 — Os quatro eixos completos.**
Os quatro gatilhos, todos servidos pelos medidores conforme o jogador joga. Este é o jogo cheio
descrito no CONCEITO_RPG.md. Só se chega aqui tendo terminado as etapas anteriores.

**Etapa 5 — Polir e lançar.**
Balanceamento, arte coesa, áudio, empacotamento (web + talvez desktop/Steam), e divulgação em
comunidades. O lançamento é uma etapa de trabalho, não um evento mágico no fim.

---

## O único critério de sucesso da fatia

**Uma pessoa que não seja você joga do início ao fim e sente alguma coisa no final** —
orgulho pela subida ou desconforto pela queda. Se isso acontecer, o jogo é real e vale
construir o resto. Esse é o teste. Todo o resto é detalhe.

---

## Primeiro passo concreto (quando você quiser começar a construir)

1. Auditar o MMA Manager e listar exatamente quais arquivos viram fundação (motor de luta,
   save, estado). — *isto pode ser o próximo pedido à IA.*
2. Escrever as 2–3 primeiras cenas do ato 1 como dados (texto + escolhas).
3. Montar o loop mínimo: mostrar cena → ler escolha → aplicar nos medidores → avançar.
4. Ligar UMA luta por turnos ao motor reaproveitado.
5. Jogar do começo ao fim uma vez, sozinho. Ajustar. Então mostrar pra alguém.
