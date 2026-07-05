"use client";

import { useCallback, useEffect, useState, type JSX } from "react";
import { isValidEmail, normalizeEmail } from "@/app/lib/email-validation";
import {
  disableLinkSharing,
  enableLinkSharing,
  fetchWebViewLink,
  listPermissions,
  revokeShare,
  shareFolderWithEmail,
  type SharePermission,
} from "@/app/lib/share";

type Props = {
  open: boolean;
  folderId: string | null;
  folderLabel: string | null;
  onClose: () => void;
};

type LinkState =
  | { kind: "off" }
  | { kind: "on"; url: string }
  | { kind: "checking" };

export function FolderShareSheet({
  open,
  folderId,
  folderLabel,
  onClose,
}: Props): JSX.Element | null {
  const [linkState, setLinkState] = useState<LinkState>({ kind: "checking" });
  const [perms, setPerms] = useState<SharePermission[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"reader" | "commenter">("reader");
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    if (!folderId) return;
    setLinkState({ kind: "checking" });
    setError(null);
    try {
      const list = await listPermissions(folderId);
      setPerms(list);
      const anyone = list.find((p) => p.type === "anyone");
      if (anyone) {
        const url = await fetchWebViewLink(folderId);
        setLinkState({ kind: "on", url });
      } else {
        setLinkState({ kind: "off" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLinkState({ kind: "off" });
    }
  }, [folderId]);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !folderId) return null;

  async function handleEnableLink(): Promise<void> {
    if (!folderId) return;
    setBusy(true);
    setError(null);
    try {
      const { webViewLink } = await enableLinkSharing(folderId, "reader");
      setLinkState({ kind: "on", url: webViewLink });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisableLink(): Promise<void> {
    if (!folderId) return;
    setBusy(true);
    setError(null);
    try {
      await disableLinkSharing(folderId);
      setLinkState({ kind: "off" });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLink(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: just open the URL
      window.open(url, "_blank");
    }
  }

  async function handleSystemShare(url: string): Promise<void> {
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({
          title: folderLabel ?? "Drive folder",
          text: folderLabel ? `Drive: ${folderLabel}` : undefined,
          url,
        });
        return;
      } catch {
        /* user cancelled or share unsupported — fall back */
      }
    }
    await handleCopyLink(url);
  }

  async function handleInvite(): Promise<void> {
    if (!folderId) return;
    const e = normalizeEmail(email);
    if (!isValidEmail(e)) {
      setError("正しいメールアドレスを入力してください");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await shareFolderWithEmail(folderId, e, role);
      setEmail("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(permissionId: string): Promise<void> {
    if (!folderId) return;
    setBusy(true);
    setError(null);
    try {
      await revokeShare(folderId, permissionId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const userGrants = perms.filter(
    (p) => p.type === "user" && p.role !== "owner",
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-hairline bg-ink-900/95 p-5 shadow-card sm:rounded-3xl"
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

        <p className="text-[0.625rem] uppercase tracking-[0.18em] text-ink-400">
          フォルダ共有
        </p>
        <h2 className="mt-1 font-display text-[1.25rem] font-semibold tracking-tightest text-ink-50">
          📁 {folderLabel ?? "フォルダ"}
        </h2>

        {/* Link sharing block */}
        <div className="mt-4 rounded-2xl border border-hairline bg-ink-800/30 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[0.8125rem] font-medium text-ink-100">
                リンクで共有
              </p>
              <p className="text-[0.6875rem] text-ink-400">
                URL を知っている人全員が閲覧できます
              </p>
            </div>
            {linkState.kind === "checking" ? (
              <span className="text-[0.6875rem] text-ink-400">確認中…</span>
            ) : linkState.kind === "off" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleEnableLink()}
                className="inline-flex h-9 items-center rounded-full bg-accent/15 px-3 text-[0.75rem] font-medium text-accent-soft transition hover:bg-accent/25 disabled:opacity-50"
              >
                {busy ? "…" : "ON"}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDisableLink()}
                className="inline-flex h-9 items-center rounded-full border border-hairline px-3 text-[0.75rem] font-medium text-ink-300 transition hover:border-red-400/40 hover:text-red-300 disabled:opacity-50"
              >
                OFF
              </button>
            )}
          </div>

          {linkState.kind === "on" ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="url"
                  readOnly
                  value={linkState.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded-lg border border-hairline bg-ink-900/70 px-2.5 py-1.5 text-[0.75rem] text-ink-100 outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleCopyLink(linkState.url)}
                  className="inline-flex h-8 shrink-0 items-center rounded-lg border border-hairline bg-ink-800 px-2.5 text-[0.75rem] font-medium text-ink-100 hover:bg-ink-700"
                >
                  {copied ? "✓ コピー" : "コピー"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => void handleSystemShare(linkState.url)}
                className="inline-flex h-9 w-full items-center justify-center rounded-full border border-accent/40 bg-accent/10 px-3 text-[0.75rem] font-medium text-accent-soft hover:bg-accent/20"
              >
                📤 LINE / メール等で送る
              </button>
            </div>
          ) : null}
        </div>

        {/* Email invite block */}
        <div className="mt-3 rounded-2xl border border-hairline bg-ink-800/30 p-4">
          <p className="text-[0.8125rem] font-medium text-ink-100">
            メールで招待
          </p>
          <p className="text-[0.6875rem] text-ink-400">
            特定のメールアドレスに権限を付与します
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              inputMode="email"
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleInvite();
              }}
              className="rounded-lg border border-hairline bg-ink-900/70 px-3 py-2 text-[0.8125rem] text-ink-50 placeholder:text-ink-500 focus:border-accent/60 focus:outline-none"
            />
            <div className="flex items-center gap-1.5">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="rounded-lg border border-hairline bg-ink-900/70 px-2 py-2 text-[0.75rem] text-ink-100"
              >
                <option value="reader">閲覧者</option>
                <option value="commenter">コメント可</option>
              </select>
              <button
                type="button"
                disabled={busy || !email.trim()}
                onClick={() => void handleInvite()}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-accent/15 text-[0.75rem] font-medium text-accent-soft hover:bg-accent/25 disabled:opacity-50"
              >
                {busy ? "送信中…" : "招待"}
              </button>
            </div>
          </div>
        </div>

        {/* Existing grants */}
        {userGrants.length > 0 ? (
          <div className="mt-3 rounded-2xl border border-hairline bg-ink-800/30">
            <p className="border-b border-hairline px-4 py-2.5 text-[0.625rem] uppercase tracking-[0.14em] text-ink-400">
              共有中 ({userGrants.length})
            </p>
            <ul>
              {userGrants.map((p) => (
                <li key={p.id} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[0.75rem] text-ink-100">
                      {p.emailAddress ?? p.displayName ?? p.id}
                    </span>
                    <span className="text-[0.625rem] text-ink-400">
                      {p.role === "reader" ? "閲覧者" : p.role === "commenter" ? "コメント可" : p.role}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRevoke(p.id)}
                    disabled={busy}
                    className="inline-flex h-7 items-center rounded-full border border-hairline px-2 text-[0.625rem] text-ink-300 hover:border-red-400/40 hover:text-red-300 disabled:opacity-50"
                  >
                    解除
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-[0.6875rem] text-red-300/80">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
