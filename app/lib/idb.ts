/** Minimal IndexedDB wrapper (native API only). */

export type IdbStoreName =
  | "auth"
  | "uploadSessions"
  | "pendingUploads"
  | "config";

const DB_NAME = "gdrive-uploader";
const DB_VERSION = 1;

function requireBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is not available during SSR");
  }
}

function openDb(): Promise<IDBDatabase> {
  requireBrowser();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = (): void => {
      reject(req.error ?? new Error("Failed to open IndexedDB"));
    };
    req.onsuccess = (): void => {
      resolve(req.result);
    };
    req.onupgradeneeded = (): void => {
      const db = req.result;
      if (!db.objectStoreNames.contains("auth")) {
        db.createObjectStore("auth", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("uploadSessions")) {
        db.createObjectStore("uploadSessions", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("pendingUploads")) {
        db.createObjectStore("pendingUploads", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("config")) {
        db.createObjectStore("config", { keyPath: "key" });
      }
    };
  });
}

export async function idbGet<T>(
  store: IdbStoreName,
  key: IDBValidKey,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const os = tx.objectStore(store);
    const g = os.get(key);
    g.onerror = (): void => {
      reject(g.error ?? new Error("idbGet failed"));
    };
    g.onsuccess = (): void => {
      resolve(g.result as T | undefined);
    };
  });
}

export async function idbPut<T>(
  store: IdbStoreName,
  value: T,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    const p = os.put(value);
    p.onerror = (): void => {
      reject(p.error ?? new Error("idbPut failed"));
    };
    tx.oncomplete = (): void => resolve();
    tx.onerror = (): void => {
      reject(tx.error ?? new Error("idbPut transaction failed"));
    };
  });
}

export async function idbDelete(
  store: IdbStoreName,
  key: IDBValidKey,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    const d = os.delete(key);
    d.onerror = (): void => {
      reject(d.error ?? new Error("idbDelete failed"));
    };
    tx.oncomplete = (): void => resolve();
    tx.onerror = (): void => {
      reject(tx.error ?? new Error("idbDelete transaction failed"));
    };
  });
}

export async function idbAll<T>(store: IdbStoreName): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const os = tx.objectStore(store);
    const g = os.getAll();
    g.onerror = (): void => {
      reject(g.error ?? new Error("idbAll failed"));
    };
    g.onsuccess = (): void => {
      resolve(g.result as T[]);
    };
  });
}
