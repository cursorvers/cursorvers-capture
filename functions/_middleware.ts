import { readCookie, verify } from "./_shared/cookie";
import {
  parseInviteAllowlist,
  inviteBlockPath,
  getTierForEmail,
} from "./_shared/invite-gate";

interface Env {
  COOKIE_SECRET: string;
  INVITE_ALLOWLIST?: string;
  PRO_USERS?: string;
}

const COOKIE_NAME = "gdrive_email";

// Paths that must never be blocked: assets, the auth endpoint itself, the
// "you're not invited / full" landing pages, and the public legal docs.
function isPublicPath(p: string): boolean {
  return (
    p.startsWith("/_next") ||
    p.startsWith("/api/me") ||
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

  // Not signed in → let the page render so the user can sign in via GIS
  if (!signed) {
    return next();
  }

  let email: string | null = null;
  try {
    email = await verify(signed, env.COOKIE_SECRET);
  } catch {
    email = null;
  }

  // Invalid / tampered cookie → treat as not signed in
  if (!email) {
    return next();
  }

  const allowlist = parseInviteAllowlist(env.INVITE_ALLOWLIST);
  const block = inviteBlockPath(allowlist, email);
  if (block) {
    return Response.redirect(`${url.origin}${block}`, 302);
  }

  const proUsers = parseInviteAllowlist(env.PRO_USERS);
  const tier = getTierForEmail(email, allowlist, proUsers);

  const response = await next();
  if (tier !== "unknown") {
    response.headers.set("X-Tier", tier);
  }
  return response;
};
