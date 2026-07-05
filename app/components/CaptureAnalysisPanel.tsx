"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import type { CodexReply } from "@/app/lib/capture-analysis";
import {
  applyExtension,
  renameDriveFile,
  saveAnalysisToDrive,
} from "@/app/lib/capture-analysis";
import { getCurrentToken } from "@/app/lib/gis";
import { EditableChip } from "@/app/components/EditableChip";
import { DocTypeChip } from "@/app/components/DocTypeChip";
import { buildCaptureRecord, getCapture, putCapture } from "@/app/lib/captures-db";
import { CommentThread } from "@/app/components/CommentThread";

type Props = {
  state: "idle" | "loading" | "ready" | "error";
  analysis: CodexReply | null;
  onRetry?: () => void;
  retrying?: boolean;
  error?: string | null;
  driveUrl?: string;
  driveFileId?: string | null;
  originalFilename?: string | null;
};

function CodexAvatar(): JSX.Element {
  return (
    <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-accent/30 blur-md" />
      <span className="absolute inset-0 rounded-full border border-accent/40 bg-gradient-to-br from-accent/40 to-accent/10" />
      <span className="relative text-[0.6875rem] font-semibold tracking-tight text-ink-50">
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

function formatAmount(amount: number | undefined, currency: string | undefined): string {
  if (amount === undefined) return "";
  const c = currency || "JPY";
  if (c === "JPY") return `¥${amount.toLocaleString("ja-JP")}`;
  return `${c} ${amount.toLocaleString()}`;
}

export function CaptureAnalysisPanel({
  state,
  analysis: initialAnalysis,
  error,
  driveUrl,
  driveFileId,
  originalFilename,
  onRetry,
  retrying,
}: Props): JSX.Element | null {
  const [analysis, setAnalysis] = useState<CodexReply | null>(initialAnalysis);
  useEffect(() => {
    setAnalysis(initialAnalysis);
  }, [initialAnalysis]);

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

  async function persist(next: CodexReply): Promise<void> {
    setAnalysis(next);
    if (!driveFileId) return;
    const tok = await getCurrentToken();
    if (!tok) return;
    void saveAnalysisToDrive(driveFileId, tok, next).catch(() => undefined);
    // IDB update — preserve existing parent_id / routed_to.
    const existing = await getCapture(driveFileId);
    const record = buildCaptureRecord({
      file_id: driveFileId,
      drive_name: originalFilename ?? existing?.drive_name ?? "",
      drive_url: driveUrl,
      thumbnail_url: existing?.thumbnail_url,
      parent_id: existing?.parent_id,
      analysis: next,
      routed_to: existing?.routed_to,
    });
    if (existing?.created_iso) record.created_iso = existing.created_iso;
    await putCapture(record).catch(() => undefined);
  }

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
        <div className="flex-1 rounded-2xl rounded-tl-md border border-hairline bg-ink-800/50 px-3.5 py-3">
          {/* 部分成功: Drive 保存は完了している */}
          {driveUrl ? (
            <p className="mb-2 text-[0.75rem] text-emerald-300/90">
              ✅ Drive への保存は完了しています
            </p>
          ) : null}
          <p className="text-[0.8125rem] text-ink-100">
            ⚠️ AI による整理ができませんでした
          </p>
          {error ? (
            <p className="mt-1.5 text-[0.71875rem] leading-relaxed text-ink-400">
              {error.length > 160 ? `${error.slice(0, 160)}…` : error}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {error?.includes("サインインが切れて") ? (
              <a
                href="/settings"
                className="inline-flex h-8 items-center justify-center rounded-full border border-accent/40 bg-accent/10 px-3 text-[0.75rem] font-medium text-accent-soft transition hover:bg-accent/20"
              >
                🔐 設定 → 再認可
              </a>
            ) : onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="inline-flex h-8 items-center justify-center rounded-full border border-accent/40 bg-accent/10 px-3 text-[0.75rem] font-medium text-accent-soft transition hover:bg-accent/20 disabled:opacity-50"
              >
                {retrying ? "再試行中…" : "🔁 もう一度 AI で整理する"}
              </button>
            ) : null}
            {driveUrl ? (
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center justify-center rounded-full border border-hairline px-3 text-[0.75rem] text-ink-300 transition hover:text-ink-100"
              >
                Drive で開く ↗
              </a>
            ) : null}
          </div>
          <p className="mt-2 text-[0.6875rem] text-ink-500">
            AI 整理は後からでも実行できます。撮影した画像は Drive 上で安全に保管されています。
          </p>
        </div>
      </div>
    );
  }

  if (!analysis) return null;
  const showCursor = typed.length < (analysis.comment?.length ?? 0);
  const amountText = formatAmount(analysis.extracted.amount, analysis.extracted.currency);

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
          <p className="whitespace-pre-line text-[0.90625rem] leading-relaxed text-ink-50">
            {typed}
            {showCursor ? (
              <span className="ml-0.5 inline-block h-[1.05em] w-[2px] -translate-y-0.5 animate-pulse bg-accent align-middle" />
            ) : null}
          </p>
        </div>

        {/* Editable chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <DocTypeChip
            value={analysis.doc_type}
            onChange={(t) => persist({ ...analysis, doc_type: t })}
          />
          <EditableChip
            label="🏬"
            ariaLabel="店名"
            value={analysis.extracted.vendor ?? ""}
            placeholder="店名"
            onCommit={(v) =>
              persist({
                ...analysis,
                extracted: { ...analysis.extracted, vendor: v || undefined },
              })
            }
          />
          <EditableChip
            label="💴"
            ariaLabel="金額"
            inputType="number"
            value={amountText || ""}
            placeholder="金額"
            onCommit={(v) => {
              const n = parseFloat(v.replace(/[^0-9.]/g, ""));
              persist({
                ...analysis,
                extracted: {
                  ...analysis.extracted,
                  amount: Number.isFinite(n) ? n : undefined,
                },
              });
            }}
          />
          <EditableChip
            label="🗓"
            ariaLabel="日付"
            inputType="date"
            value={analysis.extracted.date_iso ?? ""}
            placeholder="YYYY-MM-DD"
            onCommit={(v) =>
              persist({
                ...analysis,
                extracted: { ...analysis.extracted, date_iso: v || undefined },
              })
            }
          />
          <EditableChip
            label="✍️"
            ariaLabel="トピック"
            value={analysis.extracted.topic ?? ""}
            placeholder="メモ見出し"
            onCommit={(v) =>
              persist({
                ...analysis,
                extracted: { ...analysis.extracted, topic: v || undefined },
              })
            }
          />
          {analysis.suggested_folder ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-900/60 px-2 py-0.5 text-[0.6875rem] text-ink-300">
              📁 {analysis.suggested_folder}
            </span>
          ) : null}
        </div>

        {/* Rename row */}
        {analysis.suggested_filename ? (
          <div className="rounded-xl border border-hairline bg-ink-800/30 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.625rem] uppercase tracking-[0.14em] text-ink-400">
                ファイル名候補
              </span>
              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-[0.6875rem] font-medium text-accent-soft hover:text-accent"
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
                  className="flex-1 rounded-lg border border-hairline bg-ink-900/70 px-2.5 py-1.5 text-[0.8125rem] text-ink-50 focus:border-accent/60 focus:outline-none"
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
                  className="inline-flex h-8 items-center rounded-lg bg-accent/15 px-3 text-[0.75rem] font-medium text-accent-soft disabled:opacity-50"
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
                <span className="truncate text-[0.8125rem] font-mono text-ink-100">
                  {name}
                </span>
                <span className="shrink-0 text-[0.6875rem] text-accent-soft">
                  {renaming ? "適用中…" : renamed ? "✓ 適用済" : "タップで Drive に適用"}
                </span>
              </button>
            )}
            {renamed && !editing ? (
              <p className="mt-1 text-[0.625rem] text-ink-400">→ {renamed}</p>
            ) : null}
            {renameErr ? (
              <p className="mt-1 text-[0.6875rem] text-red-300/80">{renameErr}</p>
            ) : null}
          </div>
        ) : null}

        {driveFileId ? (
          <div className="pt-1">
            <CommentThread fileId={driveFileId} compact />
          </div>
        ) : null}

        {driveUrl ? (
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-[0.6875rem] font-medium text-ink-300 underline-offset-4 hover:text-accent-soft hover:underline"
          >
            Drive で開く ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}
