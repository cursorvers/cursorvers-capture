/**
 * Invite allowlist parsing and routing for middleware (Edge-safe, no Node crypto).
 */

export function parseInviteAllowlist(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/**
 * When the user email is not on the allowlist and the cap is reached, send to /full (grace degradation).
 * Otherwise not invited → /not-invited. Allowed or empty allowlist → null (no block).
 */
export function inviteBlockPath(
  allowlist: string[],
  email: string | null,
): "/full" | "/not-invited" | null {
  if (!email) {
    return null;
  }
  if (allowlist.length === 0) {
    return null;
  }
  if (allowlist.includes(email)) {
    return null;
  }
  if (allowlist.length >= 95) {
    return "/full";
  }
  return "/not-invited";
}
