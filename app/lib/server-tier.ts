const INVITE_ALLOWLIST =
  process.env.INVITE_ALLOWLIST?.split(",").map((e) => e.trim()) ?? [];
const PRO_USERS =
  process.env.PRO_USERS?.split(",").map((e) => e.trim()) ?? [];

/**
 * Tier resolution for a Google Drive / session email (mirrors /api/me).
 */
export function getTierForEmail(email: string | null): "free" | "pro" | "unknown" {
  if (!email) {
    return "unknown";
  }

  if (INVITE_ALLOWLIST.length > 0 && !INVITE_ALLOWLIST.includes(email)) {
    return "unknown";
  }

  if (PRO_USERS.includes(email)) {
    return "pro";
  }

  return "free";
}
