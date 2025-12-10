// =============================================================================
// DONATE MODAL
// =============================================================================
// Zero-fee donations via PayPal - direct to recipient

import React, { useState, useEffect, useCallback } from 'react';
import { X, Heart, DollarSign, User, Mail, MessageSquare, Lock, AlertCircle, ExternalLink, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { FundraisingCampaign, CreateDonationRequest } from '../types/fundraising';
import { recordDonation, formatCurrency, calculateProgress } from '../services/fundraising';
import { loadPayPalSdk, getPayPalClientId } from '../services/paypal';
import { GlassPanel, Button, Badge, ProgressBar } from './ui/OSYSComponents';
import { showToast } from '../services/toast';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: FundraisingCampaign;
  onSuccess?: () => void;
}

type Step = 'amount' | 'details' | 'payment' | 'success';

export const DonateModal: React.FC<DonateModalProps> = ({
  isOpen,
  onClose,
  campaign,
  onSuccess
}) => {
  const { user, userData } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>('amount');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [paypalButtonRendered, setPaypalButtonRendered] = useState(false);
  
  // Form state
  const [amount, setAmount] = useState<number>(2500); // In cents - default $25
  const [customAmount, setCustomAmount] = useState<string>('');
  const [platformTip, setPlatformTip] = useState<number>(0); // Optional tip to OSYS
  const [donorName, setDonorName] = useState(userData?.name || user?.displayName || '');
  const [donorEmail, setDonorEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  
  // Account creation state (for guests)
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState('');
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  
  // Success state
  const [donationResult, setDonationResult] = useState<{
    donationId: string;
    amount: number;
  } | null>(null);

  // Load PayPal SDK
  useEffect(() => {
    if (isOpen && !paypalLoaded) {
      const clientId = getPayPalClientId();
      if (!clientId) {
        console.error('PayPal client ID not configured');
        showToast('Payment system not configured', 'error');
        return;
      }
      loadPayPalSdk(clientId)
        .then(() => setPaypalLoaded(true))
        .catch(err => {
          console.error('Failed to load PayPal:', err);
          showToast('Failed to load payment system', 'error');
        });
    }
  }, [isOpen, paypalLoaded]);

  // Render PayPal buttons when on payment step
  useEffect(() => {
    if (currentStep === 'payment' && paypalLoaded && !paypalButtonRendered) {
      const container = document.getElementById('paypal-button-container');
      if (container && window.paypal) {
        // Clear existing buttons
        container.innerHTML = '';
        
        const totalAmount = amount + platformTip;
        const amountInDollars = (amount / 100).toFixed(2);
        const tipInDollars = (platformTip / 100).toFixed(2);
        
        window.paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'pill',
            label: 'paypal'
          },
          createOrder: async () => {
            try {
              // Create donation order via our Netlify function
              const response = await fetch('/.netlify/functions/create-donation-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  campaignId: campaign.id,
                  campaignTitle: campaign.title,
                  recipientPaypalEmail: campaign.paypalEmail,
                  amount: amountInDollars,
                  platformTip: platformTip > 0 ? tipInDollars : undefined,
                  donorName: isAnonymous ? 'Anonymous' : donorName,
                }),
              });
              
              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create order');
              }
              
              const data = await response.json();
              return data.orderId;
            } catch (err) {
              console.error('PayPal order creation failed:', err);
              showToast('Failed to create payment. Please try again.', 'error');
              throw err;
            }
          },
          onApprove: async (data: any) => {
            setIsProcessing(true);
            try {
              // Capture the payment via our Netlify function
              const captureResponse = await fetch('/.netlify/functions/capture-paypal-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  paypalOrderId: data.orderID,
                  orderId: data.orderID // For compatibility
                }),
              });
              
              const captureResult = await captureResponse.json();
              
              if (!captureResult.success) {
                throw new Error(captureResult.error || 'Payment capture failed');
              }
              
              // Create fan account if requested (for guests)
              let newUserId: string | null = null;
              if (!user && createAccount && password.length >= 6) {
                try {
                  const userCredential = await createUserWithEmailAndPassword(auth, donorEmail, password);
                  newUserId = userCredential.user.uid;
                  
                  // Create user document as a Fan
                  await setDoc(doc(db, 'users', newUserId), {
                    email: donorEmail,
                    name: donorName,
                    role: 'Fan',
                    credits: 10,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    createdVia: 'donation',
                    firstDonationCampaign: campaign.id
                  });
                  
                  // Send verification email
                  await sendEmailVerification(userCredential.user);
                  setCreatedUserId(newUserId);
                  showToast('Account created! Check your email to verify.', 'success');
                } catch (accountErr: any) {
                  console.error('Failed to create account:', accountErr);
                  // Don't fail the donation, just notify user
                  if (accountErr.code === 'auth/email-already-in-use') {
                    showToast('Email already has an account. Sign in next time!', 'info');
                  } else {
                    showToast('Account creation failed, but donation succeeded!', 'info');
                  }
                }
              }
              
              // Record the donation in Firestore
              const request: CreateDonationRequest = {
                campaignId: campaign.id,
                amount,
                platformTip,
                donorName: isAnonymous ? 'Anonymous' : donorName,
                donorEmail,
                isAnonymous,
                message: message.trim() || undefined
              };

              const donation = await recordDonation(
                request,
                user?.uid || newUserId || null,
                {
                  orderId: data.orderID,
                  transactionId: captureResult.transactionId || data.orderID,
                  payerEmail: undefined // Not available in this flow
                },
                {
                  title: campaign.title,
                  recipientName: campaign.teamName || campaign.athleteName || 'Recipient'
                }
              );

              setDonationResult({
                donationId: donation.id,
                amount
              });
              setCurrentStep('success');
              onSuccess?.();
            } catch (err) {
              console.error('Payment capture failed:', err);
              showToast('Payment failed. Please contact support.', 'error');
            } finally {
              setIsProcessing(false);
            }
          },
          onError: (err: any) => {
            console.error('PayPal error:', err);
            showToast('Payment error. Please try again.', 'error');
          },
          onCancel: () => {
            showToast('Payment cancelled', 'info');
          }
        }).render('#paypal-button-container');
        
        setPaypalButtonRendered(true);
      }
    }
    
    // Reset button rendered state when leaving payment step
    if (currentStep !== 'payment') {
      setPaypalButtonRendered(false);
    }
  }, [currentStep, paypalLoaded, paypalButtonRendered, amount, platformTip, campaign, donorName, donorEmail, isAnonymous, message, user?.uid, onSuccess]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setCurrentStep('amount');
        setAmount(2500);
        setCustomAmount('');
        setPlatformTip(0);
        setMessage('');
        setIsAnonymous(false);
        setDonationResult(null);
        setPaypalButtonRendered(false);
        setCreateAccount(false);
        setPassword('');
        setCreatedUserId(null);
      }, 300);
    }
  }, [isOpen]);

  const handleCustomAmount = (value: string) => {
    setCustomAmount(value);
    const cents = Math.round(parseFloat(value) * 100);
    if (!isNaN(cents) && cents >= 100) {
      setAmount(cents);
    }
  };

  const selectAmount = (cents: number) => {
    setAmount(cents);
    setCustomAmount('');
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'amount':
        return amount >= (campaign.minimumDonation || 100);
      case 'details':
        const basicValid = donorName.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail);
        // If guest wants to create account, password must be at least 6 chars
        if (!user && createAccount) {
          return basicValid && password.length >= 6;
        }
        return basicValid;
      default:
        return true;
    }
  };

  if (!isOpen) return null;

  const progress = calculateProgress(campaign.raisedAmount, campaign.goalAmount);

  const renderStep = () => {
    switch (currentStep) {
      case 'amount':
        return (
          <div className="space-y-6">
            {/* Campaign Preview */}
            <div className="flex items-center gap-4 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-2xl shrink-0">
                {campaign.coverImage ? (
                  <img src={campaign.coverImage} alt="" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  '💰'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold truncate">{campaign.title}</h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {campaign.teamName || campaign.athleteName}
                </p>
                <div className="mt-2">
                  <ProgressBar value={progress} variant="gold" className="h-1.5" />
                  <div className="flex justify-between text-xs text-zinc-500 mt-1">
                    <span>{formatCurrency(campaign.raisedAmount)} raised</span>
                    <span>{formatCurrency(campaign.goalAmount)} goal</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Amount Selection */}
            <div>
              <label className="text-sm font-medium block mb-3">Select Amount</label>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {campaign.suggestedAmounts.map(amt => (
                  <button
                    key={amt}
                    onClick={() => selectAmount(amt)}
                    className={`py-3 rounded-xl font-bold transition-all ${
                      amount === amt && !customAmount
                        ? 'bg-purple-600 text-white ring-4 ring-purple-600/30'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    ${(amt / 100).toFixed(0)}
                  </button>
                ))}
              </div>
              
              {/* Custom Amount */}
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="number"
                  value={customAmount}
                  onChange={e => handleCustomAmount(e.target.value)}
                  placeholder="Custom amount"
                  min="1"
                  step="0.01"
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-12 pr-4 py-3 text-zinc-900 dark:text-white"
                />
              </div>
              <span className="text-xs text-zinc-400 mt-1 block">
                Minimum donation: {formatCurrency(campaign.minimumDonation || 100)}
              </span>
            </div>

            {/* Optional Platform Tip */}
            {campaign.allowPlatformTip && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">💜</div>
                  <div className="flex-1">
                    <div className="font-medium">Support OSYS?</div>
                    <p className="text-sm text-purple-600 dark:text-purple-300 mb-3">
                      We charge 0% platform fees. Add an optional tip to help us keep OSYS free!
                    </p>
                    <div className="flex gap-2">
                      {[0, 200, 500, 1000].map(tip => (
                        <button
                          key={tip}
                          onClick={() => setPlatformTip(tip)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            platformTip === tip
                              ? 'bg-purple-600 text-white'
                              : 'bg-purple-100 dark:bg-purple-800/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200'
                          }`}
                        >
                          {tip === 0 ? 'No tip' : `$${(tip / 100).toFixed(0)}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Total */}
            <div className="bg-zinc-900 dark:bg-zinc-950 text-white rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Your donation</span>
                <span className="text-xl font-bold">{formatCurrency(amount)}</span>
              </div>
              {platformTip > 0 && (
                <div className="flex justify-between items-center mt-2 text-sm">
                  <span className="text-zinc-400">Platform tip</span>
                  <span>{formatCurrency(platformTip)}</span>
                </div>
              )}
              <div className="border-t border-zinc-700 mt-3 pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total</span>
                  <span className="text-2xl font-bold text-amber-400">{formatCurrency(amount + platformTip)}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'details':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">Almost there! 💪</h3>
              <p className="text-zinc-500 dark:text-zinc-400">Just need a few details</p>
            </div>

            {/* Name */}
            <div>
              <label className="text-sm font-medium block mb-2">Your Name *</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="text"
                  value={donorName}
                  onChange={e => setDonorName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-12 pr-4 py-3 text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-medium block mb-2">Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="email"
                  value={donorEmail}
                  onChange={e => setDonorEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-12 pr-4 py-3 text-zinc-900 dark:text-white"
                />
              </div>
              <span className="text-xs text-zinc-400 mt-1 block">For receipt and campaign updates</span>
            </div>

            {/* Message */}
            <div>
              <label className="text-sm font-medium block mb-2">
                Leave a Message <span className="text-zinc-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-4 top-3 w-5 h-5 text-zinc-400" />
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Good luck! We're rooting for you! 🎉"
                  rows={3}
                  maxLength={500}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-12 pr-4 py-3 text-zinc-900 dark:text-white resize-none"
                />
              </div>
            </div>

            {/* Anonymous Toggle */}
            <label className="flex items-center gap-3 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={e => setIsAnonymous(e.target.checked)}
                className="w-5 h-5 rounded accent-purple-600"
              />
              <div>
                <div className="font-medium">Donate anonymously</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  Your name won't be shown publicly (we'll still send you a receipt)
                </div>
              </div>
            </label>

            {/* Create Account Option (for guests only) */}
            {!user && (
              <div className="border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createAccount}
                    onChange={e => setCreateAccount(e.target.checked)}
                    className="w-5 h-5 rounded accent-purple-600 mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      Create a free OSYS account
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                      Follow teams, get updates on campaigns you support, and more!
                    </div>
                  </div>
                </label>
                
                {createAccount && (
                  <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-700">
                    <label className="text-sm font-medium block mb-2">Create a Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        minLength={6}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-12 pr-4 py-3 text-zinc-900 dark:text-white"
                      />
                    </div>
                    <span className="text-xs text-zinc-500 mt-1 block">
                      You'll be signed in after your donation completes
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'payment':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">Complete Payment</h3>
              <p className="text-zinc-500 dark:text-zinc-400">Secure payment via PayPal</p>
            </div>

            {/* Summary */}
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-500">Donation to</span>
                <span className="font-medium truncate ml-4">{campaign.title}</span>
              </div>
              <div className="flex justify-between items-center text-2xl font-bold">
                <span>Total</span>
                <span className="text-amber-600 dark:text-amber-400">{formatCurrency(amount + platformTip)}</span>
              </div>
            </div>

            {/* PayPal Button Container */}
            <div id="paypal-button-container" className="min-h-[150px]">
              {!paypalLoaded && (
                <div className="flex items-center justify-center h-[150px]">
                  <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {isProcessing && (
              <div className="flex items-center justify-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <div className="w-6 h-6 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                <span className="font-medium">Processing payment...</span>
              </div>
            )}

            {/* Security Note */}
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 justify-center">
              <Lock className="w-4 h-4" />
              <span>Payments are secure and go directly to the recipient</span>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-6 py-8">
            <div className="text-8xl">🎉</div>
            <div>
              <h3 className="text-2xl font-bold mb-2">Thank You!</h3>
              <p className="text-zinc-500 dark:text-zinc-400">
                Your donation of <strong className="text-amber-600">{formatCurrency(donationResult?.amount || amount)}</strong> has been sent!
              </p>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-4 max-w-sm mx-auto">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <Heart className="w-5 h-5 fill-current" />
                <span className="font-medium">You're making dreams come true!</span>
              </div>
            </div>

            {/* Account created message */}
            {createdUserId && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 max-w-sm mx-auto">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <UserPlus className="w-5 h-5" />
                  <span className="font-medium">Account created!</span>
                </div>
                <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                  Check your email to verify your account and start following teams.
                </p>
              </div>
            )}

            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              A receipt has been sent to <strong>{donorEmail}</strong>
            </div>

            <div className="flex gap-3 justify-center">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button variant="primary" onClick={() => {
                // Share functionality
                if (navigator.share) {
                  navigator.share({
                    title: `I just donated to: ${campaign.title}`,
                    text: `Support this campaign on OSYS!`,
                    url: window.location.href
                  });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  showToast('Link copied to clipboard!', 'success');
                }
              }}>
                Share Campaign
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        {currentStep !== 'success' && (
          <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-6 relative shrink-0">
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/20 hover:bg-black/30 rounded-full p-1.5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-6 h-6 text-white" />
              <Badge className="bg-white/20 text-white border-none">0% Platform Fee</Badge>
            </div>
            <h2 className="text-2xl font-bold text-white">Make a Donation</h2>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderStep()}
        </div>

        {/* Footer - Navigation */}
        {currentStep !== 'success' && currentStep !== 'payment' && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shrink-0">
            <div className="flex gap-2">
              {currentStep !== 'amount' && (
                <Button 
                  variant="ghost" 
                  onClick={() => setCurrentStep(currentStep === 'details' ? 'amount' : 'details')}
                >
                  Back
                </Button>
              )}
              
              <div className="flex-1" />
              
              <Button 
                variant="gold" 
                onClick={() => setCurrentStep(currentStep === 'amount' ? 'details' : 'payment')}
                disabled={!canProceed()}
              >
                {currentStep === 'amount' ? 'Continue' : 'Proceed to Payment'}
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'payment' && !isProcessing && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shrink-0">
            <Button variant="ghost" onClick={() => setCurrentStep('details')} className="w-full">
              Back to Details
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DonateModal;
