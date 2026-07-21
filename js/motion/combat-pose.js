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
