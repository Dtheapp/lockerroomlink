/**
 * Rate Limiting Utilities
 * Prevents spam and abuse by limiting the frequency of actions
 */

interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

// In-memory store for rate limits (per session)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limiter configuration
 */
export interface RateLimitConfig {
  maxRequests: number;  // Max requests allowed in the window
  windowMs: number;     // Time window in milliseconds
  blockDurationMs?: number; // How long to block after limit exceeded (default: windowMs)
}

/**
 * Default rate limit configurations for different actions
 */
export const RATE_LIMITS = {
  // Chat messages: 10 per minute
  CHAT_MESSAGE: { maxRequests: 10, windowMs: 60000 },
  
  // Private messages: 15 per minute
  PRIVATE_MESSAGE: { maxRequests: 15, windowMs: 60000 },
  
  // Bulletin posts: 5 per 5 minutes
  BULLETIN_POST: { maxRequests: 5, windowMs: 300000 },
  
  // Form submissions: 3 per minute
  FORM_SUBMIT: { maxRequests: 3, windowMs: 60000 },
  
  // Search queries: 20 per minute
  SEARCH: { maxRequests: 20, windowMs: 60000 },
  
  // File uploads: 5 per 5 minutes
  FILE_UPLOAD: { maxRequests: 5, windowMs: 300000 },

  // Event creation: 10 per hour (prevent spam events)
  EVENT_CREATE: { maxRequests: 10, windowMs: 3600000 },

  // Registration: 5 per 10 minutes (prevent registration abuse)
  REGISTRATION: { maxRequests: 5, windowMs: 600000 },

  // Promo code validation: 10 per minute (prevent brute force)
  PROMO_VALIDATE: { maxRequests: 10, windowMs: 60000 },
} as const;

/**
 * Check if an action is rate limited
 * @param key Unique identifier for the rate limit (e.g., `chat:${userId}`)
 * @param config Rate limit configuration
 * @returns Object with allowed status and time until reset
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfterMs: number; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // No previous requests - allow
  if (!entry) {
    rateLimitStore.set(key, {
      count: 1,
      firstRequest: now,
      lastRequest: now,
    });
    return { allowed: true, retryAfterMs: 0, remaining: config.maxRequests - 1 };
  }

  const windowStart = now - config.windowMs;

  // Window has expired - reset
  if (entry.firstRequest < windowStart) {
    rateLimitStore.set(key, {
      count: 1,
      firstRequest: now,
      lastRequest: now,
    });
    return { allowed: true, retryAfterMs: 0, remaining: config.maxRequests - 1 };
  }

  // Within window - check count
  if (entry.count >= config.maxRequests) {
    const retryAfterMs = entry.firstRequest + config.windowMs - now;
    return { allowed: false, retryAfterMs, remaining: 0 };
  }

  // Allow and increment
  entry.count++;
  entry.lastRequest = now;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    retryAfterMs: 0,
    remaining: config.maxRequests - entry.count,
  };
}

/**
 * Rate limit decorator for async functions
 * @param key Rate limit key
 * @param config Rate limit configuration
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  key: string,
  config: RateLimitConfig
): T {
  return (async (...args: Parameters<T>) => {
    const result = checkRateLimit(key, config);
    
    if (!result.allowed) {
      const seconds = Math.ceil(result.retryAfterMs / 1000);
      throw new RateLimitError(
        `Rate limit exceeded. Please wait ${seconds} seconds.`,
        result.retryAfterMs
      );
    }
    
    return fn(...args);
  }) as T;
}

/**
 * Custom error class for rate limiting
 */
export class RateLimitError extends Error {
  public retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * React hook for rate-limited actions
 */
export function useRateLimit(key: string, config: RateLimitConfig) {
  const check = (): { allowed: boolean; message: string; remaining: number } => {
    const result = checkRateLimit(key, config);
    
    if (!result.allowed) {
      const seconds = Math.ceil(result.retryAfterMs / 1000);
      return {
        allowed: false,
        message: `Please wait ${seconds} seconds before trying again.`,
        remaining: 0,
      };
    }
    
    return {
      allowed: true,
      message: '',
      remaining: result.remaining,
    };
  };

  return { check };
}

/**
 * Clear rate limit for a specific key (useful for testing or admin actions)
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Clear all rate limits
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(
  key: string,
  config: RateLimitConfig
): { count: number; remaining: number; resetInMs: number } | null {
  const entry = rateLimitStore.get(key);
  
  if (!entry) {
    return null;
  }

  const now = Date.now();
  const resetInMs = Math.max(0, entry.firstRequest + config.windowMs - now);

  return {
    count: entry.count,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetInMs,
  };
}
