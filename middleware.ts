import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Non-cryptographic email extraction for Edge Runtime.
// The actual cryptographic verification happens in app/api/me/route.ts (Node.js environment).
function extractEmailFromSignedCookie(signedValue: string): string | null {
  const parts = signedValue.split('.');
  if (parts.length > 0) {
    return parts[0]; // Assume the first part is the email, ignore signature on Edge for now.
  }
  return null;
}

const INVITE_ALLOWLIST = process.env.INVITE_ALLOWLIST?.split(',').map(e => e.trim()) || [];
const PRO_USERS = process.env.PRO_USERS?.split(',').map(e => e.trim()) || [];

export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - api/me (API route for tier info)
    // - _next (Next.js internals)
    // - favicon.ico (favicon file)
    // - icon- (PWA icons)
    // - manifest (PWA manifest)
    // - sw.js (Service Worker)
    '/((?!_next|api/me|favicon|icon-|manifest|sw\.js).*)?',
  ],
};

export function middleware(request: NextRequest) {
  const gdriveEmailCookie = request.cookies.get('gdrive_email');
  let email: string | null = null;
  let tier: 'free' | 'pro' | 'unknown' = 'unknown';

  if (gdriveEmailCookie) {
    email = extractEmailFromSignedCookie(gdriveEmailCookie.value);

    if (email) {
      // Check if user is in INVITE_ALLOWLIST
      if (INVITE_ALLOWLIST.length > 0 && !INVITE_ALLOWLIST.includes(email)) {
        return NextResponse.redirect(new URL('/not-invited', request.url));
      }

      // Determine tier
      if (PRO_USERS.includes(email)) {
        tier = 'pro';
      } else {
        tier = 'free';
      }
    }
  }

  const response = NextResponse.next();
  if (tier !== 'unknown') {
    response.headers.set('X-Tier', tier);
  }

  return response;
}
