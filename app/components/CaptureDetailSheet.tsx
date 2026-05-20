"use client";

import { useEffect, type JSX } from "react";
import type { HistoryEntry } from "@/app/lib/drive-history";

type Props = {
  entry: HistoryEntry | null;
  onClose: () => void;
};

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
            className="max-h-[50vh] w-full rounded-2xl object-contain bg-ink-900"
          />
        ) : null}

        <div className="mt-4 space-y-3">
          {entry.analysis ? (
            <>
              <p className="text-[15px] font-semibold leading-snug text-ink-50">
                {entry.analysis.summary}
              </p>
              {entry.analysis.suggested_tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {entry.analysis.suggested_tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex rounded-full border border-hairline bg-ink-800/60 px-2 py-0.5 text-[11px] text-ink-200"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
              {entry.analysis.ocr_text ? (
                <details className="rounded-xl border border-hairline bg-ink-800/30">
                  <summary className="cursor-pointer px-4 py-2.5 text-[12px] font-medium text-ink-300 marker:text-ink-500">
                    OCR テキスト
                  </summary>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-hairline px-4 py-3 text-[12px] leading-relaxed text-ink-100">
                    {entry.analysis.ocr_text}
                  </pre>
                </details>
              ) : null}
              {entry.analysis.audio_transcript ? (
                <details className="rounded-xl border border-hairline bg-ink-800/30">
                  <summary className="cursor-pointer px-4 py-2.5 text-[12px] font-medium text-ink-300 marker:text-ink-500">
                    音声書き起こし
                  </summary>
                  <p className="border-t border-hairline px-4 py-3 text-[12px] leading-relaxed text-ink-100">
                    {entry.analysis.audio_transcript}
                  </p>
                </details>
              ) : null}
            </>
          ) : (
            <p className="text-[13px] text-ink-300">AI 解析データなし</p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <p className="text-[11px] text-ink-400">{entry.name}</p>
          </div>
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
