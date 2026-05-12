import { NextRequest, NextResponse } from 'next/server';
import { getGdriveEmail } from '../../lib/server-cookie';
import { kvSet } from '../../lib/kv';
import { OcrPayload, OcrResult, requestOcr } from '../../lib/codex-app-server';

const MAX_PAYLOAD_SIZE = 4 * 1024 * 1024; // 4MB

export async function POST(req: NextRequest) {
  const gdriveEmail = await getGdriveEmail();

  if (!gdriveEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload: OcrPayload = await req.json();
    const { drive_file_id, image_base64, mime } = payload;

    if (!drive_file_id || !image_base64 || !mime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check payload size
    const base64Size = Buffer.byteLength(image_base64, 'base64');
    if (base64Size > MAX_PAYLOAD_SIZE) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const ocrResult: OcrResult = await requestOcr(payload);

    // Save result to KV
    await kvSet(`ocr:${drive_file_id}`, ocrResult, 3600); // Store for 1 hour

    return NextResponse.json(ocrResult, { status: 200 });
  } catch (error) {
    console.error('OCR API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
