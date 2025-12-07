import React, { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Event, PricingTier, PromoCode } from '../../../types/events';
import { SelectedAthlete } from './AthleteSelector';
import {
  ShoppingCart,
  Tag,
  X,
  Check,
  Loader2,
  AlertCircle,
  Percent,
  DollarSign,
  Trash2
} from 'lucide-react';

interface RegistrationCartProps {
  event: Event;
  selectedAthletes: SelectedAthlete[];
  onRemoveAthlete: (athleteId: string) => void;
  appliedPromoCode: PromoCode | null;
  onApplyPromoCode: (code: PromoCode | null) => void;
  onPayInPerson: boolean;
  onPayInPersonChange: (value: boolean) => void;
}

const RegistrationCart: React.FC<RegistrationCartProps> = ({
  event,
  selectedAthletes,
  onRemoveAthlete,
  appliedPromoCode,
  onApplyPromoCode,
  onPayInPerson,
  onPayInPersonChange
}) => {
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Format price
  const formatPrice = (cents: number): string => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Calculate subtotal
  const subtotal = selectedAthletes.reduce((sum, sa) => sum + sa.price, 0);

  // Calculate discount
  const calculateDiscount = (): number => {
    if (!appliedPromoCode) return 0;
    
    switch (appliedPromoCode.discountType) {
      case 'percentage':
        return Math.round(subtotal * (appliedPromoCode.discountValue / 100));
      case 'fixed':
        // Fixed amount in cents
        return Math.min(appliedPromoCode.discountValue * 100, subtotal);
      case 'free':
        return subtotal;
      default:
        return 0;
    }
  };

  const discount = calculateDiscount();
  const total = Math.max(0, subtotal - discount);

  // Validate and apply promo code
  const validatePromoCode = async () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;
    
    setValidatingCode(true);
    setPromoError(null);
    
    try {
      // Query for the promo code
      const promoQuery = query(
        collection(db, 'promoCodes'),
        where('eventId', '==', event.id),
        where('code', '==', code),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(promoQuery);
      
      if (snapshot.empty) {
        setPromoError('Invalid promo code');
        return;
      }
      
      const promoDoc = snapshot.docs[0];
      const promo = { id: promoDoc.id, ...promoDoc.data() } as PromoCode;
      
      // Check validity dates
      const now = new Date();
      const validFrom = promo.validFrom?.toDate ? promo.validFrom.toDate() : new Date(0);
      const validUntil = promo.validUntil?.toDate ? promo.validUntil.toDate() : new Date('2099-12-31');
      
      if (now < validFrom) {
        setPromoError('This code is not yet active');
        return;
      }
      
      if (now > validUntil) {
        setPromoError('This code has expired');
        return;
      }
      
      // Check usage limits
      if (promo.maxUses && promo.currentUses >= promo.maxUses) {
        setPromoError('This code has reached its usage limit');
        return;
      }
      
      // Valid! Apply the code
      onApplyPromoCode(promo);
      setPromoCodeInput('');
      
    } catch (err: any) {
      console.error('Error validating promo code:', err);
      setPromoError('Failed to validate code. Please try again.');
    } finally {
      setValidatingCode(false);
    }
  };

  // Remove applied promo code
  const removePromoCode = () => {
    onApplyPromoCode(null);
    setPromoError(null);
  };

  // Handle key press in promo input
  const handlePromoKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      validatePromoCode();
    }
  };

  if (selectedAthletes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No athletes selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cart items */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          Registration Summary
        </h4>
        
        {selectedAthletes.map(sa => (
          <div 
            key={sa.athlete.id}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {sa.athlete.name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {sa.pricingTierName}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatPrice(sa.price)}
              </span>
              <button
                onClick={() => onRemoveAthlete(sa.athlete.id)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Promo code */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Have a promo code?
        </label>
        
        {appliedPromoCode ? (
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Tag className="w-4 h-4" />
              <span className="font-medium">{appliedPromoCode.code}</span>
              <span className="text-sm">
                ({appliedPromoCode.discountType === 'percentage' 
                  ? `${appliedPromoCode.discountValue}% off`
                  : appliedPromoCode.discountType === 'free'
                    ? 'Free!'
                    : `$${appliedPromoCode.discountValue} off`
                })
              </span>
            </div>
            <button
              onClick={removePromoCode}
              className="p-1 text-green-600 hover:text-green-800 dark:hover:text-green-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCodeInput}
              onChange={(e) => {
                setPromoCodeInput(e.target.value.toUpperCase());
                setPromoError(null);
              }}
              onKeyPress={handlePromoKeyPress}
              placeholder="Enter code"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase"
            />
            <button
              onClick={validatePromoCode}
              disabled={validatingCode || !promoCodeInput.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {validatingCode ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Apply'
              )}
            </button>
          </div>
        )}
        
        {promoError && (
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {promoError}
          </p>
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>Subtotal ({selectedAthletes.length} athlete{selectedAthletes.length !== 1 ? 's' : ''})</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        
        {discount > 0 && (
          <div className="flex justify-between text-green-600 dark:text-green-400">
            <span className="flex items-center gap-1">
              <Percent className="w-4 h-4" />
              Discount
            </span>
            <span>-{formatPrice(discount)}</span>
          </div>
        )}
        
        <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
          <span>Total</span>
          <span className="text-indigo-600 dark:text-indigo-400">{formatPrice(total)}</span>
        </div>
      </div>

      {/* Pay in person option */}
      {event.allowInPersonPayment && total > 0 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={onPayInPerson}
              onChange={(e) => onPayInPersonChange(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-yellow-600 focus:ring-yellow-500"
            />
            <div>
              <span className="font-medium text-yellow-800 dark:text-yellow-300">
                Pay in Person
              </span>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                I will pay cash or check directly to the coach. 
                <strong> Note:</strong> Your registration will be pending until payment is received, 
                and your spot is not guaranteed.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Free registration notice */}
      {total === 0 && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-3">
          <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-300">
              No Payment Required
            </p>
            <p className="text-sm text-green-700 dark:text-green-400">
              This registration is free! Just complete the form to register.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistrationCart;
