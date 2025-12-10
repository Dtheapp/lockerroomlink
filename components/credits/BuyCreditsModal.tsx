// =============================================================================
// BUY CREDITS MODAL - User-facing modal to purchase credit bundles
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, Coins, Check, Sparkles, Shield, CreditCard, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getMonetizationSettings } from '../../services/creditService';
import type { CreditBundle, MonetizationSettings } from '../../types/credits';

interface BuyCreditsModalProps {
  onClose: () => void;
  onPurchaseComplete?: () => void;
}

const BuyCreditsModal: React.FC<BuyCreditsModalProps> = ({ onClose, onPurchaseComplete }) => {
  const { user, userData } = useAuth();
  const [bundles, setBundles] = useState<CreditBundle[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<CreditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [settings, setSettings] = useState<MonetizationSettings | null>(null);
  
  useEffect(() => {
    loadBundles();
  }, []);
  
  const loadBundles = async () => {
    try {
      const monetization = await getMonetizationSettings();
      setSettings(monetization);
      const activeBundles = monetization.bundles
        .filter(b => b.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      setBundles(activeBundles);
      
      // Auto-select popular bundle
      const popular = activeBundles.find(b => b.isPopular);
      if (popular) setSelectedBundle(popular);
    } catch (err) {
      console.error('Error loading bundles:', err);
      setError('Failed to load credit packages');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePurchase = async () => {
    if (!selectedBundle || !user?.uid) return;
    
    setProcessing(true);
    setError('');
    
    try {
      // ============================================================================
      // SECURE PAYMENT FLOW - PayPal Integration Required
      // ============================================================================
      // Credit purchases are handled EXCLUSIVELY through PayPal:
      // 1. Client creates PayPal order via /api/create-credit-order
      // 2. User approves payment in PayPal
      // 3. Server captures payment via /api/capture-credit-order
      // 4. Server-side Cloud Function adds credits ONLY after verification
      //
      // SECURITY: addCredits is NEVER called from client for purchases.
      // All credit additions go through server-side verification.
      // ============================================================================
      
      // PayPal integration coming soon - show informative message
      setError('Credit purchases are coming soon! For now, new users receive 10 free credits. Contact support for more credits during the pilot period.');
      setProcessing(false);
      return;
      
      // TODO: Uncomment when PayPal is fully integrated:
      // const createOrderResponse = await fetch('/.netlify/functions/create-credit-order', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     userId: user.uid,
      //     bundleId: selectedBundle.id,
      //     credits: selectedBundle.credits,
      //     bonusCredits: selectedBundle.bonusCredits || 0,
      //     price: selectedBundle.price,
      //   }),
      // });
      // ... PayPal approval flow ...
      // ... capture-credit-order adds credits server-side ...
      
    } catch (err: any) {
      console.error('Purchase error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };
  
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-8">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
              <Coins className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Buy Credits</h2>
              <p className="text-sm text-slate-400">Choose a package that fits your needs</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        {/* Success State */}
        {success ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Purchase Successful!</h3>
            <p className="text-slate-400">
              {selectedBundle && (
                <>
                  {selectedBundle.credits + (selectedBundle.bonusCredits || 0)} credits have been added to your account.
                </>
              )}
            </p>
          </div>
        ) : (
          <>
            {/* Bundles Grid */}
            <div className="p-6">
              {error && (
                <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-3">
                  <AlertTriangle className="text-red-400" size={20} />
                  <span className="text-red-300">{error}</span>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bundles.map(bundle => (
                  <button
                    key={bundle.id}
                    onClick={() => setSelectedBundle(bundle)}
                    className={`relative p-5 rounded-xl border-2 text-left transition-all ${
                      selectedBundle?.id === bundle.id
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                    }`}
                  >
                    {/* Badge */}
                    {bundle.isPopular && (
                      <span className="absolute -top-2 left-4 px-2 py-0.5 bg-orange-500 text-white text-xs font-medium rounded">
                        Most Popular
                      </span>
                    )}
                    {bundle.isBestValue && (
                      <span className="absolute -top-2 left-4 px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded">
                        Best Value
                      </span>
                    )}
                    
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{bundle.name}</h3>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-3xl font-bold text-white">{bundle.credits}</span>
                          {bundle.bonusCredits > 0 && (
                            <span className="text-green-400 font-medium">+{bundle.bonusCredits} bonus</span>
                          )}
                          <span className="text-slate-400 ml-1">credits</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-orange-400">${bundle.price}</span>
                        <p className="text-xs text-slate-500">
                          ${((bundle.price / (bundle.credits + (bundle.bonusCredits || 0)))).toFixed(3)}/credit
                        </p>
                      </div>
                    </div>
                    
                    {/* Selection indicator */}
                    {selectedBundle?.id === bundle.id && (
                      <div className="absolute top-3 right-3 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              
              {/* Promo Code */}
              <div className="mt-6 pt-6 border-t border-zinc-800">
                <label className="text-sm text-slate-400 flex items-center gap-2">
                  <Sparkles size={14} className="text-amber-400" />
                  Have a promo code?
                </label>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-slate-500"
                  />
                  <button className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors">
                    Apply
                  </button>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <Shield size={16} className="text-green-400" />
                  <span>Secure payment via PayPal</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePurchase}
                    disabled={!selectedBundle || processing}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard size={18} />
                        Pay ${selectedBundle?.price || '0.00'}
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <p className="mt-3 text-xs text-slate-500 text-center">
                Credits are non-refundable. By purchasing, you agree to our terms of service.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BuyCreditsModal;
