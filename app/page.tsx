"use client";

import dynamic from "next/dynamic";
import { CameraButton } from "@/app/components/CameraButton";
import { SignInButton } from "@/app/components/SignInButton";
import { Suspense, useCallback, useEffect, useState, type JSX } from "react";
import Link from "next/link";
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

function StatusPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn";
}): JSX.Element {
  const dot =
    tone === "ok"
      ? "bg-emerald-400"
      : tone === "warn"
        ? "bg-amber-400"
        : "bg-ink-400";
  return (
    <div className="flex flex-col items-start gap-1 rounded-xl border border-hairline bg-ink-800/30 px-3 py-2.5">
      <span className="text-[10px] uppercase tracking-[0.16em] text-ink-400">
        {label}
      </span>
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-100">
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {value}
      </span>
    </div>
  );
}

function HomeContent(): JSX.Element {
  const searchParams = useSearchParams();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [deviceShort, setDeviceShort] = useState("--------");
  const [signedIn, setSignedIn] = useState(false);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [captureAudioBlob, setCaptureAudioBlob] = useState<Blob | null>(null);
  const [ocrOn, setOcrOn] = useState(false);
  const [audioOn, setAudioOn] = useState(false);

  useEffect(() => {
    void getOcrEnabled().then(setOcrOn);
    void getAudioEnabled().then(setAudioOn);
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
          const existing = await idbGet<ConfigFolderRecord>(
            "config",
            "folder_id",
          );
          if (existing?.value !== folderParam) {
            await idbPut<ConfigFolderRecord>("config", {
              key: "folder_id",
              value: folderParam,
            });
          }
        })();
      } else {
        void (async () => {
          const existing = await idbGet<ConfigFolderRecord>(
            "config",
            "folder_id",
          );
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
        setStatusMessage(
          "アップロード先フォルダが未設定です。設定で指定してください。",
        );
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
          <AudioPanel
            driveFileId={uploadedFileId}
            audioBlob={captureAudioBlob}
          />
        ) : null}
      </>
    ) : undefined;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-7 px-5 pb-16 pt-10 sm:pt-14">
      {/* Hero */}
      <section className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-hairline bg-white/[0.02] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-ink-300">
          <span aria-hidden className="h-1 w-1 rounded-full bg-accent" />
          drive.file scope · 招待制
        </span>
        <h1 className="font-display text-4xl font-semibold tracking-tightest text-ink-50 sm:text-[44px]">
          Cursorvers Capture
        </h1>
        <p className="max-w-sm text-[14px] leading-relaxed text-ink-300">
          撮影した画像を、サーバーを経由せず、あなたの Google Drive
          の指定フォルダへ直接保存します。
        </p>
      </section>

      {/* Status grid */}
      <section className="grid grid-cols-2 gap-2.5">
        <StatusPill
          label="Device"
          value={deviceShort}
          tone={signedIn ? "ok" : "neutral"}
        />
        <Link
          href="/settings"
          aria-label={
            folderId ? "アップロード先フォルダの設定を変更" : "アップロード先フォルダを設定"
          }
          className="group rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <StatusPill
            label="Folder"
            value={folderId ? `…${folderId.slice(-6)}` : "未設定 →"}
            tone={folderId ? "ok" : "warn"}
          />
        </Link>
      </section>

      {/* Sign-in + Capture stack */}
      <section className="flex flex-col gap-3">
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
            className="inline-flex h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-hairline bg-ink-800/30 text-[15px] font-semibold text-ink-400"
            aria-label="サインイン後にカメラを起動"
            data-testid="camera-button-disabled"
          >
            <span aria-hidden>📷</span>
            <span>撮影する</span>
          </button>
        )}
        {statusMessage ? (
          <p
            className="text-center text-[12px] text-ink-300"
            data-testid="capture-status"
          >
            {statusMessage}
          </p>
        ) : null}
      </section>

      {uploadedFileId ? (
        <section>
          <Chatback
            driveFileId={uploadedFileId}
            assistExpandedContent={assistExpandedContent}
          />
        </section>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {statusMessage}
      </div>
    </div>
  );
}

export default function Home(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-md flex-col gap-7 px-5 pt-10">
          <div className="h-6 w-32 animate-pulse rounded-full bg-ink-800" />
          <div className="h-12 w-72 animate-pulse rounded-lg bg-ink-800" />
          <div className="h-14 w-full animate-pulse rounded-2xl bg-ink-800" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
