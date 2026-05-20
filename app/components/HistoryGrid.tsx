"use client";

import type { JSX } from "react";
import type { HistoryEntry } from "@/app/lib/drive-history";

type Props = {
  entries: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
};

function relativeTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 時間前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 日前`;
  return d.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });
}

export function HistoryGrid({ entries, onSelect }: Props): JSX.Element {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline bg-ink-800/30 px-5 py-12 text-center">
        <p className="text-[14px] text-ink-300">まだ撮影はありません</p>
        <p className="mt-1 text-[12px] text-ink-400">
          ホームに戻って 1 枚撮ってみてください
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {entries.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={() => onSelect(e)}
            className="group flex w-full flex-col overflow-hidden rounded-2xl border border-hairline bg-ink-800/40 text-left transition active:scale-[0.98] hover:border-white/20 hover:bg-ink-800/60"
          >
            <div className="relative aspect-[4/3] w-full bg-ink-900/60">
              {e.thumbnailLink ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={e.thumbnailLink}
                  alt={e.name}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[11px] text-ink-500">
                  no preview
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 px-3 py-2.5">
              <p className="line-clamp-2 text-[12px] font-medium leading-tight text-ink-100">
                {e.analysis?.summary || e.name}
              </p>
              <p className="text-[10px] text-ink-400">
                {relativeTime(e.createdTime)}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
