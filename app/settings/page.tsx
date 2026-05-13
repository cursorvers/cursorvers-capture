"use client";

import { useState, useEffect, type JSX } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { idbGet, idbPut, idbClear, idbDelete } from "@/app/lib/idb";
import { getOcrEnabled, setOcrEnabled as setOcrEnabledStore } from "@/app/lib/ocr-toggle";
import { getAudioEnabled, setAudioEnabled as setAudioEnabledStore } from "@/app/lib/audio-toggle";
import { getDeviceShort, getDeviceId } from "@/app/lib/device";
import { revokeToken, getCurrentToken } from "@/app/lib/gis";
import { getShareHistory, revokeFromHistory, type ShareRecord } from "@/app/lib/share-history";

type ConfigFolderRecord = { key: "folder_id"; value: string };

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
      const existingFolder = await idbGet<ConfigFolderRecord>("config", "folder_id");
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

  const handleRevokeShare = async (driveFileId: string, permissionId: string) => {
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <h1 className="text-center text-2xl font-semibold tracking-tight">設定</h1>

      {statusMessage ? (
        <div
          aria-live="polite"
          className="rounded-xl border border-blue-800 bg-blue-900/20 px-4 py-3 text-sm text-blue-200"
        >
          {statusMessage}
        </div>
      ) : null}

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-left text-sm">
        <h2 className="mb-2 font-medium text-neutral-200">Drive 接続</h2>
        <p className="text-xs text-neutral-400">
          状態:{" "}
          <span className="text-neutral-200">
            {driveConnected ? "接続済み" : "未接続"}
          </span>
        </p>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-3 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Google からサインアウト
        </button>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-left text-sm">
        <h2 className="mb-2 font-medium text-neutral-200">アップロード先フォルダ</h2>
        <p className="mb-2 text-xs text-neutral-500">
          現在: <span className="font-mono text-neutral-300">{folderLabel}</span>
          <span className="block text-[11px] text-neutral-600">
            空で保存すると URL パラメータまたは未設定のまま（自動）です。
          </span>
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newFolderId}
            onChange={(e) => setNewFolderId(e.target.value)}
            placeholder="フォルダ ID（空で自動）"
            className="flex-grow rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200"
            aria-label="Google Drive フォルダ ID"
          />
          <button
            type="button"
            onClick={() => void handleSaveFolderId()}
            className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-left text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium text-neutral-200">AI 補助（OCR・音声）</span>
          <button
            type="button"
            role="switch"
            aria-checked={aiAssist}
            onClick={() => void handleAiToggle()}
            className={`${aiAssist ? "bg-blue-600" : "bg-neutral-700"} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
          >
            <span className="sr-only">AI 補助のオン・オフ</span>
            <span
              className={`${aiAssist ? "translate-x-6" : "translate-x-1"} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </button>
        </div>
        <p className="mt-2 text-[11px] text-neutral-500">
          ON にすると OCR と音声メモ（長押し録音）の両方が有効になります。Codex へ一時送信（保存しません）。
        </p>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-left text-sm">
        <h2 className="mb-2 font-medium text-neutral-200">詳細</h2>
        <p className="mb-1 text-xs text-neutral-500">
          デバイス ID:{" "}
          <span className="break-all font-mono text-neutral-300">{deviceId}</span>
        </p>
        <p className="mb-3 text-xs text-neutral-500">
          ショート: <span className="font-mono text-neutral-300">{deviceShort}</span>
        </p>

        <h3 className="mb-2 text-xs font-medium text-neutral-300">最近の共有</h3>
        {shares.length === 0 ? (
          <p className="text-xs text-neutral-600">共有履歴はありません。</p>
        ) : (
          <div className="max-h-48 overflow-auto text-xs">
            {shares.map((share) => (
              <div
                key={share.id}
                className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-2"
              >
                <span className="break-all text-neutral-300">{share.filename}</span>
                <button
                  type="button"
                  onClick={() => void handleRevokeShare(share.driveFileId, share.permissionId)}
                  className="shrink-0 text-red-400 hover:text-red-300"
                >
                  取消
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleClearAllData()}
          className="mt-4 w-full rounded-lg bg-neutral-700 px-4 py-2 text-sm text-white hover:bg-neutral-600"
        >
          全てのローカルデータを消去
        </button>
      </section>

      <nav className="flex flex-col gap-2 text-center text-sm">
        <Link href="/insights" className="text-orange-400 underline hover:text-orange-300">
          振り返り / insights
        </Link>
        <Link href="/advisory" className="text-orange-400 underline hover:text-orange-300">
          Advisory
        </Link>
      </nav>

      <p className="text-center text-[11px] text-neutral-500">
        <Link href="/privacy" className="underline hover:text-neutral-300">
          Privacy
        </Link>
        {" · "}
        <Link href="/terms" className="underline hover:text-neutral-300">
          Terms
        </Link>
      </p>

      <Link href="/" className="text-center text-sm text-blue-400 hover:underline">
        ← ホーム
      </Link>
    </main>
  );
}

export default function Settings(): JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md animate-pulse p-6 text-neutral-500">
          読み込み中…
        </main>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
