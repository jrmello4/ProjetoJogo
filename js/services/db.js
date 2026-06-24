const DB_NAME = 'MMAManagerDB';
const DB_VERSION = 4;

export class DB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        const oldVersion = e.oldVersion;

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

        // v2: rivalries store
        if (oldVersion < 2 && !db.objectStoreNames.contains('rivalries')) {
          const rivalryStore = db.createObjectStore('rivalries', { keyPath: 'id' });
          rivalryStore.createIndex('fighterAId', 'fighterAId');
          rivalryStore.createIndex('fighterBId', 'fighterBId');
          rivalryStore.createIndex('active', 'active');
        }

        // v3: hallOfFame store
        if (oldVersion < 3 && !db.objectStoreNames.contains('hallOfFame')) {
          db.createObjectStore('hallOfFame', { keyPath: 'id' });
        }

        // v4: gameState store
        if (oldVersion < 4 && !db.objectStoreNames.contains('gameState')) {
          db.createObjectStore('gameState', { keyPath: 'id' });
        }

        // v4: notifications store
        if (oldVersion < 4 && !db.objectStoreNames.contains('notifications')) {
          const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
          notifStore.createIndex('read', 'read');
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async add(storeName, data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
