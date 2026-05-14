"use client";

import { useEffect, useState } from "react";

/**
 * Returns the current online status, tracking navigator.onLine and the
 * online/offline events. The initial value falls back to true on the
 * server-render pass so SSR markup matches the most common case (online).
 *
 * Behaviour rationale (Resilience Layer 2, BS-1/BS-2/BS-5 doc):
 * - We do not piggy-back on Service Worker — those are out of scope until
 *   PWA install adoption proves it.
 * - We treat navigator.onLine as advisory; some browsers report true when
 *   the device is connected to a captive portal or has DNS issues. Layer 3
 *   (fetch-wrapper retryable backoff) absorbs the residual unreliability.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine !== false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Resync once on mount in case the initial state from SSR differs.
    setIsOnline(navigator.onLine !== false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
