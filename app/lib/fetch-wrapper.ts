import { getCurrentToken, silentRefresh } from "./gis";

export class TokenExpiredError extends Error {
  constructor(message = "Access token expired or revoked") {
    super(message);
    this.name = "TokenExpiredError";
  }
}

function requireBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("driveFetch is only available in the browser");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** +/-20% jitter around baseMs */
function jitteredDelay(baseMs: number): number {
  const jitter = 0.2;
  const factor = 1 + (Math.random() * 2 - 1) * jitter;
  return Math.round(baseMs * factor);
}

async function withNetworkRetry(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch {
    console.warn("driveFetch: network error, immediate retry");
    return await fn();
  }
}

// Google's recommended exponential backoff ladder for Drive rate limits:
// 1s, 2s, 4s, 8s, 16s with ±20% jitter. Five attempts cover most transient
// throttling without exceeding the user's perceived patience.
const RETRYABLE_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];

/**
 * Inspect a Response body for Google Drive rate-limit / quota error reasons.
 * Returns true when retrying with backoff is appropriate; false otherwise.
 * Body is cloned so the caller can still consume the original response.
 */
async function is403RateLimited(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  try {
    const body = await res.clone().json();
    const reasons: string[] = [];
    const errors = body?.error?.errors;
    if (Array.isArray(errors)) {
      for (const e of errors) {
        if (typeof e?.reason === "string") reasons.push(e.reason);
      }
    }
    const top = body?.error?.status;
    if (typeof top === "string") reasons.push(top);
    return reasons.some((r) =>
      [
        "rateLimitExceeded",
        "userRateLimitExceeded",
        "quotaExceeded",
        "dailyLimitExceeded",
        "RESOURCE_EXHAUSTED",
      ].includes(r),
    );
  } catch {
    return false;
  }
}

function parseRetryAfterMs(res: Response): number | null {
  const header = res.headers.get("Retry-After");
  if (!header) return null;
  // RFC 7231: seconds (integer) or HTTP-date
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 60_000); // clamp to 60s
  }
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.max(0, Math.min(date - Date.now(), 60_000));
  }
  return null;
}

async function withRetryableBackoff(
  fn: () => Promise<Response>,
): Promise<Response> {
  for (let i = 0; ; i += 1) {
    const res = await withNetworkRetry(fn);
    const retryable =
      res.status >= 500 ||
      res.status === 429 ||
      (await is403RateLimited(res));
    if (!retryable || i >= RETRYABLE_BACKOFF_MS.length) {
      return res;
    }
    const retryAfter = parseRetryAfterMs(res);
    const wait = retryAfter ?? jitteredDelay(RETRYABLE_BACKOFF_MS[i]!);
    console.warn(
      `driveFetch: HTTP ${res.status} (retryable), backoff ~${wait}ms (attempt ${i + 1}/${RETRYABLE_BACKOFF_MS.length})`,
    );
    await sleep(wait);
  }
}

async function fetchWithToken(
  url: string,
  init: RequestInit | undefined,
  token: string,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export async function driveFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  requireBrowser();

  let didRefresh401 = false;

  for (;;) {
    const token = await getCurrentToken();
    if (!token) {
      throw new Error("No valid access token");
    }

    const response = await withRetryableBackoff(() =>
      fetchWithToken(url, init, token),
    );

    if (response.status !== 401) {
      return response;
    }

    if (didRefresh401) {
      throw new TokenExpiredError();
    }

    await silentRefresh();
    didRefresh401 = true;
  }
}
