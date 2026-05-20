export function parseInviteAllowlist(raw: string | undefined | null): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export function inviteBlockPath(
  allowlist: string[],
  email: string | null,
): "/full" | "/not-invited" | null {
  if (!email) return null;
  if (allowlist.length === 0) return null;
  if (allowlist.includes(email)) return null;
  if (allowlist.length >= 95) return "/full";
  return "/not-invited";
}

export function getTierForEmail(
  email: string | null,
  allowlist: string[],
  proUsers: string[],
): "free" | "pro" | "unknown" {
  if (!email) return "unknown";
  if (allowlist.length > 0 && !allowlist.includes(email)) return "unknown";
  if (proUsers.includes(email)) return "pro";
  return "free";
}
