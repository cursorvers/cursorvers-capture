"use client";

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import Link from "next/link";
import { idbGet } from "@/app/lib/idb";
import { getCurrentToken } from "@/app/lib/gis";
import { listFolderFiles, type HistoryEntry } from "@/app/lib/drive-history";
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

export default function HistoryPage(): JSX.Element {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folderMissing, setFolderMissing] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<DocType>>(new Set());
  const [showUnanalyzed, setShowUnanalyzed] = useState(true);

  const loadAll = useCallback(async () => {
    setError(null);
    setFolderMissing(false);
    setSignedOut(false);

    // 1. Render from IDB instantly (analyzed captures only).
    const local = await listAllCaptures().catch(() => []);
    const localEntries = local
      .slice()
      .sort((a, b) => (b.created_iso || "").localeCompare(a.created_iso || ""))
      .map(recordToEntry);
    setEntries(localEntries);
    setLoading(false);

    // 2. Sync Drive folder contents — now sees ALL files (drive.metadata.readonly).
    setSyncing(true);
    try {
      const folderRec = await idbGet<ConfigFolderRecord>("config", "folder_id");
      if (!folderRec?.value) {
        setFolderMissing(true);
        setSyncing(false);
        return;
      }
      const tok = await getCurrentToken();
      if (!tok) {
        setSignedOut(true);
        setSyncing(false);
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

      // Pull every file from every configured folder; dedupe by id.
      const seen = new Set<string>();
      const all: HistoryEntry[] = [];
      for (const f of folders) {
        try {
          const list = await listFolderFiles(f, tok, 200);
          for (const e of list) {
            if (seen.has(e.id)) continue;
            seen.add(e.id);
            all.push(e);
          }
        } catch (err) {
          console.warn(`list folder ${f} failed`, err);
        }
      }

      // Merge: prefer IDB analysis (richer) over Drive description parse,
      // but fall back to whatever the Drive description carries, and last
      // a null analysis = "未解析".
      const idbByFileId = new Map(local.map((r) => [r.file_id, r]));
      const merged = all
        .map<HistoryEntry>((e) => {
          const idbRec = idbByFileId.get(e.id);
          if (idbRec) {
            return { ...e, analysis: recordToEntry(idbRec).analysis };
          }
          const fromDesc = parseDescription(e.description);
          return { ...e, analysis: fromDesc };
        })
        .sort((a, b) => (b.createdTime || "").localeCompare(a.createdTime || ""));

      setEntries(merged);

      // Backfill IDB with Drive-side analysis we just discovered.
      for (const e of all) {
        if (idbByFileId.has(e.id)) continue;
        const a = parseDescription(e.description);
        if (!a) continue;
        const record = buildCaptureRecord({
          file_id: e.id,
          drive_name: e.name,
          drive_url: e.webViewLink,
          thumbnail_url: e.thumbnailLink,
          parent_id: undefined,
          analysis: a,
        });
        if (e.createdTime) record.created_iso = e.createdTime;
        await putCapture(record).catch(() => undefined);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      const a = e.analysis;
      const isAnalyzed = a !== null;
      if (!showUnanalyzed && !isAnalyzed) return false;
      if (activeFilters.size > 0) {
        if (!a) return false;
        if (!activeFilters.has(a.doc_type)) return false;
      }
      if (q) {
        const hay = [
          a?.comment,
          a?.extracted?.vendor,
          e.name,
          a?.extracted?.topic,
          a?.suggested_filename,
          a?.suggested_folder,
          ...(a?.extracted?.items ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, query, activeFilters, showUnanalyzed]);

  function toggleFilter(t: DocType): void {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  const unanalyzedCount = entries.filter((e) => !e.analysis).length;
  const analyzedCount = entries.length - unanalyzedCount;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 pt-6 pb-12">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[0.625rem] uppercase tracking-[0.18em] text-ink-400">
            HISTORY
          </p>
          <h1 className="mt-1 font-display text-[1.5rem] font-semibold tracking-tightest text-ink-50">
            撮影履歴
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading || syncing}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline bg-ink-800/60 px-3 text-[0.75rem] font-medium text-ink-200 transition hover:border-white/20 hover:bg-ink-800 disabled:opacity-50"
        >
          {syncing ? "同期中…" : "更新"}
        </button>
      </div>

      {folderMissing ? (
        <div className="rounded-2xl border border-hairline bg-ink-800/40 p-4">
          <p className="text-[0.8125rem] text-ink-200">
            まず保存先フォルダを設定してください。
          </p>
          <Link
            href="/settings"
            className="mt-2 inline-flex h-9 items-center rounded-full border border-accent/40 bg-accent/10 px-3 text-[0.75rem] font-medium text-accent-soft hover:bg-accent/20"
          >
            設定へ →
          </Link>
        </div>
      ) : signedOut ? (
        <div className="rounded-2xl border border-hairline bg-ink-800/40 p-4">
          <p className="text-[0.8125rem] text-ink-200">
            Google にサインインしてください。
          </p>
          <Link
            href="/"
            className="mt-2 inline-flex h-9 items-center rounded-full border border-accent/40 bg-accent/10 px-3 text-[0.75rem] font-medium text-accent-soft hover:bg-accent/20"
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
          className="h-11 w-full rounded-full border border-hairline bg-ink-800/60 px-4 text-[0.875rem] text-ink-50 placeholder:text-ink-500 focus:border-accent/60 focus:outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          {DOC_FILTERS.map((f) => {
            const active = activeFilters.has(f.type);
            return (
              <button
                key={f.type}
                type="button"
                onClick={() => toggleFilter(f.type)}
                className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[0.6875rem] font-medium transition ${
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
          {unanalyzedCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowUnanalyzed((v) => !v)}
              className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[0.6875rem] font-medium transition ${
                showUnanalyzed
                  ? "border-hairline bg-ink-800/40 text-ink-300 hover:bg-ink-800/60"
                  : "border-amber-400/40 bg-amber-400/10 text-amber-200"
              }`}
              title={showUnanalyzed ? "未解析を隠す" : "未解析を表示"}
            >
              <span>🔘</span>
              <span>未解析 {unanalyzedCount}</span>
            </button>
          ) : null}
          {activeFilters.size > 0 || query ? (
            <button
              type="button"
              onClick={() => {
                setActiveFilters(new Set());
                setQuery("");
              }}
              className="inline-flex h-7 items-center rounded-full border border-dashed border-hairline px-2.5 text-[0.6875rem] text-ink-400 hover:text-ink-200"
            >
              クリア
            </button>
          ) : null}
        </div>
        {query || activeFilters.size > 0 || !showUnanalyzed ? (
          <p className="text-[0.625rem] text-ink-500">
            {filtered.length} / {entries.length} 件表示 (解析済 {analyzedCount}、未解析 {unanalyzedCount})
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-[0.8125rem] text-red-200">
          {error}
          {error.toLowerCase().includes("403") || error.toLowerCase().includes("insufficient") ? (
            <p className="mt-2 text-[0.6875rem] text-red-300/70">
              新しい権限 (drive.metadata.readonly) が必要です。設定 → 再認可 で許可してください。
            </p>
          ) : null}
        </div>
      ) : null}

      {loading && entries.length === 0 ? (
        <ul className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-ink-800/40"
            />
          ))}
        </ul>
      ) : (
        <HistoryGrid entries={filtered} onSelect={setSelected} />
      )}

      <CaptureDetailSheet
        entry={selected}
        onClose={() => setSelected(null)}
        onRenamed={(fileId, newName) => {
          setEntries((prev) =>
            prev.map((e) => (e.id === fileId ? { ...e, name: newName } : e)),
          );
          setSelected((s) => (s && s.id === fileId ? { ...s, name: newName } : s));
        }}
        onDocTypeChanged={(fileId, docType) => {
          const apply = (e: HistoryEntry): HistoryEntry =>
            e.id === fileId && e.analysis
              ? { ...e, analysis: { ...e.analysis, doc_type: docType } }
              : e;
          setEntries((prev) => prev.map(apply));
          setSelected((s) => (s ? apply(s) : s));
        }}
      />
    </div>
  );
}
