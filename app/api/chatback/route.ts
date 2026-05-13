import { NextResponse } from "next/server";
import { kvGetEncrypted } from "../../../app/lib/kv";
import {
  type CaptureWebhookPayload,
  type CodexChatbackResult,
} from "../../../app/lib/codex-app-server";

type ChatbackKVEntry = {
  status: "pending" | "done" | "failed";
  result?: CodexChatbackResult;
  error?: string;
} & CaptureWebhookPayload;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const driveFileId = searchParams.get("id");

  if (!driveFileId) {
    return new NextResponse("Bad Request: Missing drive_file_id parameter", { status: 400 });
  }

  const kvKey = `chatback:${driveFileId}`;
  const entry = await kvGetEncrypted<ChatbackKVEntry>(kvKey);

  if (!entry) {
    return new NextResponse("Not Found: No chatback entry for this ID", { status: 404 });
  }

  if (entry.status === "pending") {
    return NextResponse.json({ status: "pending" });
  }
  if (entry.status === "done") {
    return NextResponse.json({ status: "done", ...entry.result });
  }
  if (entry.status === "failed") {
    return NextResponse.json({
      status: "failed",
      error: entry.error || "Codex analysis failed",
    });
  }

  return new NextResponse("Internal Server Error: Unexpected entry status", { status: 500 });
}
