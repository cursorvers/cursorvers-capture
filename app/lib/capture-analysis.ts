// Codex Secretary client. Posts the captured image (+ optional audio)
// to /api/codex/analyze (which proxies to cursorvers-codex-gateway) and
// returns a CodexReply with doc-type classification, extracted fields,
// and Drive-friendly rename/folder suggestions.

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
  const image_base64 = await blobToBase64(opts.image);
  const audio_base64 = opts.audio ? await blobToBase64(opts.audio) : undefined;
  const payload = {
    image_base64,
    image_mime: opts.image.type || "image/jpeg",
    audio_base64,
    audio_mime: opts.audio?.type,
  };
  const res = await fetch("/api/codex/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Codex unreachable (${res.status}): ${body.slice(0, 200)}`);
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
