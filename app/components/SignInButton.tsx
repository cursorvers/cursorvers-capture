"use client";

import { useEffect, useState } from "react";
import {
  getCurrentToken,
  signIn,
  signOut as gisSignOut,
} from "@/app/lib/gis";

export function SignInButton(): JSX.Element {
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function onSignIn(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await signIn();
      setSignedIn(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setSignedIn(false);
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await gisSignOut();
      setSignedIn(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {!signedIn ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSignIn()}
          className="w-full rounded-xl bg-neutral-800 px-4 py-3 text-sm font-medium hover:bg-neutral-700 disabled:opacity-60"
        >
          Google でサインイン
        </button>
      ) : (
        <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3">
          <span className="text-sm font-medium">✅ Signed in</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSignOut()}
            className="text-xs text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline disabled:opacity-50"
          >
            Sign out
          </button>
        </div>
      )}
      {error ? (
        <p className="text-center text-xs text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
