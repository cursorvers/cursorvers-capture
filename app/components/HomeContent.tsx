"use client";

import { CameraButton } from "@/app/components/CameraButton";
import { CaptureAnalysisPanel } from "@/app/components/CaptureAnalysisPanel";
import {
  analyzeCapture,
  saveAnalysisToDrive,
  type CaptureAnalysis,
} from "@/app/lib/capture-analysis";
import {
  ensureRoutingFolder,
  moveDriveFile,
} from "@/app/lib/doc-routing";
import { buildCaptureRecord, putCapture } from "@/app/lib/captures-db";
import {
  autoApplyAiRename,
  type AutoRenameResult,
} from "@/app/lib/auto-rename";

import { SignInButton } from "@/app/components/SignInButton";
import { InviteBanner } from "@/app/components/InviteBanner";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { idbGet, idbPut } from "@/app/lib/idb";
import { getDeviceShort } from "@/app/lib/device";
import { getCurrentToken } from "@/app/lib/gis";
import { uploadBlob } from "@/app/lib/drive";

type ConfigFolderRecord = { key: "folder_id"; value: string };

type CaptureInflight = {
  file_id: string;
  drive_name: string;
  drive_url: string;
  state: "loading" | "ready" | "error";
  image?: Blob | null;
  audio?: Blob | null;
  retrying?: boolean;
  analysis: CaptureAnalysis | null;
  error: string | null;
};

type CaptureBatchProgress = { index: number; total: number };

type PersistResult = {
  routedToParent?: string;
  driveName: string;
  originalDriveName?: string;
  rename: AutoRenameResult;
};

const BACKOFF_RETRY_MS = 800;

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withOneBackoffRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (firstError) {
    await wait(BACKOFF_RETRY_MS);
    try {
      return await fn();
    } catch {
      throw firstError;
    }
  }
}

export function formatBatchFinalStatus(total: number, failures: number): string {
  const succeeded = total - failures;
  return `(${total}/${total}) 複数アップロード終了: 成功 ${succeeded}/${total}, 失敗 ${failures}`;
}

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
      <span className="text-[0.625rem] uppercase tracking-[0.16em] text-ink-400">
        {label}
      </span>
      <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-100">
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {value}
      </span>
    </div>
  );
}

export default function HomeContent(): JSX.Element {
  const searchParams = useSearchParams();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [deviceShort, setDeviceShort] = useState("--------");
  const [signedIn, setSignedIn] = useState(false);
  const [captures, setCaptures] = useState<CaptureInflight[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const batchFailureCountRef = useRef(0);
  const batchRenameFailureCountRef = useRef(0);

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

  const persistAnalysisAndRoute = useCallback(
    async (
      fileId: string,
      analysis: CaptureAnalysis,
      originalDriveName: string,
    ): Promise<PersistResult> => {
      const tok = await getCurrentToken();
      if (!tok) {
        return {
          driveName: originalDriveName,
          originalDriveName,
          rename: {
            driveName: originalDriveName,
            originalDriveName,
            status: "skipped",
          },
        };
      }

      void saveAnalysisToDrive(fileId, tok, analysis).catch((err) => {
        console.error("Drive description patch failed", err);
      });

      const rename = await autoApplyAiRename({
        fileId,
        accessToken: tok,
        originalDriveName,
        analysis,
      });

      if (!folderId) {
        return {
          driveName: rename.driveName,
          originalDriveName: rename.originalDriveName,
          rename,
        };
      }
      try {
        const target = await ensureRoutingFolder({
          doc_type: analysis.doc_type,
          parent_id: folderId,
          accessToken: tok,
        });
        if (target && target !== folderId) {
          await moveDriveFile({
            file_id: fileId,
            add_parent: target,
            remove_parent: folderId,
            accessToken: tok,
          });
          return {
            routedToParent: target,
            driveName: rename.driveName,
            originalDriveName: rename.originalDriveName,
            rename,
          };
        }
      } catch (err) {
        console.error("auto-route failed", err);
      }
      return {
        driveName: rename.driveName,
        originalDriveName: rename.originalDriveName,
        rename,
      };
    },
    [folderId],
  );

  const handleRetryAnalysis = useCallback(
    async (fileId: string): Promise<void> => {
      setCaptures((prev) =>
        prev.map((c) =>
          c.file_id === fileId
            ? { ...c, state: "loading" as const, error: null, retrying: true }
            : c,
        ),
      );
      const target = captures.find((c) => c.file_id === fileId);
      const blob = target?.image;
      const audioBlob = target?.audio ?? null;
      if (!blob) {
        setCaptures((prev) =>
          prev.map((c) =>
            c.file_id === fileId
              ? {
                  ...c,
                  state: "error" as const,
                  error: "画像が見つかりません。もう一度撮影してください。",
                  retrying: false,
                }
              : c,
          ),
        );
        return;
      }
      try {
        const result = await analyzeCapture({ image: blob, audio: audioBlob });
        const persisted = await persistAnalysisAndRoute(
          fileId,
          result,
          target.drive_name,
        );
        void putCapture(
          buildCaptureRecord({
            file_id: fileId,
            drive_name: persisted.driveName,
            original_drive_name: persisted.originalDriveName,
            drive_url: target.drive_url,
            parent_id: persisted.routedToParent ?? folderId ?? undefined,
            analysis: result,
            routed_to: persisted.routedToParent,
          }),
        ).catch((err) => console.error("captures IDB write failed", err));
        setCaptures((prev) =>
          prev.map((c) =>
            c.file_id === fileId
              ? {
                  ...c,
                  drive_name: persisted.driveName,
                  state: "ready" as const,
                  analysis: result,
                  retrying: false,
                }
              : c,
          ),
        );
        if (persisted.rename.status === "failed") {
          setStatusMessage(
            persisted.rename.isConflict
              ? "AI リネームは同名ファイルと衝突したため、元のファイル名を維持しました。"
              : "AI リネームに失敗したため、元のファイル名を維持しました。",
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setCaptures((prev) =>
          prev.map((c) =>
            c.file_id === fileId
              ? { ...c, state: "error" as const, error: msg, retrying: false }
              : c,
          ),
        );
      }
    },
    [captures, folderId, persistAnalysisAndRoute],
  );

  const handleCaptured = useCallback(
    async (
      blob: Blob,
      filename: string,
      shot_at: number,
      audioBlob?: Blob,
      batch?: CaptureBatchProgress,
    ): Promise<void> => {
      if (batch?.index === 1) {
        batchFailureCountRef.current = 0;
        batchRenameFailureCountRef.current = 0;
      }

      const progressLabel = batch ? `(${batch.index}/${batch.total}) ` : "";
      const captureLimit = Math.min(10, Math.max(5, batch?.total ?? 1));
      const uploadSessionId = `${filename}:${shot_at}:${Date.now()}:${Math.random()
        .toString(36)
        .slice(2)}`;
      setStatusMessage(`${progressLabel}「${filename}」を処理中…`);

      if (!folderId) {
        if (batch) {
          batchFailureCountRef.current += 1;
        }
        setStatusMessage(
          `${progressLabel}アップロード先フォルダが未設定です。設定で指定してください。`,
        );
        if (batch && batch.index === batch.total) {
          setStatusMessage(
            formatBatchFinalStatus(batch.total, batchFailureCountRef.current),
          );
        }
        return;
      }

      try {
        setStatusMessage(`${progressLabel}Google Driveへアップロード中…`);
        const { fileId } = await uploadBlob(blob, filename, folderId, undefined, {
          sessionId: uploadSessionId,
        });

        setStatusMessage(`${progressLabel}AI 解析中…`);
        const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;
        const newInflight: CaptureInflight = {
          file_id: fileId,
          drive_name: filename,
          drive_url: driveUrl,
          state: "loading",
          analysis: null,
          error: null,
          image: blob,
          audio: audioBlob ?? null,
        };
        setCaptures((prev) => [newInflight, ...prev].slice(0, captureLimit));

        try {
          const result = await withOneBackoffRetry(() =>
            analyzeCapture({ image: blob, audio: audioBlob ?? null }),
          );
          const persisted = await persistAnalysisAndRoute(
            fileId,
            result,
            filename,
          );
          void putCapture(
            buildCaptureRecord({
              file_id: fileId,
              drive_name: persisted.driveName,
              original_drive_name: persisted.originalDriveName,
              drive_url: driveUrl,
              parent_id: persisted.routedToParent ?? folderId ?? undefined,
              analysis: result,
              routed_to: persisted.routedToParent,
            }),
          ).catch((err) => console.error("captures IDB write failed", err));
          setCaptures((prev) =>
            prev.map((c) =>
              c.file_id === fileId
                ? {
                    ...c,
                    drive_name: persisted.driveName,
                    state: "ready",
                    analysis: result,
                  }
                : c,
            ),
          );
          if (persisted.rename.status === "failed") {
            if (batch) {
              batchRenameFailureCountRef.current += 1;
            }
            setStatusMessage(
              persisted.rename.isConflict
                ? `${progressLabel}完了。AI リネームは同名ファイルと衝突したため、元のファイル名を維持しました。`
                : `${progressLabel}完了。AI リネームに失敗したため、元のファイル名を維持しました。`,
            );
          } else {
            setStatusMessage(`${progressLabel}完了`);
          }
        } catch (err) {
          batchFailureCountRef.current += 1;
          const msg = err instanceof Error ? err.message : String(err);
          setCaptures((prev) =>
            prev.map((c) =>
              c.file_id === fileId ? { ...c, state: "error", error: msg } : c,
            ),
          );
          setStatusMessage(`${progressLabel}AI 解析に失敗しました: ${msg}`);
        }

      } catch (error) {
        console.error("Upload or webhook failed:", error);
        batchFailureCountRef.current += 1;
        const msg = error instanceof Error ? error.message : String(error);
        setStatusMessage(`${progressLabel}失敗: ${msg}`);
      } finally {
        if (batch && batch.index === batch.total) {
          const failures = batchFailureCountRef.current;
          const renameFailures = batchRenameFailureCountRef.current;
          const renameSuffix =
            renameFailures > 0
              ? `, AIリネーム元名維持 ${renameFailures}`
              : "";
          setStatusMessage(
            `${formatBatchFinalStatus(batch.total, failures)}${renameSuffix}`,
          );
        }
      }
    },
    [folderId, persistAnalysisAndRoute],
  );

  return (
    <div className="mx-auto flex max-w-md flex-col gap-7 px-5 pb-16 pt-10 sm:pt-14">
      {/* Hero */}
      <section className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-hairline bg-white/[0.02] px-2.5 py-1 text-[0.625rem] uppercase tracking-[0.18em] text-ink-300">
          <span aria-hidden className="h-1 w-1 rounded-full bg-accent" />
          drive.file scope · 招待制
        </span>
        <h1 className="font-display text-4xl font-semibold tracking-tightest text-ink-50 sm:text-[2.75rem]">
          Cursorvers Capture
        </h1>
        <p className="max-w-sm text-[0.875rem] leading-relaxed text-ink-300">
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

      {/* Subtle collapsible disclosure */}
      <details className="group rounded-2xl border border-hairline bg-ink-900/40 backdrop-blur-sm transition-colors hover:border-white/15 open:border-white/15">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-[0.71875rem] text-ink-400 transition-colors hover:text-ink-200 group-open:text-ink-200 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5 shrink-0 opacity-70 group-open:opacity-100"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="8" cy="8" r="6.5" />
              <line x1="8" y1="7" x2="8" y2="11" />
              <circle cx="8" cy="4.8" r="0.6" fill="currentColor" />
            </svg>
            <span className="tracking-tight">本アプリは整理ツールです（電子帳簿保存非対応）</span>
          </span>
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-3 w-3 shrink-0 opacity-50 transition-transform group-open:rotate-90"
            fill="currentColor"
          >
            <path d="M6 4l4 4-4 4V4z" />
          </svg>
        </summary>
        <div className="border-t border-hairline/60 px-4 py-3 text-[0.6875rem] leading-relaxed text-ink-400">
          <p>
            撮影した領収書・名刺・メモを Google Drive へ整理するための補助ツールです。
            電子帳簿保存法のスキャナ保存要件は満たさないため、紙の原本は別途保管してください。
            正式な電子保存が必要な場合は freee 受領 BOX 等を併用してください。
          </p>
          <p className="mt-2">
            <a
              href="/terms"
              className="text-ink-300 underline decoration-dotted underline-offset-4 transition hover:text-ink-100"
            >
              利用規約 §1 を読む
            </a>
          </p>
        </div>
      </details>

      {/* Sign-in + Capture stack */}
      <InviteBanner />
      <section className="flex flex-col gap-3">
        <SignInButton minimal />
        {signedIn ? (
          <CameraButton
            deviceShort={deviceShort}
            audioNoteEnabled={true}
            hidePreview
            hero
            onCaptured={handleCaptured}
          />
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-hairline bg-ink-800/30 text-[0.9375rem] font-semibold text-ink-400"
            aria-label="サインイン後にカメラを起動"
            data-testid="camera-button-disabled"
          >
            <span aria-hidden>📷</span>
            <span>撮影する</span>
          </button>
        )}
        {statusMessage ? (
          <p
            className="text-center text-[0.75rem] text-ink-300"
            data-testid="capture-status"
          >
            {statusMessage}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        {captures.map((c) => (
          <CaptureAnalysisPanel
            key={c.file_id}
            state={c.state}
            analysis={c.analysis}
            error={c.error}
            driveUrl={c.drive_url}
            driveFileId={c.file_id}
            originalFilename={c.drive_name}
            retrying={c.retrying}
            onRetry={
              c.image
                ? () => {
                    handleRetryAnalysis(c.file_id);
                  }
                : undefined
            }
          />
        ))}
      </section>

      <div aria-live="polite" className="sr-only">
        {statusMessage}
      </div>
    </div>
  );
}
