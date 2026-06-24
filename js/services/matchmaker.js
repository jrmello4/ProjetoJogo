export class Matchmaker {
  static suggestFights(roster, count = 3, weightClass = null) {
    let pool = roster.filter(f => f.status === 'roster');
    if (weightClass) {
      pool = pool.filter(f => f.weightClass === weightClass);
    }

    // Sort by overallRating descending
    pool.sort((a, b) => b.overallRating - a.overallRating);

    if (pool.length < 2) return [];

    // Count recent fights per fighter (last 5 fights)
    const fightCounts = {};
    pool.forEach(f => {
      fightCounts[f.id] = f.fights ? f.fights.length : 0;
    });

    const fights = [];
    const used = new Set();

    // Pair fighters with similar OVR, prioritizing those with fewer fights
    while (fights.length < count && used.size < pool.length) {
      const available = pool.filter(f => !used.has(f.id));
      if (available.length < 2) break;

      // Pick fighter with fewest recent fights
      available.sort((a, b) => (fightCounts[a.id] || 0) - (fightCounts[b.id] || 0));

      const a = available[0];
      used.add(a.id);

      // Find closest OVR match among remaining
      const rest = available.slice(1).filter(f => !used.has(f.id));
      if (rest.length < 1) break;

      // Prefer same weight class, then closest OVR
      const sameWeight = rest.filter(f => f.weightClass === a.weightClass);
      const candidates = sameWeight.length > 1 ? sameWeight : rest;
      candidates.sort((x, y) => Math.abs(x.overallRating - a.overallRating) - Math.abs(y.overallRating - a.overallRating));

      const b = candidates[0];
      if (!b) break;
      used.add(b.id);

      // Check for recent rematch (last 5 fights)
      const recentOpponents = a.fights?.slice(-5).map(f => f.opponentId) || [];
      if (recentOpponents.includes(b.id)) {
        // Try next candidate
        const alt = candidates.find(f => !used.has(f.id) && !recentOpponents.includes(f.id));
        if (alt) {
          used.add(alt.id);
          fights.push({ fighterAId: a.id, fighterBId: alt.id });
        } else {
          fights.push({ fighterAId: a.id, fighterBId: b.id });
        }
      } else {
        fights.push({ fighterAId: a.id, fighterBId: b.id });
      }
    }

    return fights;
  }

  static suggestMainCard(roster, count = 2) {
    return Matchmaker.suggestFights(roster, count);
  }

  static suggestPrelimCard(roster, count = 2) {
    // For prelim, pick lower-ranked fighters
    const sorted = [...roster.filter(f => f.status === 'roster')].sort((a, b) => a.overallRating - b.overallRating);
    const prelimPool = sorted.slice(0, Math.min(count * 2, sorted.length));
    return Matchmaker.suggestFights(prelimPool, count);
  }
}
