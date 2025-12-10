// =============================================================================
// USE CREDITS HOOK - Check if user can use a feature and handle credit deduction
// Uses userData.credits from AuthContext as primary source (real-time)
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
  const [fetchedBalance, setFetchedBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<MonetizationSettings | null>(null);
  
  // Primary source: userData.credits from real-time listener
  // Fallback: fetchedBalance from direct Firestore query
  const balance = userData?.credits ?? fetchedBalance ?? 0;
  
  // Load settings and fallback balance
  useEffect(() => {
    const load = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      
      try {
        // Always load monetization settings
        const monetization = await getMonetizationSettings();
        setSettings(monetization);
        
        // Only fetch balance directly if userData.credits is not available
        if (userData?.credits === undefined) {
          const bal = await getUserCreditBalance(user.uid);
          setFetchedBalance(bal);
        }
      } catch (err) {
        console.error('Error loading credits:', err);
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, [user?.uid, userData?.credits]);
  
  // Refresh balance (for after transactions)
  const refreshBalance = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const bal = await getUserCreditBalance(user.uid);
      setFetchedBalance(bal);
    } catch (err) {
      console.error('Error refreshing balance:', err);
    }
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
