/**
 * Season Registration Page
 * Public-facing registration page for a season
 * Parents select age group, fill out athlete info, and register
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getSeason, getProgram, registerForSeason, getSeasonByProgramId } from '../../services/seasonService';
import { getPositionsForSport, getJerseyNumberRules, validateJerseyNumber } from '../../config/sportConfig';
import { calculateAgeGroup } from '../../services/ageValidator';
import type { Season, Program, AgeGroup, SeasonRegistrationInput } from '../../types/season';
import { 
  Loader2, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Check,
  CheckCircle,
  Users,
  Calendar,
  Trophy,
  Shield,
  Heart,
  FileText
} from 'lucide-react';

export default function SeasonRegistrationPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const [searchParams] = useSearchParams();
  const programIdFromQuery = searchParams.get('program');
  const navigate = useNavigate();
  const { user, userData, selectedPlayer, players } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Data state
  const [season, setSeason] = useState<Season | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state - start at step 2 if we can auto-select age group
  const [step, setStep] = useState(1);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [autoSelectedAgeGroup, setAutoSelectedAgeGroup] = useState(false);
  
  // Get athlete to register - use selected player or first player
  const athleteToRegister = selectedPlayer || players?.[0];
  
  // Get athlete's age group - prefer stored ageGroup on player, fallback to calculate from DOB
  const athleteAgeGroup = athleteToRegister?.ageGroup 
    || (athleteToRegister?.dob 
      ? calculateAgeGroup(typeof athleteToRegister.dob === 'string' ? athleteToRegister.dob : athleteToRegister.dob?.toDate?.()?.toISOString())
      : null);
  
  // Get sport-specific program name (e.g., "CYFA" for football instead of "Boys And Girls Club")
  const programDisplayName = useMemo(() => {
    if (!program) return '';
    const sportLower = program.sport?.toLowerCase() || '';
    const sportNames = (program as any).sportNames as { [key: string]: string } | undefined;
    return sportNames?.[sportLower] || program.name || 'Unknown Program';
  }, [program]);
  
  // Form data
  const [formData, setFormData] = useState({
    // Athlete info
    athleteFirstName: '',
    athleteLastName: '',
    athleteDOB: '',
    athleteGender: 'male' as 'male' | 'female' | 'other',
    athleteGrade: '',
    
    // Preferences
    preferredJerseyNumber: '',
    alternateJerseyNumbers: '',
    preferredPosition: '',
    coachNotes: '', // Schedule conflicts, coaching preferences, etc.
    
    // Parent info
    parentName: userData?.name || '',
    parentEmail: userData?.email || '',
    parentPhone: '',
    
    // Emergency contact
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyRelationship: '',
    
    // Medical
    medicalAllergies: '',
    medicalConditions: '',
    medicalMedications: '',
    medicalNotes: '',
    
    // Waiver
    waiverAccepted: false,
  });

  // Load season and program
  useEffect(() => {
    if (seasonId) {
      loadData();
    }
  }, [seasonId]);

  // Auto-select age group based on athlete's age and pre-fill athlete info
  useEffect(() => {
    // CRITICAL: Wait for BOTH season AND program to load before auto-selecting
    // Otherwise we might fall back to just athlete's age group before program data is available
    if (!season || !program || !athleteToRegister || autoSelectedAgeGroup) return;
    
    // Get available age groups from various possible sources
    let availableAgeGroups: any[] = [];
    
    // Try season.activeAgeGroups first (Program Commissioner seasons)
    if (season.activeAgeGroups && season.activeAgeGroups.length > 0) {
      availableAgeGroups = season.activeAgeGroups;
      console.log('[SeasonRegistrationPage] Using season.activeAgeGroups:', availableAgeGroups);
    }
    // Try single ageGroup from team season (Team Commissioner seasons)
    else if ((season as any).ageGroup) {
      const teamAgeGroup = (season as any).ageGroup;
      availableAgeGroups = [{ id: teamAgeGroup, name: teamAgeGroup }];
      console.log('[SeasonRegistrationPage] Using season.ageGroup (team season):', teamAgeGroup);
    }
    // Try program.ageGroups (direct array)
    else if (program?.ageGroups && program.ageGroups.length > 0) {
      availableAgeGroups = program.ageGroups;
      console.log('[SeasonRegistrationPage] Using program.ageGroups:', availableAgeGroups);
    }
    // Try program.sportsOffered (new structure with sports containing age groups)
    else if ((program as any)?.sportsOffered && Array.isArray((program as any).sportsOffered)) {
      for (const sportConfig of (program as any).sportsOffered) {
        if (sportConfig.ageGroups && sportConfig.ageGroups.length > 0) {
          // Convert AgeGroupDivision to AgeGroup format
          availableAgeGroups = sportConfig.ageGroups.map((ag: any) => ({
            id: ag.id || ag.label,
            name: ag.label || ag.id,
            minAge: ag.minBirthYear ? new Date().getFullYear() - ag.maxBirthYear : undefined,
            maxAge: ag.maxBirthYear ? new Date().getFullYear() - ag.minBirthYear : undefined,
          }));
          console.log('[SeasonRegistrationPage] Using program.sportsOffered age groups:', availableAgeGroups);
          break;
        }
      }
    }
    // Try program.sports (legacy structure)
    else if (program?.sports && Array.isArray(program.sports)) {
      for (const sport of program.sports) {
        if (sport.ageGroups && sport.ageGroups.length > 0) {
          availableAgeGroups = sport.ageGroups;
          console.log('[SeasonRegistrationPage] Using program.sports age groups:', availableAgeGroups);
          break;
        }
      }
    }
    
    console.log('[SeasonRegistrationPage] Auto-select debug:', {
      athleteName: athleteToRegister.name,
      athleteAgeGroup: athleteAgeGroup,
      athleteDOB: athleteToRegister.dob,
      seasonAgeGroup: (season as any).ageGroup,
      seasonActiveAgeGroups: season.activeAgeGroups,
      programAgeGroups: program?.ageGroups,
      programSportsOffered: (program as any)?.sportsOffered,
      availableAgeGroups,
    });
    
    // If STILL no age groups and we have athlete's age group, just use that as last resort
    if (availableAgeGroups.length === 0 && athleteAgeGroup) {
      console.log('[SeasonRegistrationPage] No age groups in season/program, using athlete age group:', athleteAgeGroup);
      const ageGroupObj = { id: athleteAgeGroup, name: athleteAgeGroup } as AgeGroup;
      setSelectedAgeGroup(ageGroupObj);
      setAutoSelectedAgeGroup(true);
      setStep(2);
      
      // Pre-fill athlete info
      const nameParts = (athleteToRegister.name || '').split(' ');
      setFormData(prev => ({
        ...prev,
        athleteFirstName: nameParts[0] || '',
        athleteLastName: nameParts.slice(1).join(' ') || '',
        athleteDOB: athleteToRegister.dob ? (typeof athleteToRegister.dob === 'string' ? athleteToRegister.dob : athleteToRegister.dob.toDate?.().toISOString().split('T')[0]) : '',
      }));
      return;
    }
    
    if (availableAgeGroups.length === 0) {
      console.log('[SeasonRegistrationPage] No age groups found, skipping auto-select');
      return;
    }
    
    // Extract numeric age from player's ageGroup (e.g., "9U" -> 9)
    const athleteAge = athleteAgeGroup ? parseInt(athleteAgeGroup.replace(/\D/g, '')) : null;
    
    // Calculate DOB-based age as fallback and for form pre-fill
    const athleteDOB = athleteToRegister.dob;
    let birthDate: Date | null = null;
    
    if (athleteDOB) {
      if (typeof athleteDOB === 'string') {
        birthDate = new Date(athleteDOB);
      } else if (athleteDOB?.toDate) {
        birthDate = athleteDOB.toDate();
      }
    }
    
    // If no athlete age group saved, we can't match properly
    if (!athleteAgeGroup) {
      console.log('[SeasonRegistrationPage] No athlete ageGroup saved on profile, cannot auto-match');
      return;
    }
    
    console.log('[SeasonRegistrationPage] Matching athlete ageGroup:', athleteAgeGroup, '(numeric:', athleteAge, ') to available groups:', availableAgeGroups);
    
    // Find matching age group - match player's stored ageGroup to season's age groups
    // Player ageGroup "9U" should match season ageGroup "9U-10U" or "9U"
    let matchedAgeGroup: AgeGroup | null = null;
    
    for (const ag of availableAgeGroups) {
      const agName = typeof ag === 'string' ? ag : (ag.name || ag.id);
      const agNameUpper = agName?.toUpperCase() || '';
      const athleteAgeGroupUpper = athleteAgeGroup.toUpperCase();
      
      // EXACT MATCH: player "9U" matches season "9U"
      if (agNameUpper === athleteAgeGroupUpper) {
        matchedAgeGroup = typeof ag === 'string' ? { id: ag, name: ag } as AgeGroup : ag;
        console.log('[SeasonRegistrationPage] EXACT MATCH:', agName);
        break;
      }
      
      // RANGE MATCH: player "9U" should match season "9U-10U" or "8U-9U"
      // Check if season age group is a range that includes player's age
      if (agNameUpper.includes('-') || agNameUpper.includes('/')) {
        const parts = agNameUpper.split(/[-\/]/);
        const minAgeStr = parts[0].replace(/\D/g, '');
        const maxAgeStr = parts[1]?.replace(/\D/g, '') || minAgeStr;
        const minAge = parseInt(minAgeStr) || 0;
        const maxAge = parseInt(maxAgeStr) || minAge;
        
        if (athleteAge !== null && athleteAge >= minAge && athleteAge <= maxAge) {
          matchedAgeGroup = typeof ag === 'string' ? { id: ag, name: ag } as AgeGroup : ag;
          console.log('[SeasonRegistrationPage] RANGE MATCH:', agName, '- athlete', athleteAge, 'falls in range', minAge, '-', maxAge);
          break;
        }
      }
    }
    
    if (matchedAgeGroup) {
      console.log('[SeasonRegistrationPage] MATCH FOUND! Setting selectedAgeGroup to:', matchedAgeGroup, 'athleteAgeGroup was:', athleteAgeGroup);
      setSelectedAgeGroup(matchedAgeGroup);
      setAutoSelectedAgeGroup(true);
      setStep(2); // Skip to athlete info step
      
      // Also pre-fill athlete info
      const nameParts = (athleteToRegister.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Get DOB in proper format
      const dobString = birthDate 
        ? birthDate.toISOString().split('T')[0] 
        : (typeof athleteToRegister.dob === 'string' ? athleteToRegister.dob : '');
      
      setFormData(prev => ({
        ...prev,
        athleteFirstName: firstName,
        athleteLastName: lastName,
        athleteDOB: dobString,
      }));
      
      console.log('[SeasonRegistrationPage] Auto-selected age group:', matchedAgeGroup.name, 'for athlete ageGroup:', athleteAgeGroup);
    } else {
      console.log('[SeasonRegistrationPage] No matching age group found for athlete ageGroup:', athleteAgeGroup, 'in:', availableAgeGroups.map(ag => typeof ag === 'string' ? ag : ag.name));
    }
  }, [season, program, athleteToRegister, autoSelectedAgeGroup, athleteAgeGroup]);

  // Pre-fill parent info from user data
  useEffect(() => {
    if (userData) {
      setFormData(prev => ({
        ...prev,
        // Parent info from profile
        parentName: userData.name || prev.parentName,
        parentEmail: userData.email || prev.parentEmail,
        parentPhone: userData.phone || prev.parentPhone,
        // Emergency contact from profile (if they have one saved)
        emergencyContactName: userData.emergencyContact?.name || prev.emergencyContactName,
        emergencyContactPhone: userData.emergencyContact?.phone || prev.emergencyContactPhone,
        emergencyRelationship: userData.emergencyContact?.relationship || prev.emergencyRelationship,
      }));
    }
  }, [userData]);

  // Pre-fill medical info from athlete
  useEffect(() => {
    if (athleteToRegister?.medical) {
      const medical = athleteToRegister.medical;
      setFormData(prev => ({
        ...prev,
        medicalAllergies: (medical.allergies && medical.allergies !== 'None') ? medical.allergies : prev.medicalAllergies,
        medicalConditions: (medical.conditions && medical.conditions !== 'None') ? medical.conditions : prev.medicalConditions,
        medicalMedications: (medical.medications && medical.medications !== 'None') ? medical.medications : prev.medicalMedications,
      }));
    }
  }, [athleteToRegister]);

  const loadData = async () => {
    if (!seasonId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let seasonData;
      
      // If we have programId from query params, use direct lookup (faster)
      if (programIdFromQuery) {
        seasonData = await getSeasonByProgramId(programIdFromQuery, seasonId);
      } else {
        // Fall back to searching all programs
        seasonData = await getSeason(seasonId);
      }
      
      if (!seasonData) {
        setError('Season not found');
        return;
      }
      
      // Check if registration is allowed
      // Allow if status is 'registration' OR if we're within the registration date window
      const now = new Date();
      const openDate = seasonData.registrationOpenDate?.toDate?.();
      const closeDate = seasonData.registrationCloseDate?.toDate?.();
      
      const isWithinDates = (!openDate || openDate <= now) && (!closeDate || closeDate >= now);
      const isRegistrationStatus = seasonData.status === 'registration';
      const isNotCompleted = seasonData.status !== 'completed' && seasonData.status !== 'closed';
      
      // Registration is open if: (status is 'registration') OR (within dates AND not completed/closed)
      if (!isRegistrationStatus && !(isWithinDates && isNotCompleted)) {
        setError('Registration is not currently open for this season');
        return;
      }
      
      console.log('[SeasonRegistrationPage] Season loaded:', {
        id: seasonData.id,
        name: seasonData.name,
        ageGroup: (seasonData as any).ageGroup,
        activeAgeGroups: seasonData.activeAgeGroups,
        sportsOffered: (seasonData as any).sportsOffered,
        programId: seasonData.programId,
      });
      
      setSeason(seasonData);
      
      const programData = await getProgram(seasonData.programId);
      console.log('[SeasonRegistrationPage] Program loaded:', {
        id: programData?.id,
        ageGroups: programData?.ageGroups,
      });
      setProgram(programData);
    } catch (err) {
      console.error('Error loading season:', err);
      setError('Failed to load registration information');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !season || !program || !selectedAgeGroup) {
      setError('Missing required information');
      return;
    }
    
    // Only check waiver if it's required
    const waiverRequired = (season as any)?.requireWaiver === true;
    if (waiverRequired && !formData.waiverAccepted) {
      setError('You must accept the waiver to continue');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      // Parse jersey numbers
      let preferredJersey: number | undefined;
      let alternateJerseys: number[] = [];
      
      if (formData.preferredJerseyNumber) {
        const num = parseInt(formData.preferredJerseyNumber);
        if (!isNaN(num)) {
          // Validate jersey number for sport
          const validation = validateJerseyNumber(num, program.sport);
          if (!validation.valid) {
            setError(validation.error || 'Invalid jersey number');
            setSaving(false);
            return;
          }
          preferredJersey = num;
        }
      }
      
      if (formData.alternateJerseyNumbers) {
        alternateJerseys = formData.alternateJerseyNumbers
          .split(',')
          .map(s => parseInt(s.trim()))
          .filter(n => !isNaN(n) && validateJerseyNumber(n, program.sport).valid);
      }
      
      const input: SeasonRegistrationInput = {
        seasonId: season.id,
        programId: program.id,
        programName: programDisplayName,
        seasonName: season.name,
        ageGroupId: selectedAgeGroup.id,
        ageGroupName: selectedAgeGroup.name,
        sport: program.sport,
        
        parentUserId: user.uid,
        commissionerUserId: program.commissionerId, // For notification
        
        // Include athlete ID for draft pool status tracking
        athleteId: athleteToRegister?.id,
        
        athleteFirstName: formData.athleteFirstName.trim(),
        athleteLastName: formData.athleteLastName.trim(),
        athleteNickname: athleteToRegister?.nickname || undefined,
        athleteUsername: athleteToRegister?.username || undefined,
        athleteDOB: new Date(formData.athleteDOB),
        athleteGender: formData.athleteGender,
        athleteGrade: formData.athleteGrade ? parseInt(formData.athleteGrade) : undefined,
        
        preferredJerseyNumber: preferredJersey,
        alternateJerseyNumbers: alternateJerseys,
        preferredPosition: formData.preferredPosition || undefined,
        coachNotes: formData.coachNotes?.trim() || undefined,
        
        parentName: formData.parentName.trim(),
        parentEmail: formData.parentEmail.trim(),
        parentPhone: formData.parentPhone.trim(),
        
        emergencyContactName: formData.emergencyContactName.trim(),
        emergencyContactPhone: formData.emergencyContactPhone.trim(),
        emergencyRelationship: formData.emergencyRelationship.trim(),
        
        medicalAllergies: formData.medicalAllergies.trim(),
        medicalConditions: formData.medicalConditions.trim(),
        medicalMedications: formData.medicalMedications.trim(),
        medicalNotes: formData.medicalNotes.trim(),
        
        // If waiver not required, auto-accept. If required, use form value.
        waiverAccepted: waiverRequired ? formData.waiverAccepted : true,
        
        amountDue: season.registrationFee,
        amountPaid: 0, // TODO: Integrate payment
        paymentMethod: 'pending' as any,
      };
      
      await registerForSeason(input);
      setSuccess(true);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to complete registration');
    } finally {
      setSaving(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Check if current step is valid
  const isStepValid = () => {
    switch (step) {
      case 1:
        return !!selectedAgeGroup;
      case 2:
        // Step 2 is now just preferences - always valid (optional fields)
        return true;
      case 3: {
        // Parent info always required
        const hasParentInfo = !!(formData.parentName && formData.parentEmail && formData.parentPhone);
        
        // Emergency contact only required if season requires it
        const needsEmergency = season?.requireEmergencyContact !== false;
        const hasEmergencyInfo = !!(formData.emergencyContactName && formData.emergencyContactPhone && formData.emergencyRelationship);
        
        // Medical info only required if season requires it
        const needsMedical = season?.requireMedicalInfo === true;
        const hasMedicalInfo = !!(formData.medicalAllergies || formData.medicalConditions || formData.medicalMedications);
        
        return hasParentInfo && 
          (!needsEmergency || hasEmergencyInfo) && 
          (!needsMedical || hasMedicalInfo);
      }
      case 4:
        // Only require waiver acceptance if season explicitly requires it
        // Default to NOT requiring waiver unless explicitly set to true
        const needsWaiver = (season as any)?.requireWaiver === true;
        return !needsWaiver || formData.waiverAccepted;
      default:
        return false;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    );
  }

  // Error state
  if (error && !season) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center p-4`}>
        <div className={`max-w-md w-full text-center ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-8 shadow-lg`}>
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Registration Unavailable
          </h2>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center p-4`}>
        <div className={`max-w-md w-full text-center ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-8 shadow-lg`}>
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Registration Complete!
          </h2>
          <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {formData.athleteFirstName} has been registered for {season?.name}. 
            You'll be notified when teams are assigned.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center p-4`}>
        <div className={`max-w-md w-full text-center ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-8 shadow-lg`}>
          <Users className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Sign In Required
          </h2>
          <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Please sign in or create an account to register for {season?.name}.
          </p>
          <button
            onClick={() => navigate('/login', { state: { returnTo: `/register/${seasonId}` } })}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!season || !program) return null;

  const positions = getPositionsForSport(program.sport);
  const jerseyRules = getJerseyNumberRules(program.sport);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {programDisplayName}
            </h1>
            <p className={`text-lg ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              {season.name} Registration
            </p>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Registration Fee: ${(season.registrationFee / 100).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} py-4`}>
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between">
            {[
              // Only show Age Group step if not auto-selected
              ...(autoSelectedAgeGroup ? [] : [{ num: 1, label: 'Age Group', icon: Users }]),
              { num: autoSelectedAgeGroup ? 1 : 2, label: 'Preferences', icon: Trophy },
              { num: autoSelectedAgeGroup ? 2 : 3, label: 'Contact', icon: Shield },
              { num: autoSelectedAgeGroup ? 3 : 4, label: 'Confirm', icon: FileText },
            ].map((s, idx, arr) => {
              const Icon = s.icon;
              // Adjust step comparison for auto-selected flow
              const displayStep = autoSelectedAgeGroup ? step - 1 : step;
              const isActive = displayStep === s.num;
              const isComplete = displayStep > s.num;
              
              return (
                <React.Fragment key={s.label}>
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isComplete ? 'bg-green-500 text-white' :
                      isActive ? 'bg-blue-600 text-white' :
                      isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-300 text-gray-600'
                    }`}>
                      {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className={`text-xs mt-1 ${
                      isActive ? (isDark ? 'text-blue-400' : 'text-blue-600') : 
                      isDark ? 'text-gray-500' : 'text-gray-600'
                    }`}>
                      {s.label}
                    </span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${
                      displayStep > s.num ? 'bg-green-500' : isDark ? 'bg-gray-700' : 'bg-gray-300'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-2xl mx-auto px-4 mt-4">
          <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-500">{error}</span>
          </div>
        </div>
      )}

      {/* Form Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-6`}>
          
          {/* Step 1: Age Group Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Select Age Group
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Choose the age group for your athlete
              </p>
              
              <div className="grid gap-3">
                {/* Use season.activeAgeGroups, or fall back to program.ageGroups */}
                {((season.activeAgeGroups && season.activeAgeGroups.length > 0) 
                  ? season.activeAgeGroups 
                  : (program?.ageGroups || [])
                ).map(ag => {
                  // Handle both AgeGroup objects and simple string arrays
                  const ageGroupId = typeof ag === 'string' ? ag : ag.id;
                  const ageGroupName = typeof ag === 'string' ? ag : ag.name;
                  const count = season.registrationCounts?.[ageGroupId] || 0;
                  const isFull = season.maxPlayersPerAgeGroup 
                    ? count >= season.maxPlayersPerAgeGroup 
                    : false;
                  
                  return (
                    <button
                      key={ageGroupId}
                      onClick={() => !isFull && setSelectedAgeGroup(typeof ag === 'string' ? { id: ag, name: ag } as AgeGroup : ag)}
                      disabled={isFull}
                      className={`p-4 rounded-lg border text-left transition-colors ${
                        selectedAgeGroup?.id === ageGroupId
                          ? 'border-blue-500 bg-blue-500/20'
                          : isFull
                            ? isDark ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed' : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                            : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {ageGroupName}
                          </div>
                          {typeof ag !== 'string' && ag.minGrade !== undefined && ag.maxGrade !== undefined && (
                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              Grades {ag.minGrade}-{ag.maxGrade}
                            </div>
                          )}
                          {typeof ag !== 'string' && ag.minAge !== undefined && ag.maxAge !== undefined && (
                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              Ages {ag.minAge}-{ag.maxAge}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {isFull ? (
                            <span className="text-sm text-red-500">Full</span>
                          ) : season.maxPlayersPerAgeGroup ? (
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {count} / {season.maxPlayersPerAgeGroup}
                            </span>
                          ) : (
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {count} registered
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Athlete Information */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Preferences & Notes
              </h2>
              
              {/* Show which athlete is being registered and to which age group */}
              <div className={`p-4 rounded-lg border-2 ${isDark ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                    {formData.athleteFirstName?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formData.athleteFirstName} {formData.athleteLastName}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Born {formData.athleteDOB}
                      </span>
                      {athleteAgeGroup && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                          {athleteAgeGroup}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Age Group Badge - Prominent */}
                <div className={`mt-3 pt-3 border-t ${isDark ? 'border-blue-500/20' : 'border-blue-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Registering to Division:</span>
                    <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
                      {/* Show season's age group division, or fall back to athlete's calculated */}
                      {selectedAgeGroup?.name || (season as any)?.ageGroup || athleteAgeGroup || 'Age Group'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Jersey & Position Preferences */}
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <h3 className={`font-medium mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Jersey & Position Preferences (Optional)
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Preferred Jersey #
                    </label>
                    <input
                      type="number"
                      value={formData.preferredJerseyNumber}
                      onChange={(e) => {
                        // Limit to 2 digits max (0-99)
                        const val = e.target.value;
                        if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 99 && val.length <= 2)) {
                          updateFormData('preferredJerseyNumber', val);
                        }
                      }}
                      onKeyDown={(e) => {
                        // Prevent typing if already 2 digits
                        const val = (e.target as HTMLInputElement).value;
                        if (val.length >= 2 && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      placeholder={jerseyRules ? `${jerseyRules.min}-${jerseyRules.max}` : '0-99'}
                      min={0}
                      max={99}
                      className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Preferred Position
                    </label>
                    <select
                      value={formData.preferredPosition}
                      onChange={(e) => updateFormData('preferredPosition', e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    >
                      <option value="">Select position</option>
                      {positions.map(pos => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="mt-3">
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Alternate Jersey Numbers (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formData.alternateJerseyNumbers}
                    onChange={(e) => updateFormData('alternateJerseyNumbers', e.target.value)}
                    placeholder="e.g., 7, 12, 23"
                    className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  />
                </div>
              </div>

              {/* Suggestions & Notes */}
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <h3 className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Notes for Coach (Optional)
                </h3>
                <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Schedule conflicts, coaching preferences, or anything the coach should know
                </p>
                
                <textarea
                  value={formData.coachNotes || ''}
                  onChange={(e) => updateFormData('coachNotes', e.target.value)}
                  placeholder="Examples:&#10;• Cannot attend Tuesday practices&#10;• Prefers to play with sibling (#24)&#10;• Available for team captain role&#10;• Has prior experience at RB"
                  rows={4}
                  className={`w-full px-3 py-2 rounded-lg border resize-none ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
              </div>
            </div>
          )}

          {/* Step 3: Contact & Medical Info */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Check if all required info is already filled from profile */}
              {(() => {
                const hasParentInfo = formData.parentName && formData.parentEmail && formData.parentPhone;
                const needsEmergency = season?.requireEmergencyContact !== false;
                const hasEmergencyInfo = formData.emergencyContactName && formData.emergencyContactPhone && formData.emergencyRelationship;
                const needsMedical = season?.requireMedicalInfo === true;
                
                const allPrefilled = hasParentInfo && 
                  (!needsEmergency || hasEmergencyInfo);
                
                if (allPrefilled && !needsMedical) {
                  return (
                    <div className={`p-4 rounded-lg border-2 ${isDark ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                        <h2 className={`text-lg font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                          Contact Info Pre-Filled
                        </h2>
                      </div>
                      <p className={`text-sm mb-4 ${isDark ? 'text-green-300/80' : 'text-green-600'}`}>
                        All required information has been loaded from your profile. Review below and continue.
                      </p>
                      
                      <div className={`p-3 rounded-lg space-y-2 text-sm ${isDark ? 'bg-black/20' : 'bg-white'}`}>
                        <div className="flex justify-between">
                          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Parent:</span>
                          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{formData.parentName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Email:</span>
                          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{formData.parentEmail}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Phone:</span>
                          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{formData.parentPhone}</span>
                        </div>
                        {needsEmergency && (
                          <>
                            <div className={`border-t pt-2 mt-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                              <span className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Emergency Contact</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{formData.emergencyRelationship}:</span>
                              <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{formData.emergencyContactName} ({formData.emergencyContactPhone})</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                }
                
                // Show editable form for missing info
                return (
                  <>
                    <div>
                      <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Contact Information
                      </h2>
                      {(userData?.name || userData?.email || userData?.phone) && (
                        <p className={`text-sm mt-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                          ✓ Pre-filled from your profile
                        </p>
                      )}
                      
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Full Name *
                          </label>
                          <input
                            type="text"
                            value={formData.parentName}
                            onChange={(e) => updateFormData('parentName', e.target.value)}
                            className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              Email *
                            </label>
                            <input
                              type="email"
                              value={formData.parentEmail}
                              onChange={(e) => updateFormData('parentEmail', e.target.value)}
                              className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                            />
                          </div>
                          <div>
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              Phone *
                            </label>
                            <input
                              type="tel"
                              value={formData.parentPhone}
                              onChange={(e) => updateFormData('parentPhone', e.target.value)}
                              placeholder="(555) 123-4567"
                              className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Emergency Contact - Only if required */}
                    {needsEmergency && (
                      <div>
                        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          Emergency Contact *
                        </h3>
                        
                        <div className="mt-3 space-y-4">
                          <div>
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              Contact Name
                            </label>
                            <input
                              type="text"
                              value={formData.emergencyContactName}
                              onChange={(e) => updateFormData('emergencyContactName', e.target.value)}
                              className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Phone
                              </label>
                              <input
                                type="tel"
                                value={formData.emergencyContactPhone}
                                onChange={(e) => updateFormData('emergencyContactPhone', e.target.value)}
                                className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                              />
                            </div>
                            <div>
                              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Relationship
                              </label>
                              <input
                                type="text"
                                value={formData.emergencyRelationship}
                                onChange={(e) => updateFormData('emergencyRelationship', e.target.value)}
                                placeholder="e.g., Grandparent"
                                className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Medical Info - Only if required by season */}
                    {needsMedical && (
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <Heart className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
                          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Medical Information *
                          </h3>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              Allergies
                            </label>
                            <input
                              type="text"
                              value={formData.medicalAllergies}
                              onChange={(e) => updateFormData('medicalAllergies', e.target.value)}
                              placeholder="e.g., Peanuts, Bee stings (or 'None')"
                              className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                            />
                          </div>
                          <div>
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              Medical Conditions
                            </label>
                            <input
                              type="text"
                              value={formData.medicalConditions}
                              onChange={(e) => updateFormData('medicalConditions', e.target.value)}
                              placeholder="e.g., Asthma, Diabetes (or 'None')"
                              className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                            />
                          </div>
                          <div>
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              Medications
                            </label>
                            <input
                              type="text"
                              value={formData.medicalMedications}
                              onChange={(e) => updateFormData('medicalMedications', e.target.value)}
                              placeholder="e.g., Inhaler, EpiPen (or 'None')"
                              className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Step 4: Review & Waiver */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Review & Confirm
              </h2>
              
              {/* Summary */}
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Athlete:</span>
                    <span className={`ml-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formData.athleteFirstName} {formData.athleteLastName}
                    </span>
                  </div>
                  <div>
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Age Group:</span>
                    <span className={`ml-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {selectedAgeGroup?.name}
                    </span>
                  </div>
                  <div>
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Program:</span>
                    <span className={`ml-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {programDisplayName}
                    </span>
                  </div>
                  <div>
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Season:</span>
                    <span className={`ml-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {season.name}
                    </span>
                  </div>
                </div>
                
                <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-600' : 'border-gray-200'} flex justify-between items-center`}>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Registration Fee:
                  </span>
                  <span className={`text-xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    ${(season.registrationFee / 100).toFixed(2)}
                  </span>
                </div>
              </div>
              
              {/* Waiver - Only show if explicitly required */}
              {(season as any).requireWaiver === true && (
                <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700/30 border-gray-600' : 'bg-yellow-50 border-yellow-200'}`}>
                  <h3 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Waiver & Release
                  </h3>
                  <div className={`text-sm max-h-32 overflow-y-auto mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <p className="mb-2">
                      By checking the box below, I acknowledge that I am the parent/legal guardian of the above-named athlete 
                      and give permission for their participation in {programDisplayName} {season.name}.
                    </p>
                    <p className="mb-2">
                      I understand that participation in youth sports involves inherent risks, including but not limited to 
                      physical injury. I agree to hold harmless the organization, coaches, volunteers, and facilities from 
                      any claims arising from participation.
                    </p>
                    <p>
                      I also consent to emergency medical treatment if required and cannot be reached.
                    </p>
                  </div>
                  
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.waiverAccepted}
                      onChange={(e) => updateFormData('waiverAccepted', e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      I have read and agree to the waiver above. I confirm that all information provided is accurate.
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className={`flex justify-between mt-6 pt-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={() => {
                // If on step 2 and age group was auto-selected, Cancel goes back to events
                if (step === 2 && autoSelectedAgeGroup) {
                  navigate(-1); // Go back to previous page
                } else if (step === 1) {
                  navigate(-1); // Can't go back from step 1, so cancel
                } else {
                  setStep(s => s - 1);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              {(step === 2 && autoSelectedAgeGroup) || step === 1 ? 'Cancel' : 'Back'}
            </button>
            
            {step < 4 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!isStepValid()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={saving || ((season as any)?.requireWaiver === true && !formData.waiverAccepted)}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Complete Registration
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
