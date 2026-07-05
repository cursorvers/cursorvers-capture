import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureRecord } from "../app/lib/captures-db";
import {
  backfillUnroutedCaptures,
  retargetCaptureDocType,
  undoRetargetCaptureDocType,
} from "../app/lib/capture-routing";
import * as CapturesDb from "../app/lib/captures-db";
import * as DocRouting from "../app/lib/doc-routing";

vi.mock("../app/lib/captures-db", () => ({
  getCapture: vi.fn(),
  listAllCaptures: vi.fn(),
  putCapture: vi.fn(),
}));

vi.mock("../app/lib/doc-routing", () => ({
  ensureRoutingFolder: vi.fn(),
  moveDriveFile: vi.fn(),
}));

const mockGetCapture = vi.mocked(CapturesDb.getCapture);
const mockListAllCaptures = vi.mocked(CapturesDb.listAllCaptures);
const mockPutCapture = vi.mocked(CapturesDb.putCapture);
const mockEnsureRoutingFolder = vi.mocked(DocRouting.ensureRoutingFolder);
const mockMoveDriveFile = vi.mocked(DocRouting.moveDriveFile);

function capture(overrides: Partial<CaptureRecord> = {}): CaptureRecord {
  return {
    file_id: "file-1",
    drive_name: "capture.jpg",
    created_iso: "2026-07-05T00:00:00.000Z",
    parent_id: "main-folder",
    doc_type: "memo",
    comment: "memo",
    confidence: 0.9,
    suggested_filename: "memo.jpg",
    suggested_folder: "メモ",
    ...overrides,
  };
}

describe("capture routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureRoutingFolder.mockResolvedValue("target-folder");
    mockMoveDriveFile.mockResolvedValue(undefined);
    mockPutCapture.mockResolvedValue(undefined);
  });

  it("retargets doc_type, moves Drive file, and retries IDB compensation once", async () => {
    mockGetCapture.mockResolvedValue(capture());
    mockPutCapture
      .mockRejectedValueOnce(new Error("idb transient"))
      .mockResolvedValueOnce(undefined);

    const result = await retargetCaptureDocType({
      file_id: "file-1",
      doc_type: "receipt",
      mainFolderId: "main-folder",
      accessToken: "token",
    });

    expect(mockEnsureRoutingFolder).toHaveBeenCalledWith({
      doc_type: "receipt",
      parent_id: "main-folder",
      accessToken: "token",
    });
    expect(mockMoveDriveFile).toHaveBeenCalledWith({
      file_id: "file-1",
      add_parent: "target-folder",
      remove_parent: "main-folder",
      accessToken: "token",
    });
    expect(mockPutCapture).toHaveBeenCalledTimes(2);
    expect(mockPutCapture).toHaveBeenLastCalledWith(
      expect.objectContaining({
        file_id: "file-1",
        doc_type: "receipt",
        parent_id: "target-folder",
        routed_to: "target-folder",
      }),
    );
    expect(
      mockMoveDriveFile.mock.invocationCallOrder[0],
    ).toBeLessThan(mockPutCapture.mock.invocationCallOrder[0]);
    expect(result.undo).toMatchObject({
      file_id: "file-1",
      previous_doc_type: "memo",
      previous_parent_id: "main-folder",
      current_doc_type: "receipt",
      current_parent_id: "target-folder",
    });
  });

  it("undo moves back and restores previous routing metadata", async () => {
    mockGetCapture.mockResolvedValue(
      capture({
        parent_id: "target-folder",
        doc_type: "receipt",
        routed_to: "target-folder",
      }),
    );

    const restored = await undoRetargetCaptureDocType({
      accessToken: "token",
      undo: {
        file_id: "file-1",
        previous_doc_type: "memo",
        previous_parent_id: "main-folder",
        previous_routed_to: undefined,
        current_doc_type: "receipt",
        current_parent_id: "target-folder",
      },
    });

    expect(mockMoveDriveFile).toHaveBeenCalledWith({
      file_id: "file-1",
      add_parent: "main-folder",
      remove_parent: "target-folder",
      accessToken: "token",
    });
    expect(restored).toMatchObject({
      doc_type: "memo",
      parent_id: "main-folder",
      routed_to: undefined,
    });
  });

  it("undo reports latest Drive state when IDB restore retry still fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockGetCapture.mockResolvedValue(
      capture({
        parent_id: "target-folder",
        doc_type: "receipt",
        routed_to: "target-folder",
      }),
    );
    mockPutCapture.mockRejectedValue(new Error("idb down"));

    const restored = await undoRetargetCaptureDocType({
      accessToken: "token",
      undo: {
        file_id: "file-1",
        previous_doc_type: "memo",
        previous_parent_id: "main-folder",
        previous_routed_to: undefined,
        current_doc_type: "receipt",
        current_parent_id: "target-folder",
      },
    });

    expect(mockMoveDriveFile).toHaveBeenCalledWith({
      file_id: "file-1",
      add_parent: "main-folder",
      remove_parent: "target-folder",
      accessToken: "token",
    });
    expect(mockPutCapture).toHaveBeenCalledTimes(2);
    expect(restored).toMatchObject({
      doc_type: "memo",
      parent_id: "main-folder",
      routed_to: undefined,
      idbUpdateFailed: true,
    });
    expect(console.error).toHaveBeenCalledWith(
      "capture restore after undo routing failed",
      expect.any(Error),
    );
  });

  it("rolls Drive back when retarget IDB compensation still fails", async () => {
    mockGetCapture.mockResolvedValue(capture());
    mockPutCapture.mockRejectedValue(new Error("idb down"));

    await expect(
      retargetCaptureDocType({
        file_id: "file-1",
        doc_type: "receipt",
        mainFolderId: "main-folder",
        accessToken: "token",
      }),
    ).rejects.toThrow("idb down");

    expect(mockMoveDriveFile).toHaveBeenNthCalledWith(1, {
      file_id: "file-1",
      add_parent: "target-folder",
      remove_parent: "main-folder",
      accessToken: "token",
    });
    expect(mockMoveDriveFile).toHaveBeenNthCalledWith(2, {
      file_id: "file-1",
      add_parent: "main-folder",
      remove_parent: "target-folder",
      accessToken: "token",
    });
  });

  it("backfills unrouted captures serially and skips already-targeted records idempotently", async () => {
    mockListAllCaptures.mockResolvedValue([
      capture({ file_id: "move-me", parent_id: "main-folder", doc_type: "receipt" }),
      capture({ file_id: "already-there", parent_id: "target-folder", doc_type: "memo" }),
      capture({
        file_id: "already-routed",
        parent_id: "target-folder",
        routed_to: "target-folder",
        doc_type: "memo",
      }),
    ]);
    const progress: string[] = [];

    const result = await backfillUnroutedCaptures({
      mainFolderId: "main-folder",
      accessToken: "token",
      onProgress: (p) => progress.push(`${p.done}/${p.total}:${p.success}/${p.skipped}/${p.failed}`),
    });

    expect(result).toEqual({
      done: 2,
      total: 2,
      success: 1,
      skipped: 1,
      failed: 0,
    });
    expect(mockMoveDriveFile).toHaveBeenCalledTimes(1);
    expect(mockMoveDriveFile).toHaveBeenCalledWith({
      file_id: "move-me",
      add_parent: "target-folder",
      remove_parent: "main-folder",
      accessToken: "token",
    });
    expect(mockPutCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        file_id: "already-there",
        routed_to: "target-folder",
      }),
    );
    expect(progress).toEqual([
      "0/2:0/0/0",
      "1/2:1/0/0",
      "2/2:1/1/0",
    ]);
  });
});
