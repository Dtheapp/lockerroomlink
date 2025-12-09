// =============================================================================
// USE CREDITS HOOK - Check if user can use a feature and handle credit deduction
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  canUseFeature, 
  useFeature, 
  getUserCreditBalance,
  getMonetizationSettings 
} from '../services/creditService';
import type { CreditFeatureType, FeaturePricing, MonetizationSettings } from '../types/credits';

interface UseCreditsResult {
  balance: number;
  loading: boolean;
  checkFeature: (feature: CreditFeatureType) => Promise<{
    canUse: boolean;
    reason?: string;
    creditsRequired?: number;
    freeUsesRemaining?: number;
    isFree?: boolean;
  }>;
  consumeFeature: (feature: CreditFeatureType, metadata?: Record<string, any>) => Promise<boolean>;
  refreshBalance: () => Promise<void>;
  getFeaturePricing: (feature: CreditFeatureType) => FeaturePricing | undefined;
  isFreePeriod: boolean;
  freePeriodMessage?: string;
}

export const useCredits = (): UseCreditsResult => {
  const { user, userData } = useAuth();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<MonetizationSettings | null>(null);
  
  // Load balance and settings
  useEffect(() => {
    const load = async () => {
      if (!user?.uid) {
        console.log('[useCredits] No user.uid, skipping load');
        setLoading(false);
        return;
      }
      
      console.log('[useCredits] Loading balance for user:', user.uid);
      
      try {
        const [bal, monetization] = await Promise.all([
          getUserCreditBalance(user.uid),
          getMonetizationSettings(),
        ]);
        console.log('[useCredits] Loaded balance:', bal);
        setBalance(bal);
        setSettings(monetization);
      } catch (err) {
        console.error('Error loading credits:', err);
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, [user?.uid]);
  
  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!user?.uid) return;
    console.log('[useCredits] Refreshing balance for user:', user.uid);
    const bal = await getUserCreditBalance(user.uid);
    console.log('[useCredits] Refreshed balance:', bal);
    setBalance(bal);
  }, [user?.uid]);
  
  // Check if user can use a feature
  const checkFeature = useCallback(async (feature: CreditFeatureType) => {
    if (!user?.uid) {
      return { canUse: false, reason: 'Not logged in' };
    }
    
    // SuperAdmins bypass everything
    if (userData?.role === 'SuperAdmin') {
      return { canUse: true, isFree: true };
    }
    
    return canUseFeature(user.uid, feature);
  }, [user?.uid, userData?.role]);
  
  // Consume a feature (deduct credits)
  const consumeFeature = useCallback(async (
    feature: CreditFeatureType, 
    metadata?: { itemName?: string; itemId?: string }
  ): Promise<boolean> => {
    if (!user?.uid) return false;
    
    // SuperAdmins bypass everything
    if (userData?.role === 'SuperAdmin') {
      return true;
    }
    
    try {
      await useFeature(user.uid, feature, metadata?.itemName, metadata?.itemId);
      await refreshBalance();
      return true;
    } catch (err) {
      console.error('Error consuming feature:', err);
      return false;
    }
  }, [user?.uid, userData?.role, refreshBalance]);
  
  // Get pricing for a feature
  const getFeaturePricing = useCallback((feature: CreditFeatureType): FeaturePricing | undefined => {
    return settings?.featurePricing.find(f => f.featureType === feature);
  }, [settings]);
  
  // Check if free period is active
  const isFreePeriod = settings?.freePeriod?.enabled && 
    (!settings.freePeriod.validUntil || new Date(settings.freePeriod.validUntil as any) > new Date());
  
  return {
    balance,
    loading,
    checkFeature,
    consumeFeature,
    refreshBalance,
    getFeaturePricing,
    isFreePeriod: !!isFreePeriod,
    freePeriodMessage: isFreePeriod ? settings?.freePeriod?.message : undefined,
  };
};

export default useCredits;
