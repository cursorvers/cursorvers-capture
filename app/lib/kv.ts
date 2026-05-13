import { createClient, type VercelKV } from "@vercel/kv";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

let kv: VercelKV | Map<string, string>;

if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
  console.log("KV initialized with Vercel KV client.");
} else {
  kv = new Map<string, string>();
  console.log("KV initialized with local Map fallback.");
}

const KVENC_PREFIX = "kvenc:v1:";

function getEncryptionKey(): Buffer {
  const hex = process.env.KV_ENCRYPTION_KEY;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, "hex");
  }
  const secret = process.env.COOKIE_SECRET;
  if (!secret) {
    throw new Error("KV encryption requires KV_ENCRYPTION_KEY or COOKIE_SECRET");
  }
  return createHash("sha256").update(secret).digest();
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (kv instanceof Map) {
    const item = kv.get(key);
    return item !== undefined ? JSON.parse(item) : null;
  }
  return await kv.get<T>(key);
}

export async function kvSet<T>(key: string, value: T, ttlSec?: number): Promise<void> {
  if (kv instanceof Map) {
    const item = JSON.stringify(value);
    kv.set(key, item);
    if (ttlSec) {
      setTimeout(() => {
        kv.delete(key);
      }, ttlSec * 1000);
    }
  } else if (ttlSec) {
    await kv.set(key, value, { ex: ttlSec });
  } else {
    await kv.set(key, value);
  }
}

export async function kvDelete(key: string): Promise<void> {
  if (kv instanceof Map) {
    kv.delete(key);
  } else {
    await kv.del(key);
  }
}

export async function kvSetEncrypted<T>(
  key: string,
  value: T,
  ttlSec?: number,
): Promise<void> {
  const keyBuf = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBuf, iv);
  const plain = JSON.stringify(value);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, enc, tag]);
  const envelope = KVENC_PREFIX + combined.toString("base64url");
  await kvSet(key, envelope, ttlSec);
}

export async function kvGetEncrypted<T>(key: string): Promise<T | null> {
  const raw = await kvGet<string | T>(key);
  if (raw === null) {
    return null;
  }
  if (typeof raw === "string" && raw.startsWith(KVENC_PREFIX)) {
    const keyBuf = getEncryptionKey();
    const b = Buffer.from(raw.slice(KVENC_PREFIX.length), "base64url");
    const iv = b.subarray(0, 12);
    const tag = b.subarray(b.length - 16);
    const ciphertext = b.subarray(12, b.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", keyBuf, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(dec.toString("utf8")) as T;
  }
  return raw as T;
}
