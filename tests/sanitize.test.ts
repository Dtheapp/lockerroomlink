import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  stripHtml,
  sanitizeText,
  sanitizeUsername,
  sanitizeEmail,
  sanitizePhone,
  sanitizeUrl,
  sanitizeNumber,
  sanitizeDate,
} from '../services/sanitize';

describe('Sanitization Utilities', () => {
  describe('escapeHtml', () => {
    it('escapes dangerous HTML characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('handles empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('handles non-string input', () => {
      expect(escapeHtml(null as unknown as string)).toBe('');
      expect(escapeHtml(undefined as unknown as string)).toBe('');
    });
  });

  describe('stripHtml', () => {
    it('removes HTML tags', () => {
      expect(stripHtml('<p>Hello <strong>World</strong></p>')).toBe('Hello World');
    });

    it('handles complex nested tags', () => {
      expect(stripHtml('<div><script>evil()</script>Safe text</div>')).toBe('evil()Safe text');
    });
  });

  describe('sanitizeText', () => {
    it('trims whitespace', () => {
      expect(sanitizeText('  hello  ')).toBe('hello');
    });

    it('limits length', () => {
      expect(sanitizeText('hello world', 5)).toBe('hello');
    });

    it('removes HTML tags', () => {
      expect(sanitizeText('<script>alert("xss")</script>Hello')).toBe('alert("xss")Hello');
    });

    it('removes control characters', () => {
      expect(sanitizeText('hello\x00world')).toBe('helloworld');
    });

    it('preserves newlines and tabs', () => {
      expect(sanitizeText('hello\nworld\ttab')).toBe('hello\nworld\ttab');
    });
  });

  describe('sanitizeUsername', () => {
    it('removes special characters', () => {
      expect(sanitizeUsername('user@name!')).toBe('username');
    });

    it('converts to lowercase', () => {
      expect(sanitizeUsername('UserName')).toBe('username');
    });

    it('allows underscores and hyphens', () => {
      expect(sanitizeUsername('user_name-123')).toBe('user_name-123');
    });

    it('limits to 30 characters', () => {
      expect(sanitizeUsername('a'.repeat(50))).toBe('a'.repeat(30));
    });
  });

  describe('sanitizeEmail', () => {
    it('validates valid email', () => {
      expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
    });

    it('converts to lowercase', () => {
      expect(sanitizeEmail('Test@Example.COM')).toBe('test@example.com');
    });

    it('returns empty for invalid email', () => {
      expect(sanitizeEmail('not-an-email')).toBe('');
      expect(sanitizeEmail('missing@domain')).toBe('');
    });

    it('strips HTML from email and validates result', () => {
      // After stripping HTML, this becomes test@example.com which is valid
      expect(sanitizeEmail('<script>test@example.com')).toBe('test@example.com');
      // This is completely invalid even after stripping
      expect(sanitizeEmail('<script>alert(1)</script>')).toBe('');
    });
  });

  describe('sanitizePhone', () => {
    it('allows digits and formatting', () => {
      expect(sanitizePhone('(555) 123-4567')).toBe('(555) 123-4567');
    });

    it('removes invalid characters', () => {
      expect(sanitizePhone('555-ABC-1234')).toBe('555--1234');
    });

    it('allows international format', () => {
      expect(sanitizePhone('+1 555 123 4567')).toBe('+1 555 123 4567');
    });
  });

  describe('sanitizeUrl', () => {
    it('allows valid URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
    });

    it('rejects javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    });

    it('rejects data: URLs', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    it('adds https to URLs without protocol', () => {
      expect(sanitizeUrl('example.com')).toBe('https://example.com');
    });
  });

  describe('sanitizeNumber', () => {
    it('parses valid numbers', () => {
      expect(sanitizeNumber('42')).toBe(42);
      expect(sanitizeNumber(42)).toBe(42);
    });

    it('respects min/max bounds', () => {
      expect(sanitizeNumber('100', 0, 50)).toBe(50);
      expect(sanitizeNumber('-5', 0, 50)).toBe(0);
    });

    it('returns min for invalid input', () => {
      expect(sanitizeNumber('not a number')).toBe(0);
      expect(sanitizeNumber('')).toBe(0);
    });
  });

  describe('sanitizeDate', () => {
    it('accepts valid dates', () => {
      expect(sanitizeDate('2024-01-15')).toBe('2024-01-15');
    });

    it('rejects invalid format', () => {
      expect(sanitizeDate('01/15/2024')).toBe('');
      expect(sanitizeDate('Jan 15, 2024')).toBe('');
    });

    it('rejects invalid dates', () => {
      expect(sanitizeDate('2024-13-45')).toBe('');
    });
  });
});
