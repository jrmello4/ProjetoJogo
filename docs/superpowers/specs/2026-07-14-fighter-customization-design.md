# Sistema de Customização do Lutador

**Data:** 2026-07-14
**Foco:** Game Depth — Camada B (Customização do Lutador)
**Pré-requisito:** Nenhum — aditivo ao sistema existente
**Próximo na fila:** Camada A (Sistema Social Expandido) → Camada C (Economia)

---

## Visão Geral

Três camadas que se alimentam:

```
Estilo (identidade)
  ├── define pool de golpes disponíveis
  └── define requisitos de perks
Moveset (arsenal)
  ├── loadout que você leva pra cada luta
  ├── proficiência sobe com uso em treino + luta
  └── golpes mais proficientes gastam menos stamina e dão mais dano
Perks (talento)
  ├── teia com requisitos de atributos/estilo/nível
  ├── pontos ganhos por level (+ conquistas de carreira)
  └── modificam a simulação (bônus condicionais, novos behaviours)
```

---

## Seção 1 — Estilos (Fighting Styles)

### Definição

5 estilos cadastrados em `game-config.js`, seguindo o padrão de `GAME_PLANS`:

| Estilo | Atributos bônus | Evolução | Vantagem vs | Desvantagem vs | Perk de estilo |
|---|---|---|---|---|---|
| Boxer | boxing, headMovement, footwork | striking 1.3x | Muay Thai | Wrestler | Mão Rápida |
| Muay Thai | muayThai, clinch, kickboxing | striking 1.2x, grappling 1.1x | Wrestler | Boxer | Oito Armas |
| Wrestler | wrestling, takedowns, tdDefense, strength | grappling 1.4x | Boxer | Muay Thai, BJJ | Ground and Pound |
| BJJ | bjj, subOffense, subDefense, groundControl | grappling 1.5x | Wrestler | Boxer | Berimbolo |
| Freestyle | fightIQ, adaptability | mental 1.3x | — | — | Versatilidade |

### Mecânica

- **Bônus passivo:** atributos do estilo ganham +8 no `expandAttributes` inicial e +15% no `evolve()`
- **Matchup:** substitui o `_styleMatchup()` hardcoded da simulação. Vantagem = +3 na performance do round, desvantagem = -2
- **Troca de estilo:** custa 4 semanas sem bônus de estilo + $500. `Fighter.styleLockedUntilAbsWeek`
- **Perk de estilo:** gratuito ao escolher o estilo, único, não ocupa slot de perk

### Dados

```js
// game-config.js
export const FIGHTING_STYLES = {
  boxer: {
    id: 'boxer', label: 'Boxer',
    desc: 'Soco afiado, footwork preciso.',
    bonusAttrs: ['boxing', 'headMovement', 'footwork'],
    bonusAmount: 8,           // bônus inicial no expandAttributes
    evolutionRate: { striking: 1.3, grappling: 0.8, physical: 1.0, mental: 1.0 },
    matchup: { advantage: ['muayThai'], disadvantage: ['wrestler'] },
    stylePerkId: 'fastHands',
    poolMoves: ['jab', 'cross', 'hook', 'uppercut', 'overhand', 'bodyShot'],
  },
  muayThai: { ... },
  wrestler: { ... },
  bjj: { ... },
  freestyle: { ... },
};
```

### Arquivos alterados
- `js/config/game-config.js` — nova seção `FIGHTING_STYLES`
- `js/models/fighter.js` — campo `style`, `styleLockedUntilAbsWeek`, `styleChangedAtAbsWeek`
- `js/controllers/simulation.js` — substituir `_styleMatchup()` pela leitura de `FIGHTING_STYLES`
- `js/views/fighter-profile.js` — exibir estilo atual, botão de troca
- `js/views/dashboard.js` — exibir estilo no card do lutador

---

## Seção 2 — Moveset

### Definição

Cada estilo tem um **pool de golpes**. O jogador monta seu arsenal com `MAX_MOVES = 8` slots. Cada golpe tem **proficiência** (0-100) que sobe com uso.

### Golpes

```js
// game-config.js
export const MOVES = {
  jab:         { name: 'Jab',     type: 'strike', baseAttr: 'boxing',    staminaCost: 3,  damage: 1.0, tags: ['quick', 'range'] },
  cross:       { name: 'Cross',   type: 'strike', baseAttr: 'boxing',    staminaCost: 5,  damage: 1.4, tags: ['power', 'range'] },
  hook:        { name: 'Hook',    type: 'strike', baseAttr: 'power',     staminaCost: 6,  damage: 1.6, tags: ['power', 'close'] },
  uppercut:    { name: 'Uppercut',type: 'strike', baseAttr: 'power',     staminaCost: 6,  damage: 1.5, tags: ['power', 'close'] },
  overhand:    { name: 'Overhand',type: 'strike', baseAttr: 'power',     staminaCost: 7,  damage: 1.8, tags: ['power', 'risky'] },
  bodyShot:    { name: 'Body Shot',type: 'strike', baseAttr: 'cardio',   staminaCost: 4,  damage: 1.0, tags: ['body', 'setup'] },
  legKick:     { name: 'Leg Kick', type: 'strike', baseAttr: 'kickboxing', staminaCost: 4, damage: 0.8, tags: ['range', 'body'] },
  lowKick:     { name: 'Low Kick', type: 'strike', baseAttr: 'kickboxing', staminaCost: 5, damage: 1.0, tags: ['range', 'cripple'] },
  headKick:    { name: 'Head Kick',type: 'strike', baseAttr: 'kickboxing', staminaCost: 8, damage: 2.0, tags: ['power', 'risky'] },
  elbow:       { name: 'Cotovelada',type: 'strike', baseAttr: 'muayThai', staminaCost: 6, damage: 1.7, tags: ['power', 'close', 'cut'] },
  knee:        { name: 'Joelhada',type: 'strike', baseAttr: 'muayThai', staminaCost: 5, damage: 1.5, tags: ['power', 'clinch'] },
  clinchKnee:  { name: 'Clinch Knee',type: 'clinch', baseAttr: 'muayThai', staminaCost: 4, damage: 1.3, tags: ['clinch', 'body'] },
  takedown:    { name: 'Queda',   type: 'takedown', baseAttr: 'takedowns', staminaCost: 6, damage: 0,  tags: ['grappling'] },
  singleLeg:   { name: 'Single Leg',type: 'takedown', baseAttr: 'takedowns', staminaCost: 7, damage: 0, tags: ['grappling', 'speed'] },
  doubleLeg:   { name: 'Double Leg',type: 'takedown', baseAttr: 'takedowns', staminaCost: 8, damage: 0, tags: ['grappling', 'power'] },
  slam:        { name: 'Slam',    type: 'takedown', baseAttr: 'strength', staminaCost: 9, damage: 1.2, tags: ['grappling', 'power'] },
  armbar:      { name: 'Armbar',  type: 'submission', baseAttr: 'submissionOffense', staminaCost: 7, damage: 0, tags: ['submission'] },
  guillotine:  { name: 'Guilhotina',type: 'submission', baseAttr: 'submissionOffense', staminaCost: 7, damage: 0, tags: ['submission'] },
  rearNaked:   { name: 'Mata-Leão',type: 'submission', baseAttr: 'submissionOffense', staminaCost: 6, damage: 0, tags: ['submission'] },
  triangle:    { name: 'Triângulo',type: 'submission', baseAttr: 'submissionOffense', staminaCost: 8, damage: 0, tags: ['submission', 'guard'] },
  groundAndPound: { name: 'Ground and Pound', type: 'strike', baseAttr: 'power', staminaCost: 5, damage: 1.3, tags: ['ground'] },
};
```

### Pool por estilo

| Estilo | Golpes disponíveis |
|---|---|
| Boxer | jab, cross, hook, uppercut, overhand, bodyShot, takedown (defesa) |
| Muay Thai | jab, cross, legKick, lowKick, headKick, elbow, knee, clinchKnee, takedown |
| Wrestler | takedown, singleLeg, doubleLeg, slam, groundAndPound, jab, cross |
| BJJ | armbar, guillotine, rearNaked, triangle, takedown, groundAndPound |
| Freestyle | todos (pool universal, sem bônus de estilo) |

### Proficiência

- **Ganha em:** treino semanal (+1 a +3 conforme intensidade do camp), cada uso em luta (+2)
- **Perde em:** desuso prolongado (-1/semana após 12 semanas sem usar o golpe)
- **Efeito na simulação:** proficiência vira multiplicador no dano e redutor de stamina:
  ```
  effectiveDamage = baseDamage * (1 + proficiency / 200)    // 1.0x em 0, 1.5x em 100
  effectiveStamina = baseCost * (1 - proficiency / 300)      // 1.0x em 0, 0.67x em 100
  ```
- **Teto por estilo:** Boxer pode ter 100 de jab, mas BJJ max 60 de jab (não é seu forte)

### Loadout

Antes de cada luta, o jogador monta seu moveset (8 slots) a partir do pool do seu estilo. A loadout fica salva no `Fighter` (persistida, não precisa remontar toda luta).

### Integração com a simulação

O `_calcRoundPerformance` atual é genérico: calcula striking/grappling score como números abstratos. Com moveset:

1. Cada round, a simulação decide quais golpes o fighter usa (baseado em range, stamina, contexto do round)
2. O dano efetivo de cada golpe considera proficiência
3. O `strikingScore` do round vira uma média ponderada dos golpes usados naquele round, não mais um número abstrato

### Arquivos novos
- `js/services/style-service.js` — orquestra: resolveFighter() → FightProfile

### Arquivos alterados
- `js/config/game-config.js` — nova seção `MOVES`, cada estilo ganha `poolMoves[]`
- `js/models/fighter.js` — campos `style`, `moveset[]` (array de moveIds), `moveProficiency{}`
- `js/controllers/simulation.js` — `_calcRoundPerformance` consulta moveset + proficiência
- `js/controllers/training-camp.js` — aplicar ganho de proficiência no camp semanal
- `js/views/fighter-profile.js` — aba de moveset com drag-to-reorder
- `js/views/live-fight-hub.js` — exibir golpes usados no round

---

## Seção 3 — Perks

### Definição

Teia de perks com **pré-requisitos** (atributo >= N, estilo X, nível mínimo). Cada perk modifica o jogo:

### Categorias de perks

| Categoria | Exemplos | Efeito |
|---|---|---|
| **Striking** | Pé Pesado, Combinação Relâmpago, Cruzado de Respeito | +dano em condições |
| **Grappling** | Finalizador Nato, Gelo no Chão, Pressão Sufocante | +sub/control |
| **Físico** | Corpo de Ferro, Tanque de Guerra, Fôlego Infinito | +resistência |
| **Mental** | Frio Calculista, Instinto Assassino, Coração de Leão | +composure/iq |
| **Estilo** | (exclusivos de cada estilo) | modificam mecânicas do estilo |

### Ganho de pontos

- **Level:** +1 ponto a cada 3 níveis (nível sobe a cada 5 fights OU 15 semanas de treino)
- **Conquistas:** +1 ponto em marcos (1º title shot, 1º cinturão, 5 vitórias consecutivas, etc)
- **Total estimado na carreira:** ~15-20 pontos (não dá pra pegar tudo — escolhas importam)

### Teia (não árvore)

```
               [Pé Pesado]──[Nocauteador]
              /              /
[Jab de Raios]──[Mão Rápida]──[Combinação Relâmpago]
              \
               [Cruzado de Respeito]

Pré-requisitos:
  Jab de Raios:     boxing >= 50
  Mão Rápida:       boxing >= 60, speed >= 50
  Pé Pesado:        power >= 60
  Cruzado de Respeito: boxing >= 65, power >= 55, estilo Boxer
  Combinação Relâmpago: Mão Rápida + Pé Pesado, boxing >= 70
  Nocauteador:      Pé Pesado + Cruzado de Respeito, power >= 70
```

### Dados

```js
// game-config.js — PERKS
export const PERKS = {
  fastHands: {
    id: 'fastHands', name: 'Mão Rápida',
    category: 'striking',
    description: 'Combinações de 2+ golpes gastam 15% menos stamina',
    requirements: { attrs: { speed: 50 }, style: null, level: 1, perks: [] },
    effect: { type: 'stamina_combo', value: 0.85 },
  },
  heavyHands: {
    id: 'heavyHands', name: 'Pé Pesado',
    category: 'striking',
    description: 'Power golpes +10%',
    requirements: { attrs: { power: 60 }, style: null, level: 2, perks: [] },
    effect: { type: 'power_mult', value: 1.10 },
  },
  // ... etc (~20-25 perks iniciais)
};
```

### Efeitos na simulação

Cada perk tem um `effect` que o `FightProfile` resolve em modificadores:

```js
// FightProfile — o que a simulação realmente consome
{
  styleMods: { strikingRate: 1.3, grapplingRate: 0.8 },
  matchupBonus: 3, matchupPenalty: -2,
  movePool: ['jab', 'cross', ...],
  moveProficiency: { jab: 70, cross: 50 },
  activePerks: ['fastHands', 'heavyHands'],
  computedMods: {
    staminaComboReduction: 0.85,
    powerMultiplier: 1.10,
  },
}
```

### Arquivos alterados
- `js/config/game-config.js` — nova seção `PERKS`
- `js/models/fighter.js` — campos `level`, `xp`, `perkPoints`, `perks[]`
- `js/services/style-service.js` — `resolveFighter()` monta o FightProfile
- `js/controllers/simulation.js` — consumir `computedMods` do FightProfile
- `js/controllers/game-controller.js` — ganho de XP no processWeek
- `js/views/fighter-profile.js` — teia de perks visual
- `js/views/live-fight-hub.js` — exibir golpes usados e efeitos de perk

---

## Integração com a Simulação

### Fluxo atual (simplificado)

```
Fighter → _calcRoundPerformance(fighter) → score + noise → resultado
```

### Fluxo novo

```
Fighter → style-service.resolveFighter(fighter) → FightProfile
         → simulateFight(profileA, profileB)
         → _calcRoundPerformance usa profile.computedMods + profile.moveProficiency
         → _styleMatchup usa FIGHTING_STYLES em vez de comparar strings
         → _genRoundStats decide golpes do round baseado no moveset
```

O `resolveFighter()` é chamado UMA vez no início da simulação da luta, não por round. O resultado é um perfil imutável — evita inconsistências se o fighter for alterado durante a luta.

### Integração com sistemas existentes

| Sistema | Impacto |
|---|---|
| Névoa de guerra | O scouting esconde atributos → se o perk tem req attr, não exibe perk que não pode ser visto |
| O Livro Sobre Você | O estilo vira parte da fita pública — dá pra ler que você é Boxer |
| Sala de treino | Companheiros com mesmo estilo aceleram proficiência |
| Córner | Perks de mental/composure influenciam sinergia |
| Acampamento | Intensidade do camp afeta ganho de proficiência |

---

## Arquivos: resumo completo

### Novos
| Arquivo | Função |
|---|---|
| `js/services/style-service.js` | Resolve Fighter → FightProfile. Orquestra estilos, moveset e perks |

### Alterados
| Arquivo | O que muda |
|---|---|
| `js/config/game-config.js` | +FIGHTING_STYLES, +MOVES, +PERKS, +STYLE_SWITCH_CONFIG |
| `js/models/fighter.js` | +style, styleLockedUntilAbsWeek, moveset[], moveProficiency{}, level, xp, perkPoints, perks[] |
| `js/controllers/simulation.js` | _styleMatchup vira config-driven; _calcRoundPerformance lê FightProfile |
| `js/controllers/game-controller.js` | +gainWeeklyXP no processWeek; +aplicar proficiência de camp |
| `js/controllers/training-camp.js` | +ganho de proficiência por intensidade |
| `js/services/tape-service.js` | estilo vira parte da fita |
| `js/services/data-generator.js` | IA fighters ganham estilo + moveset aleatório |
| `js/views/fighter-profile.js` | Aba de estilo + moveset + teia de perks |
| `js/views/live-fight-hub.js` | Exibir golpes do round |
| `js/views/dashboard.js` | Exibir nível e estilo |
| `js/views/training-camp.js` | Opção de foco em proficiência de golpe |

---

## Não-escopo (para esta fase)

- **Animação visual do estilo na arena 3D** (Three.js) — postergado
- **Efeitos sonoros por tipo de golpe** — postergado
- **Loadout salvo por oponente** (automaticamente escolhe o moveset certo pra cada luta) — postergado
- **Customização visual do lutador** (avatar, skin) — postergado
