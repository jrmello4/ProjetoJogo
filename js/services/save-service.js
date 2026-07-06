const STORES = ['fighters', 'organization', 'events', 'fights', 'rivalries', 'hallOfFame', 'offers'];

export class SaveService {
  constructor(db) {
    this.db = db;
  }

  async exportSave() {
    const data = { exportedAt: new Date().toISOString(), version: 2 };
    for (const store of STORES) {
      data[store] = await this.db.getAll(store);
    }
    // gameState guarda vários singletons (state, gym, milestones, meta)
    data.gameState = await this.db.getAll('gameState');
    return JSON.stringify(data, null, 2);
  }

  async importSave(json) {
    const data = JSON.parse(json);

    for (const store of STORES) {
      await this.db.clear(store);
      for (const item of data[store] || []) {
        await this.db.add(store, item);
      }
    }

    await this.db.clear('gameState');
    const gameStates = Array.isArray(data.gameState) ? data.gameState : [data.gameState].filter(Boolean);
    for (const gs of gameStates) {
      await this.db.put('gameState', gs);
    }

    return true;
  }

  async resetGame() {
    for (const store of STORES) {
      await this.db.clear(store);
    }
    await this.db.clear('notifications');
    await this.db.clear('gameState');
  }

  async saveSave() {
    const json = await this.exportSave();
    localStorage.setItem('mmaManagerSave', json);
    return true;
  }

  async loadSave() {
    const json = localStorage.getItem('mmaManagerSave');
    if (!json) throw new Error('Nenhum save encontrado');
    return this.importSave(json);
  }

  async getSaveInfo() {
    const fighters = await this.db.getAll('fighters');
    const events = await this.db.getAll('events');
    const state = await this.db.get('gameState', 'state');
    return {
      rosterSize: fighters.filter(f => f.status === 'gym').length,
      freeAgents: fighters.filter(f => f.status === 'free').length,
      totalEvents: events.length,
      week: state?.week || 1,
      year: state?.year || 1,
    };
  }
}
