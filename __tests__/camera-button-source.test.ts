import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("app/components/CameraButton.tsx", "utf8");

describe("CameraButton S2 source contract", () => {
  it("keeps camera capture single-file and adds a separate multiple library input", () => {
    expect(source).toContain('capture="environment"');
    expect(source).toContain("multiple");
    expect(source).toContain('data-testid="library-upload-button"');
    expect(source).toContain("ライブラリから選択");
  });

  it("awaits onCaptured while iterating selected library files", () => {
    expect(source).toContain("for (let index = 0; index < total; index += 1)");
    expect(source).toContain("await processSelectedFile(files[index], undefined");
    expect(source).toContain("await onCaptured(blob, filename, shot_at");
    expect(source).toContain("index: index + 1");
    expect(source).toContain("total");
  });
});
