// js/motion/combat-sprite.js
//
// Legacy module — stick-figure canvas sprites were removed in favor of the
// portrait + technique-plate combat stage. Kept as a thin stub so any old
// import paths do not explode; prefer CombatStage only.

export const SPRITE_W = 0;
export const SPRITE_H = 0;
export const SPRITE_ANIMS = {};

export function colorsFromFighter() {
  return {};
}

export class CombatSprite {
  constructor() {
    /* no-op */
  }
  play() {
    return Promise.resolve();
  }
  setHoldPose() {}
  startIdle() {}
  stopIdle() {}
  dispose() {}
  draw() {}
}

export function mountCombatSprites() {
  return { A: null, B: null };
}
