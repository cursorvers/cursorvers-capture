"use client";

import { useOnlineStatus } from "@/app/lib/network";

export function OnlineStatusBanner(): JSX.Element | null {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="online-status-banner-offline"
      className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-center text-[0.8125rem] font-medium text-amber-100 backdrop-blur-md"
    >
      <span className="mr-1.5" aria-hidden>
        ●
      </span>
      オフラインです。撮影は端末に保存され、接続が戻った時に Google Drive へ送信されます。
    </div>
  );
}
