"use client";

import { useEffect } from "react";

export function SWRegistry() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let reloaded = false;
    // 新しい SW が controller を奪った瞬間にページをリロード
    // (v1 → v2 切替を画面上に即座に反映するため)
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
        // waiting SW があれば即座に activate を要求
        const requestSkipWaiting = (worker: ServiceWorker | null): void => {
          if (worker) worker.postMessage({ type: "SKIP_WAITING" });
        };
        if (reg.waiting) {
          requestSkipWaiting(reg.waiting);
        }
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && reg.waiting) {
              requestSkipWaiting(reg.waiting);
            }
          });
        });
        // 既に v2 が controller の場合 (リロード後など) は何もしない
      } catch {
        /* best-effort; ignore registration failures */
      }
    })();

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);
  return null;
}
