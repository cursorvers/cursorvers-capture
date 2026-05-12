/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { sha1Short } from "../app/lib/hash";

describe("sha1Short", () => {
  it("should return the first 8 characters of the SHA-1 hash of a blob", async () => {
    const blob = new Blob(["hello"]);
    expect(await sha1Short(blob)).toBe("aaf4c61d");
  });
});
