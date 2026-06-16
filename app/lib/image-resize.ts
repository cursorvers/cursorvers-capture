// Client-side image resize before upload to gateway.
// Phase 22 → Phase 22.1 で fallback paths を強化:
//   - 元 blob を返す path は廃止 (4MB 超は throw)
//   - canvas re-encode で EXIF GPS も必ず削除
//   - 失敗時は CodexAnalysisError ではなく独自エラーを throw (caller が friendly message に変換)

const MAX_LONG_EDGE = 2400;
const TARGET_QUALITY = 0.82;
const HARD_CAP_BYTES = 4 * 1024 * 1024;

export class ImageResizeError extends Error {
  constructor(
    message: string,
    public code: "decode_failed" | "too_large_after_resize" | "canvas_unsupported",
  ) {
    super(message);
    this.name = "ImageResizeError";
  }
}

export async function resizeImageForAI(blob: Blob): Promise<Blob> {
  // 既に小さい場合でも EXIF を剥がすため、最低限 1 回は canvas 経由する
  // ただし 1MB 未満かつ画像 mime なら EXIF strip だけして返す経済モード
  const isSmall = blob.size < 1024 * 1024;

  let bitmap: ImageBitmap;
  try {
    bitmap = await loadBitmap(blob);
  } catch {
    throw new ImageResizeError(
      "画像のデコードに失敗しました。別の写真でお試しください。",
      "decode_failed",
    );
  }

  const { width, height } = computeTargetSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new ImageResizeError(
      "このブラウザでは画像処理がサポートされていません。",
      "canvas_unsupported",
    );
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // 段階的 quality で 4MB cap を必ず達成
  const qualities = isSmall ? [0.85, 0.75] : [TARGET_QUALITY, 0.7, 0.55, 0.4];
  for (const q of qualities) {
    const out = await canvasToBlob(canvas, q);
    if (out && out.size <= HARD_CAP_BYTES) return out;
  }

  // ここまで来たら 0.4 でも 4MB 超え (極端なケース) → 諦めて throw
  throw new ImageResizeError(
    "画像が大きすぎます。Camera 設定で解像度を下げてみてください。",
    "too_large_after_resize",
  );
}

async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  // Phase 22.3: typeof guard で iOS 14/古い Safari 未対応環境でも throw しない
  const hasCIB = typeof globalThis.createImageBitmap === "function";
  if (hasCIB) {
    try {
      return await createImageBitmap(blob);
    } catch {
      // 一部 iOS Safari で reject → HTMLImageElement fallback
    }
  }
  return new Promise<ImageBitmap>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = async () => {
      try {
        if (!hasCIB) {
          // createImageBitmap が無い環境では Image 自体を bitmap-like 扱い
          // (canvas.drawImage は HTMLImageElement を直接受け取る)
          URL.revokeObjectURL(url);
          resolve(img as unknown as ImageBitmap);
          return;
        }
        const bmp = await createImageBitmap(img);
        URL.revokeObjectURL(url);
        resolve(bmp);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

function computeTargetSize(w: number, h: number): { width: number; height: number } {
  const long = Math.max(w, h);
  if (long <= MAX_LONG_EDGE) return { width: w, height: h };
  const scale = MAX_LONG_EDGE / long;
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}
