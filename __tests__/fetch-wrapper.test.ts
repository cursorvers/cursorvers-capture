/**
 * @vitest-environment jsdom
 */
import { driveFetch } from "@/app/lib/fetch-wrapper";
import { getCurrentToken, silentRefresh } from "@/app/lib/gis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/gis", () => ({
  getCurrentToken: vi.fn(),
  silentRefresh: vi.fn(),
}));

const mockedGetCurrentToken = vi.mocked(getCurrentToken);
const mockedSilentRefresh = vi.mocked(silentRefresh);

describe("driveFetch", () => {
  beforeEach(() => {
    mockedGetCurrentToken.mockReset();
    mockedSilentRefresh.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------
  // P0-1 rate-limit handling (FUGUE multi-agent vote 2026-05-14)
  // ---------------------------------------------------------------------

  it("retries on 429 then succeeds (P0-1 rate-limit)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout"] });
    try {
      mockedGetCurrentToken.mockResolvedValue("tok");
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(null, { status: 429 }))
        .mockResolvedValueOnce(new Response("ok", { status: 200 }));

      const promise = driveFetch("https://www.googleapis.com/drive/v3/about");
      await vi.advanceTimersByTimeAsync(2_000);
      const res = await promise;

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries on 403 with rateLimitExceeded reason (P0-1 rate-limit)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout"] });
    try {
      mockedGetCurrentToken.mockResolvedValue("tok");
      const rateBody = JSON.stringify({
        error: {
          errors: [{ reason: "rateLimitExceeded", message: "slow down" }],
          code: 403,
        },
      });
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(rateBody, {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(new Response("ok", { status: 200 }));

      const promise = driveFetch("https://www.googleapis.com/drive/v3/about");
      await vi.advanceTimersByTimeAsync(2_000);
      const res = await promise;

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry on plain 403 forbidden (no rate-limit reason)", async () => {
    mockedGetCurrentToken.mockResolvedValue("tok");
    const forbiddenBody = JSON.stringify({
      error: {
        errors: [{ reason: "forbidden", message: "no access" }],
        code: 403,
      },
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(forbiddenBody, {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await driveFetch("https://www.googleapis.com/drive/v3/about");

    expect(res.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once after 401 when silent refresh succeeds", async () => {
    mockedGetCurrentToken
      .mockResolvedValueOnce("token-one")
      .mockResolvedValueOnce("token-two");
    mockedSilentRefresh.mockResolvedValue({
      access_token: "token-two",
      expires_in: 3600,
    });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const res = await driveFetch("https://www.googleapis.com/drive/v3/about", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    expect(mockedSilentRefresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(firstInit?.headers).get("Authorization")).toBe(
      "Bearer token-one",
    );
    expect(new Headers(secondInit?.headers).get("Authorization")).toBe(
      "Bearer token-two",
    );
  });
});
