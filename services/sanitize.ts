/**
 * Input Sanitization Utilities
 * Prevents XSS attacks and cleans user input before storing in Firebase
 */

// Characters that could be used for XSS attacks
const DANGEROUS_CHARS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escapes HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[&<>"'`=/]/g, (char) => DANGEROUS_CHARS[char] || char);
}

/**
 * Strips all HTML tags from a string
 */
export function stripHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitizes text input - removes dangerous characters and trims whitespace
 * Use for: names, titles, descriptions, messages
 */
export function sanitizeText(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') return '';
  
  // First strip any HTML tags
  let clean = stripHtml(input);
  
  // Trim whitespace
  clean = clean.trim();
  
  // Limit length
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }
  
  // Remove null bytes and other control characters (except newlines and tabs)
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return clean;
}

/**
 * Sanitizes a username - alphanumeric, underscores, hyphens only
 */
export function sanitizeUsername(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  // Only allow alphanumeric, underscores, hyphens
  let clean = input.replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Limit to 30 characters
  if (clean.length > 30) {
    clean = clean.substring(0, 30);
  }
  
  return clean.toLowerCase();
}

/**
 * Sanitizes an email address
 */
export function sanitizeEmail(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  // Basic email cleanup - trim and lowercase
  let clean = input.trim().toLowerCase();
  
  // Remove any HTML/script attempts
  clean = stripHtml(clean);
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clean)) {
    return ''; // Return empty if invalid
  }
  
  return clean;
}

/**
 * Sanitizes a phone number - digits and common formatting only
 */
export function sanitizePhone(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  // Allow digits, spaces, hyphens, parentheses, plus sign
  let clean = input.replace(/[^\d\s\-()+ ]/g, '');
  
  // Limit length
  if (clean.length > 20) {
    clean = clean.substring(0, 20);
  }
  
  return clean.trim();
}

/**
 * Sanitizes a URL
 */
export function sanitizeUrl(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  let clean = input.trim();
  
  // Reject javascript: and data: URLs (XSS vectors)
  if (clean.toLowerCase().startsWith('javascript:') || 
      clean.toLowerCase().startsWith('data:') ||
      clean.toLowerCase().startsWith('vbscript:')) {
    return '';
  }
  
  // Basic URL validation
  try {
    new URL(clean);
    return clean;
  } catch {
    // If it doesn't have a protocol, try adding https
    if (!clean.includes('://')) {
      try {
        new URL('https://' + clean);
        return 'https://' + clean;
      } catch {
        return '';
      }
    }
    return '';
  }
}

/**
 * Sanitizes a number input (for jersey numbers, stats, etc.)
 */
export function sanitizeNumber(input: string | number, min: number = 0, max: number = 9999): number {
  if (typeof input === 'number') {
    return Math.min(Math.max(Math.floor(input), min), max);
  }
  
  if (!input || typeof input !== 'string') return min;
  
  const parsed = parseInt(input.replace(/[^\d-]/g, ''), 10);
  
  if (isNaN(parsed)) return min;
  
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Sanitizes a date string (YYYY-MM-DD format)
 */
export function sanitizeDate(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  // Only allow date format characters
  const clean = input.replace(/[^\d-]/g, '');
  
  // Validate format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(clean)) {
    return '';
  }
  
  // Validate actual date
  const date = new Date(clean);
  if (isNaN(date.getTime())) {
    return '';
  }
  
  return clean;
}

/**
 * Sanitizes rich content that may contain some allowed HTML
 * Use sparingly - for description fields that need basic formatting
 */
export function sanitizeRichText(input: string, maxLength: number = 5000): string {
  if (!input || typeof input !== 'string') return '';
  
  // Remove script tags and event handlers
  let clean = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:/gi, '');
  
  // Limit length
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }
  
  return clean.trim();
}

/**
 * Batch sanitize an object's string fields
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  fieldRules: Partial<Record<keyof T, 'text' | 'username' | 'email' | 'phone' | 'url' | 'number' | 'date'>>
): T {
  const result = { ...obj };
  
  for (const [field, rule] of Object.entries(fieldRules)) {
    const value = result[field as keyof T];
    
    if (value === undefined || value === null) continue;
    
    switch (rule) {
      case 'text':
        (result as Record<string, unknown>)[field] = sanitizeText(String(value));
        break;
      case 'username':
        (result as Record<string, unknown>)[field] = sanitizeUsername(String(value));
        break;
      case 'email':
        (result as Record<string, unknown>)[field] = sanitizeEmail(String(value));
        break;
      case 'phone':
        (result as Record<string, unknown>)[field] = sanitizePhone(String(value));
        break;
      case 'url':
        (result as Record<string, unknown>)[field] = sanitizeUrl(String(value));
        break;
      case 'number':
        (result as Record<string, unknown>)[field] = sanitizeNumber(value as string | number);
        break;
      case 'date':
        (result as Record<string, unknown>)[field] = sanitizeDate(String(value));
        break;
    }
  }
  
  return result;
}
