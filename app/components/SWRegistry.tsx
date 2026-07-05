"use client";

import { useEffect, useState, type JSX } from "react";

/**
 * Service Worker registration + update banner.
 * Phase 22.2B: 強制 reload を撤廃し、ユーザーに更新を促す banner を表示。
 * - 新 SW 検知 (updatefound) → 「アプリの新しい版があります」banner
 * - ユーザーが「今すぐ更新」をタップ → skipWaiting + reload
 * - 自動 reload しない (ユーザー操作中に画面を奪わない)
 */
export function SWRegistry(): JSX.Element | null {
  const [updateReady, setUpdateReady] = useState(false);
  const [pendingWorker, setPendingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let reloaded = false;
    const handleControllerChange = (): void => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");

        // initial waiting worker (page loaded while update pending)
        if (reg.waiting && navigator.serviceWorker.controller) {
          setPendingWorker(reg.waiting);
          setUpdateReady(true);
        }

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // 既に controller がある → これは update
              setPendingWorker(reg.waiting ?? installing);
              setUpdateReady(true);
            }
          });
        });
      } catch {
        /* best-effort */
      }
    })();

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div className="fixed inset-x-0 bottom-3 z-50 flex justify-center px-3">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-accent/40 bg-ink-900/95 px-4 py-3 shadow-card backdrop-blur-sm">
        <span aria-hidden className="text-[1.125rem]">✨</span>
        <p className="flex-1 text-[0.78125rem] leading-snug text-ink-100">
          アプリの新しい版があります
        </p>
        <button
          type="button"
          onClick={() => {
            if (pendingWorker) {
              pendingWorker.postMessage({ type: "SKIP_WAITING" });
            } else {
              window.location.reload();
            }
          }}
          className="inline-flex h-8 items-center rounded-full bg-accent px-3 text-[0.75rem] font-medium text-white transition hover:bg-accent/90"
        >
          今すぐ更新
        </button>
        <button
          type="button"
          onClick={() => setUpdateReady(false)}
          aria-label="閉じる"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink-400 hover:text-ink-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
