import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  clearRateLimit,
  clearAllRateLimits,
  getRateLimitStatus,
  RATE_LIMITS,
  RateLimitError,
} from '../services/rateLimit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  describe('checkRateLimit', () => {
    it('allows first request', () => {
      const result = checkRateLimit('test:user1', { maxRequests: 5, windowMs: 60000 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('allows requests up to the limit', () => {
      const config = { maxRequests: 3, windowMs: 60000 };
      
      checkRateLimit('test:user2', config);
      checkRateLimit('test:user2', config);
      const result = checkRateLimit('test:user2', config);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('blocks requests after limit exceeded', () => {
      const config = { maxRequests: 2, windowMs: 60000 };
      
      checkRateLimit('test:user3', config);
      checkRateLimit('test:user3', config);
      const result = checkRateLimit('test:user3', config);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('resets after window expires', async () => {
      const config = { maxRequests: 1, windowMs: 50 }; // 50ms window
      
      checkRateLimit('test:user4', config);
      const blocked = checkRateLimit('test:user4', config);
      expect(blocked.allowed).toBe(false);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 60));
      
      const afterReset = checkRateLimit('test:user4', config);
      expect(afterReset.allowed).toBe(true);
    });

    it('tracks different keys independently', () => {
      const config = { maxRequests: 1, windowMs: 60000 };
      
      checkRateLimit('test:userA', config);
      const resultA = checkRateLimit('test:userA', config);
      
      const resultB = checkRateLimit('test:userB', config);
      
      expect(resultA.allowed).toBe(false);
      expect(resultB.allowed).toBe(true);
    });
  });

  describe('clearRateLimit', () => {
    it('clears rate limit for specific key', () => {
      const config = { maxRequests: 1, windowMs: 60000 };
      
      checkRateLimit('test:clear', config);
      checkRateLimit('test:clear', config);
      
      clearRateLimit('test:clear');
      
      const result = checkRateLimit('test:clear', config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('getRateLimitStatus', () => {
    it('returns null for unknown key', () => {
      const result = getRateLimitStatus('unknown:key', { maxRequests: 5, windowMs: 60000 });
      expect(result).toBe(null);
    });

    it('returns current status', () => {
      const config = { maxRequests: 5, windowMs: 60000 };
      
      checkRateLimit('test:status', config);
      checkRateLimit('test:status', config);
      
      const status = getRateLimitStatus('test:status', config);
      expect(status?.count).toBe(2);
      expect(status?.remaining).toBe(3);
      expect(status?.resetInMs).toBeGreaterThan(0);
    });
  });

  describe('RATE_LIMITS configurations', () => {
    it('has sensible chat message limits', () => {
      expect(RATE_LIMITS.CHAT_MESSAGE.maxRequests).toBe(10);
      expect(RATE_LIMITS.CHAT_MESSAGE.windowMs).toBe(60000);
    });

    it('has sensible bulletin post limits', () => {
      expect(RATE_LIMITS.BULLETIN_POST.maxRequests).toBe(5);
      expect(RATE_LIMITS.BULLETIN_POST.windowMs).toBe(300000);
    });
  });

  describe('RateLimitError', () => {
    it('creates error with retry time', () => {
      const error = new RateLimitError('Rate limited', 5000);
      
      expect(error.name).toBe('RateLimitError');
      expect(error.message).toBe('Rate limited');
      expect(error.retryAfterMs).toBe(5000);
    });
  });
});
