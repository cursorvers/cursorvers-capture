import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchToCodex, type CaptureWebhookPayload } from '../app/lib/codex-app-server';

describe('Codex App Server Helper', () => {
  const mockPayload: CaptureWebhookPayload = {
    drive_file_id: 'test_drive_file_id',
    filename: 'test_image.jpeg',
    mime: 'image/jpeg',
    size: 12345,
    shot_at: Date.now(),
    sha1: 'test_sha1',
  };

  beforeEach(() => {
    // Reset environment variables for each test
    delete process.env.OPENAI_APPS_SDK_ENDPOINT;
    delete process.env.OPENAI_APPS_SDK_KEY;
    vi.restoreAllMocks();
  });

  it('should return a fixed chatback_text in stub mode when env vars are not set', async () => {
    const result = await dispatchToCodex(mockPayload);
    expect(result.chatback_text).toBe(`✓ ${mockPayload.filename} を保存しました (stub)`);
    expect(result.suggested_tags).toEqual([]);
    expect(result.updated_metadata).toEqual({});
  });

  it('should reject with a timeout error if the request takes longer than 30 seconds', async () => {
    process.env.OPENAI_APPS_SDK_ENDPOINT = 'https://mock.codex.api/chatback';
    process.env.OPENAI_APPS_SDK_KEY = 'mock-api-key';

    vi.useFakeTimers();

    // Mock fetch to simulate a long-running request that gets aborted
    vi.spyOn(global, 'fetch').mockImplementation(
      (url: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal as AbortSignal;
        return new Promise((resolve, reject) => {
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError')); // Simulate AbortError
            });
          }
          // Simulate a very long-running request by not resolving/rejecting here
          // The abort signal should trigger the rejection.
        });
      },
    );

    const promise = dispatchToCodex(mockPayload);

    vi.advanceTimersByTime(30 * 1000 + 1);

    await expect(promise).rejects.toThrow('Codex App Server request timed out after 30 seconds.');

    vi.useRealTimers();
  }, 35 * 1000); // Increased timeout to 35 seconds
});
