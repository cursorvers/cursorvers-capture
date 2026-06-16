import { sign, verify, readCookie } from "../_shared/cookie";
import {
  parseInviteAllowlist,
  getTierForEmail,
} from "../_shared/invite-gate";
import { getClaimedEmail, isTrialActive } from "../_shared/invite-kv";

interface Env {
  COOKIE_SECRET: string;
  INVITE_ALLOWLIST?: string;
  PRO_USERS?: string;
  INVITE_KV?: KVNamespace;
}

const COOKIE_NAME = "gdrive_email";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 1 day

function tierFor(email: string | null, env: Env): "free" | "pro" | "unknown" {
  return getTierForEmail(
    email,
    parseInviteAllowlist(env.INVITE_ALLOWLIST),
    parseInviteAllowlist(env.PRO_USERS),
  );
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const signed = readCookie(request.headers.get("cookie"), COOKIE_NAME);
  const email = signed ? await verify(signed, env.COOKIE_SECRET) : null;

  let trial_active: boolean | null = null;
  let trial_ends_at: string | null = null;

  if (email) {
    const proUsers = parseInviteAllowlist(env.PRO_USERS);
    const allowlist = parseInviteAllowlist(env.INVITE_ALLOWLIST);
    const lower = email.toLowerCase();

    // PRO_USERS / INVITE_ALLOWLIST は KV record に関係なく unlimited
    if (proUsers.includes(lower) || allowlist.includes(lower)) {
      trial_active = true;
      trial_ends_at = null;
    } else if (env.INVITE_KV) {
      try {
        const rec = await getClaimedEmail(env.INVITE_KV, email);
        if (rec) {
          trial_active = isTrialActive(rec);
          trial_ends_at = rec.trial_ends_at ?? null;
        }
      } catch {
        // KV error → don't block the response
      }
    }
  }

  return Response.json({
    tier: tierFor(email, env),
    email,
    trial_active,
    trial_ends_at,
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { email?: string; access_token?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { email, access_token } = body;
  if (!email || !access_token) {
    return Response.json(
      { error: "Email and access_token are required" },
      { status: 400 },
    );
  }

  const tokenInfoRes = await fetch(
    `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(access_token)}`,
  );
  if (!tokenInfoRes.ok) {
    return Response.json({ error: "Invalid access token" }, { status: 401 });
  }
  const tokenInfo = (await tokenInfoRes.json()) as { email?: string };
  if (tokenInfo.email !== email) {
    return Response.json({ error: "Email mismatch" }, { status: 401 });
  }

  const signedEmail = await sign(email, env.COOKIE_SECRET);
  const cookie = [
    `${COOKIE_NAME}=${signedEmail}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${COOKIE_MAX_AGE}`,
    "Path=/",
  ].join("; ");

  return Response.json(
    { tier: tierFor(email, env), email },
    { headers: { "Set-Cookie": cookie } },
  );
};

export const onRequestDelete: PagesFunction<Env> = async () => {
  const cleared = [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
    "Path=/",
  ].join("; ");
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cleared,
    },
  });
};
