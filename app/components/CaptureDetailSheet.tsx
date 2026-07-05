"use client";

import { useEffect, useState, type JSX } from "react";
import type { HistoryEntry } from "@/app/lib/drive-history";
import { CommentThread } from "@/app/components/CommentThread";
import { getCurrentToken } from "@/app/lib/gis";
import { renameDriveFile } from "@/app/lib/drive";
import { getCapture, putCapture } from "@/app/lib/captures-db";
import { idbGet } from "@/app/lib/idb";
import {
  retargetCaptureDocType,
  undoRetargetCaptureDocType,
  type RetargetUndo,
} from "@/app/lib/capture-routing";
import { DOC_TYPE_LABEL, type DocType } from "@/app/lib/doc-routing";

type Props = {
  entry: HistoryEntry | null;
  onClose: () => void;
  onRenamed?: (fileId: string, newName: string) => void;
  onDocTypeChanged?: (fileId: string, docType: DocType) => void;
};

type ConfigFolderRecord = { key: "folder_id"; value: string };

const DOC_TYPES: DocType[] = ["receipt", "memo", "business_card", "other"];
const UNDO_TIMEOUT_MS = 10_000;

const DOC_BADGE: Record<DocType, { label: string; tone: string }> = {
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
      <span className="relative text-[0.6875rem] font-semibold tracking-tight text-ink-50">
        cdx
      </span>
    </span>
  );
}

export function CaptureDetailSheet({ entry, onClose, onRenamed, onDocTypeChanged }: Props): JSX.Element | null {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState<string>("");
  const [currentDocType, setCurrentDocType] = useState<DocType>("other");
  const [routingBusy, setRoutingBusy] = useState(false);
  const [routingMessage, setRoutingMessage] = useState<string | null>(null);
  const [undo, setUndo] = useState<RetargetUndo | null>(null);
  const [driveReady, setDriveReady] = useState(false);

  // entry が変わったら state リセット
  useEffect(() => {
    setEditing(false);
    setDraft(entry?.name ?? "");
    setCurrentName(entry?.name ?? "");
    setRenameError(null);
    setCurrentDocType(entry?.analysis?.doc_type ?? "other");
    setRoutingBusy(false);
    setRoutingMessage(null);
    setUndo(null);
  }, [entry?.id, entry?.name, entry?.analysis?.doc_type]);

  useEffect(() => {
    if (!undo) return;
    const id = window.setTimeout(() => {
      setUndo(null);
      setRoutingMessage(null);
    }, UNDO_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [undo]);

  useEffect(() => {
    let cancelled = false;
    async function refreshTokenState(): Promise<void> {
      const tok = await getCurrentToken();
      if (!cancelled) setDriveReady(tok !== null);
    }
    void refreshTokenState();
    const id = setInterval(() => void refreshTokenState(), 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function handleRenameSave(): Promise<void> {
    if (!entry) return;
    const trimmed = draft.trim();
    if (!trimmed || trimmed === currentName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setRenameError(null);
    try {
      const tok = await getCurrentToken();
      if (!tok) throw new Error("サインインが切れています。再認可してください。");
      const updated = await renameDriveFile(entry.id, trimmed, tok);
      // IDB の captures-db も更新 (存在すれば)
      const rec = await getCapture(entry.id).catch(() => undefined);
      if (rec) {
        await putCapture({ ...rec, drive_name: updated.name });
      }
      setCurrentName(updated.name);
      setEditing(false);
      if (onRenamed) onRenamed(entry.id, updated.name);
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDocTypeChange(nextDocType: DocType): Promise<void> {
    if (!entry || nextDocType === currentDocType) return;
    const previousDocType = currentDocType;
    setRoutingBusy(true);
    setRoutingMessage(null);
    setUndo(null);
    setCurrentDocType(nextDocType);
    onDocTypeChanged?.(entry.id, nextDocType);
    try {
      const tok = await getCurrentToken();
      if (!tok) throw new Error("サインインが切れています。再認可してください。");
      const folderRec = await idbGet<ConfigFolderRecord>("config", "folder_id");
      if (!folderRec?.value) {
        throw new Error("メイン保存先フォルダが未設定です。");
      }
      const result = await retargetCaptureDocType({
        file_id: entry.id,
        doc_type: nextDocType,
        mainFolderId: folderRec.value,
        accessToken: tok,
      });
      setUndo(result.undo);
      setRoutingMessage(`${DOC_TYPE_LABEL[nextDocType]}へ振り分けました。`);
    } catch (e) {
      setCurrentDocType(previousDocType);
      onDocTypeChanged?.(entry.id, previousDocType);
      setRoutingMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setRoutingBusy(false);
    }
  }

  async function handleUndoDocTypeChange(): Promise<void> {
    if (!entry || !undo) return;
    setRoutingBusy(true);
    setRoutingMessage(null);
    try {
      const tok = await getCurrentToken();
      if (!tok) throw new Error("サインインが切れています。再認可してください。");
      const restored = await undoRetargetCaptureDocType({ undo, accessToken: tok });
      setCurrentDocType(restored.doc_type);
      onDocTypeChanged?.(entry.id, restored.doc_type);
      setUndo(null);
      setRoutingMessage(
        restored.idbUpdateFailed
          ? "Drive は元の振り分け先に戻しました。端末内履歴の更新に失敗しました。"
          : "振り分け先を元に戻しました。",
      );
    } catch (e) {
      setRoutingMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setRoutingBusy(false);
    }
  }

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
  const badge = a ? DOC_BADGE[currentDocType] ?? DOC_BADGE.other : null;
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
                  <p className="whitespace-pre-line text-[0.875rem] leading-relaxed text-ink-50">
                    {a.comment}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {badge ? (
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium ${badge.tone}`}>
                      {badge.label}
                    </span>
                  ) : null}
                  {a.extracted?.vendor ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-800/60 px-2 py-0.5 text-[0.6875rem] text-ink-100">
                      🏬 {a.extracted.vendor}
                    </span>
                  ) : null}
                  {amount ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-800/60 px-2 py-0.5 text-[0.6875rem] font-medium text-ink-100">
                      💴 {amount}
                    </span>
                  ) : null}
                  {a.extracted?.date_iso ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-800/60 px-2 py-0.5 text-[0.6875rem] text-ink-100">
                      🗓 {a.extracted.date_iso}
                    </span>
                  ) : null}
                  {a.suggested_folder ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-900/60 px-2 py-0.5 text-[0.6875rem] text-ink-300">
                      📁 {a.suggested_folder}
                    </span>
                  ) : null}
                </div>
                <div className="rounded-xl border border-hairline bg-ink-800/25 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.6875rem] font-medium text-ink-300">
                      振り分け先
                    </span>
                    {!driveReady ? (
                      <span className="text-[0.625rem] text-ink-500">再認可が必要です</span>
                    ) : null}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {DOC_TYPES.map((type) => {
                      const selected = currentDocType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => void handleDocTypeChange(type)}
                          disabled={routingBusy || !driveReady || selected}
                          aria-pressed={selected}
                          className={`inline-flex h-8 items-center justify-center rounded-full border px-2 text-[0.6875rem] font-medium transition ${
                            selected
                              ? "border-accent/50 bg-accent/15 text-accent-soft"
                              : "border-hairline bg-ink-900/60 text-ink-300 hover:border-white/20 hover:text-ink-100"
                          } disabled:cursor-not-allowed disabled:opacity-55`}
                        >
                          {DOC_TYPE_LABEL[type]}
                        </button>
                      );
                    })}
                  </div>
                  {routingMessage ? (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-hairline bg-ink-950/40 px-3 py-2">
                      <span className="text-[0.6875rem] text-ink-200">{routingMessage}</span>
                      {undo ? (
                        <button
                          type="button"
                          onClick={() => void handleUndoDocTypeChange()}
                          disabled={routingBusy || !driveReady}
                          className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[0.6875rem] font-medium text-accent-soft disabled:opacity-50"
                        >
                          Undo
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {a.extracted?.items && a.extracted.items.length > 0 ? (
                  <ul className="rounded-xl border border-hairline bg-ink-800/30 px-4 py-3 text-[0.75rem] leading-relaxed text-ink-100">
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
            <p className="text-[0.8125rem] text-ink-300">
              この写真には Codex の記録がありません
            </p>
          )}

          <div className="mt-2 rounded-2xl border border-hairline bg-ink-800/20 p-3">
            <CommentThread fileId={entry.id} />
          </div>

          {editing ? (
            <div className="flex flex-col gap-1.5 rounded-xl border border-accent/40 bg-ink-800/40 p-3">
              <label className="text-[0.625rem] uppercase tracking-[0.14em] text-ink-400">
                題名
              </label>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleRenameSave();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setDraft(currentName);
                    setRenameError(null);
                  }
                }}
                disabled={saving}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className="rounded-lg border border-hairline bg-ink-950/60 px-3 py-2 text-[0.8125rem] text-ink-50 placeholder:text-ink-500 focus:border-accent/60 focus:outline-none"
                aria-label="ファイルの題名"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleRenameSave()}
                  disabled={saving || !draft.trim()}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-accent px-3 text-[0.75rem] font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
                >
                  {saving ? "保存中…" : "保存"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setDraft(currentName);
                    setRenameError(null);
                  }}
                  disabled={saving}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-hairline bg-ink-900/60 px-3 text-[0.75rem] text-ink-300 hover:text-ink-100"
                >
                  キャンセル
                </button>
              </div>
              {renameError ? (
                <p className="text-[0.6875rem] text-red-300/80">{renameError}</p>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(currentName);
                setEditing(true);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-hairline bg-ink-800/20 px-3 py-2 text-left transition hover:border-accent/40 hover:bg-ink-800/40"
              aria-label="題名を編集"
            >
              <span className="truncate text-[0.75rem] text-ink-300">
                {currentName || entry.name}
              </span>
              <span className="shrink-0 text-[0.625rem] uppercase tracking-[0.12em] text-ink-500">
                ✎ 編集
              </span>
            </button>
          )}
          {entry.webViewLink ? (
            <a
              href={entry.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 w-full items-center justify-center rounded-full border border-accent/40 bg-accent/10 px-4 text-[0.8125rem] font-medium text-accent-soft transition hover:bg-accent/20"
            >
              Drive で開く ↗
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
