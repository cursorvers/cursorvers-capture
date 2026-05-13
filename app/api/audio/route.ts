import { NextRequest, NextResponse } from 'next/server';
import { getGdriveEmail } from '@/app/lib/server-cookie';
import { kvSet } from '@/app/lib/kv';
import {
  requestAudioTranscript,
  type AudioPayload,
  type AudioResult,
} from '@/app/lib/codex-app-server';
import { MAX_UPLOAD_SIZE } from '@/app/lib/constants';

const AUDIO_KV_PREFIX = 'audio:';
const AUDIO_KV_TTL_SEC = 60 * 60 * 24 * 7;

function parseAudioPayload(body: unknown): AudioPayload | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const o = body as Record<string, unknown>;
  const drive_file_id = o.drive_file_id;
  const audio_base64 = o.audio_base64;
  const mime = o.mime;
  const duration_ms = o.duration_ms;
  if (
    typeof drive_file_id !== 'string' ||
    typeof audio_base64 !== 'string' ||
    typeof mime !== 'string' ||
    typeof duration_ms !== 'number'
  ) {
    return null;
  }
  return { drive_file_id, audio_base64, mime, duration_ms };
}

export async function POST(req: NextRequest) {
  const gdriveEmail = await getGdriveEmail();

  if (!gdriveEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentType = req.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Invalid Content-Type' }, { status: 400 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = parseAudioPayload(parsedBody);
  if (!payload) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { drive_file_id, audio_base64 } = payload;

  const audioSizeEstimate = (audio_base64.length * 3) / 4;
  if (audioSizeEstimate > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  try {
    const result: AudioResult = await requestAudioTranscript(payload);
    await kvSet(`${AUDIO_KV_PREFIX}${drive_file_id}`, result, AUDIO_KV_TTL_SEC);
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error('Error processing audio transcript:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
