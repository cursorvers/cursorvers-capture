/** Minimal IndexedDB wrapper (native API only). */

export type IdbStoreName =
  | "auth"
  | "uploadSessions"
  | "pendingUploads"
  | "config"
  | "shareHistory"
  | "captures";

const DB_NAME = "gdrive-uploader";
const DB_VERSION = 2;

function requireBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is not available during SSR");
  }
}

let dbInstance: IDBDatabase | null = null;

async function openDb(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  requireBrowser();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = (): void => {
      reject(req.error ?? new Error("Failed to open IndexedDB"));
    };
    req.onsuccess = (): void => {
      dbInstance = req.result;
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
      if (!db.objectStoreNames.contains("shareHistory")) {
        db.createObjectStore("shareHistory", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("captures")) {
        const captures = db.createObjectStore("captures", {
          keyPath: "file_id",
        });
        // Indexes for the Phase 9b search filter. Created here so we
        // don't need another upgrade-needed bump later.
        captures.createIndex("by_doc_type", "doc_type", { unique: false });
        captures.createIndex("by_created", "created_iso", { unique: false });
        captures.createIndex("by_vendor", "vendor", { unique: false });
        captures.createIndex("by_date", "date_iso", { unique: false });
        captures.createIndex("by_amount", "amount", { unique: false });
      }
    };
  });
}

export const db = {
  async getAll<T>(store: IdbStoreName): Promise<T[]> {
    const dbi = await openDb();
    return new Promise((resolve, reject) => {
      const tx = dbi.transaction(store, "readonly");
      const os = tx.objectStore(store);
      const g = os.getAll();
      g.onerror = (): void => {
        reject(g.error ?? new Error("db.getAll failed"));
      };
      g.onsuccess = (): void => {
        resolve((g.result as T[]) ?? []);
      };
    });
  },
  async get<T>(store: IdbStoreName, key: IDBValidKey): Promise<T | undefined> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const os = tx.objectStore(store);
      const g = os.get(key);
      g.onerror = (): void => {
        reject(g.error ?? new Error("db.get failed"));
      };
      g.onsuccess = (): void => {
        resolve(g.result as T | undefined);
      };
    });
  },

  async put<T>(store: IdbStoreName, value: T): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const os = tx.objectStore(store);
      const p = os.put(value);
      p.onerror = (): void => {
        reject(p.error ?? new Error("db.put failed"));
      };
      tx.oncomplete = (): void => resolve();
      tx.onerror = (): void => {
        reject(tx.error ?? new Error("db.put transaction failed"));
      };
    });
  },

  async delete(store: IdbStoreName, key: IDBValidKey): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const os = tx.objectStore(store);
      const d = os.delete(key);
      d.onerror = (): void => {
        reject(d.error ?? new Error("db.delete failed"));
      };
      tx.oncomplete = (): void => resolve();
      tx.onerror = (): void => {
        reject(tx.error ?? new Error("db.delete transaction failed"));
      };
    });
  },

  async all<T>(store: IdbStoreName): Promise<T[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const os = tx.objectStore(store);
      const g = os.getAll();
      g.onerror = (): void => {
        reject(g.error ?? new Error("db.all failed"));
      };
      g.onsuccess = (): void => {
        resolve(g.result as T[]);
      };
    });
  },
};


/** Thin helpers for modules that should not depend on the `db` object shape. */
export async function idbGet<T>(
  store: IdbStoreName,
  key: IDBValidKey,
): Promise<T | undefined> {
  return db.get<T>(store, key);
}

export async function idbPut<T>(
  store: IdbStoreName,
  value: T,
): Promise<void> {
  return db.put<T>(store, value);
}

export async function idbDelete(
  store: IdbStoreName,
  key: IDBValidKey,
): Promise<void> {
  return db.delete(store, key);
}

export async function idbClear(store: IdbStoreName): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    const c = os.clear();
    c.onerror = (): void => {
      reject(c.error ?? new Error("db.clear failed"));
    };
    tx.oncomplete = (): void => resolve();
    tx.onerror = (): void => {
      reject(tx.error ?? new Error("db.clear transaction failed"));
    };
  });
}
