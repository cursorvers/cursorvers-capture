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

  let upstream: Response;
  try {
    upstream = await fetch(`${env.CODEX_GATEWAY_URL}/v1/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.CODEX_GATEWAY_KEY}`,
      },
      body: text,
    });
  } catch (err) {
    // network/DNS/SSL failure to upstream
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[codex-proxy] upstream fetch failed", { msg });
    return Response.json(
      {
        error: {
          code: "gateway_unavailable",
          message: "AI 解析サーバーに接続できませんでした",
          retryable: true,
          detail: msg.slice(0, 120),
        },
      },
      { status: 502 },
    );
  }

  const body = await upstream.text();
  const contentType = upstream.headers.get("Content-Type") ?? "";
  const isJson = contentType.includes("application/json");

  // upstream が 2xx かつ JSON → そのまま透過
  if (upstream.ok && isJson) {
    return new Response(body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // upstream が JSON エラーを返す → そのまま透過 (client が parse できる)
  if (isJson) {
    return new Response(body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // upstream が HTML (CF platform 502 等) → JSON 正規化
  const code =
    upstream.status === 502 || upstream.status === 503
      ? "gateway_unavailable"
      : upstream.status === 504
        ? "gateway_timeout"
        : upstream.status === 429
          ? "rate_limited"
          : "unknown";
  console.error("[codex-proxy] upstream non-JSON error", {
    status: upstream.status,
    contentType,
    bodyPreview: body.slice(0, 200),
  });
  return Response.json(
    {
      error: {
        code,
        message:
          code === "gateway_unavailable"
            ? "AI 解析サーバーが応答していません"
            : code === "gateway_timeout"
              ? "AI 解析がタイムアウトしました"
              : code === "rate_limited"
                ? "AI 解析のレート制限に達しました"
                : `AI 解析エラー (${upstream.status})`,
        retryable: code !== "unknown",
        upstream_status: upstream.status,
      },
    },
    { status: upstream.status },
  );
};
