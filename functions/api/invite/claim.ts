import { readCookie, verify } from "../../_shared/cookie";
import {
  claimEmail,
  getToken,
  isEmailClaimed,
  isTokenValid,
  putToken,
} from "../../_shared/invite-kv";

interface Env {
  COOKIE_SECRET: string;
  INVITE_KV: KVNamespace;
}

const COOKIE_NAME = "gdrive_email";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const signed = readCookie(request.headers.get("cookie"), COOKIE_NAME);
  const email = signed ? await verify(signed, env.COOKIE_SECRET).catch(() => null) : null;
  if (!email) {
    return Response.json({ error: "Unauthorized — Google サインインが必要です" }, { status: 401 });
  }

  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = body.token?.trim();
  if (!token) {
    return Response.json({ error: "token が必要です" }, { status: 400 });
  }

  const lower = email.toLowerCase();

  // すでに claim 済 → 冪等的に OK (email: key が authoritative)
  const already = await isEmailClaimed(env.INVITE_KV, email);
  if (already) {
    return Response.json({ ok: true, email, already_claimed: true });
  }

  // token 読み取り + validation
  const record = await getToken(env.INVITE_KV, token);
  if (!record) {
    return Response.json({ error: "招待トークンが見つかりません" }, { status: 404 });
  }

  const valid = isTokenValid(record);
  if (!valid.ok) {
    return Response.json({ error: `招待トークンは無効です: ${valid.reason}` }, { status: 410 });
  }

  // token 側にも既に含まれていれば冪等
  if (record.used_emails.includes(lower)) {
    return Response.json({ ok: true, email, already_claimed: true });
  }

  // ── Step 1: email claim を先に書く (authoritative source) ──
  await claimEmail(env.INVITE_KV, email, token, 60);

  // ── Step 2: token を最新版で re-read → dedup + merge → write ──
  const latest = await getToken(env.INVITE_KV, token);
  if (!latest) {
    return Response.json({ ok: true, email, already_claimed: false });
  }

  // dedup + merge
  const deduped = [...new Set(latest.used_emails.map((e) => e.toLowerCase()))];
  if (!deduped.includes(lower)) {
    deduped.push(lower);
  }
  latest.used_emails = deduped;
  latest.used_count = deduped.length;

  // ── Step 3: Compensating transaction ──
  // max_uses を超えた場合、email claim を取り消して 410 を返す。
  if (latest.max_uses !== -1 && latest.used_count > latest.max_uses) {
    await env.INVITE_KV.delete(`email:${lower}`);
    latest.used_emails = deduped.filter((e) => e !== lower);
    latest.used_count = latest.used_emails.length;
    await putToken(env.INVITE_KV, latest);
    return Response.json(
      { error: "招待トークンは無効です: 利用上限に達しました" },
      { status: 410 },
    );
  }

  await putToken(env.INVITE_KV, latest);

  return Response.json({
    ok: true,
    email,
    used_count: latest.used_count,
    max_uses: latest.max_uses,
  });
};
