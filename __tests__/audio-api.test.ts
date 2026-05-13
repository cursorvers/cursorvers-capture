import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/app/lib/server-cookie', () => ({
  getGdriveEmail: vi.fn(),
}));

vi.mock('@/app/lib/codex-app-server', () => ({
  requestAudioTranscript: vi.fn(),
}));

vi.mock('@/app/lib/kv', () => ({
  kvSetEncrypted: vi.fn(),
  kvGetEncrypted: vi.fn(),
  kvDelete: vi.fn(),
}));

import { POST } from '@/app/api/audio/route';
import { getGdriveEmail } from '@/app/lib/server-cookie';
import { requestAudioTranscript } from '@/app/lib/codex-app-server';
import type { AudioResult } from '@/app/lib/codex-app-server';
import { kvSetEncrypted } from '@/app/lib/kv';

describe('Audio API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGdriveEmail).mockResolvedValue('test@example.com');
    vi.mocked(kvSetEncrypted).mockResolvedValue(undefined);
  });

  it('should return 401 if unauthorized', async () => {
    vi.mocked(getGdriveEmail).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('should process audio and save to KV', async () => {
    const stub: AudioResult = {
      transcript: 'hello',
      cleaned_text: 'hello',
      summary: 'hi',
    };
    vi.mocked(requestAudioTranscript).mockResolvedValue(stub);

    const payload = {
      drive_file_id: 'file-123',
      audio_base64: Buffer.from('hello').toString('base64'),
      mime: 'audio/webm',
      duration_ms: 1200,
    };
    const req = new NextRequest('http://localhost/api/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(stub);
    expect(requestAudioTranscript).toHaveBeenCalledWith(payload);
    expect(kvSetEncrypted).toHaveBeenCalledWith(`audio:${payload.drive_file_id}`, stub, 604800);
  });
});
