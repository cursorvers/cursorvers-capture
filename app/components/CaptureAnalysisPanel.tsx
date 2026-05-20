"use client";

import { useState, type JSX } from "react";
import type { CaptureAnalysis } from "@/app/lib/capture-analysis";

type Props = {
  state: "idle" | "loading" | "ready" | "error";
  analysis: CaptureAnalysis | null;
  error?: string | null;
  driveUrl?: string;
};

const CATEGORY_LABEL: Record<CaptureAnalysis["category"], string> = {
  medical: "医療",
  document: "文書",
  scene: "シーン",
  other: "その他",
};

const CATEGORY_TONE: Record<CaptureAnalysis["category"], string> = {
  medical: "border-accent/40 bg-accent/10 text-accent-soft",
  document: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  scene: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  other: "border-hairline bg-ink-800/60 text-ink-300",
};

export function CaptureAnalysisPanel({
  state,
  analysis,
  error,
  driveUrl,
}: Props): JSX.Element | null {
  const [showOcr, setShowOcr] = useState(false);
  const [showAudio, setShowAudio] = useState(false);

  if (state === "idle") return null;

  if (state === "loading") {
    return (
      <div className="rounded-2xl border border-hairline bg-ink-800/40 p-4">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <span className="text-[13px] font-medium text-ink-200">
            Gemini が解析中…
          </span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-ink-800" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-ink-800" />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-[13px] text-red-200">
        <p className="font-medium">AI 解析に失敗しました</p>
        <p className="mt-1 text-red-300/80">{error ?? "Unknown error"}</p>
      </div>
    );
  }

  // state === "ready"
  if (!analysis) return null;
  const hasOcr = analysis.ocr_text.trim().length > 0;
  const hasAudio = analysis.audio_transcript.trim().length > 0;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-hairline bg-gradient-to-br from-ink-800/70 to-ink-900/40 p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <span
            className={
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] " +
              CATEGORY_TONE[analysis.category]
            }
          >
            {CATEGORY_LABEL[analysis.category]}
          </span>
          {driveUrl ? (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-ink-300 underline-offset-4 hover:text-accent-soft hover:underline"
            >
              Drive で開く ↗
            </a>
          ) : null}
        </div>
        <p className="mt-2 text-[15px] font-semibold leading-snug text-ink-50">
          {analysis.summary}
        </p>
        {analysis.suggested_tags.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {analysis.suggested_tags.map((t) => (
              <span
                key={t}
                className="inline-flex rounded-full border border-hairline bg-ink-900/60 px-2 py-0.5 text-[11px] text-ink-200"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {hasOcr ? (
        <details
          open={showOcr}
          onToggle={(e) => setShowOcr((e.target as HTMLDetailsElement).open)}
          className="rounded-2xl border border-hairline bg-ink-800/30"
        >
          <summary className="cursor-pointer px-4 py-2.5 text-[12px] font-medium text-ink-300 marker:text-ink-500">
            OCR テキスト
          </summary>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-hairline px-4 py-3 text-[12px] leading-relaxed text-ink-100">
            {analysis.ocr_text}
          </pre>
        </details>
      ) : null}

      {hasAudio ? (
        <details
          open={showAudio}
          onToggle={(e) => setShowAudio((e.target as HTMLDetailsElement).open)}
          className="rounded-2xl border border-hairline bg-ink-800/30"
        >
          <summary className="cursor-pointer px-4 py-2.5 text-[12px] font-medium text-ink-300 marker:text-ink-500">
            音声書き起こし
          </summary>
          <p className="border-t border-hairline px-4 py-3 text-[12px] leading-relaxed text-ink-100">
            {analysis.audio_transcript}
          </p>
        </details>
      ) : null}
    </div>
  );
}
