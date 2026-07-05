import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureAnalysis } from "@/app/lib/capture-analysis";

vi.mock("@/app/lib/ai-rename-toggle", () => ({
  getAutoAiRenameEnabled: vi.fn(),
}));

vi.mock("@/app/lib/drive", () => ({
  renameDriveFile: vi.fn(),
}));

import { getAutoAiRenameEnabled } from "@/app/lib/ai-rename-toggle";
import { autoApplyAiRename } from "@/app/lib/auto-rename";
import { renameDriveFile } from "@/app/lib/drive";

const analysis: CaptureAnalysis = {
  comment: "receipt",
  doc_type: "receipt",
  extracted: {},
  suggested_filename: "20260705-領収書",
  suggested_folder: "領収書",
  confidence: 0.9,
};

describe("autoApplyAiRename", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("applies the suggested filename with the original extension", async () => {
    vi.mocked(getAutoAiRenameEnabled).mockResolvedValue(true);
    vi.mocked(renameDriveFile).mockResolvedValue({
      id: "file-1",
      name: "20260705-領収書.jpg",
    });

    const result = await autoApplyAiRename({
      fileId: "file-1",
      accessToken: "token",
      originalDriveName: "capture.jpg",
      analysis,
    });

    expect(renameDriveFile).toHaveBeenCalledWith(
      "file-1",
      "20260705-領収書.jpg",
      "token",
    );
    expect(result).toEqual({
      driveName: "20260705-領収書.jpg",
      originalDriveName: "capture.jpg",
      status: "applied",
    });
  });

  it("keeps the current name when the setting is disabled", async () => {
    vi.mocked(getAutoAiRenameEnabled).mockResolvedValue(false);

    const result = await autoApplyAiRename({
      fileId: "file-1",
      accessToken: "token",
      originalDriveName: "capture.jpg",
      analysis,
    });

    expect(renameDriveFile).not.toHaveBeenCalled();
    expect(result).toEqual({
      driveName: "capture.jpg",
      status: "disabled",
    });
  });

  it("keeps the original name and marks conflicts on 409", async () => {
    vi.mocked(getAutoAiRenameEnabled).mockResolvedValue(true);
    vi.mocked(renameDriveFile).mockRejectedValue(
      new Error("Drive rename failed (409): conflict"),
    );

    const result = await autoApplyAiRename({
      fileId: "file-1",
      accessToken: "token",
      originalDriveName: "capture.jpg",
      analysis,
    });

    expect(result).toMatchObject({
      driveName: "capture.jpg",
      originalDriveName: "capture.jpg",
      status: "failed",
      isConflict: true,
    });
  });
});
