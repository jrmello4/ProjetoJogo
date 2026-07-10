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

  // Calcula qual seria a próxima semana SEM persistir — usado por
  // GameController.processWeek() pra rodar a simulação inteira (que pode
  // ficar minutos esperando o jogador clicar nas instruções de córner)
  // antes de gravar o avanço de verdade. Se a aba recarregar ou o tick
  // falhar no meio do caminho, a semana no banco não avança sozinha e a
  // próxima tentativa reprocessa a mesma semana/luta do zero, em vez de
  // "pular no tempo" com a luta ao vivo nunca tendo sido salva.
  async peekNextWeek() {
    const state = await this.getState();
    let week = state.week + 1;
    let year = state.year;
    if (week > 52) {
      week = 1;
      year++;
    }
    return { ...state, week, year, eventThisWeek: false };
  }

  // Grava o avanço de semana no final do tick, depois que toda a simulação
  // já rodou sem erro. Relê o doc atual antes de mexer (em vez de sobrescrever
  // com o snapshot antigo de peekNextWeek) porque outros pontos do tick
  // (ex.: cerimônia de aposentadoria) fazem seu próprio read-modify-write
  // no mesmo doc 'state' durante o processamento — sobrescrever aqui
  // perderia esses campos.
  async commitWeekAdvance(week, year) {
    const state = await this.getState();
    state.week = week;
    state.year = year;
    state.eventThisWeek = false;
    await this.db.put('gameState', state);
    return state;
  }

  async applyWeeklyRecovery(fighterCtrl) {
    const allFighters = await fighterCtrl.getAllFighters();
    for (const f of allFighters) {
      if (f.status === 'retired') continue;
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
