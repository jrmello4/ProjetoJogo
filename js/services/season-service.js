import { generateId } from '../utils/helpers.js';

export class SeasonService {
  constructor(db) {
    this.db = db;
  }

  async initSeason() {
    const state = await this.db.get('gameState', 'state');
    if (!state) {
      await this.db.put('gameState', {
        id: 'state',
        week: 1,
        year: 1,
        eventThisWeek: false,
        totalEvents: 0,
        startedAt: new Date().toISOString(),
      });
    }
  }

  async getState() {
    return await this.db.get('gameState', 'state');
  }

  async canCreateEvent() {
    const state = await this.getState();
    return !state.eventThisWeek;
  }

  async markEventCreated() {
    const state = await this.getState();
    state.eventThisWeek = true;
    await this.db.put('gameState', state);
  }

  async advanceWeek() {
    const state = await this.getState();
    state.week++;
    if (state.week > 52) {
      state.week = 1;
      state.year++;
    }
    state.eventThisWeek = false;
    await this.db.put('gameState', state);
    return state;
  }

  async applyWeeklyRecovery(fighterCtrl) {
    const roster = await fighterCtrl.getRoster('org-001');
    for (const f of roster) {
      f.fatigue = Math.max(0, f.fatigue - 10);
      f.morale = Math.min(100, f.morale + 5);
      await fighterCtrl.updateFighter(f);
    }
  }

  async getWeekLabel() {
    const state = await this.getState();
    return `Semana ${state.week}, Ano ${state.year}`;
  }

  async isWeekBlocked() {
    const state = await this.getState();
    return state.eventThisWeek;
  }
}
