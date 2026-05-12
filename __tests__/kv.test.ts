import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kvGet, kvSet, kvDelete } from '../app/lib/kv';

describe('KV Wrapper (Local Map Fallback)', () => {
  beforeEach(() => {
    // Reset the KV store for each test
    vi.resetModules();
    // Ensure local Map fallback is used
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('should perform get/set/delete round-trip successfully', async () => {
    const key = 'test-key';
    const value = { data: 'test-value' };

    await kvSet(key, value);
    const retrieved = await kvGet(key);
    expect(retrieved).toEqual(value);

    await kvDelete(key);
    const deleted = await kvGet(key);
    expect(deleted).toBeNull();
  });

  it('should delete key after TTL expires', async () => {
    vi.useFakeTimers();
    const key = 'ttl-key';
    const value = { data: 'ttl-value' };
    const ttl = 1; // 1 second

    await kvSet(key, value, ttl);
    let retrieved = await kvGet(key);
    expect(retrieved).toEqual(value);

    vi.advanceTimersByTime(ttl * 1000 + 1);

    retrieved = await kvGet(key);
    expect(retrieved).toBeNull();

    vi.useRealTimers();
  });
});
