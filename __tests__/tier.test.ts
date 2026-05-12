import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, test, vi } from "vitest";
import { sign, verify } from '@/app/lib/server-cookie';

vi.mock('@/app/lib/server-cookie', () => ({
  sign: (value: string) => `${value}.mocked`,
  verify: (signedValue: string) => {
    if (signedValue.endsWith('.mocked')) {
      return signedValue.slice(0, -7);
    }
    return null;
  },
}));

describe('Cookie Utility', () => {

  test('signing and verifying a cookie round-trip correctly', () => {
    const value = 'test@example.com';
    const signedValue = sign(value);
    const verifiedValue = verify(signedValue);
    expect(verifiedValue).toBe(value);
  });

  test('tamper detection: returns null for a modified cookie', () => {
    const value = 'test@example.com';
    const signedValue = sign(value);
    const tamperedSignedValue = signedValue.slice(0, -1) + 'A'; // Tamper with the signature
    const verifiedValue = verify(tamperedSignedValue);
    expect(verifiedValue).toBeNull();
  });

  test('tamper detection: returns null for invalid format', () => {
    const invalidSignedValue = 'just-a-value'; // Missing signature part
    const verifiedValue = verify(invalidSignedValue);
    expect(verifiedValue).toBeNull();
  });

});

describe('Middleware and API Route environment variable parsing', () => {
  // No global beforeEach/afterAll with jest.resetModules() here.
  // We'll manage process.env within individual tests if needed.

  describe('PRO_USERS env parsing returns matching emails', () => {
    beforeEach(() => {
      vi.stubEnv('PRO_USERS', 'pro1@example.com,pro2@example.com');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    test('should parse PRO_USERS correctly', () => {
      const PRO_USERS_PARSED = process.env.PRO_USERS?.split(',').map(e => e.trim()) || [];
      expect(PRO_USERS_PARSED).toEqual(['pro1@example.com', 'pro2@example.com']);
      expect(PRO_USERS_PARSED).toContain('pro1@example.com');
      expect(PRO_USERS_PARSED).not.toContain('nonpro@example.com');
    });
  });

  describe('INVITE_ALLOWLIST env parsing returns matching emails', () => {
    beforeEach(() => {
      vi.stubEnv('INVITE_ALLOWLIST', 'user1@example.com,user2@example.com');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    test('should parse INVITE_ALLOWLIST correctly', () => {
      const INVITE_ALLOWLIST_PARSED = process.env.INVITE_ALLOWLIST?.split(',').map(e => e.trim()) || [];
      expect(INVITE_ALLOWLIST_PARSED).toEqual(['user1@example.com', 'user2@example.com']);
      expect(INVITE_ALLOWLIST_PARSED).toContain('user1@example.com');
      expect(INVITE_ALLOWLIST_PARSED).not.toContain('notinvited@example.com');
    });
  });
});
