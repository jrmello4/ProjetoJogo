const WEIGHT_CLASSES = [
  'Strawweight', 'Flyweight', 'Bantamweight', 'Featherweight',
  'Lightweight', 'Welterweight', 'Middleweight', 'Light Heavyweight', 'Heavyweight',
];

export class RankingService {
  static calculateRankings(fighters) {
    const rankings = {};

    for (const wc of WEIGHT_CLASSES) {
      const wcFighters = fighters
        .filter(f => f.weightClass === wc)
        .sort((a, b) => {
          const scoreA = this._rankingScore(a);
          const scoreB = this._rankingScore(b);
          return scoreB - scoreA;
        });

      rankings[wc] = wcFighters.map((fighter, index) => ({
        id: fighter.id,
        name: fighter.name,
        ranking: index + 1,
        score: this._rankingScore(fighter),
      }));
    }

    return rankings;
  }

  static _rankingScore(fighter) {
    const overall = fighter.overallRating || fighter.averageSkill;
    const winRateBonus = fighter.winRate * 0.3;
    const expBonus = Math.min(15, fighter.totalFights * 0.75);
    const recentBonus = fighter.fights.length > 0
      ? (fighter.fights[fighter.fights.length - 1].won ? 5 : -3)
      : 0;
    return overall + winRateBonus + expBonus + recentBonus;
  }

  static getChampions(rankings) {
    const champions = {};
    for (const [wc, ranked] of Object.entries(rankings)) {
      if (ranked.length > 0) {
        champions[wc] = ranked[0];
      }
    }
    return champions;
  }

  static getFighterRanking(fighter, rankings) {
    const ranked = rankings[fighter.weightClass];
    if (!ranked) return 0;
    const entry = ranked.find(r => r.id === fighter.id);
    return entry ? entry.ranking : 0;
  }
}
