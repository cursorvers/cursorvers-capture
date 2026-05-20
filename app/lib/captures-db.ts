// Local IndexedDB mirror of every Codex Secretary analysis. Drive itself
// stays the source of truth (description field), but mirroring into IDB
// gives us instant search/filter on /history without re-paging the Drive
// API. The mirror is populated:
//   - immediately after upload + AI analyze (page.tsx)
//   - on /history cold start, lazily backfilled from listFolderFiles
//     (Phase 9b)
//
// Schema is intentionally flat — IDB indexes don't traverse nested keys.

import type { CodexReply } from "./capture-analysis";
import { db, type IdbStoreName } from "./idb";

const STORE: IdbStoreName = "captures";

export type CaptureRecord = {
  file_id: string;
  drive_name: string;
  drive_url?: string;
  thumbnail_url?: string;
  created_iso: string;        // when the user captured (ISO)
  parent_id?: string;         // current Drive parent folder id
  doc_type: CodexReply["doc_type"];
  vendor?: string;
  amount?: number;
  currency?: string;
  date_iso?: string;
  topic?: string;
  items?: string[];
  comment: string;
  confidence: number;
  suggested_filename: string;
  suggested_folder: string;
  routed_to?: string;         // target folder id if auto-routed
  routed_at?: string;         // ISO when routed
};

export async function putCapture(record: CaptureRecord): Promise<void> {
  await db.put(STORE, record);
}

export async function getCapture(file_id: string): Promise<CaptureRecord | undefined> {
  return db.get<CaptureRecord>(STORE, file_id);
}

export async function deleteCapture(file_id: string): Promise<void> {
  await db.delete(STORE, file_id);
}

export async function listAllCaptures(): Promise<CaptureRecord[]> {
  return db.getAll<CaptureRecord>(STORE);
}

export function buildCaptureRecord(opts: {
  file_id: string;
  drive_name: string;
  drive_url?: string;
  thumbnail_url?: string;
  parent_id?: string;
  analysis: CodexReply;
  routed_to?: string;
}): CaptureRecord {
  const a = opts.analysis;
  return {
    file_id: opts.file_id,
    drive_name: opts.drive_name,
    drive_url: opts.drive_url,
    thumbnail_url: opts.thumbnail_url,
    created_iso: new Date().toISOString(),
    parent_id: opts.parent_id,
    doc_type: a.doc_type,
    vendor: a.extracted.vendor,
    amount: a.extracted.amount,
    currency: a.extracted.currency,
    date_iso: a.extracted.date_iso,
    topic: a.extracted.topic,
    items: a.extracted.items,
    comment: a.comment,
    confidence: a.confidence,
    suggested_filename: a.suggested_filename,
    suggested_folder: a.suggested_folder,
    routed_to: opts.routed_to,
    routed_at: opts.routed_to ? new Date().toISOString() : undefined,
  };
}
