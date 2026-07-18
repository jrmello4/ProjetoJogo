import { BiographyService } from './biography-service.js';

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

  // Monta o verbete completo de carreira SEM persistir — usado tanto pela
  // indução real (buildEntry + put) quanto pelo snapshot da cerimônia de
  // aposentadoria, que todo lutador ganha mesmo sem entrar no Hall.
  // ctx opcional: { topMoments, rivalryInfo } — grava biografia viva no verbete
  static buildEntry(fighter, reasons = [], ctx = {}) {
    const bio = BiographyService.compose(fighter, {
      topMoments: ctx.topMoments || [],
      rivalryInfo: ctx.rivalryInfo || null,
    });
    const entry = {
      // Mesma convenção de induct()/_processYearEnd (id = fighter.id, sem
      // prefixo): a cerimônia de aposentadoria busca por
      // db.get('hallOfFame', fighterId) usando o id CRU. Com o prefixo
      // "hof-" antigo, essa busca nunca encontrava nada — quem se
      // aposentava via escolha de fim de carreira nunca via a cerimônia,
      // só a lista comum do Hall da Fama.
      id: fighter.id,
      fighterId: fighter.id,
      name: fighter.name,
      weightClass: fighter.weightClass,
      record: { ...fighter.record },
      totalFights: fighter.totalFights || 0,
      peakRating: fighter.overallRating,
      popularity: fighter.popularity,
      inductionDate: new Date().toISOString(),
      achievements: [...(HallOfFame._getAchievements(fighter) || []), ...reasons],
      biography: bio,
      careerStats: {
        kos: (fighter.fights || []).filter(f => f.method === 'KO' || f.method === 'TKO'),
        subs: (fighter.fights || []).filter(f => f.method === 'Submission'),
        decisions: (fighter.fights || []).filter(f => f.method && f.method.startsWith('Decision')),
        finishes: (fighter.fights || []).filter(f => f.method && !f.method.startsWith('Decision')).length,
        finishRate: fighter.totalFights > 0 ? Math.round(((fighter.fights || []).filter(f => f.method && !f.method.startsWith('Decision')).length / fighter.totalFights) * 100) : 0,
        maxWinStreak: (() => {
          let max = 0, cur = 0;
          for (const f of (fighter.fights || [])) { if (f.won) { cur++; max = Math.max(max, cur); } else cur = 0; }
          return max;
        })(),
        titlesWon: fighter.titlesWon || 0,
        careerEarnings: fighter.careerEarnings || 0,
        fightNightBonuses: fighter.fightNightBonuses || 0,
        performanceBonuses: fighter.performanceBonuses || 0,
        ageAtInduction: fighter.age || 0,
      },
    };
    return entry;
  }

  // P5.3 (corrigido): a indução do jogador agora respeita os MESMOS critérios
  // dos NPCs (checkEligibility). Antes, qualquer escolha de aposentadoria
  // força-induzia — o Hall enchia de lutadores 3-8-0. A cerimônia continua
  // acontecendo pra todo mundo, mas via snapshot (ver career-controller),
  // não via entrada persistida aqui.
  static async inductIfEligible(db, fighter, reasons = []) {
    const eligibility = HallOfFame.checkEligibility(fighter);
    if (!eligibility.eligible) return null;
    const existing = await db.get('hallOfFame', fighter.id);
    if (existing) return existing;
    const entry = HallOfFame.buildEntry(fighter, [...eligibility.reasons, ...reasons]);
    await db.put('hallOfFame', entry);
    return entry;
  }

  // Reavalia elegibilidade a partir dos campos do PRÓPRIO verbete — pra
  // limpar saves poluídos pelo forceInduct antigo. `ranking === 1` não é
  // recuperável do snapshot; titlesWon > 0 cobre esse caso na prática.
  static entryIsEligible(entry) {
    const wins = entry.record?.wins || 0;
    const ovr = entry.peakRating || 0;
    const fights = entry.totalFights || 0;
    const titles = entry.careerStats?.titlesWon || 0;
    return (
      wins >= 20 ||
      (ovr >= 75 && fights >= 30) ||
      (wins >= 15 && ovr >= 80) ||
      titles > 0
    );
  }
}
