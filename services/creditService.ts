// =============================================================================
// OSYS CREDIT SERVICE - Core credit operations
// Handles all credit transactions, balance checks, and usage tracking
// =============================================================================

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  runTransaction,
  Timestamp,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  CreditTransaction,
  CreditTransactionType,
  CreditFeatureType,
  UserCreditState,
  MonetizationSettings,
  FeaturePricing,
  PromoCode,
  CreditBundle,
  DEFAULT_USER_CREDIT_STATE,
  DEFAULT_MONETIZATION_SETTINGS,
} from '../types/credits';

// =============================================================================
// RATE LIMITING CONFIG
// =============================================================================
const RATE_LIMITS = {
  gifts: {
    maxPerHour: 10,      // Max gift transactions per hour
    maxPerDay: 50,       // Max gift transactions per day
    maxAmountPerDay: 1000, // Max credits gifted per day
  },
  promoCodes: {
    maxPerHour: 5,       // Max promo redemptions per hour
    maxPerDay: 10,       // Max promo redemptions per day
  },
  featureUsage: {
    maxPerMinute: 30,    // Max feature uses per minute (anti-abuse)
  },
};

// In-memory rate limit tracking (resets on server restart, use Redis in production)
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if action is rate limited
 */
function checkRateLimit(
  userId: string, 
  action: string, 
  maxCount: number, 
  windowMs: number
): { allowed: boolean; retryAfter?: number } {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const entry = rateLimitCache.get(key);
  
  if (!entry || entry.resetAt < now) {
    rateLimitCache.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  
  if (entry.count >= maxCount) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  
  entry.count++;
  return { allowed: true };
}

// =============================================================================
// ADMIN ACTION LOGGING
// =============================================================================

/**
 * Log admin credit actions for audit trail
 */
async function logAdminAction(
  adminId: string,
  adminName: string,
  action: string,
  targetUserId: string,
  details: Record<string, any>
): Promise<void> {
  try {
    await addDoc(collection(db, 'adminAuditLog'), {
      adminId,
      adminName,
      action,
      targetUserId,
      details,
      category: 'credits',
      timestamp: serverTimestamp(),
      ip: 'client', // In production, capture from request headers
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Don't throw - logging failure shouldn't block the action
  }
}

// =============================================================================
// SETTINGS MANAGEMENT
// =============================================================================

/**
 * Get monetization settings from Firestore
 */
export async function getMonetizationSettings(): Promise<MonetizationSettings | null> {
  try {
    const docRef = doc(db, 'settings', 'monetization');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as MonetizationSettings;
    }
    return null;
  } catch (error) {
    console.error('Error getting monetization settings:', error);
    return null;
  }
}

/**
 * Save monetization settings
 */
export async function saveMonetizationSettings(
  settings: Partial<MonetizationSettings>,
  adminId: string
): Promise<void> {
  const docRef = doc(db, 'settings', 'monetization');
  await setDoc(docRef, {
    ...settings,
    lastUpdatedBy: adminId,
    lastUpdatedAt: serverTimestamp(),
  }, { merge: true });
}

// =============================================================================
// USER CREDIT OPERATIONS
// =============================================================================

/**
 * Get user's credit state
 */
export async function getUserCreditState(userId: string): Promise<UserCreditState> {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        balance: data.credits ?? 0,
        lifetimeEarned: data.lifetimeCreditsEarned ?? 0,
        lifetimeSpent: data.lifetimeCreditsSpent ?? 0,
        lifetimeGifted: data.lifetimeCreditsGifted ?? 0,
        lifetimeReceived: data.lifetimeCreditsReceived ?? 0,
        featureUsage: data.featureUsage ?? {},
        pilotProgramId: data.pilotProgramId,
        pilotExpiresAt: data.pilotExpiresAt,
        lastTransactionAt: data.lastCreditTransactionAt,
      };
    }
    
    return {
      balance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      lifetimeGifted: 0,
      lifetimeReceived: 0,
      featureUsage: {},
    };
  } catch (error) {
    console.error('Error getting user credit state:', error);
    throw error;
  }
}

/**
 * Get user's credit balance
 */
export async function getUserCreditBalance(userId: string): Promise<number> {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data().credits ?? 0) : 0;
  } catch (error) {
    console.error('Error getting credit balance:', error);
    return 0;
  }
}

/**
 * Add credits to user account (with transaction logging)
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: CreditTransactionType,
  description: string,
  metadata?: CreditTransaction['metadata']
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  try {
    return await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', userId);
      const userSnap = await transaction.get(userRef);
      
      if (!userSnap.exists()) {
        throw new Error('User not found');
      }
      
      const currentBalance = userSnap.data().credits ?? 0;
      const newBalance = currentBalance + amount;
      
      // Update user balance
      transaction.update(userRef, {
        credits: newBalance,
        lifetimeCreditsEarned: increment(amount),
        lastCreditTransactionAt: serverTimestamp(),
      });
      
      // Log transaction
      const txRef = doc(collection(db, 'users', userId, 'creditTransactions'));
      transaction.set(txRef, {
        userId,
        type,
        amount,
        balance: newBalance,
        description,
        metadata,
        createdAt: serverTimestamp(),
      });
      
      return { success: true, newBalance };
    });
  } catch (error) {
    console.error('Error adding credits:', error);
    return { 
      success: false, 
      newBalance: 0, 
      error: error instanceof Error ? error.message : 'Failed to add credits' 
    };
  }
}

/**
 * Deduct credits from user account (with transaction logging)
 */
export async function deductCredits(
  userId: string,
  amount: number,
  feature: CreditFeatureType,
  description: string,
  metadata?: CreditTransaction['metadata']
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  try {
    return await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', userId);
      const userSnap = await transaction.get(userRef);
      
      if (!userSnap.exists()) {
        throw new Error('User not found');
      }
      
      const currentBalance = userSnap.data().credits ?? 0;
      
      if (currentBalance < amount) {
        throw new Error('Insufficient credits');
      }
      
      const newBalance = currentBalance - amount;
      
      // Update user balance and feature usage
      const featureUsageKey = `featureUsage.${feature}.totalUses`;
      transaction.update(userRef, {
        credits: newBalance,
        lifetimeCreditsSpent: increment(amount),
        lastCreditTransactionAt: serverTimestamp(),
        [featureUsageKey]: increment(1),
        [`featureUsage.${feature}.lastUsedAt`]: serverTimestamp(),
      });
      
      // Log transaction
      const txRef = doc(collection(db, 'users', userId, 'creditTransactions'));
      transaction.set(txRef, {
        userId,
        type: 'usage',
        amount: -amount,
        balance: newBalance,
        feature,
        description,
        metadata,
        createdAt: serverTimestamp(),
      });
      
      return { success: true, newBalance };
    });
  } catch (error) {
    console.error('Error deducting credits:', error);
    return { 
      success: false, 
      newBalance: 0, 
      error: error instanceof Error ? error.message : 'Failed to deduct credits' 
    };
  }
}

/**
 * Gift credits from one user to another
 * SECURITY: Validates that the authenticated user matches senderId
 * Includes rate limiting and daily gift limits
 */
export async function giftCredits(
  senderId: string,
  senderName: string,
  recipientId: string,
  recipientName: string,
  amount: number,
  message?: string,
  authenticatedUserId?: string // Pass the actual authenticated user's ID for validation
): Promise<{ success: boolean; error?: string }> {
  try {
    // SECURITY: Validate sender is the authenticated user
    if (authenticatedUserId && authenticatedUserId !== senderId) {
      console.error('Security violation: senderId does not match authenticated user');
      return { success: false, error: 'Unauthorized: You can only send from your own account' };
    }
    
    // Validate amount
    if (amount <= 0 || !Number.isInteger(amount)) {
      return { success: false, error: 'Invalid amount' };
    }
    
    // Max single gift limit
    if (amount > 500) {
      return { success: false, error: 'Maximum gift amount is 500 credits' };
    }
    
    // Prevent self-gifting
    if (senderId === recipientId) {
      return { success: false, error: 'Cannot gift credits to yourself' };
    }
    
    // Rate limiting - max gifts per hour
    const hourlyLimit = checkRateLimit(senderId, 'gift_hourly', RATE_LIMITS.gifts.maxPerHour, 60 * 60 * 1000);
    if (!hourlyLimit.allowed) {
      return { success: false, error: `Gift limit reached. Try again in ${hourlyLimit.retryAfter} seconds.` };
    }
    
    // Rate limiting - max gifts per day
    const dailyLimit = checkRateLimit(senderId, 'gift_daily', RATE_LIMITS.gifts.maxPerDay, 24 * 60 * 60 * 1000);
    if (!dailyLimit.allowed) {
      return { success: false, error: 'Daily gift limit reached. Try again tomorrow.' };
    }
    
    return await runTransaction(db, async (transaction) => {
      const senderRef = doc(db, 'users', senderId);
      const recipientRef = doc(db, 'users', recipientId);
      
      const [senderSnap, recipientSnap] = await Promise.all([
        transaction.get(senderRef),
        transaction.get(recipientRef),
      ]);
      
      if (!senderSnap.exists()) throw new Error('Sender not found');
      if (!recipientSnap.exists()) throw new Error('Recipient not found');
      
      const senderData = senderSnap.data();
      const senderBalance = senderData.credits ?? 0;
      if (senderBalance < amount) throw new Error('Insufficient credits');
      
      // Check daily gift amount limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const giftedToday = senderData.giftedToday ?? 0;
      const lastGiftDate = senderData.lastGiftDate?.toDate();
      
      let newGiftedToday = amount;
      if (lastGiftDate && lastGiftDate >= today) {
        newGiftedToday = giftedToday + amount;
        if (newGiftedToday > RATE_LIMITS.gifts.maxAmountPerDay) {
          throw new Error(`Daily gift limit of ${RATE_LIMITS.gifts.maxAmountPerDay} credits reached`);
        }
      }
      
      const recipientBalance = recipientSnap.data().credits ?? 0;
      
      // Update sender
      transaction.update(senderRef, {
        credits: senderBalance - amount,
        lifetimeCreditsGifted: increment(amount),
        lastCreditTransactionAt: serverTimestamp(),
        giftedToday: newGiftedToday,
        lastGiftDate: serverTimestamp(),
      });
      
      // Update recipient
      transaction.update(recipientRef, {
        credits: recipientBalance + amount,
        lifetimeCreditsReceived: increment(amount),
        lastCreditTransactionAt: serverTimestamp(),
      });
      
      // Log sender transaction
      const senderTxRef = doc(collection(db, 'users', senderId, 'creditTransactions'));
      transaction.set(senderTxRef, {
        userId: senderId,
        type: 'gift_sent',
        amount: -amount,
        balance: senderBalance - amount,
        description: `Gift to ${recipientName}`,
        metadata: {
          recipientId,
          recipientName,
          giftMessage: message,
        },
        createdAt: serverTimestamp(),
      });
      
      // Log recipient transaction
      const recipientTxRef = doc(collection(db, 'users', recipientId, 'creditTransactions'));
      transaction.set(recipientTxRef, {
        userId: recipientId,
        type: 'gift_received',
        amount,
        balance: recipientBalance + amount,
        description: `Gift from ${senderName}`,
        metadata: {
          senderId,
          senderName,
          giftMessage: message,
        },
        createdAt: serverTimestamp(),
      });
      
      return { success: true };
    });
  } catch (error) {
    console.error('Error gifting credits:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to gift credits' 
    };
  }
}

// =============================================================================
// FEATURE USAGE & CHECKS
// =============================================================================

/**
 * Check if user can use a feature (has credits or free uses)
 */
export async function canUseFeature(
  userId: string,
  feature: CreditFeatureType
): Promise<{ 
  canUse: boolean; 
  reason?: string; 
  creditsRequired?: number;
  freeUsesRemaining?: number;
  isPilotUser?: boolean;
  isFreePeriod?: boolean;
}> {
  try {
    // Get monetization settings
    const settings = await getMonetizationSettings();
    if (!settings) {
      // No settings = features are free
      return { canUse: true };
    }
    
    // Check if credits system is disabled
    if (!settings.creditsEnabled) {
      return { canUse: true };
    }
    
    // Check free period
    if (settings.freePeriod.enabled) {
      if (!settings.freePeriod.validUntil || 
          settings.freePeriod.validUntil.toDate() > new Date()) {
        return { canUse: true, isFreePeriod: true };
      }
    }
    
    // Get feature pricing
    const featurePricing = settings.featurePricing.find(f => f.featureType === feature);
    if (!featurePricing || !featurePricing.enabled) {
      return { canUse: true };
    }
    
    // Get user data
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { canUse: false, reason: 'User not found' };
    }
    
    const userData = userSnap.data();
    
    // Check if pilot user
    if (userData.pilotProgramId && featurePricing.bypassForPilot) {
      const pilotExpires = userData.pilotExpiresAt?.toDate();
      if (!pilotExpires || pilotExpires > new Date()) {
        return { canUse: true, isPilotUser: true };
      }
    }
    
    // Check free uses
    const featureUsage = userData.featureUsage?.[feature];
    const freeUsesPerMonth = featurePricing.freeUsesPerMonth ?? 0;
    
    if (freeUsesPerMonth > 0) {
      let freeUsesRemaining = freeUsesPerMonth;
      
      if (featureUsage) {
        // Check if we need to reset free uses (monthly reset)
        const lastReset = featureUsage.lastFreeResetAt?.toDate();
        const now = new Date();
        let shouldReset = false;
        
        if (lastReset) {
          const resetPeriod = featurePricing.freeUsesResetPeriod ?? 'monthly';
          switch (resetPeriod) {
            case 'daily':
              shouldReset = now.getDate() !== lastReset.getDate();
              break;
            case 'weekly':
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              shouldReset = lastReset < weekAgo;
              break;
            case 'monthly':
              shouldReset = now.getMonth() !== lastReset.getMonth() || 
                           now.getFullYear() !== lastReset.getFullYear();
              break;
            case 'yearly':
              shouldReset = now.getFullYear() !== lastReset.getFullYear();
              break;
          }
        }
        
        if (shouldReset || !lastReset) {
          freeUsesRemaining = freeUsesPerMonth;
        } else {
          freeUsesRemaining = featureUsage.freeUsesRemaining ?? freeUsesPerMonth;
        }
      }
      
      if (freeUsesRemaining > 0) {
        return { canUse: true, freeUsesRemaining };
      }
    }
    
    // Check credits
    const credits = userData.credits ?? 0;
    if (credits >= featurePricing.creditsPerUse) {
      return { 
        canUse: true, 
        creditsRequired: featurePricing.creditsPerUse,
        freeUsesRemaining: 0,
      };
    }
    
    return { 
      canUse: false, 
      reason: 'Insufficient credits',
      creditsRequired: featurePricing.creditsPerUse,
      freeUsesRemaining: 0,
    };
  } catch (error) {
    console.error('Error checking feature access:', error);
    // SECURITY: Fail CLOSED on errors - don't allow access to premium features
    // This prevents exploitation via error injection
    return { 
      canUse: false, 
      reason: 'Unable to verify access. Please try again.' 
    };
  }
}

/**
 * Use a feature (deduct free use or credits)
 */
export async function useFeature(
  userId: string,
  feature: CreditFeatureType,
  itemName?: string,
  itemId?: string
): Promise<{ success: boolean; creditsUsed: number; error?: string }> {
  try {
    const canUseResult = await canUseFeature(userId, feature);
    
    if (!canUseResult.canUse) {
      return { 
        success: false, 
        creditsUsed: 0, 
        error: canUseResult.reason || 'Cannot use feature' 
      };
    }
    
    // If free period or pilot user, just track usage
    if (canUseResult.isFreePeriod || canUseResult.isPilotUser) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        [`featureUsage.${feature}.totalUses`]: increment(1),
        [`featureUsage.${feature}.lastUsedAt`]: serverTimestamp(),
      });
      return { success: true, creditsUsed: 0 };
    }
    
    // If has free uses remaining
    if (canUseResult.freeUsesRemaining && canUseResult.freeUsesRemaining > 0) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        [`featureUsage.${feature}.totalUses`]: increment(1),
        [`featureUsage.${feature}.freeUsesRemaining`]: increment(-1),
        [`featureUsage.${feature}.lastUsedAt`]: serverTimestamp(),
        [`featureUsage.${feature}.lastFreeResetAt`]: serverTimestamp(),
      });
      return { success: true, creditsUsed: 0 };
    }
    
    // Deduct credits
    if (canUseResult.creditsRequired) {
      const result = await deductCredits(
        userId,
        canUseResult.creditsRequired,
        feature,
        `Used ${feature}: ${itemName || 'Item'}`,
        { itemId, itemName }
      );
      return { 
        success: result.success, 
        creditsUsed: canUseResult.creditsRequired,
        error: result.error,
      };
    }
    
    return { success: true, creditsUsed: 0 };
  } catch (error) {
    console.error('Error using feature:', error);
    return { 
      success: false, 
      creditsUsed: 0, 
      error: error instanceof Error ? error.message : 'Failed to use feature' 
    };
  }
}

// =============================================================================
// PROMO CODE OPERATIONS
// =============================================================================

/**
 * Redeem a promo code
 * Uses transaction to prevent race conditions
 * Includes rate limiting to prevent abuse
 */
export async function redeemPromoCode(
  userId: string,
  code: string
): Promise<{ success: boolean; credits?: number; error?: string }> {
  try {
    // Validate inputs
    if (!code || typeof code !== 'string') {
      return { success: false, error: 'Invalid promo code' };
    }
    
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode.length < 3 || normalizedCode.length > 50) {
      return { success: false, error: 'Invalid promo code format' };
    }
    
    // Rate limiting - prevent promo code brute forcing
    const hourlyLimit = checkRateLimit(userId, 'promo_hourly', RATE_LIMITS.promoCodes.maxPerHour, 60 * 60 * 1000);
    if (!hourlyLimit.allowed) {
      return { success: false, error: `Too many attempts. Try again in ${hourlyLimit.retryAfter} seconds.` };
    }
    
    const dailyLimit = checkRateLimit(userId, 'promo_daily', RATE_LIMITS.promoCodes.maxPerDay, 24 * 60 * 60 * 1000);
    if (!dailyLimit.allowed) {
      return { success: false, error: 'Daily limit reached. Try again tomorrow.' };
    }
    
    // Use transaction to prevent race conditions
    return await runTransaction(db, async (transaction) => {
      const settings = await getMonetizationSettings();
      if (!settings) {
        throw new Error('Settings not found');
      }
      
      const promoCode = settings.promoCodes.find(
        p => p.code.toUpperCase() === normalizedCode && p.enabled
      );
      
      if (!promoCode) {
        throw new Error('Invalid promo code');
      }
      
      const now = new Date();
      if (promoCode.validFrom.toDate() > now) {
        throw new Error('Promo code not yet active');
      }
      if (promoCode.validUntil.toDate() < now) {
        throw new Error('Promo code expired');
      }
      if (promoCode.maxUses > 0 && promoCode.currentUses >= promoCode.maxUses) {
        throw new Error('Promo code usage limit reached');
      }
      
      // Check if user already used this code (within transaction)
      const usedCodeRef = doc(db, 'users', userId, 'usedPromoCodes', promoCode.id);
      const existingUse = await transaction.get(usedCodeRef);
      if (existingUse.exists()) {
        throw new Error('You have already used this promo code');
      }
      
      // Get user's current balance
      const userRef = doc(db, 'users', userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('User not found');
      }
      
      const currentBalance = userSnap.data().credits ?? 0;
      const newBalance = currentBalance + promoCode.credits;
      
      // Update user balance
      transaction.update(userRef, {
        credits: newBalance,
        lifetimeCreditsEarned: increment(promoCode.credits),
        lastCreditTransactionAt: serverTimestamp(),
      });
      
      // Log transaction
      const txRef = doc(collection(db, 'users', userId, 'creditTransactions'));
      transaction.set(txRef, {
        userId,
        type: 'promo',
        amount: promoCode.credits,
        balance: newBalance,
        description: `Promo code: ${promoCode.code}`,
        metadata: { promoCode: promoCode.code },
        createdAt: serverTimestamp(),
      });
      
      // Mark code as used by this user
      transaction.set(usedCodeRef, {
        codeId: promoCode.id,
        code: promoCode.code,
        credits: promoCode.credits,
        usedAt: serverTimestamp(),
      });
      
      return { success: true, credits: promoCode.credits };
    });
  } catch (error) {
    console.error('Error redeeming promo code:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to redeem promo code' 
    };
  }
}

// =============================================================================
// TRANSACTION HISTORY
// =============================================================================

/**
 * Get user's credit transaction history
 */
export async function getCreditTransactions(
  userId: string,
  limitCount: number = 50
): Promise<CreditTransaction[]> {
  try {
    const txRef = collection(db, 'users', userId, 'creditTransactions');
    const q = query(txRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CreditTransaction[];
  } catch (error) {
    console.error('Error getting transactions:', error);
    return [];
  }
}

// =============================================================================
// ADMIN OPERATIONS
// =============================================================================

/**
 * Admin: Adjust user credits
 * Includes audit logging for security compliance
 */
export async function adminAdjustCredits(
  targetUserId: string,
  amount: number,
  reason: string,
  adminId: string,
  adminName: string
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  try {
    // Validate inputs
    if (!targetUserId || !adminId) {
      return { success: false, error: 'Invalid parameters' };
    }
    
    if (!Number.isInteger(amount) || amount === 0) {
      return { success: false, error: 'Amount must be a non-zero integer' };
    }
    
    // Max adjustment limit for safety
    if (Math.abs(amount) > 10000) {
      return { success: false, error: 'Maximum adjustment is 10,000 credits' };
    }
    
    const type: CreditTransactionType = 'admin_adjust';
    
    const result = await addCredits(
      targetUserId,
      amount,
      type,
      `Admin adjustment: ${reason}`,
      { adminId, adminName, reason }
    );
    
    // Log admin action for audit trail
    if (result.success) {
      await logAdminAction(adminId, adminName, 'adjust_credits', targetUserId, {
        amount,
        reason,
        newBalance: result.newBalance,
        timestamp: new Date().toISOString(),
      });
    }
    
    return { success: result.success, error: result.error, newBalance: result.newBalance };
  } catch (error) {
    console.error('Error adjusting credits:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to adjust credits' 
    };
  }
}

/**
 * Admin: Add user to pilot program
 * Includes audit logging
 */
export async function addUserToPilotProgram(
  userId: string,
  programId: string,
  expiresAt: Date,
  bonusCredits: number,
  adminId?: string,
  adminName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      pilotProgramId: programId,
      pilotExpiresAt: Timestamp.fromDate(expiresAt),
    });
    
    if (bonusCredits > 0) {
      await addCredits(
        userId,
        bonusCredits,
        'promo',
        'Pilot program welcome credits',
        { reason: 'Pilot program enrollment' }
      );
    }
    
    // Log admin action
    if (adminId && adminName) {
      await logAdminAction(adminId, adminName, 'add_to_pilot', userId, {
        programId,
        expiresAt: expiresAt.toISOString(),
        bonusCredits,
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error adding user to pilot:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to add to pilot' 
    };
  }
}

/**
 * Admin: Remove user from pilot program
 * Includes audit logging
 */
export async function removeUserFromPilotProgram(
  userId: string,
  adminId?: string,
  adminName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      pilotProgramId: null,
      pilotExpiresAt: null,
    });
    
    // Log admin action
    if (adminId && adminName) {
      await logAdminAction(adminId, adminName, 'remove_from_pilot', userId, {
        timestamp: new Date().toISOString(),
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error removing from pilot:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to remove from pilot' 
    };
  }
}

// =============================================================================
// INITIALIZATION & MIGRATION
// =============================================================================

/**
 * Initialize credits for a new user
 */
export async function initializeUserCredits(
  userId: string
): Promise<void> {
  try {
    const settings = await getMonetizationSettings();
    const welcomeCredits = settings?.welcomeCredits ?? 10;
    
    if (welcomeCredits > 0) {
      await addCredits(
        userId,
        welcomeCredits,
        'welcome',
        'Welcome to OSYS!',
        { reason: 'New user welcome credits' }
      );
    }
  } catch (error) {
    console.error('Error initializing user credits:', error);
  }
}

/**
 * Migrate existing users to new credit system
 * Ensures users have credits field initialized
 */
export async function migrateUserToNewCreditSystem(
  userId: string,
  existingCredits: number = 10
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return;
    
    const userData = userSnap.data();
    
    // Only migrate if user doesn't have new credits field
    if (userData.credits === undefined) {
      const settings = await getMonetizationSettings();
      const welcomeCredits = settings?.welcomeCredits ?? 10;
      
      // Give them the higher of: their existing credits, or welcome credits
      const startingCredits = Math.max(existingCredits, welcomeCredits);
      
      await updateDoc(userRef, {
        credits: startingCredits,
        lifetimeCreditsEarned: startingCredits,
        lifetimeCreditsSpent: 0,
        lifetimeCreditsGifted: 0,
        lifetimeCreditsReceived: 0,
        featureUsage: {},
      });
      
      // Log the migration as a transaction
      const txRef = doc(collection(db, 'users', userId, 'creditTransactions'));
      await setDoc(txRef, {
        userId,
        type: 'welcome',
        amount: startingCredits,
        balance: startingCredits,
        description: 'Credit system migration - welcome credits',
        metadata: { reason: 'System migration to unified credits' },
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error migrating user credits:', error);
  }
}

export default {
  getMonetizationSettings,
  saveMonetizationSettings,
  getUserCreditState,
  getUserCreditBalance,
  addCredits,
  deductCredits,
  giftCredits,
  canUseFeature,
  useFeature,
  redeemPromoCode,
  getCreditTransactions,
  adminAdjustCredits,
  addUserToPilotProgram,
  removeUserFromPilotProgram,
  initializeUserCredits,
  migrateUserToNewCreditSystem,
};
