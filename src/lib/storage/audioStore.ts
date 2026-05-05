// IndexedDB store for audio bytes — keyed by draft id.
// Audio is multiple MB, so it can't live in localStorage.

const DB_NAME = 'yyedit';
const DB_VERSION = 1;
const STORE_AUDIO = 'audio';

export interface StoredAudio {
  id: string;
  filename: string;
  mime: string;
  bytes: ArrayBuffer;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// Read transactions resolve on the request's onsuccess (the value is what callers want and
// transaction completion adds nothing). Writes resolve on transaction.oncomplete so callers can
// trust durability — request.onsuccess fires before the transaction commits, so an earlier resolve
// would let callers chain dependent work that races the actual write.
function txRead<T>(fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE_AUDIO, 'readonly');
        const store = t.objectStore(STORE_AUDIO);
        const r = fn(store);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error ?? new Error('audio transaction aborted'));
      }),
  );
}

function txWrite(fn: (store: IDBObjectStore) => IDBRequest): Promise<void> {
  return open().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const t = db.transaction(STORE_AUDIO, 'readwrite');
        const store = t.objectStore(STORE_AUDIO);
        const r = fn(store);
        r.onerror = () => reject(r.error);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error ?? new Error('audio transaction aborted'));
      }),
  );
}

export async function putAudio(audio: StoredAudio): Promise<void> {
  await txWrite((s) => s.put(audio));
}

export async function getAudio(id: string): Promise<StoredAudio | undefined> {
  return txRead<StoredAudio | undefined>((s) => s.get(id) as IDBRequest<StoredAudio | undefined>);
}

export async function deleteAudio(id: string): Promise<void> {
  await txWrite((s) => s.delete(id));
}
