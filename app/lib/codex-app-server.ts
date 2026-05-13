export type AudioPayload = {
  drive_file_id: string;
  audio_base64: string;
  mime: string;
  duration_ms: number;
};

export type AudioResult = {
  transcript: string;
  cleaned_text: string;
  summary?: string;
};

export type CaptureWebhookPayload = {
  drive_file_id: string;
  filename: string;
  shot_at: string;
  mime: string;
  size: number;
  sha1: string;
  chatgpt_user_id: string;
};

export type CodexChatbackResult = {
  chatback_text: string;
  suggested_tags: string[];
  updated_metadata: Record<string, string>;
};

export type OcrPayload = {
  drive_file_id: string;
  image_base64: string;
  mime: string;
};

export type OcrResult = {
  confidence: number;
  extracted_text: string;
  structured: Record<string, unknown>;
};

export type AdvisoryHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

const CODEX_TIMEOUT_MS = 30 * 1000; // 30 seconds

export async function dispatchToCodex(
  payload: CaptureWebhookPayload,
): Promise<CodexChatbackResult> {
  const endpoint = process.env.OPENAI_APPS_SDK_ENDPOINT;
  const apiKey = process.env.OPENAI_APPS_SDK_KEY;

  if (!endpoint || !apiKey) {
    console.warn('Codex App Server endpoint or API key not configured. Running in stub mode.');
    // Stub mode fallback
    return new Promise((resolve) => {
      setTimeout(
        () =>
          resolve({
            chatback_text: `✓ ${payload.filename} を保存しました (stub)`, // Added '(stub)' to distinguish
            suggested_tags: [],
            updated_metadata: {},
          }),
        1000,
      );
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CODEX_TIMEOUT_MS);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        image_url: `https://drive.google.com/uc?id=${payload.drive_file_id}`,
        filename: payload.filename,
        shot_at: payload.shot_at,
        mime: payload.mime,
        size: payload.size,
        sha1: payload.sha1,
        chatgpt_user_id: payload.chatgpt_user_id,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Codex API error: ${response.status} - ${errorText}`);
    }

    const result: CodexChatbackResult = await response.json();
    return result;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Codex App Server request timed out after 30 seconds.');
    }
    // Re-throw other errors after ensuring type safety
    throw error; 
  }
}

export async function requestAudioTranscript(
  payload: AudioPayload
): Promise<AudioResult> {
  const endpoint = process.env.OPENAI_APPS_SDK_AUDIO_ENDPOINT;
  const apiKey = process.env.OPENAI_APPS_SDK_KEY;

  if (!endpoint || !apiKey) {
    console.warn('Codex App Server audio endpoint or API key not configured. Running in stub mode.');
    // Stub mode fallback
    return new Promise((resolve) => {
      setTimeout(
        () =>
          resolve({
            transcript: '音声メモ stub',
            cleaned_text: '撮影内容についての説明',
            summary: '',
          }),
        1500, // 1.5 seconds as per spec
      );
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CODEX_TIMEOUT_MS);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Codex Audio API error: ${response.status} - ${errorText}`);
    }

    const result: AudioResult = await response.json();
    return result;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Codex App Server audio request timed out after 30 seconds.');
    }
    throw error;
  }
}

export async function requestOcr(payload: OcrPayload): Promise<OcrResult> {
  const endpoint = process.env.OPENAI_APPS_SDK_OCR_ENDPOINT;
  const apiKey = process.env.OPENAI_APPS_SDK_KEY;

  if (!endpoint || !apiKey) {
    console.warn(
      'Codex App Server OCR endpoint or API key not configured. Running in stub mode.'
    );
    // Stub mode fallback
    return new Promise((resolve) => {
      setTimeout(
        () =>
          resolve({
            confidence: 0.95,
            extracted_text: 'デモ用OCR結果',
            structured: {},
          }),
        1000
      );
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CODEX_TIMEOUT_MS);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Codex OCR API error: ${response.status} - ${errorText}`);
    }

    const result: OcrResult = await response.json();
    return result;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        'Codex App Server OCR request timed out after 30 seconds.'
      );
    }
    throw error; // Re-throw other errors after ensuring type safety
  }
}

export async function requestAdvisory(payload: {
  message: string;
  history: AdvisoryHistoryMessage[];
}): Promise<{ reply: string }> {
  const endpoint = process.env.OPENAI_APPS_SDK_ADVISORY_ENDPOINT;
  const apiKey = process.env.OPENAI_APPS_SDK_KEY;

  if (!endpoint || !apiKey) {
    console.warn(
      "Codex App Server advisory endpoint or API key not configured. Running in stub mode.",
    );
    const stubReply = `Cursorvers Advisory stub: ${payload.message} を受け取りました。実際のサービスは Phase B で接続予定`;
    return Promise.resolve({ reply: stubReply });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CODEX_TIMEOUT_MS);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Codex Advisory API error: ${response.status} - ${errorText}`);
    }

    const result = (await response.json()) as { reply?: string };
    const reply =
      typeof result.reply === "string"
        ? result.reply
        : JSON.stringify(result);
    return { reply };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "Codex App Server advisory request timed out after 30 seconds.",
      );
    }
    throw error;
  }
}

