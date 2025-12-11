/**
 * Simple Registration Form
 * Enhanced with pilot features:
 * - Jersey number selection with validation
 * - Position preferences  
 * - Medical info
 * - Waiver acknowledgment
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  createSimpleRegistration, 
  SimpleRegistrationInput,
  getTakenJerseyNumbers,
  checkJerseyAvailability,
  JERSEY_NUMBER_RULES,
  validateJerseyNumber
} from '../../services/simpleRegistrationService';
import { Event } from '../../types/events';
import { getPositions } from '../../config/sportConfig';
import { AlertTriangle, Check, X, Info } from 'lucide-react';

interface SimpleRegistrationFormProps {
  event: Event;
  registrationFee?: number;
  onSuccess: (registrationId: string) => void;
  onCancel: () => void;
}

export default function SimpleRegistrationForm({ event, registrationFee = 0, onSuccess, onCancel }: SimpleRegistrationFormProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1); // Multi-step form
  
  // Get sport from event or default
  const sport = (event as any).sport || 'football';
  const positions = getPositions(sport);
  const jerseyRules = JERSEY_NUMBER_RULES[sport] || JERSEY_NUMBER_RULES.other;
  
  // Athlete Info
  const [athleteFirstName, setAthleteFirstName] = useState('');
  const [athleteLastName, setAthleteLastName] = useState('');
  const [athleteDOB, setAthleteDOB] = useState('');
  const [athleteGender, setAthleteGender] = useState<'male' | 'female' | 'other'>('male');
  
  // Jersey & Position
  const [preferredJerseyNumber, setPreferredJerseyNumber] = useState<string>('');
  const [alternateJersey1, setAlternateJersey1] = useState<string>('');
  const [alternateJersey2, setAlternateJersey2] = useState<string>('');
  const [preferredPosition, setPreferredPosition] = useState<string>('');
  const [takenNumbers, setTakenNumbers] = useState<number[]>([]);
  const [jerseyAvailable, setJerseyAvailable] = useState<boolean | null>(null);
  const [jerseyCheckMessage, setJerseyCheckMessage] = useState<string>('');
  
  // Parent Info
  const [parentName, setParentName] = useState(user?.displayName || '');
  const [parentEmail, setParentEmail] = useState(user?.email || '');
  const [parentPhone, setParentPhone] = useState('');
  
  // Emergency Contact
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  
  // Medical Info
  const [medicalAllergies, setMedicalAllergies] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [medicalMedications, setMedicalMedications] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  
  // Waiver
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  
  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash' | 'check' | 'free'>('cash');
  
  const isFree = registrationFee === 0;
  
  // Fetch taken jersey numbers on mount
  useEffect(() => {
    const fetchTakenNumbers = async () => {
      const taken = await getTakenJerseyNumbers(event.teamId);
      setTakenNumbers(taken);
    };
    fetchTakenNumbers();
  }, [event.teamId]);
  
  // Check jersey availability when number changes
  useEffect(() => {
    const checkJersey = async () => {
      if (!preferredJerseyNumber) {
        setJerseyAvailable(null);
        setJerseyCheckMessage('');
        return;
      }
      
      const num = parseInt(preferredJerseyNumber);
      if (isNaN(num)) {
        setJerseyAvailable(false);
        setJerseyCheckMessage('Enter a valid number');
        return;
      }
      
      const validation = validateJerseyNumber(num, sport);
      if (!validation.valid) {
        setJerseyAvailable(false);
        setJerseyCheckMessage(validation.error || 'Invalid number');
        return;
      }
      
      if (takenNumbers.includes(num)) {
        setJerseyAvailable(false);
        setJerseyCheckMessage(`#${num} is already taken`);
        return;
      }
      
      // Deep check
      const result = await checkJerseyAvailability(event.teamId, num);
      setJerseyAvailable(result.available);
      setJerseyCheckMessage(result.available ? `#${num} is available!` : `#${num} is taken by ${result.takenBy}`);
    };
    
    const debounce = setTimeout(checkJersey, 300);
    return () => clearTimeout(debounce);
  }, [preferredJerseyNumber, event.teamId, sport, takenNumbers]);
  
  const validateStep1 = () => {
    if (!athleteFirstName.trim() || !athleteLastName.trim()) {
      setError('Please enter athlete name');
      return false;
    }
    if (!athleteDOB) {
      setError('Please enter athlete date of birth');
      return false;
    }
    return true;
  };
  
  const validateStep2 = () => {
    if (!parentName.trim() || !parentEmail.trim() || !parentPhone.trim()) {
      setError('Please complete parent/guardian information');
      return false;
    }
    if (!emergencyContactName.trim() || !emergencyContactPhone.trim()) {
      setError('Please complete emergency contact information');
      return false;
    }
    return true;
  };
  
  const validateStep3 = () => {
    if (!waiverAccepted) {
      setError('Please accept the waiver to continue');
      return false;
    }
    return true;
  };
  
  const handleNext = () => {
    setError(null);
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };
  
  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to register');
      return;
    }
    
    if (!validateStep3()) return;
    
    setLoading(true);
    setError(null);
    
    // Build alternate numbers array
    const alternateJerseyNumbers: number[] = [];
    if (alternateJersey1) {
      const alt1 = parseInt(alternateJersey1);
      if (!isNaN(alt1)) alternateJerseyNumbers.push(alt1);
    }
    if (alternateJersey2) {
      const alt2 = parseInt(alternateJersey2);
      if (!isNaN(alt2)) alternateJerseyNumbers.push(alt2);
    }
    
    const input: SimpleRegistrationInput = {
      eventId: event.id,
      teamId: event.teamId,
      eventName: event.title,
      sport: sport,
      parentUserId: user.uid,
      athleteFirstName,
      athleteLastName,
      athleteDOB: new Date(athleteDOB),
      athleteGender,
      preferredJerseyNumber: preferredJerseyNumber ? parseInt(preferredJerseyNumber) : undefined,
      alternateJerseyNumbers: alternateJerseyNumbers.length > 0 ? alternateJerseyNumbers : undefined,
      preferredPosition: preferredPosition || undefined,
      parentName,
      parentEmail,
      parentPhone,
      emergencyContactName,
      emergencyContactPhone,
      emergencyRelationship: emergencyRelationship || 'Not specified',
      medicalAllergies: medicalAllergies || undefined,
      medicalConditions: medicalConditions || undefined,
      medicalMedications: medicalMedications || undefined,
      medicalNotes: medicalNotes || undefined,
      waiverAccepted,
      amountDue: registrationFee,
      amountPaid: isFree ? 0 : (paymentMethod === 'cash' || paymentMethod === 'check' ? 0 : registrationFee),
      paymentMethod: isFree ? 'free' : paymentMethod,
    };
    
    const result = await createSimpleRegistration(input);
    
    setLoading(false);
    
    if (result.success && result.registrationId) {
      onSuccess(result.registrationId);
    } else {
      setError(result.error || 'Registration failed. Please try again.');
    }
  };
  
  const inputClass = `w-full px-4 py-3 rounded-lg border ${
    isDark 
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
  } focus:ring-2 focus:ring-purple-500 focus:border-transparent`;
  
  const labelClass = `block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`;
  
  const sectionClass = `p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`;
  
  // Step indicators
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            s === step 
              ? 'bg-purple-600 text-white' 
              : s < step 
                ? 'bg-green-500 text-white' 
                : isDark ? 'bg-gray-600 text-gray-400' : 'bg-gray-300 text-gray-500'
          }`}>
            {s < step ? <Check className="w-4 h-4" /> : s}
          </div>
          {s < 3 && (
            <div className={`w-12 h-1 ${s < step ? 'bg-green-500' : isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />
          )}
        </div>
      ))}
    </div>
  );
  
  return (
    <div className={`max-w-2xl mx-auto p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
      <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Register for {event.title}
      </h2>
      <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {isFree ? 'Free Registration' : `Registration Fee: $${(registrationFee / 100).toFixed(2)}`}
      </p>
      
      <StepIndicator />
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* STEP 1: Athlete Info + Jersey */}
        {step === 1 && (
          <>
            <div className={sectionClass}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                👤 Athlete Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>First Name *</label>
                  <input type="text" value={athleteFirstName} onChange={(e) => setAthleteFirstName(e.target.value)}
                    className={inputClass} placeholder="First name" required />
                </div>
                <div>
                  <label className={labelClass}>Last Name *</label>
                  <input type="text" value={athleteLastName} onChange={(e) => setAthleteLastName(e.target.value)}
                    className={inputClass} placeholder="Last name" required />
                </div>
                <div>
                  <label className={labelClass}>Date of Birth *</label>
                  <input type="date" value={athleteDOB} onChange={(e) => setAthleteDOB(e.target.value)}
                    className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Gender *</label>
                  <select value={athleteGender} onChange={(e) => setAthleteGender(e.target.value as 'male' | 'female' | 'other')}
                    className={inputClass}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className={sectionClass}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                🏆 Jersey Number & Position
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Preferred Jersey Number
                    <span className={`ml-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      ({jerseyRules.min}-{jerseyRules.max})
                    </span>
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={preferredJerseyNumber} 
                      onChange={(e) => setPreferredJerseyNumber(e.target.value)}
                      min={jerseyRules.min}
                      max={jerseyRules.max}
                      className={`${inputClass} pr-10`} 
                      placeholder={`${jerseyRules.min}-${jerseyRules.max}`} 
                    />
                    {jerseyAvailable !== null && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {jerseyAvailable ? (
                          <Check className="w-5 h-5 text-green-500" />
                        ) : (
                          <X className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  {jerseyCheckMessage && (
                    <p className={`text-xs mt-1 ${jerseyAvailable ? 'text-green-500' : 'text-red-500'}`}>
                      {jerseyCheckMessage}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Preferred Position</label>
                  <select value={preferredPosition} onChange={(e) => setPreferredPosition(e.target.value)} className={inputClass}>
                    <option value="">No preference</option>
                    {positions.map((pos) => (
                      <option key={pos.value} value={pos.value}>{pos.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Alternate Jersey #1</label>
                  <input type="number" value={alternateJersey1} onChange={(e) => setAlternateJersey1(e.target.value)}
                    min={jerseyRules.min} max={jerseyRules.max} className={inputClass} placeholder="Backup choice" />
                </div>
                <div>
                  <label className={labelClass}>Alternate Jersey #2</label>
                  <input type="number" value={alternateJersey2} onChange={(e) => setAlternateJersey2(e.target.value)}
                    min={jerseyRules.min} max={jerseyRules.max} className={inputClass} placeholder="Second backup" />
                </div>
              </div>
              <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <Info className="w-3 h-3 inline mr-1" />
                Jersey numbers are preferences and subject to availability. Final assignment by coach.
              </p>
            </div>
          </>
        )}
        
        {/* STEP 2: Parent & Emergency + Medical */}
        {step === 2 && (
          <>
            <div className={sectionClass}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                👨‍👩‍👧 Parent/Guardian Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelClass}>Full Name *</label>
                  <input type="text" value={parentName} onChange={(e) => setParentName(e.target.value)}
                    className={inputClass} placeholder="Parent/guardian full name" required />
                </div>
                <div>
                  <label className={labelClass}>Email *</label>
                  <input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)}
                    className={inputClass} placeholder="email@example.com" required />
                </div>
                <div>
                  <label className={labelClass}>Phone *</label>
                  <input type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)}
                    className={inputClass} placeholder="(555) 123-4567" required />
                </div>
              </div>
            </div>
            
            <div className={sectionClass}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                🚨 Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Contact Name *</label>
                  <input type="text" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)}
                    className={inputClass} placeholder="Emergency contact name" required />
                </div>
                <div>
                  <label className={labelClass}>Contact Phone *</label>
                  <input type="tel" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    className={inputClass} placeholder="(555) 123-4567" required />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Relationship</label>
                  <input type="text" value={emergencyRelationship} onChange={(e) => setEmergencyRelationship(e.target.value)}
                    className={inputClass} placeholder="e.g., Grandmother, Uncle, Neighbor" />
                </div>
              </div>
            </div>
            
            <div className={sectionClass}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                🏥 Medical Information <span className="text-sm font-normal opacity-70">(Optional)</span>
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Allergies</label>
                  <input type="text" value={medicalAllergies} onChange={(e) => setMedicalAllergies(e.target.value)}
                    className={inputClass} placeholder="Food, medications, environmental allergies..." />
                </div>
                <div>
                  <label className={labelClass}>Medical Conditions</label>
                  <input type="text" value={medicalConditions} onChange={(e) => setMedicalConditions(e.target.value)}
                    className={inputClass} placeholder="Asthma, diabetes, heart conditions..." />
                </div>
                <div>
                  <label className={labelClass}>Current Medications</label>
                  <input type="text" value={medicalMedications} onChange={(e) => setMedicalMedications(e.target.value)}
                    className={inputClass} placeholder="List any medications..." />
                </div>
                <div>
                  <label className={labelClass}>Additional Notes</label>
                  <textarea value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)}
                    className={`${inputClass} min-h-[80px]`} placeholder="Any other medical info coaches should know..." />
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* STEP 3: Waiver & Payment */}
        {step === 3 && (
          <>
            <div className={sectionClass}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                📋 Liability Waiver
              </h3>
              <div className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-600' : 'bg-gray-100'}`}>
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  By registering my child for this program, I acknowledge and agree to the following:
                </p>
                <ul className={`text-sm mt-2 space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <li>• I understand youth sports involve inherent risks of injury</li>
                  <li>• I give permission for emergency medical treatment if needed</li>
                  <li>• I authorize use of photos/videos for team/league promotion</li>
                  <li>• I agree to follow all team and league rules and conduct guidelines</li>
                  <li>• I confirm all information provided is accurate</li>
                </ul>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={waiverAccepted} 
                  onChange={(e) => setWaiverAccepted(e.target.checked)}
                  className="w-5 h-5 mt-0.5 text-purple-600 rounded"
                />
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <strong>I have read and agree</strong> to the above waiver and release of liability. 
                  I am the parent/legal guardian of the athlete being registered.
                </span>
              </label>
            </div>
            
            {!isFree && (
              <div className={sectionClass}>
                <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  💳 Payment Method
                </h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="paymentMethod" value="cash" checked={paymentMethod === 'cash'}
                      onChange={() => setPaymentMethod('cash')} className="w-4 h-4 text-purple-600" />
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Pay Cash (at check-in)</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="paymentMethod" value="check" checked={paymentMethod === 'check'}
                      onChange={() => setPaymentMethod('check')} className="w-4 h-4 text-purple-600" />
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Pay by Check (at check-in)</span>
                  </label>
                </div>
                <p className={`mt-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Amount due at check-in: <strong>${(registrationFee / 100).toFixed(2)}</strong>
                </p>
              </div>
            )}
            
            {/* Summary */}
            <div className={`${sectionClass} border-2 ${isDark ? 'border-purple-500/30' : 'border-purple-200'}`}>
              <h3 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                📝 Registration Summary
              </h3>
              <div className={`grid grid-cols-2 gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <span>Athlete:</span>
                <span className="font-medium">{athleteFirstName} {athleteLastName}</span>
                <span>Event:</span>
                <span className="font-medium">{event.title}</span>
                {preferredJerseyNumber && (
                  <>
                    <span>Jersey #:</span>
                    <span className="font-medium">#{preferredJerseyNumber}</span>
                  </>
                )}
                {preferredPosition && (
                  <>
                    <span>Position:</span>
                    <span className="font-medium">{positions.find(p => p.value === preferredPosition)?.label || preferredPosition}</span>
                  </>
                )}
                <span>Fee:</span>
                <span className="font-medium">{isFree ? 'FREE' : `$${(registrationFee / 100).toFixed(2)}`}</span>
              </div>
            </div>
          </>
        )}
        
        {/* Navigation Buttons */}
        <div className="flex gap-4 pt-4">
          {step > 1 ? (
            <button type="button" onClick={handleBack}
              className={`flex-1 py-3 px-6 rounded-lg font-semibold ${
                isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } transition-colors`}>
              Back
            </button>
          ) : (
            <button type="button" onClick={onCancel}
              className={`flex-1 py-3 px-6 rounded-lg font-semibold ${
                isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } transition-colors`}>
              Cancel
            </button>
          )}
          
          {step < 3 ? (
            <button type="button" onClick={handleNext}
              className="flex-1 py-3 px-6 rounded-lg font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors">
              Next
            </button>
          ) : (
            <button type="submit" disabled={loading || !waiverAccepted}
              className={`flex-1 py-3 px-6 rounded-lg font-semibold text-white ${
                loading || !waiverAccepted ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
              } transition-colors`}>
              {loading ? 'Registering...' : 'Complete Registration'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// =============================================================================
// SUCCESS COMPONENT
// =============================================================================

interface RegistrationSuccessProps {
  registrationId: string;
  eventName: string;
  onClose: () => void;
}

export function RegistrationSuccess({ registrationId, eventName, onClose }: RegistrationSuccessProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <div className={`max-w-md mx-auto p-8 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-lg text-center`}>
      <div className="text-6xl mb-4">🎉</div>
      <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Registration Complete!
      </h2>
      <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        You've successfully registered for <strong>{eventName}</strong>
      </p>
      <p className={`text-sm mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
        Confirmation #: {registrationId.slice(0, 8).toUpperCase()}
      </p>
      <p className={`text-xs mb-6 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
        ✓ Added to draft pool for team assignment
      </p>
      <button onClick={onClose}
        className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors">
        Done
      </button>
    </div>
  );
}
