import { describe, it, expect } from "vitest";
import { buildFilename } from "../app/lib/filename";

describe("buildFilename", () => {
  it("should format the filename correctly with JST conversion", () => {
    const shot_at = new Date("2026-05-12T10:00:00Z").getTime();
    expect(
      buildFilename(shot_at, "abcd1234", "01234567"),
    ).toBe("20260512-190000-01234567-abcd1234.jpg");
  });

  it("pads single-digit month/day/hour/min/sec in JST", () => {
    const shot_at = new Date("2026-01-04T16:02:03Z").getTime();
    expect(
      buildFilename(shot_at, "aaaaaaaa", "11111111"),
    ).toBe("20260105-010203-11111111-aaaaaaaa.jpg");
  });
});
