"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
} from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { idbGet, idbPut } from "@/app/lib/idb";
import {
  listFolderFiles,
  aggregateMonthlyStats,
  summarizeCurrentMonth,
  filterFilesByKeyword,
  type DriveFile,
} from "@/app/lib/insights";

type ConfigFolderRecord = { key: "folder_id"; value: string };

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function InsightsPageContent(): JSX.Element {
  const searchParams = useSearchParams();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const folderParam = searchParams.get("folder")?.trim() ?? "";

      if (folderParam) {
        if (!cancelled) {
          setFolderId(folderParam);
        }
        void (async () => {
          const existing = await idbGet<ConfigFolderRecord>("config", "folder_id");
          if (existing?.value !== folderParam) {
            await idbPut<ConfigFolderRecord>("config", {
              key: "folder_id",
              value: folderParam,
            });
          }
        })();
      } else {
        void (async () => {
          const existing = await idbGet<ConfigFolderRecord>("config", "folder_id");
          if (!cancelled) {
            setFolderId(existing?.value ?? null);
          }
        })();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const loadFiles = useCallback(async () => {
    if (!folderId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listFolderFiles(folderId);
      setFiles(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    if (!folderId) {
      return;
    }
    void loadFiles();
  }, [folderId, loadFiles]);

  const monthly = useMemo(() => aggregateMonthlyStats(files, 6), [files]);
  const currentSummary = useMemo(() => summarizeCurrentMonth(files), [files]);
  const filtered = useMemo(
    () => filterFilesByKeyword(files, keyword),
    [files, keyword],
  );

  const maxCount = useMemo(
    () => monthly.reduce((m, x) => Math.max(m, x.count), 1),
    [monthly],
  );

  return (
    <div className="mx-auto flex min-h-[calc(100vh-theme(spacing.16))] max-w-lg flex-col gap-4 bg-navy-900 p-6 text-gray-100">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-orange-400">📊 振り返り</h1>
        <p className="mt-1 text-sm text-gray-400">
          フォルダ内ファイルの件数・サイズをざっくり確認
        </p>
      </div>

      {!folderId ? (
        <div className="rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-200">
          <p className="font-semibold">フォルダ ID が未設定です。</p>
          <p className="mt-1 text-xs">
            <Link href="/" className="text-orange-400 underline">
              ホーム
            </Link>
            でフォルダを設定するか、<code className="rounded bg-black/30 px-1">?folder=</code>{" "}
            を付けて開いてください。
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-200">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadFiles()}
            className="mt-3 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-black hover:bg-orange-400"
          >
            再読み込み
          </button>
        </div>
      ) : null}

      {folderId ? (
        <>
          <section className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
            <h2 className="text-sm font-semibold text-orange-300">今月のサマリー</h2>
            <p className="mt-2 text-sm text-gray-300">
              件数:{" "}
              <span className="font-mono text-white">{currentSummary.count}</span>
            </p>
            <p className="mt-1 text-sm text-gray-300">
              合計サイズ:{" "}
              <span className="font-mono text-white">
                {formatBytes(currentSummary.totalBytes)}
              </span>
            </p>
          </section>

          <section className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold text-orange-300">
              過去6ヶ月のアップロード件数
            </h2>
            <div className="flex h-40 items-end gap-2">
              {monthly.map((m) => (
                <div
                  key={m.yearMonth}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                >
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-orange-600 to-orange-400 transition-all"
                    style={{
                      height: `${Math.max(8, (m.count / maxCount) * 100)}%`,
                      minHeight: m.count === 0 ? "4px" : undefined,
                    }}
                    title={`${m.yearMonth}: ${m.count} 件`}
                  />
                  <span className="text-[10px] text-gray-500">
                    {m.yearMonth.slice(5)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              棒の高さは件数の相対比（CSS のみ）
            </p>
          </section>

          <section className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-4">
            <h2 className="mb-2 text-sm font-semibold text-orange-300">
              キーワード検索
            </h2>
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="ファイル名やメタデータで絞り込み"
              className="w-full rounded-md border border-neutral-600 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
            />
            <p className="mt-2 text-xs text-gray-500">
              ヒット {filtered.length} / {files.length} 件
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-left text-xs">
              {filtered.slice(0, 50).map((f) => (
                <li
                  key={f.id}
                  className="truncate rounded border border-neutral-800 bg-neutral-950/50 px-2 py-1 font-mono text-neutral-300"
                >
                  {f.name}
                </li>
              ))}
            </ul>
          </section>

          <div className="flex justify-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadFiles()}
              className="rounded-lg border border-neutral-600 px-4 py-2 text-sm text-gray-200 hover:border-orange-500 hover:text-white disabled:opacity-50"
            >
              {loading ? "読み込み中…" : "Drive から再取得"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function InsightsPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-theme(spacing.16))] items-center justify-center bg-navy-900 text-gray-400">
          読み込み中…
        </div>
      }
    >
      <InsightsPageContent />
    </Suspense>
  );
}
