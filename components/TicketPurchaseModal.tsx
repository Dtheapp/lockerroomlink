// Ticket Purchase Modal
// =====================
// Complete checkout flow for buying event tickets with PayPal

import React, { useState, useEffect, useRef } from 'react';
import { GlassCard, Button, Badge } from './ui/OSYSComponents';
import { 
  createTicketOrder, 
  captureTicketPayment,
  sendTicketEmail,
  calculateProcessingFee,
  calculateGrandTotal,
  formatTicketPrice,
  getAppleWalletPassUrl,
  getGoogleWalletPassUrl
} from '../services/tickets';
import { loadPayPalSdk, getPayPalClientId, renderPayPalButtons } from '../services/paypal';
import { Ticket } from '../types/tickets';

interface TicketPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  ticketConfigId: string;
  ticketPrice: number; // In cents
  ticketsAvailable: number;
  tierName?: string;
  theme?: 'light' | 'dark';
}

type PurchaseStep = 'select' | 'info' | 'payment' | 'processing' | 'success';

export const TicketPurchaseModal: React.FC<TicketPurchaseModalProps> = ({
  isOpen,
  onClose,
  teamId,
  teamName,
  eventId,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  ticketConfigId,
  ticketPrice,
  ticketsAvailable,
  tierName = 'General Admission',
  theme = 'dark'
}) => {
  // State
  const [step, setStep] = useState<PurchaseStep>('select');
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const paypalCleanupRef = useRef<(() => void) | null>(null);

  // Calculations
  const subtotal = ticketPrice * quantity;
  const processingFee = calculateProcessingFee(subtotal, quantity);
  const grandTotal = calculateGrandTotal(subtotal, quantity);
  const maxQuantity = Math.min(10, ticketsAvailable);

  // Theme styles
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'rgba(26, 26, 46, 0.98)' : 'rgba(255, 255, 255, 0.98)';
  const textColor = isDark ? '#fff' : '#1a1a2e';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? 'rgba(251, 191, 36, 0.3)' : 'rgba(26, 26, 46, 0.2)';
  const inputBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  // Load PayPal SDK
  useEffect(() => {
    if (step === 'payment' && !paypalLoaded) {
      const clientId = getPayPalClientId();
      if (clientId) {
        loadPayPalSdk(clientId)
          .then(() => setPaypalLoaded(true))
          .catch(err => setError('Failed to load payment system'));
      }
    }
  }, [step, paypalLoaded]);

  // Render PayPal buttons when on payment step
  useEffect(() => {
    if (step === 'payment' && paypalLoaded && paypalContainerRef.current && orderId) {
      // Cleanup previous buttons
      if (paypalCleanupRef.current) {
        paypalCleanupRef.current();
      }

      renderPayPalButtons({
        container: paypalContainerRef.current,
        createOrder: async () => {
          // Order already created, return PayPal order ID
          const response = await fetch('/.netlify/functions/create-ticket-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              teamId,
              eventId,
              ticketConfigId,
              buyerEmail,
              buyerName,
              items: [{ tierName, quantity, priceEach: ticketPrice }],
              subtotal,
              processingFee,
              grandTotal
            })
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.error);
          return result.paypalOrderId;
        },
        onApprove: async (paypalOrderId) => {
          setStep('processing');
          try {
            const result = await captureTicketPayment(orderId, paypalOrderId);
            if (!result.success) {
              setError(result.error || 'Payment failed');
              setStep('payment');
              return;
            }
            
            // Get tickets
            if (result.tickets) {
              setTickets(result.tickets);
            }

            // Send email
            await sendTicketEmail(orderId, {
              eventTitle,
              eventDate,
              eventTime,
              eventLocation,
              teamName
            });

            setStep('success');
          } catch (err) {
            setError('Payment processing failed');
            setStep('payment');
          }
        },
        onCancel: () => {
          setError('Payment cancelled');
        },
        onError: (err) => {
          setError('Payment error. Please try again.');
          console.error('PayPal error:', err);
        },
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'pay',
          height: 50
        }
      }).then(cleanup => {
        paypalCleanupRef.current = cleanup;
      });
    }

    return () => {
      if (paypalCleanupRef.current) {
        paypalCleanupRef.current();
      }
    };
  }, [step, paypalLoaded, orderId]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setQuantity(1);
      setBuyerName('');
      setBuyerEmail('');
      setBuyerPhone('');
      setError('');
      setOrderId(null);
      setTickets([]);
    }
  }, [isOpen]);

  // Handlers
  const handleContinueToInfo = () => {
    if (quantity < 1 || quantity > maxQuantity) {
      setError(`Please select 1-${maxQuantity} tickets`);
      return;
    }
    setError('');
    setStep('info');
  };

  const handleContinueToPayment = async () => {
    if (!buyerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!buyerEmail.trim() || !buyerEmail.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    
    setError('');
    setIsLoading(true);

    try {
      const result = await createTicketOrder({
        teamId,
        eventId,
        ticketConfigId,
        buyerEmail: buyerEmail.toLowerCase().trim(),
        buyerName: buyerName.trim(),
        buyerPhone: buyerPhone.trim() || undefined,
        items: [{ tierName, quantity, priceEach: ticketPrice }],
        subtotal,
        processingFee,
        grandTotal
      });

      if (!result.success) {
        setError(result.error || 'Failed to create order');
        setIsLoading(false);
        return;
      }

      setOrderId(result.orderId || null);
      setStep('payment');
    } catch (err) {
      setError('Failed to create order');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToWallet = async (type: 'apple' | 'google') => {
    if (tickets.length === 0) return;
    
    const getPassUrl = type === 'apple' ? getAppleWalletPassUrl : getGoogleWalletPassUrl;
    const passUrl = await getPassUrl(tickets[0].id);
    
    if (passUrl) {
      window.open(passUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  const styles: Record<string, React.CSSProperties> = {
    overlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    },
    modal: {
      background: bgColor,
      borderRadius: '20px',
      border: `1px solid ${borderColor}`,
      maxWidth: '480px',
      width: '100%',
      maxHeight: '90vh',
      overflow: 'auto',
      position: 'relative'
    },
    header: {
      padding: '1.5rem',
      borderBottom: `1px solid ${borderColor}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    },
    headerTitle: {
      margin: 0,
      fontSize: '1.25rem',
      fontWeight: 600,
      color: textColor
    },
    headerSubtitle: {
      margin: '0.25rem 0 0',
      fontSize: '0.875rem',
      color: mutedColor
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      fontSize: '1.5rem',
      cursor: 'pointer',
      color: mutedColor,
      padding: 0,
      lineHeight: 1
    },
    content: {
      padding: '1.5rem'
    },
    eventInfo: {
      background: isDark ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.15)',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '1.5rem'
    },
    eventTitle: {
      fontSize: '1rem',
      fontWeight: 600,
      color: '#fbbf24',
      margin: 0
    },
    eventDetail: {
      fontSize: '0.875rem',
      color: mutedColor,
      margin: '0.25rem 0 0'
    },
    label: {
      display: 'block',
      fontSize: '0.875rem',
      fontWeight: 500,
      color: textColor,
      marginBottom: '0.5rem'
    },
    input: {
      width: '100%',
      padding: '0.75rem 1rem',
      borderRadius: '10px',
      border: `1px solid ${borderColor}`,
      background: inputBg,
      color: textColor,
      fontSize: '1rem',
      marginBottom: '1rem',
      outline: 'none',
      boxSizing: 'border-box'
    },
    quantityRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      marginBottom: '1.5rem'
    },
    quantityBtn: {
      width: '40px',
      height: '40px',
      borderRadius: '10px',
      border: `1px solid ${borderColor}`,
      background: inputBg,
      color: textColor,
      fontSize: '1.25rem',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    quantityValue: {
      fontSize: '1.5rem',
      fontWeight: 600,
      color: textColor,
      minWidth: '3rem',
      textAlign: 'center' as const
    },
    priceRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.5rem 0',
      borderBottom: `1px solid ${borderColor}`
    },
    priceLabel: {
      color: mutedColor,
      fontSize: '0.875rem'
    },
    priceValue: {
      color: textColor,
      fontSize: '0.875rem',
      fontWeight: 500
    },
    totalRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 0',
      marginTop: '0.5rem'
    },
    totalLabel: {
      color: textColor,
      fontSize: '1rem',
      fontWeight: 600
    },
    totalValue: {
      color: '#fbbf24',
      fontSize: '1.25rem',
      fontWeight: 700
    },
    error: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '10px',
      padding: '0.75rem 1rem',
      color: '#ef4444',
      fontSize: '0.875rem',
      marginBottom: '1rem'
    },
    paypalContainer: {
      marginTop: '1rem'
    },
    successIcon: {
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #10b981, #059669)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 1.5rem',
      fontSize: '2.5rem'
    },
    successTitle: {
      textAlign: 'center' as const,
      fontSize: '1.5rem',
      fontWeight: 700,
      color: textColor,
      margin: '0 0 0.5rem'
    },
    successSubtitle: {
      textAlign: 'center' as const,
      color: mutedColor,
      fontSize: '0.875rem',
      margin: '0 0 1.5rem'
    },
    ticketCard: {
      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '1rem',
      border: `1px solid ${borderColor}`
    },
    ticketNumber: {
      fontFamily: 'monospace',
      fontSize: '1rem',
      fontWeight: 600,
      color: '#fbbf24',
      marginBottom: '0.25rem'
    },
    walletButtons: {
      display: 'flex',
      gap: '0.75rem',
      marginTop: '1.5rem'
    },
    walletBtn: {
      flex: 1,
      padding: '0.75rem',
      borderRadius: '10px',
      border: 'none',
      fontSize: '0.875rem',
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem'
    },
    steps: {
      display: 'flex',
      gap: '0.5rem',
      marginBottom: '1.5rem'
    },
    stepDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: borderColor
    },
    stepDotActive: {
      background: '#fbbf24'
    },
    processingSpinner: {
      width: '60px',
      height: '60px',
      border: '4px solid rgba(251, 191, 36, 0.2)',
      borderTop: '4px solid #fbbf24',
      borderRadius: '50%',
      margin: '2rem auto',
      animation: 'spin 1s linear infinite'
    }
  };

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && step !== 'processing' && onClose()}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.headerTitle}>🎟️ Buy Tickets</h2>
            <p style={styles.headerSubtitle}>{teamName}</p>
          </div>
          {step !== 'processing' && (
            <button style={styles.closeBtn} onClick={onClose}>×</button>
          )}
        </div>

        <div style={styles.content}>
          {/* Progress Steps */}
          <div style={styles.steps}>
            <div style={{ ...styles.stepDot, ...(step !== 'select' ? {} : styles.stepDotActive) }} />
            <div style={{ ...styles.stepDot, ...(step === 'info' ? styles.stepDotActive : {}) }} />
            <div style={{ ...styles.stepDot, ...(step === 'payment' ? styles.stepDotActive : {}) }} />
            <div style={{ ...styles.stepDot, ...(step === 'success' ? styles.stepDotActive : {}) }} />
          </div>

          {/* Event Info */}
          {step !== 'success' && step !== 'processing' && (
            <div style={styles.eventInfo}>
              <h3 style={styles.eventTitle}>{eventTitle}</h3>
              <p style={styles.eventDetail}>📅 {eventDate} at {eventTime}</p>
              <p style={styles.eventDetail}>📍 {eventLocation}</p>
            </div>
          )}

          {/* Error */}
          {error && <div style={styles.error}>⚠️ {error}</div>}

          {/* Step: Select Quantity */}
          {step === 'select' && (
            <>
              <label style={styles.label}>How many tickets?</label>
              <div style={styles.quantityRow}>
                <button 
                  style={styles.quantityBtn} 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span style={styles.quantityValue}>{quantity}</span>
                <button 
                  style={styles.quantityBtn} 
                  onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                  disabled={quantity >= maxQuantity}
                >
                  +
                </button>
                <span style={{ color: mutedColor, fontSize: '0.875rem' }}>
                  {ticketsAvailable} available
                </span>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={styles.priceRow}>
                  <span style={styles.priceLabel}>{tierName} × {quantity}</span>
                  <span style={styles.priceValue}>{formatTicketPrice(subtotal)}</span>
                </div>
                <div style={styles.priceRow}>
                  <span style={styles.priceLabel}>Processing fee</span>
                  <span style={styles.priceValue}>{formatTicketPrice(processingFee)}</span>
                </div>
                <div style={styles.totalRow}>
                  <span style={styles.totalLabel}>Total</span>
                  <span style={styles.totalValue}>{formatTicketPrice(grandTotal)}</span>
                </div>
              </div>

              <Button variant="gold" style={{ width: '100%' }} onClick={handleContinueToInfo}>
                Continue
              </Button>
            </>
          )}

          {/* Step: Buyer Info */}
          {step === 'info' && (
            <>
              <label style={styles.label}>Your Name *</label>
              <input
                type="text"
                style={styles.input}
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="John Smith"
              />

              <label style={styles.label}>Email Address *</label>
              <input
                type="email"
                style={styles.input}
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder="john@example.com"
              />
              <p style={{ fontSize: '0.75rem', color: mutedColor, marginTop: '-0.75rem', marginBottom: '1rem' }}>
                Tickets will be sent to this email
              </p>

              <label style={styles.label}>Phone (optional)</label>
              <input
                type="tel"
                style={styles.input}
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="outline" style={{ flex: 1 }} onClick={() => setStep('select')}>
                  Back
                </Button>
                <Button 
                  variant="gold" 
                  style={{ flex: 2 }} 
                  onClick={handleContinueToPayment}
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating Order...' : `Pay ${formatTicketPrice(grandTotal)}`}
                </Button>
              </div>
            </>
          )}

          {/* Step: Payment */}
          {step === 'payment' && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <div style={styles.priceRow}>
                  <span style={styles.priceLabel}>{quantity} ticket(s)</span>
                  <span style={styles.priceValue}>{formatTicketPrice(subtotal)}</span>
                </div>
                <div style={styles.priceRow}>
                  <span style={styles.priceLabel}>Processing fee</span>
                  <span style={styles.priceValue}>{formatTicketPrice(processingFee)}</span>
                </div>
                <div style={styles.totalRow}>
                  <span style={styles.totalLabel}>Total</span>
                  <span style={styles.totalValue}>{formatTicketPrice(grandTotal)}</span>
                </div>
              </div>

              <p style={{ fontSize: '0.875rem', color: mutedColor, textAlign: 'center', marginBottom: '1rem' }}>
                Complete your purchase with PayPal
              </p>

              <div ref={paypalContainerRef} style={styles.paypalContainer}>
                {!paypalLoaded && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: mutedColor }}>
                    Loading payment options...
                  </div>
                )}
              </div>

              <Button 
                variant="outline" 
                style={{ width: '100%', marginTop: '1rem' }} 
                onClick={() => setStep('info')}
              >
                ← Back
              </Button>
            </>
          )}

          {/* Step: Processing */}
          {step === 'processing' && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={styles.processingSpinner} />
              <p style={{ color: textColor, fontSize: '1rem', fontWeight: 500, margin: '1rem 0 0.5rem' }}>
                Processing your payment...
              </p>
              <p style={{ color: mutedColor, fontSize: '0.875rem', margin: 0 }}>
                Please don't close this window
              </p>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <>
              <div style={styles.successIcon}>✓</div>
              <h2 style={styles.successTitle}>You're In! 🎉</h2>
              <p style={styles.successSubtitle}>
                Your tickets have been emailed to {buyerEmail}
              </p>

              {tickets.map((ticket) => (
                <div key={ticket.id} style={styles.ticketCard}>
                  <div style={styles.ticketNumber}>{ticket.ticketNumber}</div>
                  <div style={{ fontSize: '0.875rem', color: mutedColor }}>
                    {tierName} • {eventTitle}
                  </div>
                </div>
              ))}

              <p style={{ fontSize: '0.875rem', color: mutedColor, textAlign: 'center' }}>
                Add to your phone wallet for easy access:
              </p>

              <div style={styles.walletButtons}>
                <button 
                  style={{ ...styles.walletBtn, background: '#000', color: '#fff' }}
                  onClick={() => handleAddToWallet('apple')}
                >
                   Apple Wallet
                </button>
                <button 
                  style={{ ...styles.walletBtn, background: '#4285f4', color: '#fff' }}
                  onClick={() => handleAddToWallet('google')}
                >
                  📱 Google Wallet
                </button>
              </div>

              <Button 
                variant="gold" 
                style={{ width: '100%', marginTop: '1.5rem' }} 
                onClick={onClose}
              >
                Done
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketPurchaseModal;
