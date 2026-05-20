"use client";

import { useCallback, useEffect, useState, type JSX } from "react";
import Link from "next/link";
import { idbGet } from "@/app/lib/idb";
import { getCurrentToken } from "@/app/lib/gis";
import { listFolderFiles, type HistoryEntry } from "@/app/lib/drive-history";
import { HistoryGrid } from "@/app/components/HistoryGrid";
import { CaptureDetailSheet } from "@/app/components/CaptureDetailSheet";

type ConfigFolderRecord = { key: "folder_id"; value: string };

export default function HistoryPage(): JSX.Element {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [folderMissing, setFolderMissing] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFolderMissing(false);
    setSignedOut(false);
    try {
      const folder = await idbGet<ConfigFolderRecord>("config", "folder_id");
      if (!folder?.value) {
        setFolderMissing(true);
        setEntries([]);
        return;
      }
      const tok = await getCurrentToken();
      if (!tok) {
        setSignedOut(true);
        setEntries([]);
        return;
      }
      const list = await listFolderFiles(folder.value, tok, 50);
      setEntries(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-5 pt-6 pb-12">
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
          onClick={() => void fetchEntries()}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline bg-ink-800/60 px-3 text-[12px] font-medium text-ink-200 transition hover:border-white/20 hover:bg-ink-800"
          disabled={loading}
        >
          {loading ? "更新中…" : "更新"}
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
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-[13px] text-red-200">
          {error}
        </div>
      ) : entries === null || loading ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="aspect-[4/3] animate-pulse rounded-2xl bg-ink-800/40"
            />
          ))}
        </ul>
      ) : (
        <HistoryGrid entries={entries} onSelect={setSelected} />
      )}

      <CaptureDetailSheet entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
