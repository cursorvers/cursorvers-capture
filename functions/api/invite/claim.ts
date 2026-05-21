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
  // サインイン済みかチェック
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

  const record = await getToken(env.INVITE_KV, token);
  if (!record) {
    return Response.json({ error: "招待トークンが見つかりません" }, { status: 404 });
  }

  const valid = isTokenValid(record);
  if (!valid.ok) {
    return Response.json({ error: `招待トークンは無効です: ${valid.reason}` }, { status: 410 });
  }

  // すでに claim 済 → 冪等的に OK 返す
  const already = await isEmailClaimed(env.INVITE_KV, email);
  if (already) {
    return Response.json({ ok: true, email, already_claimed: true });
  }

  // 二重カウント防止のため email を used_emails に既に含むかチェック
  if (record.used_emails.includes(email.toLowerCase())) {
    return Response.json({ ok: true, email, already_claimed: true });
  }

  // 書き込み直前に再フェッチして race window 縮小 (atomic ではないが現実的軽減)
  const latest = await getToken(env.INVITE_KV, token);
  if (!latest) {
    return Response.json({ error: "招待トークンが消失しました" }, { status: 410 });
  }
  const latestValid = isTokenValid(latest);
  if (!latestValid.ok) {
    return Response.json({ error: `招待トークンは無効です: ${latestValid.reason}` }, { status: 410 });
  }
  if (latest.used_emails.includes(email.toLowerCase())) {
    return Response.json({ ok: true, email, already_claimed: true });
  }
  await claimEmail(env.INVITE_KV, email, token, 60);
  latest.used_count += 1;
  latest.used_emails.push(email.toLowerCase());
  await putToken(env.INVITE_KV, latest);
  // 既存ロジック互換のため record も更新
  record.used_count = latest.used_count;
  record.used_emails = latest.used_emails;

  return Response.json({ ok: true, email, used_count: record.used_count, max_uses: record.max_uses });
};
