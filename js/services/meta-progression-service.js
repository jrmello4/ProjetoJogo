// js/services/meta-progression-service.js
//
// Cross-run meta-progression: a global card pool built up across careers, a
// Legacy Points currency earned from fight achievements, and a small catalog
// of permanent perks purchased with those points between runs (see
// js/views/perks-screen.js for the catalog + screen).
//
// NOT the same thing as js/config/game-config.js's PERKS + fighter.perks /
// fighter.perkPoints (js/models/fighter.js) — those are IN-RUN combat skill
// unlocks earned via level-ups and spent with a single fighter's own
// perkPoints. This service's "perks" are cross-run/cross-career unlocks
// bought with Legacy Points earned across whole careers. The naming
// collides; the systems are deliberately separate (see task-10 brief).
//
// Persistence: reuses the existing 'gameState' object store (keyPath: 'id')
// as a single arbitrary-state record — the same pattern already used
// elsewhere (e.g. app.js's db.get('gameState', 'crowdReaction')). There is
// no dedicated 'metaProgression' object store in db.js's onupgradeneeded,
// and adding one would require a DB_VERSION bump/schema migration that's
// out of scope here.
export class MetaProgressionService {
  constructor(db) {
    this.db = db;
    this.globalPool = new Set(); // card IDs discovered across runs
    this.legacyPoints = 0;
    this.unlockedPerks = [];
  }

  async load() {
    const data = await this.db.get('gameState', 'metaProgression') || {};
    this.globalPool = new Set(data.globalPool || []);
    this.legacyPoints = data.legacyPoints || 0;
    this.unlockedPerks = data.perks || [];
  }

  async save() {
    // put() requires the record to carry its own 'id' matching the
    // gameState store's keyPath: 'id' — unlike a dedicated single-record
    // store, this one holds many records keyed by id.
    await this.db.put('gameState', {
      id: 'metaProgression',
      globalPool: [...this.globalPool],
      legacyPoints: this.legacyPoints,
      perks: this.unlockedPerks,
    });
  }

  addToGlobalPool(cardId) {
    this.globalPool.add(cardId);
    this.save();
  }

  addLegacyPoints(points) {
    this.legacyPoints += points;
    this.save();
  }

  unlockPerk(perkId, cost) {
    if (this.legacyPoints < cost) return false;
    this.legacyPoints -= cost;
    this.unlockedPerks.push(perkId);
    this.save();
    return true;
  }

  getAvailableCards() {
    return [...this.globalPool];
  }

  // Legacy points awarded for a fight result, from the PLAYER's perspective
  // (result is a CombatEngine._buildResult()-shaped object — fighterAId is
  // always the player, same convention CombatAdapter#runFight already uses
  // for its own `playerWon` check). Loss or draw = 0 points, computed
  // standalone here (not just left to the caller) so this stays correct
  // even if called directly instead of only after a pre-checked win.
  //
  // Rules: win +10, KO/TKO/Submission method +5 bonus, title win +50 bonus.
  // See combat-engine.js's _methodString for the exact strings result.method
  // can take ('KO', 'TKO', 'Submission', 'Decision (Unanimous)', etc).
  static computeLegacyPoints(result, isTitleFight = false) {
    if (!result || result.isDraw) return 0;
    const playerWon = result.winnerId === result.fighterAId;
    if (!playerWon) return 0;

    let points = 10;
    if (result.method === 'KO' || result.method === 'TKO' || result.method === 'Submission') {
      points += 5;
    }
    if (isTitleFight) {
      points += 50;
    }
    return points;
  }
}
