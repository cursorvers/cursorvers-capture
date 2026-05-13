import { describe, it, expect } from "vitest";
import { inviteBlockPath, parseInviteAllowlist } from "../app/lib/invite-gate";

describe("invite gate", () => {
  it("parses allowlist trims, inviteBlockPath routing to /full, /not-invited, or null", () => {
    expect(parseInviteAllowlist(" a@x.com , , b@y.com ")).toEqual([
      "a@x.com",
      "b@y.com",
    ]);
    expect(parseInviteAllowlist(undefined)).toEqual([]);

    expect(inviteBlockPath([], "any@x.com")).toBeNull();
    expect(inviteBlockPath(["a@x.com"], "a@x.com")).toBeNull();
    const capList = Array.from({ length: 95 }, (_, i) => `u${i}@x.com`);
    expect(inviteBlockPath(capList, "stranger@x.com")).toBe("/full");
    const smallList = ["a@x.com", "b@x.com"];
    expect(inviteBlockPath(smallList, "stranger@x.com")).toBe("/not-invited");
    expect(inviteBlockPath(smallList, null)).toBeNull();
  });
});
