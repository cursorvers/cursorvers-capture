import { readCookie, verify } from "../../_shared/cookie";

interface Env {
  COOKIE_SECRET: string;
  CODEX_GATEWAY_URL: string;
  CODEX_GATEWAY_KEY: string;
}

const COOKIE_NAME = "gdrive_email";
const MAX_PAYLOAD_BYTES = 12 * 1024 * 1024;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Phase 22.2C: CSRF Origin/Referer 検証
  // Same-origin POST only。Sec-Fetch-Site:cross-site も拒否。
  const reqUrl = new URL(request.url);
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  const sameOriginByHeader =
    (origin && new URL(origin).origin === reqUrl.origin) ||
    (referer && new URL(referer).origin === reqUrl.origin);
  if (fetchSite && fetchSite === "cross-site") {
    return Response.json(
      { error: { code: "forbidden", message: "cross-site request rejected", retryable: false } },
      { status: 403 },
    );
  }
  // Browsers always send Origin on POST → enforce. If both missing, allow
  // (CLI / health checks) but require Bearer token (we still verify cookie below).
  if ((origin || referer) && !sameOriginByHeader) {
    return Response.json(
      { error: { code: "forbidden", message: "origin mismatch", retryable: false } },
      { status: 403 },
    );
  }

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
