"use client";

import {
  useState,
  useEffect,
  useCallback,
  type JSX,
  type KeyboardEvent,
} from "react";
import { DocRoutingPanel } from "@/app/components/DocRoutingPanel";
import { FolderShareSheet } from "@/app/components/FolderShareSheet";
import { getFolderMeta } from "@/app/lib/doc-routing";
import { pickFolder } from "@/app/lib/picker";
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
type FolderHistoryRecord = {
  key: "folder_history";
  value: { id: string; addedAt: number }[];
};

const FOLDER_HISTORY_MAX = 5;

/**
 * Drive URL から folder ID を抽出する。受け入れ形式:
 *   https://drive.google.com/drive/folders/<ID>?usp=...
 *   https://drive.google.com/drive/u/0/folders/<ID>
 *   ID 文字列をそのまま貼った場合 (素通し)
 */
function extractFolderId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    const match = u.pathname.match(/\/folders\/([A-Za-z0-9_-]{8,})/);
    if (match && match[1]) return match[1];
  } catch {
    // fall through to bare-ID case
  }
  const bare = trimmed.split(/[?#\s]/)[0] ?? trimmed;
  return bare;
}

function isLikelyFolderId(id: string): boolean {
  return /^[A-Za-z0-9_-]{8,}$/.test(id);
}

async function loadFolderHistory(): Promise<{ id: string; addedAt: number }[]> {
  try {
    const record = await idbGet<FolderHistoryRecord>("config", "folder_history");
    return Array.isArray(record?.value) ? record.value : [];
  } catch {
    return [];
  }
}

async function pushFolderHistory(id: string): Promise<
  { id: string; addedAt: number }[]
> {
  const existing = await loadFolderHistory();
  const filtered = existing.filter((entry) => entry.id !== id);
  const next = [{ id, addedAt: Date.now() }, ...filtered].slice(
    0,
    FOLDER_HISTORY_MAX,
  );
  await idbPut<FolderHistoryRecord>("config", {
    key: "folder_history",
    value: next,
  });
  return next;
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

function ClipboardIcon(): JSX.Element {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="8" y="3" width="8" height="4" rx="1.2" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function SettingsContent(): JSX.Element {
  const router = useRouter();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [mainFolderName, setMainFolderName] = useState<string | null>(null);
  const [mainFolderShareOpen, setMainFolderShareOpen] = useState(false);
  const [folderInput, setFolderInput] = useState("");
  const [folderHistory, setFolderHistory] = useState<
    { id: string; addedAt: number }[]
  >([]);
  const [deviceId, setDeviceId] = useState("--------");
  const [deviceShort, setDeviceShort] = useState("--------");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [aiAssist, setAiAssist] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [helperOpen, setHelperOpen] = useState(false);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const [installPlatform, setInstallPlatform] = useState<"ios" | "android">("ios");
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);

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
      const history = await loadFolderHistory();
      if (!cancelled) {
        setFolderId(existingFolder?.value ?? null);
        setFolderInput(existingFolder?.value ?? "");
        setFolderHistory(history);
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

  // メインフォルダの名前を取得。Picker callback で取れた name が優先、
  // 取れない場合は best-effort で getFolderMeta (drive.file 経由で picker 選択済 / app 作成済なら成功)
  useEffect(() => {
    let cancelled = false;
    if (!folderId) {
      setMainFolderName(null);
      return;
    }
    // すでに picker callback で name 入っている場合は再 fetch しない
    if (mainFolderName) return;
    void (async () => {
      const tok = await getCurrentToken();
      if (!tok || cancelled) return;
      // drive.file 経由でも picker 選択 / app 作成 folder なら取れる (best-effort)
      const meta = await getFolderMeta(folderId, tok).catch(() => null);
      if (!cancelled && meta?.name) {
        setMainFolderName(meta.name);
      }
      // null のままなら ID 表示で fallback (UI 側で handle)
    })();
    return () => {
      cancelled = true;
    };
  // mainFolderName は意図的に dep から除外 (state set 後の loop 回避)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  const applyFolder = useCallback(
    async (rawOrId: string, opts?: { silent?: boolean }) => {
      const extracted = extractFolderId(rawOrId);
      if (!extracted || !isLikelyFolderId(extracted)) {
        if (!opts?.silent) {
          setStatusMessage("有効な Drive フォルダ URL / ID が見つかりませんでした。");
        }
        return;
      }
      await idbPut<ConfigFolderRecord>("config", {
        key: "folder_id",
        value: extracted,
      });
      const nextHistory = await pushFolderHistory(extracted);
      setFolderId(extracted);
      setFolderInput(extracted);
      setFolderHistory(nextHistory);
      setStatusMessage(
        `保存先フォルダを「…${extracted.slice(-8)}」に設定しました。`,
      );
      // 名前は別 useEffect で fetch されるが、メッセージも置き換えるため再 fetch
      void (async () => {
        const tok = await getCurrentToken();
        if (!tok) return;
        const meta = await getFolderMeta(extracted, tok).catch(() => null);
        if (meta?.name) {
          setStatusMessage(`保存先フォルダを「${meta.name}」に設定しました。`);
        }
      })();
    },
    [],
  );

  const handlePasteFromClipboard = useCallback(async () => {
    const focusInput = () => {
      const el = document.getElementById("folder-picker-input");
      if (el instanceof HTMLInputElement) {
        el.focus();
        el.select();
      }
    };
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard?.readText
    ) {
      setStatusMessage(
        "このブラウザではボタン貼り付けが使えません。下の入力欄を長押しして「ペースト」を選んでください。",
      );
      focusInput();
      return;
    }
    setPasteBusy(true);
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.trim() === "") {
        setStatusMessage("クリップボードが空のようです。下の入力欄に直接貼り付けてもらえます。");
        focusInput();
        return;
      }
      await applyFolder(text);
    } catch {
      // iOS Chrome / Firefox 等は readText を拒否することがある
      setStatusMessage(
        "貼り付けがブロックされました。下の入力欄を長押しして「ペースト」を選んでください。",
      );
      focusInput();
    } finally {
      setPasteBusy(false);
    }
  }, [applyFolder]);

  const handlePickFromDrive = useCallback(async () => {
    setPickerBusy(true);
    setStatusMessage(null);
    try {
      const tok = await getCurrentToken();
      if (!tok) {
        setStatusMessage(
          "Google サインインの有効期限が切れています。設定→再認可 をお試しください。",
        );
        return;
      }
      const picked = await pickFolder(tok);
      if (picked) {
        // Picker callback で取れた folder.name を即座に state に反映
        setMainFolderName(picked.name);
        await applyFolder(picked.id);
      } else {
        setStatusMessage("フォルダ選択をキャンセルしました。");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(
        `Drive ピッカーの起動に失敗しました (${msg}). 下の入力欄から URL を貼り付けてください。`,
      );
    } finally {
      setPickerBusy(false);
    }
  }, [applyFolder]);

  const handleSelectFolder = useCallback(async () => {
    const trimmed = folderInput.trim();
    if (!trimmed) {
      await idbDelete("config", "folder_id");
      setFolderId(null);
      setFolderInput("");
      setStatusMessage("保存先フォルダの指定を解除しました (自動)。");
      return;
    }
    await applyFolder(trimmed);
  }, [folderInput, applyFolder]);

  const handleInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleSelectFolder();
      }
    },
    [handleSelectFolder],
  );

  const handleClearFolder = useCallback(async () => {
    await idbDelete("config", "folder_id");
    setFolderId(null);
    setFolderInput("");
    setStatusMessage("保存先フォルダの指定を解除しました (自動)。");
  }, []);

  const handleApplyHistoryChip = useCallback(
    async (id: string) => {
      await applyFolder(id);
    },
    [applyFolder],
  );

  const handleRemoveHistoryChip = useCallback(
    async (id: string) => {
      const next = folderHistory.filter((entry) => entry.id !== id);
      await idbPut<FolderHistoryRecord>("config", {
        key: "folder_history",
        value: next,
      });
      setFolderHistory(next);
    },
    [folderHistory],
  );

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

  const handleReauthorize = async (): Promise<void> => {
    // Force GIS to re-prompt for consent so the new drive.metadata.readonly
    // scope is granted. signIn() under the hood calls
    // tokenClient.requestAccessToken({ prompt: "consent" }) which always
    // shows the chooser; if scope was added, Google asks for the new grant.
    try {
      const mod = await import("@/app/lib/gis");
      await mod.signIn();
      window.location.reload();
    } catch (e) {
      console.error("reauthorize failed", e);
    }
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
      setFolderHistory([]);
      router.push("/");
    }
  };

  const folderShort = folderId
    ? folderId.length > 14
      ? `…${folderId.slice(-12)}`
      : folderId
    : null;

  // History list excludes the currently active folder so chips don't redundantly
  // surface what's already shown in the hero display.
  const visibleHistory = folderHistory.filter((entry) => entry.id !== folderId);

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

      {/* ─────────── Hero: 保存先フォルダ ─────────── */}
      <section className="flex flex-col gap-5 rounded-3xl border border-hairline bg-gradient-to-b from-ink-800/60 to-ink-900/40 p-6 shadow-card">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
            保存先フォルダの選択
          </span>
          <p className="break-all font-display text-[22px] font-semibold tracking-tight text-ink-50">
            {folderShort ?? "まだ選択されていません"}
          </p>
          <p className="text-[12px] text-ink-400">
            撮影した画像はここで指定した Google Drive
            のフォルダへ直接保存されます。
          </p>
        </div>

        {/* Primary fast-path: Google Picker (Drive と同じ UI) */}
        <button
          type="button"
          onClick={() => void handlePickFromDrive()}
          disabled={pickerBusy || !driveConnected}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent-grad px-5 text-[14px] font-semibold tracking-tight text-white shadow-glow transition active:scale-[0.98] hover:-translate-y-px disabled:opacity-60"
        >
          <DriveIcon />
          {pickerBusy ? "Drive を開いています…" : "Drive から選ぶ"}
        </button>

        {/* Secondary: paste from clipboard */}
        <button
          type="button"
          onClick={() => void handlePasteFromClipboard()}
          disabled={pasteBusy}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-hairline bg-ink-900/70 px-5 text-[13px] font-medium text-ink-100 transition hover:border-white/15 hover:bg-ink-900 disabled:opacity-60"
        >
          <ClipboardIcon />
          {pasteBusy ? "貼り付け中…" : "クリップボードから貼り付け"}
        </button>

        {/* Secondary: manual input fallback */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="folder-picker-input"
            className="text-[11px] font-medium tracking-tight text-ink-400"
          >
            または下の欄を長押し → 「ペースト」で URL を貼り付け
          </label>
          <input
            id="folder-picker-input"
            type="text"
            value={folderInput}
            onChange={(e) => setFolderInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="https://drive.google.com/drive/folders/…"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            inputMode="url"
            enterKeyHint="done"
            className="w-full rounded-2xl border border-hairline bg-ink-950/60 px-4 py-3.5 font-mono text-[12.5px] text-ink-100 placeholder:text-ink-500 focus:border-accent/60 focus:outline-none focus:ring-0"
            aria-label="Google Drive の保存先フォルダ URL または ID"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSelectFolder()}
              disabled={!folderInput.trim() && !folderId}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-hairline bg-ink-900/70 px-4 text-[13px] font-medium text-ink-100 transition hover:border-white/15 hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {folderInput.trim() ? "このフォルダを選択" : "指定を解除"}
            </button>
            {folderId ? (
              <button
                type="button"
                onClick={() => void handleClearFolder()}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-hairline bg-ink-900/60 px-4 text-[12.5px] text-ink-300 transition hover:border-red-400/40 hover:text-red-300"
                aria-label="保存先フォルダの指定を解除"
              >
                解除
              </button>
            ) : null}
          </div>
        </div>

        {/* History chips */}
        {visibleHistory.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium tracking-tight text-ink-400">
              最近選択したフォルダ
            </span>
            <div className="flex flex-wrap gap-2">
              {visibleHistory.map((entry) => {
                const shortId =
                  entry.id.length > 10
                    ? `…${entry.id.slice(-10)}`
                    : entry.id;
                return (
                  <div
                    key={entry.id}
                    className="group inline-flex items-center gap-1 rounded-full border border-hairline bg-ink-900/60 pl-3 pr-1 text-[12px] text-ink-200 transition hover:border-white/20 hover:bg-ink-900"
                  >
                    <button
                      type="button"
                      onClick={() => void handleApplyHistoryChip(entry.id)}
                      className="inline-flex items-center gap-1.5 py-1.5 font-mono text-[11.5px]"
                      aria-label={`フォルダ ${shortId} を選択`}
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full bg-ink-500"
                      />
                      {shortId}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemoveHistoryChip(entry.id)}
                      className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-500 transition hover:bg-white/10 hover:text-ink-200"
                      aria-label={`履歴から ${shortId} を削除`}
                    >
                      <svg
                        aria-hidden
                        viewBox="0 0 16 16"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Helper toggle */}
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
          <span>うまく行かない時 / 旧パス (URL 貼り付け)</span>
        </button>
        {helperOpen ? (
          <div className="-mt-3 space-y-3 rounded-xl border border-hairline bg-ink-950/50 px-5 py-3.5 text-[12px] leading-relaxed text-ink-300">
            <p>
              <span className="font-medium text-ink-100">推奨:</span>{" "}
              上の「📁 Drive から選ぶ」ボタンを使ってください。
              <br />
              URL コピーは不要で、Drive の中から直接フォルダを選択できます。
            </p>
            <p className="border-t border-hairline pt-3">
              <span className="font-medium text-ink-100">URL 貼り付けで指定する場合:</span>
            </p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                <a
                  href="https://drive.google.com/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent-soft underline-offset-2 hover:underline"
                >
                  drive.google.com
                </a>{" "}
                を別タブで開き、対象フォルダの URL をコピー
              </li>
              <li>
                スマホ Drive アプリなら folder の {"…"} メニュー → 「リンクをコピー」
              </li>
              <li>
                下の入力欄を長押し → 「ペースト」を選ぶ
              </li>
              <li>
                「このフォルダを選択」ボタンを押す
              </li>
            </ol>
          </div>
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
        <Row
          label="権限を更新"
          hint="既存写真の表示など、新しい権限を付与するために Google サインインを再実行します"
          action={
            <button
              type="button"
              onClick={() => void handleReauthorize()}
              className="inline-flex h-9 items-center rounded-full border border-accent/40 bg-accent/10 px-3 text-[12px] font-medium text-accent-soft transition hover:bg-accent/20"
            >
              再認可
            </button>
          }
        />
      </Group>

      {/* ─────────── 保存先振り分け ─────────── */}
      <Group title="保存先振り分け">
        {folderId ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-hairline bg-ink-800/30 px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] uppercase tracking-[0.14em] text-ink-400">
                MAIN FOLDER
              </span>
              <span className="truncate text-[14px] font-medium text-ink-100">
                {mainFolderName ? `📁 ${mainFolderName}` : "📁 (名前を取得中…)"}
              </span>
              <span className="truncate text-[10px] text-ink-500">{folderId}</span>
            </div>
            <button
              type="button"
              onClick={() => setMainFolderShareOpen(true)}
              className="inline-flex h-8 shrink-0 items-center rounded-full border border-accent/40 bg-accent/10 px-3 text-[12px] font-medium text-accent-soft hover:bg-accent/20"
            >
              共有
            </button>
          </div>
        ) : null}
        <FolderShareSheet
          open={mainFolderShareOpen}
          folderId={folderId}
          folderLabel="メイン保存先"
          onClose={() => setMainFolderShareOpen(false)}
        />
        <DocRoutingPanel
          mainFolderId={folderId}
          mainFolderLabel={mainFolderName}
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

      {/* ─────────── ホーム画面にインストール (iOS / Android) ─────────── */}
      <Group title="ホーム画面にインストール (任意)">
        <button
          type="button"
          onClick={() => setIosGuideOpen((v) => !v)}
          aria-expanded={iosGuideOpen}
          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-hairline bg-ink-800/30 px-4 py-3 text-left text-[13px] text-ink-200 hover:bg-ink-800/50"
        >
          <span>📱 アプリ風に使うための追加手順</span>
          <span className="text-[11px] text-ink-400">{iosGuideOpen ? "閉じる" : "開く"}</span>
        </button>
        {iosGuideOpen ? (
          <div className="space-y-4 rounded-2xl border border-hairline bg-ink-950/40 px-4 py-4 text-[12px] leading-relaxed text-ink-300">
            {/* Tab switcher */}
            <div className="inline-flex rounded-full border border-hairline bg-ink-900/60 p-0.5">
              <button
                type="button"
                onClick={() => setInstallPlatform("ios")}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                  installPlatform === "ios"
                    ? "bg-ink-700 text-ink-50"
                    : "text-ink-400 hover:text-ink-200"
                }`}
              >
                🍎 iPhone
              </button>
              <button
                type="button"
                onClick={() => setInstallPlatform("android")}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                  installPlatform === "android"
                    ? "bg-ink-700 text-ink-50"
                    : "text-ink-400 hover:text-ink-200"
                }`}
              >
                🤖 Android
              </button>
            </div>

            {installPlatform === "ios" ? (
              <div className="space-y-3">
                <p className="text-ink-100">
                  <strong>iOS の制約上、ホーム画面追加は Safari からのみ可能です。</strong>
                </p>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>
                    <strong>iPhone の Safari</strong> を起動 (Chrome ではなく Safari)
                  </li>
                  <li>
                    アドレスバーに{" "}
                    <code className="rounded bg-ink-800 px-1.5 py-0.5 text-[11px] text-ink-100">
                      capture.cursorvers.jp
                    </code>{" "}
                    を入力
                  </li>
                  <li>
                    Safari 下部の{" "}
                    <strong>共有ボタン (□+↑)</strong> をタップ
                  </li>
                  <li>
                    スクロールして「<strong>ホーム画面に追加</strong>」を選択
                  </li>
                  <li>
                    プレビュー名「Cursorvers Capture」を確認 → 「追加」
                  </li>
                  <li>
                    ホーム画面のアイコンから起動すれば、ブラウザ UI 無しのフルスクリーンで使えます
                  </li>
                </ol>
                <p className="rounded-lg border border-hairline/60 bg-ink-900/40 px-3 py-2 text-[11px] text-ink-400">
                  ⚠️ ホーム画面 PWA は Safari と Cookie が別領域です。初回起動時にもう一度 Google サインインが必要になります (iOS の仕様)。
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-ink-100">
                  <strong>Android は Chrome のままで OK です。</strong>
                </p>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>
                    <strong>Chrome</strong> で{" "}
                    <code className="rounded bg-ink-800 px-1.5 py-0.5 text-[11px] text-ink-100">
                      capture.cursorvers.jp
                    </code>{" "}
                    を開く
                  </li>
                  <li>
                    Chrome 右上の{" "}
                    <strong>「︙」メニュー</strong> をタップ
                  </li>
                  <li>
                    「<strong>アプリをインストール</strong>」または「<strong>ホーム画面に追加</strong>」を選択
                  </li>
                  <li>
                    プレビュー名「Cursorvers Capture」を確認 → 「インストール」
                  </li>
                  <li>
                    ホーム画面のアイコンから起動。ほぼネイティブアプリの感覚で使えます
                  </li>
                </ol>
                <p className="rounded-lg border border-hairline/60 bg-ink-900/40 px-3 py-2 text-[11px] text-ink-400">
                  ✨ Android では Chrome タブと PWA のサインインが共有されるため、再ログインは不要です。
                </p>
              </div>
            )}
          </div>
        ) : null}
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


function DriveIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="h-4 w-4 shrink-0"
    >
      <path d="M7.71 3.5h8.58l5.71 9.89-4.29 7.41h-11.4l-4.29-7.41 5.69-9.89zm.86 1.5L4.16 12.32l3.85 6.68h7.97l3.86-6.68L15.42 5H8.57zm-.5 7.32l3.93-6.82h.04l3.93 6.82h-7.9zm-1.07.5h9.99l-3.98 6.91H10.99l-3.99-6.91z"/>
    </svg>
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
