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
  return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

export function HistoryGrid({ entries, onSelect }: Props): JSX.Element {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline bg-ink-800/30 px-5 py-12 text-center">
        <p className="text-[14px] text-ink-300">まだ何も撮ってない</p>
        <p className="mt-1 text-[12px] text-ink-400">
          ホームから 1 枚撮ってみよう
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={() => onSelect(e)}
            className="group flex w-full items-start gap-3 rounded-2xl border border-hairline bg-ink-800/40 p-3 text-left transition active:scale-[0.99] hover:border-white/20 hover:bg-ink-800/60"
          >
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink-900/60">
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
                <div className="flex h-full items-center justify-center text-[10px] text-ink-500">
                  no preview
                </div>
              )}
              {e.analysis?.emoji ? (
                <span className="absolute bottom-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-900/80 text-[11px]">
                  {e.analysis.emoji}
                </span>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="line-clamp-2 text-[13px] leading-snug text-ink-100">
                {e.analysis?.comment || e.name}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-ink-400">
                <span>{relativeTime(e.createdTime)}</span>
                {e.analysis?.album ? (
                  <>
                    <span className="opacity-50">·</span>
                    <span className="truncate">📁 {e.analysis.album}</span>
                  </>
                ) : null}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
