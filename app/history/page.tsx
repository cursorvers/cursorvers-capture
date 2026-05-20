"use client";

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import Link from "next/link";
import { idbGet } from "@/app/lib/idb";
import { getCurrentToken } from "@/app/lib/gis";
import { listFolderFiles } from "@/app/lib/drive-history";
import {
  buildCaptureRecord,
  listAllCaptures,
  putCapture,
  type CaptureRecord,
} from "@/app/lib/captures-db";
import { parseDescription } from "@/app/lib/capture-analysis";
import { getRouting } from "@/app/lib/doc-routing";
import { HistoryGrid } from "@/app/components/HistoryGrid";
import { CaptureDetailSheet } from "@/app/components/CaptureDetailSheet";
import type { HistoryEntry } from "@/app/lib/drive-history";

type ConfigFolderRecord = { key: "folder_id"; value: string };

type DocType = CaptureRecord["doc_type"];

const DOC_FILTERS: { type: DocType; label: string; icon: string }[] = [
  { type: "receipt", label: "領収書", icon: "📄" },
  { type: "memo", label: "メモ", icon: "📝" },
  { type: "business_card", label: "名刺", icon: "💳" },
  { type: "other", label: "その他", icon: "📷" },
];

function recordToEntry(c: CaptureRecord): HistoryEntry {
  return {
    id: c.file_id,
    name: c.drive_name,
    mimeType: "image/jpeg",
    createdTime: c.created_iso,
    thumbnailLink: c.thumbnail_url,
    webViewLink: c.drive_url,
    description: undefined,
    analysis: {
      comment: c.comment,
      doc_type: c.doc_type,
      extracted: {
        vendor: c.vendor,
        amount: c.amount,
        currency: c.currency,
        date_iso: c.date_iso,
        topic: c.topic,
        items: c.items,
      },
      suggested_filename: c.suggested_filename,
      suggested_folder: c.suggested_folder,
      confidence: c.confidence,
    },
  };
}

async function backfillFromFolders(
  accessToken: string,
  folders: string[],
  existing: Set<string>,
): Promise<CaptureRecord[]> {
  const added: CaptureRecord[] = [];
  for (const folder of folders) {
    if (!folder) continue;
    try {
      const list = await listFolderFiles(folder, accessToken, 100);
      for (const entry of list) {
        if (existing.has(entry.id)) continue;
        const a = entry.analysis ?? parseDescription(entry.description);
        if (!a) continue; // unanalyzed file — skip backfill
        const record = buildCaptureRecord({
          file_id: entry.id,
          drive_name: entry.name,
          drive_url: entry.webViewLink,
          thumbnail_url: entry.thumbnailLink,
          parent_id: folder,
          analysis: a,
          routed_to: folder, // best guess
        });
        // Preserve original createdTime for sort fidelity.
        record.created_iso = entry.createdTime || record.created_iso;
        await putCapture(record);
        added.push(record);
        existing.add(entry.id);
      }
    } catch (err) {
      console.warn(`backfill folder ${folder} failed`, err);
    }
  }
  return added;
}

export default function HistoryPage(): JSX.Element {
  const [records, setRecords] = useState<CaptureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folderMissing, setFolderMissing] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<DocType>>(new Set());

  const loadAll = useCallback(async () => {
    setError(null);
    setFolderMissing(false);
    setSignedOut(false);

    // 1. Read from IDB first → instant render.
    const local = await listAllCaptures().catch(() => []);
    setRecords(local);
    setLoading(false);

    // 2. Background backfill from Drive folders we know about.
    setBackfilling(true);
    try {
      const folderRec = await idbGet<ConfigFolderRecord>("config", "folder_id");
      if (!folderRec?.value) {
        setFolderMissing(true);
        setBackfilling(false);
        return;
      }
      const tok = await getCurrentToken();
      if (!tok) {
        setSignedOut(true);
        setBackfilling(false);
        return;
      }

      const routing = await getRouting();
      const folders = [
        folderRec.value,
        routing.receipt,
        routing.memo,
        routing.business_card,
        routing.other,
      ].filter((s): s is string => !!s);

      const existing = new Set(local.map((r) => r.file_id));
      const added = await backfillFromFolders(tok, folders, existing);
      if (added.length > 0) {
        const fresh = await listAllCaptures();
        setRecords(fresh);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBackfilling(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records
      .filter((c) => {
        if (activeFilters.size > 0 && !activeFilters.has(c.doc_type)) {
          return false;
        }
        if (q) {
          const hay = [
            c.comment,
            c.vendor,
            c.drive_name,
            c.topic,
            c.suggested_filename,
            c.suggested_folder,
            ...(c.items ?? []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.created_iso || "").localeCompare(a.created_iso || ""));
  }, [records, query, activeFilters]);

  function toggleFilter(t: DocType): void {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 pt-6 pb-12">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
            HISTORY
          </p>
          <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tightest text-ink-50">
            撮影履歴
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading || backfilling}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline bg-ink-800/60 px-3 text-[12px] font-medium text-ink-200 transition hover:border-white/20 hover:bg-ink-800 disabled:opacity-50"
        >
          {backfilling ? "同期中…" : "更新"}
        </button>
      </div>

      {folderMissing ? (
        <div className="rounded-2xl border border-hairline bg-ink-800/40 p-4">
          <p className="text-[13px] text-ink-200">
            まず保存先フォルダを設定してください。
          </p>
          <Link
            href="/settings"
            className="mt-2 inline-flex h-9 items-center rounded-full border border-accent/40 bg-accent/10 px-3 text-[12px] font-medium text-accent-soft hover:bg-accent/20"
          >
            設定へ →
          </Link>
        </div>
      ) : signedOut ? (
        <div className="rounded-2xl border border-hairline bg-ink-800/40 p-4">
          <p className="text-[13px] text-ink-200">
            Google にサインインしてください。
          </p>
          <Link
            href="/"
            className="mt-2 inline-flex h-9 items-center rounded-full border border-accent/40 bg-accent/10 px-3 text-[12px] font-medium text-accent-soft hover:bg-accent/20"
          >
            ホームへ →
          </Link>
        </div>
      ) : null}

      {/* Search + filter */}
      <div className="flex flex-col gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔎 店名・金額・日付・キーワード"
          enterKeyHint="search"
          autoComplete="off"
          className="h-11 w-full rounded-full border border-hairline bg-ink-800/60 px-4 text-[14px] text-ink-50 placeholder:text-ink-500 focus:border-accent/60 focus:outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          {DOC_FILTERS.map((f) => {
            const active = activeFilters.has(f.type);
            return (
              <button
                key={f.type}
                type="button"
                onClick={() => toggleFilter(f.type)}
                className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition ${
                  active
                    ? "border-accent/50 bg-accent/15 text-accent-soft"
                    : "border-hairline bg-ink-800/40 text-ink-300 hover:bg-ink-800/60"
                }`}
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </button>
            );
          })}
          {activeFilters.size > 0 || query ? (
            <button
              type="button"
              onClick={() => {
                setActiveFilters(new Set());
                setQuery("");
              }}
              className="inline-flex h-7 items-center rounded-full border border-dashed border-hairline px-2.5 text-[11px] text-ink-400 hover:text-ink-200"
            >
              クリア
            </button>
          ) : null}
        </div>
        {query || activeFilters.size > 0 ? (
          <p className="text-[10px] text-ink-500">
            {filtered.length} / {records.length} 件表示
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-[13px] text-red-200">
          {error}
        </div>
      ) : null}

      {loading && records.length === 0 ? (
        <ul className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-ink-800/40"
            />
          ))}
        </ul>
      ) : (
        <HistoryGrid
          entries={filtered.map(recordToEntry)}
          onSelect={setSelected}
        />
      )}

      <CaptureDetailSheet
        entry={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
