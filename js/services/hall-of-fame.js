// Hall da Fama — G5 versão enriquecida com estatísticas de carreira.
// Calcula elegibilidade com base em marcos (vitórias, OVR, ranking) e
// gera um verbete de carreira completo no momento da indução.
export class HallOfFame {
  static async hasCompletedCareer(db) {
    const entries = await db.getAll('hallOfFame');
    return entries.length > 0;
  }

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

  static induct(fighter, inductionDateISO = null, belts = null) {
    const finishes = (fighter.fights || []).filter(f => f.method && !f.method.startsWith('Decision'));
    const decisions = (fighter.fights || []).filter(f => f.method && f.method.startsWith('Decision'));
    const kos = finishes.filter(f => f.method === 'KO' || f.method === 'TKO');
    const subs = finishes.filter(f => f.method === 'Submission');

    // Maior streak da carreira
    let maxStreak = 0;
    let currentStreak = 0;
    for (const f of (fighter.fights || [])) {
      if (f.won) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak); }
      else currentStreak = 0;
    }

    // Enriquecer com cinturões — vêm de TitleService.vacateBeltsOf(), já que
    // o cinturão vive na Promotion, não no Fighter (ver world-service.js).
    belts = belts || [];

    return {
      id: 'hof-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      fighterId: fighter.id,
      name: fighter.name,
      nationality: fighter.nationality,
      weightClass: fighter.weightClass,
      record: { ...fighter.record },
      totalFights: fighter.totalFights || 0,
      peakRating: fighter.overallRating,
      popularity: fighter.popularity,
      inductionDate: inductionDateISO || new Date().toISOString(),
      achievements: this._getAchievements(fighter),

      // G5: estatísticas enriquecidas
      careerStats: {
        kos,
        subs,
        decisions,
        finishes: finishes.length,
        finishRate: fighter.totalFights > 0 ? Math.round((finishes.length / fighter.totalFights) * 100) : 0,
        maxWinStreak: maxStreak,
        titlesWon: fighter.titlesWon || 0,
        belts,
        careerEarnings: fighter.careerEarnings || 0,
        fightNightBonuses: fighter.fightNightBonuses || 0,
        performanceBonuses: fighter.performanceBonuses || 0,
        ageAtInduction: fighter.age || 0,
      },
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
    for (const f of (fighter.fights || [])) {
      if (f.won) streak++;
      else break;
    }
    if (streak >= 10) achievements.push(`Streak de ${streak} vitórias`);
    else if (streak >= 5) achievements.push(`Streak de ${streak} vitórias`);

    // Champion status
    if (fighter.ranking === 1) achievements.push('Campeão da divisão');

    // G5: bônus
    if ((fighter.titlesWon || 0) >= 5) achievements.push('Pentacampeão');
    if ((fighter.titlesWon || 0) >= 3) achievements.push('Tricampeão');

    return achievements;
  }
}
