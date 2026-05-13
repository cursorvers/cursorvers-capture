import { NextResponse } from "next/server";
import { kvSetEncrypted } from "../../../app/lib/kv";
import {
  dispatchToCodex,
  type CaptureWebhookPayload,
  type CodexChatbackResult,
} from "../../../app/lib/codex-app-server";

const CHATBACK_KV_TTL_SEC = 60 * 60 * 24;

export async function POST(req: Request) {
  const authorizationHeader = req.headers.get("Authorization");
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return new NextResponse("Unauthorized: Missing or invalid Authorization header", {
      status: 401,
    });
  }

  const token = authorizationHeader.split(" ")[1];
  const isAuthorized = process.env.WEBHOOK_SECRET === token;

  if (!isAuthorized) {
    return new NextResponse("Unauthorized: Invalid token", { status: 401 });
  }

  let payload: CaptureWebhookPayload;
  try {
    payload = (await req.json()) as CaptureWebhookPayload;
    if (
      !payload.drive_file_id ||
      !payload.filename ||
      !payload.mime ||
      payload.size === undefined ||
      payload.shot_at === undefined ||
      !payload.sha1
    ) {
      return new NextResponse("Bad Request: Missing required payload fields", {
        status: 400,
      });
    }
    if (payload.mime !== "image/jpeg") {
      return new NextResponse("Bad Request: Only image/jpeg mime type is supported", {
        status: 400,
      });
    }
  } catch (error) {
    console.error("Failed to parse webhook payload:", error);
    return new NextResponse("Bad Request: Invalid JSON payload", { status: 400 });
  }

  const kvKey = `chatback:${payload.drive_file_id}`;

  await kvSetEncrypted(kvKey, { status: "pending", ...payload }, CHATBACK_KV_TTL_SEC);

  dispatchToCodex(payload)
    .then(async (codexResult: CodexChatbackResult) => {
      await kvSetEncrypted(
        kvKey,
        { status: "done", result: codexResult },
        CHATBACK_KV_TTL_SEC,
      );
    })
    .catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error dispatching to Codex for ${payload.drive_file_id}:`, error);
      await kvSetEncrypted(
        kvKey,
        { status: "failed", error: message },
        CHATBACK_KV_TTL_SEC,
      );
    });

  return new NextResponse("Accepted", { status: 202 });
}
