

export type CodexChatbackResult = {
  chatback_text: string;
  suggested_tags?: string[];
  updated_metadata?: object;
};

export type CaptureWebhookPayload = {
  chatgpt_user_id?: string;
  drive_file_id: string;
  filename: string;
  mime: 'image/jpeg';
  size: number;
  shot_at: number;
  sha1: string;
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
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Codex App Server request timed out after 30 seconds.');
    }
    throw error;
  }
}
