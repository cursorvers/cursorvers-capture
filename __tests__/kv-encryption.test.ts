import { describe, it, expect, beforeEach, vi } from "vitest";

describe("KV AES-256-GCM encryption", () => {
  const hexKey =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  beforeEach(() => {
    vi.resetModules();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it("round-trips objects when KV_ENCRYPTION_KEY is set", async () => {
    process.env.KV_ENCRYPTION_KEY = hexKey;
    const { kvSetEncrypted, kvGetEncrypted } = await import("../app/lib/kv");
    await kvSetEncrypted("enc:key1", { hello: "world", n: 42 });
    const got = await kvGetEncrypted<{ hello: string; n: number }>("enc:key1");
    expect(got).toEqual({ hello: "world", n: 42 });
  });

  it("throws on encrypt when KV_ENCRYPTION_KEY and COOKIE_SECRET are missing", async () => {
    vi.resetModules();
    delete process.env.KV_ENCRYPTION_KEY;
    delete process.env.COOKIE_SECRET;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const { kvSetEncrypted } = await import("../app/lib/kv");
    await expect(kvSetEncrypted("enc:fail", { a: 1 })).rejects.toThrow();
  });
});
