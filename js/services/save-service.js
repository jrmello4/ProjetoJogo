export class SaveService {
  constructor(db) {
    this.db = db;
  }

  async exportSave() {
    const data = {
      fighters: await this.db.getAll('fighters'),
      organization: await this.db.get('organization', 'org-001'),
      events: await this.db.getAll('events'),
      fights: await this.db.getAll('fights'),
      rivalries: await this.db.getAll('rivalries'),
      hallOfFame: await this.db.getAll('hallOfFame'),
      gameState: await this.db.get('gameState', 'state'),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  async importSave(json) {
    const data = JSON.parse(json);

    // Clear all stores
    await this.db.clear('fighters');
    await this.db.clear('organization');
    await this.db.clear('events');
    await this.db.clear('fights');
    await this.db.clear('rivalries');
    await this.db.clear('hallOfFame');

    // Restore data
    for (const f of data.fighters || []) {
      await this.db.add('fighters', f);
    }
    if (data.organization) {
      await this.db.put('organization', data.organization);
    }
    for (const e of data.events || []) {
      await this.db.add('events', e);
    }
    for (const f of data.fights || []) {
      await this.db.add('fights', f);
    }
    for (const r of data.rivalries || []) {
      await this.db.add('rivalries', r);
    }
    for (const h of data.hallOfFame || []) {
      await this.db.add('hallOfFame', h);
    }
    if (data.gameState) {
      await this.db.put('gameState', data.gameState);
    }

    return true;
  }

  async resetGame() {
    await this.db.clear('fighters');
    await this.db.clear('organization');
    await this.db.clear('events');
    await this.db.clear('fights');
    await this.db.clear('rivalries');
    await this.db.clear('hallOfFame');
    await this.db.clear('notifications');
    await this.db.delete('gameState', 'state');
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
      rosterSize: fighters.filter(f => f.status === 'roster').length,
      freeAgents: fighters.filter(f => f.status === 'free').length,
      totalEvents: events.length,
      week: state?.week || 1,
      year: state?.year || 1,
    };
  }
}
