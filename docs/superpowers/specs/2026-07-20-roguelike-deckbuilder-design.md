# Roguelike Deckbuilder — Design de Combate

**Data:** 2026-07-20
**Status:** Aprovado (brainstorming)
**Próximo passo:** Implementation plan

---

## 1. Visão Geral

Transformar o MMA Manager de simulação passiva em um **roguelike deckbuilder RPG** onde o combate é jogado ativamente com cartas. A "run" é a carreira inteira de um lutador, com fim precoce possível (lesões, derrotas, idade) e meta-progressão entre runs.

---

## 2. Estrutura Geral e Meta-Progressão

### A Run = Uma Carreira

- Jogador cria um lutador e sobe do regional → nacional → elite
- Objetivo final: tornar-se campeão mundial (ou o mais longe possível)
- Run termina com aposentadoria (por idade, lesões acumuladas, ou sequência de derrotas)
- **Híbrido:** existe objetivo final (ser campeão), mas você pode "morrer" antes

### Meta-Progressão (entre runs)

| Sistema | Descrição |
|---------|-----------|
| **Pool de cartas global** | Cartas encontradas em uma run entram no pool permanente; podem aparecer em futuras runs como recompensa de treino/luta |
| **Perks** | Bônus passivos permanentes comprados com **Legacy Points** (moeda conquistada por feitos entre runs): desconto em treino, carta inicial extra, etc. |

**Legacy Points:** Ganhos ao atingir marcos numa run — vencer título, nocautear X oponentes, defender cinturão, vencer rival. Quanto maior o feito, mais pontos. Usados na tela entre runs para desbloquear perks. **(Em aberto para refinamento futuro)**

### Progressão Dentro da Run

| Sistema | Descrição |
|---------|-----------|
| **Slots de ativas** | Começa com 3; +1 ao subir de divisão |
| **Slots de passivas** | Começa com 2; +1 ao subir de divisão |
| **Campeão tem mais slots** | Representa a vantagem de experiência do campeão |

### Ciclo Semanal da Run

1. **Ofertas** — promoções oferecem lutas (aceitar, recusar, negociar)
2. **Treino (Training Camp)** — foco em aprender cartas ou melhorar atributos. Academias melhores = cartas melhores no pool de oferta
3. **Pré-luta** — equipa loadout (ativas + passivas) baseado no plano de jogo
4. **Luta** — combate por turnos com cartas
5. **Pós-luta** — recompensas, evolução, lesões, avanço no ranking
6. **Repete** — até aposentadoria

### Recompensas Dentro da Run

- **Vitória:** escolhe 1 entre 2-3 cartas (melhores em promoções maiores)
- **Título:** carta única/poderosa garantida
- **Momentos especiais:** rivalidades, revanches, zebras geram cartas temáticas
- **Promoção:** +1 slot de ativa ou passiva
- **Treino:** cartas base + algumas passivas, dependendo do foco e da academia

---

## 3. Combate — Turnos, Posições e Ações

### Estrutura do Round

- Luta de **3 ou 5 rounds** (depende do tier da promoção)
- Cada round tem **3-5 turnos**
- Entre rounds: **instrução do córner** (habilidade do coach)

### Por Turno

- **2 ações por turno** (jogador age, oponente age, alterna)
- Ações possíveis: jogar carta ativa | mover manualmente | passar
- Cartas ativas visíveis o tempo todo; em cooldown ficam acinzentadas

### 5 Posições de Combate

```
Distância ↔ Alcance ↔ Clinch ↔ Chão (Topo/Guarda)
```

| Posição | Descrição |
|---------|-----------|
| Distância | Longe, trocação de baixo volume |
| Alcance | Em pé, trocação franca |
| Clinch | Agarrado, joelhadas e quedas curtas |
| Chão (Topo) | Por cima, ground-and-pound, vantagem |
| Chão (Guarda) | Por baixo, defesa e tentativas de submissão |

### Movimento Entre Posições

- **Automático:** cartas de engajamento incluem movimento (ex: *Double-leg* move Distância → Chão). Nem toda carta tem movimento embutido.
- **Manual:** gastar 1 ação para reposicionar sem atacar (Distância ↔ Alcance | Alcance ↔ Clinch | Clinch ↔ Chão)

### Córner (entre rounds)

- Coach da academia atual oferece **1 habilidade especial**
- Jogador aceita ou recusa
- Sinergia técnico-atleta existente vira multiplicador na habilidade: sinergia alta = habilidade mais forte, sinergia baixa = coach pode dar conselho pior

**Exemplos de habilidades de coach:**

| Coach | Habilidade |
|-------|-----------|
| Motivacional | Recupera 1 uso de carta especial aleatória |
| Estrategista | Revela posição do oponente no próximo round |
| Finalizador | +20% chance de finalização no round |
| Gelotécnico | -1 cooldown em todas as cartas |
| Cortador | Remove penalidade/hematoma acumulado |

---

## 4. Cartas

### Cartas Ativas (jogadas durante o turno)

- **Pool inicial** definido pelo Plano de Jogo (ex: Striker → cartas de striking, Grappler → grappling)
- **Básicas (ilimitadas):** cooldown apenas. Disponíveis sempre, sem consumo.
- **Especiais (uso limitado):** X usos por luta + cooldown. Economizar para o momento certo é parte da estratégia.

**Exemplos de cartas ativas:**

| Carta | Tipo | Posição Requerida | Cooldown | Usos/Luta | Efeito |
|-------|------|-------------------|----------|-----------|--------|
| Jab | Strike | Alcance | 1 turno | ∞ | Dano leve, baixo custo |
| Cruz | Strike | Alcance | 2 turnos | ∞ | Dano médio |
| Overhand | Strike | Distância→Alcance* | 3 turnos | 3 | Dano alto, fecha distância |
| Chute Alto | Strike | Distância | 3 turnos | 3 | Dano alto, risco se errar |
| Double-leg | Takedown | Alcance→Chão* | 3 turnos | 2 | Leva ao chão, fecha distância |
| Defesa de Queda | Defesa | Qualquer em pé | 1 turno | ∞ | Bônus vs tentativa de queda |
| Mata-leão | Submissão | Chão (Topo) | 4 turnos | 2 | Tenta finalização |
| Joelhada no Clinch | Strike | Clinch | 2 turnos | ∞ | Dano médio, segura no clinch |

*\* Carta de engajamento — move automaticamente*

**Dano escala com OVR:** Uma carta usa atributos do lutador como base. Ex: *Cruz* usa `boxing * 0.6 + power * 0.4`. Carta rara + atributo baixo ainda é fraca.

### Cartas Passivas (equipadas antes da luta)

- Modificadores que afetam o tempo todo ou disparam em condições
- Origem: **treino** (foco específico), recompensas de luta, momentos especiais

**Exemplos de cartas passivas:**

| Passiva | Efeito |
|---------|--------|
| Mão Pesada | +15% dano em golpes de poder (cruz, overhand) |
| Base Sólida | +20% defesa de queda quando em Alcance |
| Sangue Frio | -1 cooldown nas cartas especiais quando perdendo no scorecard |
| Jogo Sujo | +25% chance de penalidade no oponente (dedada, cabeçada) |
| Estudioso | No primeiro turno, revela carta que o oponente vai jogar |
| Maratona | -10% fadiga por round |

---

## 5. Integração com Sistemas Existentes

### Plano de Jogo (Game Plan)

- **Não vira deck** — vira **bônus de tipo + cartas iniciais**
- Striker: cartas de striking são mais efetivas + pool inicial é de striking
- Grappler: cartas de grappling mais efetivas + pool inicial é de grappling
- Pressure: cartas agressivas com bônus, mas custo de fôlego maior
- Patient: bônus em contra-ataques, cooldown reduzido em cartas defensivas

### Perks (Sistema Existente)

- Viram **upgrades permanentes entre runs** (meta-progressão)
- Comprados com moeda de conquista acumulada entre carreiras
- Ex: +5 em atributo inicial, carta rara inicial, desconto em academia

### Arma Nova / Isca

- **Removido** — não faz mais sentido no novo sistema

### Córner (Sistema Existente)

- Vira **habilidade do coach** vinculada à academia
- A sinergia técnico-atleta existente vira multiplicador

### OVR do Lutador

- **Ancora o poder das cartas** — carta não substitui atributo baixo
- Garante que progressão de atributos continua importante

---

## 6. Oponente (IA)

A IA também tem seu próprio loadout de cartas e joga com as mesmas regras:
- Plano de jogo definido pelo perfil do oponente (estilo, perks, tape)
- Cartas escalam com os atributos do oponente
- O sistema "O Livro Sobre Você" (Tape Service) existe ainda: a IA estuda seu histórico e pode counterar seu plano se você for previsível

---

## 7. Fim da Run

**Nota:** O mecanismo exato de fim de run está em aberto para refinamento. A direção atual é híbrida — existe um objetivo final (ser campeão mundial) mas a run pode terminar precocemente.

Condições provisórias de fim de carreira:
- **Idade de aposentadoria** alcançada (declínio inevitável)
- **Lesão grave** que zera atributos críticos
- **Sequência de derrotas** que força aposentadoria
- **Objetivo alcançado** (run vencida — ser campeão mundial)

Na morte da run:
- Registra conquistas realizadas (cartas descobertas, nocautes, defesas de título)
- Conquistas viram **Legacy Points** para meta-progressão (perks)
- Cartas descobertas entram no pool global
