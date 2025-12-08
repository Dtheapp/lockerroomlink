// =============================================================================
// CREDIT BALANCE - Display user's credit balance with buy option
// =============================================================================

import React, { useState, useEffect } from 'react';
import { Coins, Plus, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserCreditBalance } from '../../services/creditService';
import BuyCreditsModal from './BuyCreditsModal';

interface CreditBalanceProps {
  variant?: 'header' | 'card' | 'inline';
  showBuyButton?: boolean;
  className?: string;
}

const CreditBalance: React.FC<CreditBalanceProps> = ({ 
  variant = 'header', 
  showBuyButton = true,
  className = '' 
}) => {
  const { user, userData } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);
  
  useEffect(() => {
    if (user?.uid) {
      loadBalance();
    }
  }, [user?.uid, userData?.credits]);
  
  const loadBalance = async () => {
    if (!user?.uid) return;
    try {
      const bal = await getUserCreditBalance(user.uid);
      setBalance(bal);
    } catch (err) {
      console.error('Error loading credit balance:', err);
      // Fall back to userData if available
      setBalance(userData?.credits || 0);
    } finally {
      setLoading(false);
    }
  };
  
  // SuperAdmins don't need credits display
  if (userData?.role === 'SuperAdmin') return null;
  
  if (variant === 'header') {
    return (
      <>
        <div className={`flex items-center gap-2 ${className}`}>
          <button
            onClick={() => showBuyButton && setShowBuyModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg hover:border-amber-400/50 transition-all group"
            title={showBuyButton ? 'Click to buy more credits' : `${balance} credits`}
          >
            <Coins size={16} className="text-amber-400" />
            <span className="text-amber-300 font-medium">
              {loading ? '...' : balance.toLocaleString()}
            </span>
            {showBuyButton && (
              <Plus size={14} className="text-amber-400/60 group-hover:text-amber-300 transition-colors" />
            )}
          </button>
        </div>
        
        {showBuyModal && (
          <BuyCreditsModal 
            onClose={() => setShowBuyModal(false)} 
            onPurchaseComplete={loadBalance}
          />
        )}
      </>
    );
  }
  
  if (variant === 'card') {
    return (
      <>
        <div className={`bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 ${className}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Coins size={24} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Your Credits</p>
                <p className="text-2xl font-bold text-white">
                  {loading ? '...' : balance.toLocaleString()}
                </p>
              </div>
            </div>
            {showBuyButton && (
              <button
                onClick={() => setShowBuyModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg font-medium transition-all"
              >
                <Plus size={18} />
                Buy Credits
              </button>
            )}
          </div>
          
          {balance < 10 && (
            <div className="mt-3 pt-3 border-t border-amber-500/20">
              <p className="text-sm text-amber-300 flex items-center gap-2">
                <Sparkles size={14} />
                Running low! Get more credits to continue using premium features.
              </p>
            </div>
          )}
        </div>
        
        {showBuyModal && (
          <BuyCreditsModal 
            onClose={() => setShowBuyModal(false)} 
            onPurchaseComplete={loadBalance}
          />
        )}
      </>
    );
  }
  
  // Inline variant
  return (
    <span className={`inline-flex items-center gap-1 text-amber-400 ${className}`}>
      <Coins size={14} />
      {loading ? '...' : balance}
    </span>
  );
};

export default CreditBalance;
