import imageCompression from "browser-image-compression";

export function isHeicLike(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name)
  );
}

export async function processCapturedFile(
  file: File,
): Promise<{ blob: Blob; mime: "image/jpeg"; shot_at: number }> {
  void isHeicLike(file);

  const compressedFile = await imageCompression(file, {
    maxSizeMB: 8,
    maxWidthOrHeight: 4096,
    fileType: "image/jpeg",
    useWebWorker: true,
    initialQuality: 0.85,
  });

  const lm = file.lastModified;
  const shot_at = Number.isFinite(lm) && lm > 0 ? lm : Date.now();

  return {
    blob: compressedFile,
    mime: "image/jpeg",
    shot_at,
  };
}
