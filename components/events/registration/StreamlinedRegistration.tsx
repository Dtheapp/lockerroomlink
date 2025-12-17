import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Event, PricingTier, Registration, WaiverSignature, RegistrationOrder, PaymentMethod } from '../../../types/events';
import { useAuth } from '../../../contexts/AuthContext';
import { Player } from '../../../types';
import * as eventService from '../../../services/eventService';
import { getPlayerRegistrationStatus } from '../../../services/eventService';
import { addToDraftPool } from '../../../services/draftPoolService';
import { createNotification } from '../../../services/notificationService';
import type { DraftPoolPaymentStatus, SportType } from '../../../types';
import { WaiverAcceptance } from './WaiverAcceptance';
import { PayPalCheckout } from './PayPalCheckout';
import { validateAthleteAge, calculateAgeGroup } from '../../../services/ageValidator';
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
  DollarSign,
  User,
  Phone,
  Heart,
  Copy,
  ChevronDown,
  Shield
} from 'lucide-react';

// Simplified registration steps
type RegistrationStep = 'form' | 'waiver' | 'payment' | 'confirmation';

// Max jersey number
const MAX_JERSEY_NUMBER = 99;

interface RegistrationFormData {
  // Athlete info (auto-filled from selected athlete)
  athleteId: string;
  athleteName: string;
  
  // Jersey preferences
  preferredJersey: string;
  alternateJersey: string;
  
  // Parent/Guardian info (auto-filled from userData)
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  
  // Emergency contact (can be same as parent)
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  
  // Medical info (only if required)
  allergies: string;
  medicalConditions: string;
  medications: string;
  medicalNotes: string;
  
  // Uniform sizes (only if required)
  shirtSize: string;
  pantSize: string;
  
  // Parent suggestions (coach/position preferences)
  parentSuggestions: string;
}

/**
 * StreamlinedRegistration - Simplified 3-step registration
 * Step 1: Athlete info + parent info (conditional fields based on requirements)
 * Step 2: Waiver (skipped if not required)
 * Step 3: Payment
 */
const StreamlinedRegistration: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, userData, players, selectedPlayer, setSelectedPlayer } = useAuth();

  // Data state
  const [event, setEvent] = useState<Event | null>(null);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flow state
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data
  const [formData, setFormData] = useState<RegistrationFormData>({
    athleteId: '',
    athleteName: '',
    preferredJersey: '',
    alternateJersey: '',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    allergies: '',
    medicalConditions: '',
    medications: '',
    medicalNotes: '',
    shirtSize: '',
    pantSize: '',
    parentSuggestions: '',
  });

  // Waiver
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [waiverSignature, setWaiverSignature] = useState<WaiverSignature | null>(null);
  
  // Payment
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  
  // Confirmation
  const [confirmationCode, setConfirmationCode] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Check if player is already in draft pool
  const [playerAlreadyRegistered, setPlayerAlreadyRegistered] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Get event requirements (default to true if not specified)
  const requirements = useMemo(() => ({
    medical: (event as any)?.requireMedicalInfo ?? true,
    emergency: (event as any)?.requireEmergencyContact ?? true,
    uniform: (event as any)?.requireUniformSizes ?? true,
    waiver: (event as any)?.requireWaiver ?? true,
  }), [event]);

  // Calculate price
  const selectedTier = pricingTiers.find(t => t.id === selectedTierId);
  const grandTotal = selectedTier?.price || 0;

  // Format price helper
  const formatPrice = (cents: number): string => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Load event data
  useEffect(() => {
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
        
        // Auto-select first tier if only one
        if (tiers.length === 1) {
          setSelectedTierId(tiers[0].id);
        } else if (tiers.length > 0) {
          // Select cheapest active tier
          const activeTiers = tiers.filter(t => t.isActive);
          if (activeTiers.length > 0) {
            const cheapest = activeTiers.reduce((min, t) => t.price < min.price ? t : min);
            setSelectedTierId(cheapest.id);
          }
        }
      } catch (err) {
        console.error('Error loading event:', err);
        setError('Failed to load event details');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [eventId]);

  // Auto-fill form when athlete/user data is available
  useEffect(() => {
    if (selectedPlayer) {
      setFormData(prev => ({
        ...prev,
        athleteId: selectedPlayer.id,
        athleteName: selectedPlayer.name || '',
        // Pre-fill from player's existing data
        shirtSize: selectedPlayer.shirtSize || prev.shirtSize,
        pantSize: selectedPlayer.pantSize || prev.pantSize,
        allergies: selectedPlayer.medical?.allergies || prev.allergies,
        medicalConditions: selectedPlayer.medical?.conditions || prev.medicalConditions,
        medications: selectedPlayer.medical?.medications || prev.medications,
      }));
    }
  }, [selectedPlayer]);

  // Auto-fill parent info from userData
  useEffect(() => {
    if (userData && user) {
      setFormData(prev => ({
        ...prev,
        parentName: userData.name || prev.parentName,
        parentEmail: user.email || prev.parentEmail,
        parentPhone: userData.phone || prev.parentPhone,
        // Also use as emergency contact by default
        emergencyContactName: prev.emergencyContactName || userData.name || '',
        emergencyContactPhone: prev.emergencyContactPhone || userData.phone || '',
        emergencyContactRelationship: prev.emergencyContactRelationship || 'Parent',
      }));
    }
  }, [userData, user]);

  // Check if player is already in draft pool for the SAME SPORT (prevent double registration)
  // Players CAN register for different sports simultaneously
  useEffect(() => {
    if (!selectedPlayer?.id || !event) {
      setPlayerAlreadyRegistered(null);
      return;
    }

    const checkStatus = async () => {
      setCheckingStatus(true);
      try {
        const eventSport = (event as any).sport || 'football';
        
        // Check if player is already on a team for THIS sport
        if (selectedPlayer.teamId) {
          const teamDoc = await getDoc(doc(db, 'teams', selectedPlayer.teamId));
          if (teamDoc.exists()) {
            const teamSport = teamDoc.data().sport || 'football';
            if (teamSport === eventSport) {
              setPlayerAlreadyRegistered(`${selectedPlayer.name} is already on a ${eventSport} team (${teamDoc.data().name || 'Unknown Team'}).`);
              setCheckingStatus(false);
              return;
            }
          }
        }
        
        // Check if player is in draft pool for THIS sport
        const playerDoc = await getDoc(doc(db, 'players', selectedPlayer.id));
        if (playerDoc.exists()) {
          const playerData = playerDoc.data();
          if (playerData.draftPoolStatus === 'waiting' && playerData.draftPoolTeamId) {
            // Check if the draft pool team is for the same sport
            const draftTeamDoc = await getDoc(doc(db, 'teams', playerData.draftPoolTeamId));
            if (draftTeamDoc.exists()) {
              const draftTeamSport = draftTeamDoc.data().sport || 'football';
              if (draftTeamSport === eventSport) {
                setPlayerAlreadyRegistered(`${selectedPlayer.name} is already registered for ${eventSport} and waiting in the draft pool for ${draftTeamDoc.data().name || 'a team'}.`);
                setCheckingStatus(false);
                return;
              }
            }
          }
        }
        
        // Also search draft pool entries directly (fallback)
        const teamsSnap = await getDocs(collection(db, 'teams'));
        for (const teamDoc of teamsSnap.docs) {
          const teamSport = teamDoc.data().sport || 'football';
          if (teamSport !== eventSport) continue; // Skip different sports
          
          const draftPoolQuery = query(
            collection(db, 'teams', teamDoc.id, 'draftPool'),
            where('playerId', '==', selectedPlayer.id),
            where('status', '==', 'waiting')
          );
          const draftSnap = await getDocs(draftPoolQuery);
          
          if (!draftSnap.empty) {
            setPlayerAlreadyRegistered(`${selectedPlayer.name} is already registered for ${eventSport} and waiting in the draft pool for ${teamDoc.data().name || 'a team'}.`);
            setCheckingStatus(false);
            return;
          }
        }
        
        // Not registered for this sport - allow registration
        setPlayerAlreadyRegistered(null);
      } catch (err) {
        console.error('Error checking player status:', err);
        setPlayerAlreadyRegistered(null);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkStatus();
  }, [selectedPlayer?.id, selectedPlayer?.teamId, selectedPlayer?.name, event]);

  // Validate age for selected athlete
  const ageValidation = useMemo(() => {
    if (!selectedPlayer?.dob || !event?.ageRequirement) {
      return { isValid: true, age: 0, message: '' };
    }
    return validateAthleteAge(selectedPlayer.dob, event.ageRequirement);
  }, [selectedPlayer?.dob, event?.ageRequirement]);

  // Check if form step is valid
  const isFormValid = useMemo(() => {
    // Must have athlete selected
    if (!formData.athleteId || !formData.athleteName) return false;
    
    // Player must not already be in draft pool
    if (playerAlreadyRegistered) return false;
    
    // Age must be valid
    if (!ageValidation.isValid) return false;
    
    return true;
  }, [formData, ageValidation, playerAlreadyRegistered]);

  // Get steps based on requirements
  const getSteps = (): RegistrationStep[] => {
    const steps: RegistrationStep[] = ['form'];
    if (requirements.waiver) {
      steps.push('waiver');
    }
    steps.push('payment');
    return steps;
  };

  const steps = getSteps();

  // Step navigation
  const goToStep = (step: RegistrationStep) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNext = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      goToStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      goToStep(steps[currentIndex - 1]);
    } else {
      navigate(-1);
    }
  };

  // Handle waiver acceptance
  const handleWaiverAccept = (signatures: WaiverSignature[]) => {
    if (signatures.length > 0) {
      setWaiverSignature(signatures[0]);
      setWaiverAccepted(true);
      handleNext();
    }
  };

  // Complete registration
  const completeRegistration = async (
    method: PaymentMethod,
    paypalOrderId?: string,
    transactionId?: string
  ) => {
    if (!event || !user || !selectedPlayer) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Build confirmation code
      const code = `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Date.now().toString(36).toUpperCase().slice(-7)}`;
      
      // Determine payment status
      let paymentStatus: 'pending' | 'completed' = method === 'in_person' ? 'pending' : 'completed';
      
      // Build order
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const order: Omit<RegistrationOrder, 'id'> = {
        eventId: event.id,
        teamId: event.teamId,
        parentUserId: user.uid,
        registrationIds: [],
        athleteCount: 1,
        subtotal: grandTotal,
        totalDiscount: 0,
        grandTotal,
        paymentMethod: method,
        paymentStatus,
        ...(paypalOrderId ? { paypalOrderId } : {}),
        ...(transactionId ? { paypalTransactionId: transactionId } : {}),
        ...(method !== 'in_person' ? { paidAt: Timestamp.now() } : {}),
        createdAt: Timestamp.now(),
        ...(paymentStatus === 'completed' ? { completedAt: Timestamp.now() } : {}),
      };

      // Build registration
      const registration: Omit<Registration, 'id'> = {
        eventId: event.id,
        teamId: event.teamId,
        orderId,
        orderIndex: 1,
        parentUserId: user.uid,
        athleteId: selectedPlayer.id,
        athleteSnapshot: {
          firstName: formData.athleteName.split(' ')[0] || '',
          lastName: formData.athleteName.split(' ').slice(1).join(' ') || '',
          dateOfBirth: selectedPlayer.dob || null,
          ...(selectedPlayer.photoUrl ? { profileImage: selectedPlayer.photoUrl } : {})
        },
        pricingTierId: selectedTierId,
        originalPrice: grandTotal,
        discountAmount: 0,
        finalPrice: grandTotal,
        paymentMethod: method,
        paymentStatus,
        ...(paypalOrderId ? { paypalOrderId } : {}),
        ...(transactionId ? { paypalTransactionId: transactionId } : {}),
        customFieldResponses: {
          preferredJersey: formData.preferredJersey,
          alternateJersey: formData.alternateJersey,
        },
        emergencyContact: {
          name: formData.emergencyContactName,
          relationship: formData.emergencyContactRelationship,
          phone: formData.emergencyContactPhone,
        },
        ...(requirements.medical ? {
          medicalInfo: {
            allergies: formData.allergies,
            conditions: formData.medicalConditions,
            medications: formData.medications,
          }
        } : {}),
        ...(requirements.uniform ? {
          uniformSizes: {
            shirt: formData.shirtSize,
            pants: formData.pantSize,
          }
        } : {}),
        waiverAccepted: waiverAccepted || !requirements.waiver,
        waiverAcceptedAt: Timestamp.now(),
        ...(waiverSignature?.signedBy ? { waiverSignature: waiverSignature.signedBy } : {}),
        status: paymentStatus === 'completed' ? 'paid' : 'pending_payment',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Save to Firestore
      const result = await eventService.createRegistrationOrder(order, [registration]);

      // Add to draft pool
      try {
        const teamRef = doc(db, 'teams', event.teamId);
        const teamSnap = await getDoc(teamRef);
        
        if (teamSnap.exists()) {
          const teamData = teamSnap.data();
          
          let draftPaymentStatus: DraftPoolPaymentStatus = method === 'in_person' ? 'pay_in_person' : 'paid_full';
          
          await addToDraftPool({
            playerId: selectedPlayer.id,
            playerName: formData.athleteName,
            playerUsername: selectedPlayer.username,
            playerDob: selectedPlayer.dob,
            contactName: formData.parentName,
            contactEmail: formData.parentEmail,
            contactPhone: formData.parentPhone,
            registeredByUserId: user.uid,
            registeredByName: formData.parentName,
            isIndependentAthlete: false,
            teamId: event.teamId,
            ownerId: teamData.ownerId || teamData.coachId || user.uid,
            sport: (teamData.sport || 'football') as SportType,
            ageGroup: teamData.ageGroup || 'Unknown',
            paymentStatus: draftPaymentStatus,
            amountPaid: method === 'in_person' ? 0 : grandTotal,
            totalAmount: grandTotal,
            paymentMethod: method === 'in_person' ? 'cash' : 'paypal',
            seasonId: (event as any).seasonId,
            registrationId: result.registrationIds[0],
            waiverSigned: waiverAccepted || !requirements.waiver,
            waiverSignedAt: Timestamp.now(),
            waiverSignedBy: formData.parentName,
            emergencyContact: {
              name: formData.emergencyContactName,
              relationship: formData.emergencyContactRelationship,
              phone: formData.emergencyContactPhone,
            },
            ...(requirements.medical ? {
              medicalInfo: {
                allergies: formData.allergies,
                conditions: formData.medicalConditions,
                medications: formData.medications,
              }
            } : {}),
            ...(requirements.uniform ? {
              uniformSizes: {
                jersey: formData.shirtSize,
                shorts: formData.pantSize,
              }
            } : {}),
            // Parent suggestions for coach/position preferences
            ...(formData.parentSuggestions.trim() ? {
              notes: formData.parentSuggestions.trim(),
            } : {}),
          });
        }
      } catch (draftPoolError) {
        console.error('Failed to add to draft pool:', draftPoolError);
      }

      // Send notification to parent confirming registration
      try {
        await createNotification(
          user.uid,
          'registration_confirmed',
          '🎉 Registration Successful!',
          `${formData.athleteName} has been registered for ${event.title} and added to the draft pool. The coaching staff will review registrations and assign players to teams soon.`,
          {
            link: '/dashboard',
            metadata: {
              eventId: event.id,
              eventTitle: event.title,
              athleteName: formData.athleteName,
              confirmationCode: code,
            },
            priority: 'normal',
            category: 'registration',
          }
        );
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
        // Don't fail registration if notification fails
      }

      // Also notify the team owner/coach about new registration
      try {
        const coachesToNotify: string[] = [];
        
        // Check team document for coach/owner IDs
        if (event.teamId) {
          const teamRef = doc(db, 'teams', event.teamId);
          const teamSnap = await getDoc(teamRef);
          console.log('[Registration] Team lookup:', event.teamId, 'exists:', teamSnap.exists());
          
          if (teamSnap.exists()) {
            const teamData = teamSnap.data();
            console.log('[Registration] Team fields:', Object.keys(teamData));
            
            // Check all possible coach/owner field names
            const possibleCoachFields = ['ownerId', 'coachId', 'headCoachId', 'userId', 'createdBy', 'managerId'];
            for (const field of possibleCoachFields) {
              const coachId = teamData[field];
              if (coachId && coachId !== user.uid && !coachesToNotify.includes(coachId)) {
                console.log(`[Registration] Found coach from team.${field}:`, coachId);
                coachesToNotify.push(coachId);
              }
            }
          }
        }
        
        // Fallback: Check event creator
        const eventCreatorFields = ['createdBy', 'creatorId', 'ownerId', 'userId'];
        for (const field of eventCreatorFields) {
          const creatorId = (event as any)[field];
          if (creatorId && creatorId !== user.uid && !coachesToNotify.includes(creatorId)) {
            console.log(`[Registration] Found creator from event.${field}:`, creatorId);
            coachesToNotify.push(creatorId);
          }
        }
        
        console.log('[Registration] Final coaches to notify:', coachesToNotify);
        
        for (const coachId of coachesToNotify) {
          await createNotification(
            coachId,
            'roster_update',
            '📋 New Player Registered',
            `${formData.athleteName} has registered for ${event.title} and is now in your draft pool.${formData.parentSuggestions ? ' Parent included suggestions.' : ''}`,
            {
              link: '/dashboard',
              metadata: {
                eventId: event.id,
                athleteName: formData.athleteName,
                parentSuggestions: formData.parentSuggestions || null,
              },
              priority: 'normal',
              category: 'team',
            }
          );
          console.log('[Registration] ✅ Notification sent to coach:', coachId);
        }
        
        if (coachesToNotify.length === 0) {
          console.log('[Registration] ⚠️ No coaches found to notify. Event:', event.id, 'Team:', event.teamId);
        }
      } catch (coachNotifError) {
        console.error('[Registration] Failed to notify coach:', coachNotifError);
      }

      setConfirmationCode(code);
      goToStep('confirmation');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy confirmation code
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(confirmationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Render step indicator
  const renderStepIndicator = () => {
    if (currentStep === 'confirmation') return null;

    const displaySteps = [
      { key: 'form', label: 'Info' },
      ...(requirements.waiver ? [{ key: 'waiver', label: 'Waiver' }] : []),
      { key: 'payment', label: 'Payment' },
    ];

    const currentIndex = displaySteps.findIndex(s => s.key === currentStep);

    return (
      <div className="flex items-center justify-center mb-8">
        {displaySteps.map((step, index) => (
          <React.Fragment key={step.key}>
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all
                  ${index < currentIndex 
                    ? 'bg-green-500 text-white' 
                    : index === currentIndex
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
              >
                {index < currentIndex ? (
                  <Check className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
            </div>
            {index < displaySteps.length - 1 && (
              <div className={`w-12 sm:w-20 h-0.5 mx-2 transition-colors
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
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
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
            onClick={() => navigate(-1)}
            className="mt-4 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // Must be logged in with Parent role
  if (!user) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6 text-center">
          <Shield className="w-12 h-12 text-purple-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Account Required
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please create an account or sign in to register for this event.
          </p>
          <button
            onClick={() => navigate('/auth', { state: { returnTo: `/events/${eventId}/register` } })}
            className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            Create Account / Sign In
          </button>
        </div>
      </div>
    );
  }

  // No athletes - need to add one first
  if (!players || players.length === 0) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
          <User className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Add Your Athlete First
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You need to add an athlete to your account before registering.
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
          >
            Go to Profile
          </button>
        </div>
      </div>
    );
  }

  // Render form step
  const renderFormStep = () => (
    <div className="space-y-6">
      {/* Already Registered Warning */}
      {playerAlreadyRegistered && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-400 mb-1">
                Already Registered
              </h3>
              <p className="text-amber-700 dark:text-amber-300 text-sm">
                {playerAlreadyRegistered}
              </p>
              <p className="text-amber-600 dark:text-amber-400 text-xs mt-2">
                Players can only have one active registration per sport. They CAN register for multiple different sports at the same time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Checking Status Loader */}
      {checkingStatus && (
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
          <span className="text-zinc-600 dark:text-zinc-400">Checking registration status...</span>
        </div>
      )}

      {/* Athlete Display (selected on previous page) */}
      {selectedPlayer && !checkingStatus && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-purple-500" />
            Registering Athlete
          </h3>
          <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
            <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              {selectedPlayer.photoUrl ? (
                <img src={selectedPlayer.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {selectedPlayer.name?.charAt(0) || '?'}
                </span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">{selectedPlayer.name}</p>
              {selectedPlayer.dob && calculateAgeGroup(selectedPlayer.dob) && (
                <span className="inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                  {calculateAgeGroup(selectedPlayer.dob)}
                </span>
              )}
              {!ageValidation.isValid && (
                <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-4 h-4" />
                  {ageValidation.message}
                </p>
              )}
            </div>
            <button
              onClick={() => navigate(-1)}
              className="text-xs text-purple-500 hover:text-purple-700 underline"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {/* Jersey Preferences */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
        <h3 className="font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
          🏆 Jersey Number Preferences
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Jersey numbers are preferences and subject to availability. Final assignment by coach.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Preferred Number
            </label>
            <input
              type="number"
              min="1"
              max={MAX_JERSEY_NUMBER}
              value={formData.preferredJersey}
              onChange={(e) => setFormData(prev => ({ ...prev, preferredJersey: e.target.value }))}
              placeholder="1-99"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Alternate Number
            </label>
            <input
              type="number"
              min="1"
              max={MAX_JERSEY_NUMBER}
              value={formData.alternateJersey}
              onChange={(e) => setFormData(prev => ({ ...prev, alternateJersey: e.target.value }))}
              placeholder="1-99"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Emergency Contact (only if required) */}
      {requirements.emergency && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            🚨 Emergency Contact
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Contact Name *
              </label>
              <input
                type="text"
                value={formData.emergencyContactName}
                onChange={(e) => setFormData(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                placeholder="Emergency contact name"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Contact Phone *
              </label>
              <input
                type="tel"
                value={formData.emergencyContactPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                placeholder="(555) 123-4567"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Relationship
              </label>
              <input
                type="text"
                value={formData.emergencyContactRelationship}
                onChange={(e) => setFormData(prev => ({ ...prev, emergencyContactRelationship: e.target.value }))}
                placeholder="e.g., Grandmother, Uncle, Neighbor"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Medical Info (only if required) */}
      {requirements.medical && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            🩺 Medical Information <span className="text-sm font-normal text-zinc-500">(Optional)</span>
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Allergies
              </label>
              <input
                type="text"
                value={formData.allergies}
                onChange={(e) => setFormData(prev => ({ ...prev, allergies: e.target.value }))}
                placeholder="Food, medications, environmental allergies..."
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Medical Conditions
              </label>
              <input
                type="text"
                value={formData.medicalConditions}
                onChange={(e) => setFormData(prev => ({ ...prev, medicalConditions: e.target.value }))}
                placeholder="Asthma, diabetes, heart conditions..."
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Current Medications
              </label>
              <input
                type="text"
                value={formData.medications}
                onChange={(e) => setFormData(prev => ({ ...prev, medications: e.target.value }))}
                placeholder="List any medications..."
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Additional Notes
              </label>
              <textarea
                value={formData.medicalNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, medicalNotes: e.target.value }))}
                placeholder="Any other medical info coaches should know..."
                rows={2}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Uniform Sizes (only if required) */}
      {requirements.uniform && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            👕 Uniform Sizes
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Shirt Size
              </label>
              <select
                value={formData.shirtSize}
                onChange={(e) => setFormData(prev => ({ ...prev, shirtSize: e.target.value }))}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select...</option>
                <option value="Youth XS">Youth XS</option>
                <option value="Youth S">Youth S</option>
                <option value="Youth M">Youth M</option>
                <option value="Youth L">Youth L</option>
                <option value="Youth XL">Youth XL</option>
                <option value="Adult S">Adult S</option>
                <option value="Adult M">Adult M</option>
                <option value="Adult L">Adult L</option>
                <option value="Adult XL">Adult XL</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Pant Size
              </label>
              <select
                value={formData.pantSize}
                onChange={(e) => setFormData(prev => ({ ...prev, pantSize: e.target.value }))}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select...</option>
                <option value="Youth XS">Youth XS</option>
                <option value="Youth S">Youth S</option>
                <option value="Youth M">Youth M</option>
                <option value="Youth L">Youth L</option>
                <option value="Youth XL">Youth XL</option>
                <option value="Adult S">Adult S</option>
                <option value="Adult M">Adult M</option>
                <option value="Adult L">Adult L</option>
                <option value="Adult XL">Adult XL</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Parent Suggestions - Coach/Position Preferences */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
        <h3 className="font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
          💬 Parent Suggestions <span className="text-sm font-normal text-zinc-500">(Optional)</span>
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Share any preferences or suggestions with the coaching staff. For example: preferred coach, position interests, scheduling conflicts, or other relevant information.
        </p>
        <textarea
          value={formData.parentSuggestions}
          onChange={(e) => setFormData(prev => ({ ...prev, parentSuggestions: e.target.value }))}
          placeholder="e.g., Would love to play on Coach Smith's team, interested in playing QB or WR, has practice conflict on Tuesdays..."
          rows={4}
          maxLength={500}
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-purple-500 resize-none"
        />
        <p className="text-xs text-zinc-400 mt-2 text-right">
          {formData.parentSuggestions.length}/500 characters
        </p>
      </div>
    </div>
  );

  // Render payment step
  const renderPaymentStep = () => (
    <div className="space-y-6">
      {/* Order Summary */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
          📋 Registration Summary
        </h3>
        
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Athlete:</span>
            <span className="text-zinc-900 dark:text-white font-medium">{formData.athleteName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Event:</span>
            <span className="text-zinc-900 dark:text-white">{event.title}</span>
          </div>
          {formData.preferredJersey && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Jersey #:</span>
              <span className="text-zinc-900 dark:text-white">#{formData.preferredJersey}</span>
            </div>
          )}
          
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 mt-3">
            <div className="flex justify-between text-lg font-bold">
              <span className="text-zinc-900 dark:text-white">Fee:</span>
              <span className="text-purple-500">{formatPrice(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Options */}
      {grandTotal === 0 ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
          <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
            Free Registration
          </h3>
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
          {/* PayPal */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-5 h-5 text-blue-500" />
              <h4 className="font-medium text-zinc-900 dark:text-white">Pay with PayPal</h4>
            </div>
            
            <PayPalCheckout
              eventId={event.id}
              teamId={event.teamId}
              items={[{
                athleteId: formData.athleteId,
                athleteName: formData.athleteName,
                tierId: selectedTierId,
                tierName: selectedTier?.name || 'Registration',
                price: grandTotal
              }]}
              subtotal={grandTotal}
              grandTotal={grandTotal}
              promoDiscount={0}
              onSuccess={(orderId, txId) => completeRegistration('paypal', orderId, txId)}
              onCancel={() => {}}
              onError={(err) => setError(err)}
              disabled={isSubmitting}
            />
          </div>

          {/* Pay in Person */}
          {(event as any).allowInPersonPayment && (
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Banknote className="w-5 h-5 text-green-500" />
                <h4 className="font-medium text-zinc-900 dark:text-white">Pay in Person</h4>
              </div>
              
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                Reserve your spot and pay the coach directly.
              </p>
              
              <button
                onClick={() => completeRegistration('in_person')}
                disabled={isSubmitting}
                className="w-full py-3 bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  'Reserve & Pay Later'
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

  // Render confirmation step
  const renderConfirmationStep = () => (
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
        <PartyPopper className="w-10 h-10 text-green-500" />
      </div>
      
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
        Registration Complete!
      </h2>
      
      <p className="text-zinc-600 dark:text-zinc-400 mb-4">
        You've successfully registered for {event?.title}
      </p>

      {/* Confirmation Code with Copy */}
      <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-4 max-w-sm mx-auto mb-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Confirmation #:</p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-xl font-mono font-bold text-zinc-900 dark:text-white">
            {confirmationCode}
          </span>
          <button
            onClick={handleCopyCode}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            title="Copy confirmation code"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-500" />
            ) : (
              <Copy className="w-5 h-5 text-zinc-500" />
            )}
          </button>
        </div>
      </div>

      <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-6">
        ✓ Added to draft pool for team assignment
      </p>

      <button
        onClick={() => navigate('/events')}
        className="px-8 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-medium"
      >
        Done
      </button>
    </div>
  );

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 'form':
        return renderFormStep();
      case 'waiver':
        return (
          <WaiverAcceptance
            event={event}
            teamState={(event as any).location?.state}
            athleteNames={[formData.athleteName]}
            signerName={formData.parentName || userData?.name || 'Parent/Guardian'}
            onAccept={handleWaiverAccept}
            onBack={handleBack}
          />
        );
      case 'payment':
        return renderPaymentStep();
      case 'confirmation':
        return renderConfirmationStep();
      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to event
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Register for {event.title}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">
          {grandTotal === 0 ? 'Free Registration' : formatPrice(grandTotal)}
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
        <div className="flex justify-between pt-6 border-t border-zinc-200 dark:border-zinc-700">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Cancel
          </button>
          
          <button
            onClick={handleNext}
            disabled={!isFormValid}
            className="flex items-center gap-2 px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default StreamlinedRegistration;
