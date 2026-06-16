"use client";

import { useTier } from "@/app/lib/tier";
import type { JSX } from "react";

export function TrialExpiryBanner(): JSX.Element | null {
  const { trial_active, trial_ends_at, email } = useTier();

  if (!email) return null;
  if (trial_active !== false) return null;

  const expiredLabel = trial_ends_at
    ? new Date(trial_ends_at).toLocaleDateString("ja-JP")
    : "";

  return (
    <div className="border-b border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-center text-[12px] text-amber-200">
      <span>
        トライアル期間が{expiredLabel ? `（${expiredLabel}）` : ""}終了しました。
      </span>{" "}
      <a
        href="/trial-expired"
        className="underline decoration-dotted underline-offset-4 transition hover:text-amber-100"
      >
        詳細を確認
      </a>
    </div>
  );
}
