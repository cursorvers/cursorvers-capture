import { readCookie, verify } from "./_shared/cookie";
import {
  parseInviteAllowlist,
  inviteBlockPath,
  getTierForEmail,
} from "./_shared/invite-gate";
import { isEmailClaimed } from "./_shared/invite-kv";

interface Env {
  COOKIE_SECRET: string;
  INVITE_ALLOWLIST?: string;
  PRO_USERS?: string;
  INVITE_KV?: KVNamespace;
}

const COOKIE_NAME = "gdrive_email";

function isPublicPath(p: string): boolean {
  return (
    p.startsWith("/_next") ||
    p.startsWith("/api/me") ||
    p.startsWith("/api/invite") ||  // invite endpoints は middleware で弾かない
    p === "/favicon.ico" ||
    p === "/manifest.webmanifest" ||
    p === "/sw.js" ||
    p.startsWith("/icon-") ||
    p === "/icon.svg" ||
    p === "/icon.png" ||
    p === "/apple-icon.png" ||
    p === "/not-invited" ||
    p === "/full" ||
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
    return next();
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

  // 1. 静的 env allowlist
  const envAllowlist = parseInviteAllowlist(env.INVITE_ALLOWLIST);

  // 2. KV claim 済 allowlist
  let claimedOk = false;
  if (env.INVITE_KV) {
    try {
      claimedOk = await isEmailClaimed(env.INVITE_KV, email);
    } catch {
      claimedOk = false;
    }
  }

  // OR 判定: env allowlist OR KV allowlist
  const effectiveAllowlist = claimedOk
    ? [...envAllowlist, email.toLowerCase()]
    : envAllowlist;

  const block = inviteBlockPath(effectiveAllowlist, email);
  if (block) {
    return Response.redirect(`${url.origin}${block}`, 302);
  }

  const proUsers = parseInviteAllowlist(env.PRO_USERS);
  const tier = getTierForEmail(email, effectiveAllowlist, proUsers);

  const response = await next();
  if (tier !== "unknown") {
    response.headers.set("X-Tier", tier);
  }
  return response;
};
