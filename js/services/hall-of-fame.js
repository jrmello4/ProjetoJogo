export class HallOfFame {
  static checkEligibility(fighter) {
    const reasons = [];

    if (fighter.record.wins >= 20) {
      reasons.push('20+ vitórias');
    }
    if (fighter.overallRating >= 75 && fighter.totalFights >= 30) {
      reasons.push('OVR 75+ com 30+ lutas');
    }
    if (fighter.ranking === 1) {
      reasons.push('Campeão #1');
    }
    if (fighter.record.wins >= 15 && fighter.overallRating >= 80) {
      reasons.push('Elite: 15+ vitórias com OVR 80+');
    }

    return {
      eligible: reasons.length > 0,
      reasons,
    };
  }

  static induct(fighter) {
    return {
      id: 'hof-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      fighterId: fighter.id,
      name: fighter.name,
      nationality: fighter.nationality,
      weightClass: fighter.weightClass,
      record: { ...fighter.record },
      peakRating: fighter.overallRating,
      popularity: fighter.popularity,
      inductionDate: new Date().toISOString(),
      achievements: this._getAchievements(fighter),
    };
  }

  static _getAchievements(fighter) {
    const achievements = [];

    if (fighter.record.wins >= 30) achievements.push('Lenda: 30+ vitórias');
    if (fighter.record.wins >= 20) achievements.push('Veterano: 20+ vitórias');
    if (fighter.overallRating >= 90) achievements.push('Gênio: OVR 90+');
    if (fighter.overallRating >= 80) achievements.push('Elite: OVR 80+');
    if (fighter.popularity >= 90) achievements.push('Ícone Global');
    if (fighter.popularity >= 80) achievements.push('Superstar');
    if (fighter.winRate >= 80 && fighter.totalFights >= 15) achievements.push('Dominador: 80%+ win rate');

    // Streak
    let streak = 0;
    for (const f of fighter.fights) {
      if (f.won) streak++;
      else break;
    }
    if (streak >= 10) achievements.push(`Streak de ${streak} vitórias`);
    else if (streak >= 5) achievements.push(`Streak de ${streak} vitórias`);

    // Champion status
    if (fighter.ranking === 1) achievements.push('Campeão da divisão');

    return achievements;
  }
}
