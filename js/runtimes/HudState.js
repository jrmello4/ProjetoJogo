import { absWeekToLabel } from '../config/game-config.js';

function recordLabel(record = {}) {
  return `${record.wins || 0}-${record.losses || 0}-${record.draws || 0}`;
}

function playerRank(data, fighter) {
  if ((data.belts || []).length > 0 || fighter?.titlesWon > 0) return 'CAMPEAO';
  if (data.contenderStatus?.rank) return `#${data.contenderStatus.rank}`;

  const divisions = Array.isArray(data.rankings) ? data.rankings : [];
  for (const division of divisions) {
    const rows = Array.isArray(division) ? division : division?.rankings || division?.fighters || [];
    const index = rows.findIndex(row => (row?.fighter?.id || row?.fighterId || row?.id) === fighter?.id);
    if (index >= 0) return `#${rows[index]?.rank || index + 1}`;
  }
  return 'SEM RANK';
}

export class HudState {
  static compute(data = {}) {
    const fighter = data.fighter;
    if (!fighter) {
      return Object.freeze({ ready: false, weekLabel: absWeekToLabel(data.now || 1) });
    }

    const now = Number(data.now || 1);
    const booking = (data.bookings || [])
      .filter(item => item.fighterId === fighter.id && item.status === 'accepted' && !item.completed)
      .sort((a, b) => (a.eventAbsWeek || Infinity) - (b.eventAbsWeek || Infinity))[0] || null;
    const pendingOffers = (data.pendingOffers || []).filter(item =>
      !item.fighterId || item.fighterId === fighter.id
    ).length;
    const retired = fighter.status === 'retired' || fighter.retired === true || data.state?.careerEnded === true;
    const weeksToFight = booking ? Math.max(0, Number(booking.eventAbsWeek || now) - now) : null;

    return Object.freeze({
      ready: true,
      fighter,
      fighterId: fighter.id,
      fighterName: fighter.name,
      recordLabel: recordLabel(fighter.record),
      rankLabel: playerRank(data, fighter),
      week: now,
      weekLabel: absWeekToLabel(now),
      cash: Number(fighter.cash || 0),
      energy: Math.round(Number(fighter.energy ?? 100)),
      morale: Math.round(Number(fighter.morale ?? 100)),
      pendingOffers,
      injuryActive: Boolean(fighter.injury?.active || fighter.injury?.stage),
      retired,
      canAdvance: !retired && !data.endCareerPrompt,
      nextFight: booking ? Object.freeze({
        opponentName: booking.opponentName || 'Oponente',
        promotionName: booking.promotionName || '',
        weeksToFight,
        isFightWeek: weeksToFight === 0,
        isTitleFight: Boolean(booking.isTitleFight),
      }) : null,
    });
  }
}
