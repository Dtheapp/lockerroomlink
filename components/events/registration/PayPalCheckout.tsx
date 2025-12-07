import React, { useEffect, useRef, useState } from 'react';
import { 
  loadPayPalSdk, 
  renderPayPalButtons, 
  createPayPalOrder, 
  capturePayPalOrder,
  getPayPalClientId,
  formatCurrency,
  CreateOrderRequest
} from '../../../services/paypal';

interface PayPalCheckoutProps {
  // Order details
  eventId: string;
  teamId: string;
  merchantId?: string; // Team's PayPal merchant ID
  items: {
    athleteId: string;
    athleteName: string;
    tierId: string;
    tierName: string;
    price: number;
  }[];
  promoCode?: string;
  promoDiscount: number;
  subtotal: number;
  grandTotal: number;

  // Callbacks
  onSuccess: (paypalOrderId: string, transactionId: string) => void;
  onCancel: () => void;
  onError: (error: string) => void;

  // Display options
  disabled?: boolean;
}

export const PayPalCheckout: React.FC<PayPalCheckoutProps> = ({
  eventId,
  teamId,
  merchantId,
  items,
  promoCode,
  promoDiscount,
  subtotal,
  grandTotal,
  onSuccess,
  onCancel,
  onError,
  disabled = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Internal order ID for tracking
  const orderIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initPayPal = async () => {
      try {
        // Get client ID
        const clientId = getPayPalClientId();
        if (!clientId) {
          setSdkError('PayPal is not configured. Please contact support.');
          setIsLoading(false);
          return;
        }

        // Load SDK
        await loadPayPalSdk(clientId, merchantId);

        if (!mounted || !containerRef.current) return;

        // Render buttons
        const cleanup = await renderPayPalButtons({
          container: containerRef.current,
          createOrder: async () => {
            // Create order in our backend
            const request: CreateOrderRequest = {
              eventId,
              teamId,
              items,
              promoCode,
              promoDiscount,
              subtotal,
              grandTotal
            };

            const response = await createPayPalOrder(request);
            
            if (!response.success || !response.paypalOrderId) {
              throw new Error(response.error || 'Failed to create order');
            }

            orderIdRef.current = response.orderId || null;
            return response.paypalOrderId;
          },
          onApprove: async (paypalOrderId: string) => {
            setIsProcessing(true);
            try {
              // Capture the payment
              const captureResponse = await capturePayPalOrder(
                orderIdRef.current || '',
                paypalOrderId
              );

              if (!captureResponse.success) {
                throw new Error(captureResponse.error || 'Payment capture failed');
              }

              onSuccess(paypalOrderId, captureResponse.transactionId || '');
            } catch (error) {
              onError(error instanceof Error ? error.message : 'Payment failed');
            } finally {
              setIsProcessing(false);
            }
          },
          onCancel: () => {
            orderIdRef.current = null;
            onCancel();
          },
          onError: (error) => {
            orderIdRef.current = null;
            onError(error.message || 'PayPal error occurred');
          },
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'paypal',
            height: 45
          }
        });

        cleanupRef.current = cleanup;
        setIsLoading(false);
      } catch (error) {
        if (mounted) {
          setSdkError(error instanceof Error ? error.message : 'Failed to load PayPal');
          setIsLoading(false);
        }
      }
    };

    if (!disabled && grandTotal > 0) {
      initPayPal();
    } else {
      setIsLoading(false);
    }

    return () => {
      mounted = false;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [eventId, teamId, merchantId, grandTotal, disabled]);

  // Free registration - no PayPal needed
  if (grandTotal === 0) {
    return (
      <div className="text-center p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <div className="text-green-600 dark:text-green-400 mb-2">
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-medium text-green-800 dark:text-green-200">
          Free Registration
        </p>
        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
          No payment required
        </p>
      </div>
    );
  }

  // SDK Error
  if (sdkError) {
    return (
      <div className="text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <div className="text-red-600 dark:text-red-400 mb-2">
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-medium text-red-800 dark:text-red-200">
          Payment Unavailable
        </p>
        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
          {sdkError}
        </p>
      </div>
    );
  }

  // Processing overlay
  if (isProcessing) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin w-12 h-12 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full" />
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Processing Payment...
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Please wait while we complete your transaction.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Amount summary */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">Amount to pay</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {formatCurrency(grandTotal)}
        </p>
      </div>

      {/* PayPal button container */}
      <div className={`transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading PayPal...</span>
          </div>
        ) : (
          <div ref={containerRef} className="min-h-[50px]" />
        )}
      </div>

      {/* Security notice */}
      <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Secure payment powered by PayPal
      </div>
    </div>
  );
};

export default PayPalCheckout;
