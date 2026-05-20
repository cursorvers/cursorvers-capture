// 招待トークン claim クライアント。
// URL の ?invite=xxx を読み、サインイン済みなら自動で /api/invite/claim を叩く。

export const INVITE_QUERY_KEY = "invite";
const STORAGE_KEY = "cv_pending_invite";

export function readInviteFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  return url.searchParams.get(INVITE_QUERY_KEY);
}

export function rememberPendingInvite(token: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
}

export function consumePendingInvite(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    return v;
  } catch {
    return null;
  }
}

export async function claimInvite(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/invite/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      msg = data.error ?? msg;
    } catch {
      /* keep msg */
    }
    return { ok: false, error: msg };
  }
  return { ok: true };
}
