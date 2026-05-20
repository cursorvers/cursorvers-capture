import { readCookie, verify } from "../../_shared/cookie";
import {
  generateToken,
  putToken,
  type InviteToken,
} from "../../_shared/invite-kv";

interface Env {
  COOKIE_SECRET: string;
  INVITE_KV: KVNamespace;
  ADMIN_EMAILS?: string;   // comma-separated 発行権限保持者
}

const COOKIE_NAME = "gdrive_email";

function parseAdmins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const signed = readCookie(request.headers.get("cookie"), COOKIE_NAME);
  const email = signed ? await verify(signed, env.COOKIE_SECRET).catch(() => null) : null;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admins = parseAdmins(env.ADMIN_EMAILS);
  if (!admins.includes(email.toLowerCase())) {
    return Response.json({ error: "Forbidden — 発行権限なし" }, { status: 403 });
  }

  let body: {
    max_uses?: number;
    expires_at?: string | null;
    note?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const token = generateToken(16);
  const record: InviteToken = {
    token,
    created_at: new Date().toISOString(),
    expires_at: body.expires_at ?? null,
    max_uses: typeof body.max_uses === "number" && body.max_uses > 0 ? body.max_uses : 50,
    used_count: 0,
    used_emails: [],
    issued_by: email.toLowerCase(),
    note: body.note,
  };
  await putToken(env.INVITE_KV, record);

  const url = new URL(request.url);
  const inviteUrl = `${url.origin}/?invite=${token}`;

  return Response.json({
    ok: true,
    token,
    url: inviteUrl,
    record,
  });
};
