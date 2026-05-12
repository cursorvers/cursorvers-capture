"use client";

import { useEffect } from "react";

export function SWRegistry() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
