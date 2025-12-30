/**
 * Promo Code Service
 * Handles CRUD operations for program-wide promo/discount codes
 * 
 * Collection: programs/{programId}/promoCodes/{codeId}
 * Subcollection: programs/{programId}/promoCodes/{codeId}/usages/{usageId}
 */

import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { PromoCode, PromoCodeUsage } from '../types';

// ============================================
// CREATE
// ============================================

export interface CreatePromoCodeData {
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed' | 'free';
  discountValue: number;
  usageType: 'unlimited' | 'limited' | 'single';
  maxUses?: number;
  startDate?: string;
  expirationDate?: string;
  applicableSports?: string[];
  applicableRegistrationTypes?: string[];
  minPurchaseAmount?: number;
}

export const createPromoCode = async (
  programId: string,
  data: CreatePromoCodeData,
  createdBy: string
): Promise<string> => {
  // Validate code doesn't already exist
  const existing = await getPromoCodeByCode(programId, data.code);
  if (existing) {
    throw new Error('A promo code with this code already exists');
  }

  const codeData: Omit<PromoCode, 'id'> = {
    programId,
    code: data.code.toUpperCase().trim(),
    name: data.name.trim(),
    discountType: data.discountType,
    discountValue: data.discountType === 'free' ? 100 : data.discountValue,
    usageType: data.usageType,
    usedCount: 0,
    isActive: true,
    createdBy,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
    ...(data.description ? { description: data.description.trim() } : {}),
    ...(data.usageType === 'limited' && data.maxUses ? { maxUses: data.maxUses } : {}),
    ...(data.startDate ? { startDate: data.startDate } : {}),
    ...(data.expirationDate ? { expirationDate: data.expirationDate } : {}),
    ...(data.applicableSports?.length ? { applicableSports: data.applicableSports } : {}),
    ...(data.applicableRegistrationTypes?.length ? { applicableRegistrationTypes: data.applicableRegistrationTypes } : {}),
    ...(data.minPurchaseAmount ? { minPurchaseAmount: data.minPurchaseAmount } : {})
  };

  const docRef = await addDoc(
    collection(db, 'programs', programId, 'promoCodes'),
    codeData
  );

  return docRef.id;
};

// ============================================
// READ
// ============================================

export const getPromoCode = async (
  programId: string,
  codeId: string
): Promise<PromoCode | null> => {
  const docRef = doc(db, 'programs', programId, 'promoCodes', codeId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  
  return { id: snapshot.id, ...snapshot.data() } as PromoCode;
};

export const getPromoCodeByCode = async (
  programId: string,
  code: string
): Promise<PromoCode | null> => {
  const q = query(
    collection(db, 'programs', programId, 'promoCodes'),
    where('code', '==', code.toUpperCase().trim())
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as PromoCode;
};

export const getAllPromoCodes = async (
  programId: string
): Promise<PromoCode[]> => {
  const q = query(
    collection(db, 'programs', programId, 'promoCodes'),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as PromoCode[];
};

export const getActivePromoCodes = async (
  programId: string
): Promise<PromoCode[]> => {
  const q = query(
    collection(db, 'programs', programId, 'promoCodes'),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  const now = new Date().toISOString().split('T')[0];
  
  // Filter by date validity client-side
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }) as PromoCode)
    .filter(code => {
      // Check start date
      if (code.startDate && code.startDate > now) return false;
      // Check expiration
      if (code.expirationDate && code.expirationDate < now) return false;
      // Check usage limits
      if (code.usageType === 'single' && code.usedCount >= 1) return false;
      if (code.usageType === 'limited' && code.maxUses && code.usedCount >= code.maxUses) return false;
      return true;
    });
};

// ============================================
// UPDATE
// ============================================

export interface UpdatePromoCodeData {
  name?: string;
  description?: string;
  discountType?: 'percentage' | 'fixed' | 'free';
  discountValue?: number;
  usageType?: 'unlimited' | 'limited' | 'single';
  maxUses?: number;
  isActive?: boolean;
  startDate?: string;
  expirationDate?: string;
  applicableSports?: string[];
  applicableRegistrationTypes?: string[];
  minPurchaseAmount?: number;
}

export const updatePromoCode = async (
  programId: string,
  codeId: string,
  data: UpdatePromoCodeData
): Promise<void> => {
  const docRef = doc(db, 'programs', programId, 'promoCodes', codeId);
  
  const updateData: Record<string, any> = {
    updatedAt: serverTimestamp()
  };

  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.description !== undefined) updateData.description = data.description.trim();
  if (data.discountType !== undefined) updateData.discountType = data.discountType;
  if (data.discountValue !== undefined) updateData.discountValue = data.discountValue;
  if (data.usageType !== undefined) updateData.usageType = data.usageType;
  if (data.maxUses !== undefined) updateData.maxUses = data.maxUses;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.startDate !== undefined) updateData.startDate = data.startDate;
  if (data.expirationDate !== undefined) updateData.expirationDate = data.expirationDate;
  if (data.applicableSports !== undefined) updateData.applicableSports = data.applicableSports;
  if (data.applicableRegistrationTypes !== undefined) updateData.applicableRegistrationTypes = data.applicableRegistrationTypes;
  if (data.minPurchaseAmount !== undefined) updateData.minPurchaseAmount = data.minPurchaseAmount;

  await updateDoc(docRef, updateData);
};

export const togglePromoCodeActive = async (
  programId: string,
  codeId: string,
  isActive: boolean
): Promise<void> => {
  const docRef = doc(db, 'programs', programId, 'promoCodes', codeId);
  await updateDoc(docRef, {
    isActive,
    updatedAt: serverTimestamp()
  });
};

// ============================================
// DELETE
// ============================================

export const deletePromoCode = async (
  programId: string,
  codeId: string
): Promise<void> => {
  // Delete the promo code (usages subcollection will remain for audit trail)
  const docRef = doc(db, 'programs', programId, 'promoCodes', codeId);
  await deleteDoc(docRef);
};

// ============================================
// USAGE / VALIDATION
// ============================================

export interface ValidateCodeResult {
  valid: boolean;
  code?: PromoCode;
  error?: string;
  discountAmount?: number;
  finalAmount?: number;
}

export const validatePromoCode = async (
  programId: string,
  codeString: string,
  originalAmount: number,
  sport?: string,
  registrationType?: string
): Promise<ValidateCodeResult> => {
  const code = await getPromoCodeByCode(programId, codeString);
  
  if (!code) {
    return { valid: false, error: 'Invalid promo code' };
  }

  // Check if active
  if (!code.isActive) {
    return { valid: false, error: 'This promo code is no longer active' };
  }

  // Check date validity
  const now = new Date().toISOString().split('T')[0];
  if (code.startDate && code.startDate > now) {
    return { valid: false, error: 'This promo code is not yet valid' };
  }
  if (code.expirationDate && code.expirationDate < now) {
    return { valid: false, error: 'This promo code has expired' };
  }

  // Check usage limits
  if (code.usageType === 'single' && code.usedCount >= 1) {
    return { valid: false, error: 'This promo code has already been used' };
  }
  if (code.usageType === 'limited' && code.maxUses && code.usedCount >= code.maxUses) {
    return { valid: false, error: 'This promo code has reached its usage limit' };
  }

  // Check minimum purchase
  if (code.minPurchaseAmount && originalAmount < code.minPurchaseAmount) {
    return { valid: false, error: `Minimum purchase of $${code.minPurchaseAmount} required` };
  }

  // Check sport restriction
  if (code.applicableSports?.length && sport) {
    if (!code.applicableSports.includes(sport)) {
      return { valid: false, error: 'This promo code is not valid for this sport' };
    }
  }

  // Check registration type restriction
  if (code.applicableRegistrationTypes?.length && registrationType) {
    if (!code.applicableRegistrationTypes.includes(registrationType)) {
      return { valid: false, error: 'This promo code is not valid for this type of registration' };
    }
  }

  // Calculate discount
  let discountAmount = 0;
  if (code.discountType === 'free' || code.discountType === 'percentage') {
    discountAmount = Math.round((originalAmount * code.discountValue) / 100 * 100) / 100;
  } else if (code.discountType === 'fixed') {
    discountAmount = Math.min(code.discountValue, originalAmount);
  }

  const finalAmount = Math.max(0, originalAmount - discountAmount);

  return {
    valid: true,
    code,
    discountAmount,
    finalAmount
  };
};

export const usePromoCode = async (
  programId: string,
  codeId: string,
  usageData: Omit<PromoCodeUsage, 'id' | 'usedAt'>
): Promise<string> => {
  const batch = writeBatch(db);

  // Increment usage count
  const codeRef = doc(db, 'programs', programId, 'promoCodes', codeId);
  batch.update(codeRef, {
    usedCount: increment(1),
    lastUsedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // Record usage
  const usageRef = doc(collection(db, 'programs', programId, 'promoCodes', codeId, 'usages'));
  batch.set(usageRef, {
    ...usageData,
    usedAt: serverTimestamp()
  });

  await batch.commit();

  return usageRef.id;
};

// ============================================
// USAGE HISTORY
// ============================================

export const getPromoCodeUsages = async (
  programId: string,
  codeId: string
): Promise<PromoCodeUsage[]> => {
  const q = query(
    collection(db, 'programs', programId, 'promoCodes', codeId, 'usages'),
    orderBy('usedAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as PromoCodeUsage[];
};

// ============================================
// BULK OPERATIONS
// ============================================

export interface GenerateCodesOptions {
  prefix?: string;
  count: number;
  discountType: 'percentage' | 'fixed' | 'free';
  discountValue: number;
  name: string;
}

export const generateBulkSingleUseCodes = async (
  programId: string,
  options: GenerateCodesOptions,
  createdBy: string
): Promise<string[]> => {
  const { prefix = '', count, discountType, discountValue, name } = options;
  const generatedCodes: string[] = [];

  const batch = writeBatch(db);
  const collectionRef = collection(db, 'programs', programId, 'promoCodes');

  for (let i = 0; i < count; i++) {
    // Generate unique code
    const uniquePart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `${prefix}${uniquePart}`.toUpperCase();

    const codeData: Omit<PromoCode, 'id'> = {
      programId,
      code,
      name: `${name} #${i + 1}`,
      discountType,
      discountValue: discountType === 'free' ? 100 : discountValue,
      usageType: 'single',
      usedCount: 0,
      isActive: true,
      createdBy,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp
    };

    const docRef = doc(collectionRef);
    batch.set(docRef, codeData);
    generatedCodes.push(code);
  }

  await batch.commit();

  return generatedCodes;
};

// Helper to format discount display
export const formatDiscount = (code: PromoCode): string => {
  if (code.discountType === 'free') {
    return 'FREE';
  } else if (code.discountType === 'percentage') {
    return `${code.discountValue}% OFF`;
  } else {
    return `$${code.discountValue} OFF`;
  }
};

// Helper to get code status
export const getCodeStatus = (code: PromoCode): 'active' | 'inactive' | 'expired' | 'exhausted' => {
  if (!code.isActive) return 'inactive';
  
  const now = new Date().toISOString().split('T')[0];
  if (code.expirationDate && code.expirationDate < now) return 'expired';
  
  if (code.usageType === 'single' && code.usedCount >= 1) return 'exhausted';
  if (code.usageType === 'limited' && code.maxUses && code.usedCount >= code.maxUses) return 'exhausted';
  
  return 'active';
};
