# Combat Stage — Sprite de Luta (Punch Club style)

**Data:** 2026-07-20
**Status:** Aprovado (brainstorming)
**Próximo passo:** Implementation plan

---

## 1. Problema

O sistema de combate por cartas foi oficializado como motor de luta do jogador (commit `989624b`), mas a animação de cada turno (`js/motion/combat-stage.js`) ficou ruim: o "soco" é só o retrato do lutador (busto estático) escalando/tremendo no lugar — sem direção de impacto, sem peso. Ao mesmo tempo há excesso de efeitos simultâneos competindo por atenção (card de técnica central + popup de clash duplo + glow no frame + hit-ring + burst radial + damage float + screen shake), o que o usuário descreveu como "tem muita coisa".

Pedido original: animação de luta de verdade, estilo Punch Club (boneco pixel-art que soca de fato).

## 2. Achado — assets já existem, não usados

`assets/combat/fighters/{red,blue}/` já contém 9 poses pixel-art por corner, mesma escala/proporção, prontas:

`idle · jab · power · kick · defense · takedown · hit · groundTop · groundGuard`

`assets/combat/arena/gym.png` (1280×720, octógono atmosférico) também existe. **Nenhum arquivo `js/` ou `css/` referencia esses assets** — foram gerados mas nunca integrados. Blue já vem espelhado corretamente (soca para a esquerda, de frente pro red) — não precisa `transform: scaleX(-1)`.

Conclusão: zero arte nova necessária. O trabalho é só a camada de apresentação (JS de coreografia + CSS).

## 3. Arquitetura visual

Sprite full-body vira o elemento principal, substituindo o busto (`.cs-portrait-frame`, 100×120) e o card de técnica central:

- **Fundo:** `gym.png` no lugar do mat/gradiente sintético atual (`.cs-mat`, `.cs-spot`).
- **Fighters:** `<img>` de pose (~140–180px, ancorado na base do mat) no lugar do busto. Reaproveita o posicionamento por fase já existente (`data-phase`, `translateX` por `distance/range/clinch/ground` em `css/combat-stage.css`).
- **Card de técnica central (`.cs-technique`) e popup de clash duplo (`.cs-clash`): removidos.** A pose do boneco já comunica o golpe; mantém-se só uma legenda curta (nome do golpe, mono-caps, fade in/out ~200ms) para desambiguar cartas que caem na mesma pose (ex.: jab vs cross).
- Nome do lutador e tag de canto (`.cs-corner-meta`) permanecem, mas mais discretos — não presos a uma moldura de retrato grande.

## 4. Mapeamento carta → pose

Baseado em `type` e `tags` de `ACTIVE_CARDS` (`js/config/card-config.js`):

| Condição da carta | Pose |
|---|---|
| `type: 'strike'`, tags inclui `power` ou `heavy` | `power.png` |
| `type: 'strike'`, id/nome contém "kick" (`highKick`, `lowKick`) | `kick.png` |
| `type: 'strike'`, demais (jab, cross, overhand leve) | `jab.png` |
| `type: 'takedown'` | `takedown.png` (atacante) |
| `type: 'defense'`, bloqueio bem-sucedido | `defense.png` (defensor) |
| `type: 'submission'` | atacante mantém `groundTop.png`, defensor `groundGuard.png` |
| qualquer lutador que sofre dano | `hit.png`, breve, sobrepõe a pose atual |
| fora de ação / turno resolvido | `idle.png` (ou `groundTop`/`groundGuard` se fase = chão, por `data-role`) |
| `type: 'passive'` | sem beat visual (já é o comportamento atual via `animFamilyForCard`) |

Cartas com `type: 'strike'` e sem tag `power/heavy` e sem "kick" no id caem no default `jab.png` — cobre `jab`, `cross`, `overhand` (design aceita a simplificação; se um card específico ficar estranho, mapear explicitamente é ajuste de uma linha na tabela).

## 5. Coreografia de movimento — impacto em camadas

Resposta direta ao "sem peso": a intensidade do beat varia com o tipo de golpe, não é uniforme como hoje.

- **Leve** (jab/cross, dano baixo): atacante lunge pequeno (~10px) + pose de ataque; defensor `hit.png` + recoil pequeno (~6px). Sem screen shake.
- **Pesado**: carta com tag `power`/`heavy` **ou** dano efetivo do turno `>= 25` (mesmo corte já usado em `_landHit` hoje — `amount >= 25 ? 1.1 : 0.75` — reaproveitar, não inventar novo número). Lunge maior (~14px); defensor `hit.png` + recoil maior (~14px) + `_shake` (reaproveita helper atual) + flash simples de impacto (substitui o `cs-burst` radial gradient por um flash único, mais barato visualmente).
- **Queda (takedown) bem-sucedida:** atacante avança até o centro, ambos trocam para pose de chão (`groundTop`/`groundGuard`), shake médio.
- **Queda bloqueada:** defensor mostra `defense.png`, sem shake, sem transição de fase.
- **Submissão:** sem novo beat de movimento — pulso de tensão sutil (`scale` 1 ↔ 1.02 em loop curto) enquanto resolve, já que os dois estão parados no chão.

## 6. Mantém vs remove

**Mantém** (funcionam bem hoje, não são a causa da reclamação):
- `_floatDmg` (números de dano flutuantes)
- `.stamina-fill.stamina-hit` / `stamina-hit-heavy` (flash na barra de stamina)
- `_shake` (screen shake) — só passa a ser condicional por intensidade, não disparado sempre
- Gate de `reducedMotion` (early-return para pose final sem tween)
- Lógica de fase/posição (`setPositions`, `phaseFromPositions`, `PHASE_LABEL`)

**Remove:**
- `.cs-technique` / `.cs-clash` (card de técnica central + popup de clash duplo)
- `.cs-hit-ring` (anel de glow no frame)
- `.cs-corner--attack` box-shadow glow-pulse no frame
- `.cs-burst` radial gradient (substituído por flash simples, mais barato)

## 7. Acessibilidade

Comportamento de `reducedMotion` já existente em `CombatStage` é preservado: com a flag ativa, `playExchange` pula lunge/shake/hold e vai direto pra pose final por ~200ms (mesmo padrão do early-return atual).

## 8. Escopo técnico

Arquivos afetados:
- `js/motion/combat-stage.js` — reescreve `buildHTML` (marcação: sprite `<img>` no lugar do frame de retrato, remove nós de `.cs-technique`/`.cs-clash`) e os métodos de beat (`_showTechnique`, `_showClash`, `_hideClash`, `_pulseCorner`, `_burst`, `_ringHit` saem; novos métodos de troca de pose + tween de lunge/recoil entram). `setPositions`, `_shake`, `_floatDmg`, `_waitIdle` são reaproveitados como estão.
- `css/combat-stage.css` — troca estilos de `.cs-portrait-frame`/`.cs-technique*`/`.cs-clash*`/`.cs-hit-ring`/`.cs-burst` por classes de sprite-frame; mantém `.cs-phase`, `.cs-float`, `csShake`, blocos responsivo e `prefers-reduced-motion`.

**Não muda** (contrato público estável):
- `js/controllers/combat-adapter.js` — único call-site de `playExchange(opts)` (linha ~229), já passa exatamente `cardA/cardB/posA/posB/prePosA/prePosB/winner/takedownStuffed/moveSide/moveTo/damageA/damageB`. Nenhuma mudança de assinatura necessária.
- `js/config/card-config.js` — só leitura (`type`/`tags`/`id`), nenhum dado novo precisa ser adicionado às cartas.

## 9. Fora de escopo

- Novas poses/artes além das 9 já existentes por corner.
- Animação frame-a-frame (múltiplos quadros por pose) — cada pose é uma imagem única; o movimento vem de tween (translate/scale) sobre a pose trocada, não de spritesheet.
- Mudança em `three-arena.js`/pôster 3D do menu (fora do combate por turnos).
