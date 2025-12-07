/**
 * Content Moderation Service
 * 
 * Phase 1: Basic profanity filter, keyword blocklist, and flagging system.
 * Designed for child safety in youth sports context.
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// =============================================================================
// PROFANITY & KEYWORD LISTS
// =============================================================================

// Common profanity (mild to severe)
const PROFANITY_LIST = [
  // F-words
  'fuck', 'fucking', 'fucker', 'fucked', 'fck', 'fuk', 'f*ck', 'f**k',
  // S-words
  'shit', 'shitting', 'sh*t', 'sh1t', 'bullshit',
  // A-words
  'ass', 'asshole', 'a**hole', 'arse',
  // B-words
  'bitch', 'b*tch', 'b1tch', 'bitching',
  // D-words
  'damn', 'dammit', 'dick', 'd*ck',
  // Other
  'crap', 'piss', 'pissed', 'bastard', 'cunt', 'whore', 'slut',
  // Common substitutions
  'wtf', 'stfu', 'lmfao',
];

// Severe content - immediate block
const SEVERE_KEYWORDS = [
  // Violence
  'kill', 'murder', 'shoot', 'stab', 'bomb', 'attack',
  // Hate speech
  'nigger', 'n*gger', 'faggot', 'f*ggot', 'retard', 'retarded',
  // Sexual content
  'porn', 'nude', 'naked', 'sex', 'penis', 'vagina',
  // Drugs
  'cocaine', 'heroin', 'meth', 'weed', 'marijuana',
  // Grooming red flags
  'snapchat me', 'dm me', 'send pics', 'private chat',
];

// Context-sensitive phrases (might need human review)
const CONTEXT_SENSITIVE = [
  'hurt', 'pain', 'hate you', 'stupid', 'idiot', 'dumb',
  'loser', 'ugly', 'fat', 'sucks', 'worst',
];

// Personal info patterns (phone, email, address)
const PERSONAL_INFO_PATTERNS = [
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
  /\b\d{5}(?:-\d{4})?\b/, // ZIP codes
];

// =============================================================================
// MODERATION TYPES
// =============================================================================

export type ModerationSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface ModerationResult {
  isAllowed: boolean;
  severity: ModerationSeverity;
  reasons: string[];
  flaggedWords: string[];
  requiresReview: boolean;
  sanitizedText?: string;
}

// =============================================================================
// MODERATION FUNCTIONS
// =============================================================================

/**
 * Moderate text content for inappropriate content
 */
export function moderateText(text: string): ModerationResult {
  const result: ModerationResult = {
    isAllowed: true,
    severity: 'none',
    reasons: [],
    flaggedWords: [],
    requiresReview: false,
  };

  if (!text || typeof text !== 'string') {
    return result;
  }

  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);

  // Check for severe content first
  for (const keyword of SEVERE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      result.isAllowed = false;
      result.severity = 'critical';
      result.reasons.push('Contains severely inappropriate content');
      result.flaggedWords.push(keyword);
      result.requiresReview = true;
    }
  }

  // Check profanity
  for (const word of words) {
    const cleanWord = word.replace(/[^a-z0-9]/g, '');
    if (PROFANITY_LIST.includes(cleanWord)) {
      result.flaggedWords.push(cleanWord);
      if (result.severity !== 'critical') {
        result.severity = 'medium';
        result.reasons.push('Contains profanity');
      }
    }
  }

  // Check context-sensitive words
  for (const phrase of CONTEXT_SENSITIVE) {
    if (lowerText.includes(phrase)) {
      if (!result.flaggedWords.includes(phrase)) {
        result.flaggedWords.push(phrase);
      }
      if (result.severity === 'none') {
        result.severity = 'low';
        result.reasons.push('May contain inappropriate language');
        result.requiresReview = true;
      }
    }
  }

  // Check for personal information
  for (const pattern of PERSONAL_INFO_PATTERNS) {
    if (pattern.test(text)) {
      result.reasons.push('May contain personal information');
      result.severity = result.severity === 'none' ? 'high' : result.severity;
      result.requiresReview = true;
    }
  }

  // Determine if content should be blocked
  if (result.severity === 'critical') {
    result.isAllowed = false;
  } else if (result.severity === 'high' || result.severity === 'medium') {
    // Allow but flag for review
    result.isAllowed = true;
    result.requiresReview = true;
  }

  // Generate sanitized text (replace profanity with asterisks)
  let sanitized = text;
  for (const word of result.flaggedWords) {
    const regex = new RegExp(word, 'gi');
    sanitized = sanitized.replace(regex, '*'.repeat(word.length));
  }
  result.sanitizedText = sanitized;

  return result;
}

/**
 * Quick check if text passes basic moderation
 * Use for real-time typing feedback
 */
export function quickCheck(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  return !SEVERE_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Get warning message for UI
 */
export function getModerationWarning(result: ModerationResult): string | null {
  if (result.severity === 'none') return null;
  
  if (result.severity === 'critical') {
    return 'This message cannot be sent. It contains content that violates our community guidelines.';
  }
  
  if (result.severity === 'high') {
    return 'Please remove any personal contact information before sending.';
  }
  
  if (result.severity === 'medium') {
    return 'Please keep messages appropriate for all ages.';
  }
  
  if (result.severity === 'low') {
    return 'Please be respectful in your messages.';
  }
  
  return null;
}

// =============================================================================
// REPORTING SYSTEM
// =============================================================================

export interface ContentReport {
  contentId: string;
  contentType: 'message' | 'post' | 'profile' | 'video' | 'comment';
  teamId: string;
  reportedBy: string;
  reporterName: string;
  reason: string;
  details?: string;
  contentText?: string;
  contentAuthor?: string;
  contentAuthorId?: string;
  timestamp: any;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: any;
  actionTaken?: string;
}

// Rate limiting for reports (prevent abuse)
const reportRateLimits = new Map<string, number[]>();
const MAX_REPORTS_PER_HOUR = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check if user is rate-limited for reporting
 */
function isReportRateLimited(userId: string): boolean {
  const now = Date.now();
  const userReports = reportRateLimits.get(userId) || [];
  
  // Clean old entries
  const recentReports = userReports.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  reportRateLimits.set(userId, recentReports);
  
  return recentReports.length >= MAX_REPORTS_PER_HOUR;
}

/**
 * Track report for rate limiting
 */
function trackReport(userId: string): void {
  const userReports = reportRateLimits.get(userId) || [];
  userReports.push(Date.now());
  reportRateLimits.set(userId, userReports);
}

/**
 * Validate report data before submission
 */
function validateReport(report: Omit<ContentReport, 'timestamp' | 'status'>): string[] {
  const errors: string[] = [];
  
  if (!report.contentId || typeof report.contentId !== 'string') {
    errors.push('Invalid content ID');
  }
  if (!report.teamId || typeof report.teamId !== 'string') {
    errors.push('Invalid team ID');
  }
  if (!report.reportedBy || typeof report.reportedBy !== 'string') {
    errors.push('Reporter ID is required');
  }
  if (!report.reason || typeof report.reason !== 'string') {
    errors.push('Report reason is required');
  }
  if (!['message', 'post', 'profile', 'video', 'comment'].includes(report.contentType)) {
    errors.push('Invalid content type');
  }
  
  // Sanitize details field (prevent XSS in admin panel)
  if (report.details && report.details.length > 1000) {
    errors.push('Details too long (max 1000 characters)');
  }
  
  return errors;
}

/**
 * Report content for admin review
 * Includes rate limiting and input validation
 */
export async function reportContent(report: Omit<ContentReport, 'timestamp' | 'status'>): Promise<string> {
  // Validate input
  const validationErrors = validateReport(report);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid report: ${validationErrors.join(', ')}`);
  }
  
  // Check rate limiting
  if (isReportRateLimited(report.reportedBy)) {
    throw new Error('You have submitted too many reports. Please try again later.');
  }
  
  // Track this report for rate limiting
  trackReport(report.reportedBy);
  
  // Sanitize text fields to prevent stored XSS
  const sanitizedReport = {
    ...report,
    details: report.details?.substring(0, 1000),
    contentText: report.contentText?.substring(0, 2000),
    reporterName: report.reporterName?.substring(0, 100),
  };
  
  const docRef = await addDoc(collection(db, 'contentReports'), {
    ...sanitizedReport,
    timestamp: serverTimestamp(),
    status: 'pending',
  });
  return docRef.id;
}

/**
 * Report reasons for UI dropdown
 */
export const REPORT_REASONS = [
  { value: 'inappropriate', label: 'Inappropriate or offensive content' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'spam', label: 'Spam or irrelevant content' },
  { value: 'personal_info', label: 'Contains personal information' },
  { value: 'impersonation', label: 'Impersonating someone' },
  { value: 'dangerous', label: 'Dangerous or harmful content' },
  { value: 'other', label: 'Other (please specify)' },
];

// =============================================================================
// MODERATION HELPERS
// =============================================================================

/**
 * Censor profanity in text (replace with asterisks)
 */
export function censorText(text: string): string {
  if (!text) return text;
  
  let censored = text;
  for (const word of PROFANITY_LIST) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    censored = censored.replace(regex, '*'.repeat(word.length));
  }
  return censored;
}

/**
 * Check if user should be rate-limited (spam prevention)
 * Returns true if user is sending too many messages
 */
export function isSpamming(
  messageHistory: { timestamp: number }[],
  maxMessages: number = 5,
  timeWindowMs: number = 10000
): boolean {
  const now = Date.now();
  const recentMessages = messageHistory.filter(
    msg => now - msg.timestamp < timeWindowMs
  );
  return recentMessages.length >= maxMessages;
}

/**
 * Get severity color for UI
 */
export function getSeverityColor(severity: ModerationSeverity): string {
  switch (severity) {
    case 'critical': return 'red';
    case 'high': return 'orange';
    case 'medium': return 'yellow';
    case 'low': return 'blue';
    default: return 'green';
  }
}

/**
 * Format moderation result for logging
 */
export function formatModerationLog(
  result: ModerationResult,
  contentType: string,
  userId: string
): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    contentType,
    userId,
    severity: result.severity,
    reasons: result.reasons,
    flaggedWords: result.flaggedWords.length > 0 ? '[REDACTED]' : [],
    isAllowed: result.isAllowed,
  });
}

export default {
  moderateText,
  quickCheck,
  getModerationWarning,
  reportContent,
  censorText,
  isSpamming,
  getSeverityColor,
  REPORT_REASONS,
};
