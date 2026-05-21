import { readCookie, verify } from "./_shared/cookie";
import {
  parseInviteAllowlist,
  inviteBlockPath,
  getTierForEmail,
} from "./_shared/invite-gate";
import { getClaimedEmail, isTrialActive } from "./_shared/invite-kv";

interface Env {
  COOKIE_SECRET: string;
  INVITE_ALLOWLIST?: string;
  PRO_USERS?: string;
  INVITE_KV?: KVNamespace;
}

const COOKIE_NAME = "gdrive_email";

function isPublicPath(p: string): boolean {
  return (
    p === "/" ||
    p.startsWith("/_next") ||
    p.startsWith("/api/me") ||
    p.startsWith("/api/invite") ||
    p === "/favicon.ico" ||
    p === "/manifest.webmanifest" ||
    p === "/sw.js" ||
    p.startsWith("/icon-") ||
    p === "/icon.svg" ||
    p === "/icon.png" ||
    p === "/apple-icon.png" ||
    p === "/not-invited" ||
    p === "/full" ||
    p === "/trial-expired" ||
    p.startsWith("/privacy") ||
    p.startsWith("/terms")
  );
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (isPublicPath(url.pathname)) {
    return next();
  }

  const signed = readCookie(request.headers.get("cookie"), COOKIE_NAME);
  if (!signed) {
    // Protected route で cookie 無し → ホームへ (fail-closed)
    // 公開 path は isPublicPath で先に early-return 済なのでここには来ない
    return Response.redirect(`${url.origin}/`, 302);
  }

  let email: string | null = null;
  try {
    email = await verify(signed, env.COOKIE_SECRET);
  } catch {
    email = null;
  }

  if (!email) {
    return next();
  }

  const envAllowlist = parseInviteAllowlist(env.INVITE_ALLOWLIST);
  const proUsers = parseInviteAllowlist(env.PRO_USERS);
  const lower = email.toLowerCase();

  // ─── Bypass 階層 (上から優先) ─────────────────────────
  // (1) PRO_USERS: 有料・無期限
  const isPro = proUsers.includes(email) || proUsers.includes(lower);

  // (2) INVITE_ALLOWLIST (env): 内部・admin・無期限
  const isEnvAllow =
    envAllowlist.includes(email) || envAllowlist.includes(lower);

  // (3) KV claimed: trial 期限まで free
  let kvClaimed = false;
  let trialActive = false;
  if (env.INVITE_KV) {
    try {
      const rec = await getClaimedEmail(env.INVITE_KV, email);
      if (rec) {
        kvClaimed = true;
        trialActive = isTrialActive(rec);
      }
    } catch {
      kvClaimed = false;
    }
  }

  // ─── 判定 ─────────────────────────────────────────────
  if (isPro || isEnvAllow) {
    // 無期限 bypass
    const tier = isPro ? "pro" : "free";
    const response = await next();
    response.headers.set("X-Tier", tier);
    return response;
  }

  if (kvClaimed) {
    if (trialActive) {
      // Trial 中: free として通す
      const response = await next();
      response.headers.set("X-Tier", "free");
      return response;
    }
    // Trial 切れ: /trial-expired にリダイレクト
    return Response.redirect(`${url.origin}/trial-expired`, 302);
  }

  // どの allowlist にも該当しない → /not-invited or /full
  const effectiveAllowlist = envAllowlist;
  const block = inviteBlockPath(effectiveAllowlist, email);
  if (block) {
    return Response.redirect(`${url.origin}${block}`, 302);
  }

  const tier = getTierForEmail(email, effectiveAllowlist, proUsers);
  const response = await next();
  if (tier !== "unknown") {
    response.headers.set("X-Tier", tier);
  }
  return response;
};
