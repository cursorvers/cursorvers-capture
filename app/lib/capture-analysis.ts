// Codex Companion client. Posts the captured image (+ optional audio) to
// /api/codex/analyze (which proxies to the cursorvers-codex-gateway) and
// returns a CodexReply: a personable comment + mood + emoji + album.
// The reply is stored in the Drive file description so the history view
// can re-render it from Drive metadata.

export type CodexReply = {
  comment: string;
  mood: string;
  emoji: string;
  album: string;
  followups: string[];
};

// Kept as an alias so existing imports don't break — same shape now.
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

const DESC_MARKER = "__cv_codex__:";

export function buildDescription(reply: CodexReply): string {
  return `${reply.emoji} ${reply.comment}\n\n${DESC_MARKER}${JSON.stringify(reply)}`;
}

export function parseDescription(
  description: string | undefined,
): CodexReply | null {
  if (!description) return null;
  const idx = description.indexOf(DESC_MARKER);
  if (idx >= 0) {
    try {
      const json = description.slice(idx + DESC_MARKER.length).trim();
      const parsed = JSON.parse(json) as Partial<CodexReply>;
      return {
        comment: parsed.comment ?? "",
        mood: parsed.mood ?? "",
        emoji: parsed.emoji ?? "✨",
        album: parsed.album ?? "",
        followups: parsed.followups ?? [],
      };
    } catch {
      // fall through to legacy parser
    }
  }
  // Legacy: old format stored under __cv_analysis__ with summary/tags etc.
  // Map it onto the new shape so old captures don't appear blank.
  const legacy = description.indexOf("__cv_analysis__:");
  if (legacy >= 0) {
    try {
      const json = description.slice(legacy + "__cv_analysis__:".length).trim();
      const parsed = JSON.parse(json) as { summary?: string; tags?: string[] };
      return {
        comment: parsed.summary ?? "",
        mood: "",
        emoji: "✨",
        album: "",
        followups: [],
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
