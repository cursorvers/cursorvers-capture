// Gemini 2.5 Flash REST wrapper for CF Pages Functions.
//
// Edge-native (just `fetch`), no SDK. Uses structured output via
// responseMimeType + responseSchema so the model is constrained to return
// strict JSON we can deserialize without parsing fragility.

export type CaptureAnalysis = {
  summary: string;
  ocr_text: string;
  audio_transcript: string;
  suggested_tags: string[];
  category: "medical" | "document" | "scene" | "other";
};

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `あなたは医療現場の記録支援AIです。撮影された画像（および音声があれば）から、次の情報を構造化して返してください。

- summary: 画像内容を 1 文 30〜70 字で日本語要約 (例: "処方箋: アムロジピン 5mg 30日分")
- ocr_text: 画像内の文字を全て書き起こす。レイアウトを大きく崩さず改行は維持。文字がなければ空文字
- audio_transcript: 音声があれば日本語で文字起こし。なければ空文字
- suggested_tags: 3-5 個。具体的なキーワード (薬剤名、検査名、症状、部位、書類種別など)
- category: medical / document / scene / other のいずれか

医療関係の専門用語は省略せず正確に。患者個人情報は要約に含めず、ocr_text にのみ残す。`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    ocr_text: { type: "string" },
    audio_transcript: { type: "string" },
    suggested_tags: { type: "array", items: { type: "string" } },
    category: {
      type: "string",
      enum: ["medical", "document", "scene", "other"],
    },
  },
  required: ["summary", "ocr_text", "audio_transcript", "suggested_tags", "category"],
};

export type AnalyzeOpts = {
  imageBase64: string;
  imageMime: string;
  audioBase64?: string;
  audioMime?: string;
  apiKey: string;
};

export async function analyzeCapture(
  opts: AnalyzeOpts,
): Promise<CaptureAnalysis> {
  const parts: Array<Record<string, unknown>> = [
    {
      inlineData: {
        mimeType: opts.imageMime,
        data: opts.imageBase64,
      },
    },
  ];
  if (opts.audioBase64 && opts.audioMime) {
    parts.push({
      inlineData: {
        mimeType: opts.audioMime,
        data: opts.audioBase64,
      },
    });
  }
  parts.push({ text: SYSTEM_PROMPT });

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(opts.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 240)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`);
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned no text part");
  }
  const parsed = JSON.parse(text) as CaptureAnalysis;
  return parsed;
}
