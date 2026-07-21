const STORES = ['fighters', 'organization', 'events', 'fights', 'rivalries', 'hallOfFame', 'offers', 'narrativeChains'];
const SLOT_COUNT = 6;

export class SaveService {
  constructor(db) {
    this.db = db;
    this.currentSlot = parseInt(localStorage.getItem('mmaManagerCurrentSlot') || '1', 10);
  }

  slotKey(slotIndex) {
    return `mmaManagerSave_${slotIndex || this.currentSlot}`;
  }

  setSlot(slotIndex) {
    this.currentSlot = slotIndex;
    localStorage.setItem('mmaManagerCurrentSlot', String(slotIndex));
  }

  async getSlotInfo(slotIndex) {
    const key = this.slotKey(slotIndex);
    const json = localStorage.getItem(key);
    if (!json) return { slot: slotIndex, exists: false };
    try {
      const data = JSON.parse(json);
      const state = (data.gameState || []).find(s => s.id === 'state');
      const career = (data.gameState || []).find(s => s.id === 'career');
      const fighter = career?.playerFighterId ? data.fighters?.find(f => f.id === career.playerFighterId) : null;
      return {
        slot: slotIndex, exists: true,
        week: state?.week || '?', year: state?.year || '?',
        fighterName: fighter?.name || 'Sem lutador',
        exportedAt: data.exportedAt || null,
        rosterSize: fighter ? 1 : 0,
      };
    } catch {
      return { slot: slotIndex, exists: true, corrupted: true };
    }
  }

  async listSlots() {
    const slots = [];
    for (let i = 1; i <= SLOT_COUNT; i++) {
      slots.push(await this.getSlotInfo(i));
    }
    return slots;
  }

  async exportSave() {
    const data = { exportedAt: new Date().toISOString(), version: 3 };
    for (const store of STORES) {
      data[store] = await this.db.getAll(store);
    }
    data.gameState = await this.db.getAll('gameState');
    return JSON.stringify(data, null, 2);
  }

  async importSave(json) {
    let data;
    try {
      data = JSON.parse(json);
    } catch {
      throw new Error('Arquivo de save corrompido — não foi possível ler os dados.');
    }
    this.validateSave(data);
    for (const store of STORES) {
      if (!Array.isArray(data[store])) {
        throw new Error('Arquivo de save inválido — dados do store "' + store + '" ausentes ou mal formatados.');
      }
    }
    for (const store of STORES) {
      await this.db.clear(store);
      const items = data[store] || [];
      if (items.length > 0) await this.db.batchPut(store, items);
    }
    await this.db.clear('gameState');
    const gameStates = Array.isArray(data.gameState) ? data.gameState : [data.gameState].filter(Boolean);
    if (gameStates.length > 0) await this.db.batchPut('gameState', gameStates);
    return true;
  }

  async resetGame() {
    for (const store of STORES) await this.db.clear(store);
    await this.db.clear('notifications');
    await this.db.clear('gameState');
  }

  /** F15: valida que um save importado tem dados mínimos consistentes */
  validateSave(data) {
    if (!data || typeof data !== 'object') throw new Error('Save inválido — dados vazios.');
    const checks = [
      { field: 'fighters', label: 'lutadores', min: 1 },
      { field: 'organization', label: 'organização', min: 1 },
      { field: 'gameState', label: 'estado do jogo', min: 1 },
    ];
    for (const { field, label, min } of checks) {
      const arr = data[field];
      if (!arr || !Array.isArray(arr)) {
        throw new Error(`Save corrompido — store "${label}" ausente.`);
      }
      if (arr.length < min) {
        throw new Error(`Save incompleto — store "${label}" vazio.`);
      }
    }
    const career = (data.gameState || []).find(s => s.id === 'career');
    const fighterId = career?.playerFighterId;
    const playerFighter = data.fighters?.find(f => f.id === fighterId);
    if (!playerFighter) {
      throw new Error('Save inconsistente — lutador principal não encontrado.');
    }
    return true;
  }

  /** F15: valida estado atual do jogo entre DB stores */
  async validateCurrentState() {
    const issues = [];
    const fighters = await this.db.getAll('fighters');
    if (fighters.length === 0) issues.push('Nenhum lutador encontrado.');
    const state = await this.db.getAll('gameState');
    if (state.length === 0) issues.push('Estado do jogo vazio.');
    const career = state.find(s => s.id === 'career');
    if (career) {
      const playerExists = fighters.some(f => f.id === career.playerFighterId);
      if (!playerExists) issues.push(`Lutador do jogador (${career.playerFighterId}) não encontrado.`);
    }
    return issues.length > 0 ? issues : null;
  }

  async saveSave(slotIndex) {
    const idx = slotIndex || this.currentSlot;
    const json = await this.exportSave();
    try {
      localStorage.setItem(this.slotKey(idx), json);
    } catch {
      // localStorage tem cota bem menor que IndexedDB (5-10MB típico entre
      // navegadores) — uma carreira longa (muitas lutas/eventos/NPCs
      // acumulados) já passa de 11MB num estado moderado nos nossos testes.
      // Sem isto, o clique em "Salvar" falhava calado: nenhum toast, nenhum
      // erro, o jogador só via o slot continuar vazio.
      const mb = (new Blob([json]).size / 1024 / 1024).toFixed(1);
      throw new Error(
        `Save muito grande pro navegador guardar aqui (${mb} MB). Use "Exportar backup" nas Configurações — baixa um arquivo sem limite de tamanho.`
      );
    }
    this.setSlot(idx);
    return true;
  }

  async loadSave(slotIndex) {
    const idx = slotIndex || this.currentSlot;
    const json = localStorage.getItem(this.slotKey(idx));
    if (!json) throw new Error(`Nenhum save encontrado no slot ${idx}`);
    this.setSlot(idx);
    return this.importSave(json);
  }

  async deleteSave(slotIndex) {
    localStorage.removeItem(this.slotKey(slotIndex));
  }

  async getSaveInfo() {
    const fighters = await this.db.getAll('fighters');
    const events = await this.db.getAll('events');
    const state = await this.db.get('gameState', 'state');
    const career = await this.db.get('gameState', 'career');
    return {
      rosterSize: career?.playerFighterId ? 1 : 0,
      freeAgents: fighters.filter(f => f.status === 'free').length,
      totalEvents: events.length,
      week: state?.week || 1, year: state?.year || 1,
    };
  }
}
