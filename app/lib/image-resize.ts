// Client-side image resize before upload to gateway.
// Critic verification 一致: 5-12MB の生画像が Worker CPU/memory 超過 → 502。
// 長辺 2400px / JPEG quality 0.82 / hard cap 4MB を目標に圧縮。
//
// 注意: Drive にはオリジナル画像を上げる (resize は AI 送信専用)。
//       resize 結果は analyzeCapture() の入力としてのみ使用。

const MAX_LONG_EDGE = 2400;
const TARGET_QUALITY = 0.82;
const HARD_CAP_BYTES = 4 * 1024 * 1024;

export async function resizeImageForAI(blob: Blob): Promise<Blob> {
  // 既に小さい (target 以下) ならそのまま返す
  if (blob.size <= HARD_CAP_BYTES && !needsDimensionShrink(blob)) {
    return blob;
  }

  try {
    const bitmap = await loadBitmap(blob);
    const { width, height } = computeTargetSize(bitmap.width, bitmap.height);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return blob; // canvas 利用不可 → 諦めて元 blob
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    // Step 1: 0.82 で試す
    let out = await canvasToBlob(canvas, TARGET_QUALITY);
    if (out && out.size <= HARD_CAP_BYTES) return out;

    // Step 2: 0.7 まで下げる
    out = await canvasToBlob(canvas, 0.7);
    if (out && out.size <= HARD_CAP_BYTES) return out;

    // Step 3: 0.55 (最終手段)
    out = await canvasToBlob(canvas, 0.55);
    if (out) return out;

    return blob; // すべて失敗 → 元 blob (gateway 側で reject されても情報残る)
  } catch {
    // Resize 失敗時は元 blob を返す。AI 解析が落ちる可能性はあるが Drive 保存は影響受けない。
    return blob;
  }
}

async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(blob);
  }
  // Fallback: HTMLImageElement
  return new Promise<ImageBitmap>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = async () => {
      try {
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

function needsDimensionShrink(_blob: Blob): boolean {
  // We don't know dimensions without decoding. Treat size > 1MB as suspect.
  return _blob.size > 1024 * 1024;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}
