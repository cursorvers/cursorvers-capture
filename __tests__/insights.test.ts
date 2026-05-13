import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  aggregateMonthlyStats,
  filterFilesByKeyword,
  type DriveFile,
} from "@/app/lib/insights";

describe("insights helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 13)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aggregateMonthlyStats buckets counts and bytes by UTC month", () => {
    const files: DriveFile[] = [
      {
        id: "a",
        name: "a.jpg",
        createdTime: "2026-05-01T10:00:00.000Z",
        size: "1000",
      },
      {
        id: "b",
        name: "b.jpg",
        createdTime: "2026-05-15T10:00:00.000Z",
        size: "500",
      },
      {
        id: "c",
        name: "c.jpg",
        createdTime: "2026-04-20T10:00:00.000Z",
        size: "2000",
      },
    ];

    const stats = aggregateMonthlyStats(files, 3);
    expect(stats).toHaveLength(3);
    const may = stats.find((s) => s.yearMonth === "2026-05");
    const apr = stats.find((s) => s.yearMonth === "2026-04");
    expect(may?.count).toBe(2);
    expect(may?.totalBytes).toBe(1500);
    expect(apr?.count).toBe(1);
    expect(apr?.totalBytes).toBe(2000);
  });

  it("filterFilesByKeyword matches name and appProperties", () => {
    const files: DriveFile[] = [
      { id: "1", name: "Receipt_April.pdf" },
      {
        id: "2",
        name: "scan.png",
        appProperties: { note: "April meeting" },
      },
      { id: "3", name: "other.txt" },
    ];

    expect(filterFilesByKeyword(files, "april").map((f) => f.id).sort()).toEqual(
      ["1", "2"],
    );
    expect(filterFilesByKeyword(files, "").length).toBe(3);
  });
});
