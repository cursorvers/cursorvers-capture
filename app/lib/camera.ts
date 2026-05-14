import imageCompression from "browser-image-compression";

/**
 * Error class for camera capture failures. The `code` field lets the UI
 * map to a human-readable message without parsing the error message string.
 */
export class CameraCaptureError extends Error {
  public readonly code:
    | "unsupported_type"
    | "compression_failed"
    | "empty_file";
  constructor(
    code: CameraCaptureError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "CameraCaptureError";
    this.code = code;
  }
}

export function isHeicLike(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name)
  );
}

/**
 * Returns true when the file is something we can plausibly pass to
 * browser-image-compression. iOS Safari occasionally surfaces a video picker
 * even with accept="image/*", and on some Android browsers the user can
 * paste a non-image; in either case we want to fail fast with a clear
 * message rather than wait for the compression library to throw.
 */
export function isAcceptableImageFile(file: File): boolean {
  if (file.size === 0) return false;
  // file.type can be empty on some platforms; fall back to extension check.
  if (file.type) {
    return file.type.startsWith("image/");
  }
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif)$/i.test(file.name);
}

export async function processCapturedFile(
  file: File,
): Promise<{
  blob: Blob;
  mime: "image/jpeg";
  shot_at: number;
  was_heic: boolean;
}> {
  if (file.size === 0) {
    throw new CameraCaptureError(
      "empty_file",
      `Captured file is empty (name=${file.name})`,
    );
  }
  if (!isAcceptableImageFile(file)) {
    throw new CameraCaptureError(
      "unsupported_type",
      `Unsupported file type (${file.type || "unknown"} / ${file.name})`,
    );
  }

  const was_heic = isHeicLike(file);
  if (was_heic && typeof console !== "undefined") {
    // Diagnostic-only log; replaced by Sentry breadcrumb once observability lands.
    console.info(
      "[camera] HEIC/HEIF input detected; will transcode to JPEG via browser-image-compression",
    );
  }

  let compressedFile: File;
  try {
    compressedFile = await imageCompression(file, {
      maxSizeMB: 8,
      maxWidthOrHeight: 4096,
      fileType: "image/jpeg",
      useWebWorker: true,
      initialQuality: 0.85,
    });
  } catch (cause) {
    throw new CameraCaptureError(
      "compression_failed",
      `Image compression failed (${file.type || "unknown"} / ${file.name})`,
      { cause },
    );
  }

  const lm = file.lastModified;
  const shot_at = Number.isFinite(lm) && lm > 0 ? lm : Date.now();

  return {
    blob: compressedFile,
    mime: "image/jpeg",
    shot_at,
    was_heic,
  };
}
