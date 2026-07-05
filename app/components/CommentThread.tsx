"use client";

import { useCallback, useEffect, useState, type JSX } from "react";
import {
  createComment,
  deleteComment,
  listComments,
  type DriveComment,
} from "@/app/lib/drive-comments";

type Props = {
  fileId: string;
  compact?: boolean;       // when true, render a single-line input only
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

export function CommentThread({ fileId, compact }: Props): JSX.Element {
  const [comments, setComments] = useState<DriveComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const list = await listComments(fileId);
      list.sort((a, b) => (a.createdTime || "").localeCompare(b.createdTime || ""));
      setComments(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSend(): Promise<void> {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const created = await createComment(fileId, draft);
      setDraft("");
      setComments((prev) => [...prev, created]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(commentId: string): Promise<void> {
    if (!confirm("このコメントを削除しますか?")) return;
    setError(null);
    try {
      await deleteComment(fileId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Compact mode: just the input (used inline on post-capture panel)
  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSend();
            }}
            placeholder="💬 自分用メモを追加"
            enterKeyHint="send"
            className="flex-1 rounded-full border border-hairline bg-ink-800/40 px-3 py-1.5 text-[0.75rem] text-ink-100 placeholder:text-ink-500 focus:border-accent/60 focus:outline-none"
          />
          <button
            type="button"
            disabled={sending || !draft.trim()}
            onClick={() => void handleSend()}
            className="inline-flex h-8 shrink-0 items-center rounded-full bg-accent/15 px-3 text-[0.6875rem] font-medium text-accent-soft hover:bg-accent/25 disabled:opacity-50"
          >
            {sending ? "…" : "送信"}
          </button>
        </div>
        {comments.length > 0 ? (
          <p className="text-[0.625rem] text-ink-400">
            既存メモ {comments.length} 件 (履歴で確認)
          </p>
        ) : null}
        {error ? (
          <p className="text-[0.625rem] text-red-300/80">{error}</p>
        ) : null}
      </div>
    );
  }

  // Full mode: thread + input (used in detail sheet)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-400">
          💬 メモ {comments.length > 0 ? `(${comments.length})` : ""}
        </p>
      </div>

      {loading ? (
        <div className="space-y-1">
          <div className="h-3 w-3/4 animate-pulse rounded bg-ink-800" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-ink-800" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-[0.75rem] text-ink-400">まだメモはありません</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-hairline bg-ink-800/30 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.625rem] text-ink-400">
                  {c.author?.displayName ?? "自分"} · {relativeTime(c.createdTime)}
                </p>
                {c.author?.me !== false ? (
                  <button
                    type="button"
                    onClick={() => void handleDelete(c.id)}
                    className="text-[0.625rem] text-ink-400 hover:text-red-300"
                  >
                    削除
                  </button>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-line text-[0.8125rem] leading-relaxed text-ink-100">
                {c.content}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1.5 pt-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="メモを追加…"
          enterKeyHint="send"
          className="flex-1 rounded-full border border-hairline bg-ink-800/40 px-3 py-2 text-[0.8125rem] text-ink-100 placeholder:text-ink-500 focus:border-accent/60 focus:outline-none"
        />
        <button
          type="button"
          disabled={sending || !draft.trim()}
          onClick={() => void handleSend()}
          className="inline-flex h-9 shrink-0 items-center rounded-full bg-accent/15 px-3.5 text-[0.75rem] font-medium text-accent-soft hover:bg-accent/25 disabled:opacity-50"
        >
          {sending ? "送信中…" : "送信"}
        </button>
      </div>

      {error ? (
        <p className="text-[0.6875rem] text-red-300/80">{error}</p>
      ) : null}
    </div>
  );
}
