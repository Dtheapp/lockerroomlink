// =============================================================================
// MONETIZATION SETTINGS - SuperAdmin control panel for credits system
// =============================================================================

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  CreditCard,
  DollarSign,
  Settings,
  Save,
  RefreshCw,
  Shield,
  Gift,
  Zap,
  Users,
  Tag,
  ToggleLeft,
  ToggleRight,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Wallet,
  Sparkles,
} from 'lucide-react';
import type {
  MonetizationSettings as MonetizationSettingsType,
  CreditBundle,
  FeaturePricing,
  PromoCode,
  PilotProgram,
  PaymentSettings,
} from '../../types/credits';

import {
  DEFAULT_MONETIZATION_SETTINGS,
  DEFAULT_BUNDLES,
  DEFAULT_FEATURE_PRICING,
  DEFAULT_PAYMENT_SETTINGS,
} from '../../types/credits';

// Tab type
type SettingsTab = 'payment' | 'bundles' | 'features' | 'promos' | 'pilots';

const MonetizationSettings: React.FC = () => {
  const { userData } = useAuth();
  
  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('payment');
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // Settings state
  const [creditsEnabled, setCreditsEnabled] = useState(true);
  const [welcomeCredits, setWelcomeCredits] = useState(10);
  const [payment, setPayment] = useState<PaymentSettings>({
    primary: { clientId: '', enabled: false, successfulTransactions: 0, failedTransactions: 0 },
    secondary: { clientId: '', enabled: false, successfulTransactions: 0, failedTransactions: 0 },
    failover: { autoEnabled: true, retryPrimaryAfterHours: 24, currentlyUsingBackup: false, notifyAdminOnFailover: true },
  });
  const [bundles, setBundles] = useState<CreditBundle[]>([]);
  const [featurePricing, setFeaturePricing] = useState<FeaturePricing[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [pilotPrograms, setPilotPrograms] = useState<PilotProgram[]>([]);
  const [freePeriod, setFreePeriod] = useState({ enabled: false, message: '', validUntil: '' });
  
  // Load settings
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const docRef = doc(db, 'settings', 'monetization');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as MonetizationSettingsType;
        setCreditsEnabled(data.creditsEnabled ?? true);
        setWelcomeCredits(data.welcomeCredits ?? 10);
        setPayment(data.payment ?? DEFAULT_PAYMENT_SETTINGS);
        setBundles(data.bundles ?? DEFAULT_BUNDLES);
        setFeaturePricing(data.featurePricing ?? DEFAULT_FEATURE_PRICING);
        setPromoCodes(data.promoCodes ?? []);
        setPilotPrograms(data.pilotPrograms ?? []);
        if (data.freePeriod) {
          setFreePeriod({
            enabled: data.freePeriod.enabled,
            message: data.freePeriod.message,
            validUntil: data.freePeriod.validUntil?.toDate?.()?.toISOString().split('T')[0] ?? '',
          });
        }
      } else {
        // Initialize with defaults
        setBundles(DEFAULT_BUNDLES);
        setFeaturePricing(DEFAULT_FEATURE_PRICING);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };
  
  const saveSettings = async () => {
    setSaving(true);
    setError('');
    setSaveSuccess(false);
    
    try {
      const docRef = doc(db, 'settings', 'monetization');
      await setDoc(docRef, {
        creditsEnabled,
        welcomeCredits,
        payment,
        bundles,
        featurePricing,
        promoCodes,
        pilotPrograms,
        freePeriod: {
          enabled: freePeriod.enabled,
          message: freePeriod.message,
          validUntil: freePeriod.validUntil ? new Date(freePeriod.validUntil) : null,
        },
        lastUpdatedBy: userData?.uid,
        lastUpdatedAt: serverTimestamp(),
      });
      
      setSaveSuccess(true);
      setHasChanges(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };
  
  // Tab navigation
  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'payment', label: 'Payment', icon: <CreditCard size={18} /> },
    { id: 'bundles', label: 'Credit Bundles', icon: <Wallet size={18} /> },
    { id: 'features', label: 'Feature Pricing', icon: <Zap size={18} /> },
    { id: 'promos', label: 'Promo Codes', icon: <Gift size={18} /> },
    { id: 'pilots', label: 'Pilot Programs', icon: <Users size={18} /> },
  ];
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Monetization Settings</h1>
            <p className="text-sm text-slate-400">Manage credits, pricing, and promotions</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-2 text-green-400 text-sm">
              <Check size={16} /> Saved!
            </span>
          )}
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            Save Changes
          </button>
        </div>
      </div>
      
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
          <AlertTriangle className="text-red-400" size={20} />
          <span className="text-red-300">{error}</span>
        </div>
      )}
      
      {/* Global Controls */}
      <div className="bg-zinc-900/80 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Credit System</h3>
              <p className="text-sm text-slate-400">Enable or disable the entire credit system</p>
            </div>
          </div>
          <button
            onClick={() => { setCreditsEnabled(!creditsEnabled); setHasChanges(true); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              creditsEnabled 
                ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                : 'bg-zinc-800 text-slate-400 border border-zinc-700'
            }`}
          >
            {creditsEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            {creditsEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-6">
          <div>
            <label className="text-sm text-slate-400">Welcome Credits for New Users</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                value={welcomeCredits}
                onChange={(e) => { setWelcomeCredits(parseInt(e.target.value) || 0); setHasChanges(true); }}
                className="w-24 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                min="0"
              />
              <span className="text-slate-400">credits</span>
            </div>
          </div>
          
          <div className="flex-1">
            <label className="text-sm text-slate-400 flex items-center gap-2">
              <Sparkles size={14} className="text-yellow-400" />
              Free Period (Bypass all credit checks)
            </label>
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() => { setFreePeriod(p => ({ ...p, enabled: !p.enabled })); setHasChanges(true); }}
                className={`px-3 py-2 rounded-lg text-sm ${
                  freePeriod.enabled 
                    ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/30' 
                    : 'bg-zinc-800 text-slate-400 border border-zinc-700'
                }`}
              >
                {freePeriod.enabled ? 'Active' : 'Inactive'}
              </button>
              {freePeriod.enabled && (
                <>
                  <input
                    type="date"
                    value={freePeriod.validUntil}
                    onChange={(e) => { setFreePeriod(p => ({ ...p, validUntil: e.target.value })); setHasChanges(true); }}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                  />
                  <input
                    type="text"
                    value={freePeriod.message}
                    onChange={(e) => { setFreePeriod(p => ({ ...p, message: e.target.value })); setHasChanges(true); }}
                    placeholder="Promo message..."
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-orange-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="bg-zinc-900/80 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        {activeTab === 'payment' && (
          <PaymentSettingsPanel 
            payment={payment} 
            setPayment={(p) => { setPayment(p); setHasChanges(true); }} 
          />
        )}
        
        {activeTab === 'bundles' && (
          <BundlesPanel 
            bundles={bundles} 
            setBundles={(b) => { setBundles(b); setHasChanges(true); }} 
          />
        )}
        
        {activeTab === 'features' && (
          <FeaturePricingPanel 
            features={featurePricing} 
            setFeatures={(f) => { setFeaturePricing(f); setHasChanges(true); }} 
          />
        )}
        
        {activeTab === 'promos' && (
          <PromoCodesPanel 
            promoCodes={promoCodes} 
            setPromoCodes={(p) => { setPromoCodes(p); setHasChanges(true); }} 
            userId={userData?.uid || ''}
          />
        )}
        
        {activeTab === 'pilots' && (
          <PilotProgramsPanel 
            pilots={pilotPrograms} 
            setPilots={(p) => { setPilotPrograms(p); setHasChanges(true); }} 
            userId={userData?.uid || ''}
          />
        )}
      </div>
    </div>
  );
};

// =============================================================================
// PAYMENT SETTINGS PANEL
// =============================================================================

const PaymentSettingsPanel: React.FC<{
  payment: PaymentSettings;
  setPayment: (p: PaymentSettings) => void;
}> = ({ payment, setPayment }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CreditCard size={20} className="text-orange-400" />
          PayPal Configuration
        </h3>
        <p className="text-sm text-slate-400 mb-6">
          Configure primary and backup PayPal accounts for credit purchases. 
          The system will automatically failover to the backup if the primary fails.
        </p>
      </div>
      
      {/* Primary PayPal */}
      <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-white flex items-center gap-2">
            <Shield size={16} className="text-green-400" />
            Primary PayPal
          </h4>
          <button
            onClick={() => setPayment({
              ...payment,
              primary: { ...payment.primary, enabled: !payment.primary.enabled }
            })}
            className={`px-3 py-1 rounded text-sm ${
              payment.primary.enabled 
                ? 'bg-green-600/20 text-green-400' 
                : 'bg-zinc-700 text-slate-400'
            }`}
          >
            {payment.primary.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-400">Client ID</label>
            <input
              type="text"
              value={payment.primary.clientId}
              onChange={(e) => setPayment({
                ...payment,
                primary: { ...payment.primary, clientId: e.target.value }
              })}
              placeholder="PayPal Client ID"
              className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400">Secret (stored securely)</label>
            <input
              type="password"
              placeholder="••••••••••••"
              className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white"
            />
            <p className="text-xs text-slate-500 mt-1">Secret is encrypted and stored securely</p>
          </div>
        </div>
        
        {payment.primary.successfulTransactions > 0 && (
          <div className="mt-3 flex gap-4 text-sm">
            <span className="text-green-400">✓ {payment.primary.successfulTransactions} successful</span>
            {payment.primary.failedTransactions > 0 && (
              <span className="text-red-400">✗ {payment.primary.failedTransactions} failed</span>
            )}
          </div>
        )}
      </div>
      
      {/* Secondary PayPal */}
      <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-white flex items-center gap-2">
            <Shield size={16} className="text-yellow-400" />
            Secondary PayPal (Backup)
          </h4>
          <button
            onClick={() => setPayment({
              ...payment,
              secondary: { ...payment.secondary, enabled: !payment.secondary.enabled }
            })}
            className={`px-3 py-1 rounded text-sm ${
              payment.secondary.enabled 
                ? 'bg-yellow-600/20 text-yellow-400' 
                : 'bg-zinc-700 text-slate-400'
            }`}
          >
            {payment.secondary.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-400">Client ID</label>
            <input
              type="text"
              value={payment.secondary.clientId}
              onChange={(e) => setPayment({
                ...payment,
                secondary: { ...payment.secondary, clientId: e.target.value }
              })}
              placeholder="Backup PayPal Client ID"
              className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400">Secret (stored securely)</label>
            <input
              type="password"
              placeholder="••••••••••••"
              className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white"
            />
          </div>
        </div>
      </div>
      
      {/* Failover Settings */}
      <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
        <h4 className="font-medium text-white mb-4">Failover Settings</h4>
        
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={payment.failover.autoEnabled}
              onChange={(e) => setPayment({
                ...payment,
                failover: { ...payment.failover, autoEnabled: e.target.checked }
              })}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-orange-500"
            />
            <span className="text-slate-300">Auto-failover to backup on primary error</span>
          </label>
          
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={payment.failover.notifyAdminOnFailover}
              onChange={(e) => setPayment({
                ...payment,
                failover: { ...payment.failover, notifyAdminOnFailover: e.target.checked }
              })}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-orange-500"
            />
            <span className="text-slate-300">Notify admin when failover activates</span>
          </label>
          
          <div className="flex items-center gap-3">
            <span className="text-slate-300">Retry primary after</span>
            <input
              type="number"
              value={payment.failover.retryPrimaryAfterHours}
              onChange={(e) => setPayment({
                ...payment,
                failover: { ...payment.failover, retryPrimaryAfterHours: parseInt(e.target.value) || 24 }
              })}
              className="w-20 px-2 py-1 bg-zinc-900 border border-zinc-600 rounded text-white text-center"
              min="1"
            />
            <span className="text-slate-300">hours</span>
          </div>
          
          {payment.failover.currentlyUsingBackup && (
            <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 text-sm">
                ⚠️ Currently using backup PayPal. Primary failed at {payment.failover.backupActivatedAt?.toDate?.()?.toLocaleString() || 'unknown time'}.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// BUNDLES PANEL
// =============================================================================

const BundlesPanel: React.FC<{
  bundles: CreditBundle[];
  setBundles: (b: CreditBundle[]) => void;
}> = ({ bundles, setBundles }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const addBundle = () => {
    const newBundle: CreditBundle = {
      id: `bundle-${Date.now()}`,
      name: 'New Bundle',
      credits: 100,
      bonusCredits: 0,
      price: 9.99,
      currency: 'USD',
      enabled: true,
      sortOrder: bundles.length + 1,
    };
    setBundles([...bundles, newBundle]);
    setEditingId(newBundle.id);
  };
  
  const updateBundle = (id: string, updates: Partial<CreditBundle>) => {
    setBundles(bundles.map(b => b.id === id ? { ...b, ...updates } : b));
  };
  
  const deleteBundle = (id: string) => {
    if (confirm('Delete this bundle?')) {
      setBundles(bundles.filter(b => b.id !== id));
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Credit Bundles</h3>
          <p className="text-sm text-slate-400">Define purchasable credit packages</p>
        </div>
        <button
          onClick={addBundle}
          className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm"
        >
          <Plus size={16} /> Add Bundle
        </button>
      </div>
      
      <div className="grid gap-4">
        {bundles.sort((a, b) => a.sortOrder - b.sortOrder).map(bundle => (
          <div 
            key={bundle.id}
            className={`p-4 rounded-xl border ${
              bundle.isPopular 
                ? 'bg-orange-500/10 border-orange-500/30' 
                : bundle.isBestValue 
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-zinc-800/50 border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={bundle.name}
                  onChange={(e) => updateBundle(bundle.id, { name: e.target.value })}
                  className="bg-transparent text-white font-medium text-lg border-b border-transparent hover:border-zinc-600 focus:border-orange-500 focus:outline-none"
                />
                {bundle.isPopular && <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded">Popular</span>}
                {bundle.isBestValue && <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded">Best Value</span>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateBundle(bundle.id, { enabled: !bundle.enabled })}
                  className={`px-2 py-1 rounded text-xs ${bundle.enabled ? 'bg-green-600/20 text-green-400' : 'bg-zinc-700 text-slate-400'}`}
                >
                  {bundle.enabled ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => deleteBundle(bundle.id)} className="p-1 text-red-400 hover:bg-red-500/20 rounded">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="text-xs text-slate-500">Credits</label>
                <input
                  type="number"
                  value={bundle.credits}
                  onChange={(e) => updateBundle(bundle.id, { credits: parseInt(e.target.value) || 0 })}
                  className="w-full mt-1 px-2 py-1 bg-zinc-900 border border-zinc-600 rounded text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Bonus</label>
                <input
                  type="number"
                  value={bundle.bonusCredits}
                  onChange={(e) => updateBundle(bundle.id, { bonusCredits: parseInt(e.target.value) || 0 })}
                  className="w-full mt-1 px-2 py-1 bg-zinc-900 border border-zinc-600 rounded text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={bundle.price}
                  onChange={(e) => updateBundle(bundle.id, { price: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-2 py-1 bg-zinc-900 border border-zinc-600 rounded text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Per Credit</label>
                <div className="mt-1 px-2 py-1 bg-zinc-900/50 rounded text-slate-300">
                  ${((bundle.price / (bundle.credits + bundle.bonusCredits)) || 0).toFixed(3)}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Badge</label>
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => updateBundle(bundle.id, { isPopular: !bundle.isPopular, isBestValue: false })}
                    className={`px-2 py-1 text-xs rounded ${bundle.isPopular ? 'bg-orange-500 text-white' : 'bg-zinc-700 text-slate-400'}`}
                  >
                    Popular
                  </button>
                  <button
                    onClick={() => updateBundle(bundle.id, { isBestValue: !bundle.isBestValue, isPopular: false })}
                    className={`px-2 py-1 text-xs rounded ${bundle.isBestValue ? 'bg-green-500 text-white' : 'bg-zinc-700 text-slate-400'}`}
                  >
                    Best
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// FEATURE PRICING PANEL - Full control over which features use credits
// =============================================================================

const FEATURE_CATEGORIES = {
  design: { name: 'Design Studio', icon: '🎨', description: 'Flyer and graphic design features' },
  playbook: { name: 'Playbook', icon: '📋', description: 'Play creation and management' },
  ai: { name: 'AI Features', icon: '🤖', description: 'AI-powered assistance' },
  export: { name: 'Exports', icon: '📤', description: 'Download and export features' },
  premium: { name: 'Premium', icon: '⭐', description: 'Premium-only features' },
};

// Features that should NOT be in credit system (registration, fundraising, etc.)
const NON_CREDIT_FEATURES = ['team_registration', 'fundraising', 'basic_messaging', 'roster_management', 'schedule_view'];

const FeaturePricingPanel: React.FC<{ 
  features: FeaturePricing[]; 
  setFeatures: (f: FeaturePricing[]) => void;
}> = ({ features, setFeatures }) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFeature, setNewFeature] = useState<Partial<FeaturePricing>>({
    featureType: '' as any,
    name: '',
    description: '',
    creditsPerUse: 1,
    freeUsesPerMonth: 0,
    freeUsesPerDay: 0,
    enabled: true,
    category: 'design',
  });
  
  const addFeature = () => {
    if (!newFeature.featureType || !newFeature.name) return;
    const feature: FeaturePricing = {
      featureType: newFeature.featureType as any,
      name: newFeature.name,
      description: newFeature.description || '',
      creditsPerUse: newFeature.creditsPerUse || 1,
      freeUsesPerMonth: newFeature.freeUsesPerMonth || 0,
      freeUsesPerDay: newFeature.freeUsesPerDay || 0,
      enabled: true,
      category: newFeature.category || 'design',
    };
    setFeatures([...features, feature]);
    setShowAddModal(false);
    setNewFeature({ featureType: '' as any, name: '', description: '', creditsPerUse: 1, freeUsesPerMonth: 0, freeUsesPerDay: 0, enabled: true, category: 'design' });
  };
  
  const updateFeature = (featureType: string, updates: Partial<FeaturePricing>) => {
    setFeatures(features.map(f => f.featureType === featureType ? { ...f, ...updates } : f));
  };
  
  const deleteFeature = (featureType: string) => {
    if (confirm('Remove this feature from the credit system?')) {
      setFeatures(features.filter(f => f.featureType !== featureType));
    }
  };
  
  const filteredFeatures = filterCategory === 'all' 
    ? features 
    : features.filter(f => f.category === filterCategory);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap size={20} className="text-orange-400" />
            Feature Pricing
          </h3>
          <p className="text-sm text-slate-400">
            Control which features require credits and set pricing for each
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm"
        >
          <Plus size={16} /> Add Feature
        </button>
      </div>
      
      {/* Info box about non-credit features */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-blue-300 text-sm">
          <strong>Note:</strong> Some features are NOT part of the credit system: Team Registration, 
          Fundraising, Basic Messaging, Roster Management, and Schedule View are always free.
        </p>
      </div>
      
      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-sm ${filterCategory === 'all' ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-slate-400 hover:text-white'}`}
        >
          All ({features.length})
        </button>
        {Object.entries(FEATURE_CATEGORIES).map(([key, cat]) => {
          const count = features.filter(f => f.category === key).length;
          return (
            <button
              key={key}
              onClick={() => setFilterCategory(key)}
              className={`px-3 py-1.5 rounded-lg text-sm ${filterCategory === key ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-slate-400 hover:text-white'}`}
            >
              {cat.icon} {cat.name} ({count})
            </button>
          );
        })}
      </div>
      
      {/* Features Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-slate-400 border-b border-zinc-700">
              <th className="pb-3 px-2">Feature</th>
              <th className="pb-3 px-2">Category</th>
              <th className="pb-3 px-2 text-center">Credits/Use</th>
              <th className="pb-3 px-2 text-center">Free/Day</th>
              <th className="pb-3 px-2 text-center">Free/Month</th>
              <th className="pb-3 px-2 text-center">Status</th>
              <th className="pb-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {filteredFeatures.map(feature => (
              <tr key={feature.featureType} className="border-b border-zinc-800 hover:bg-zinc-800/30">
                <td className="py-3 px-2">
                  <div>
                    <div className="text-white font-medium">{feature.name}</div>
                    <div className="text-xs text-slate-500">{feature.featureType}</div>
                    {feature.description && (
                      <div className="text-xs text-slate-400 mt-1">{feature.description}</div>
                    )}
                  </div>
                </td>
                <td className="py-3 px-2">
                  <select
                    value={feature.category || 'design'}
                    onChange={(e) => updateFeature(feature.featureType, { category: e.target.value })}
                    className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-white"
                  >
                    {Object.entries(FEATURE_CATEGORIES).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3 px-2">
                  <input
                    type="number"
                    value={feature.creditsPerUse}
                    onChange={(e) => updateFeature(feature.featureType, { creditsPerUse: parseInt(e.target.value) || 0 })}
                    className="w-16 bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-center text-white"
                    min="0"
                  />
                </td>
                <td className="py-3 px-2">
                  <input
                    type="number"
                    value={feature.freeUsesPerDay || 0}
                    onChange={(e) => updateFeature(feature.featureType, { freeUsesPerDay: parseInt(e.target.value) || 0 })}
                    className="w-16 bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-center text-white"
                    min="0"
                  />
                </td>
                <td className="py-3 px-2">
                  <input
                    type="number"
                    value={feature.freeUsesPerMonth || 0}
                    onChange={(e) => updateFeature(feature.featureType, { freeUsesPerMonth: parseInt(e.target.value) || 0 })}
                    className="w-16 bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-center text-white"
                    min="0"
                  />
                </td>
                <td className="py-3 px-2 text-center">
                  <button
                    onClick={() => updateFeature(feature.featureType, { enabled: !feature.enabled })}
                    className={`px-2 py-1 rounded text-xs ${
                      feature.enabled 
                        ? 'bg-green-600/20 text-green-400' 
                        : 'bg-red-600/20 text-red-400'
                    }`}
                  >
                    {feature.enabled ? 'Active' : 'Disabled'}
                  </button>
                </td>
                <td className="py-3 px-2">
                  <button 
                    onClick={() => deleteFeature(feature.featureType)}
                    className="p-1.5 text-red-400 hover:bg-red-500/20 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredFeatures.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            No features in this category. Click "Add Feature" to add one.
          </div>
        )}
      </div>
      
      {/* Add Feature Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h4 className="text-lg font-semibold text-white mb-4">Add Feature to Credit System</h4>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400">Feature ID (unique key)</label>
                <input
                  type="text"
                  value={newFeature.featureType as string}
                  onChange={(e) => setNewFeature({ ...newFeature, featureType: e.target.value as any })}
                  placeholder="e.g., design_clone_play"
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400">Display Name</label>
                <input
                  type="text"
                  value={newFeature.name}
                  onChange={(e) => setNewFeature({ ...newFeature, name: e.target.value })}
                  placeholder="e.g., Clone Play Design"
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400">Description</label>
                <input
                  type="text"
                  value={newFeature.description}
                  onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                  placeholder="Brief description"
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400">Category</label>
                <select
                  value={newFeature.category}
                  onChange={(e) => setNewFeature({ ...newFeature, category: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                >
                  {Object.entries(FEATURE_CATEGORIES).map(([key, cat]) => (
                    <option key={key} value={key}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-slate-400">Credits/Use</label>
                  <input
                    type="number"
                    value={newFeature.creditsPerUse}
                    onChange={(e) => setNewFeature({ ...newFeature, creditsPerUse: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Free/Day</label>
                  <input
                    type="number"
                    value={newFeature.freeUsesPerDay}
                    onChange={(e) => setNewFeature({ ...newFeature, freeUsesPerDay: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Free/Month</label>
                  <input
                    type="number"
                    value={newFeature.freeUsesPerMonth}
                    onChange={(e) => setNewFeature({ ...newFeature, freeUsesPerMonth: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                    min="0"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-zinc-800 text-slate-300 rounded-lg hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={addFeature}
                disabled={!newFeature.featureType || !newFeature.name}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50"
              >
                Add Feature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// PROMO CODES PANEL
// =============================================================================

const PromoCodesPanel: React.FC<{ 
  promoCodes: PromoCode[]; 
  setPromoCodes: (p: PromoCode[]) => void;
  userId: string;
}> = ({ promoCodes, setPromoCodes, userId }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPromo, setNewPromo] = useState<any>({
    code: '',
    credits: 10,
    maxUses: 100,
    currentUses: 0,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    isActive: true,
  });
  
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'OSYS-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPromo({ ...newPromo, code });
  };
  
  const addPromo = () => {
    if (!newPromo.code) return;
    const promo: any = {
      id: `promo-${Date.now()}`,
      code: newPromo.code.toUpperCase(),
      credits: newPromo.credits || 10,
      maxUses: newPromo.maxUses || 100,
      currentUses: 0,
      validFrom: newPromo.validFrom ? new Date(newPromo.validFrom) : new Date(),
      validUntil: newPromo.validUntil ? new Date(newPromo.validUntil) : undefined,
      isActive: true,
      createdBy: userId,
      createdAt: new Date(),
    };
    setPromoCodes([...promoCodes, promo]);
    setShowAddModal(false);
    setNewPromo({ code: '', credits: 10, maxUses: 100, currentUses: 0, validFrom: new Date().toISOString().split('T')[0], validUntil: '', isActive: true });
  };
  
  const togglePromo = (id: string) => {
    setPromoCodes(promoCodes.map(p => p.id === id ? { ...p, isActive: !(p as any).isActive } : p));
  };
  
  const deletePromo = (id: string) => {
    if (confirm('Delete this promo code?')) {
      setPromoCodes(promoCodes.filter(p => p.id !== id));
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Gift size={20} className="text-orange-400" />
            Promo Codes
          </h3>
          <p className="text-sm text-slate-400">Create codes that grant free credits to users</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm"
        >
          <Plus size={16} /> Create Code
        </button>
      </div>
      
      <div className="grid gap-4">
        {promoCodes.map(promo => (
          <div key={promo.id} className={`p-4 rounded-xl border ${(promo as any).isActive ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-900/50 border-zinc-800 opacity-60'}`}>
            <div className="flex items-center justify-between">
              <div>
                <code className="text-xl font-mono text-orange-400">{promo.code}</code>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                  <span className="text-green-400">+{promo.credits} credits</span>
                  <span>{promo.currentUses}/{promo.maxUses || '∞'} uses</span>
                  {promo.validUntil && (
                    <span>Expires: {new Date(promo.validUntil as any).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => togglePromo(promo.id)}
                  className={`px-3 py-1 rounded text-sm ${(promo as any).isActive ? 'bg-green-600/20 text-green-400' : 'bg-zinc-700 text-slate-400'}`}
                >
                  {(promo as any).isActive ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => deletePromo(promo.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {promoCodes.length === 0 && (
          <div className="text-center py-8 text-slate-400">No promo codes yet</div>
        )}
      </div>
      
      {/* Add Promo Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h4 className="text-lg font-semibold text-white mb-4">Create Promo Code</h4>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400">Code</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={newPromo.code}
                    onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                    placeholder="PROMO-CODE"
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white font-mono"
                  />
                  <button onClick={generateCode} className="px-3 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600">
                    Generate
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Credits Granted</label>
                  <input
                    type="number"
                    value={newPromo.credits}
                    onChange={(e) => setNewPromo({ ...newPromo, credits: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                    min="1"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Max Uses (0 = unlimited)</label>
                  <input
                    type="number"
                    value={newPromo.maxUses}
                    onChange={(e) => setNewPromo({ ...newPromo, maxUses: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                    min="0"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-slate-400">Expiration Date (optional)</label>
                <input
                  type="date"
                  value={newPromo.validUntil as string}
                  onChange={(e) => setNewPromo({ ...newPromo, validUntil: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-zinc-800 text-slate-300 rounded-lg hover:bg-zinc-700">
                Cancel
              </button>
              <button onClick={addPromo} disabled={!newPromo.code} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50">
                Create Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// PILOT PROGRAMS PANEL
// =============================================================================

const PilotProgramsPanel: React.FC<{ 
  pilots: PilotProgram[]; 
  setPilots: (p: PilotProgram[]) => void;
  userId: string;
}> = ({ pilots, setPilots, userId }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPilot, setNewPilot] = useState<any>({
    name: '',
    description: '',
    features: [],
    startsAt: new Date().toISOString().split('T')[0],
    endsAt: '',
    isActive: true,
    maxParticipants: 50,
  });
  
  const addPilot = () => {
    if (!newPilot.name) return;
    const pilot: any = {
      id: `pilot-${Date.now()}`,
      name: newPilot.name,
      description: newPilot.description || '',
      features: newPilot.features || [],
      startsAt: newPilot.startsAt ? new Date(newPilot.startsAt) : new Date(),
      endsAt: newPilot.endsAt ? new Date(newPilot.endsAt) : undefined,
      isActive: true,
      maxParticipants: newPilot.maxParticipants || 50,
      currentParticipants: 0,
      createdBy: userId,
      createdAt: new Date(),
    };
    setPilots([...pilots, pilot]);
    setShowAddModal(false);
    setNewPilot({ name: '', description: '', features: [], startsAt: new Date().toISOString().split('T')[0], endsAt: '', isActive: true, maxParticipants: 50 });
  };
  
  const togglePilot = (id: string) => {
    setPilots(pilots.map(p => p.id === id ? { ...p, isActive: !(p as any).isActive } : p));
  };
  
  const deletePilot = (id: string) => {
    if (confirm('Delete this pilot program? Participants will lose free access.')) {
      setPilots(pilots.filter(p => p.id !== id));
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users size={20} className="text-orange-400" />
            Pilot Programs
          </h3>
          <p className="text-sm text-slate-400">Create programs that give users free access to features</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm"
        >
          <Plus size={16} /> New Pilot
        </button>
      </div>
      
      <div className="grid gap-4">
        {pilots.map(pilot => (
          <div key={pilot.id} className={`p-4 rounded-xl border ${(pilot as any).isActive ? 'bg-purple-500/10 border-purple-500/30' : 'bg-zinc-900/50 border-zinc-800 opacity-60'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-lg font-semibold text-white">{pilot.name}</h4>
                <p className="text-sm text-slate-400">{pilot.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => togglePilot(pilot.id)}
                  className={`px-3 py-1 rounded text-sm ${(pilot as any).isActive ? 'bg-purple-600/20 text-purple-400' : 'bg-zinc-700 text-slate-400'}`}
                >
                  {(pilot as any).isActive ? 'Active' : 'Ended'}
                </button>
                <button onClick={() => deletePilot(pilot.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span>{(pilot as any).currentParticipants || 0}/{(pilot as any).maxParticipants || '∞'} participants</span>
              {(pilot as any).endsAt && (
                <span>Ends: {new Date((pilot as any).endsAt).toLocaleDateString()}</span>
              )}
            </div>
            
            {(pilot as any).features && (pilot as any).features.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(pilot as any).features.map((f: string) => (
                  <span key={f} className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {pilots.length === 0 && (
          <div className="text-center py-8 text-slate-400">No pilot programs yet</div>
        )}
      </div>
      
      {/* Add Pilot Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h4 className="text-lg font-semibold text-white mb-4">Create Pilot Program</h4>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400">Program Name</label>
                <input
                  type="text"
                  value={newPilot.name}
                  onChange={(e) => setNewPilot({ ...newPilot, name: e.target.value })}
                  placeholder="e.g., Design Studio Beta"
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400">Description</label>
                <textarea
                  value={newPilot.description}
                  onChange={(e) => setNewPilot({ ...newPilot, description: e.target.value })}
                  placeholder="What this pilot program offers..."
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Max Participants</label>
                  <input
                    type="number"
                    value={newPilot.maxParticipants}
                    onChange={(e) => setNewPilot({ ...newPilot, maxParticipants: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">End Date</label>
                  <input
                    type="date"
                    value={newPilot.endsAt as string}
                    onChange={(e) => setNewPilot({ ...newPilot, endsAt: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-slate-400">Free Features (comma-separated)</label>
                <input
                  type="text"
                  value={(newPilot.features || []).join(', ')}
                  onChange={(e) => setNewPilot({ ...newPilot, features: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  placeholder="design_clone_play, design_trace_play"
                  className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-zinc-800 text-slate-300 rounded-lg hover:bg-zinc-700">
                Cancel
              </button>
              <button onClick={addPilot} disabled={!newPilot.name} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50">
                Create Pilot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonetizationSettings;
