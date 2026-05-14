/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("browser-image-compression", () => ({
  default: vi.fn(),
}));

// Re-import inside each test to pick up the mocked module
// eslint-disable-next-line @typescript-eslint/no-require-imports
async function loadCamera() {
  return await import("@/app/lib/camera");
}

function makeFile(name: string, type: string, size: number = 1024): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type, lastModified: 1715600000000 });
}

describe("camera.processCapturedFile (P0-2 hardening 2026-05-14)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const imageCompression = (await import("browser-image-compression")).default;
    vi.mocked(imageCompression).mockImplementation(async (file: File) => {
      // simulate compression by returning a JPEG of half the size
      return new File([new Uint8Array(Math.max(1, Math.floor(file.size / 2)))], "compressed.jpg", {
        type: "image/jpeg",
      });
    });
  });

  it("accepts a standard JPEG and reports was_heic=false", async () => {
    const { processCapturedFile } = await loadCamera();
    const file = makeFile("photo.jpg", "image/jpeg", 4096);
    const result = await processCapturedFile(file);
    expect(result.mime).toBe("image/jpeg");
    expect(result.was_heic).toBe(false);
    expect(result.shot_at).toBe(1715600000000);
  });

  it("flags HEIC input via was_heic", async () => {
    const { processCapturedFile } = await loadCamera();
    const file = makeFile("IMG_0001.HEIC", "image/heic", 4096);
    const result = await processCapturedFile(file);
    expect(result.was_heic).toBe(true);
    expect(result.mime).toBe("image/jpeg");
  });

  it("rejects empty files with code=empty_file", async () => {
    const { processCapturedFile, CameraCaptureError } = await loadCamera();
    const file = makeFile("photo.jpg", "image/jpeg", 0);
    await expect(processCapturedFile(file)).rejects.toBeInstanceOf(CameraCaptureError);
    try {
      await processCapturedFile(file);
    } catch (e) {
      if (e instanceof CameraCaptureError) {
        expect(e.code).toBe("empty_file");
      }
    }
  });

  it("rejects non-image files with code=unsupported_type", async () => {
    const { processCapturedFile, CameraCaptureError } = await loadCamera();
    const file = makeFile("clip.mov", "video/quicktime", 4096);
    await expect(processCapturedFile(file)).rejects.toBeInstanceOf(CameraCaptureError);
    try {
      await processCapturedFile(file);
    } catch (e) {
      if (e instanceof CameraCaptureError) {
        expect(e.code).toBe("unsupported_type");
      }
    }
  });

  it("rejects files with empty type AND non-image extension", async () => {
    const { processCapturedFile, CameraCaptureError } = await loadCamera();
    const file = makeFile("note.pdf", "", 4096);
    await expect(processCapturedFile(file)).rejects.toBeInstanceOf(CameraCaptureError);
  });

  it("wraps imageCompression failures with code=compression_failed", async () => {
    const { processCapturedFile, CameraCaptureError } = await loadCamera();
    const imageCompression = (await import("browser-image-compression")).default;
    vi.mocked(imageCompression).mockRejectedValueOnce(new Error("OOM"));
    const file = makeFile("photo.jpg", "image/jpeg", 4096);
    await expect(processCapturedFile(file)).rejects.toBeInstanceOf(CameraCaptureError);
    try {
      await processCapturedFile(file);
    } catch (e) {
      if (e instanceof CameraCaptureError) {
        expect(e.code).toBe("compression_failed");
        expect(e.cause).toBeInstanceOf(Error);
      }
    }
  });
});
