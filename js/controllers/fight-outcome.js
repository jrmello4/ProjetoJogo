import { GAME_PLAN_EDGE, SCOUTING_PLAN_EDGE_RATIOS } from '../config/game-config.js';
import { clamp } from '../utils/helpers.js';
import { StyleService } from '../services/style-service.js';

// Post-fight bookkeeping + pre-fight game-plan edge, shared by every fight
// path. These used to live on SimulationEngine (the old statistical engine,
// now removed); the card engine (CombatAdapter) only resolves the bout and
// returns a result object, so record/morale/popularity/accumulated-damage and
// the game-plan reading edge are applied from here instead.
export class FightOutcome {
  // Styles make fights. O plano de jogo é lido contra o adversário REAL —
  // o jogador só sabe o que estudou. Acertar a leitura vale +10% por round;
  // errar custa −8%. Não estudar é jogar na sorte.
  static _planEdge(plan, opponent, scoutingLevel = 0) {
    if (!plan.strongVs && !plan.weakVs) return 0;

    const a = opponent.attributes;
    const striking = opponent.strikingScore;
    const grappling = opponent.grapplingScore;
    const gap = striking - grappling;

    const traits = new Set();
    if (gap > 6) traits.add('striker');
    else if (gap < -6) traits.add('grappler');
    if (a.cardio >= 60) traits.add('highCardio');
    else if (a.cardio <= 45) traits.add('lowCardio');
    if (a.fightIQ >= 60) traits.add('highIq');
    else if (a.fightIQ <= 45) traits.add('lowIq');
    // Épico C: novos traits baseados em atributos expandidos
    if ((a.power ?? 50) >= 65) traits.add('powerful');
    if ((a.takedowns ?? 50) >= 65) traits.add('wrestler');
    if ((a.submissionOffense ?? 50) >= 65) traits.add('submission');
    if ((a.speed ?? 50) >= 65) traits.add('fast');
    if ((a.composure ?? 50) <= 40) traits.add('nervous');

    let rawEdge = 0;
    if (plan.strongVs && traits.has(plan.strongVs)) rawEdge = GAME_PLAN_EDGE.strong;
    else if (plan.weakVs && traits.has(plan.weakVs)) rawEdge = GAME_PLAN_EDGE.weak;

    // Scale by scouting level — pior scouting = menos precisão = edge mais fraco
    const ratio = SCOUTING_PLAN_EDGE_RATIOS[Math.min(Math.max(scoutingLevel, 0), 4)] ?? 1.0;
    return rawEdge * ratio;
  }

  // Épico E2: derrota por KO/TKO causa dano permanente
  static _applyAccumulatedDamage(winner, loser, result) {
    const method = result.method;
    if (!method || method.startsWith('Decision')) return;

    if (method === 'KO' || method === 'TKO') {
      let damage = method === 'KO'
        ? Math.floor(Math.random() * 4) + 2  // 2-5 pontos (era 3-7, reduzido para evitar que duas lutas destruam o chin)
        : Math.floor(Math.random() * 3) + 1; // 1-3 pontos

      // Perk: damageTakenReduction reduz dano permanente de KO/TKO
      const loserProfile = StyleService.resolveFighter(loser);
      const dmgReduction = loserProfile?.mods.damageTakenReduction || 1;
      damage = Math.max(1, Math.floor(damage * dmgReduction));

      loser.attributes.chin = clamp(loser.attributes.chin - damage, 1, 99);
      loser.attributes.durability = clamp(loser.attributes.durability - Math.floor(damage * 0.7), 1, 99);
    }
  }

  // `outcome`: 'win' | 'loss' | 'draw'
  static _updateFighter(fighter, opponent, outcome, method, round, dateISO = null) {
    const fighterProfile = StyleService.resolveFighter(fighter);
    const moraleReduction = fighterProfile?.mods.moraleLossReduction || 1;

    if (outcome === 'win') {
      fighter.record.wins++;
      fighter.applyMoraleChange(10);
    } else if (outcome === 'draw') {
      fighter.record.draws++;
      fighter.applyMoraleChange(-2); // ninguém comemora um empate, mas não é derrota
    } else {
      fighter.record.losses++;
      fighter.applyMoraleChange(Math.round(-12 * moraleReduction));
      // Épico D — KO/TKO é mais devastador que decisão para a moral
      if (method && (method.method?.startsWith('KO') || method.method?.startsWith('TKO'))) {
        fighter.applyMoraleChange(Math.round(-6 * moraleReduction)); // -18 total (KO abala mais)
      }
      // Decisão: moral leve (perdeu mas lutou, não foi humilhado)
    }

    fighter.applyFatigue(15 + round * 5);
    fighter.evolve();

    fighter.fights.unshift({
      opponentId: opponent.id,
      opponent: opponent.name,
      // O ranking usa isto para "qualidade das vitórias" — sem gravar, todo
      // adversário valia 50 e vencer o campeão pesava o mesmo que vencer um
      // estreante.
      opponentRating: opponent.overallRating,
      // G3: OVR do lutador no momento da luta para gráfico de carreira
      fighterRating: fighter.overallRating,
      result: outcome === 'win' ? 'W' : outcome === 'draw' ? 'D' : 'L',
      method: method.method,
      round,
      date: dateISO || new Date().toISOString(),
      // null (não false) — um empate não deve quebrar/contar como derrota
      // em nenhuma lógica que faça `=== false` em vez de checar falsy.
      won: outcome === 'win' ? true : outcome === 'draw' ? null : false,
    });

    if (fighter.fights.length > 50) {
      fighter.fights = fighter.fights.slice(0, 50);
    }
  }

  // `outcome`: 'win' | 'loss' | 'draw'
  static _updatePopularity(fighter, opponent, method, outcome) {
    let change = 0;
    if (outcome === 'win') {
      change = 2 + Math.floor(Math.random() * 4);
      if (method.method === 'KO' || method.method === 'Submission') change += 4;
      if (method.method === 'TKO') change += 2;
      if (opponent.overallRating >= 70) change += 5;
      if (opponent.overallRating >= 80) change += 5;
    } else if (outcome === 'draw') {
      change = Math.random() < 0.5 ? 0 : -1; // quase neutro
    } else {
      change = -1 - Math.floor(Math.random() * 3);
      if (opponent.overallRating >= 70) change = Math.max(change, -2);
    }
    fighter.updatePopularity(change);
  }
}
