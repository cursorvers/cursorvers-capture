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

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-hairline bg-ink-800/40 px-5 py-4 shadow-card">
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-300">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SettingsContent(): JSX.Element {
  const router = useRouter();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [newFolderId, setNewFolderId] = useState("");
  const [deviceId, setDeviceId] = useState("--------");
  const [deviceShort, setDeviceShort] = useState("--------");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [aiAssist, setAiAssist] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);

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
        setNewFolderId(existingFolder?.value ?? "");
      }
      setDeviceId(getDeviceId());
      setDeviceShort(getDeviceShort());
      const ocrStatus = await getOcrEnabled();
      const audioStatus = await getAudioEnabled();
      const tok = await getCurrentToken();
      if (!cancelled) {
        setDriveConnected(tok !== null);
        const unified = ocrStatus && audioStatus;
        setAiAssist(unified);
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

  const handleSaveFolderId = async () => {
    const trimmed = newFolderId.trim();
    if (trimmed) {
      await idbPut<ConfigFolderRecord>("config", {
        key: "folder_id",
        value: trimmed,
      });
      setFolderId(trimmed);
      setStatusMessage(`フォルダ ID を「${trimmed}」に更新しました。`);
    } else {
      await idbDelete("config", "folder_id");
      setFolderId(null);
      setNewFolderId("");
      setStatusMessage("フォルダ指定をクリアし、自動（URL/未設定）にしました。");
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
      setNewFolderId("");
      router.push("/");
    }
  };

  const folderLabel = folderId && folderId.length > 0 ? folderId : "自動";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-5 pb-16 pt-10 sm:pt-14">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-ink-400">
          Cursorvers Capture
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tightest text-ink-50">
          設定
        </h1>
      </header>

      {statusMessage ? (
        <div
          aria-live="polite"
          className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-[13px] text-accent-soft"
        >
          {statusMessage}
        </div>
      ) : null}

      {/* Drive 接続 */}
      <SectionCard title="Drive 接続">
        <p className="flex items-center gap-2 text-[13px] text-ink-200">
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 rounded-full ${driveConnected ? "bg-emerald-400" : "bg-ink-500"}`}
          />
          {driveConnected ? "接続済み" : "未接続"}
        </p>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-[13px] font-medium text-red-200 transition hover:border-red-500/50 hover:bg-red-500/15"
        >
          Google からサインアウト
        </button>
      </SectionCard>

      {/* アップロード先フォルダ */}
      <SectionCard title="アップロード先フォルダ">
        <div className="flex flex-col gap-1">
          <p className="text-[12px] text-ink-300">現在の設定</p>
          <p className="break-all font-mono text-[13px] text-ink-100">
            {folderLabel}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="folder-id-input"
            className="text-[11px] uppercase tracking-[0.16em] text-ink-400"
          >
            フォルダ ID
          </label>
          <div className="flex gap-2">
            <input
              id="folder-id-input"
              type="text"
              value={newFolderId}
              onChange={(e) => setNewFolderId(e.target.value)}
              placeholder="例: 1AbCdEfGhIjKlMn..."
              className="flex-grow rounded-xl border border-hairline bg-ink-900 px-3 py-2.5 font-mono text-[12px] text-ink-100 placeholder:text-ink-500 focus:border-accent/50 focus:outline-none"
              aria-label="Google Drive フォルダ ID"
            />
            <button
              type="button"
              onClick={() => void handleSaveFolderId()}
              className="inline-flex h-[42px] items-center justify-center rounded-xl bg-accent-grad px-4 text-[13px] font-semibold text-white shadow-glow transition hover:-translate-y-px"
            >
              保存
            </button>
          </div>
          <p className="text-[11px] text-ink-400">
            空のまま保存で「自動」(URL の <code className="text-ink-300">?folder=</code>{" "}
            または未設定) に戻ります。
          </p>
        </div>

        {/* Folder ID 取得手順 hint */}
        <details className="group rounded-xl border border-hairline bg-ink-900/40 px-4 py-3">
          <summary className="cursor-pointer text-[12px] font-medium text-ink-200 marker:text-ink-500">
            Drive folder ID の取得方法
          </summary>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[12px] leading-relaxed text-ink-300">
            <li>
              <a
                href="https://drive.google.com/"
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent-soft underline-offset-2 hover:underline"
              >
                drive.google.com
              </a>{" "}
              で保存先にしたい folder を開く (or 新規作成)
            </li>
            <li>
              ブラウザのアドレスバー URL が{" "}
              <code className="break-all rounded bg-ink-800 px-1.5 py-0.5 text-[11px] text-ink-200">
                https://drive.google.com/drive/folders/<span className="text-accent-soft">1AbCd...</span>
              </code>{" "}
              の形になっている
            </li>
            <li>
              末尾の{" "}
              <span className="text-accent-soft">1AbCd...</span>{" "}
              部分 (英数字 25-33 桁) を copy
            </li>
            <li>上の「フォルダ ID」欄に貼り付けて「保存」</li>
          </ol>
          <p className="mt-3 text-[11px] text-ink-400">
            ※ アクセス権は <code className="text-ink-300">drive.file</code>{" "}
            scope (本アプリが新規作成した file のみ) のため、folder
            自体の中身は他のアプリから見えません。
          </p>
        </details>
      </SectionCard>

      {/* AI 補助 */}
      <SectionCard title="AI 補助 (OCR・音声)">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-ink-100">
            {aiAssist ? "有効" : "無効"}
          </span>
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
        </div>
        <p className="text-[11px] leading-relaxed text-ink-400">
          ON にすると OCR と音声メモ (長押し録音) の両方が有効になります。
          Codex へ一時送信されますが、保存はされません。
        </p>
      </SectionCard>

      {/* 詳細 */}
      <SectionCard title="詳細">
        <div className="flex flex-col gap-1 text-[12px]">
          <p className="text-ink-400">
            デバイス ID:{" "}
            <span className="break-all font-mono text-ink-200">{deviceId}</span>
          </p>
          <p className="text-ink-400">
            ショート:{" "}
            <span className="font-mono text-ink-200">{deviceShort}</span>
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] uppercase tracking-[0.16em] text-ink-400">
            最近の共有
          </h3>
          {shares.length === 0 ? (
            <p className="text-[12px] text-ink-500">共有履歴はありません。</p>
          ) : (
            <div className="max-h-48 overflow-auto text-[12px]">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline py-2 last:border-b-0"
                >
                  <span className="break-all text-ink-200">{share.filename}</span>
                  <button
                    type="button"
                    onClick={() =>
                      void handleRevokeShare(share.driveFileId, share.permissionId)
                    }
                    className="shrink-0 text-[12px] text-red-300 transition hover:text-red-200"
                  >
                    取消
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleClearAllData()}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-hairline bg-ink-900/60 text-[12px] font-medium text-ink-200 transition hover:border-white/20 hover:bg-ink-900"
        >
          全てのローカルデータを消去
        </button>
      </SectionCard>

      {/* Nav */}
      <nav className="flex flex-col items-center gap-2.5 pt-2">
        <Link
          href="/insights"
          className="text-[13px] text-accent-soft underline-offset-2 hover:underline"
        >
          振り返り / insights
        </Link>
        <Link
          href="/advisory"
          className="text-[13px] text-accent-soft underline-offset-2 hover:underline"
        >
          Advisory
        </Link>
        <Link
          href="/"
          className="mt-2 text-[12px] text-ink-400 transition hover:text-ink-200"
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
        <div className="mx-auto flex max-w-md flex-col gap-4 px-5 pt-10">
          <div className="h-6 w-24 animate-pulse rounded-full bg-ink-800" />
          <div className="h-9 w-40 animate-pulse rounded-lg bg-ink-800" />
          <div className="h-24 w-full animate-pulse rounded-2xl bg-ink-800" />
          <div className="h-24 w-full animate-pulse rounded-2xl bg-ink-800" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
