import { NextRequest, NextResponse } from 'next/server';
import { sign, verify } from '../../lib/server-cookie';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'gdrive_email';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 1 day

const INVITE_ALLOWLIST = process.env.INVITE_ALLOWLIST?.split(',').map(e => e.trim()) || [];
const PRO_USERS = process.env.PRO_USERS?.split(',').map(e => e.trim()) || [];

async function getTierAndEmail(emailFromCookie: string | null): Promise<{ tier: 'free' | 'pro' | 'unknown', email: string | null }> {
  if (!emailFromCookie) {
    return { tier: 'unknown', email: null };
  }

  // Check if user is in INVITE_ALLOWLIST (if configured)
  if (INVITE_ALLOWLIST.length > 0 && !INVITE_ALLOWLIST.includes(emailFromCookie)) {
    return { tier: 'unknown', email: emailFromCookie }; // Email known, but not invited
  }

  if (PRO_USERS.includes(emailFromCookie)) {
    return { tier: 'pro', email: emailFromCookie };
  } else {
    return { tier: 'free', email: emailFromCookie };
  }
}

export async function GET() {
  const cookieStore = cookies();
  const signedEmail = cookieStore.get(COOKIE_NAME)?.value;
  const email = signedEmail ? verify(signedEmail) : null;

  const { tier } = await getTierAndEmail(email);

  return NextResponse.json({ tier, email });
}

export async function POST(_request: NextRequest) {
  const { email, access_token } = await _request.json();

  if (!email || !access_token) {
    return NextResponse.json({ error: 'Email and access_token are required' }, { status: 400 });
  }

  // Verify access_token against Google
  const tokenInfoRes = await fetch(
    `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${access_token}`
  );
  if (!tokenInfoRes.ok) {
    return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
  }
  const tokenInfo = await tokenInfoRes.json();

  if (tokenInfo.email !== email) {
    return NextResponse.json({ error: 'Email mismatch' }, { status: 401 });
  }

  const signedEmail = sign(email);
  const cookieStore = cookies();

  cookieStore.set(COOKIE_NAME, signedEmail, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  const { tier } = await getTierAndEmail(email);

  return NextResponse.json({ tier, email });
}

export async function DELETE() {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ status: 'ok' });
}
