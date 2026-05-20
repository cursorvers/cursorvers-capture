"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import {
  getCurrentToken,
  isGisReady,
  prepareTokenClient,
  type PreparedTokenClient,
} from "@/app/lib/gis";
import { useTier } from "@/app/lib/tier";

type SignInButtonProps = {
  minimal?: boolean;
};

function GoogleGlyph(): JSX.Element {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.96h5.51c-.24 1.43-.97 2.64-2.06 3.45v2.86h3.33C20.94 18.5 22 15.6 22 12.25c0-.78-.07-1.53-.2-2.25H12Z"
      />
      <path
        fill="#4285F4"
        d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.33-2.86c-.92.63-2.1 1-3.29 1-2.53 0-4.67-1.7-5.43-4H3.18v2.55A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.57 13.71A6 6 0 0 1 6.25 12c0-.6.11-1.18.32-1.71V7.74H3.18A10 10 0 0 0 2 12c0 1.61.39 3.14 1.18 4.26l3.39-2.55Z"
      />
      <path
        fill="#34A853"
        d="M12 5.92c1.47 0 2.78.5 3.81 1.49l2.86-2.86C16.95 2.96 14.7 2 12 2 8.07 2 4.69 4.18 3.18 7.74l3.39 2.55c.76-2.3 2.9-4 5.43-4Z"
      />
    </svg>
  );
}

export function SignInButton({ minimal = false }: SignInButtonProps): JSX.Element {
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gisReady, setGisReady] = useState(false);
  const tokenClientRef = useRef<PreparedTokenClient | null>(null);
  const { email, refresh } = useTier();

  // Check current sign-in state from IDB.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tok = await getCurrentToken();
      if (!cancelled) {
        setSignedIn(tok !== null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Prepare the GIS tokenClient as soon as the GIS script is loaded.
  // We poll briefly (100ms × 50 = 5s ceiling) because the <script async>
  // tag in layout may finish loading after this component mounts.
  useEffect(() => {
    if (tokenClientRef.current) {
      return;
    }
    let attempts = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tryPrepare = (): boolean => {
      if (!isGisReady()) {
        return false;
      }
      tokenClientRef.current = prepareTokenClient({
        onSuccess: () => {
          setSignedIn(true);
          setBusy(false);
          setError(null);
          void refresh();
        },
        onError: (err) => {
          setError(err.message);
          setSignedIn(false);
          setBusy(false);
        },
      });
      setGisReady(true);
      return true;
    };

    if (!tryPrepare()) {
      timer = setInterval(() => {
        attempts += 1;
        if (tryPrepare() || attempts >= 50) {
          if (timer) clearInterval(timer);
        }
      }, 100);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [refresh]);

  // SYNCHRONOUS click handler — no await before requestAccessToken so iOS
  // Safari preserves the user-gesture token and allows the popup.
  function onSignIn(): void {
    setError(null);
    const client = tokenClientRef.current;
    if (!client) {
      setError(
        gisReady
          ? "サインインを準備中です。少し待ってからもう一度お試しください。"
          : "Google サインインの読み込みに失敗しました。ネットワークをご確認ください。",
      );
      return;
    }
    setBusy(true);
    client.requestAccessToken({ prompt: "consent" });
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {!signedIn ? (
        <button
          type="button"
          disabled={busy || !gisReady}
          onClick={onSignIn}
          className="group inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-hairline bg-ink-800/60 px-4 text-sm font-medium text-ink-100 shadow-card transition hover:border-white/20 hover:bg-ink-800 disabled:opacity-50"
          data-testid="signin-button-google"
        >
          <GoogleGlyph />
          <span>{busy ? "サインイン中…" : "Google でサインイン"}</span>
        </button>
      ) : minimal ? (
        <p
          className="inline-flex items-center justify-center gap-2 text-center text-[12px] text-ink-300"
          data-testid="signin-minimal-status"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {email ?? "サインイン済み"}
        </p>
      ) : (
        <div className="flex w-full items-center gap-2 rounded-xl border border-hairline bg-ink-800/40 px-4 py-3 text-sm">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-ink-200">Signed in</span>
        </div>
      )}
      {error ? (
        <p className="text-center text-[12px] text-red-300/90">{error}</p>
      ) : null}
    </div>
  );
}
