// Type-only stub for the deferred Codex dispatch chain. Restored from git
// when the OCR / audio / advisory / chatback features come back online.

export type OcrResult = {
  extracted_text: string;
  confidence: number;
  structured?: Record<string, unknown>;
};

export type AudioResult = {
  transcript: string;
  cleaned_text?: string;
  summary?: string;
  duration_ms?: number;
};
