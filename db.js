const DB_NAME = 'SmartwatchDB';
const DB_VERSION = 2; // Incremented version to support settings

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('alarms')) {
        db.createObjectStore('alarms', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('diary')) {
        db.createObjectStore('diary', { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains('events')) {
        db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Helper to run a transaction
 */
async function runTransaction(storeName, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    
    let result;
    try {
      result = callback(store);
    } catch (err) {
      reject(err);
      return;
    }

    if (result && typeof result.onsuccess !== 'undefined') {
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error);
    } else {
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = (e) => reject(e.target.error);
    }
  });
}

// ===== API =====
export const dbApp = {
  // Alarms
  async saveAlarm(id, data) {
    return runTransaction('alarms', 'readwrite', (store) => store.put({ id, ...data }));
  },
  async getAlarm(id) {
    return runTransaction('alarms', 'readonly', (store) => store.get(id));
  },
  async getAllAlarms() {
    return runTransaction('alarms', 'readonly', (store) => store.getAll());
  },
  async deleteAlarm(id) {
    return runTransaction('alarms', 'readwrite', (store) => store.delete(id));
  },

  // Diary
  async saveDiary(date, text) {
    return runTransaction('diary', 'readwrite', (store) => store.put({ date, text }));
  },
  async getDiary(date) {
    return runTransaction('diary', 'readonly', (store) => store.get(date));
  },

  // Events
  async addEvent(eventData) {
    return runTransaction('events', 'readwrite', (store) => store.add(eventData));
  },
  async updateEvent(id, eventData) {
    return runTransaction('events', 'readwrite', (store) => store.put({ ...eventData, id }));
  },
  async deleteEvent(id) {
    return runTransaction('events', 'readwrite', (store) => store.delete(id));
  },
  async getAllEvents() {
    return runTransaction('events', 'readonly', (store) => store.getAll());
  },
  
  // Settings (Custom Sound)
  async saveSetting(id, value) {
    return runTransaction('settings', 'readwrite', (store) => store.put({ id, value }));
  },
  async getSetting(id) {
    const setting = await runTransaction('settings', 'readonly', (store) => store.get(id));
    return setting ? setting.value : null;
  }
};
