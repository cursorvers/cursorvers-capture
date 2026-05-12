"use client";

import { SignInButton } from "@/app/components/SignInButton";
import { getDeviceShort } from "@/app/lib/device";
import { idbGet, idbPut } from "@/app/lib/idb";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ConfigFolderRecord = { key: "folder_id"; value: string };

function HomeContent(): JSX.Element {
  const searchParams = useSearchParams();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [deviceShort, setDeviceShort] = useState("--------");

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

  const folderLabel = folderId && folderId.length > 0 ? folderId : "未設定";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Gdrive Uploader</h1>
      <p className="text-sm leading-relaxed text-neutral-400">
        撮影 → 指定の Google Drive へ即アップロード
      </p>
      <div className="flex w-full flex-col gap-3 pt-2">
        <SignInButton />
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-xl bg-neutral-800 px-4 py-3 text-sm font-medium opacity-60"
        >
          📷 撮影 (S3)
        </button>
      </div>
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
      <p className="mt-4 text-xs text-neutral-500">v0.2 — S2 OAuth</p>
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
