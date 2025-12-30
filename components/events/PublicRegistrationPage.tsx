/**
 * Public Registration Page
 * Public-facing registration page for independent registrations (age_pool, camp, tryout, etc.)
 * Path: /register/:programId/:registrationId
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getRegistration, addRegistrant } from '../../services/registrationService';
import { getProgram } from '../../services/leagueService';
import { getRegistrationTypeLabel } from '../../services/registrationService';
import { calculateAgeGroup } from '../../services/ageValidator';
import type { ProgramRegistration, Program, Registrant, Player } from '../../types';
import { 
  Loader2, 
  AlertCircle, 
  Calendar,
  Users,
  DollarSign,
  MapPin,
  Clock,
  Shield,
  CheckCircle,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  User,
  Phone,
  Mail,
  Heart
} from 'lucide-react';
import { Button } from '../ui/OSYSComponents';
import { toastSuccess, toastError } from '../../services/toast';

export default function PublicRegistrationPage() {
  const { programId, registrationId } = useParams<{ programId: string; registrationId: string }>();
  const navigate = useNavigate();
  const { user, userData, players, selectedPlayer } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Data state
  const [registration, setRegistration] = useState<ProgramRegistration | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  
  // Athlete selection (existing athletes from parent's account)
  const [selectedExistingAthlete, setSelectedExistingAthlete] = useState<Player | null>(null);
  const [registerNewAthlete, setRegisterNewAthlete] = useState(false);
  
  // Athlete info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say'>('prefer_not_to_say');
  
  // Parent/Guardian
  const [parentName, setParentName] = useState(userData?.name || '');
  const [parentEmail, setParentEmail] = useState(user?.email || '');
  const [parentPhone, setParentPhone] = useState(userData?.phone || '');
  
  // Emergency Contact
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  
  // Medical Info
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');
  
  // Preferences
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [coachRequest, setCoachRequest] = useState('');
  const [friendRequest, setFriendRequest] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  
  // Waiver
  const [waiverAgreed, setWaiverAgreed] = useState(false);
  
  // Auto-select the currently selected athlete from parent context
  useEffect(() => {
    if (selectedPlayer && players.length > 0 && !selectedExistingAthlete && !registerNewAthlete) {
      // Find matching athlete in players array
      const matchingAthlete = players.find(p => p.id === selectedPlayer.id);
      if (matchingAthlete) {
        setSelectedExistingAthlete(matchingAthlete);
      }
    }
  }, [selectedPlayer, players, selectedExistingAthlete, registerNewAthlete]);
  
  // Load registration and program data
  useEffect(() => {
    const loadData = async () => {
      if (!programId || !registrationId) {
        setError('Invalid registration link');
        setLoading(false);
        return;
      }
      
      try {
        // Load registration
        const regData = await getRegistration(programId, registrationId);
        if (!regData) {
          setError('Registration not found');
          setLoading(false);
          return;
        }
        setRegistration(regData);
        
        // Load program
        const progData = await getProgram(programId);
        if (progData) {
          setProgram(progData);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading registration:', err);
        setError('Failed to load registration');
        setLoading(false);
      }
    };
    
    loadData();
  }, [programId, registrationId]);
  
  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };
  
  // Check if registration is open
  const isOpen = registration?.status === 'open';
  const isScheduled = registration?.status === 'scheduled';
  const isClosed = registration?.status === 'closed' || registration?.status === 'completed';
  
  // Get status message
  const getStatusMessage = () => {
    if (isOpen) {
      return { text: 'Registration is Open', color: 'text-green-500', bg: 'bg-green-500/20' };
    }
    if (isScheduled) {
      const openDate = registration?.registrationOpenDate;
      return { 
        text: openDate ? `Opens ${formatDate(openDate)}` : 'Coming Soon', 
        color: 'text-blue-500', 
        bg: 'bg-blue-500/20' 
      };
    }
    if (isClosed) {
      return { text: 'Registration Closed', color: 'text-red-500', bg: 'bg-red-500/20' };
    }
    return { text: 'Draft', color: 'text-slate-500', bg: 'bg-slate-500/20' };
  };
  
  const status = getStatusMessage();
  
  // Calculate age from DOB
  const calculatedAge = useMemo(() => {
    if (!dateOfBirth) return 0;
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }, [dateOfBirth]);
  
  // Get age group from DOB
  const ageGroup = useMemo(() => {
    if (!dateOfBirth) return '';
    return calculateAgeGroup(dateOfBirth);
  }, [dateOfBirth]);
  
  // Check if athlete matches any age group in this registration
  // Works with both new athletes (using ageGroup) and existing athletes (using selectedExistingAthlete)
  const matchingAgeGroup = useMemo(() => {
    const athleteAgeGroupLabel = selectedExistingAthlete?.ageGroup || ageGroup;
    if (!athleteAgeGroupLabel || !registration?.ageGroupConfigs) return null;
    
    // Normalize athlete's age group for comparison (e.g., "10U" -> "10U", "10u" -> "10U")
    const normalizedAthleteAg = athleteAgeGroupLabel.toUpperCase().trim();
    
    // Extract athlete's age from their age group (e.g., "10U" -> 10)
    const athleteAgeMatch = athleteAgeGroupLabel.match(/(\d+)/);
    const athleteAge = athleteAgeMatch ? parseInt(athleteAgeMatch[1]) : 0;
    
    console.log('[AgeMatch] Checking athlete age group:', normalizedAthleteAg, 'age:', athleteAge);
    
    // Find matching age group config
    for (const ag of registration.ageGroupConfigs) {
      // First check: Does the ageGroups array include this athlete's age group?
      if (ag.ageGroups && ag.ageGroups.some(agLabel => 
        agLabel.toUpperCase().trim() === normalizedAthleteAg
      )) {
        console.log('[AgeMatch] Found match via ageGroups array:', ag.label);
        return ag;
      }
      
      const label = ag.label.toUpperCase();
      
      // Handle dual age groups like "9/10U", "9U-10U", "9-10U", "9U/10U"
      const rangeMatch = label.match(/(\d+)U?[\/\-](\d+)/i);
      if (rangeMatch) {
        const minAge = parseInt(rangeMatch[1]);
        const maxAge = parseInt(rangeMatch[2]);
        if (athleteAge >= minAge && athleteAge <= maxAge) {
          console.log('[AgeMatch] Found match via range:', ag.label, 'for age:', athleteAge);
          return ag;
        }
      }
      
      // Handle single age groups like "10U", "10", etc.
      const singleMatch = label.match(/^(\d+)/);
      if (singleMatch && parseInt(singleMatch[1]) === athleteAge) {
        console.log('[AgeMatch] Found match via single:', ag.label);
        return ag;
      }
    }
    
    console.log('[AgeMatch] No match found for athlete age:', athleteAge);
    return null;
  }, [ageGroup, selectedExistingAthlete?.ageGroup, registration?.ageGroupConfigs]);
  
  // Compute which steps are required based on registration requirements
  // Note: Step 1 (athlete selection) is SKIPPED - we use the already-selected player from context
  const requiredSteps = useMemo(() => {
    const steps: number[] = [];
    
    // Step 2 is required if emergency contact OR medical info is required
    const needsStep2 = registration?.requirements?.requireEmergencyContact || 
                       registration?.requirements?.requireMedicalInfo;
    if (needsStep2) steps.push(2);
    
    // Step 3 is always shown for summary (and waiver if required)
    steps.push(3);
    
    return steps;
  }, [registration?.requirements]);
  
  // Start at the first required step when form opens
  useEffect(() => {
    if (showForm && requiredSteps.length > 0 && formStep === 1) {
      setFormStep(requiredSteps[0]);
    }
  }, [showForm, requiredSteps]);
  
  // Get the next step in the flow
  const getNextStep = (currentStep: number) => {
    const currentIndex = requiredSteps.indexOf(currentStep);
    if (currentIndex === -1 || currentIndex >= requiredSteps.length - 1) return null;
    return requiredSteps[currentIndex + 1];
  };
  
  // Get the previous step in the flow
  const getPrevStep = (currentStep: number) => {
    const currentIndex = requiredSteps.indexOf(currentStep);
    if (currentIndex <= 0) return null;
    return requiredSteps[currentIndex - 1];
  };
  
  // Check if current step is the last step
  const isLastStep = formStep === requiredSteps[requiredSteps.length - 1];
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!user || !programId || !registrationId || !registration) return;
    
    // Validation
    const athleteFirstName = selectedExistingAthlete?.firstName || firstName;
    const athleteLastName = selectedExistingAthlete?.lastName || lastName;
    const athleteDob = selectedExistingAthlete?.dob || dateOfBirth;
    
    if (!athleteFirstName || !athleteLastName) {
      toastError('Please enter athlete name');
      return;
    }
    if (!athleteDob) {
      toastError('Please enter date of birth');
      return;
    }
    // Only validate emergency contact if required
    if (registration.requirements?.requireEmergencyContact && (!emergencyName || !emergencyPhone)) {
      toastError('Please enter emergency contact information');
      return;
    }
    if (registration.requirements?.requireWaiver && !waiverAgreed) {
      toastError('Please agree to the waiver to continue');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Calculate age from DOB (Player doesn't have 'age' field, calculate from dob)
      const calculateAge = (dob: string) => {
        if (!dob) return 0;
        const today = new Date();
        const birth = new Date(dob);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
      };
      const athleteAge = selectedExistingAthlete?.dob ? calculateAge(selectedExistingAthlete.dob) : calculatedAge;
      const athleteAgeGroup = selectedExistingAthlete?.ageGroup || ageGroup;
      
      const registrantData: Omit<Registrant, 'id' | 'registeredAt'> = {
        registrationId: registrationId,
        programId: programId,
        registrantType: 'player',
        
        // Athlete info
        firstName: athleteFirstName,
        lastName: athleteLastName,
        fullName: `${athleteFirstName} ${athleteLastName}`,
        dateOfBirth: athleteDob,
        calculatedAge: athleteAge,
        calculatedAgeGroup: matchingAgeGroup?.label || athleteAgeGroup, // Use matched age group label
        gender: gender,
        
        // Link to existing player if selected
        ...(selectedExistingAthlete?.id && { existingPlayerId: selectedExistingAthlete.id }),
        
        // Age group assignment - only include if we have values (avoid undefined)
        ...(matchingAgeGroup?.id && { ageGroupId: matchingAgeGroup.id }),
        ageGroupLabel: matchingAgeGroup?.label || athleteAgeGroup,
        
        // Parent info
        isMinor: athleteAge < 18,
        parentId: user.uid,
        parentName: parentName,
        parentEmail: parentEmail,
        parentPhone: parentPhone,
        
        // Contact
        email: parentEmail,
        phone: parentPhone,
        
        // Emergency contact
        emergencyContact: {
          name: emergencyName,
          phone: emergencyPhone,
          relationship: emergencyRelationship,
        },
        
        // Medical info - only include fields that have values
        medicalInfo: {
          ...(allergies && { allergies }),
          ...(medications && { medications }),
          ...(medicalConditions && { conditions: medicalConditions }),
        },
        
        // Preferences - only include fields that have values
        preferences: {
          ...(jerseyNumber && { jerseyNumber }),
          ...(coachRequest && { coachRequest }),
          ...(friendRequest && { friendRequest }),
          ...(additionalNotes && { notes: additionalNotes }),
        },
        
        // Payment - start as pending
        paymentStatus: registration.registrationFee === 0 ? 'waived' : 'pending',
        amountDue: (registration.registrationFee || 0) * 100, // Convert to cents
        amountPaid: 0,
        remainingBalance: (registration.registrationFee || 0) * 100,
        
        // Waiver
        waiverSigned: waiverAgreed,
        ...(waiverAgreed && { waiverSignedAt: new Date() }),
        ...(waiverAgreed && parentName && { waiverSignedBy: parentName }),
        
        // Status
        status: 'registered',
      };
      
      await addRegistrant(programId, registrationId, registrantData);
      
      toastSuccess('Registration submitted successfully!');
      setRegistrationComplete(true);
      setShowForm(false);
    } catch (err) {
      console.error('Error submitting registration:', err);
      toastError('Failed to submit registration. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Prefill form when existing athlete is selected
  useEffect(() => {
    if (selectedExistingAthlete) {
      setFirstName(selectedExistingAthlete.firstName || '');
      setLastName(selectedExistingAthlete.lastName || '');
      setDateOfBirth(selectedExistingAthlete.dob || '');
      setGender((selectedExistingAthlete.gender as any) || 'prefer_not_to_say');
    }
  }, [selectedExistingAthlete]);
  
  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-zinc-900' : 'bg-slate-50'}`}>
        <div className="text-center">
          <Loader2 className={`w-8 h-8 animate-spin mx-auto mb-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Loading registration...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error || !registration) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-zinc-900' : 'bg-slate-50'}`}>
        <div className="text-center max-w-md mx-auto px-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Registration Not Found
          </h1>
          <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {error || 'This registration does not exist or is no longer available.'}
          </p>
          <Link to="/">
            <Button variant="primary">
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b ${isDark ? 'bg-black/40 border-white/10' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            {program?.logoUrl && (
              <img src={program.logoUrl} alt={program.name} className="w-10 h-10 rounded-lg object-cover" />
            )}
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Status Banner */}
        <div className={`${status.bg} rounded-xl p-4 mb-6 flex items-center gap-3`}>
          {isOpen ? (
            <CheckCircle className={`w-6 h-6 ${status.color}`} />
          ) : (
            <Clock className={`w-6 h-6 ${status.color}`} />
          )}
          <span className={`font-medium ${status.color}`}>{status.text}</span>
        </div>
        
        {/* Program & Registration Info */}
        <div className={`rounded-2xl border overflow-hidden mb-6 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
          {/* Header */}
          <div className={`p-6 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div className="flex items-start gap-4">
              {program?.logoUrl ? (
                <img src={program.logoUrl} alt={program.name} className="w-16 h-16 rounded-xl object-cover" />
              ) : (
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                  <Users className="w-8 h-8 text-purple-500" />
                </div>
              )}
              <div className="flex-1">
                <h1 className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {registration.name}
                </h1>
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  {program?.name || registration.programName}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                    {getRegistrationTypeLabel(registration.type)}
                  </span>
                  {registration.sport && (
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium capitalize ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                      {registration.sport}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Details Grid */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Registration Period */}
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                <Calendar className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Registration Period</p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {formatDate(registration.registrationOpenDate)} - {formatDate(registration.registrationCloseDate)}
                </p>
              </div>
            </div>
            
            {/* Fee */}
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Registration Fee</p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {registration.registrationFee === 0 ? 'Free' : `$${registration.registrationFee}`}
                </p>
              </div>
            </div>
            
            {/* Event Date (if applicable) */}
            {registration.eventDate && (
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                  <Calendar className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Event Date</p>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {formatDate(registration.eventDate)}
                    {registration.eventEndDate && ` - ${formatDate(registration.eventEndDate)}`}
                  </p>
                </div>
              </div>
            )}
            
            {/* Location */}
            {registration.eventLocation && (
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                  <MapPin className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Location</p>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {registration.eventLocation}
                  </p>
                </div>
              </div>
            )}
            
            {/* Spots */}
            {registration.hasCapacity && registration.capacity && (
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-pink-500/20' : 'bg-pink-100'}`}>
                  <Users className="w-5 h-5 text-pink-500" />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Spots Available</p>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {Math.max(0, registration.capacity - (registration.registrationCount || 0))} of {registration.capacity} remaining
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Description */}
          {registration.description && (
            <div className={`px-6 pb-6 pt-2 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <h3 className={`font-medium mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>About</h3>
              <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {registration.description}
              </p>
            </div>
          )}
          
          {/* Age Groups */}
          {registration.ageGroupConfigs && registration.ageGroupConfigs.length > 0 && (
            <div className={`px-6 pb-6 pt-2 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <h3 className={`font-medium mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Age Groups</h3>
              <div className="flex flex-wrap gap-2">
                {registration.ageGroupConfigs.map(ag => (
                  <span 
                    key={ag.id}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {ag.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Registration Complete Message */}
        {registrationComplete && (
          <div className={`rounded-2xl border p-8 text-center ${isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Registration Complete!
            </h2>
            <p className={`mb-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {firstName || selectedExistingAthlete?.firstName} has been registered for {registration?.name}.
              {registration?.registrationFee && registration.registrationFee > 0 && (
                <span className="block mt-2 text-amber-500">
                  Payment of ${registration.registrationFee} is due. You will be contacted with payment instructions.
                </span>
              )}
            </p>
            <Button variant="primary" onClick={() => navigate('/')}>
              Go to Dashboard
            </Button>
          </div>
        )}
        
        {/* Registration Form */}
        {showForm && !registrationComplete && (
          <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
            {/* Form Header */}
            <div className={`p-4 border-b ${isDark ? 'bg-purple-500/10 border-white/10' : 'bg-purple-50 border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Register for {registration?.name}
                </h2>
                <button 
                  onClick={() => setShowForm(false)}
                  className={`text-sm ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Cancel
                </button>
              </div>
              {/* Progress steps - only show required steps */}
              <div className="flex items-center gap-2 mt-3">
                {requiredSteps.map((step, index) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      formStep >= step 
                        ? 'bg-purple-500 text-white' 
                        : isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {index + 1}
                    </div>
                    {index < requiredSteps.length - 1 && (
                      <div className={`w-12 h-0.5 ${formStep > step ? 'bg-purple-500' : isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Form Content */}
            <div className="p-6">
              {/* Show selected athlete info at top */}
              {selectedExistingAthlete && (
                <div className={`mb-6 p-4 rounded-xl border ${isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Registering: {selectedExistingAthlete.firstName} {selectedExistingAthlete.lastName}
                      </p>
                      <p className={`text-sm ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>
                        {matchingAgeGroup?.label || selectedExistingAthlete.ageGroup} • {registration?.sport || 'Football'}
                      </p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
                  </div>
                </div>
              )}
              
              {/* Step 2: Contact & Emergency Info */}
              {formStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Parent/Guardian Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Full Name *
                        </label>
                        <input
                          type="text"
                          value={parentName}
                          onChange={(e) => setParentName(e.target.value)}
                          className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Email *
                        </label>
                        <input
                          type="email"
                          value={parentEmail}
                          onChange={(e) => setParentEmail(e.target.value)}
                          className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={parentPhone}
                          onChange={(e) => setParentPhone(e.target.value)}
                          className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                          placeholder="(555) 555-5555"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {registration?.requirements?.requireEmergencyContact && (
                    <div>
                      <h3 className={`font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        <Heart className="w-5 h-5 text-red-500" />
                        Emergency Contact *
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            Name *
                          </label>
                          <input
                            type="text"
                            value={emergencyName}
                            onChange={(e) => setEmergencyName(e.target.value)}
                            className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            Phone *
                          </label>
                          <input
                            type="tel"
                            value={emergencyPhone}
                            onChange={(e) => setEmergencyPhone(e.target.value)}
                            className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            Relationship
                          </label>
                          <input
                            type="text"
                            value={emergencyRelationship}
                            onChange={(e) => setEmergencyRelationship(e.target.value)}
                            placeholder="e.g., Grandmother"
                            className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {registration?.requirements?.requireMedicalInfo && (
                    <div>
                      <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Medical Information
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            Allergies
                          </label>
                          <input
                            type="text"
                            value={allergies}
                            onChange={(e) => setAllergies(e.target.value)}
                            placeholder="List any allergies"
                            className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            Medications
                          </label>
                          <input
                            type="text"
                            value={medications}
                            onChange={(e) => setMedications(e.target.value)}
                            placeholder="List any medications"
                            className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            Medical Conditions
                          </label>
                          <textarea
                            value={medicalConditions}
                            onChange={(e) => setMedicalConditions(e.target.value)}
                            placeholder="Any conditions coaches should be aware of"
                            rows={2}
                            className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between pt-4">
                    <button 
                      onClick={() => {
                        const prevStep = getPrevStep(2);
                        if (prevStep) setFormStep(prevStep);
                      }}
                      className={`px-4 py-2 rounded-lg font-medium ${isDark ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                    >
                      ← Back
                    </button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        const nextStep = getNextStep(2);
                        if (nextStep) {
                          setFormStep(nextStep);
                        } else {
                          // No more steps, submit directly
                          handleSubmit();
                        }
                      }}
                      disabled={registration?.requirements?.requireEmergencyContact && (!emergencyName || !emergencyPhone)}
                    >
                      {requiredSteps.indexOf(2) === requiredSteps.length - 1 ? 'Submit Registration' : 'Continue'} <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Step 3: Preferences & Waiver */}
              {formStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Preferences (Optional)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Jersey Number Request
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={jerseyNumber}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Only allow numbers 0-99
                            if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 99)) {
                              setJerseyNumber(val);
                            }
                          }}
                          placeholder="0-99"
                          className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Coach Request
                        </label>
                        <input
                          type="text"
                          value={coachRequest}
                          onChange={(e) => setCoachRequest(e.target.value)}
                          placeholder="Coach's name"
                          className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Friend Request
                        </label>
                        <input
                          type="text"
                          value={friendRequest}
                          onChange={(e) => setFriendRequest(e.target.value)}
                          placeholder="Friend to be on same team"
                          className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Additional Notes
                      </label>
                      <textarea
                        value={additionalNotes}
                        onChange={(e) => setAdditionalNotes(e.target.value)}
                        placeholder="Anything else we should know?"
                        rows={2}
                        className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                      />
                    </div>
                  </div>
                  
                  {/* Waiver */}
                  {registration?.requirements?.requireWaiver && (
                    <div className={`p-4 rounded-xl border ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
                      <h3 className={`font-semibold mb-3 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                        Waiver & Release
                      </h3>
                      {registration.requirements.waiverText && (
                        <div className={`text-sm mb-4 max-h-40 overflow-y-auto p-3 rounded-lg ${isDark ? 'bg-black/20 text-slate-300' : 'bg-white text-slate-600'}`}>
                          {registration.requirements.waiverText}
                        </div>
                      )}
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={waiverAgreed}
                          onChange={(e) => setWaiverAgreed(e.target.checked)}
                          className="mt-1 w-5 h-5 rounded border-amber-500 text-amber-500 focus:ring-amber-500"
                        />
                        <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          I, <strong>{parentName || 'Parent/Guardian'}</strong>, agree to the terms of this waiver and release on behalf of <strong>{firstName || selectedExistingAthlete?.firstName || 'the athlete'} {lastName || selectedExistingAthlete?.lastName || ''}</strong>.
                        </span>
                      </label>
                    </div>
                  )}
                  
                  {/* Summary */}
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Registration Summary
                    </h3>
                    <div className={`text-sm space-y-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      <p><strong>Athlete:</strong> {firstName || selectedExistingAthlete?.firstName} {lastName || selectedExistingAthlete?.lastName}</p>
                      <p><strong>Age Group:</strong> {matchingAgeGroup?.label || ageGroup || selectedExistingAthlete?.ageGroup}</p>
                      <p><strong>Registration:</strong> {registration?.name}</p>
                      <p><strong>Fee:</strong> {registration?.registrationFee === 0 ? 'Free' : `$${registration?.registrationFee}`}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between pt-4">
                    <button 
                      onClick={() => {
                        const prevStep = getPrevStep(3);
                        if (prevStep) setFormStep(prevStep);
                      }}
                      className={`px-4 py-2 rounded-lg font-medium ${isDark ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                    >
                      ← Back
                    </button>
                    <Button
                      variant="primary"
                      onClick={handleSubmit}
                      disabled={submitting || (registration?.requirements?.requireWaiver && !waiverAgreed)}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>Submit Registration</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* CTA Section - Show when form is not open */}
        {!showForm && !registrationComplete && (
          <div className={`rounded-2xl border p-6 text-center ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
            {isOpen ? (
              <>
                <Shield className="w-12 h-12 text-purple-500 mx-auto mb-4" />
                <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Ready to Register?
                </h2>
                <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {user 
                    ? 'Click below to register your athlete.'
                    : 'Sign in or create an account to register.'}
                </p>
                {user ? (
                  <Button 
                    variant="primary"
                    onClick={() => setShowForm(true)}
                    className="px-8 py-3 text-lg"
                  >
                    Register Now
                  </Button>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to={`/auth?redirect=/register/${programId}/${registrationId}`}>
                      <Button variant="primary" className="px-8">
                        Sign In to Register
                      </Button>
                    </Link>
                    <Link to={`/auth?signup=true&redirect=/register/${programId}/${registrationId}`}>
                      <Button variant="ghost" className="px-8">
                        Create Account
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            ) : isScheduled ? (
              <>
                <Clock className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Registration Opens Soon
                </h2>
                <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Check back on {formatDate(registration.registrationOpenDate)} to register.
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Registration Closed
                </h2>
                <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  This registration is no longer accepting new signups.
                </p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
