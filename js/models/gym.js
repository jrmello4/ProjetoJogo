import { clamp } from '../utils/helpers.js';
import { GYM_CONFIG, FACILITY_LEVELS, COACH_CONFIG, SCOUT_CONFIG } from '../config/game-config.js';

const LEDGER_LIMIT = 120;

// Academia do jogador — singleton persistido em gameState (id 'gym').
export class Gym {
  constructor(data = {}) {
    this.id = 'gym'; // keyPath do store gameState
    this.name = data.name || 'Academia Sem Nome';
    this.cash = data.cash ?? 35000;
    this.reputation = data.reputation ?? GYM_CONFIG.STARTING_REPUTATION;
    this.level = data.level ?? 1; // instalações — determina vagas/bônus (ver FACILITY_LEVELS)
    this.managerCut = data.managerCut ?? GYM_CONFIG.MANAGER_CUT;
    this.totalPurseEarnings = data.totalPurseEarnings ?? 0;
    this.wins = data.wins ?? 0;
    this.losses = data.losses ?? 0;
    this.coaches = data.coaches || { striking: false, grappling: false, cardio: false };
    this.scoutLevel = data.scoutLevel ?? 0; // 0 = sem olheiro, 1 = ativo
    this.trust = data.trust ?? 50; // 0-100, Épico A — promessas cumpridas vs quebradas
    this.ledger = data.ledger || []; // {absWeek, label, amount}
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  get facility() {
    return FACILITY_LEVELS[Math.min(this.level, FACILITY_LEVELS.length) - 1];
  }

  get nextFacility() {
    return FACILITY_LEVELS[this.level] || null; // this.level é índice+1 do próximo
  }

  get maxTeamSize() {
    return this.facility.maxTeamSize;
  }

  get hiredCoachCount() {
    return Object.values(this.coaches).filter(Boolean).length;
  }

  hasCoach(category) {
    return !!this.coaches[category];
  }

  addTransaction(absWeek, label, amount) {
    this.cash += amount;
    this.ledger.unshift({ absWeek, label, amount });
    if (this.ledger.length > LEDGER_LIMIT) {
      this.ledger.length = LEDGER_LIMIT;
    }
  }

  updateReputation(change) {
    this.reputation = clamp(this.reputation + change, 0, 100);
  }

  get winRate() {
    const total = this.wins + this.losses;
    return total > 0 ? (this.wins / total) * 100 : 0;
  }

  weeklyExpenses(teamSize) {
    const rent = GYM_CONFIG.WEEKLY_RENT;
    const coaching = GYM_CONFIG.WEEKLY_COACHING_PER_FIGHTER * teamSize;
    const coaches = Object.entries(this.coaches)
      .filter(([, hired]) => hired)
      .reduce((sum, [cat]) => sum + (COACH_CONFIG[cat]?.weeklyCost || 0), 0);
    const scout = this.scoutLevel > 0 ? SCOUT_CONFIG.weeklyCost : 0;
    return { rent, coaching, coaches, scout, total: rent + coaching + coaches + scout };
  }

  weeklyIncome() {
    const students = Math.floor(
      GYM_CONFIG.STUDENT_INCOME_BASE + this.reputation * GYM_CONFIG.STUDENT_INCOME_PER_REP
    );
    return { students, total: students };
  }
}
