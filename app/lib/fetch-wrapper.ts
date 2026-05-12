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

async function with5xxBackoff(
  fn: () => Promise<Response>,
): Promise<Response> {
  const backoffs = [500, 1500, 4500];
  for (let i = 0; ; i += 1) {
    const res = await withNetworkRetry(fn);
    if (res.status < 500 || i >= backoffs.length) {
      return res;
    }
    const wait = jitteredDelay(backoffs[i]!);
    console.warn(
      `driveFetch: HTTP ${res.status}, retry after ~${wait}ms (attempt ${i + 1}/${backoffs.length})`,
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

    const response = await with5xxBackoff(() =>
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
