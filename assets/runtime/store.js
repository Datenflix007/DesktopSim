// Winziger IndexedDB-Schlüssel/Wert-Speicher für Binärdaten (kompilierte Programme, SQLite-Dateien).
let dbPromise = null;
function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(Error('IndexedDB nicht verfügbar'));
      const req = indexedDB.open('desktopsim-binaries', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}
function tx(mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction('kv', mode), store = t.objectStore('kv'), req = fn(store);
    t.oncomplete = () => resolve(req?.result); t.onerror = () => reject(t.error);
  }));
}
export const idbGet = key => tx('readonly', s => s.get(key)).catch(() => undefined);
export const idbSet = (key, value) => tx('readwrite', s => s.put(value, key)).catch(() => undefined);
export const idbDel = key => tx('readwrite', s => s.delete(key)).catch(() => undefined);
export const idbKeys = () => tx('readonly', s => s.getAllKeys()).catch(() => []);
