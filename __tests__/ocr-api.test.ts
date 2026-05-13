import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ocr/route';
import { getGdriveEmail } from '@/app/lib/server-cookie';
import { requestOcr, OcrResult } from '@/app/lib/codex-app-server';
import { kvSetEncrypted } from '@/app/lib/kv';
import { Buffer } from 'buffer';


// Mock dependencies
vi.mock('@/app/lib/server-cookie', () => ({
  getGdriveEmail: vi.fn(),
}));

vi.mock('@/app/lib/codex-app-server', () => ({
  requestOcr: vi.fn(),
}));

vi.mock('@/app/lib/kv', () => ({
  kvSetEncrypted: vi.fn(),
  kvGetEncrypted: vi.fn(),
  kvDelete: vi.fn(),
}));

describe('OCR API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGdriveEmail).mockResolvedValue('test@example.com');
    vi.mocked(kvSetEncrypted).mockResolvedValue(undefined);
  });

  it('should return 401 if unauthorized', async () => {
    vi.mocked(getGdriveEmail).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/ocr', { method: 'POST', body: '{}' });
    const res = await POST(req);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('should return 400 if missing required fields', async () => {
    const req = new NextRequest('http://localhost/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drive_file_id: '123' }), // Missing image_base64 and mime
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Missing required fields' });
  });

  it('should return fixed OcrResult in stub mode and save to KV', async () => {
    // Mock requestOcr to return stub data
    const stubOcrResult: OcrResult = { confidence: 0.95, extracted_text: 'デモ用OCR結果', structured: {} };
    vi.mocked(requestOcr).mockResolvedValue(stubOcrResult);

    const payload = {
      drive_file_id: 'file-123',
      image_base64: 'data:image/jpeg;base64,stubimage',
      mime: 'image/jpeg',
    };
    const req = new NextRequest('http://localhost/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(stubOcrResult);
    expect(requestOcr).toHaveBeenCalledWith(payload);
    expect(kvSetEncrypted).toHaveBeenCalledWith(`ocr:${payload.drive_file_id}`, stubOcrResult, 3600);
  });

  it('should return 413 if payload (base64) is too large', async () => {
    const largeBase64 = Buffer.from('a'.repeat(4 * 1024 * 1024 + 100)).toString('base64'); // > 4MB
    const payload = {
      drive_file_id: 'file-large',
      image_base64: largeBase64,
      mime: 'image/jpeg',
    };
    const req = new NextRequest('http://localhost/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: 'Payload too large' });
    expect(requestOcr).not.toHaveBeenCalled();
    expect(kvSetEncrypted).not.toHaveBeenCalled();
  });
});
