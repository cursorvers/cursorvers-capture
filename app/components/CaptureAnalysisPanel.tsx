"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import type { CodexReply } from "@/app/lib/capture-analysis";

type Props = {
  state: "idle" | "loading" | "ready" | "error";
  analysis: CodexReply | null;
  error?: string | null;
  driveUrl?: string;
};

// Codex avatar — soft glowing orb + ":)" mark. SVG so it scales crisply
// and tints with the accent color.
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

function useTypewriter(text: string, speed = 18): string {
  const [out, setOut] = useState("");
  const idx = useRef(0);
  useEffect(() => {
    idx.current = 0;
    setOut("");
    if (!text) return;
    const iv = setInterval(() => {
      idx.current += 1;
      setOut(text.slice(0, idx.current));
      if (idx.current >= text.length) clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return out;
}

function ThinkingDots(): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400 [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400 [animation-delay:240ms]" />
    </span>
  );
}

export function CaptureAnalysisPanel({
  state,
  analysis,
  error,
  driveUrl,
}: Props): JSX.Element | null {
  const typed = useTypewriter(analysis?.comment ?? "");

  if (state === "idle") return null;

  if (state === "loading") {
    return (
      <div className="flex items-start gap-2.5">
        <CodexAvatar />
        <div className="rounded-2xl rounded-tl-md border border-hairline bg-ink-800/50 px-3.5 py-2.5">
          <ThinkingDots />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-start gap-2.5">
        <CodexAvatar />
        <div className="rounded-2xl rounded-tl-md border border-red-500/30 bg-red-500/5 px-3.5 py-2.5 text-[13px] text-red-200">
          <p>うまく見えなかった…ごめん。</p>
          {error ? (
            <p className="mt-1 text-[11px] text-red-300/70">{error}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!analysis) return null;
  const showCursor = typed.length < (analysis.comment?.length ?? 0);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <CodexAvatar />
        <div className="flex-1 space-y-2">
          <div className="rounded-2xl rounded-tl-md border border-hairline bg-gradient-to-br from-ink-800/70 to-ink-900/40 px-4 py-3 shadow-card">
            <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink-50">
              {typed}
              {showCursor ? (
                <span className="ml-0.5 inline-block h-[1.05em] w-[2px] -translate-y-0.5 animate-pulse bg-accent align-middle" />
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {analysis.emoji ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] text-accent-soft">
                <span>{analysis.emoji}</span>
                {analysis.mood ? <span>{analysis.mood}</span> : null}
              </span>
            ) : null}
            {analysis.album ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-900/60 px-2 py-0.5 text-[11px] text-ink-200">
                <span aria-hidden>📁</span>
                <span>{analysis.album}</span>
              </span>
            ) : null}
            {driveUrl ? (
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-[11px] font-medium text-ink-300 underline-offset-4 hover:text-accent-soft hover:underline"
              >
                Drive で開く ↗
              </a>
            ) : null}
          </div>

          {analysis.followups.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {analysis.followups.slice(0, 2).map((q) => (
                <span
                  key={q}
                  className="inline-flex rounded-full border border-dashed border-hairline px-2.5 py-1 text-[11px] text-ink-300"
                  title="次に Codex が聞いてきそうな質問"
                >
                  {q}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
