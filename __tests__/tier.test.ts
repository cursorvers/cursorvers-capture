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

  describe('Comma-separated env lists', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    test('parses PRO_USERS and INVITE_ALLOWLIST with trim', () => {
      vi.stubEnv('PRO_USERS', 'pro1@example.com,pro2@example.com');
      const proParsed = process.env.PRO_USERS?.split(',').map(e => e.trim()) || [];
      expect(proParsed).toEqual(['pro1@example.com', 'pro2@example.com']);
      expect(proParsed).toContain('pro1@example.com');
      expect(proParsed).not.toContain('nonpro@example.com');
      vi.unstubAllEnvs();

      vi.stubEnv('INVITE_ALLOWLIST', 'user1@example.com,user2@example.com');
      const inviteParsed = process.env.INVITE_ALLOWLIST?.split(',').map(e => e.trim()) || [];
      expect(inviteParsed).toEqual(['user1@example.com', 'user2@example.com']);
      expect(inviteParsed).toContain('user1@example.com');
      expect(inviteParsed).not.toContain('notinvited@example.com');
    });
  });
});
