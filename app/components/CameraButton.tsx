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
  ) => void;
};

export function CameraButton({
  deviceShort,
  audioNoteEnabled = false,
  hidePreview = false,
  hero = false,
  onCaptured,
}: CameraButtonProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
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

  async function onFileChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }

    const { processCapturedFile } = await import("@/app/lib/camera");
    const { blob, shot_at } = await processCapturedFile(file);
    const short = await sha1Short(blob);
    const filename = buildFilename(shot_at, short, deviceShort);

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFilenameLabel(filename);

    const pendingAudio = pendingAudioRef.current;
    pendingAudioRef.current = null;

    if (pendingAudio) {
      onCaptured(blob, filename, shot_at, pendingAudio);
    } else {
      onCaptured(blob, filename, shot_at);
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
      <div className="relative w-full">
        {isRecording ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border border-red-700 bg-black/80 px-3 py-4">
            <div className="flex items-center gap-2 text-red-400">
              <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
              <span className="text-sm font-semibold">録音中</span>
            </div>
            <p className="font-mono text-lg text-white">
              {countdownSec.toFixed(1)}
            </p>
            <p className="text-center text-xs text-neutral-400">
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
              ? "w-full rounded-2xl bg-orange-500 px-6 py-5 text-lg font-semibold text-white shadow-lg hover:bg-orange-600"
              : "w-full rounded-xl bg-neutral-800 px-4 py-3 text-sm font-medium hover:bg-neutral-700"
          }
        >
          📷 撮影する
        </button>
      </div>
      {!hidePreview && previewUrl ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/30 px-3 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob preview */}
          <img
            src={previewUrl}
            alt=""
            className="h-20 w-20 rounded-lg object-cover"
          />
          <p className="break-all text-center text-xs font-mono text-neutral-300">
            {filenameLabel}
          </p>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-xl bg-neutral-800 px-4 py-2 text-xs font-medium opacity-60"
          >
            Upload (S4)
          </button>
        </div>
      ) : null}
    </div>
  );
}
