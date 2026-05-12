"use client";

import { CameraButton } from "@/app/components/CameraButton";
import { SignInButton } from "@/app/components/SignInButton";
import { getDeviceShort } from "@/app/lib/device";
import { getCurrentToken } from "@/app/lib/gis";
import { idbGet, idbPut } from "@/app/lib/idb";
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type JSX,
} from "react";
import { useSearchParams } from "next/navigation";

type ConfigFolderRecord = { key: "folder_id"; value: string };

function HomeContent(): JSX.Element {
  const searchParams = useSearchParams();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [deviceShort, setDeviceShort] = useState("--------");
  const [signedIn, setSignedIn] = useState(false);
  const [lastCapture, setLastCapture] = useState<{
    filename: string;
    shot_at: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const folderParam = searchParams.get("folder")?.trim() ?? "";
      const existing = await idbGet<ConfigFolderRecord>("config", "folder_id");
      if (folderParam && existing?.value !== folderParam) {
        await idbPut<ConfigFolderRecord>("config", {
          key: "folder_id",
          value: folderParam,
        });
      }
      const latest = await idbGet<ConfigFolderRecord>("config", "folder_id");
      if (!cancelled) {
        setFolderId(latest?.value ?? null);
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
    (blob: Blob, filename: string, shot_at: number): void => {
      console.log("S3 capture", { blob, filename, shot_at });
      setLastCapture({ filename, shot_at });
    },
    [],
  );

  const folderLabel = folderId && folderId.length > 0 ? folderId : "未設定";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Gdrive Uploader</h1>
      <p className="text-sm leading-relaxed text-neutral-400">
        撮影 → JPEG を端末内で保持（S3）。Drive アップロードは次フェーズ。
      </p>
      <div className="flex w-full flex-col gap-3 pt-2">
        <SignInButton />
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

      <div className="w-full rounded-xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-left text-xs text-neutral-400">
        <p>
          <span className="text-neutral-500">設定:</span> フォルダ ID ={" "}
          <span className="font-mono text-neutral-200">{folderLabel}</span>
        </p>
        <p className="mt-1">
          <span className="text-neutral-500">デバイス:</span>{" "}
          <span className="font-mono text-neutral-200">{deviceShort}</span>
        </p>
      </div>
      <p className="mt-4 text-xs text-neutral-500">v0.3 — S3 camera</p>
    </main>
  );
}

export default function Home(): JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-neutral-400">
          読み込み中…
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
