"use client";

import { useOnlineStatus } from "@/app/lib/network";

/**
 * Banner that surfaces offline state to the user so they understand why a
 * capture queued instead of uploading. Stays mounted; only renders when
 * offline so the markup is a no-op for the common path.
 *
 * Styling intentionally matches the existing neutral palette so it does
 * not require Tailwind theme changes.
 */
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
      className="bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white shadow-md"
    >
      オフラインです。撮影は端末に保存され、接続が戻った時に Google Drive へ送信されます。
    </div>
  );
}
