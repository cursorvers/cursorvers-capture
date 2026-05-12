"use client";

import { useTier } from "@/app/lib/tier";

import { CameraButton } from "@/app/components/CameraButton";
import { SignInButton } from "@/app/components/SignInButton";
import { Suspense, useCallback, useEffect, useState, type JSX } from "react";
import { useSearchParams } from "next/navigation";
import { idbGet, idbPut } from "@/app/lib/idb";
import { getDeviceShort } from "@/app/lib/device";
import { getCurrentToken } from "@/app/lib/gis";
import { uploadBlob } from "@/app/lib/drive"; // Import uploadBlob
import { Chatback } from "@/app/components/Chatback"; // Import Chatback component

type ConfigFolderRecord = { key: "folder_id"; value: string }; // Re-added type definition

// ... (rest of the imports)

function HomeContent(): JSX.Element {
  const searchParams = useSearchParams();
  const { tier } = useTier(); // Call useTier hook
  const [folderId, setFolderId] = useState<string | null>(null);
  const [deviceShort, setDeviceShort] = useState("--------");
  const [signedIn, setSignedIn] = useState(false);
  const [lastCapture, setLastCapture] = useState<{
    filename: string;
    shot_at: number;
  } | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null); // NEW
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [newFolderId, setNewFolderId] = useState('');
  const [currentOrigin, setCurrentOrigin] = useState(''); // NEW

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }
  }, []); // Run once on client-side mount

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOffline(!navigator.onLine); // Initial check

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const folderParam = searchParams.get("folder")?.trim() ?? "";

      if (folderParam) {
        if (!cancelled) {
          setFolderId(folderParam); // Immediately set for display
        }
        // Then, asynchronously handle IDB for persistence
        void (async () => {
          const existing = await idbGet<ConfigFolderRecord>("config", "folder_id");
          if (existing?.value !== folderParam) {
            await idbPut<ConfigFolderRecord>("config", {
              key: "folder_id",
              value: folderParam,
            });
          }
        })();
      } else {
        // If no URL param, try to load from IDB
        void (async () => {
          const existing = await idbGet<ConfigFolderRecord>("config", "folder_id");
          if (!cancelled) {
            setFolderId(existing?.value ?? null);
          }
        })();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    setDeviceShort(getDeviceShort());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function syncSignedIn(): Promise<void> {
      const tok = await getCurrentToken();
      if (!cancelled) {
        setSignedIn(tok !== null);
      }
    }
    void syncSignedIn();
    const id = setInterval(() => void syncSignedIn(), 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const handleCaptured = useCallback(
    async (blob: Blob, filename: string, shot_at: number): Promise<void> => {
      console.log("S3 capture", { blob, filename, shot_at });
      setLastCapture({ filename, shot_at });
      setStatusMessage(`「${filename}」を撮影しました。`);
      setUploadedFileId(null); // Reset before new upload

      if (!folderId) {
        setStatusMessage('エラー: フォルダIDが設定されていません。');
        return;
      }

      try {
        setStatusMessage('Google Driveへアップロード中…');
        const { fileId } = await uploadBlob(blob, filename, folderId);
        console.log('Upload complete, file ID:', fileId);

        setUploadedFileId(fileId);
        setStatusMessage('✅ アップロード完了');

        // Dispatch to capture-webhook
        const sha1 = 'dummy-sha1'; // Placeholder, replace with actual SHA1 hash if available
        const webhookResponse = await fetch('/api/capture-webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_WEBHOOK_SECRET || 'dummy-secret'}`, // Use NEXT_PUBLIC_ for client-side
          },
          body: JSON.stringify({
            drive_file_id: fileId,
            filename,
            mime: 'image/jpeg',
            size: blob.size,
            shot_at,
            sha1,
          }),
        });

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text();
          console.error('Webhook dispatch failed:', errorText);
          // Do not update statusMessage on webhook failure, as per spec (Tier B is additive)
        }
      } catch (error) {
        console.error('Upload or webhook failed:', error);
        setStatusMessage(`アップロードまたは処理に失敗しました: ${(error as Error).message}`);
      }
    },
    [folderId],
  );

  const folderLabel = folderId && folderId.length > 0 ? folderId : "未設定";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center bg-navy-900 text-gray-100">
      <div className="mb-4 text-center">
        <h1 className="text-4xl font-extrabold text-orange-400 tracking-tight leading-tight">
          Cursorvers Receipt
        </h1>
        <p className="mt-2 text-lg text-gray-300">
          撮影 → 指定の Drive フォルダへ即同期
        </p>
        <span
          className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold ${tier === 'pro' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black' : 'bg-gray-700 text-gray-200'}`}
        >
          {tier === 'pro' ? 'PRO' : 'FREE'}
        </span>
      </div>

      {isOffline && (
        <div className="w-full rounded-xl border border-yellow-800 bg-yellow-900/20 px-4 py-3 text-left text-sm text-yellow-300">
          <p className="font-semibold">オフラインです。</p>
          <p className="mt-1 text-xs">ネットワーク接続を確認してください。</p>
        </div>
      )}

      {!signedIn && folderId !== null && ( // if not signed in, but folder is set, prompt for sign in
        <div className="w-full rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-left text-sm text-red-300">
          <p className="font-semibold">サインインしていません。</p>
          <p className="mt-1 text-xs">Googleアカウントにサインインして続行してください。</p>
        </div>
      )}

      {folderId === null && (
        <div className="w-full rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-left text-sm text-red-300">
          <p>
            <span className="font-semibold">エラー:</span> フォルダ ID が設定されていません。
          </p>
          <p className="mt-2 text-xs">
            アップロード先の Google Drive フォルダ ID を入力してください。
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={newFolderId}
              onChange={(e) => setNewFolderId(e.target.value)}
              placeholder="フォルダIDを入力"
              className="flex-grow rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none"
              aria-label="Google Drive フォルダ ID"
            />
            <button
              type="button"
              onClick={async () => {
                if (newFolderId.trim()) {
                  await idbPut<ConfigFolderRecord>("config", {
                    key: "folder_id",
                    value: newFolderId.trim(),
                  });
                  setFolderId(newFolderId.trim());
                  setNewFolderId('');
                  setStatusMessage(`フォルダ ID を「${newFolderId.trim()}」に設定しました。`);
                }
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
              aria-label="フォルダIDを保存"
            >
              保存
            </button>
          </div>
        </div>
      )}
      <div className="flex w-full flex-col gap-3 pt-2">
        <SignInButton aria-label="Googleアカウントでサインイン" />
        {signedIn ? (
          <CameraButton
            deviceShort={deviceShort}
            onCaptured={handleCaptured}
          />
        ) : (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-xl bg-neutral-800 px-4 py-3 text-sm font-medium opacity-60"
            aria-label="サインイン後にカメラを起動"
            data-testid="camera-button-disabled"
          >
            📷 撮影 (S3)
          </button>
        )}
      </div>

      {lastCapture ? (
        <p className="w-full rounded-xl border border-neutral-800 bg-neutral-900/20 px-4 py-2 text-left text-xs text-neutral-400">
          <span className="text-neutral-500">前回の撮影:</span>{" "}
          <span className="font-mono text-neutral-200">
            {lastCapture.filename}
          </span>
          <span className="mt-1 block text-neutral-500">
            shot_at:{" "}
            <span className="font-mono text-neutral-300">
              {lastCapture.shot_at}
            </span>
          </span>
        </p>
      ) : null}

      {statusMessage === '✅ アップロード完了' && uploadedFileId && (
        <Chatback driveFileId={uploadedFileId} />
      )}

      <div className="w-full rounded-xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-left text-xs text-neutral-400" data-testid="status-panel">
        <p>
          <span className="text-neutral-500">設定:</span> フォルダ ID ={" "}
          <span className="font-mono text-neutral-200" data-testid="folder-id-display">{folderLabel}</span>
        </p>
        <p className="mt-1">
          <span className="text-neutral-500">デバイス:</span>{" "}
          <span className="font-mono text-neutral-200">{deviceShort}</span>
        </p>
      </div>

      <div className="w-full">
        <details className="rounded-xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-left text-xs text-neutral-400">
          <summary className="cursor-pointer text-neutral-200">
            シェア方法を詳しく見る
          </summary>
          <div className="mt-2 text-neutral-400">
            <p className="mb-2">
              このアプリを友達とシェアするには、以下の URL を送るだけです。彼らも自分の Google アカウントでログインして、このフォルダ ID を入力すれば、一緒にアップロードできます。
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={
                  folderId
                    ? `${currentOrigin}/?folder=${folderId}`
                    : currentOrigin
                }
                className="flex-grow rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-200"
                aria-label="シェアリンク"
              />
              <button
                type="button"
                onClick={async () => {
                  const shareUrl = folderId
                    ? `${currentOrigin}/?folder=${folderId}`
                    : currentOrigin;

                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: 'Gdrive Uploader',
                        text: 'Google Drive Uploaderで写真をシェア！',
                        url: shareUrl,
                      });
                      setStatusMessage('シェアリンクを送信しました！');
                    } catch (error) {
                      console.error('Error sharing:', error);
                      setStatusMessage('シェアに失敗しました。クリップボードにコピーします。');
                      await navigator.clipboard.writeText(shareUrl);
                      setStatusMessage('シェアリンクをクリップボードにコピーしました！');
                    }
                  } else {
                    await navigator.clipboard.writeText(shareUrl);
                    setStatusMessage('シェアリンクをクリップボードにコピーしました！');
                  }
                }}
                className="rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
                aria-label="シェアリンクをコピー"
              >
                コピー
              </button>
            </div>
          </div>
        </details>
      </div>
      <p className="mt-4 text-xs text-neutral-500">v0.3 — S3 camera</p>
      <div
        aria-live="polite"
        className="sr-only"
      >
        {statusMessage}
      </div>
    </main>
  );
}

export default function Home(): JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center animate-pulse">
          <div className="h-8 bg-neutral-800 rounded-md w-48 mb-4"></div>
          <div className="h-4 bg-neutral-800 rounded-md w-64 mb-8"></div>
          <div className="flex w-full flex-col gap-3 pt-2">
            <div className="h-12 bg-neutral-700 rounded-xl w-full"></div>
            <div className="h-12 bg-neutral-700 rounded-xl w-full"></div>
          </div>
          <div className="w-full rounded-xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-left text-xs text-neutral-400">
            <div className="h-4 bg-neutral-800 rounded-md w-32 mb-1"></div>
            <div className="h-4 bg-neutral-800 rounded-md w-48"></div>
          </div>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
