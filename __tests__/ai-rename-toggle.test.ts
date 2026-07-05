import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/idb", () => ({
  idbGet: vi.fn(),
  idbPut: vi.fn(),
}));

import {
  getAutoAiRenameEnabled,
  setAutoAiRenameEnabled,
} from "@/app/lib/ai-rename-toggle";
import { idbGet, idbPut } from "@/app/lib/idb";

describe("ai-rename-toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to enabled when no config is stored", async () => {
    vi.mocked(idbGet).mockResolvedValue(undefined);

    await expect(getAutoAiRenameEnabled()).resolves.toBe(true);
    expect(idbGet).toHaveBeenCalledWith("config", "auto_ai_rename_enabled");
  });

  it("persists the disabled state", async () => {
    vi.mocked(idbPut).mockResolvedValue(undefined);

    await setAutoAiRenameEnabled(false);

    expect(idbPut).toHaveBeenCalledWith("config", {
      key: "auto_ai_rename_enabled",
      value: false,
    });
  });
});
