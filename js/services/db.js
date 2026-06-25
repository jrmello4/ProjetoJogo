const DB_NAME = 'MMAManagerDB';
const DB_VERSION = 5;

export class DB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('fighters')) {
          const fighterStore = db.createObjectStore('fighters', { keyPath: 'id' });
          fighterStore.createIndex('status', 'status');
          fighterStore.createIndex('weightClass', 'weightClass');
          fighterStore.createIndex('organizationId', 'organizationId');
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

  _txw(storeName, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = fn(tx, store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
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