// ============================================================
// StyleService — ponte entre config data e o Fighter model.
// Produz FightProfile para o motor de simulação.
// ============================================================
import { FIGHTING_STYLES, MOVES, PERKS } from '../config/game-config.js';

export class StyleService {
  static resolveFighter(fighter) {
    const style = FIGHTING_STYLES[fighter.style] || FIGHTING_STYLES.freestyle;
    const activePerks = fighter.perks.map(id => PERKS[id]).filter(Boolean);

    const mods = {
      powerMultiplier: 1,
      staminaComboReduction: 1,
      koChanceBonus: 0,
      submissionChanceMult: 1,
      damageTakenReduction: 1,
      groundStaminaDrainMult: 1,
      staminaDecayReduction: 1,
      composureLateRounds: 1,
      strikingLateRound: 1,
      moraleLossReduction: 1,
      neverSubmittedLowStamina: false,
      moveBuffs: {},
      kdChanceBonus: 0,
      subChanceLateRounds: 0,
      nullifyMatchupChance: 0,
      cardioRegeneration: 0,
    };

    for (const perk of activePerks) {
      const e = perk.effect;
      switch (e.type) {
        case 'power_multiplier': mods.powerMultiplier *= e.value; break;
        case 'stamina_combo_reduction': mods.staminaComboReduction = Math.min(mods.staminaComboReduction, e.value); break;
        case 'ko_chance_bonus': mods.koChanceBonus += e.value; break;
        case 'submission_chance_mult': mods.submissionChanceMult *= e.value; break;
        case 'damage_taken_reduction': mods.damageTakenReduction *= e.value; break;
        case 'ground_stamina_drain_mult': mods.groundStaminaDrainMult *= e.value; break;
        case 'stamina_decay_reduction': mods.staminaDecayReduction *= e.value; break;
        case 'composure_late_rounds': mods.composureLateRounds *= e.value; break;
        case 'striking_late_round': mods.strikingLateRound *= e.value; break;
        case 'morale_loss_reduction': mods.moraleLossReduction = Math.min(mods.moraleLossReduction, e.value); break;
        case 'never_submitted_low_stamina': mods.neverSubmittedLowStamina = true; break;
        case 'cardio_regeneration': mods.cardioRegeneration = Math.max(mods.cardioRegeneration, e.value); break;
        case 'move_buff':
          mods.moveBuffs[e.moveId] = mods.moveBuffs[e.moveId] || {};
          if (e.staminaMult) mods.moveBuffs[e.moveId].staminaMult = e.staminaMult;
          if (e.damageMult) mods.moveBuffs[e.moveId].damageMult = e.damageMult;
          if (e.kdChanceBonus) mods.moveBuffs[e.moveId].kdChanceBonus = (mods.moveBuffs[e.moveId].kdChanceBonus || 0) + e.kdChanceBonus;
          break;
        case 'style_perk':
          if (e.moveBonus) {
            for (const [moveId, mult] of Object.entries(e.moveBonus)) {
              mods.moveBuffs[moveId] = mods.moveBuffs[moveId] || {};
              mods.moveBuffs[moveId].damageMult = (mods.moveBuffs[moveId].damageMult || 1) * mult;
            }
          }
          if (e.kdChanceBonus) mods.kdChanceBonus += e.kdChanceBonus;
          if (e.subChanceLateRounds) mods.subChanceLateRounds = Math.max(mods.subChanceLateRounds, e.subChanceLateRounds);
          if (e.nullifyMatchupChance) mods.nullifyMatchupChance = Math.max(mods.nullifyMatchupChance, e.nullifyMatchupChance);
          break;
      }
    }

    const moveData = {};
    for (const moveId of fighter.moveset) {
      const def = MOVES[moveId];
      if (!def) continue;
      const prof = fighter.getMoveProficiency(moveId);
      const buff = mods.moveBuffs[moveId] || {};
      moveData[moveId] = {
        def,
        proficiency: prof,
        damageMult: (1 + prof / 200) * (buff.damageMult || 1),
        staminaMult: (1 - prof / 300) * (buff.staminaMult || 1),
        kdChanceBonus: (buff.kdChanceBonus || 0) + mods.kdChanceBonus,
      };
    }

    return {
      styleId: fighter.style,
      style,
      matchupAdvantage: style.matchup.advantage,
      matchupDisadvantage: style.matchup.disadvantage,
      evolutionRate: style.evolutionRate,
      moveData,
      perks: fighter.perks,
      mods,
    };
  }

  static resolveMatchup(profileA, profileB) {
    let bonusA = 0, bonusB = 0;

    if (profileA.mods.nullifyMatchupChance > 0 && Math.random() < profileA.mods.nullifyMatchupChance) {
      return { bonusA: 0, bonusB: 0 };
    }
    if (profileB.mods.nullifyMatchupChance > 0 && Math.random() < profileB.mods.nullifyMatchupChance) {
      return { bonusA: 0, bonusB: 0 };
    }

    if (profileA.matchupAdvantage.includes(profileB.styleId)) bonusA = 3;
    else if (profileA.matchupDisadvantage.includes(profileB.styleId)) bonusA = -2;

    if (profileB.matchupAdvantage.includes(profileA.styleId)) bonusB = 3;
    else if (profileB.matchupDisadvantage.includes(profileA.styleId)) bonusB = -2;

    return { bonusA, bonusB };
  }

  static randomStyle() {
    const keys = Object.keys(FIGHTING_STYLES);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  static randomMoveset(styleId, count = 6) {
    const style = FIGHTING_STYLES[styleId];
    if (!style) return [];
    const shuffled = [...style.poolMoves].sort(() => Math.random() - 0.5);
    const moveset = [];
    const hasTD = style.poolMoves.some(m => MOVES[m]?.type === 'takedown');
    const tdMove = style.poolMoves.find(m => MOVES[m]?.type === 'takedown');
    if (hasTD && tdMove) moveset.push(tdMove);
    for (const m of shuffled) {
      if (moveset.length >= count) break;
      if (!moveset.includes(m)) moveset.push(m);
    }
    return moveset;
  }
}
