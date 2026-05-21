// All allowlist comparisons are case-insensitive. parseInviteAllowlist
// lowercases entries so callers can compare with email.toLowerCase().
export function parseInviteAllowlist(raw: string | undefined | null): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function inviteBlockPath(
  allowlist: string[],
  email: string | null,
): "/full" | "/not-invited" | null {
  if (!email) return null;
  if (allowlist.length === 0) return null;
  const lower = email.toLowerCase();
  if (allowlist.includes(lower)) return null;
  if (allowlist.length >= 95) return "/full";
  return "/not-invited";
}

export function getTierForEmail(
  email: string | null,
  allowlist: string[],
  proUsers: string[],
): "free" | "pro" | "unknown" {
  if (!email) return "unknown";
  const lower = email.toLowerCase();
  if (allowlist.length > 0 && !allowlist.includes(lower)) return "unknown";
  if (proUsers.includes(lower)) return "pro";
  return "free";
}
