// 招待トークン + 動的 allowlist の KV 操作。
//
// キー設計:
//   invite:<token>          → token レコード (発行・状態)
//   email:<lowercased_email> → claim 済記録 (allowlist のメンバーシップ)

export type InviteToken = {
  token: string;
  created_at: string;
  expires_at: string | null;     // null = 無期限
  max_uses: number;              // -1 = 無制限
  used_count: number;
  used_emails: string[];
  issued_by: string;             // 発行者の email
  note?: string;                 // 発行時メモ (税理士法人名など)
};

export type ClaimedEmail = {
  email: string;
  source_token: string;
  claimed_at: string;
};

const TOKEN_PREFIX = "invite:";
const EMAIL_PREFIX = "email:";

function tokenKey(token: string): string {
  return `${TOKEN_PREFIX}${token}`;
}

function emailKey(email: string): string {
  return `${EMAIL_PREFIX}${email.trim().toLowerCase()}`;
}

export async function getToken(
  kv: KVNamespace,
  token: string,
): Promise<InviteToken | null> {
  const raw = await kv.get(tokenKey(token));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as InviteToken;
  } catch {
    return null;
  }
}

export async function putToken(
  kv: KVNamespace,
  record: InviteToken,
): Promise<void> {
  await kv.put(tokenKey(record.token), JSON.stringify(record));
}

export async function isEmailClaimed(
  kv: KVNamespace,
  email: string,
): Promise<boolean> {
  if (!email) return false;
  const raw = await kv.get(emailKey(email));
  return raw !== null;
}

export async function claimEmail(
  kv: KVNamespace,
  email: string,
  source_token: string,
): Promise<void> {
  const record: ClaimedEmail = {
    email: email.trim().toLowerCase(),
    source_token,
    claimed_at: new Date().toISOString(),
  };
  await kv.put(emailKey(email), JSON.stringify(record));
}

export function generateToken(bytes = 16): string {
  // crypto.getRandomValues は CF Workers で globalThis にある
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isTokenValid(token: InviteToken): {
  ok: boolean;
  reason?: string;
} {
  if (token.expires_at) {
    const exp = Date.parse(token.expires_at);
    if (!Number.isNaN(exp) && exp < Date.now()) {
      return { ok: false, reason: "期限切れ" };
    }
  }
  if (token.max_uses !== -1 && token.used_count >= token.max_uses) {
    return { ok: false, reason: "利用上限に達しました" };
  }
  return { ok: true };
}
