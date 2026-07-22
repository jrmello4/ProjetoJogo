import { clamp } from '../utils/helpers.js';

const RESUME_WINDOW = 6; // últimas lutas que a comissão realmente olha

export class RankingService {
  static calculateRankings(fighters) {
    const ranked = fighters
      .filter(f => f.totalFights > 0)
      .map(f => ({
        fighter: f,
        score: this._rankingScore(f),
      }))
      .sort((a, b) => b.score - a.score);

    return ranked.map((item, index) => ({
      ...item,
      breakdown: this.scoreBreakdown(item.fighter),
      rank: index + 1,
    }));
  }

  static scoreBreakdown(fighter) {
    const recent = (fighter.fights || []).slice(0, RESUME_WINDOW);
    const wins = recent.filter(f => f.won);
    const overall = fighter.overallRating || fighter.averageSkill || 0;
    const resume = wins.length > 0 ? (wins.reduce((s, f) => s + (f.opponentRating ?? 50), 0) / wins.length - 50) * 0.5 : 0;
    let streak = 0;
    for (const f of fighter.fights || []) { if (!f.won) break; streak++; }
    const streakBonus = Math.min(streak, 5) * 2;
    const recordBonus = clamp((fighter.record?.wins || 0) - (fighter.record?.losses || 0), -10, 10);
    const formPenalty = recent.filter(f => !f.won).length * 4;
    const popularity = (fighter.popularity || 0) * 0.03;
    return { overall, resume, streak: streakBonus, record: recordBonus, form: -formPenalty, popularity };
  }

  // Um ranking de MMA responde "contra quem você venceu", não "quantas vezes".
  //
  // A versão anterior dava +30 por estar invicto (winRate * 0.3) e no máximo
  // +8 pela qualidade dos adversários — então um 4-0 contra ninguém passava
  // à frente de um campeão 12-3. Aqui o overall (habilidade real) domina,
  // e o que separa lutadores de nível parecido é o currículo: bater alguém
  // acima de você sobe muito; perder recentemente derruba.
  static _rankingScore(fighter) {
    const overall = fighter.overallRating || fighter.averageSkill || 0;
    const recent = (fighter.fights || []).slice(0, RESUME_WINDOW);
    const wins = recent.filter(f => f.won);

    // Currículo: média do nível de quem você venceu, medida contra a linha
    // d'água (50). Vencer um cara de 80 vale +15; vencer um de 25, −12.
    const resume = wins.length > 0
      ? (wins.reduce((s, f) => s + (f.opponentRating ?? 50), 0) / wins.length - 50) * 0.5
      : 0;

    let streak = 0;
    for (const f of fighter.fights || []) {
      if (!f.won) break;
      streak++;
    }
    const streakBonus = Math.min(streak, 5) * 2;

    // Cartel geral importa, mas com teto — não dá para acumular indefinidamente.
    const recordBonus = clamp((fighter.record?.wins || 0) - (fighter.record?.losses || 0), -10, 10);

    // Derrota recente derruba, e é isso que tira você da fila do cinturão.
    const formPenalty = recent.filter(f => !f.won).length * 4;

    const popFactor = (fighter.popularity || 0) * 0.03;

    return overall + resume + streakBonus + recordBonus - formPenalty + popFactor;
  }

  static getChampions(rankings) {
    const weightClasses = [
      'Strawweight', 'Flyweight', 'Bantamweight', 'Featherweight',
      'Lightweight', 'Welterweight', 'Middleweight', 'Light Heavyweight', 'Heavyweight',
    ];

    const champions = {};
    for (const wc of weightClasses) {
      const best = rankings
        .filter(r => r.fighter.weightClass === wc)
        .sort((a, b) => b.score - a.score)[0];
      if (best) {
        champions[wc] = best.fighter;
      }
    }

    return champions;
  }
}
