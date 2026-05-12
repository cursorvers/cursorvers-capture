import { idbDelete, idbGet, idbPut } from "./idb";

export type AuthRecord = {
  id: "current";
  access_token: string;
  expires_at: number;
  scope: "drive.file";
};

type TokenCallbackResponse = {
  access_token?: string;
  expires_in?: string | number;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  requestAccessToken: (opts: { prompt: string }) => void;
};

interface GoogleOAuth2Namespace {
  initTokenClient: (opts: {
    client_id: string;
    scope: string;
    callback: (resp: TokenCallbackResponse) => void;
  }) => TokenClient;
  revoke: (token: string, onDone: () => void) => void;
}

interface GoogleAccountsNamespace {
  oauth2: GoogleOAuth2Namespace;
}

declare global {
  interface Window {
    google?: { accounts?: GoogleAccountsNamespace };
  }
}

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let gisLoadPromise: Promise<void> | null = null;

function requireBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("Google Identity Services requires a browser environment");
  }
}

function parseExpiresIn(raw: string | number | undefined): number {
  if (raw === undefined) {
    return 3600;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : 3600;
}

export function loadGisScript(): Promise<void> {
  requireBrowser();
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gisLoadPromise) {
    return gisLoadPromise;
  }
  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${GIS_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Identity Services")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

function getClientId(): string {
  const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!id || id.trim() === "") {
    throw new Error("GCP Client ID not configured");
  }
  return id.trim();
}

async function requestToken(prompt: "consent" | ""): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = getClientId();
  await loadGisScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error("Google Identity Services did not initialize");
  }
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (resp) => {
        if (resp.error) {
          const detail = resp.error_description
            ? `${resp.error}: ${resp.error_description}`
            : resp.error;
          reject(new Error(detail));
          return;
        }
        if (!resp.access_token) {
          reject(new Error("No access token received"));
          return;
        }
        const expiresIn = parseExpiresIn(resp.expires_in);
        const record: AuthRecord = {
          id: "current",
          access_token: resp.access_token,
          expires_at: Date.now() + expiresIn * 1000,
          scope: "drive.file",
        };
        void idbPut("auth", record)
          .then(async () => {
            // Fetch user email
            const userInfoRes = await fetch(
              "https://www.googleapis.com/oauth2/v3/userinfo",
              {
                headers: {
                  Authorization: `Bearer ${resp.access_token}`,
                },
              },
            );
            const userInfo = await userInfoRes.json();
            const email = userInfo.email;

            // POST to /api/me to set cookie and get tier info
            await fetch("/api/me", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ email, access_token: resp.access_token }),
            });

            resolve({ access_token: resp.access_token!, expires_in: expiresIn });
          })
          .catch(reject);
      },
    });
    client.requestAccessToken({ prompt });
  });
}

export async function signIn(): Promise<{
  access_token: string;
  expires_in: number;
}> {
  requireBrowser();
  return requestToken("consent");
}

export async function silentRefresh(): Promise<{
  access_token: string;
  expires_in: number;
}> {
  requireBrowser();
  return requestToken("");
}

export async function revokeToken(): Promise<void> {
  requireBrowser();
  const record = await idbGet<AuthRecord>("auth", "current");
  await fetch("/api/me", { method: "DELETE" }).catch(() => undefined); // Best-effort clear server cookie
  await idbDelete("auth", "current").catch(() => undefined);
  try {
    await loadGisScript();
  } catch {
    /* best-effort revoke */
  }
  const token = record?.access_token;
  const revoke = window.google?.accounts?.oauth2?.revoke;
  if (token && revoke) {
    await new Promise<void>((resolve) => {
      revoke(token, () => resolve());
    });
  }
}

const EXPIRY_SKEW_MS = 60_000;

export async function getCurrentToken(): Promise<string | null> {
  requireBrowser();
  const record = await idbGet<AuthRecord>("auth", "current");
  if (!record?.access_token) {
    return null;
  }
  if (record.expires_at < Date.now() + EXPIRY_SKEW_MS) {
    return null;
  }
  return record.access_token;
}
