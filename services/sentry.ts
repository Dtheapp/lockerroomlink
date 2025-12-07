/**
 * Sentry Error Monitoring Service
 * 
 * Trait #2: Security Audit - Know when things break
 * 
 * This service initializes Sentry for error tracking and performance monitoring.
 * Errors are automatically captured and sent to Sentry dashboard.
 */

import * as Sentry from '@sentry/react';

// =============================================================================
// CONFIGURATION
// =============================================================================

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const IS_PRODUCTION = import.meta.env.PROD;
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize Sentry error monitoring
 * Call this once at app startup (in main.tsx)
 */
export function initSentry(): void {
  // Only initialize if DSN is configured
  if (!SENTRY_DSN) {
    if (IS_PRODUCTION) {
      console.warn('Sentry DSN not configured. Error monitoring disabled.');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Set environment
    environment: IS_PRODUCTION ? 'production' : 'development',
    
    // Set release version
    release: `osys@${APP_VERSION}`,
    
    // Capture 100% of errors in production, 10% in development
    sampleRate: IS_PRODUCTION ? 1.0 : 0.1,
    
    // Performance monitoring sample rate
    tracesSampleRate: IS_PRODUCTION ? 0.2 : 0.1,
    
    // Session replay for debugging (only capture on error)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: IS_PRODUCTION ? 0.5 : 0,
    
    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Filter out non-actionable errors
    beforeSend(event, hint) {
      const error = hint.originalException;
      
      // Ignore chunk load errors (handled by ErrorBoundary with cache clear)
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Error).message;
        if (
          message.includes('Failed to fetch dynamically imported module') ||
          message.includes('Loading chunk') ||
          message.includes('Loading CSS chunk')
        ) {
          return null;
        }
      }
      
      // Ignore network errors that users can retry
      if (event.message?.includes('Network request failed')) {
        return null;
      }
      
      return event;
    },
    
    // Don't send in development unless explicitly enabled
    enabled: IS_PRODUCTION || import.meta.env.VITE_SENTRY_ENABLED === 'true',
  });
}

// =============================================================================
// USER CONTEXT
// =============================================================================

/**
 * Set user context for error reports
 * Call this after user logs in
 */
export function setSentryUser(user: {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  teamId?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
  
  // Set additional context
  Sentry.setContext('user_info', {
    role: user.role,
    teamId: user.teamId,
  });
}

/**
 * Clear user context on logout
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

// =============================================================================
// MANUAL ERROR CAPTURE
// =============================================================================

/**
 * Manually capture an exception
 */
export function captureException(
  error: Error,
  context?: Record<string, any>
): string {
  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Manually capture a message
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
): string {
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

// =============================================================================
// PERFORMANCE MONITORING
// =============================================================================

/**
 * Start a performance transaction
 */
export function startTransaction(
  name: string,
  op: string
): Sentry.Span | undefined {
  return Sentry.startInactiveSpan({
    name,
    op,
  });
}

// =============================================================================
// ERROR BOUNDARY INTEGRATION
// =============================================================================

/**
 * Sentry Error Boundary wrapper
 * Use this to wrap components that should report errors to Sentry
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * Higher-order component to wrap with Sentry profiling
 */
export const withSentryProfiler = Sentry.withProfiler;

export default {
  initSentry,
  setSentryUser,
  clearSentryUser,
  captureException,
  captureMessage,
  addBreadcrumb,
  startTransaction,
  SentryErrorBoundary,
  withSentryProfiler,
};
