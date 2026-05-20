import { readCookie, verify } from "../../_shared/cookie";
import { analyzeCapture, type CaptureAnalysis } from "../../_shared/gemini";

interface Env {
  COOKIE_SECRET: string;
  GEMINI_API_KEY: string;
}

const COOKIE_NAME = "gdrive_email";
const MAX_PAYLOAD_BYTES = 12 * 1024 * 1024; // ~12 MiB — Gemini hard cap is 20 MB total

type ReqBody = {
  image_base64?: string;
  image_mime?: string;
  audio_base64?: string;
  audio_mime?: string;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Authn gate — same signed cookie middleware uses elsewhere
  const signed = readCookie(request.headers.get("cookie"), COOKIE_NAME);
  const email = signed ? await verify(signed, env.COOKIE_SECRET).catch(() => null) : null;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ReqBody;
  try {
    body = (await request.json()) as ReqBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.image_base64 || !body.image_mime) {
    return Response.json(
      { error: "image_base64 and image_mime required" },
      { status: 400 },
    );
  }

  // Cheap payload sanity check — base64 inflates ~4/3 vs raw, but the
  // request body limit on Pages Functions is ~100 MB so this is the
  // upstream Gemini constraint we care about.
  const approxBytes =
    body.image_base64.length + (body.audio_base64?.length ?? 0);
  if (approxBytes > MAX_PAYLOAD_BYTES) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  if (!env.GEMINI_API_KEY) {
    return Response.json({ error: "AI not configured" }, { status: 503 });
  }

  let analysis: CaptureAnalysis;
  try {
    analysis = await analyzeCapture({
      imageBase64: body.image_base64,
      imageMime: body.image_mime,
      audioBase64: body.audio_base64,
      audioMime: body.audio_mime,
      apiKey: env.GEMINI_API_KEY,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Surface to client but don't expose API key shape
    return Response.json({ error: msg }, { status: 502 });
  }

  return Response.json(analysis);
};
