"use client";

import { buildFilename } from "@/app/lib/filename";
import { sha1Short } from "@/app/lib/hash";
import {
  getPreferredMimeType,
  isAudioRecordingSupported,
} from "@/app/lib/audio";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type JSX,
} from "react";

const LONG_PRESS_MS = 800;
const RECORD_MAX_SEC = 15;
const COUNT_TICK_MS = 100;

type CameraButtonProps = {
  deviceShort: string;
  audioNoteEnabled?: boolean;
  hidePreview?: boolean;
  hero?: boolean;
  onCaptured: (
    blob: Blob,
    filename: string,
    shot_at: number,
    audioBlob?: Blob,
    batch?: { index: number; total: number },
  ) => void | Promise<void>;
};

export function CameraButton({
  deviceShort,
  audioNoteEnabled = false,
  hidePreview = false,
  hero = false,
  onCaptured,
}: CameraButtonProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filenameLabel, setFilenameLabel] = useState("");

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const pendingAudioRef = useRef<Blob | null>(null);
  const suppressClickRef = useRef(false);
  const micWarmupAbortRef = useRef(false);
  const longPressActivatedRef = useRef(false);
  const recordingActiveRef = useRef(false);

  const [isRecording, setIsRecording] = useState(false);
  const [countdownSec, setCountdownSec] = useState(RECORD_MAX_SEC);

  function clearHoldTimer(): void {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function clearCountdownInterval(): void {
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }

  function stopMediaTracks(): void {
    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }

  const finalizeRecording = (): void => {
    clearCountdownInterval();
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      return;
    }
    stopMediaTracks();
    recordingActiveRef.current = false;
    setIsRecording(false);
  };

  const startRecording = async (): Promise<void> => {
    clearHoldTimer();
    if (!isAudioRecordingSupported()) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (micWarmupAbortRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        longPressActivatedRef.current = false;
        return;
      }
      mediaStreamRef.current = stream;
      const mimeType = getPreferredMimeType();
      mimeTypeRef.current = mimeType;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        if (blob.size > 0) {
          pendingAudioRef.current = blob;
        }
        chunksRef.current = [];
        recordingActiveRef.current = false;
        stopMediaTracks();
        setIsRecording(false);
        suppressClickRef.current = true;
      };

      recorder.start();
      recordingActiveRef.current = true;
      setIsRecording(true);
      setCountdownSec(RECORD_MAX_SEC);

      const startedAt = Date.now();
      countdownIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        const left = Math.max(0, RECORD_MAX_SEC - elapsed);
        setCountdownSec(left);
        if (left <= 0) {
          finalizeRecording();
        }
      }, COUNT_TICK_MS);
    } catch {
      stopMediaTracks();
      setIsRecording(false);
    }
  };

  function isAudioCaptureActive(): boolean {
    if (audioNoteEnabled) {
      return true;
    }
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("audio_note_enabled") === "true";
  }

  function onPointerHoldStart(): void {
    if (!isAudioCaptureActive() || isRecording) {
      return;
    }
    micWarmupAbortRef.current = false;
    longPressActivatedRef.current = false;
    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      longPressActivatedRef.current = true;
      void startRecording();
    }, LONG_PRESS_MS);
  }

  function onPointerHoldEnd(): void {
    clearHoldTimer();
    if (recordingActiveRef.current) {
      finalizeRecording();
      return;
    }
    if (longPressActivatedRef.current) {
      micWarmupAbortRef.current = true;
    }
  }

  useEffect(() => {
    return () => {
      clearHoldTimer();
      clearCountdownInterval();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.stop();
      }
      stopMediaTracks();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  async function processSelectedFile(
    file: File,
    audioBlob?: Blob,
    batch?: { index: number; total: number },
  ): Promise<void> {
    const { processCapturedFile, CameraCaptureError } = await import(
      "@/app/lib/camera"
    );
    let blob: Blob;
    let shot_at: number;
    try {
      const processed = await processCapturedFile(file);
      blob = processed.blob;
      shot_at = processed.shot_at;
    } catch (err) {
      if (err instanceof CameraCaptureError) {
        const msg =
          err.code === "unsupported_type"
            ? "画像ファイルを選択してください (動画や他形式は未対応)"
            : err.code === "empty_file"
              ? "ファイルの読み込みに失敗しました。もう一度撮影してください"
              : "画像の処理に失敗しました。別の写真でお試しください";
        if (typeof window !== "undefined") {
          window.alert(msg);
        }
        return;
      }
      throw err;
    }
    const short = await sha1Short(blob);
    const filename = buildFilename(shot_at, short, deviceShort);

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFilenameLabel(filename);

    await onCaptured(blob, filename, shot_at, audioBlob, batch);
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }

    const pendingAudio = pendingAudioRef.current;
    pendingAudioRef.current = null;
    await processSelectedFile(file, pendingAudio ?? undefined);
  }

  async function onLibraryFileChange(
    e: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const total = files.length;
    for (let index = 0; index < total; index += 1) {
      await processSelectedFile(files[index], undefined, {
        index: index + 1,
        total,
      });
    }
  }

  function handleButtonClick(): void {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (isRecording) {
      return;
    }
    inputRef.current?.click();
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(ev) => void onFileChange(ev)}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(ev) => void onLibraryFileChange(ev)}
      />
      <div className="relative w-full">
        {isRecording ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-4 backdrop-blur-md"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 text-red-100">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-400"
              />
              <span className="text-sm font-semibold tracking-tight">録音中</span>
            </div>
            <p className="font-mono text-2xl tabular-nums text-red-50">
              {countdownSec.toFixed(1)}
            </p>
            <p className="text-center text-[11px] text-red-100/70">
              指を離すと録音終了
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleButtonClick}
          data-testid="camera-capture-hero"
          onTouchStart={() => onPointerHoldStart()}
          onTouchEnd={() => onPointerHoldEnd()}
          onTouchCancel={() => onPointerHoldEnd()}
          onMouseDown={() => onPointerHoldStart()}
          onMouseUp={() => onPointerHoldEnd()}
          onMouseLeave={() => {
            if (isRecording) {
              finalizeRecording();
            } else {
              clearHoldTimer();
            }
          }}
          className={
            hero
              ? "group relative inline-flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-accent-grad px-6 text-[15px] font-semibold tracking-tight text-white shadow-glow transition active:scale-[0.98] hover:-translate-y-px hover:shadow-[0_0_44px_-4px_rgba(249,115,22,0.5)]"
              : "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-ink-800/60 px-4 text-sm font-medium text-ink-100 transition hover:border-white/20 hover:bg-ink-800"
          }
        >
          <span aria-hidden className="text-base">📷</span>
          <span>撮影する</span>
        </button>
      </div>
      <button
        type="button"
        onClick={() => libraryInputRef.current?.click()}
        data-testid="library-upload-button"
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-ink-800/60 px-4 text-sm font-medium text-ink-100 transition hover:border-white/20 hover:bg-ink-800"
      >
        <span aria-hidden className="text-base">▦</span>
        <span>ライブラリから選択</span>
      </button>
      {!hidePreview && previewUrl ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-hairline bg-ink-800/40 px-3 py-3 shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob preview */}
          <img
            src={previewUrl}
            alt="撮影プレビュー"
            className="max-h-64 w-auto rounded-lg"
          />
          <p className="break-all text-[11px] text-ink-400">{filenameLabel}</p>
        </div>
      ) : null}
    </div>
  );
}
