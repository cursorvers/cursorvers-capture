"use client";

import dynamic from "next/dynamic";
import { CameraButton } from "@/app/components/CameraButton";
import { SignInButton } from "@/app/components/SignInButton";
import { Suspense, useCallback, useEffect, useState, type JSX } from "react";
import { useSearchParams } from "next/navigation";
import { idbGet, idbPut } from "@/app/lib/idb";
import { getDeviceShort } from "@/app/lib/device";
import { getCurrentToken } from "@/app/lib/gis";
import { uploadBlob } from "@/app/lib/drive";
import { Chatback } from "@/app/components/Chatback";
import { OcrPanel } from "@/app/components/OcrPanel";
import { getAudioEnabled } from "@/app/lib/audio-toggle";
import { getOcrEnabled } from "@/app/lib/ocr-toggle";

const AudioPanel = dynamic(
  () => import("@/app/components/AudioPanel").then((mod) => mod.AudioPanel),
  { ssr: false },
);

type ConfigFolderRecord = { key: "folder_id"; value: string };

function HomeContent(): JSX.Element {
  const searchParams = useSearchParams();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [deviceShort, setDeviceShort] = useState("--------");
  const [signedIn, setSignedIn] = useState(false);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [captureAudioBlob, setCaptureAudioBlob] = useState<Blob | null>(null);
  const [ocrOn, setOcrOn] = useState(false);
  const [audioOn, setAudioOn] = useState(false);

  useEffect(() => {
    void getOcrEnabled().then(setOcrOn);
    void getAudioEnabled().then(setAudioOn);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const folderParam = searchParams.get("folder")?.trim() ?? "";

      if (folderParam) {
        if (!cancelled) {
          setFolderId(folderParam);
        }
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
    async (
      blob: Blob,
      filename: string,
      shot_at: number,
      audioBlob?: Blob,
    ): Promise<void> => {
      setStatusMessage(`「${filename}」を処理中…`);
      setUploadedFileId(null);
      setImageBase64(null);
      setCaptureAudioBlob(null);

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result;
        if (typeof base64data === "string") {
          setImageBase64(
            base64data.replace(/^data:image\/(png|jpeg|gif|webp);base64,/, ""),
          );
        }
      };

      if (!folderId) {
        setStatusMessage("アップロード先フォルダが未設定です。設定で指定してください。");
        return;
      }

      try {
        setStatusMessage("Google Driveへアップロード中…");
        const { fileId } = await uploadBlob(blob, filename, folderId);

        setUploadedFileId(fileId);
        setStatusMessage("アップロード完了");
        if (audioBlob) {
          setCaptureAudioBlob(audioBlob);
        }

        const sha1 = "dummy-sha1";
        const webhookResponse = await fetch("/api/capture-webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_WEBHOOK_SECRET || "dummy-secret"}`,
          },
          body: JSON.stringify({
            drive_file_id: fileId,
            filename,
            mime: "image/jpeg",
            size: blob.size,
            shot_at,
            sha1,
            chatgpt_user_id: "",
          }),
        });

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text();
          console.error("Webhook dispatch failed:", errorText);
        }
      } catch (error) {
        console.error("Upload or webhook failed:", error);
        const msg = error instanceof Error ? error.message : String(error);
        setStatusMessage(`失敗: ${msg}`);
      }
    },
    [folderId],
  );

  const aiAssist = ocrOn && audioOn;

  const assistExpandedContent =
    aiAssist && uploadedFileId && imageBase64 ? (
      <>
        <OcrPanel driveFileId={uploadedFileId} imageBase64={imageBase64} />
        {captureAudioBlob ? (
          <AudioPanel driveFileId={uploadedFileId} audioBlob={captureAudioBlob} />
        ) : null}
      </>
    ) : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 bg-navy-900 p-6 text-center text-gray-100">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-orange-400">
          Cursorvers Capture
        </h1>
        <p className="text-xs text-neutral-500">レシートを撮影して Drive へ保存</p>
      </div>

      {isOffline ? (
        <p className="text-xs text-amber-200/90">オフラインです。接続を確認してください。</p>
      ) : null}

      <div className="flex w-full flex-col items-stretch gap-4">
        <SignInButton minimal />
        {signedIn ? (
          <CameraButton
            deviceShort={deviceShort}
            audioNoteEnabled={audioOn}
            hidePreview
            hero
            onCaptured={handleCaptured}
          />
        ) : (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-2xl bg-neutral-800 px-6 py-5 text-lg font-semibold opacity-60"
            aria-label="サインイン後にカメラを起動"
            data-testid="camera-button-disabled"
          >
            📷 撮影する
          </button>
        )}
      </div>

      {uploadedFileId ? (
        <Chatback
          driveFileId={uploadedFileId}
          assistExpandedContent={assistExpandedContent}
        />
      ) : null}

      <div aria-live="polite" className="sr-only">
        {statusMessage}
      </div>
    </main>
  );
}

export default function Home(): JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md animate-pulse flex-col items-center justify-center gap-8 p-6">
          <div className="h-10 w-56 rounded-md bg-neutral-800" />
          <div className="h-14 w-full rounded-2xl bg-neutral-800" />
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
