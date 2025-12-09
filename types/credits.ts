// =============================================================================
// OSYS CREDITS SYSTEM - Types & Interfaces
// Unified monetization system for all premium features
// =============================================================================

import { Timestamp } from 'firebase/firestore';

// =============================================================================
// CREDIT TRANSACTIONS
// =============================================================================

export type CreditTransactionType = 
  | 'purchase'        // Bought credits
  | 'gift_sent'       // Sent credits to someone
  | 'gift_received'   // Received credits from someone
  | 'usage'           // Spent on a feature
  | 'refund'          // Admin refund
  | 'promo'           // Promotional credits
  | 'welcome'         // New user welcome credits
  | 'subscription'    // Monthly subscription credits
  | 'admin_adjust';   // Manual admin adjustment

export type CreditFeatureType =
  | 'ai_design_generate'   // AI design generation (logos, flyers, etc)
  | 'design_clone_play'    // AI play cloning from image
  | 'design_trace_play'    // Trace play from image
  | 'design_flyer'         // Create flyer/poster
  | 'design_export_hd'     // HD/print export
  | 'playbook_import'      // Import playbook
  | 'ai_assistant'         // AI coaching assistant
  | 'video_upload'         // Upload video to library
  | 'video_analyze'        // AI video analysis
  | 'stats_advanced'       // Advanced stat reports
  | 'roster_export'        // Export roster data
  | string;                // Allow custom features

export interface CreditTransaction {
  id: string;
  userId: string;
  type: CreditTransactionType;
  amount: number;              // Positive = add, Negative = subtract
  balance: number;             // Balance after transaction
  feature?: CreditFeatureType; // Which feature used credits
  description: string;
  metadata?: {
    // For purchases
    paypalOrderId?: string;
    paypalPayerId?: string;
    bundleId?: string;
    bundleName?: string;       // Name of purchased bundle
    amountPaid?: number;
    price?: number;            // Bundle price
    currency?: string;
    paypalUsed?: 'primary' | 'secondary';
    paymentMethod?: string;    // Payment method used
    
    // For gifts
    recipientId?: string;
    recipientName?: string;
    senderId?: string;
    senderName?: string;
    giftMessage?: string;
    
    // For usage
    itemId?: string;           // ID of what was created
    itemName?: string;
    
    // For promo/admin
    promoCode?: string;
    adminId?: string;
    adminName?: string;
    reason?: string;
  };
  createdAt: Timestamp;
}

// =============================================================================
// CREDIT BUNDLES (Purchasable packages)
// =============================================================================

export interface CreditBundle {
  id: string;
  name: string;               // "Starter", "Popular", "Best Value"
  credits: number;            // Base credits
  bonusCredits: number;       // Bonus credits
  price: number;              // USD price
  currency: string;           // "USD"
  isPopular?: boolean;        // Highlight as "Most Popular"
  isBestValue?: boolean;      // Highlight as "Best Value"
  enabled: boolean;
  sortOrder: number;
}

// =============================================================================
// FEATURE PRICING (What costs credits)
// =============================================================================

export interface FeaturePricing {
  featureType: CreditFeatureType;  // Unique feature identifier
  name: string;
  description: string;
  creditsPerUse: number;           // Credits consumed per use
  freeUsesPerMonth: number;        // Free uses per month (0 = none)
  freeUsesPerDay?: number;         // Free uses per day (0 = none)
  freeUsesResetPeriod?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  bypassForPilot?: boolean;        // Skip credits for pilot users
  enabled: boolean;                // Is this feature monetized?
  category?: 'design' | 'playbook' | 'video' | 'ai' | 'export' | 'premium' | string;
}

// =============================================================================
// PAYMENT CONFIGURATION
// =============================================================================

export interface PayPalConfig {
  clientId: string;
  // Note: Secret is stored encrypted in Firestore, never exposed to client
  enabled: boolean;
  lastError?: string;
  lastErrorAt?: Timestamp;
  successfulTransactions: number;
  failedTransactions: number;
}

export interface PaymentSettings {
  primary: PayPalConfig;
  secondary: PayPalConfig;
  failover: {
    autoEnabled: boolean;
    retryPrimaryAfterHours: number;
    currentlyUsingBackup: boolean;
    backupActivatedAt?: Timestamp;
    notifyAdminOnFailover: boolean;
  };
}

// =============================================================================
// PROMO CODES
// =============================================================================

export interface PromoCode {
  id: string;
  code: string;              // "HOLIDAY50", "WELCOME25"
  credits: number;           // Credits to award
  maxUses: number;           // 0 = unlimited
  currentUses: number;
  validFrom: Timestamp;
  validUntil: Timestamp;
  enabled: boolean;
  isActive?: boolean;        // Alternative to enabled for UI toggling
  description: string;
  createdBy: string;
  createdAt: Timestamp;
}

// =============================================================================
// PILOT PROGRAMS
// =============================================================================

export interface PilotProgram {
  id: string;
  name: string;              // "Riverside League Pilot"
  description: string;
  userIds: string[];         // Users in this pilot
  bypassCredits: boolean;    // If true, users don't pay credits
  bonusCredits: number;      // Credits awarded when joining
  validUntil: Timestamp;
  enabled: boolean;
  isActive?: boolean;        // Alternative to enabled for UI toggling
  features?: string[];       // Features available in pilot
  startsAt?: Timestamp;      // When pilot starts
  endsAt?: Timestamp;        // When pilot ends
  maxParticipants?: number;  // Max users allowed
  currentParticipants?: number; // Current user count
  createdBy: string;
  createdAt: Timestamp;
}

// =============================================================================
// USER CREDIT STATE
// =============================================================================

export interface UserCreditState {
  balance: number;           // Current credit balance
  lifetimeEarned: number;    // Total credits ever earned
  lifetimeSpent: number;     // Total credits ever spent
  lifetimeGifted: number;    // Total credits gifted to others
  lifetimeReceived: number;  // Total credits received as gifts
  
  // Feature usage tracking (for free tier limits)
  featureUsage: {
    [key in CreditFeatureType]?: {
      totalUses: number;
      freeUsesRemaining: number;
      lastUsedAt?: Timestamp;
      lastFreeResetAt?: Timestamp;
    };
  };
  
  // Pilot program
  pilotProgramId?: string;
  pilotExpiresAt?: Timestamp;
  
  lastTransactionAt?: Timestamp;
}

// =============================================================================
// MONETIZATION SETTINGS (SuperAdmin configurable)
// =============================================================================

export interface MonetizationSettings {
  // Global toggle
  creditsEnabled: boolean;           // Master switch for credit system
  
  // Welcome credits
  welcomeCredits: number;            // Credits given to new users
  
  // Credit bundles
  bundles: CreditBundle[];
  
  // Feature pricing
  featurePricing: FeaturePricing[];
  
  // Payment settings
  payment: PaymentSettings;
  
  // Active promo codes
  promoCodes: PromoCode[];
  
  // Active pilot programs
  pilotPrograms: PilotProgram[];
  
  // Free period (bypass all credit checks)
  freePeriod: {
    enabled: boolean;
    message: string;                 // "Holiday promotion - all features free!"
    validUntil?: Timestamp;
  };
  
  // Metadata
  lastUpdatedBy: string;
  lastUpdatedAt: Timestamp;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

export const DEFAULT_BUNDLES: CreditBundle[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 50,
    bonusCredits: 0,
    price: 4.99,
    currency: 'USD',
    enabled: true,
    sortOrder: 1,
  },
  {
    id: 'popular',
    name: 'Popular',
    credits: 150,
    bonusCredits: 25,
    price: 9.99,
    currency: 'USD',
    isPopular: true,
    enabled: true,
    sortOrder: 2,
  },
  {
    id: 'best-value',
    name: 'Best Value',
    credits: 500,
    bonusCredits: 100,
    price: 24.99,
    currency: 'USD',
    isBestValue: true,
    enabled: true,
    sortOrder: 3,
  },
];

export const DEFAULT_FEATURE_PRICING: FeaturePricing[] = [
  {
    featureType: 'ai_design_generate',
    name: 'AI Design Generation',
    description: 'Generate logos, flyers, posters with AI',
    creditsPerUse: 5,
    freeUsesPerMonth: 1,
    enabled: true,
    category: 'ai',
  },
  {
    featureType: 'design_clone_play',
    name: 'Clone Play from Image',
    description: 'Use AI to convert a play diagram image into an editable play',
    creditsPerUse: 1,
    freeUsesPerMonth: 3,
    enabled: true,
    category: 'design',
  },
  {
    featureType: 'design_trace_play',
    name: 'Trace Play from Image',
    description: 'Overlay an image to trace plays manually',
    creditsPerUse: 0,
    freeUsesPerMonth: 0,
    enabled: true,
    category: 'design',
  },
  {
    featureType: 'design_flyer',
    name: 'Create Flyer/Poster',
    description: 'Create promotional flyers and posters with templates',
    creditsPerUse: 2,
    freeUsesPerMonth: 5,
    enabled: true,
    category: 'design',
  },
  {
    featureType: 'design_export_hd',
    name: 'HD/Print Export',
    description: 'Export designs in high resolution for printing',
    creditsPerUse: 1,
    freeUsesPerMonth: 3,
    enabled: true,
    category: 'export',
  },
  {
    featureType: 'playbook_import',
    name: 'Import Playbook',
    description: 'Import plays from external playbook files',
    creditsPerUse: 5,
    freeUsesPerMonth: 1,
    enabled: false,
    category: 'playbook',
  },
  {
    featureType: 'ai_assistant',
    name: 'AI Coaching Assistant',
    description: 'Get AI-powered coaching suggestions and analysis',
    creditsPerUse: 3,
    freeUsesPerMonth: 2,
    enabled: false,
    category: 'ai',
  },
  {
    featureType: 'video_upload',
    name: 'Video Upload',
    description: 'Upload game film and practice videos',
    creditsPerUse: 0,
    freeUsesPerMonth: 0,
    enabled: false,
    category: 'premium',
  },
  {
    featureType: 'stats_advanced',
    name: 'Advanced Stats Report',
    description: 'Generate detailed statistical analysis reports',
    creditsPerUse: 2,
    freeUsesPerMonth: 1,
    enabled: false,
    category: 'premium',
  },
];

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  primary: {
    clientId: '',
    enabled: false,
    successfulTransactions: 0,
    failedTransactions: 0,
  },
  secondary: {
    clientId: '',
    enabled: false,
    successfulTransactions: 0,
    failedTransactions: 0,
  },
  failover: {
    autoEnabled: true,
    retryPrimaryAfterHours: 24,
    currentlyUsingBackup: false,
    notifyAdminOnFailover: true,
  },
};

export const DEFAULT_MONETIZATION_SETTINGS: Omit<MonetizationSettings, 'lastUpdatedBy' | 'lastUpdatedAt'> = {
  creditsEnabled: true,
  welcomeCredits: 10,
  bundles: DEFAULT_BUNDLES,
  featurePricing: DEFAULT_FEATURE_PRICING,
  payment: DEFAULT_PAYMENT_SETTINGS,
  promoCodes: [],
  pilotPrograms: [],
  freePeriod: {
    enabled: false,
    message: '',
  },
};

export const DEFAULT_USER_CREDIT_STATE: UserCreditState = {
  balance: 0,
  lifetimeEarned: 0,
  lifetimeSpent: 0,
  lifetimeGifted: 0,
  lifetimeReceived: 0,
  featureUsage: {},
};
