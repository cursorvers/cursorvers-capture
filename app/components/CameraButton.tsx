"use client";

import { buildFilename } from "@/app/lib/filename";
import { sha1Short } from "@/app/lib/hash";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type JSX,
} from "react";

type CameraButtonProps = {
  deviceShort: string;
  onCaptured: (blob: Blob, filename: string, shot_at: number) => void;
};

export function CameraButton({
  deviceShort,
  onCaptured,
}: CameraButtonProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filenameLabel, setFilenameLabel] = useState("");

  useEffect(() => {
    return () => {
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

    onCaptured(blob, filename, shot_at);
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
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-xl bg-neutral-800 px-4 py-3 text-sm font-medium hover:bg-neutral-700"
      >
        📷 撮影 (S3)
      </button>
      {previewUrl ? (
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
