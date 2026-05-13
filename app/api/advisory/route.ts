import { NextRequest, NextResponse } from "next/server";
import { getGdriveEmail } from "@/app/lib/server-cookie";
import { getTierForEmail } from "@/app/lib/server-tier";
import { requestAdvisory, type AdvisoryHistoryMessage } from "@/app/lib/codex-app-server";
import { kvSet } from "@/app/lib/kv";

const ADVISORY_KV_TTL_SEC = 60 * 60 * 24 * 7;

function normalizeHistory(raw: unknown): AdvisoryHistoryMessage[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: AdvisoryHistoryMessage[] = [];
  for (const row of raw) {
    if (
      row &&
      typeof row === "object" &&
      "role" in row &&
      "content" in row &&
      (row.role === "user" || row.role === "assistant") &&
      typeof row.content === "string"
    ) {
      out.push({ role: row.role, content: row.content });
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  const email = await getGdriveEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (getTierForEmail(email) !== "pro") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { message?: unknown }).message !== "string"
  ) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const message = (body as { message: string }).message.trim();
  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const history = normalizeHistory((body as { history?: unknown }).history);

  const { reply } = await requestAdvisory({ message, history });

  const key = `advisory:${encodeURIComponent(email)}:${Date.now()}`;
  await kvSet(
    key,
    { message, reply, at: new Date().toISOString() },
    ADVISORY_KV_TTL_SEC,
  );

  return NextResponse.json({ reply });
}
