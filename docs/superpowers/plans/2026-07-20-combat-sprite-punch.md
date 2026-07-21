# Combat Sprite Punch Animation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static portrait+technique-plate combat beat in `js/motion/combat-stage.js` with the already-generated Punch Club-style sprite poses in `assets/combat/`, per the approved design in `docs/superpowers/specs/2026-07-20-combat-sprite-punch-design.md`.

**Architecture:** A new pure module (`js/motion/combat-pose.js`) maps a played card + position to one of 9 pre-rendered pose PNGs per corner and to an impact tier (light/heavy). `CombatStage` (`js/motion/combat-stage.js`) swaps the fighter `<img>` to that pose and plays a lunge/recoil/shake beat scaled by tier, instead of pulsing a static portrait bust. `css/combat-stage.css` gets a gym-photo background and sprite-frame styles in place of the drawn mat and portrait/technique-plate/clash-card styles. The public `CombatStage` API (`buildHTML`, `attach`, `setPositions`, `playExchange`, `_playing`) is unchanged, so `js/controllers/combat-adapter.js` and `js/views/card-combat-view.js` need no edits.

**Tech Stack:** Vanilla ES modules, GSAP (already loaded globally as `window.gsap`), Vitest for pure-logic unit tests (project has no DOM/jsdom test setup — DOM-touching code is verified manually in the browser, matching every other view/motion file in this codebase).

## Global Constraints

- No new npm dependencies (project has zero production dependencies today).
- No new art assets — `assets/combat/fighters/{red,blue}/{idle,jab,power,kick,takedown,defense,hit,groundTop,groundGuard}.png` and `assets/combat/arena/gym.png` already exist and are final.
- Asset paths are root-relative without a leading slash, matching the existing convention in `js/config/card-config.js:11` (`assets/cards/illustrations/${slug}.png`).
- "Heavy" impact threshold reuses the existing cut already used pre-rewrite in `_landHit` (`amount >= 25`) — do not invent a new number.
- `js/controllers/combat-adapter.js` and `js/views/card-combat-view.js` are NOT modified by this plan — if a task turns out to need changes there, stop and re-check against the spec before proceeding.
- All PT-BR user-facing strings (card names, phase labels) already exist in `js/config/card-config.js` / `js/motion/combat-stage.js` — reuse them, don't introduce new copy.

---

## Task 1: Pure card→pose mapping module

**Files:**
- Create: `js/motion/combat-pose.js`
- Test: `test/combat-pose.test.js`

**Interfaces:**
- Consumes: `ACTIVE_CARDS`, `POSITIONS` from `js/config/card-config.js` (read-only, no changes to that file).
- Produces (used by Task 3):
  - `export const POSES` — object with string keys `IDLE, JAB, POWER, KICK, TAKEDOWN, DEFENSE, HIT, GROUND_TOP, GROUND_GUARD`, values are the exact pose filenames without extension (`'idle'`, `'jab'`, `'power'`, `'kick'`, `'takedown'`, `'defense'`, `'hit'`, `'groundTop'`, `'groundGuard'`).
  - `export function poseForCard(card, attackerPosition)` — returns a `POSES` value or `null`. `null` means "don't swap, keep whatever pose the fighter is already showing" (grounded strikes and submissions, which reuse the existing groundTop/groundGuard pose).
  - `export function idlePoseForPosition(position)` — returns `POSES.GROUND_TOP` / `POSES.GROUND_GUARD` / `POSES.IDLE`.
  - `export function isHeavyImpact(card, damage = 0)` — returns boolean.
  - `export function spriteSrc(side, pose)` — `side` is `'A'` or `'B'`, returns e.g. `'assets/combat/fighters/red/jab.png'`, or `null` if `side`/`pose` invalid.

- [ ] **Step 1: Write the failing test**

Create `test/combat-pose.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { ACTIVE_CARDS, POSITIONS } from '../js/config/card-config.js';
import { POSES, poseForCard, idlePoseForPosition, isHeavyImpact, spriteSrc } from '../js/motion/combat-pose.js';

describe('combat-pose: poseForCard', () => {
  it('maps light strikes to the jab pose', () => {
    expect(poseForCard(ACTIVE_CARDS.jab, POSITIONS.RANGE)).toBe(POSES.JAB);
  });

  it('maps power-tagged strikes to the power pose', () => {
    expect(poseForCard(ACTIVE_CARDS.cross, POSITIONS.RANGE)).toBe(POSES.POWER);
    expect(poseForCard(ACTIVE_CARDS.overhand, POSITIONS.DISTANCE)).toBe(POSES.POWER);
    expect(poseForCard(ACTIVE_CARDS.elbowStrike, POSITIONS.CLINCH)).toBe(POSES.POWER);
    expect(poseForCard(ACTIVE_CARDS.clinchKnee, POSITIONS.CLINCH)).toBe(POSES.POWER);
  });

  it('maps kick cards to the kick pose', () => {
    expect(poseForCard(ACTIVE_CARDS.highKick, POSITIONS.RANGE)).toBe(POSES.KICK);
    expect(poseForCard(ACTIVE_CARDS.legKick, POSITIONS.DISTANCE)).toBe(POSES.KICK);
  });

  it('maps takedown cards to the takedown pose', () => {
    expect(poseForCard(ACTIVE_CARDS.doubleLeg, POSITIONS.RANGE)).toBe(POSES.TAKEDOWN);
    expect(poseForCard(ACTIVE_CARDS.singleLeg, POSITIONS.RANGE)).toBe(POSES.TAKEDOWN);
  });

  it('maps the defense card to the defense pose', () => {
    expect(poseForCard(ACTIVE_CARDS.takedownDefense, POSITIONS.RANGE)).toBe(POSES.DEFENSE);
  });

  it('returns null for a grounded strike — no dedicated art, hold the ground pose', () => {
    expect(poseForCard(ACTIVE_CARDS.groundAndPound, POSITIONS.GROUND_TOP)).toBeNull();
  });

  it('returns null for elbowStrike thrown from the ground (it can be played from CLINCH or GROUND_TOP)', () => {
    expect(poseForCard(ACTIVE_CARDS.elbowStrike, POSITIONS.GROUND_TOP)).toBeNull();
  });

  it('returns null for submission cards — attacker/defender already show ground poses', () => {
    expect(poseForCard(ACTIVE_CARDS.rearNaked, POSITIONS.GROUND_TOP)).toBeNull();
    expect(poseForCard(ACTIVE_CARDS.armbar, POSITIONS.GROUND_GUARD)).toBeNull();
  });

  it('returns null for a passive card and for no card', () => {
    expect(poseForCard(null, POSITIONS.RANGE)).toBeNull();
  });
});

describe('combat-pose: idlePoseForPosition', () => {
  it('returns ground poses on the ground, idle everywhere else', () => {
    expect(idlePoseForPosition(POSITIONS.GROUND_TOP)).toBe(POSES.GROUND_TOP);
    expect(idlePoseForPosition(POSITIONS.GROUND_GUARD)).toBe(POSES.GROUND_GUARD);
    expect(idlePoseForPosition(POSITIONS.DISTANCE)).toBe(POSES.IDLE);
    expect(idlePoseForPosition(POSITIONS.CLINCH)).toBe(POSES.IDLE);
  });
});

describe('combat-pose: isHeavyImpact', () => {
  it('is heavy when the card carries a power/heavy tag, regardless of damage', () => {
    expect(isHeavyImpact(ACTIVE_CARDS.cross, 5)).toBe(true);
  });

  it('is heavy when damage crosses the existing 25-point cut, regardless of tags', () => {
    expect(isHeavyImpact(ACTIVE_CARDS.jab, 25)).toBe(true);
    expect(isHeavyImpact(ACTIVE_CARDS.jab, 24)).toBe(false);
  });

  it('is light for a low-tag, low-damage card', () => {
    expect(isHeavyImpact(ACTIVE_CARDS.jab, 10)).toBe(false);
  });
});

describe('combat-pose: spriteSrc', () => {
  it('builds the red-corner path for side A', () => {
    expect(spriteSrc('A', POSES.JAB)).toBe('assets/combat/fighters/red/jab.png');
  });

  it('builds the blue-corner path for side B', () => {
    expect(spriteSrc('B', POSES.TAKEDOWN)).toBe('assets/combat/fighters/blue/takedown.png');
  });

  it('returns null for an invalid side or missing pose', () => {
    expect(spriteSrc('C', POSES.IDLE)).toBeNull();
    expect(spriteSrc('A', null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/combat-pose.test.js`
Expected: FAIL — `Cannot find module '../js/motion/combat-pose.js'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `js/motion/combat-pose.js`:

```js
// js/motion/combat-pose.js
//
// Pure mapping from a played card (+ combat context) to which pre-rendered
// fighter sprite pose to show, and how heavy the resulting impact beat is.
// Kept free of DOM so the mapping table can be unit tested without a
// browser/jsdom (this project has neither — see test/combat-pose.test.js).

import { POSITIONS } from '../config/card-config.js';

export const POSES = {
  IDLE: 'idle',
  JAB: 'jab',
  POWER: 'power',
  KICK: 'kick',
  TAKEDOWN: 'takedown',
  DEFENSE: 'defense',
  HIT: 'hit',
  GROUND_TOP: 'groundTop',
  GROUND_GUARD: 'groundGuard',
};

// Explicit per-card pose — safer than a tag heuristic now, with only 12
// active cards to cover. A future card not listed here falls through to
// the tag/type heuristic at the bottom of poseForCard() instead of
// silently mismapping.
const CARD_POSE = {
  jab: POSES.JAB,
  cross: POSES.POWER,
  overhand: POSES.POWER,
  highKick: POSES.KICK,
  doubleLeg: POSES.TAKEDOWN,
  takedownDefense: POSES.DEFENSE,
  clinchKnee: POSES.POWER,
  legKick: POSES.KICK,
  singleLeg: POSES.TAKEDOWN,
  elbowStrike: POSES.POWER,
  // rearNaked / armbar (submission) and groundAndPound (grounded strike)
  // are intentionally absent — the ground-position rule below holds
  // whatever ground pose the fighter is already showing instead.
};

const GROUND_POSITIONS = new Set([POSITIONS.GROUND_TOP, POSITIONS.GROUND_GUARD]);

/**
 * Which pose the attacker should switch to while a card resolves.
 * Returns null when the attacker should keep their current pose:
 * grounded strikes (elbowStrike/groundAndPound from GROUND_TOP) and all
 * submissions have no dedicated "mid-move" art, since the fighters are
 * already shown in their ground pose from idlePoseForPosition().
 */
export function poseForCard(card, attackerPosition) {
  if (!card) return null;
  if (
    GROUND_POSITIONS.has(attackerPosition) &&
    (card.type === 'strike' || card.type === 'submission')
  ) {
    return null;
  }
  if (card.type === 'submission') return null;
  if (Object.prototype.hasOwnProperty.call(CARD_POSE, card.id)) {
    return CARD_POSE[card.id];
  }
  if (card.type === 'takedown') return POSES.TAKEDOWN;
  if (card.type === 'defense') return POSES.DEFENSE;
  if (card.type === 'strike') {
    const heavy = card.tags?.includes('power') || card.tags?.includes('heavy');
    return heavy ? POSES.POWER : POSES.JAB;
  }
  return null;
}

/** Pose to hold outside of an active beat, purely from ring position. */
export function idlePoseForPosition(position) {
  if (position === POSITIONS.GROUND_TOP) return POSES.GROUND_TOP;
  if (position === POSITIONS.GROUND_GUARD) return POSES.GROUND_GUARD;
  return POSES.IDLE;
}

// Same cut already used pre-rewrite in CombatStage._landHit
// (`amount >= 25 ? 1.1 : 0.75` for shake intensity) — reused, not reinvented.
const HEAVY_DAMAGE_THRESHOLD = 25;

/** True when a beat should get the bigger lunge/recoil/shake treatment. */
export function isHeavyImpact(card, damage = 0) {
  if (card?.tags?.includes('power') || card?.tags?.includes('heavy')) return true;
  return damage >= HEAVY_DAMAGE_THRESHOLD;
}

const CORNER_FOLDER = { A: 'red', B: 'blue' };

/** Path to a pose PNG for a given corner side. Root-relative, no leading slash. */
export function spriteSrc(side, pose) {
  const folder = CORNER_FOLDER[side];
  if (!folder || !pose) return null;
  return `assets/combat/fighters/${folder}/${pose}.png`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/combat-pose.test.js`
Expected: PASS — all cases green.

- [ ] **Step 5: Run the full suite to confirm no regression**

Run: `npm test`
Expected: PASS — 19 test files (18 existing + this one), all green.

- [ ] **Step 6: Commit**

```bash
git add js/motion/combat-pose.js test/combat-pose.test.js
git commit -m "feat: pure card-to-sprite-pose mapping for combat stage"
```

---

## Task 2: Sprite-based combat-stage CSS

**Files:**
- Modify: `css/combat-stage.css` (full rewrite of the file — see complete replacement content below)

**Interfaces:**
- Consumes: nothing (CSS only).
- Produces (used by Task 3's markup in `combat-stage.js`): the exact class/attribute names below. Task 3's `buildHTML`/beat methods must use these names verbatim.
  - `.cs-sprite-frame`, `.cs-sprite-img` (fighter pose image; state read from ancestor `.cs-corner--{attack,hit,block,shoot,advance}`)
  - `.cs-caption[data-side]`, `.cs-caption-in`, `.cs-caption-out` (move-name legend, replaces `.cs-technique`/`.cs-clash`)
  - `.cs-impact-flash`, `.cs-impact-flash--on` (heavy-hit flash, replaces `.cs-burst`)
  - Everything else (`.combat-stage`, `.cs-busy`, `.cs-shake`, `.cs-phase*`, `.cs-ring`, `.cs-corner*` positioning/phase transforms, `.cs-corner-stripe`, `.cs-corner-meta/-tag/-name`, `.cs-role-badge`, `.cs-floats`/`.cs-float*`, stamina-hit classes, `.combat-header-shake`, `.turn-result`, responsive/reduced-motion blocks) keeps its exact name from the current file — Task 3 does not need to change any reference to those.

- [ ] **Step 1: Replace the file**

Replace the full contents of `css/combat-stage.css` with:

```css
/* ==========================================================================
   Combat stage — RED CORNER / BLUE CORNER poster
   --------------------------------------------------------------------------
   Full-body pixel-art fighter sprites over a gym backdrop. Poses swap per
   card played (see js/motion/combat-pose.js) — no stick-figure canvas, no
   card-plate popups; the pose itself reads as the technique.
   ========================================================================== */

.combat-stage {
  --cs-red: var(--red, #c8202f);
  --cs-blue: var(--blue, #2f6bbf);
  --cs-chalk: var(--chalk, #f3efe9);
  --cs-ash: var(--ash, #8e857c);
  position: relative;
  min-height: 280px;
  border-radius: 2px;
  overflow: hidden;
  border: 1px solid var(--border-light, rgba(243, 239, 233, 0.18));
  border-top: 3px solid var(--cs-red);
  background-color: #14110f;
  background-image:
    linear-gradient(180deg, rgba(10, 8, 7, 0.25) 0%, rgba(10, 8, 7, 0.45) 55%, rgba(10, 8, 7, 0.8) 100%),
    url('../assets/combat/arena/gym.png');
  background-size: cover;
  background-position: center 35%;
  background-repeat: no-repeat;
  margin: 0 0 0.5rem;
  user-select: none;
}

.combat-stage.cs-busy {
  pointer-events: none;
}

.combat-stage.cs-shake {
  animation: csShake 0.38s ease-out;
}

@keyframes csShake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(2px); }
}

/* ---- Atmosphere ---- */
.cs-atmosphere {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.cs-vs-mark {
  position: absolute;
  left: 50%;
  top: 46%;
  transform: translate(-50%, -50%);
  font-family: var(--font-display, 'Archivo', sans-serif);
  font-weight: 900;
  font-size: clamp(2.5rem, 8vw, 4rem);
  letter-spacing: 0.08em;
  color: rgba(243, 239, 233, 0.05);
  z-index: 0;
  pointer-events: none;
  user-select: none;
}

.combat-stage[data-phase="ground"] .cs-vs-mark {
  opacity: 0.35;
}

/* ---- Impact flash (heavy hits / takedowns only) ---- */
.cs-impact-flash {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 55%, rgba(255, 210, 120, 0.4) 0%, rgba(200, 32, 47, 0.15) 45%, transparent 70%);
  opacity: 0;
}
.cs-impact-flash--on {
  animation: csImpactFlash 0.3s ease-out;
}
@keyframes csImpactFlash {
  0% { opacity: 0; }
  25% { opacity: 1; }
  100% { opacity: 0; }
}

/* ---- Phase chip ---- */
.cs-phase {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.28rem 0.75rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--cs-chalk);
  background: rgba(20, 17, 15, 0.82);
  border: 1px solid var(--border-light, rgba(243, 239, 233, 0.14));
  border-radius: 2px;
  backdrop-filter: blur(8px);
  white-space: nowrap;
}

.cs-phase-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--cs-red);
  box-shadow: 0 0 8px rgba(200, 32, 47, 0.6);
  animation: csLiveDot 1.4s ease-in-out infinite;
}

.combat-stage[data-phase="clinch"] .cs-phase-dot,
.combat-stage[data-phase="ground"] .cs-phase-dot {
  background: var(--belt, #c9a227);
  box-shadow: 0 0 8px rgba(201, 162, 39, 0.5);
}

@keyframes csLiveDot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

/* ---- Ring layout ---- */
.cs-ring {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr minmax(120px, 1.1fr) 1fr;
  align-items: end;
  gap: 0.5rem;
  min-height: 280px;
  padding: 2.4rem 0.85rem 1rem;
}

/* ---- Corners ---- */
.cs-corner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  position: relative;
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.cs-corner--red { justify-self: start; }
.cs-corner--blue { justify-self: end; }

/* Phase spacing — how close the fighters feel */
.combat-stage[data-phase="distance"] .cs-corner--red { transform: translateX(-6%); }
.combat-stage[data-phase="distance"] .cs-corner--blue { transform: translateX(6%); }
.combat-stage[data-phase="range"] .cs-corner--red { transform: translateX(4%); }
.combat-stage[data-phase="range"] .cs-corner--blue { transform: translateX(-4%); }
.combat-stage[data-phase="clinch"] .cs-corner--red { transform: translateX(12%); }
.combat-stage[data-phase="clinch"] .cs-corner--blue { transform: translateX(-12%); }
.combat-stage[data-phase="ground"] .cs-corner--red { transform: translate(8%, 8%); }
.combat-stage[data-phase="ground"] .cs-corner--blue { transform: translate(-8%, 14%); }

.cs-corner[data-role="top"] {
  z-index: 3;
  transform: translateY(-12px) !important;
}
.cs-corner[data-role="guard"] {
  z-index: 2;
  transform: translateY(16px) scale(0.94) !important;
  opacity: 0.95;
}

.cs-corner-stripe {
  position: absolute;
  top: 0;
  width: 3px;
  height: 100%;
  border-radius: 1px;
  opacity: 0.9;
}
.cs-corner--red .cs-corner-stripe {
  left: 0;
  background: linear-gradient(180deg, var(--cs-red), transparent);
}
.cs-corner--blue .cs-corner-stripe {
  right: 0;
  left: auto;
  background: linear-gradient(180deg, var(--cs-blue), transparent);
}

/* ---- Fighter sprite ---- */
.cs-sprite-frame {
  position: relative;
  height: 170px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.cs-sprite-img {
  display: block;
  height: 100%;
  width: auto;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  filter: drop-shadow(0 10px 10px rgba(0, 0, 0, 0.5));
  transition: filter 0.15s ease;
}

.cs-corner--attack .cs-sprite-img {
  filter: drop-shadow(0 10px 10px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 14px rgba(243, 239, 233, 0.4));
}
.cs-corner--red.cs-corner--attack .cs-sprite-img {
  filter: drop-shadow(0 10px 10px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 16px rgba(200, 32, 47, 0.6));
}
.cs-corner--blue.cs-corner--attack .cs-sprite-img {
  filter: drop-shadow(0 10px 10px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 16px rgba(47, 107, 191, 0.6));
}
.cs-corner--hit .cs-sprite-img {
  filter: drop-shadow(0 10px 10px rgba(0, 0, 0, 0.5)) brightness(1.4) saturate(0.7);
}
.cs-corner--block .cs-sprite-img {
  filter: drop-shadow(0 10px 10px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 14px rgba(120, 180, 255, 0.5));
}
.cs-corner--shoot .cs-sprite-img {
  filter: drop-shadow(0 10px 10px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 14px rgba(243, 239, 233, 0.4));
}

.cs-corner--advance .cs-sprite-img {
  animation: csAdvance 0.4s ease-out;
}
@keyframes csAdvance {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(8px); }
}
.cs-corner--blue.cs-corner--advance .cs-sprite-img {
  animation-name: csAdvanceBlue;
}
@keyframes csAdvanceBlue {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-8px); }
}

.cs-corner-meta {
  text-align: center;
  max-width: 140px;
}

.cs-corner-tag {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--cs-ash);
  margin-bottom: 0.15rem;
}

.cs-corner--red .cs-corner-tag { color: var(--red-ink, #ef5f6b); }
.cs-corner--blue .cs-corner-tag { color: var(--blue-bright, #4a8ae0); }

.cs-corner-name {
  font-family: var(--font-display, 'Archivo', sans-serif);
  font-weight: 800;
  font-size: 0.82rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--cs-chalk);
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cs-role-badge {
  display: inline-block;
  margin-top: 0.3rem;
  padding: 0.12rem 0.45rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  border-radius: 1px;
  border: 1px solid rgba(201, 162, 39, 0.45);
  color: var(--belt, #c9a227);
  background: rgba(201, 162, 39, 0.1);
}

/* ---- Center: move caption ---- */
.cs-center {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  align-self: center;
  z-index: 4;
}

.cs-caption {
  padding: 0.3rem 0.7rem;
  background: rgba(20, 17, 15, 0.82);
  border: 1px solid var(--border-light, rgba(243, 239, 233, 0.14));
  border-radius: 2px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--cs-chalk);
  opacity: 0;
  transform: translateY(6px);
  white-space: nowrap;
}
.cs-caption[data-side="A"] { border-left: 3px solid var(--cs-red); }
.cs-caption[data-side="B"] { border-left: 3px solid var(--cs-blue); }

.cs-caption.cs-caption-in {
  animation: csCaptionIn 0.2s ease-out forwards;
}
.cs-caption.cs-caption-out {
  animation: csCaptionOut 0.16s ease-in forwards;
}
@keyframes csCaptionIn {
  to { opacity: 1; transform: translateY(0); }
}
@keyframes csCaptionOut {
  to { opacity: 0; transform: translateY(-4px); }
}

/* ---- Damage floats ---- */
.cs-floats {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
  overflow: hidden;
}

.cs-float {
  position: absolute;
  top: 32%;
  font-family: var(--font-display, 'Archivo', sans-serif);
  font-weight: 900;
  font-size: 1.25rem;
  letter-spacing: 0.04em;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.55), 0 0 16px rgba(0, 0, 0, 0.35);
  animation: csFloat 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  white-space: nowrap;
}

.cs-float--a { left: 14%; color: #ff8a8a; }
.cs-float--b { right: 14%; left: auto; color: #8ab8ff; }
.cs-float--block { color: #a8d0ff; font-size: 0.95rem; letter-spacing: 0.1em; }
.cs-float--down { color: #e8c547; font-size: 0.95rem; letter-spacing: 0.1em; }
.cs-float--sub { color: #e8c547; }

@keyframes csFloat {
  0% { opacity: 0; transform: translateY(10px) scale(0.85); }
  18% { opacity: 1; transform: translateY(0) scale(1.08); }
  100% { opacity: 0; transform: translateY(-40px) scale(1); }
}

/* ---- Stamina hit feedback (used by adapter) ---- */
.stamina-fill.stamina-hit {
  animation: staminaHitFlash 0.45s ease-out;
  box-shadow: 0 0 10px rgba(255, 80, 60, 0.55);
}
.stamina-fill.stamina-hit-heavy {
  animation: staminaHitHeavy 0.5s ease-out;
  box-shadow: 0 0 14px rgba(255, 50, 40, 0.75);
}
@keyframes staminaHitFlash {
  0% { filter: brightness(1.8); }
  40% { filter: brightness(1.25); }
  100% { filter: brightness(1); }
}
@keyframes staminaHitHeavy {
  0% { filter: brightness(2); transform: scaleY(1.25); }
  100% { filter: brightness(1); transform: scaleY(1); }
}
.combat-header-shake {
  animation: csShake 0.32s ease-out;
}

.combat-container .turn-result:not(.hidden) {
  background: rgba(200, 32, 47, 0.1);
  border: 1px solid rgba(200, 32, 47, 0.28);
  border-radius: 2px;
  color: var(--chalk, #f3efe9);
  font-size: 0.85rem;
  padding: 0.55rem 0.75rem;
}

/* Light theme — keep stage dark (fight always under lights) */
[data-theme="light"] .combat-stage {
  border-color: rgba(0, 0, 0, 0.2);
  color: #f3efe9;
}
[data-theme="light"] .cs-corner-name,
[data-theme="light"] .cs-phase,
[data-theme="light"] .cs-caption {
  color: #f3efe9;
}

/* ---- Responsive ---- */
@media (max-width: 640px) {
  .cs-ring {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    min-height: 300px;
    padding-top: 2.6rem;
  }
  .cs-center {
    grid-column: 1 / -1;
    grid-row: 1;
    min-height: 100px;
    order: -1;
  }
  .cs-corner--red { grid-column: 1; grid-row: 2; }
  .cs-corner--blue { grid-column: 2; grid-row: 2; }
  .cs-sprite-frame {
    height: 130px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cs-phase-dot,
  .combat-stage.cs-shake,
  .cs-impact-flash--on,
  .cs-float,
  .cs-caption.cs-caption-in,
  .stamina-fill.stamina-hit,
  .stamina-fill.stamina-hit-heavy {
    animation-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Verify no syntax errors / lint issues**

Run: `npm run lint`
Expected: PASS — `css/combat-stage.css` is not covered by ESLint (JS-only linter), so this run just confirms the CSS edit didn't accidentally touch any linted JS file. Output should be unchanged from before this task (1 pre-existing `no-undef` error in `js/app.js` — unrelated, out of scope for this plan).

- [ ] **Step 3: Commit**

```bash
git add css/combat-stage.css
git commit -m "feat: sprite-frame combat-stage styles over gym background"
```

---

## Task 3: Rewrite CombatStage choreography

**Files:**
- Modify: `js/motion/combat-stage.js` (full rewrite — see complete replacement content below)

**Interfaces:**
- Consumes: `POSES, poseForCard, idlePoseForPosition, isHeavyImpact, spriteSrc` from `js/motion/combat-pose.js` (Task 1). CSS classes from `css/combat-stage.css` (Task 2): `.cs-sprite-img`, `.cs-caption`/`.cs-caption-in`/`.cs-caption-out`, `.cs-impact-flash`/`.cs-impact-flash--on`, `.cs-corner--attack/--hit/--block/--shoot/--advance`.
- Produces (unchanged public surface — consumed by `js/views/card-combat-view.js`, not modified by this plan):
  - `class CombatStage { constructor(root?) }`
  - `static CombatStage.buildHTML(fighterA, fighterB) → string`
  - `attach(root, fighterA?, fighterB?) → void`
  - `setPositions(posA, posB) → void`
  - `async playExchange(opts) → Promise<void>` — same `opts` shape as before: `{cardA, cardB, posA, posB, prePosA, prePosB, winner, takedownStuffed, moveSide, damageA, damageB}`.
  - `_playing` (boolean property, read externally by `card-combat-view.js:74`).
  - Removed (confirmed unused anywhere else in the codebase — see plan research): `animFamilyForCard`, `disposeSprites()`, `showDamageFloat()`.

- [ ] **Step 1: Replace the file**

Replace the full contents of `js/motion/combat-stage.js` with:

```js
// js/motion/combat-stage.js
//
// Cinematic card-combat stage — red corner / blue corner sprite fighters
// over a gym backdrop. Poses come from assets/combat/fighters/{red,blue}/;
// js/motion/combat-pose.js owns the card -> pose mapping.

import { POSITIONS } from '../config/card-config.js';
import { escapeHtml } from '../utils/helpers.js';
import { POSES, poseForCard, idlePoseForPosition, isHeavyImpact, spriteSrc } from './combat-pose.js';

const gsap = typeof window !== 'undefined' ? window.gsap : null;

const PHASE_LABEL = {
  distance: 'Distância',
  range: 'Alcance',
  clinch: 'Clinch',
  ground: 'Chão',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function phaseFromPositions(posA, posB) {
  const g = (p) => p === POSITIONS.GROUND_TOP || p === POSITIONS.GROUND_GUARD;
  if (g(posA) || g(posB)) return 'ground';
  if (posA === POSITIONS.CLINCH || posB === POSITIONS.CLINCH) return 'clinch';
  if (posA === POSITIONS.RANGE || posB === POSITIONS.RANGE) return 'range';
  return 'distance';
}

export class CombatStage {
  constructor(root = null) {
    this.root = root;
    this._fighters = { A: null, B: null };
    this._pose = { A: POSES.IDLE, B: POSES.IDLE };
    this.reducedMotion =
      (typeof window !== 'undefined' &&
        (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
          localStorage.getItem('reduceMotion') === 'true')) ||
      false;
    this._playing = false;
  }

  attach(root, fighterA = null, fighterB = null) {
    this.root = root;
    // Reset the pose cache — a corner-offer between rounds rebuilds this
    // container's DOM from scratch (see combat-adapter.js's corner-offer
    // flow), so attach() can point at a fresh <img> that's back at idle
    // even though this instance's cache still remembers e.g. groundTop.
    // Without this, _setPose()'s cache check would no-op and leave the
    // new element showing the wrong sprite.
    this._pose = { A: POSES.IDLE, B: POSES.IDLE };
    if (fighterA) this._fighters.A = fighterA;
    if (fighterB) this._fighters.B = fighterB;
  }

  static buildHTML(fighterA, fighterB) {
    const nameA = escapeHtml(fighterA?.name || 'Você');
    const nameB = escapeHtml(fighterB?.name || 'Oponente');

    return `
      <div class="combat-stage" data-combat-stage data-phase="distance"
           data-pos-a="${POSITIONS.DISTANCE}" data-pos-b="${POSITIONS.DISTANCE}">

        <div class="cs-atmosphere" aria-hidden="true">
          <div class="cs-vs-mark">VS</div>
        </div>

        <div class="cs-impact-flash" data-cs-impact-flash aria-hidden="true"></div>

        <div class="cs-phase" data-cs-phase>
          <span class="cs-phase-dot"></span>
          <span data-cs-phase-text>Distância</span>
        </div>

        <div class="cs-ring">
          <div class="cs-corner cs-corner--red" data-cs-side="A" data-role="">
            <div class="cs-corner-stripe"></div>
            <div class="cs-sprite-frame">
              <img data-cs-sprite-a class="cs-sprite-img" src="${spriteSrc('A', POSES.IDLE)}" alt="" draggable="false" />
            </div>
            <div class="cs-corner-meta">
              <div class="cs-corner-tag">Canto vermelho</div>
              <div class="cs-corner-name">${nameA}</div>
              <div class="cs-role-badge" data-cs-role-a hidden></div>
            </div>
          </div>

          <div class="cs-center" data-cs-center>
            <div class="cs-caption" data-cs-caption hidden>
              <span data-cs-caption-text></span>
            </div>
          </div>

          <div class="cs-corner cs-corner--blue" data-cs-side="B" data-role="">
            <div class="cs-corner-stripe"></div>
            <div class="cs-sprite-frame">
              <img data-cs-sprite-b class="cs-sprite-img" src="${spriteSrc('B', POSES.IDLE)}" alt="" draggable="false" />
            </div>
            <div class="cs-corner-meta">
              <div class="cs-corner-tag">Canto azul</div>
              <div class="cs-corner-name">${nameB}</div>
              <div class="cs-role-badge" data-cs-role-b hidden></div>
            </div>
          </div>
        </div>

        <div class="cs-floats" data-cs-floats aria-hidden="true"></div>
      </div>
    `;
  }

  _el(sel) {
    return this.root?.querySelector(sel) || null;
  }

  setPositions(posA, posB) {
    if (!this.root) return;
    posA = posA || POSITIONS.DISTANCE;
    posB = posB || POSITIONS.DISTANCE;
    this.root.dataset.posA = posA;
    this.root.dataset.posB = posB;

    const phase = phaseFromPositions(posA, posB);
    this.root.dataset.phase = phase;

    const label = this._el('[data-cs-phase-text]');
    if (label) {
      if (phase === 'ground') {
        if (posA === POSITIONS.GROUND_TOP) label.textContent = 'Chão · Você no topo';
        else if (posB === POSITIONS.GROUND_TOP) label.textContent = 'Chão · Oponente no topo';
        else label.textContent = 'Chão';
      } else {
        label.textContent = PHASE_LABEL[phase] || 'Octógono';
      }
    }

    this._setRole('A', posA);
    this._setRole('B', posB);

    if (!this._playing) {
      this._setPose('A', idlePoseForPosition(posA));
      this._setPose('B', idlePoseForPosition(posB));
    }
  }

  _setRole(side, position) {
    const corner = this._el(`[data-cs-side="${side}"]`);
    const badge = this._el(`[data-cs-role-${side.toLowerCase()}]`);
    if (!corner) return;

    let role = '';
    let text = '';
    if (position === POSITIONS.GROUND_TOP) {
      role = 'top';
      text = 'TOPO';
    } else if (position === POSITIONS.GROUND_GUARD) {
      role = 'guard';
      text = 'GUARDA';
    } else if (position === POSITIONS.CLINCH) {
      role = 'clinch';
      text = 'CLINCH';
    }

    corner.dataset.role = role;
    if (badge) {
      if (text) {
        badge.hidden = false;
        badge.textContent = text;
      } else {
        badge.hidden = true;
        badge.textContent = '';
      }
    }
  }

  _setPose(side, pose) {
    if (!pose || this._pose[side] === pose) return;
    const img = this._el(`[data-cs-sprite-${side.toLowerCase()}]`);
    const src = spriteSrc(side, pose);
    if (!img || !src) return;
    img.src = src;
    this._pose[side] = pose;
  }

  async playExchange(opts = {}) {
    if (!this.root) return;
    if (this._playing) await this._waitIdle();
    this._playing = true;
    this.root.classList.add('cs-busy');

    try {
      const {
        cardA = null,
        cardB = null,
        posA,
        posB,
        prePosA,
        prePosB,
        winner = null,
        takedownStuffed = false,
        moveSide = null,
        damageA = 0,
        damageB = 0,
      } = opts;

      if (prePosA || prePosB) {
        this.setPositions(prePosA || posA, prePosB || posB);
      }

      if (this.reducedMotion) {
        this.setPositions(posA, posB);
        await sleep(200);
        return;
      }

      if (!cardA && !cardB) {
        if (moveSide) await this._pulseCorner(moveSide, 'advance');
        this.setPositions(posA, posB);
        await sleep(180);
        return;
      }

      const aTd = cardA?.type === 'takedown';
      const bTd = cardB?.type === 'takedown';
      const aDef = cardA?.type === 'defense';
      const bDef = cardB?.type === 'defense';
      const stuffed = takedownStuffed || (aTd && bDef) || (bTd && aDef);

      if (cardA && cardB) {
        if (stuffed) {
          const atk = aTd ? 'A' : 'B';
          await this._resolveBlock(atk, atk === 'A' ? 'B' : 'A', atk === 'A' ? cardA : cardB);
        } else if (aTd || bTd) {
          const atk = aTd ? 'A' : 'B';
          await this._resolveTakedown(atk, atk === 'A' ? cardA : cardB);
        } else {
          await this._resolveStrikeExchange(cardA, cardB, winner, damageA, damageB, posA, posB);
        }
      } else {
        const card = cardA || cardB;
        const side = cardA ? 'A' : 'B';
        const pos = cardA ? posA : posB;
        const target = side === 'A' ? 'B' : 'A';
        const dmg = side === 'A' ? (damageB || damageA || 0) : (damageA || damageB || 0);

        const pose = poseForCard(card, pos);
        if (pose) this._setPose(side, pose);

        if (card.type === 'takedown' && !stuffed) {
          await this._resolveTakedown(side, card);
        } else if (card.type === 'takedown' && stuffed) {
          await this._resolveBlock(side, target, card);
        } else if (card.type === 'defense') {
          await this._showCaption(side, card);
          this._setPose(side, POSES.DEFENSE);
          await this._pulseCorner(side, 'block');
        } else if (card.type === 'submission') {
          await this._resolveSubmission(side, target, card, dmg);
        } else {
          await this._landHit(side, target, dmg || 12, card, pos);
        }
      }

      await this._hideCaption();
      this.setPositions(posA, posB);
      await sleep(120);
    } finally {
      this._playing = false;
      this.root?.classList.remove('cs-busy');
    }
  }

  // ── Visual beats ──────────────────────────────────────────

  async _showCaption(side, card) {
    const root = this._el('[data-cs-caption]');
    const text = this._el('[data-cs-caption-text]');
    if (!root || !card) return;
    if (text) text.textContent = card.name || '';
    root.dataset.side = side;
    root.hidden = false;
    root.classList.remove('cs-caption-in', 'cs-caption-out');
    void root.offsetWidth;
    root.classList.add('cs-caption-in');
  }

  async _hideCaption() {
    const root = this._el('[data-cs-caption]');
    if (!root || root.hidden) return;
    root.classList.remove('cs-caption-in');
    root.classList.add('cs-caption-out');
    await sleep(160);
    root.hidden = true;
    root.classList.remove('cs-caption-out');
  }

  async _resolveStrikeExchange(cardA, cardB, winner, damageA, damageB, posA, posB) {
    if (winner === 'A') {
      await this._landHit('A', 'B', damageB || damageA || 14, cardA, posA);
    } else if (winner === 'B') {
      await this._landHit('B', 'A', damageA || damageB || 14, cardB, posB);
    } else {
      this._setPose('A', POSES.HIT);
      this._setPose('B', POSES.HIT);
      this._shake(0.6);
      if (damageB > 0) this._floatDmg('B', damageB, 'hit');
      if (damageA > 0) this._floatDmg('A', damageA, 'hit');
      await Promise.all([this._pulseCorner('A', 'hit'), this._pulseCorner('B', 'hit')]);
      await sleep(160);
    }
  }

  async _resolveTakedown(attacker, card) {
    await this._showCaption(attacker, card);
    await this._pulseCorner(attacker, 'shoot');
    const def = attacker === 'A' ? 'B' : 'A';
    this._setPose(attacker, POSES.TAKEDOWN);
    this._setPose(def, POSES.HIT);
    this._shake(1.15);
    this._impactFlash();
    await this._pulseCorner(def, 'hit');
    this._floatDmg(def, 0, 'down');
    await sleep(200);
  }

  async _resolveBlock(attacker, defender, card) {
    // Spec: blocked takedown gets no screen shake (unlike a landed one) —
    // only a successful/heavy beat shakes the camera.
    await this._showCaption(attacker, card);
    if (card.type === 'takedown') this._setPose(attacker, POSES.TAKEDOWN);
    await this._pulseCorner(attacker, 'attack');
    this._setPose(defender, POSES.DEFENSE);
    await this._pulseCorner(defender, 'block');
    this._floatDmg(attacker, 0, 'block');
    await sleep(200);
  }

  async _resolveSubmission(attacker, defender, card, amount) {
    await this._showCaption(attacker, card);
    await this._tension();
    if (amount > 0) this._floatDmg(defender, amount, 'sub');
    await sleep(200);
  }

  async _landHit(attacker, target, amount, card, attackerPosition) {
    await this._showCaption(attacker, card);
    const heavy = isHeavyImpact(card, amount);
    const pose = poseForCard(card, attackerPosition);
    if (pose) this._setPose(attacker, pose);
    await this._pulseCorner(attacker, 'attack', heavy);
    this._setPose(target, POSES.HIT);
    await this._pulseCorner(target, 'hit', heavy);
    this._shake(heavy ? 1.1 : 0.65);
    if (heavy) this._impactFlash();
    if (amount > 0) this._floatDmg(target, amount, 'hit');
    await sleep(200);
  }

  async _pulseCorner(side, mode = 'attack', heavy = false) {
    const corner = this._el(`[data-cs-side="${side}"]`);
    const img = this._el(`[data-cs-sprite-${side.toLowerCase()}]`);
    if (!corner) return;

    const cls =
      mode === 'hit'
        ? 'cs-corner--hit'
        : mode === 'block'
          ? 'cs-corner--block'
          : mode === 'shoot'
            ? 'cs-corner--shoot'
            : mode === 'advance'
              ? 'cs-corner--advance'
              : 'cs-corner--attack';

    corner.classList.remove(
      'cs-corner--attack',
      'cs-corner--hit',
      'cs-corner--block',
      'cs-corner--shoot',
      'cs-corner--advance'
    );
    void corner.offsetWidth;
    corner.classList.add(cls);

    if (gsap && img && !this.reducedMotion && (mode === 'attack' || mode === 'shoot' || mode === 'hit')) {
      const toward = side === 'A' ? 1 : -1;
      const magnitude = heavy ? 1.6 : 1;
      if (mode === 'hit') {
        const away = -toward;
        gsap.fromTo(
          img,
          { x: 0 },
          {
            duration: 0.32,
            keyframes: [
              { x: away * 8 * magnitude, duration: 0.08 },
              { x: away * 3 * magnitude, duration: 0.1 },
              { x: 0, duration: 0.14 },
            ],
            ease: 'power2.out',
          }
        );
      } else {
        gsap.fromTo(
          img,
          { x: 0 },
          {
            duration: 0.3,
            keyframes: [
              { x: toward * 10 * magnitude, duration: 0.1 },
              { x: 0, duration: 0.2 },
            ],
            ease: 'power2.out',
          }
        );
      }
    }

    await sleep(mode === 'shoot' ? 360 : mode === 'hit' ? 300 : 260);
    corner.classList.remove(cls);
  }

  _impactFlash() {
    const el = this._el('[data-cs-impact-flash]');
    if (!el || this.reducedMotion) return;
    el.classList.remove('cs-impact-flash--on');
    void el.offsetWidth;
    el.classList.add('cs-impact-flash--on');
    setTimeout(() => el.classList.remove('cs-impact-flash--on'), 320);
  }

  async _tension() {
    if (gsap && !this.reducedMotion) {
      ['A', 'B'].forEach((side) => {
        const img = this._el(`[data-cs-sprite-${side.toLowerCase()}]`);
        if (!img) return;
        gsap.fromTo(
          img,
          { scale: 1 },
          {
            duration: 0.5,
            keyframes: [
              { scale: 1.015, duration: 0.25 },
              { scale: 1, duration: 0.25 },
            ],
            ease: 'sine.inOut',
            repeat: 1,
          }
        );
      });
    }
    await sleep(this.reducedMotion ? 0 : 550);
  }

  _shake(intensity = 1) {
    if (!this.root || this.reducedMotion) return;
    if (gsap) {
      gsap.fromTo(
        this.root,
        { x: 0 },
        {
          duration: 0.38,
          keyframes: [
            { x: -5 * intensity, duration: 0.05 },
            { x: 6 * intensity, duration: 0.05 },
            { x: -3 * intensity, duration: 0.06 },
            { x: 2 * intensity, duration: 0.06 },
            { x: 0, duration: 0.1 },
          ],
          ease: 'power2.out',
        }
      );
    } else {
      this.root.classList.remove('cs-shake');
      void this.root.offsetWidth;
      this.root.classList.add('cs-shake');
      setTimeout(() => this.root?.classList.remove('cs-shake'), 380);
    }
  }

  _floatDmg(side, amount, kind = 'hit') {
    const host = this._el('[data-cs-floats]');
    if (!host) return;
    const node = document.createElement('div');
    node.className = `cs-float cs-float--${side.toLowerCase()} cs-float--${kind}`;
    if (kind === 'block') node.textContent = 'DEFENDEU';
    else if (kind === 'down') node.textContent = 'QUEDA';
    else if (kind === 'sub') node.textContent = amount > 0 ? `SUB −${Math.round(amount)}` : 'SUB';
    else node.textContent = amount > 0 ? `−${Math.round(amount)}` : 'HIT';
    host.appendChild(node);
    setTimeout(() => node.remove(), 900);
  }

  async _waitIdle() {
    let n = 0;
    while (this._playing && n < 50) {
      await sleep(40);
      n++;
    }
  }
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: same pre-existing baseline as Task 2's Step 2 (1 `no-undef` error in `js/app.js`, unrelated to this task; 2 pre-existing `no-unused-vars` warnings in `ai-combat.js`/`combat-resolver.js`, also unrelated). No new errors/warnings from `combat-stage.js` or `combat-pose.js`.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all 19 test files green, same as Task 1 Step 5 (this task touches no file any existing test imports).

- [ ] **Step 4: Commit**

```bash
git add js/motion/combat-stage.js
git commit -m "feat: sprite pose-swap choreography for combat-stage turns"
```

---

## Task 4: Manual verification in the browser

No automated DOM test infra exists in this project (no jsdom/happy-dom dependency, no existing test touches `CombatStage`) — this task is the real verification gate for Tasks 2–3, matching how every other view/motion file in the codebase is checked.

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server and open the game**

Run: `node server.js 8341`
Open `http://localhost:8341` in a browser.

- [ ] **Step 2: Reach a card-combat fight**

Create a new career (or continue an existing save if the browser's IndexedDB already has one). Advance weeks / accept a fight offer until you reach fight night — the combat screen renders via `CardCombatView.render()`, which calls `CombatStage.buildHTML()`.

- [ ] **Step 3: Confirm the idle state**

Check: both corners show a full-body pixel-art fighter standing on the gym background (not a portrait bust, not the old drawn mat/spotlights). Red corner faces right, blue corner faces left, both toward center.

- [ ] **Step 4: Play through turns, exercising each pose family**

Play cards across a few turns until each of these has been observed at least once (mix jab/cross/overhand for light+heavy strikes, highKick/legKick for kick, doubleLeg/singleLeg for takedown, takedownDefense for block, and try to reach ground position for rearNaked/armbar/groundAndPound):
- Light strike (jab): small lunge, no screen shake, no impact flash.
- Heavy strike (cross/overhand/highKick or any hit ≥25 dmg): bigger lunge/recoil, screen shake, impact flash.
- Takedown landed: attacker takedown pose, both transition to ground poses, medium shake.
- Takedown stuffed: defender shows defense pose, no shake.
- Submission (from ground): no pose swap, subtle scale-pulse tension beat, "SUB" float text.
- Move caption: confirm the move name appears briefly near center and fades out per beat, doesn't stack or overlap across turns.

- [ ] **Step 5: Check for console/network errors**

Open browser devtools. Confirm no 404s for `assets/combat/fighters/*` or `assets/combat/arena/gym.png`, and no JS errors during any of the turns played in Step 4.

- [ ] **Step 6: Reduced motion**

In Settings, enable "reduzir movimento" (or set `localStorage.reduceMotion = 'true'` and reload). Play another turn — confirm it snaps directly to the resulting position/pose without the lunge/shake/flash beats, matching pre-rewrite behavior.

- [ ] **Step 7: Take a screenshot for the record**

Screenshot the combat stage mid-fight (ideally during a heavy-hit beat) for the commit record / PR description.

- [ ] **Step 8: Final regression pass**

Run: `npm run lint && npm test`
Expected: same baseline as Task 3 (no new errors/warnings, all tests green).

No commit for this task — it's verification only. If Step 4 or 5 surfaces a bug, fix it in the relevant Task 2/3 file and re-run that task's own lint/test steps before re-verifying here.
