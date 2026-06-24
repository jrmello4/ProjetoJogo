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
      rank: index + 1,
    }));
  }

  static _rankingScore(fighter) {
    const overall = fighter.overallRating || fighter.averageSkill;

    // Quality of victory: média do rating dos oponentes vencidos
    const wins = fighter.fights.filter(f => f.won);
    const qualityOfVictory = wins.length > 0
      ? wins.reduce((sum, f) => sum + (f.opponentRating || 50), 0) / wins.length * 0.1
      : 0;

    // Streak bonus: até +15
    let streak = 0;
    for (const f of fighter.fights) {
      if (f.won) streak++;
      else break;
    }
    const streakBonus = Math.min(15, streak * 3);

    // Popularity factor
    const popFactor = (fighter.popularity || 0) * 0.05;

    // Win rate bonus
    const winRateBonus = fighter.winRate * 0.3;

    // Experience bonus
    const expBonus = Math.min(15, fighter.totalFights * 0.75);

    return overall + qualityOfVictory + streakBonus + popFactor + winRateBonus + expBonus;
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