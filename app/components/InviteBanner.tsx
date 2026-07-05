"use client";

import { useEffect, useState, type JSX } from "react";
import {
  claimInvite,
  consumePendingInvite,
  readInviteFromUrl,
  rememberPendingInvite,
} from "@/app/lib/invite-claim";
import { useTier } from "@/app/lib/tier";

type Phase = "idle" | "claiming" | "success" | "error";

export function InviteBanner(): JSX.Element | null {
  const { email, isLoading, refresh } = useTier();
  const [phase, setPhase] = useState<Phase>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  // URL ?invite=xxx を捕捉して sessionStorage に退避 (サインイン経由でリロード対策)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = readInviteFromUrl();
    if (fromUrl) {
      rememberPendingInvite(fromUrl);
      setPendingToken(fromUrl);
      // URL をクリーンアップ
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.toString());
    } else {
      // 退避済の token を引き継ぎ
      const stored = consumePendingInvite();
      if (stored) setPendingToken(stored);
    }
  }, []);

  // サインイン済 + pending token あり → claim
  useEffect(() => {
    if (isLoading) return;
    if (!pendingToken) return;
    if (!email) return;
    if (phase !== "idle") return;

    setPhase("claiming");
    void (async () => {
      const r = await claimInvite(pendingToken);
      if (r.ok) {
        setPhase("success");
        // tier 情報を更新 (allowlist 状態の再評価)
        void refresh();
        // 1.5s 後に banner 消す
        setTimeout(() => {
          setPhase("idle");
          setPendingToken(null);
        }, 2500);
      } else {
        setPhase("error");
        setErrMsg(r.error ?? "招待のクレームに失敗しました");
      }
    })();
  }, [pendingToken, email, isLoading, phase, refresh]);

  if (!pendingToken) return null;

  if (phase === "claiming") {
    return (
      <div className="mx-auto mt-3 max-w-md rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-[0.8125rem] text-accent-soft">
        🎟️ 招待を受け取り中…
      </div>
    );
  }
  if (phase === "success") {
    return (
      <div className="mx-auto mt-3 max-w-md rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-[0.8125rem] text-emerald-200">
        ✓ 招待が完了しました。アプリをご利用いただけます。
      </div>
    );
  }
  if (phase === "error") {
    return (
      <div className="mx-auto mt-3 max-w-md rounded-2xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-[0.8125rem] text-red-200">
        招待を受け取れませんでした: {errMsg}
      </div>
    );
  }
  // サインイン前で pending あり → 案内
  if (!email) {
    return (
      <div className="mx-auto mt-3 max-w-md rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-[0.8125rem] text-accent-soft">
        🎟️ 招待を受け取りました。下の「Google でサインイン」で受け取りを完了してください。
      </div>
    );
  }
  return null;
}
