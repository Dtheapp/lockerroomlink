import React, { useState, useEffect } from 'react';
import { TeamPaymentSettings } from '../../types/events';
import { 
  generatePartnerReferral, 
  checkPayPalOnboardingStatus 
} from '../../services/paypal';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface TeamPaymentSettingsUIProps {
  teamId: string;
  teamName: string;
  coachEmail: string;
  onSettingsChange?: (settings: TeamPaymentSettings) => void;
}

export const TeamPaymentSettingsUI: React.FC<TeamPaymentSettingsUIProps> = ({
  teamId,
  teamName,
  coachEmail,
  onSettingsChange
}) => {
  const [settings, setSettings] = useState<TeamPaymentSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsRef = doc(db, 'teamPaymentSettings', teamId);
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          setSettings(settingsSnap.data() as TeamPaymentSettings);
        } else {
          // Create default settings
          const defaultSettings: TeamPaymentSettings = {
            teamId,
            paypalConnected: false,
            stripeConnected: false,
            platformFeeEnabled: false,
            platformFeePercent: 0,
            platformFeeFixed: 0,
            notifyOnRegistration: true,
            notifyOnPayment: true,
            updatedAt: new Date() as any, // Will be converted to Timestamp
            updatedBy: coachEmail
          };
          setSettings(defaultSettings);
        }
      } catch (err) {
        setError('Failed to load payment settings');
        console.error('Error loading payment settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [teamId, coachEmail]);

  // Check onboarding status if we have a tracking ID
  useEffect(() => {
    if (!trackingId || settings?.paypalConnected) return;

    const checkStatus = async () => {
      const result = await checkPayPalOnboardingStatus(teamId, trackingId);
      if (result.connected && result.merchantId) {
        // Update settings with connected PayPal
        const updatedSettings = {
          ...settings!,
          paypalConnected: true,
          paypalMerchantId: result.merchantId,
          paypalEmail: result.email,
          paypalConnectedAt: Timestamp.now()
        };
        
        // Save to Firestore
        const settingsRef = doc(db, 'teamPaymentSettings', teamId);
        await setDoc(settingsRef, updatedSettings, { merge: true });
        
        setSettings(updatedSettings);
        onSettingsChange?.(updatedSettings);
        setTrackingId(null);
      }
    };

    // Poll every 5 seconds
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [trackingId, teamId, settings, onSettingsChange]);

  const handleConnectPayPal = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const result = await generatePartnerReferral(teamId, teamName, coachEmail);
      
      if (!result.success || !result.actionUrl) {
        throw new Error(result.error || 'Failed to generate PayPal connection link');
      }

      // Store tracking ID for status checks
      if (result.trackingId) {
        setTrackingId(result.trackingId);
      }

      // Open PayPal onboarding in new window
      window.open(result.actionUrl, '_blank', 'width=600,height=700');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect PayPal');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectPayPal = async () => {
    if (!settings) return;
    
    if (!confirm('Are you sure you want to disconnect PayPal? You will not be able to accept payments until you reconnect.')) {
      return;
    }

    try {
      const updatedSettings = {
        ...settings,
        paypalConnected: false,
        paypalMerchantId: undefined,
        paypalEmail: undefined,
        paypalConnectedAt: undefined,
        updatedAt: Timestamp.now()
      };

      const settingsRef = doc(db, 'teamPaymentSettings', teamId);
      await updateDoc(settingsRef, {
        paypalConnected: false,
        paypalMerchantId: null,
        paypalEmail: null,
        paypalConnectedAt: null,
        updatedAt: Timestamp.now()
      });

      setSettings(updatedSettings);
      onSettingsChange?.(updatedSettings);
    } catch (err) {
      setError('Failed to disconnect PayPal');
    }
  };

  const handleToggleNotification = async (field: 'notifyOnRegistration' | 'notifyOnPayment') => {
    if (!settings) return;

    try {
      const updatedValue = !settings[field];
      const settingsRef = doc(db, 'teamPaymentSettings', teamId);
      await updateDoc(settingsRef, {
        [field]: updatedValue,
        updatedAt: Timestamp.now()
      });

      const updatedSettings = { ...settings, [field]: updatedValue };
      setSettings(updatedSettings);
      onSettingsChange?.(updatedSettings);
    } catch (err) {
      setError('Failed to update notification settings');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Payment Settings
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Connect your PayPal account to accept registration payments
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center text-red-700 dark:text-red-300">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* PayPal Connection Status */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center">
            {/* PayPal Logo */}
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-4">
              <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944 3.72a.77.77 0 01.757-.644h6.352c2.116 0 3.87.436 5.037 1.326 1.168.89 1.689 2.175 1.502 3.704-.17 1.389-.715 2.566-1.57 3.394-.855.828-1.948 1.396-3.229 1.677-.323.07-.656.124-.996.162l.457 4.74c.068.694-.489 1.258-1.182 1.258h-4.07a.641.641 0 01-.633-.74l1.178-7.69h1.978c2.01 0 3.658-.513 4.75-1.482 1.091-.969 1.734-2.372 1.86-4.057.115-1.538-.336-2.667-1.298-3.252-.95-.578-2.271-.866-3.922-.866h-4.28L7.076 21.337z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                PayPal Business
              </h3>
              {settings?.paypalConnected ? (
                <div className="flex items-center text-sm text-green-600 dark:text-green-400 mt-1">
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Connected
                  {settings.paypalEmail && (
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      ({settings.paypalEmail})
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Not connected
                </p>
              )}
            </div>
          </div>

          {settings?.paypalConnected ? (
            <button
              onClick={handleDisconnectPayPal}
              className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnectPayPal}
              disabled={isConnecting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {isConnecting ? (
                <>
                  <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connecting...
                </>
              ) : (
                'Connect PayPal'
              )}
            </button>
          )}
        </div>

        {/* Waiting for connection notice */}
        {trackingId && !settings?.paypalConnected && (
          <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex items-center text-amber-700 dark:text-amber-300 text-sm">
              <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Waiting for PayPal connection... Complete the setup in the popup window.
            </div>
          </div>
        )}

        {/* Connection benefits */}
        {!settings?.paypalConnected && (
          <div className="mt-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Why connect PayPal?
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Accept payments directly to your account
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Parents can pay with PayPal or credit/debit cards
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Automatic athlete roster updates after payment
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                PayPal's standard processing fees apply
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Notification Settings */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Notifications
        </h3>
        
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <span className="text-gray-900 dark:text-gray-100">
                New registration notifications
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Get notified when someone registers for an event
              </p>
            </div>
            <button
              onClick={() => handleToggleNotification('notifyOnRegistration')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                settings?.notifyOnRegistration 
                  ? 'bg-blue-600' 
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                  settings?.notifyOnRegistration ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between">
            <div>
              <span className="text-gray-900 dark:text-gray-100">
                Payment notifications
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Get notified when a payment is received
              </p>
            </div>
            <button
              onClick={() => handleToggleNotification('notifyOnPayment')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                settings?.notifyOnPayment 
                  ? 'bg-blue-600' 
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                  settings?.notifyOnPayment ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Future: Platform Fee Info */}
      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
        <strong>Note:</strong> Payments go directly to your PayPal account minus PayPal's standard processing fees (typically 2.9% + $0.30 per transaction). There are no additional platform fees at this time.
      </div>
    </div>
  );
};

export default TeamPaymentSettingsUI;
