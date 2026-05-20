"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import type { CodexReply } from "@/app/lib/capture-analysis";
import { applyExtension, renameDriveFile } from "@/app/lib/capture-analysis";
import { getCurrentToken } from "@/app/lib/gis";

type Props = {
  state: "idle" | "loading" | "ready" | "error";
  analysis: CodexReply | null;
  error?: string | null;
  driveUrl?: string;
  driveFileId?: string | null;
  originalFilename?: string | null;
};

const DOC_BADGE: Record<CodexReply["doc_type"], { label: string; tone: string }> = {
  receipt: { label: "📄 領収書", tone: "border-amber-400/40 bg-amber-400/10 text-amber-200" },
  memo: { label: "📝 メモ", tone: "border-sky-400/40 bg-sky-400/10 text-sky-200" },
  business_card: { label: "💳 名刺", tone: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" },
  other: { label: "📷 その他", tone: "border-hairline bg-ink-800/60 text-ink-300" },
};

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

function formatAmount(amount: number | undefined, currency: string | undefined): string | null {
  if (amount === undefined) return null;
  const c = currency || "JPY";
  if (c === "JPY") return `¥${amount.toLocaleString("ja-JP")}`;
  return `${c} ${amount.toLocaleString()}`;
}

export function CaptureAnalysisPanel({
  state,
  analysis,
  error,
  driveUrl,
  driveFileId,
  originalFilename,
}: Props): JSX.Element | null {
  const typed = useTypewriter(analysis?.comment ?? "");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renamed, setRenamed] = useState<string | null>(null);
  const [renameErr, setRenameErr] = useState<string | null>(null);

  useEffect(() => {
    if (analysis?.suggested_filename) {
      setName(analysis.suggested_filename);
    }
  }, [analysis?.suggested_filename]);

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
          <p>うまく読み取れませんでした。</p>
          {error ? (
            <p className="mt-1 text-[11px] text-red-300/70">{error}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!analysis) return null;
  const showCursor = typed.length < (analysis.comment?.length ?? 0);
  const badge = DOC_BADGE[analysis.doc_type];
  const amount = formatAmount(analysis.extracted.amount, analysis.extracted.currency);

  async function doRename(): Promise<void> {
    if (!driveFileId || !name.trim()) return;
    setRenaming(true);
    setRenameErr(null);
    try {
      const tok = await getCurrentToken();
      if (!tok) throw new Error("サインインが切れています");
      const finalName = applyExtension(name.trim(), originalFilename ?? "");
      await renameDriveFile(driveFileId, tok, finalName);
      setRenamed(finalName);
      setEditing(false);
    } catch (e) {
      setRenameErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRenaming(false);
    }
  }

  return (
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

        {/* Doc type + extracted chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.tone}`}>
            {badge.label}
          </span>
          {analysis.extracted.vendor ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-800/60 px-2 py-0.5 text-[11px] text-ink-100">
              🏬 {analysis.extracted.vendor}
            </span>
          ) : null}
          {amount ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-800/60 px-2 py-0.5 text-[11px] font-medium text-ink-100">
              💴 {amount}
            </span>
          ) : null}
          {analysis.extracted.date_iso ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-800/60 px-2 py-0.5 text-[11px] text-ink-100">
              🗓 {analysis.extracted.date_iso}
            </span>
          ) : null}
          {analysis.extracted.topic ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-800/60 px-2 py-0.5 text-[11px] text-ink-100">
              ✍️ {analysis.extracted.topic}
            </span>
          ) : null}
          {analysis.suggested_folder ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-900/60 px-2 py-0.5 text-[11px] text-ink-300">
              📁 {analysis.suggested_folder}
            </span>
          ) : null}
        </div>

        {/* Rename row */}
        {analysis.suggested_filename ? (
          <div className="rounded-xl border border-hairline bg-ink-800/30 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink-400">
                ファイル名候補
              </span>
              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-[11px] font-medium text-accent-soft hover:text-accent"
                >
                  編集
                </button>
              ) : null}
            </div>
            {editing ? (
              <div className="mt-1.5 flex gap-1.5">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 rounded-lg border border-hairline bg-ink-900/70 px-2.5 py-1.5 text-[13px] text-ink-50 focus:border-accent/60 focus:outline-none"
                  autoFocus
                  enterKeyHint="done"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void doRename();
                  }}
                />
                <button
                  type="button"
                  disabled={renaming || !name.trim()}
                  onClick={() => void doRename()}
                  className="inline-flex h-8 items-center rounded-lg bg-accent/15 px-3 text-[12px] font-medium text-accent-soft disabled:opacity-50"
                >
                  {renaming ? "適用中…" : "保存"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void doRename()}
                disabled={renaming || !driveFileId}
                className="mt-1 flex w-full items-center justify-between gap-2 text-left disabled:opacity-50"
              >
                <span className="truncate text-[13px] font-mono text-ink-100">
                  {name}
                </span>
                <span className="shrink-0 text-[11px] text-accent-soft">
                  {renaming ? "適用中…" : renamed ? "✓ 適用済" : "タップで Drive に適用"}
                </span>
              </button>
            )}
            {renamed && !editing ? (
              <p className="mt-1 text-[10px] text-ink-400">→ {renamed}</p>
            ) : null}
            {renameErr ? (
              <p className="mt-1 text-[11px] text-red-300/80">{renameErr}</p>
            ) : null}
          </div>
        ) : null}

        {driveUrl ? (
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-[11px] font-medium text-ink-300 underline-offset-4 hover:text-accent-soft hover:underline"
          >
            Drive で開く ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}
