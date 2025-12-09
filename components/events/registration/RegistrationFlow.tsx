import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { Event, PricingTier, PromoCode, Registration, WaiverSignature, RegistrationOrder, PaymentMethod } from '../../../types/events';
import { useAuth } from '../../../contexts/AuthContext';
import * as eventService from '../../../services/eventService';
import AthleteSelector from './AthleteSelector';
import type { SelectedAthlete } from './AthleteSelector';
import RegistrationCart from './RegistrationCart';
import RegistrationForm from './RegistrationForm';
import type { AthleteFormData } from './RegistrationForm';
import WaiverAcceptance from './WaiverAcceptance';
import { PayPalCheckout } from './PayPalCheckout';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  PartyPopper,
  Calendar,
  MapPin,
  CreditCard,
  Banknote,
  Mail,
  Clock,
  DollarSign
} from 'lucide-react';

// Registration flow steps
type RegistrationStep = 'athletes' | 'form' | 'cart' | 'waiver' | 'payment' | 'confirmation';

interface RegistrationFlowPageProps {
  // Optional props for embedded use
  eventProp?: Event;
  onComplete?: () => void;
}

/**
 * RegistrationFlow - Main registration wizard
 * 
 * This component can be used in two ways:
 * 1. As a standalone page (loads event from URL params)
 * 2. Embedded with eventProp passed in
 */
const RegistrationFlow: React.FC<RegistrationFlowPageProps> = ({ eventProp, onComplete }) => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, userData } = useAuth();

  // Data state
  const [event, setEvent] = useState<Event | null>(eventProp || null);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(!eventProp);
  const [error, setError] = useState<string | null>(null);

  // Flow state
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('athletes');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Registration data
  const [selectedAthletes, setSelectedAthletes] = useState<SelectedAthlete[]>([]);
  const [formData, setFormData] = useState<AthleteFormData[]>([]);
  const [appliedPromoCode, setAppliedPromoCode] = useState<PromoCode | null>(null);
  const [payInPerson, setPayInPerson] = useState(false);
  const [waiverSignatures, setWaiverSignatures] = useState<WaiverSignature[]>([]);
  
  // Payment Plan state
  const [usePaymentPlan, setUsePaymentPlan] = useState(false);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<string>('');
  const [paymentPlanError, setPaymentPlanError] = useState<string | null>(null);
  
  // Order result
  const [completedOrder, setCompletedOrder] = useState<RegistrationOrder | null>(null);

  // Load event data
  useEffect(() => {
    if (eventProp) {
      setEvent(eventProp);
      return;
    }

    if (!eventId) {
      setError('No event specified');
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const eventData = await eventService.getEvent(eventId);
        if (!eventData) {
          setError('Event not found');
          return;
        }
        setEvent(eventData);

        const tiers = await eventService.getPricingTiersByEvent(eventId);
        setPricingTiers(tiers);
      } catch (err) {
        console.error('Error loading event:', err);
        setError('Failed to load event details');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [eventId, eventProp]);

  // Calculate totals
  const subtotal = selectedAthletes.reduce((sum, sa) => sum + sa.price, 0);
  const discount = appliedPromoCode ? calculateDiscount(subtotal, appliedPromoCode) : 0;
  const grandTotal = Math.max(0, subtotal - discount);

  // Helper to calculate discount
  function calculateDiscount(amount: number, promo: PromoCode): number {
    switch (promo.discountType) {
      case 'percentage':
        return Math.floor((amount * promo.discountValue) / 100);
      case 'fixed':
        return promo.discountValue;
      case 'free':
        return amount;
      default:
        return 0;
    }
  }

  // Format price helper
  const formatPrice = (cents: number): string => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Step navigation
  const goToStep = (step: RegistrationStep) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'athletes':
        return selectedAthletes.length > 0 && selectedAthletes.every(sa => sa.ageValidation.isValid);
      case 'form':
        return formData.length === selectedAthletes.length && 
               formData.every(fd => fd.emergencyContact.name && fd.emergencyContact.phone);
      case 'cart':
        return selectedAthletes.length > 0;
      case 'waiver':
        return waiverSignatures.length === selectedAthletes.length;
      case 'payment':
        return !isSubmitting;
      default:
        return true;
    }
  };

  const handleNext = () => {
    const steps: RegistrationStep[] = ['athletes', 'form', 'cart', 'waiver', 'payment'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      goToStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: RegistrationStep[] = ['athletes', 'form', 'cart', 'waiver', 'payment'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      goToStep(steps[currentIndex - 1]);
    } else {
      handleCancel();
    }
  };

  const handleCancel = () => {
    if (onComplete) {
      onComplete();
    } else {
      navigate(-1);
    }
  };

  // Handle athlete removal from cart
  const handleRemoveAthlete = (athleteId: string) => {
    setSelectedAthletes(prev => prev.filter(sa => sa.athlete.id !== athleteId));
    setFormData(prev => prev.filter(fd => fd.athleteId !== athleteId));
  };

  // Handle waiver acceptance
  const handleWaiverAccept = (signatures: WaiverSignature[]) => {
    setWaiverSignatures(signatures);
    handleNext();
  };

  // Handle PayPal payment success
  const handlePayPalSuccess = async (paypalOrderId: string, transactionId: string) => {
    await completeRegistration('paypal', paypalOrderId, transactionId);
  };

  // Handle Pay in Person
  const handlePayInPerson = async () => {
    await completeRegistration('in_person');
  };

  // Handle Payment Plan submission
  const handlePaymentPlan = async () => {
    // Validate initial payment amount
    const initialAmountCents = Math.round(parseFloat(initialPaymentAmount || '0') * 100);
    const minPayment = event?.paymentPlanMinDownPayment || 100; // Default $1 minimum
    
    if (initialAmountCents < minPayment) {
      setPaymentPlanError(`Minimum initial payment is ${formatPrice(minPayment)}`);
      return;
    }
    
    if (initialAmountCents > grandTotal) {
      setPaymentPlanError(`Initial payment cannot exceed total of ${formatPrice(grandTotal)}`);
      return;
    }
    
    setPaymentPlanError(null);
    await completeRegistration('payment_plan', undefined, undefined, initialAmountCents);
  };

  // Complete the registration
  const completeRegistration = async (
    method: PaymentMethod,
    paypalOrderId?: string,
    transactionId?: string,
    initialPaymentCents?: number
  ) => {
    if (!event || !user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Determine payment status based on method
      let paymentStatus: 'pending' | 'completed' | 'partial' = 'completed';
      let totalPaid = grandTotal;
      let remainingBalance = 0;
      
      if (method === 'in_person') {
        paymentStatus = 'pending';
        totalPaid = 0;
        remainingBalance = grandTotal;
      } else if (method === 'payment_plan' && initialPaymentCents !== undefined) {
        paymentStatus = initialPaymentCents >= grandTotal ? 'completed' : 'partial';
        totalPaid = initialPaymentCents;
        remainingBalance = grandTotal - initialPaymentCents;
      }
      
      // Build order
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const order: Omit<RegistrationOrder, 'id'> = {
        eventId: event.id,
        teamId: event.teamId,
        parentUserId: user.uid,
        registrationIds: [],
        athleteCount: selectedAthletes.length,
        subtotal,
        totalDiscount: discount,
        grandTotal,
        paymentMethod: method,
        paymentStatus,
        paypalOrderId,
        paypalTransactionId: transactionId,
        paidAt: method !== 'in_person' && method !== 'payment_plan' ? Timestamp.now() : undefined,
        createdAt: Timestamp.now(),
        completedAt: paymentStatus === 'completed' ? Timestamp.now() : undefined,
        // Payment plan fields
        isPaymentPlan: method === 'payment_plan',
        totalPaid: method === 'payment_plan' ? totalPaid : (method === 'in_person' ? 0 : grandTotal),
        remainingBalance: method === 'payment_plan' ? remainingBalance : (method === 'in_person' ? grandTotal : 0),
        payments: method === 'payment_plan' && initialPaymentCents && initialPaymentCents > 0 ? [{
          id: `pmt_${Date.now()}`,
          amount: initialPaymentCents,
          paidAt: Timestamp.now(),
          paymentMethod: 'paypal', // Will update when we add actual payment processing
          recordedBy: user.uid,
          note: 'Initial payment at registration'
        }] : undefined,
        lastPaymentAt: method === 'payment_plan' && initialPaymentCents && initialPaymentCents > 0 ? Timestamp.now() : undefined,
      };

      // Build registrations
      const discountPerAthlete = selectedAthletes.length > 0 
        ? Math.floor(discount / selectedAthletes.length) 
        : 0;

      // Calculate per-athlete amounts for payment plan
      const paidPerAthlete = method === 'payment_plan' && totalPaid > 0 
        ? Math.floor(totalPaid / selectedAthletes.length) 
        : (method === 'in_person' ? 0 : undefined);

      const registrations: Omit<Registration, 'id'>[] = selectedAthletes.map((sa, index) => {
        const athleteFormData = formData.find(fd => fd.athleteId === sa.athlete.id);
        const signature = waiverSignatures.find(ws => 
          ws.athleteName === sa.athlete.name
        );
        
        const athleteFinalPrice = sa.price - discountPerAthlete;
        const athletePaid = paidPerAthlete !== undefined ? paidPerAthlete : athleteFinalPrice;
        const athleteRemaining = athleteFinalPrice - athletePaid;

        return {
          eventId: event.id,
          teamId: event.teamId,
          orderId,
          orderIndex: index + 1,
          parentUserId: user.uid,
          athleteId: sa.athlete.id,
          athleteSnapshot: {
            firstName: sa.athlete.name.split(' ')[0],
            lastName: sa.athlete.name.split(' ').slice(1).join(' ') || '',
            dateOfBirth: sa.athlete.dob,
            profileImage: sa.athlete.photoUrl
          },
          pricingTierId: sa.pricingTierId,
          originalPrice: sa.price,
          discountAmount: discountPerAthlete,
          finalPrice: athleteFinalPrice,
          promoCodeId: appliedPromoCode?.id,
          promoCodeUsed: appliedPromoCode?.code,
          paymentMethod: method,
          paymentStatus,
          paypalOrderId,
          paypalTransactionId: transactionId,
          // Payment plan fields
          isPaymentPlan: method === 'payment_plan',
          totalPaid: method === 'payment_plan' || method === 'in_person' ? athletePaid : undefined,
          remainingBalance: method === 'payment_plan' || method === 'in_person' ? athleteRemaining : undefined,
          customFieldResponses: athleteFormData?.customFieldResponses || {},
          emergencyContact: athleteFormData?.emergencyContact || {
            name: '',
            relationship: '',
            phone: ''
          },
          medicalInfo: athleteFormData?.medicalInfo,
          waiverAccepted: true,
          waiverAcceptedAt: Timestamp.now(),
          waiverSignature: signature?.signedBy,
          status: paymentStatus === 'completed' ? 'paid' : 'pending_payment',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
      });

      // Save to Firestore
      const result = await eventService.createRegistrationOrder(order, registrations);

      // Set completed order for confirmation
      setCompletedOrder({
        id: result.orderId,
        ...order,
        registrationIds: result.registrationIds,
      } as RegistrationOrder);

      // Show confirmation
      goToStep('confirmation');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render step progress indicator
  const renderStepIndicator = () => {
    const steps = [
      { key: 'athletes', label: 'Athletes' },
      { key: 'form', label: 'Info' },
      { key: 'cart', label: 'Review' },
      { key: 'waiver', label: 'Waiver' },
      { key: 'payment', label: 'Payment' },
    ];

    const currentIndex = steps.findIndex(s => s.key === currentStep);

    if (currentStep === 'confirmation') return null;

    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all
                  ${index < currentIndex 
                    ? 'bg-green-500 text-white' 
                    : index === currentIndex
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
              >
                {index < currentIndex ? (
                  <Check className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span className={`ml-2 text-sm hidden sm:inline
                ${index === currentIndex 
                  ? 'text-gray-900 dark:text-white font-medium' 
                  : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-8 sm:w-16 h-0.5 mx-2 transition-colors
                ${index < currentIndex 
                  ? 'bg-green-500' 
                  : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700 dark:text-red-400">{error || 'Event not found'}</p>
          </div>
          <button
            onClick={handleCancel}
            className="mt-4 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // Must be logged in
  if (!user) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Sign In Required
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please sign in to register for this event.
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 'athletes':
        return (
          <AthleteSelector
            event={event}
            pricingTiers={pricingTiers}
            parentId={user.uid}
            existingRegistrations={[]}
            selectedAthletes={selectedAthletes}
            onSelectionChange={setSelectedAthletes}
          />
        );

      case 'form':
        return (
          <RegistrationForm
            event={event}
            selectedAthletes={selectedAthletes}
            formData={formData}
            onFormDataChange={setFormData}
            parentInfo={userData ? {
              name: userData.name,
              phone: '',
              email: user.email || ''
            } : undefined}
          />
        );

      case 'cart':
        return (
          <RegistrationCart
            event={event}
            selectedAthletes={selectedAthletes}
            onRemoveAthlete={handleRemoveAthlete}
            appliedPromoCode={appliedPromoCode}
            onApplyPromoCode={setAppliedPromoCode}
            onPayInPerson={payInPerson}
            onPayInPersonChange={setPayInPerson}
          />
        );

      case 'waiver':
        return (
          <WaiverAcceptance
            event={event}
            teamState={event.location.state}
            athleteNames={selectedAthletes.map(sa => sa.athlete.name)}
            signerName={userData?.name || user.email || 'Parent/Guardian'}
            onAccept={handleWaiverAccept}
            onBack={handleBack}
          />
        );

      case 'payment':
        return (
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Order Summary
              </h3>
              
              <div className="space-y-3">
                {selectedAthletes.map(sa => (
                  <div key={sa.athlete.id} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {sa.athlete.name} - {sa.pricingTierName}
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatPrice(sa.price)}
                    </span>
                  </div>
                ))}
                
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                    <span className="text-gray-900 dark:text-white">{formatPrice(subtotal)}</span>
                  </div>
                  
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Discount ({appliedPromoCode?.code})</span>
                      <span>-{formatPrice(discount)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-lg font-bold mt-2">
                    <span className="text-gray-900 dark:text-white">Total</span>
                    <span className="text-orange-500">{formatPrice(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Options */}
            {grandTotal === 0 ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
                <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                  No Payment Required
                </h3>
                <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                  This registration is free!
                </p>
                <button
                  onClick={() => completeRegistration('free')}
                  disabled={isSubmitting}
                  className="mt-4 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Complete Registration'
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* PayPal Option */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <CreditCard className="w-5 h-5 text-blue-500" />
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Pay with PayPal
                    </h4>
                  </div>
                  
                  <PayPalCheckout
                    eventId={event.id}
                    teamId={event.teamId}
                    items={selectedAthletes.map(sa => ({
                      athleteId: sa.athlete.id,
                      athleteName: sa.athlete.name,
                      tierId: sa.pricingTierId,
                      tierName: sa.pricingTierName,
                      price: sa.price
                    }))}
                    promoCode={appliedPromoCode?.code}
                    promoDiscount={discount}
                    subtotal={subtotal}
                    grandTotal={grandTotal}
                    onSuccess={handlePayPalSuccess}
                    onCancel={() => {}}
                    onError={(err) => setError(err)}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Pay in Person Option */}
                {event.allowInPersonPayment && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Banknote className="w-5 h-5 text-green-500" />
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Pay in Person
                      </h4>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Reserve your spot and pay the coach directly. Your registration will be pending until payment is received.
                    </p>
                    
                    <button
                      onClick={handlePayInPerson}
                      disabled={isSubmitting}
                      className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                      ) : (
                        'Reserve & Pay Later'
                      )}
                    </button>
                  </div>
                )}

                {/* Payment Plan Option */}
                {event.allowPaymentPlan && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Clock className="w-5 h-5 text-purple-500" />
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Pay As You Go
                      </h4>
                      <span className="ml-auto text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full">
                        Payment Plan
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Start with a down payment and pay the rest before the season ends. 
                      Minimum initial payment: {formatPrice(event.paymentPlanMinDownPayment || 100)}
                    </p>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Initial Payment Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          min={(event.paymentPlanMinDownPayment || 100) / 100}
                          max={grandTotal / 100}
                          step="0.01"
                          value={initialPaymentAmount}
                          onChange={(e) => {
                            setInitialPaymentAmount(e.target.value);
                            setPaymentPlanError(null);
                          }}
                          placeholder={`${((event.paymentPlanMinDownPayment || 100) / 100).toFixed(2)} - ${(grandTotal / 100).toFixed(2)}`}
                          className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      
                      {/* Quick amount buttons */}
                      <div className="flex gap-2 mt-2">
                        {[10, 25, 50].map(percent => {
                          const amount = Math.max(
                            (event.paymentPlanMinDownPayment || 100),
                            Math.round(grandTotal * percent / 100)
                          );
                          return (
                            <button
                              key={percent}
                              type="button"
                              onClick={() => setInitialPaymentAmount((amount / 100).toFixed(2))}
                              className="px-3 py-1 text-xs rounded-full border border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                            >
                              {percent}% ({formatPrice(amount)})
                            </button>
                          );
                        })}
                      </div>
                      
                      {paymentPlanError && (
                        <p className="mt-2 text-sm text-red-500">{paymentPlanError}</p>
                      )}
                      
                      {initialPaymentAmount && parseFloat(initialPaymentAmount) > 0 && (
                        <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Initial Payment:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              ${parseFloat(initialPaymentAmount).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-gray-600 dark:text-gray-400">Remaining Balance:</span>
                            <span className="font-medium text-purple-600 dark:text-purple-400">
                              {formatPrice(Math.max(0, grandTotal - Math.round(parseFloat(initialPaymentAmount) * 100)))}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Balance due before season ends. You'll receive reminders every 30 days.
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={handlePaymentPlan}
                      disabled={isSubmitting || !initialPaymentAmount || parseFloat(initialPaymentAmount) < ((event.paymentPlanMinDownPayment || 100) / 100)}
                      className="w-full py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4" />
                          Start Payment Plan
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <p className="text-red-700 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}
          </div>
        );

      case 'confirmation':
        return (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <PartyPopper className="w-10 h-10 text-green-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Registration Complete!
            </h2>
            
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              {completedOrder?.paymentStatus === 'pending' 
                ? 'Your spot has been reserved. Please pay the coach directly.'
                : completedOrder?.paymentStatus === 'partial'
                  ? 'Your payment plan has started. You\'ll receive reminders for the remaining balance.'
                  : 'You\'re all set! A confirmation email has been sent.'}
            </p>

            {/* Payment Plan Summary */}
            {completedOrder?.isPaymentPlan && completedOrder?.remainingBalance && completedOrder.remainingBalance > 0 && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 max-w-md mx-auto mb-6 text-left">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-5 h-5 text-purple-500" />
                  <h4 className="font-medium text-purple-800 dark:text-purple-200">Payment Plan Active</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-purple-700 dark:text-purple-300">Initial Payment:</span>
                    <span className="font-medium text-purple-900 dark:text-purple-100">
                      {formatPrice(completedOrder.totalPaid || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-700 dark:text-purple-300">Remaining Balance:</span>
                    <span className="font-bold text-purple-900 dark:text-purple-100">
                      {formatPrice(completedOrder.remainingBalance)}
                    </span>
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 pt-2 border-t border-purple-200 dark:border-purple-700">
                    Pay the remaining balance before the season ends. Reminders will be sent every 30 days.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md mx-auto text-left mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Registration Details
              </h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">{event.title}</p>
                    <p className="text-gray-500">
                      {new Date(event.eventStartDate.seconds * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                {event.location.name && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <p className="text-gray-600 dark:text-gray-400">{event.location.name}</p>
                  </div>
                )}
                
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
                </div>
              </div>
              
              <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
                <p className="text-gray-500 text-xs mb-2">Registered Athletes:</p>
                <ul className="space-y-1">
                  {selectedAthletes.map(sa => (
                    <li key={sa.athlete.id} className="text-gray-900 dark:text-white">
                      {sa.athlete.name}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4 flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Paid</span>
                <span className="font-bold text-gray-900 dark:text-white">{formatPrice(grandTotal)}</span>
              </div>
            </div>

            <button
              onClick={handleCancel}
              className="px-8 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
            >
              Done
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Register for {event.title}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Complete the steps below to register
        </p>
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Step Content */}
      <div className="mb-6">
        {renderStep()}
      </div>

      {/* Navigation Buttons */}
      {currentStep !== 'confirmation' && currentStep !== 'waiver' && currentStep !== 'payment' && (
        <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            {currentStep === 'athletes' ? 'Cancel' : 'Back'}
          </button>
          
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default RegistrationFlow;
