import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_SECRET = process.env.COOKIE_SECRET || 'default-secret-for-dev-only'; // Fallback for dev

export function sign(value: string): string {
  const hmac = createHmac('sha256', COOKIE_SECRET);
  hmac.update(value);
  return value + '.' + hmac.digest('hex');
}

export function verify(signedValue: string): string | null {
  const parts = signedValue.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const value = parts[0];
  const signature = parts[1];

  const hmac = createHmac('sha256', COOKIE_SECRET);
  hmac.update(value);
  const expectedSignature = hmac.digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  if (timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return value;
  } else {
    return null;
  }
}

import { cookies } from 'next/headers';
const COOKIE_NAME = 'gdrive_email';

export async function getGdriveEmail(): Promise<string | null> {
  const cookieStore = cookies();
  const signedEmail = cookieStore.get(COOKIE_NAME)?.value;
  return signedEmail ? verify(signedEmail) : null;
}
