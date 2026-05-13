"use client";

import { useEffect, useState } from "react";
import { getCurrentToken, signIn } from "@/app/lib/gis";
import { useTier } from "@/app/lib/tier";

type SignInButtonProps = {
  minimal?: boolean;
};

export function SignInButton({ minimal = false }: SignInButtonProps): JSX.Element {
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { email } = useTier();

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

  if (minimal) {
    return (
      <div className="flex w-full flex-col gap-2">
        {!signedIn ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSignIn()}
            className="w-full rounded-xl bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-60"
            data-testid="signin-button-google"
          >
            Google でサインイン
          </button>
        ) : (
          <p className="text-center text-xs text-neutral-400" data-testid="signin-minimal-status">
            ✓ {email ?? "サインイン済み"}
          </p>
        )}
        {error ? <p className="text-center text-xs text-red-400">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {!signedIn ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSignIn()}
          className="w-full rounded-xl bg-neutral-800 px-4 py-3 text-sm font-medium hover:bg-neutral-700 disabled:opacity-60"
          data-testid="signin-button-google"
        >
          Google でサインイン
        </button>
      ) : (
        <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3">
          <span className="text-sm font-medium">✅ Signed in</span>
        </div>
      )}
      {error ? <p className="text-center text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
