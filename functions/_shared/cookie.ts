// HMAC-SHA-256 signed cookie using Web Crypto (Pages Functions edge runtime).
// Cookie format: `<email>.<64-char-hex-signature>`. Matches the legacy Node
// crypto.createHmac shape so existing cookies remain verifiable across the
// Vercel → CF cutover.

const enc = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function sign(value: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return `${value}.${bytesToHex(sig)}`;
}

export async function verify(
  signedValue: string,
  secret: string,
): Promise<string | null> {
  const lastDot = signedValue.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const value = signedValue.slice(0, lastDot);
  const signature = signedValue.slice(lastDot + 1);
  if (!/^[0-9a-f]{64}$/i.test(signature)) return null;

  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    hexToBytes(signature),
    enc.encode(value),
  );
  return ok ? value : null;
}

export function readCookie(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  const re = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`);
  const m = re.exec(cookieHeader);
  return m ? decodeURIComponent(m[1]!) : null;
}
