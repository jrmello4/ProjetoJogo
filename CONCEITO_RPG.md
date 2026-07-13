# O jogo (título provisório: *A Virada*)

> Documento de conceito — a âncora contra o inchaço de escopo.
> Toda vez que bater vontade de adicionar "só mais uma coisa", volte aqui e pergunte:
> **isso serve o gancho de uma frase? Se não, vai pro backlog "algum dia".**

---

## O gancho (uma frase)

> Você treinou e se esforçou como todo mundo — até que uma injustiça mudou tudo.
> O que você fez a partir dali determinou quem você virou: **estrela ou gângster.**

---

## O que este jogo É

Um **RPG narrativo de luta** onde a história é o coração e o combate por turnos é o palco.
As escolhas do jogador, acumuladas ao longo da jornada, decidem **qual tragédia** se torna a
sua e **como você reage a ela**. A alma do jogo é uma pergunta moral: quando a vida te dá a
chance de trair quem você era, você aceita?

## O que este jogo NÃO é

- Não é mundo aberto. É um caminho denso e dirigido, não um mapa infinito.
- Não é um jogo de gerenciamento (isso era o projeto anterior — este tem alma e personagens).
- Não é ramificação literal de roteiro. Usa **medidores invisíveis** (ver abaixo).
- Não é longo por ser longo. Escopo apertado: uma jornada que você termina.

---

## Os quatro eixos da tragédia

As escolhas não abrem quatro histórias paralelas. Elas inclinam o jogador para um de quatro
**eixos temáticos**. O jogo lê a inclinação do jogador e serve a tragédia que combina com quem
ele demonstrou ser:

| Eixo | Gatilho | Combustível emocional |
|---|---|---|
| **O sonho roubado** | A grande chance era sua e te passaram a perna | Raiva, injustiça |
| **A perda** | Alguém que você amava (mentor/pai/irmão) se vai | Luto, legado |
| **A traição** | Quem você mais confiava te vendeu | Ferida pessoal, vilão com rosto |
| **A condenação injusta** | Você paga por um crime que não cometeu | Exílio, sombra desde o início |

Cada eixo ainda se subdivide no desfecho **estrela** (usou a dor como combustível para subir
íntegro) ou **gângster** (se perdeu para o mal). No total: quatro feridas, dois destinos cada.

---

## A mecânica central: medidores invisíveis

**O jogador nunca vê quatro caminhos. Ele vê escolhas de diálogo que importam.**

Por baixo, quatro medidores ocultos acumulam o peso das escolhas:

- **Ambição** — o quanto você quer vencer a qualquer custo
- **Lealdade** — o quanto você se apega às pessoas ao seu redor
- **Integridade** — o quanto você mantém a linha moral
- **Sombra** — o quanto você já cruzou essa linha

Cada escolha de diálogo empurra um ou dois medidores. A história segue um **tronco em grande
parte comum**; em pontos-chave, ela lê os medidores e ativa a cena reativa que combina com quem
o jogador virou. O jogador *sente* que cada escolha importou — porque importou, no acumulado —
mas o time (você) não escreve 64 roteiros. Escreve um tronco forte + cenas-chave que ligam por
medidor. É a mesma técnica de Disco Elysium e Baldur's Gate 3.

> **Nota técnica:** isto é a mesma engenharia da "névoa de guerra" e dos atributos do projeto
> anterior. Medidores que condicionam o que aparece na tela. Você já construiu isto uma vez.

---

## A estrutura da jornada

1. **Ato 1 — comum.** Você treina, sobe, se esforça como todo mundo. Escolhas pequenas já vão
   inclinando os medidores, mas nada é irreversível ainda.
2. **A virada.** A injustiça acontece. Qual delas depende de como você jogou até aqui.
3. **A descida ou a subida.** Cada escolha te endurece ou te mantém íntegro. Os medidores pesam.
4. **O ponto sem volta.** UM momento cinematográfico, caro, caprichado. A linha final. Aqui você
   crava estrela ou gângster — e a decisão parece natural porque veio de tudo que você escolheu.
5. **O final.** Servido pelos medidores. Curto, marcante, com peso.

Onde concentrar o esforço: **o ponto sem volta e os finais.** O tronco comum é barato; o clímax
é onde o orçamento de esforço vai.

---

## O combate

**Por turnos, com leitura do adversário.** O jogador escolhe ações, lê o oponente, gerencia
fôlego. Reaproveita o motor de simulação de luta do projeto anterior (atributos, resultados,
curvas). É a opção mais fácil de fazer *bem* e a que mais aproveita o que já existe.

O combate serve a narrativa — não o contrário. Lutas são capítulos, não grind.

---

## Reaproveitamento do projeto anterior (MMA Manager)

Não se joga fora a engenharia. Reaproveita-se os ossos:

- Save em IndexedDB (com migrações aditivas)
- Arquitetura MVC (views / controllers / services)
- Motor de simulação de luta (gaussianas, atributos, resultados)
- Sistema de progressão de atributos
- Névoa de guerra → vira base dos medidores invisíveis
- Motor de animação (GSAP) e as telas de luta ao vivo

Recomeça-se o **conteúdo, o tema e a narrativa.** A **engenharia** vem de casa.

---

## O maior risco (leia toda vez)

**Escopo.** RPG é o gênero que mais mata dev solo — não por ser difícil de programar, por ser
difícil de *terminar*. A tentação de adicionar mais um eixo, mais uma escolha, mais uma cena é
constante e mortal.

Regras de defesa:
- Se uma ideia nova não serve o gancho de uma frase, vai pro backlog "algum dia".
- Ramificação é sempre medidor, nunca roteiro paralelo.
- Um ponto sem volta caprichado > dez pontos medianos.
- Termine uma fatia jogável mínima (ato 1 + uma virada + um final) ANTES de expandir.

---

## Tecnologia (decidido)

**Stack: JavaScript / HTML puro, rodando no navegador** — a mesma base do projeto anterior.

Por que web puro, e não Godot / um motor "mais profissional":

- **É 100% texto.** Cada tela, sistema e cena é código que a IA escreve, lê e modifica por
  inteiro. Godot mistura código com cenas visuais (`.tscn`) que a IA não vê nem monta — o que
  transformaria o desenvolvedor em "mãos no editor" o tempo todo. Para um projeto tocado
  majoritariamente por IA, web puro é a stack mais produtiva, não a menos.
- **Este jogo é 80% texto e menus.** Diálogos, escolhas, medidores, combate por turnos. O poder
  gráfico de um motor profissional (física, 3D, partículas) seria desperdiçado aqui. Um RPG
  narrativo por turnos roda liso no navegador.
- **Reaproveita a fundação do MMA Manager.** Save em IndexedDB, arquitetura MVC, motor de
  simulação de luta, animações — tudo vem de casa.
- **Não tranca a plataforma.** Web roda no navegador (itch.io, link) E pode ser empacotado como
  app de desktop (Electron/Tauri) E ir pra Steam — o mesmo código. A decisão de plataforma fica
  adiada sem custo.

Regra de evolução: começa em **web puro** (retratos parados, caixas de diálogo, combate por
menus — estilo visual novel / RPG de texto). Se, e somente se, o jogo pedir mais vida visual
(sprites que se mexem, cenas animadas), adiciona-se um framework de jogo (**Phaser** ou
**PixiJS**) — continuando 100% código, IA-friendly — e só na tela que precisar. Não se aposta
em framework antes de o jogo provar que precisa. O maior custo de "jogo visual" não é o
framework, é a **arte** que alguém precisa criar para tudo se mexer.

---

## Próximos passos sugeridos

1. Definir a **fatia vertical mínima**: ato 1 curto + UMA virada (ex: o sonho roubado) + UM
   final. Um jogo pequeno e completo antes de expandir para os quatro eixos.
2. Mapear quais arquivos do projeto anterior viram fundação (auditoria de reaproveitamento).
3. Escrever as primeiras cenas do tronco comum e testar o sistema de medidores num protótipo.
