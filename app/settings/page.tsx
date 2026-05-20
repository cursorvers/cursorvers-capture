"use client";

import { useState, useEffect, type JSX } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { idbGet, idbPut, idbClear, idbDelete } from "@/app/lib/idb";
import {
  getOcrEnabled,
  setOcrEnabled as setOcrEnabledStore,
} from "@/app/lib/ocr-toggle";
import {
  getAudioEnabled,
  setAudioEnabled as setAudioEnabledStore,
} from "@/app/lib/audio-toggle";
import { getDeviceShort, getDeviceId } from "@/app/lib/device";
import { revokeToken, getCurrentToken } from "@/app/lib/gis";
import {
  getShareHistory,
  revokeFromHistory,
  type ShareRecord,
} from "@/app/lib/share-history";

type ConfigFolderRecord = { key: "folder_id"; value: string };

/**
 * Drive URL から folder ID を抽出する。受け入れ形式:
 *   https://drive.google.com/drive/folders/<ID>?usp=...
 *   https://drive.google.com/drive/u/0/folders/<ID>
 *   ID 文字列をそのまま貼った場合 (素通し)
 */
function extractFolderId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // Try URL parse path
  try {
    const u = new URL(trimmed);
    const match = u.pathname.match(/\/folders\/([A-Za-z0-9_-]{8,})/);
    if (match && match[1]) return match[1];
  } catch {
    // fall through to bare-ID case
  }
  // bare ID — keep what looks like an ID (drop query / spaces)
  const bare = trimmed.split(/[?#\s]/)[0] ?? trimmed;
  return bare;
}

function Row({
  label,
  value,
  hint,
  action,
}: {
  label: string;
  value?: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[13px] font-medium text-ink-100">{label}</p>
        {value ? (
          <p className="break-all text-[12px] text-ink-300">{value}</p>
        ) : null}
        {hint ? <p className="text-[11px] text-ink-500">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col">
      <h2 className="mb-2 px-1 text-[12px] font-medium tracking-tight text-ink-400">
        {title}
      </h2>
      <div className="divide-y divide-hairline rounded-2xl border border-hairline bg-ink-900/40 px-5">
        {children}
      </div>
    </section>
  );
}

function SettingsContent(): JSX.Element {
  const router = useRouter();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderInput, setFolderInput] = useState("");
  const [deviceId, setDeviceId] = useState("--------");
  const [deviceShort, setDeviceShort] = useState("--------");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [aiAssist, setAiAssist] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [helperOpen, setHelperOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadShares() {
      const recentShares = await getShareHistory();
      if (!cancelled) {
        setShares(recentShares);
      }
    }
    void loadShares();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const existingFolder = await idbGet<ConfigFolderRecord>(
        "config",
        "folder_id",
      );
      if (!cancelled) {
        setFolderId(existingFolder?.value ?? null);
        setFolderInput(existingFolder?.value ?? "");
      }
      setDeviceId(getDeviceId());
      setDeviceShort(getDeviceShort());
      const ocrStatus = await getOcrEnabled();
      const audioStatus = await getAudioEnabled();
      const tok = await getCurrentToken();
      if (!cancelled) {
        setDriveConnected(tok !== null);
        setAiAssist(ocrStatus && audioStatus);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const id = setInterval(async () => {
      const tok = await getCurrentToken();
      if (!cancelled) {
        setDriveConnected(tok !== null);
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const handleRevokeShare = async (
    driveFileId: string,
    permissionId: string,
  ) => {
    if (window.confirm("本当にこの共有を取り消しますか？")) {
      try {
        await revokeFromHistory(driveFileId, permissionId);
        setStatusMessage("共有を取り消しました。");
        const updatedShares = await getShareHistory();
        setShares(updatedShares);
      } catch (error: unknown) {
        const m = error instanceof Error ? error.message : "Unknown error";
        setStatusMessage(`共有の取消に失敗しました: ${m}`);
      }
    }
  };

  const handleSelectFolder = async () => {
    const extracted = extractFolderId(folderInput);
    if (extracted) {
      await idbPut<ConfigFolderRecord>("config", {
        key: "folder_id",
        value: extracted,
      });
      setFolderId(extracted);
      setFolderInput(extracted); // normalize input to the extracted ID
      setStatusMessage(`保存先フォルダを「…${extracted.slice(-8)}」に設定しました。`);
    } else {
      await idbDelete("config", "folder_id");
      setFolderId(null);
      setFolderInput("");
      setStatusMessage("保存先フォルダの指定を解除しました (自動)。");
    }
  };

  const handleClearFolder = async () => {
    await idbDelete("config", "folder_id");
    setFolderId(null);
    setFolderInput("");
    setStatusMessage("保存先フォルダの指定を解除しました (自動)。");
  };

  const handleAiToggle = async () => {
    const next = !aiAssist;
    await setOcrEnabledStore(next);
    await setAudioEnabledStore(next);
    setAiAssist(next);
    setStatusMessage(`AI 補助を ${next ? "ON" : "OFF"} にしました。`);
  };

  const handleSignOut = async () => {
    await revokeToken();
    setDriveConnected(false);
    setStatusMessage("サインアウトしました。");
    router.push("/");
  };

  const handleClearAllData = async () => {
    if (
      window.confirm(
        "本当に全てのデータを消去しますか？（IndexedDB と LocalStorage がクリアされます）",
      )
    ) {
      await idbClear("config");
      await idbClear("uploadSessions");
      await idbClear("pendingUploads");
      localStorage.clear();
      setStatusMessage("全てのデータを消去しました。");
      setFolderId(null);
      setFolderInput("");
      router.push("/");
    }
  };

  const folderShort = folderId
    ? folderId.length > 14
      ? `…${folderId.slice(-12)}`
      : folderId
    : null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-9 px-5 pb-20 pt-10 sm:pt-14">
      {/* Page header */}
      <header className="flex flex-col gap-2.5">
        <span className="text-[10px] uppercase tracking-[0.22em] text-ink-400">
          Cursorvers Capture
        </span>
        <h1 className="font-display text-[34px] font-semibold leading-[1.05] tracking-tightest text-ink-50 sm:text-[40px]">
          設定
        </h1>
      </header>

      {statusMessage ? (
        <div
          aria-live="polite"
          className="rounded-xl border border-accent/25 bg-accent/[0.08] px-4 py-3 text-[12.5px] leading-relaxed text-accent-soft"
        >
          {statusMessage}
        </div>
      ) : null}

      {/* ─────────── Hero: 保存先フォルダ (most prominent) ─────────── */}
      <section className="flex flex-col gap-4 rounded-3xl border border-hairline bg-gradient-to-b from-ink-800/60 to-ink-900/40 p-6 shadow-card">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
            保存先フォルダの選択
          </span>
          <p className="font-display text-[22px] font-semibold tracking-tight text-ink-50">
            {folderShort ?? "まだ選択されていません"}
          </p>
          <p className="text-[12px] text-ink-400">
            撮影した画像はここで指定した Google Drive
            のフォルダへ直接保存されます。
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="folder-picker-input"
            className="text-[11px] font-medium tracking-tight text-ink-300"
          >
            Drive の URL または ID を貼り付け
          </label>
          <input
            id="folder-picker-input"
            type="text"
            value={folderInput}
            onChange={(e) => setFolderInput(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            inputMode="url"
            className="w-full rounded-2xl border border-hairline bg-ink-950/60 px-4 py-3.5 font-mono text-[12.5px] text-ink-100 placeholder:text-ink-500 focus:border-accent/60 focus:outline-none focus:ring-0"
            aria-label="Google Drive の保存先フォルダ URL または ID"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSelectFolder()}
              disabled={!folderInput.trim()}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent-grad px-5 text-[14px] font-semibold tracking-tight text-white shadow-glow transition active:scale-[0.98] hover:-translate-y-px disabled:cursor-not-allowed disabled:bg-none disabled:bg-ink-800 disabled:text-ink-500 disabled:shadow-none disabled:hover:translate-y-0"
            >
              このフォルダを選択
            </button>
            {folderId ? (
              <button
                type="button"
                onClick={() => void handleClearFolder()}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-hairline bg-ink-900/60 px-4 text-[12.5px] text-ink-300 transition hover:border-white/15 hover:bg-ink-900"
                aria-label="保存先フォルダの指定を解除"
              >
                解除
              </button>
            ) : null}
          </div>
        </div>

        {/* Helper: 取得方法 */}
        <button
          type="button"
          onClick={() => setHelperOpen((v) => !v)}
          aria-expanded={helperOpen}
          className="inline-flex items-center gap-1.5 self-start rounded-md text-left text-[11.5px] text-ink-400 transition hover:text-ink-200"
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className={`h-3 w-3 transition-transform ${helperOpen ? "rotate-90" : ""}`}
            fill="currentColor"
          >
            <path d="M6 4l4 4-4 4V4z" />
          </svg>
          <span>フォルダ URL の取得方法</span>
        </button>
        {helperOpen ? (
          <ol className="-mt-2 list-decimal space-y-1.5 rounded-xl border border-hairline bg-ink-950/50 px-5 py-3.5 pl-7 text-[12px] leading-relaxed text-ink-300">
            <li>
              <a
                href="https://drive.google.com/"
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent-soft underline-offset-2 hover:underline"
              >
                drive.google.com
              </a>{" "}
              で保存したい folder を開く (or 新規作成)
            </li>
            <li>
              ブラウザのアドレスバーの URL{" "}
              <code className="rounded bg-ink-800 px-1.5 py-0.5 text-[10.5px] text-ink-200">
                https://drive.google.com/drive/folders/…
              </code>{" "}
              を丸ごと copy
            </li>
            <li>上の入力欄に貼り付け → 「このフォルダを選択」</li>
            <li>
              ID 部分は自動で抽出されます (URL でも ID でも OK)。
            </li>
          </ol>
        ) : null}
      </section>

      {/* ─────────── Drive 接続 ─────────── */}
      <Group title="アカウント">
        <Row
          label="Google Drive"
          value={driveConnected ? "接続済み" : "未接続"}
          action={
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex h-9 items-center rounded-full border border-hairline px-3 text-[12px] text-ink-300 transition hover:border-red-400/50 hover:text-red-300"
            >
              サインアウト
            </button>
          }
        />
      </Group>

      {/* ─────────── 機能 ─────────── */}
      <Group title="機能">
        <Row
          label="AI 補助 (OCR・音声)"
          hint="ON にすると OCR と音声メモ (長押し録音) の両方が有効になります。Codex へ一時送信されますが、保存はされません。"
          action={
            <button
              type="button"
              role="switch"
              aria-checked={aiAssist}
              onClick={() => void handleAiToggle()}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                aiAssist ? "bg-accent" : "bg-ink-700"
              }`}
            >
              <span className="sr-only">AI 補助のオン・オフ</span>
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  aiAssist ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          }
        />
      </Group>

      {/* ─────────── 詳細 ─────────── */}
      <Group title="詳細">
        <Row
          label="デバイス ID"
          value={
            <span className="font-mono">
              {deviceId}{" "}
              <span className="text-ink-500">({deviceShort})</span>
            </span>
          }
        />
        <Row
          label="最近の共有"
          hint={
            shares.length === 0
              ? "共有履歴はありません。"
              : `${shares.length} 件`
          }
        />
        {shares.length > 0 ? (
          <div className="max-h-48 overflow-auto py-3 text-[12px]">
            {shares.map((share) => (
              <div
                key={share.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline py-2 last:border-b-0"
              >
                <span className="break-all text-ink-200">
                  {share.filename}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void handleRevokeShare(
                      share.driveFileId,
                      share.permissionId,
                    )
                  }
                  className="shrink-0 text-[12px] text-red-300 transition hover:text-red-200"
                >
                  取消
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <Row
          label="全てのローカルデータを消去"
          hint="IndexedDB と LocalStorage を初期化します。"
          action={
            <button
              type="button"
              onClick={() => void handleClearAllData()}
              className="inline-flex h-9 items-center rounded-full border border-hairline px-3 text-[12px] text-ink-300 transition hover:border-red-400/50 hover:text-red-300"
            >
              消去
            </button>
          }
        />
      </Group>

      {/* Footer nav */}
      <nav className="flex flex-col items-center gap-2 pt-2">
        <div className="flex items-center gap-4 text-[12.5px]">
          <Link
            href="/insights"
            className="text-accent-soft underline-offset-2 hover:underline"
          >
            振り返り
          </Link>
          <span aria-hidden className="h-3 w-px bg-white/10" />
          <Link
            href="/advisory"
            className="text-accent-soft underline-offset-2 hover:underline"
          >
            Advisory
          </Link>
        </div>
        <Link
          href="/"
          className="mt-3 text-[12px] text-ink-400 transition hover:text-ink-200"
        >
          ← ホーム
        </Link>
      </nav>
    </div>
  );
}

export default function Settings(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-md flex-col gap-6 px-5 pt-10">
          <div className="h-6 w-32 animate-pulse rounded-full bg-ink-800" />
          <div className="h-10 w-48 animate-pulse rounded-lg bg-ink-800" />
          <div className="h-40 w-full animate-pulse rounded-3xl bg-ink-800" />
          <div className="h-24 w-full animate-pulse rounded-2xl bg-ink-800" />
          <div className="h-24 w-full animate-pulse rounded-2xl bg-ink-800" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
