// PayPal Integration Service
// ===========================
// Handles PayPal Checkout SDK integration for team registration payments
// Uses PayPal's Partner/Platform model where teams connect their own PayPal accounts

import { TeamPaymentSettings } from '../types/events';

// PayPal SDK types
declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

interface PayPalNamespace {
  Buttons: (config: PayPalButtonsConfig) => PayPalButtonsInstance;
  FUNDING: {
    PAYPAL: string;
    CARD: string;
    VENMO: string;
  };
}

interface PayPalButtonsInstance {
  render: (container: string | HTMLElement) => Promise<void>;
  close: () => void;
  isEligible: () => boolean;
}

interface PayPalButtonsConfig {
  style?: PayPalButtonStyle;
  fundingSource?: string;
  createOrder: () => Promise<string>;
  onApprove: (data: PayPalApproveData) => Promise<void>;
  onCancel?: () => void;
  onError?: (error: Error) => void;
}

interface PayPalButtonStyle {
  layout?: 'vertical' | 'horizontal';
  color?: 'gold' | 'blue' | 'silver' | 'black' | 'white';
  shape?: 'rect' | 'pill';
  label?: 'paypal' | 'checkout' | 'buynow' | 'pay';
  height?: number;
}

interface PayPalApproveData {
  orderID: string;
  payerID?: string;
  facilitatorAccessToken?: string;
}

// Order creation request/response types
export interface CreateOrderRequest {
  eventId: string;
  teamId: string;
  items: {
    athleteId: string;
    athleteName: string;
    tierId: string;
    tierName: string;
    price: number; // in cents
  }[];
  promoCode?: string;
  promoDiscount: number; // in cents
  subtotal: number; // in cents
  grandTotal: number; // in cents
}

export interface CreateOrderResponse {
  success: boolean;
  orderId?: string;
  paypalOrderId?: string;
  error?: string;
}

export interface CaptureOrderResponse {
  success: boolean;
  transactionId?: string;
  status?: string;
  error?: string;
}

// =============================================================================
// PAYPAL SDK LOADER
// =============================================================================

let sdkLoadPromise: Promise<void> | null = null;

/**
 * Load PayPal SDK dynamically
 * @param clientId - PayPal Client ID (from environment)
 * @param merchantId - Optional merchant ID for partner transactions
 */
export const loadPayPalSdk = (clientId: string, merchantId?: string): Promise<void> => {
  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  if (window.paypal) {
    return Promise.resolve();
  }

  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    
    // Build SDK URL with parameters
    const params = new URLSearchParams({
      'client-id': clientId,
      currency: 'USD',
      intent: 'capture',
      'disable-funding': 'credit,paylater', // Disable credit/paylater for youth sports
    });

    // Add merchant ID for partner transactions
    if (merchantId) {
      params.set('merchant-id', merchantId);
    }

    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;

    script.onload = () => {
      if (window.paypal) {
        resolve();
      } else {
        reject(new Error('PayPal SDK loaded but paypal object not found'));
      }
    };

    script.onerror = () => {
      sdkLoadPromise = null;
      reject(new Error('Failed to load PayPal SDK'));
    };

    document.head.appendChild(script);
  });

  return sdkLoadPromise;
};

// =============================================================================
// ORDER MANAGEMENT
// =============================================================================

/**
 * Create a PayPal order via backend
 * This calls our Netlify function which creates the order server-side
 */
export const createPayPalOrder = async (request: CreateOrderRequest): Promise<CreateOrderResponse> => {
  try {
    const response = await fetch('/.netlify/functions/create-paypal-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || 'Failed to create order',
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
};

/**
 * Capture a PayPal order (complete the payment)
 * Called after buyer approves the payment
 */
export const capturePayPalOrder = async (
  orderId: string,
  paypalOrderId: string
): Promise<CaptureOrderResponse> => {
  try {
    const response = await fetch('/.netlify/functions/capture-paypal-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId, paypalOrderId }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || 'Failed to capture payment',
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
};

// =============================================================================
// BUTTON RENDERING
// =============================================================================

export interface RenderPayPalButtonsOptions {
  container: string | HTMLElement;
  createOrder: () => Promise<string>;
  onApprove: (paypalOrderId: string) => Promise<void>;
  onCancel?: () => void;
  onError?: (error: Error) => void;
  style?: PayPalButtonStyle;
}

/**
 * Render PayPal checkout buttons
 * Returns a cleanup function to remove the buttons
 */
export const renderPayPalButtons = async (
  options: RenderPayPalButtonsOptions
): Promise<() => void> => {
  if (!window.paypal) {
    throw new Error('PayPal SDK not loaded. Call loadPayPalSdk first.');
  }

  const buttons = window.paypal.Buttons({
    style: options.style || {
      layout: 'vertical',
      color: 'gold',
      shape: 'rect',
      label: 'paypal',
      height: 45,
    },
    createOrder: options.createOrder,
    onApprove: async (data) => {
      await options.onApprove(data.orderID);
    },
    onCancel: options.onCancel,
    onError: options.onError,
  });

  await buttons.render(options.container);

  return () => {
    buttons.close();
  };
};

// =============================================================================
// TEAM PAYPAL CONNECTION (Partner Referrals)
// =============================================================================

export interface PartnerReferralResponse {
  success: boolean;
  actionUrl?: string; // URL to redirect team to for PayPal signup/connection
  trackingId?: string;
  error?: string;
}

/**
 * Generate a partner referral link for a team to connect their PayPal
 * Uses PayPal's Partner Referrals API
 */
export const generatePartnerReferral = async (
  teamId: string,
  teamName: string,
  coachEmail: string
): Promise<PartnerReferralResponse> => {
  try {
    const response = await fetch('/.netlify/functions/paypal-partner-referral', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ teamId, teamName, coachEmail }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || 'Failed to generate referral link',
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
};

/**
 * Check if a team has completed PayPal onboarding
 */
export const checkPayPalOnboardingStatus = async (
  teamId: string,
  trackingId: string
): Promise<{ connected: boolean; merchantId?: string; email?: string }> => {
  try {
    const response = await fetch(`/.netlify/functions/paypal-onboarding-status?teamId=${teamId}&trackingId=${trackingId}`);
    
    if (!response.ok) {
      return { connected: false };
    }

    return await response.json();
  } catch {
    return { connected: false };
  }
};

// =============================================================================
// REFUNDS
// =============================================================================

export interface RefundRequest {
  orderId: string;
  transactionId: string;
  amount?: number; // in cents, omit for full refund
  reason?: string;
}

export interface RefundResponse {
  success: boolean;
  refundId?: string;
  status?: string;
  error?: string;
}

/**
 * Process a refund for a registration
 */
export const processRefund = async (request: RefundRequest): Promise<RefundResponse> => {
  try {
    const response = await fetch('/.netlify/functions/process-paypal-refund', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || 'Failed to process refund',
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
};

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Format cents to display currency
 */
export const formatCurrency = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

/**
 * Check if PayPal is available/loaded
 */
export const isPayPalAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!window.paypal;
};

/**
 * Get PayPal Client ID from environment
 */
export const getPayPalClientId = (): string => {
  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
  if (!clientId) {
    console.warn('PayPal Client ID not configured. Set VITE_PAYPAL_CLIENT_ID environment variable.');
    return '';
  }
  return clientId;
};

export default {
  loadPayPalSdk,
  createPayPalOrder,
  capturePayPalOrder,
  renderPayPalButtons,
  generatePartnerReferral,
  checkPayPalOnboardingStatus,
  processRefund,
  formatCurrency,
  isPayPalAvailable,
  getPayPalClientId,
};
