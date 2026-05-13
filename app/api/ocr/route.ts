import { NextRequest, NextResponse } from "next/server";
import { getGdriveEmail } from "../../lib/server-cookie";
import { kvSetEncrypted } from "../../lib/kv";
import { OcrPayload, OcrResult, requestOcr } from "../../lib/codex-app-server";

const MAX_PAYLOAD_SIZE = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const gdriveEmail = await getGdriveEmail();

  if (!gdriveEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload: OcrPayload = await req.json();
    const { drive_file_id, image_base64, mime } = payload;

    if (!drive_file_id || !image_base64 || !mime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const base64Size = Buffer.byteLength(image_base64, "base64");
    if (base64Size > MAX_PAYLOAD_SIZE) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const ocrResult: OcrResult = await requestOcr(payload);

    await kvSetEncrypted(`ocr:${drive_file_id}`, ocrResult, 3600);

    return NextResponse.json(ocrResult, { status: 200 });
  } catch (error: unknown) {
    console.error("OCR API error:", error);
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details },
      { status: 500 },
    );
  }
}
