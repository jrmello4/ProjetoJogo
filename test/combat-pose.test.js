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
