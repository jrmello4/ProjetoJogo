const DB_NAME = 'MMAManagerDB';
const DB_VERSION = 8;

export class DB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        const tx = e.target.transaction;

        if (!db.objectStoreNames.contains('fighters')) {
          const fighterStore = db.createObjectStore('fighters', { keyPath: 'id' });
          fighterStore.createIndex('status', 'status');
          fighterStore.createIndex('weightClass', 'weightClass');
          fighterStore.createIndex('organizationId', 'organizationId');
        }

        // v7 — carreira de 1 lutador: sem posse de academia, sem índice
        // por dono. "Quem é o jogador" agora é identidade (career.playerFighterId),
        // não um índice de fighters — ver docs/superpowers/specs/2026-07-13-carreira-sistemica-1-lutador-design.md §A.6.
        const fighterStore = tx.objectStore('fighters');
        if (fighterStore.indexNames.contains('gymId')) {
          fighterStore.deleteIndex('gymId');
        }

        if (!db.objectStoreNames.contains('offers')) {
          const offerStore = db.createObjectStore('offers', { keyPath: 'id' });
          offerStore.createIndex('status', 'status');
          offerStore.createIndex('fighterId', 'fighterId');
          offerStore.createIndex('promotionId', 'promotionId');
        }

        if (!db.objectStoreNames.contains('organization')) {
          db.createObjectStore('organization', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('date', 'date');
          eventStore.createIndex('status', 'status');
        }

        if (!db.objectStoreNames.contains('fights')) {
          const fightStore = db.createObjectStore('fights', { keyPath: 'id' });
          fightStore.createIndex('fighterId', 'fighterId');
          fightStore.createIndex('eventId', 'eventId');
        }

        if (!db.objectStoreNames.contains('rivalries')) {
          const rivalryStore = db.createObjectStore('rivalries', { keyPath: 'id' });
          rivalryStore.createIndex('fighterAId', 'fighterAId');
          rivalryStore.createIndex('fighterBId', 'fighterBId');
          rivalryStore.createIndex('active', 'active');
        }

        if (!db.objectStoreNames.contains('hallOfFame')) {
          db.createObjectStore('hallOfFame', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('gameState')) {
          db.createObjectStore('gameState', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('notifications')) {
          const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
          notifStore.createIndex('read', 'read');
        }

        // v8 — cadeias narrativas pós-luta (Fase 11)
        if (!db.objectStoreNames.contains('narrativeChains')) {
          const chainStore = db.createObjectStore('narrativeChains', { keyPath: 'id' });
          chainStore.createIndex('fighterId', 'fighterId');
          chainStore.createIndex('absWeek', 'absWeek');
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;

        // Handle version change — close old DB when another tab upgrades
        this.db.onversionchange = (ev) => {
          this.db.close();
          location.reload();
        };

        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB open error:', e.target.error);
        reject(e.target.error);
      };

      request.onblocked = (e) => {
        console.warn('IndexedDB upgrade blocked — close other tabs with this app open');
      };
    });
  }

  async getAll(storeName) {
    return this._tx(storeName, (tx, store) => store.getAll());
  }

  async get(storeName, id) {
    return this._tx(storeName, (tx, store) => store.get(id));
  }

  async put(storeName, data) {
    return this._txw(storeName, (tx, store) => store.put(data));
  }

  async add(storeName, data) {
    return this._txw(storeName, (tx, store) => store.add(data));
  }

  async delete(storeName, id) {
    return this._txw(storeName, (tx, store) => store.delete(id));
  }

  async clear(storeName) {
    return this._txw(storeName, (tx, store) => store.clear());
  }

  async batchPut(storeName, items) {
    if (items.length === 0) return;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const item of items) store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
    });
  }

  // Substitui várias stores numa única transação. É usado na importação de
  // save: ou todos os dados do arquivo entram juntos, ou nenhum dado atual é
  // perdido caso uma escrita falhe no meio do caminho.
  async replaceStores(recordsByStore) {
    const storeNames = Object.keys(recordsByStore);
    if (storeNames.length === 0) return;

    return new Promise((resolve, reject) => {
      let tx;
      try {
        tx = this.db.transaction(storeNames, 'readwrite');
        for (const storeName of storeNames) {
          const store = tx.objectStore(storeName);
          store.clear();
          for (const item of recordsByStore[storeName]) store.put(item);
        }
      } catch (error) {
        reject(error);
        return;
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Falha ao substituir dados do save.'));
      tx.onabort = () => reject(tx.error || new Error('Importação de save abortada.'));
    });
  }

  async getIndex(storeName, indexName, value) {
    return this._tx(storeName, (tx, store) => store.index(indexName).getAll(value));
  }

  _tx(storeName, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = fn(tx, store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
    });
  }

  // P8.4 — escrita só resolve no commit da transação (tx.oncomplete), não no
  // sucesso da request. Antes, um abort tardio (quota estourada, erro de
  // constraint) depois do request.onsuccess já ter resolvido a Promise
  // deixava o chamador achando que salvou — e a escrita sumia sem erro
  // nenhum. Leitura (_tx) não precisa disso: nada commita além do que já foi
  // lido.
  _txw(storeName, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = fn(tx, store);
      let result;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
    });
  }

  static async reset() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      const done = () => {
        localStorage.clear();
        resolve();
      };
      request.onsuccess = done;
      request.onblocked = done;
      request.onerror = (e) => reject(e);
    });
  }
}
