/**
 * Analytics Service
 * 
 * Centralized tracking for user behavior and app metrics.
 * Trait #15: Analytics Ready - Track what matters
 * 
 * Currently uses Firebase Analytics (Google Analytics 4).
 * Can be extended to PostHog, Mixpanel, etc.
 */

import { analytics } from './firebase';
import { logEvent } from 'firebase/analytics';

// =============================================================================
// EVENT TYPES
// =============================================================================

export type AnalyticsEvent = 
  // Onboarding Events
  | 'onboarding_welcome_shown'
  | 'onboarding_welcome_dismissed'
  | 'onboarding_checklist_viewed'
  | 'onboarding_task_completed'
  | 'onboarding_all_tasks_completed'
  
  // Content Moderation Events
  | 'content_blocked'
  | 'content_flagged'
  | 'content_reported'
  
  // Feature Usage Events
  | 'feature_playbook_viewed'
  | 'feature_roster_viewed'
  | 'feature_chat_sent'
  | 'feature_play_created'
  | 'feature_play_cloned'
  | 'feature_event_created'
  | 'feature_ticket_purchased'
  
  // User Events
  | 'user_signup'
  | 'user_login'
  | 'user_role_selected'
  | 'user_team_joined'
  | 'user_team_created'
  
  // Error Events
  | 'error_occurred';

// =============================================================================
// TRACKING FUNCTIONS
// =============================================================================

/**
 * Track an analytics event
 */
export function trackEvent(
  event: AnalyticsEvent,
  params?: Record<string, string | number | boolean>
): void {
  try {
    if (analytics) {
      logEvent(analytics, event, params);
    }
    
    // Also log to console in development
    if (import.meta.env.DEV) {
      console.log('[Analytics]', event, params);
    }
  } catch (error) {
    // Silently fail - don't break app for analytics
    console.warn('Analytics tracking failed:', error);
  }
}

/**
 * Track page view
 */
export function trackPageView(pageName: string, pageTitle?: string): void {
  trackEvent('page_view' as AnalyticsEvent, {
    page_name: pageName,
    page_title: pageTitle || pageName,
  });
}

// =============================================================================
// SPECIFIC TRACKING HELPERS
// =============================================================================

// Onboarding tracking
export const trackOnboarding = {
  welcomeShown: () => trackEvent('onboarding_welcome_shown'),
  welcomeDismissed: () => trackEvent('onboarding_welcome_dismissed'),
  checklistViewed: () => trackEvent('onboarding_checklist_viewed'),
  taskCompleted: (taskId: string) => trackEvent('onboarding_task_completed', { task_id: taskId }),
  allTasksCompleted: (totalTime: number) => trackEvent('onboarding_all_tasks_completed', { completion_time_seconds: totalTime }),
};

// Moderation tracking
export const trackModeration = {
  contentBlocked: (contentType: string, severity: string) => 
    trackEvent('content_blocked', { content_type: contentType, severity }),
  contentFlagged: (contentType: string, severity: string) => 
    trackEvent('content_flagged', { content_type: contentType, severity }),
  contentReported: (contentType: string, reason: string) => 
    trackEvent('content_reported', { content_type: contentType, reason }),
};

// Feature usage tracking
export const trackFeature = {
  playbookViewed: (teamId: string) => trackEvent('feature_playbook_viewed', { team_id: teamId }),
  rosterViewed: (teamId: string) => trackEvent('feature_roster_viewed', { team_id: teamId }),
  chatSent: (teamId: string) => trackEvent('feature_chat_sent', { team_id: teamId }),
  playCreated: (sport: string) => trackEvent('feature_play_created', { sport }),
  playCloned: (playId: string) => trackEvent('feature_play_cloned', { play_id: playId }),
  eventCreated: (eventType: string) => trackEvent('feature_event_created', { event_type: eventType }),
  ticketPurchased: (eventId: string, amount: number) => 
    trackEvent('feature_ticket_purchased', { event_id: eventId, amount }),
};

// User tracking
export const trackUser = {
  signup: (method: string) => trackEvent('user_signup', { method }),
  login: (method: string) => trackEvent('user_login', { method }),
  roleSelected: (role: string) => trackEvent('user_role_selected', { role }),
  teamJoined: (teamId: string) => trackEvent('user_team_joined', { team_id: teamId }),
  teamCreated: (sport: string) => trackEvent('user_team_created', { sport }),
};

// Error tracking
export function trackError(errorName: string, errorMessage: string, componentStack?: string): void {
  trackEvent('error_occurred', {
    error_name: errorName,
    error_message: errorMessage.substring(0, 100),
    component: componentStack?.substring(0, 100) || 'unknown',
  });
}

export default {
  trackEvent,
  trackPageView,
  trackOnboarding,
  trackModeration,
  trackFeature,
  trackUser,
  trackError,
};
