import { createClient, type VercelKV } from '@vercel/kv';

let kv: VercelKV | Map<string, string>; // Use Map for local fallback

// Initialize KV client or local Map
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
  console.log('KV initialized with Vercel KV client.');
} else {
  kv = new Map<string, string>();
  console.log('KV initialized with local Map fallback.');
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
  } else {
    if (ttlSec) {
      await kv.set(key, value, { ex: ttlSec });
    } else {
      await kv.set(key, value);
    }
  }
}

export async function kvDelete(key: string): Promise<void> {
  if (kv instanceof Map) {
    kv.delete(key);
  } else {
    await kv.del(key);
  }
}
