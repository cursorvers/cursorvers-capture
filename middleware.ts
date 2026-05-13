import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { inviteBlockPath, parseInviteAllowlist } from "./app/lib/invite-gate";

function extractEmailFromSignedCookie(signedValue: string): string | null {
  const parts = signedValue.split(".");
  if (parts.length === 0) {
    return null;
  }
  const last = parts[parts.length - 1] ?? "";
  if (/^[0-9a-f]{64}$/i.test(last)) {
    const email = parts.slice(0, -1).join(".");
    return email.length > 0 ? email : null;
  }
  return parts[0] ?? null;
}

const INVITE_ALLOWLIST = parseInviteAllowlist(process.env.INVITE_ALLOWLIST);
const PRO_USERS =
  process.env.PRO_USERS?.split(",").map((e) => e.trim()).filter(Boolean) ?? [];

function isPublicPath(pathname: string): boolean {
  return pathname.startsWith("/privacy") || pathname.startsWith("/terms");
}

export const config = {
  matcher: [
    "/((?!_next|api/me|favicon|icon-|manifest|sw\\.js).*)?",
  ],
};

export function middleware(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const gdriveEmailCookie = request.cookies.get("gdrive_email");
  let email: string | null = null;
  let tier: "free" | "pro" | "unknown" = "unknown";

  if (gdriveEmailCookie) {
    email = extractEmailFromSignedCookie(gdriveEmailCookie.value);

    if (email) {
      const block = inviteBlockPath(INVITE_ALLOWLIST, email);
      if (block) {
        return NextResponse.redirect(new URL(block, request.url));
      }

      if (PRO_USERS.includes(email)) {
        tier = "pro";
      } else {
        tier = "free";
      }
    }
  }

  const response = NextResponse.next();
  if (tier !== "unknown") {
    response.headers.set("X-Tier", tier);
  }

  return response;
}
