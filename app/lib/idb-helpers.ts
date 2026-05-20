// Thin re-export so feature libs can keep using `idbGet` / `idbPut`
// while the underlying wrapper exposes `db.get` / `db.put`. Co-located
// with idb.ts so removing or renaming downstream doesn't break callers.

import { db, type IdbStoreName } from "./idb";

export async function idbGet<T>(
  store: IdbStoreName,
  key: IDBValidKey,
): Promise<T | undefined> {
  return db.get<T>(store, key);
}

export async function idbPut<T>(store: IdbStoreName, value: T): Promise<void> {
  return db.put<T>(store, value);
}

export async function idbDelete(
  store: IdbStoreName,
  key: IDBValidKey,
): Promise<void> {
  return db.delete(store, key);
}

export async function idbGetAll<T>(store: IdbStoreName): Promise<T[]> {
  return db.getAll<T>(store);
}
