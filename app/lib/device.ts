const STORAGE_KEY = "gdrive-uploader-device";

function requireBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("Device ID helpers require a browser environment");
  }
}

/** Persistent per-browser tab/device id (localStorage). Call only from client components / effects. */
export function getDeviceId(): string {
  requireBrowser();
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const id = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, id);
  return id;
}

/** First 8 hex chars of UUID without hyphens — filename suffix. */
export function getDeviceShort(): string {
  const compact = getDeviceId().replace(/-/g, "");
  return compact.slice(0, 8);
}
