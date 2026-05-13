/** IndexedDB for Advisory chat history (separate from main `gdrive-uploader` DB). */

export type AdvisoryChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AdvisoryHistoryRecord = {
  chatgpt_user_id: string;
  messages: AdvisoryChatMessage[];
};

const DB_NAME = "gdrive-uploader-advisory";
const DB_VERSION = 1;
const STORE_NAME = "advisoryHistory";

let dbInstance: IDBDatabase | null = null;

function requireBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("advisory IDB is not available during SSR");
  }
}

async function openAdvisoryDb(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  requireBrowser();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = (): void => {
      reject(req.error ?? new Error("Failed to open advisory IndexedDB"));
    };
    req.onsuccess = (): void => {
      dbInstance = req.result;
      resolve(req.result);
    };
    req.onupgradeneeded = (): void => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "chatgpt_user_id" });
      }
    };
  });
}

export async function loadAdvisoryHistory(
  chatgpt_user_id: string,
): Promise<AdvisoryChatMessage[]> {
  const db = await openAdvisoryDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const os = tx.objectStore(STORE_NAME);
    const g = os.get(chatgpt_user_id);
    g.onerror = (): void => {
      reject(g.error ?? new Error("loadAdvisoryHistory failed"));
    };
    g.onsuccess = (): void => {
      const row = g.result as AdvisoryHistoryRecord | undefined;
      resolve(row?.messages ?? []);
    };
  });
}

export async function saveAdvisoryHistory(
  chatgpt_user_id: string,
  messages: AdvisoryChatMessage[],
): Promise<void> {
  const db = await openAdvisoryDb();
  const record: AdvisoryHistoryRecord = { chatgpt_user_id, messages };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const os = tx.objectStore(STORE_NAME);
    const p = os.put(record);
    p.onerror = (): void => {
      reject(p.error ?? new Error("saveAdvisoryHistory failed"));
    };
    tx.oncomplete = (): void => resolve();
    tx.onerror = (): void => {
      reject(tx.error ?? new Error("saveAdvisoryHistory transaction failed"));
    };
  });
}
