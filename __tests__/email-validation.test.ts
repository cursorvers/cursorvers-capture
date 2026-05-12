import { describe, it, expect } from 'vitest';
import { isValidEmail, normalizeEmail, compareEmails } from '../app/lib/email-validation';

describe('email-validation', () => {
  describe('isValidEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('john.doe@sub.domain.co.uk')).toBe(true);
      expect(isValidEmail('user123+tag@domain.net')).toBe(true);
      expect(isValidEmail('a@b.c')).toBe(false); // TLD too short for common validation
    });

    it('should return false for invalid email addresses', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('user@.com')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@example')).toBe(false);
      expect(isValidEmail('user@example.')).toBe(false);
      expect(isValidEmail('user@example.c')).toBe(false); // TLD too short
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(' ')).toBe(false);
    });
  });

  describe('normalizeEmail', () => {
    it('should trim whitespace and convert to lowercase', () => {
      expect(normalizeEmail('  Test@Example.COM  ')).toBe('test@example.com');
      expect(normalizeEmail('USER@DOMAIN.NET')).toBe('user@domain.net');
      expect(normalizeEmail('test@example.com')).toBe('test@example.com');
    });
  });

  describe('compareEmails', () => {
    it('should return true for emails that are the same after normalization', () => {
      expect(compareEmails('test@example.com', 'Test@Example.com')).toBe(true);
      expect(compareEmails('  user@domain.net  ', 'user@domain.net')).toBe(true);
      expect(compareEmails('a@b.c', 'A@B.C')).toBe(true);
    });

    it('should return false for emails that are different after normalization', () => {
      expect(compareEmails('test@example.com', 'other@example.com')).toBe(false);
      expect(compareEmails('user@domain.net', 'user@otherdomain.net')).toBe(false);
      expect(compareEmails('test@example.com', 'test@example.co')).toBe(false);
    });
  });
});
