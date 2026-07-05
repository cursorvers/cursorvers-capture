"use client";

import type { JSX } from "react";
import type { HistoryEntry } from "@/app/lib/drive-history";

type Props = {
  entries: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
};

const DOC_ICON: Record<string, string> = {
  receipt: "📄",
  memo: "📝",
  business_card: "💳",
  other: "📷",
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

function formatAmount(amount?: number, currency?: string): string | null {
  if (amount === undefined) return null;
  const c = currency || "JPY";
  if (c === "JPY") return `¥${amount.toLocaleString("ja-JP")}`;
  return `${c} ${amount.toLocaleString()}`;
}

export function HistoryGrid({ entries, onSelect }: Props): JSX.Element {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline bg-ink-800/30 px-5 py-12 text-center">
        <p className="text-[0.875rem] text-ink-300">まだ何も撮ってない</p>
        <p className="mt-1 text-[0.75rem] text-ink-400">ホームから 1 枚撮ってみよう</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map((e) => {
        const a = e.analysis;
        const icon = a ? DOC_ICON[a.doc_type] ?? "📷" : "📷";
        const amount = a ? formatAmount(a.extracted?.amount, a.extracted?.currency) : null;
        return (
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
                  <div className="flex h-full items-center justify-center text-[0.625rem] text-ink-500">
                    no preview
                  </div>
                )}
                <span className="absolute bottom-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-900/80 text-[0.6875rem]">
                  {icon}
                </span>
                {!a ? (
                  <span className="absolute left-1 top-1 inline-flex h-5 items-center rounded-full bg-ink-950/80 px-1.5 text-[0.5625rem] font-medium uppercase tracking-[0.12em] text-ink-300">
                    未解析
                  </span>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="line-clamp-2 text-[0.8125rem] leading-snug text-ink-100">
                  {a?.comment || e.name}
                </p>
                <div className="flex flex-wrap items-center gap-1 text-[0.625rem] text-ink-400">
                  <span>{relativeTime(e.createdTime)}</span>
                  {a?.extracted?.vendor ? (
                    <>
                      <span className="opacity-50">·</span>
                      <span className="truncate">🏬 {a.extracted.vendor}</span>
                    </>
                  ) : null}
                  {amount ? (
                    <>
                      <span className="opacity-50">·</span>
                      <span>💴 {amount}</span>
                    </>
                  ) : null}
                  {a?.suggested_folder ? (
                    <>
                      <span className="opacity-50">·</span>
                      <span className="truncate">📁 {a.suggested_folder}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
