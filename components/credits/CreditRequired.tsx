// =============================================================================
// CREDIT REQUIRED - Component that wraps premium features with credit check
// =============================================================================

import React, { useState, useEffect } from 'react';
import { Coins, Lock, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
import { useCredits } from '../../hooks/useCredits';
import type { CreditFeatureType } from '../../types/credits';
import BuyCreditsModal from './BuyCreditsModal';

interface CreditRequiredProps {
  feature: CreditFeatureType;
  children: React.ReactNode;
  onAction?: () => void | Promise<void>;
  buttonText?: string;
  buttonClassName?: string;
  showCost?: boolean;
  disabled?: boolean;
}

/**
 * Wraps a button/action that requires credits.
 * Shows credit cost and handles the check + deduction flow.
 * 
 * Usage:
 * <CreditRequired feature="design_clone_play" onAction={handleClone}>
 *   <button>Clone Play</button>
 * </CreditRequired>
 * 
 * Or as a button:
 * <CreditRequired 
 *   feature="design_clone_play" 
 *   onAction={handleClone}
 *   buttonText="Clone Play"
 *   buttonClassName="px-4 py-2 bg-orange-600 text-white rounded-lg"
 * />
 */
const CreditRequired: React.FC<CreditRequiredProps> = ({
  feature,
  children,
  onAction,
  buttonText,
  buttonClassName = 'px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium transition-colors',
  showCost = true,
  disabled = false,
}) => {
  const { balance, checkFeature, consumeFeature, getFeaturePricing, isFreePeriod, freePeriodMessage } = useCredits();
  const [checking, setChecking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [featureCheck, setFeatureCheck] = useState<{
    canUse: boolean;
    reason?: string;
    creditsRequired?: number;
    freeUsesRemaining?: number;
    isFree?: boolean;
  } | null>(null);
  
  const pricing = getFeaturePricing(feature);
  
  // Check feature availability on mount
  useEffect(() => {
    const check = async () => {
      setChecking(true);
      const result = await checkFeature(feature);
      setFeatureCheck(result);
      setChecking(false);
    };
    check();
  }, [feature, balance]);
  
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled || processing) return;
    
    // Re-check before action
    const check = await checkFeature(feature);
    
    if (!check.canUse) {
      if (check.reason === 'Insufficient credits') {
        setShowBuyModal(true);
      }
      return;
    }
    
    setProcessing(true);
    
    try {
      // Consume the feature (deduct credits if needed)
      const success = await consumeFeature(feature);
      
      if (success && onAction) {
        await onAction();
      }
    } finally {
      setProcessing(false);
    }
  };
  
  // Determine what to show
  const isFree = featureCheck?.isFree || featureCheck?.freeUsesRemaining && featureCheck.freeUsesRemaining > 0;
  const cost = pricing?.creditsPerUse || 0;
  
  // Render as wrapper if children provided
  if (children && !buttonText) {
    return (
      <>
        <div onClick={handleClick} className="cursor-pointer">
          {React.Children.map(children, child => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<any>, {
                disabled: disabled || processing || checking,
              });
            }
            return child;
          })}
        </div>
        
        {showBuyModal && (
          <BuyCreditsModal 
            onClose={() => setShowBuyModal(false)}
            onPurchaseComplete={() => setShowBuyModal(false)}
          />
        )}
      </>
    );
  }
  
  // Render as button
  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled || processing || checking}
        className={`${buttonClassName} flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {processing ? (
          <Loader2 size={16} className="animate-spin" />
        ) : checking ? (
          <Loader2 size={16} className="animate-spin" />
        ) : !featureCheck?.canUse ? (
          <Lock size={16} />
        ) : null}
        
        {buttonText || 'Continue'}
        
        {showCost && !processing && !checking && (
          <>
            {isFreePeriod ? (
              <span className="flex items-center gap-1 ml-1 text-green-400 text-xs">
                <Sparkles size={12} />
                Free
              </span>
            ) : isFree ? (
              <span className="text-green-400 text-xs ml-1">
                ({featureCheck?.freeUsesRemaining} free left)
              </span>
            ) : cost > 0 ? (
              <span className="flex items-center gap-1 ml-1 text-amber-400 text-xs">
                <Coins size={12} />
                {cost}
              </span>
            ) : null}
          </>
        )}
      </button>
      
      {showBuyModal && (
        <BuyCreditsModal 
          onClose={() => setShowBuyModal(false)}
          onPurchaseComplete={() => setShowBuyModal(false)}
        />
      )}
    </>
  );
};

/**
 * Simple indicator showing cost of a feature
 */
export const CreditCost: React.FC<{ feature: CreditFeatureType; className?: string }> = ({ 
  feature, 
  className = '' 
}) => {
  const { getFeaturePricing, isFreePeriod } = useCredits();
  const pricing = getFeaturePricing(feature);
  
  if (!pricing || !pricing.enabled) return null;
  
  if (isFreePeriod) {
    return (
      <span className={`inline-flex items-center gap-1 text-green-400 text-xs ${className}`}>
        <Sparkles size={12} />
        Free during promo
      </span>
    );
  }
  
  if (pricing.creditsPerUse === 0) return null;
  
  return (
    <span className={`inline-flex items-center gap-1 text-amber-400 text-xs ${className}`}>
      <Coins size={12} />
      {pricing.creditsPerUse} credit{pricing.creditsPerUse !== 1 ? 's' : ''}
    </span>
  );
};

export default CreditRequired;
