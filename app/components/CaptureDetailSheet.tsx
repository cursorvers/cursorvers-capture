"use client";

import { useEffect, type JSX } from "react";
import type { HistoryEntry } from "@/app/lib/drive-history";

type Props = {
  entry: HistoryEntry | null;
  onClose: () => void;
};

const DOC_BADGE: Record<string, { label: string; tone: string }> = {
  receipt: { label: "📄 領収書", tone: "border-amber-400/40 bg-amber-400/10 text-amber-200" },
  memo: { label: "📝 メモ", tone: "border-sky-400/40 bg-sky-400/10 text-sky-200" },
  business_card: { label: "💳 名刺", tone: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" },
  other: { label: "📷 その他", tone: "border-hairline bg-ink-800/60 text-ink-300" },
};

function formatAmount(amount?: number, currency?: string): string | null {
  if (amount === undefined) return null;
  const c = currency || "JPY";
  if (c === "JPY") return `¥${amount.toLocaleString("ja-JP")}`;
  return `${c} ${amount.toLocaleString()}`;
}

function CodexAvatar(): JSX.Element {
  return (
    <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-accent/30 blur-md" />
      <span className="absolute inset-0 rounded-full border border-accent/40 bg-gradient-to-br from-accent/40 to-accent/10" />
      <span className="relative text-[11px] font-semibold tracking-tight text-ink-50">
        cdx
      </span>
    </span>
  );
}

export function CaptureDetailSheet({ entry, onClose }: Props): JSX.Element | null {
  useEffect(() => {
    if (!entry) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [entry, onClose]);

  if (!entry) return null;
  const a = entry.analysis;
  const badge = a ? DOC_BADGE[a.doc_type] ?? DOC_BADGE.other : null;
  const amount = a ? formatAmount(a.extracted?.amount, a.extracted?.currency) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-hairline bg-ink-900/95 p-5 shadow-card sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-ink-300 transition hover:bg-white/5 hover:text-white"
        >
          ✕
        </button>

        {entry.thumbnailLink ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={entry.thumbnailLink}
            alt={entry.name}
            referrerPolicy="no-referrer"
            className="max-h-[55vh] w-full rounded-2xl object-contain bg-ink-900"
          />
        ) : null}

        <div className="mt-4 space-y-3">
          {a ? (
            <div className="flex items-start gap-2.5">
              <CodexAvatar />
              <div className="flex-1 space-y-2">
                <div className="rounded-2xl rounded-tl-md border border-hairline bg-ink-800/40 px-4 py-3">
                  <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-50">
                    {a.comment}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {badge ? (
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.tone}`}>
                      {badge.label}
                    </span>
                  ) : null}
                  {a.extracted?.vendor ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-800/60 px-2 py-0.5 text-[11px] text-ink-100">
                      🏬 {a.extracted.vendor}
                    </span>
                  ) : null}
                  {amount ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-800/60 px-2 py-0.5 text-[11px] font-medium text-ink-100">
                      💴 {amount}
                    </span>
                  ) : null}
                  {a.extracted?.date_iso ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-800/60 px-2 py-0.5 text-[11px] text-ink-100">
                      🗓 {a.extracted.date_iso}
                    </span>
                  ) : null}
                  {a.suggested_folder ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-900/60 px-2 py-0.5 text-[11px] text-ink-300">
                      📁 {a.suggested_folder}
                    </span>
                  ) : null}
                </div>
                {a.extracted?.items && a.extracted.items.length > 0 ? (
                  <ul className="rounded-xl border border-hairline bg-ink-800/30 px-4 py-3 text-[12px] leading-relaxed text-ink-100">
                    {a.extracted.items.map((item, i) => (
                      <li key={i} className="list-inside list-disc">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-ink-300">
              この写真には Codex の記録がありません
            </p>
          )}

          <p className="text-[11px] text-ink-400">{entry.name}</p>
          {entry.webViewLink ? (
            <a
              href={entry.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 w-full items-center justify-center rounded-full border border-accent/40 bg-accent/10 px-4 text-[13px] font-medium text-accent-soft transition hover:bg-accent/20"
            >
              Drive で開く ↗
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
