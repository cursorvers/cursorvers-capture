// Codex Secretary client. Posts the captured image (+ optional audio)
// to /api/codex/analyze (which proxies to cursorvers-codex-gateway) and
// returns a CodexReply with doc-type classification, extracted fields,
// and Drive-friendly rename/folder suggestions.

import { resizeImageForAI, ImageResizeError } from "./image-resize";

export type CodexErrorCode =
  | "gateway_unavailable"
  | "gateway_timeout"
  | "rate_limited"
  | "payload_too_large"
  | "unauthorized"
  | "network_error"
  | "image_too_large"
  | "image_decode_failed"
  | "unknown";

export class CodexAnalysisError extends Error {
  constructor(
    message: string,
    public code: CodexErrorCode,
    public status: number,
    public retryable: boolean,
  ) {
    super(message);
    this.name = "CodexAnalysisError";
  }
}

function classifyErrorStatus(status: number): { code: CodexErrorCode; retryable: boolean } {
  if (status === 0) return { code: "network_error", retryable: true };
  if (status === 401) return { code: "unauthorized", retryable: false };
  if (status === 413) return { code: "payload_too_large", retryable: false };
  if (status === 429) return { code: "rate_limited", retryable: true };
  if (status === 504) return { code: "gateway_timeout", retryable: true };
  if (status === 502 || status === 503) return { code: "gateway_unavailable", retryable: true };
  if (status >= 500) return { code: "gateway_unavailable", retryable: true };
  return { code: "unknown", retryable: false };
}

function friendlyMessage(code: CodexErrorCode): string {
  switch (code) {
    case "gateway_unavailable":
      return "AI 解析サーバーが混み合っています。少し待ってから再試行してください。";
    case "gateway_timeout":
      return "AI 解析がタイムアウトしました。画像が大きい可能性があります。";
    case "rate_limited":
      return "短時間にリクエストが多すぎます。少し待ってから再試行してください。";
    case "payload_too_large":
      return "画像サイズが上限を超えています。";
    case "unauthorized":
      return "サインインが切れています。設定→再認可 をお試しください。";
    case "network_error":
      return "ネットワークに接続できません。電波・Wi-Fi をご確認ください。";
    case "image_too_large":
      return "画像が大きすぎます。Camera 設定で解像度を下げてみてください。";
    case "image_decode_failed":
      return "画像のデコードに失敗しました。別の写真でお試しください。";
    default:
      return "AI 解析でエラーが発生しました。再試行してください。";
  }
}


export type CodexExtracted = {
  vendor?: string;
  amount?: number;
  currency?: string;
  date_iso?: string;
  topic?: string;
  items?: string[];
};

export type CodexReply = {
  comment: string;
  doc_type: "receipt" | "memo" | "business_card" | "other";
  extracted: CodexExtracted;
  suggested_filename: string;
  suggested_folder: string;
  confidence: number;
};

// Legacy alias kept so existing imports compile.
export type CaptureAnalysis = CodexReply;

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("FileReader returned non-string"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export async function analyzeCapture(opts: {
  image: Blob;
  audio?: Blob | null;
}): Promise<CodexReply> {
  // 1) Client-side resize で gateway 負荷を緩和 + EXIF strip (Phase 22.1)
  let resizedImage: Blob;
  try {
    resizedImage = await resizeImageForAI(opts.image);
  } catch (e) {
    if (e instanceof ImageResizeError) {
      const code: CodexErrorCode =
        e.code === "too_large_after_resize" ? "image_too_large" : "image_decode_failed";
      throw new CodexAnalysisError(friendlyMessage(code), code, 0, false);
    }
    throw new CodexAnalysisError(friendlyMessage("unknown"), "unknown", 0, false);
  }
  const image_base64 = await blobToBase64(resizedImage);
  const audio_base64 = opts.audio ? await blobToBase64(opts.audio) : undefined;
  const payload = {
    image_base64,
    image_mime: resizedImage.type || opts.image.type || "image/jpeg",
    audio_base64,
    audio_mime: opts.audio?.type,
  };

  // 2) /api/codex/analyze に POST。429/5xx/network は最大 3 attempts (backoff 1.5s, 3s)
  const MAX_ATTEMPTS = 3;
  let res: Response | null = null;
  let lastStatus = 0;
  let networkErr: Error | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      res = await fetch("/api/codex/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // 302 を follow せず手動で扱う → cookie 切れの HTML parse 事故防止
        redirect: "manual",
      });
      lastStatus = res.status;
      networkErr = null;
    } catch (e) {
      // network error / aborted
      networkErr = e instanceof Error ? e : new Error(String(e));
      res = null;
      lastStatus = 0;
    }

    if (res && res.ok) {
      // content-type が JSON 以外なら認証 redirect の可能性 → unauthorized 扱い
      const ct = res.headers.get("Content-Type") ?? "";
      if (!ct.includes("application/json")) {
        throw new CodexAnalysisError(
          friendlyMessage("unauthorized"),
          "unauthorized",
          res.status,
          false,
        );
      }
      break;
    }
    if (res && (res.type === "opaqueredirect" || res.status === 0)) {
      // redirect:'manual' 時は opaqueredirect で返る → 認証切れ
      throw new CodexAnalysisError(
        friendlyMessage("unauthorized"),
        "unauthorized",
        0,
        false,
      );
    }
    const status = lastStatus;
    const { retryable } = classifyErrorStatus(status);
    if (!retryable || attempt >= MAX_ATTEMPTS - 1) break;
    // exponential backoff: 1.5s, 3s
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }

  if (!res || !res.ok) {
    const status = lastStatus || (res ? res.status : 0);
    const { code, retryable } = classifyErrorStatus(status);
    let detail = networkErr?.message ?? "";
    if (res && !detail) {
      try {
        const text = await res.text();
        const parsed = (() => {
          try { return JSON.parse(text); } catch { return null; }
        })();
        if (parsed && typeof parsed.error?.message === "string") {
          detail = parsed.error.message;
        }
      } catch {
        /* ignore */
      }
    }
    const msg = `${friendlyMessage(code)}${detail ? ` (${detail.slice(0, 80)})` : ""}`;
    throw new CodexAnalysisError(msg, code, status, retryable);
  }
  return (await res.json()) as CodexReply;
}

const MARKER_V3 = "__cv_codex_v3__:";
const MARKER_V2 = "__cv_codex__:";       // Codex Companion (mood/emoji/album)
const MARKER_V1 = "__cv_analysis__:";    // medical OCR (summary/tags/ocr_text)

export function buildDescription(reply: CodexReply): string {
  const head = reply.comment;
  return `${head}\n\n${MARKER_V3}${JSON.stringify(reply)}`;
}

function emptyExtracted(): CodexExtracted {
  return {};
}

export function parseDescription(
  description: string | undefined,
): CodexReply | null {
  if (!description) return null;

  const v3 = description.indexOf(MARKER_V3);
  if (v3 >= 0) {
    try {
      const parsed = JSON.parse(
        description.slice(v3 + MARKER_V3.length).trim(),
      ) as Partial<CodexReply>;
      return {
        comment: parsed.comment ?? "",
        doc_type: parsed.doc_type ?? "other",
        extracted: parsed.extracted ?? emptyExtracted(),
        suggested_filename: parsed.suggested_filename ?? "",
        suggested_folder: parsed.suggested_folder ?? "",
        confidence: parsed.confidence ?? 0,
      };
    } catch {
      /* fall through */
    }
  }

  const v2 = description.indexOf(MARKER_V2);
  if (v2 >= 0) {
    try {
      const parsed = JSON.parse(
        description.slice(v2 + MARKER_V2.length).trim(),
      ) as { comment?: string };
      return {
        comment: parsed.comment ?? "",
        doc_type: "other",
        extracted: emptyExtracted(),
        suggested_filename: "",
        suggested_folder: "",
        confidence: 0,
      };
    } catch {
      /* fall through */
    }
  }

  const v1 = description.indexOf(MARKER_V1);
  if (v1 >= 0) {
    try {
      const parsed = JSON.parse(
        description.slice(v1 + MARKER_V1.length).trim(),
      ) as { summary?: string };
      return {
        comment: parsed.summary ?? "",
        doc_type: "other",
        extracted: emptyExtracted(),
        suggested_filename: "",
        suggested_folder: "",
        confidence: 0,
      };
    } catch {
      return null;
    }
  }

  return null;
}

export async function saveAnalysisToDrive(
  fileId: string,
  accessToken: string,
  reply: CodexReply,
): Promise<void> {
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description: buildDescription(reply) }),
    },
  );
}

// Drive rename — invoked when user accepts (or edits) the Codex
// suggested_filename. Preserves the original extension if present.
export function applyExtension(base: string, originalName: string): string {
  const dot = originalName.lastIndexOf(".");
  if (dot <= 0) return base;
  const ext = originalName.slice(dot);
  // If base already ends with that extension (case-insensitive), keep it.
  if (base.toLowerCase().endsWith(ext.toLowerCase())) return base;
  return `${base}${ext}`;
}

export async function renameDriveFile(
  fileId: string,
  accessToken: string,
  newName: string,
): Promise<void> {
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    },
  );
}
