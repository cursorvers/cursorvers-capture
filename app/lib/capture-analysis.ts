// Client-side AI analysis: posts the captured image (+ optional audio) to
// /api/codex/analyze, then writes the structured result into the Drive
// file's description so the history view (and external tools that read
// Drive metadata) can surface it.

export type CaptureAnalysis = {
  summary: string;
  ocr_text: string;
  audio_transcript: string;
  suggested_tags: string[];
  category: "medical" | "document" | "scene" | "other";
};

async function blobToBase64(blob: Blob): Promise<string> {
  // Strip the data URL prefix so we can send raw base64 to the API.
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
}): Promise<CaptureAnalysis> {
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
    throw new Error(`Analyze failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as CaptureAnalysis;
}

const DESC_MARKER = "__cv_analysis__:";

// We store the JSON as a magic-prefixed line so a user editing the
// description in the Drive UI doesn't lose it accidentally (and so we
// can detect ours vs. user-typed text).
export function buildDescription(analysis: CaptureAnalysis): string {
  const meta = {
    summary: analysis.summary,
    tags: analysis.suggested_tags,
    category: analysis.category,
    ocr_text: analysis.ocr_text,
    audio_transcript: analysis.audio_transcript,
  };
  return `${analysis.summary}\n\n${DESC_MARKER}${JSON.stringify(meta)}`;
}

export function parseDescription(
  description: string | undefined,
): CaptureAnalysis | null {
  if (!description) return null;
  const idx = description.indexOf(DESC_MARKER);
  if (idx < 0) return null;
  try {
    const json = description.slice(idx + DESC_MARKER.length).trim();
    const parsed = JSON.parse(json) as {
      summary?: string;
      tags?: string[];
      category?: CaptureAnalysis["category"];
      ocr_text?: string;
      audio_transcript?: string;
    };
    return {
      summary: parsed.summary ?? "",
      ocr_text: parsed.ocr_text ?? "",
      audio_transcript: parsed.audio_transcript ?? "",
      suggested_tags: parsed.tags ?? [],
      category: parsed.category ?? "other",
    };
  } catch {
    return null;
  }
}

export async function saveAnalysisToDrive(
  fileId: string,
  accessToken: string,
  analysis: CaptureAnalysis,
): Promise<void> {
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description: buildDescription(analysis) }),
    },
  );
}
