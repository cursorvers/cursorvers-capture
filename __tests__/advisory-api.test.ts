import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/advisory/route";
import { getGdriveEmail } from "@/app/lib/server-cookie";
import { getTierForEmail } from "@/app/lib/server-tier";
import { requestAdvisory } from "@/app/lib/codex-app-server";
import { kvSetEncrypted } from "@/app/lib/kv";

vi.mock("@/app/lib/server-cookie", () => ({
  getGdriveEmail: vi.fn(),
}));

vi.mock("@/app/lib/server-tier", () => ({
  getTierForEmail: vi.fn(),
}));

vi.mock("@/app/lib/codex-app-server", () => ({
  requestAdvisory: vi.fn(),
}));

vi.mock("@/app/lib/kv", () => ({
  kvSetEncrypted: vi.fn(),
}));

describe("Advisory API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGdriveEmail).mockResolvedValue("test@example.com");
    vi.mocked(kvSetEncrypted).mockResolvedValue(undefined);
  });

  it("returns 403 when tier is not pro", async () => {
    vi.mocked(getTierForEmail).mockReturnValue("free");

    const req = new NextRequest("http://localhost/api/advisory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
    expect(requestAdvisory).not.toHaveBeenCalled();
    expect(kvSetEncrypted).not.toHaveBeenCalled();
  });

  it("returns stub reply for pro user and stores kvSet", async () => {
    vi.mocked(getTierForEmail).mockReturnValue("pro");
    vi.mocked(requestAdvisory).mockResolvedValue({
      reply:
        "Cursorvers Advisory stub: hello を受け取りました。実際のサービスは Phase B で接続予定",
    });

    const req = new NextRequest("http://localhost/api/advisory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello", history: [] }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      reply:
        "Cursorvers Advisory stub: hello を受け取りました。実際のサービスは Phase B で接続予定",
    });

    expect(requestAdvisory).toHaveBeenCalledWith({
      message: "hello",
      history: [],
    });

    expect(kvSetEncrypted).toHaveBeenCalledTimes(1);
    const [key, payload, ttl] = vi.mocked(kvSetEncrypted).mock.calls[0];
    expect(key).toMatch(
      /^advisory:test%40example\.com:\d+$/,
    );
    expect(payload).toMatchObject({
      message: "hello",
      reply:
        "Cursorvers Advisory stub: hello を受け取りました。実際のサービスは Phase B で接続予定",
    });
    expect(typeof (payload as { at?: string }).at).toBe("string");
    expect(ttl).toBe(60 * 60 * 24 * 7);
  });
});
