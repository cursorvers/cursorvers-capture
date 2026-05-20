import { readCookie, verify } from "../../_shared/cookie";

interface Env {
  COOKIE_SECRET: string;
  CODEX_GATEWAY_URL: string;
  CODEX_GATEWAY_KEY: string;
}

const COOKIE_NAME = "gdrive_email";
const MAX_PAYLOAD_BYTES = 12 * 1024 * 1024;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const signed = readCookie(request.headers.get("cookie"), COOKIE_NAME);
  const email = signed ? await verify(signed, env.COOKIE_SECRET).catch(() => null) : null;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const text = await request.text();
  if (text.length > MAX_PAYLOAD_BYTES) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  if (!env.CODEX_GATEWAY_URL || !env.CODEX_GATEWAY_KEY) {
    return Response.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const upstream = await fetch(`${env.CODEX_GATEWAY_URL}/v1/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.CODEX_GATEWAY_KEY}`,
    },
    body: text,
  });

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
};
