/**
 * Commissioner Registration Setup Component
 * World-class wizard for creating independent registrations
 * 
 * Types Supported:
 * - Age Pool (for draft/team assignment)
 * - Camp
 * - Tryout
 * - Event
 * - Tournament
 * - Clinic
 * 
 * Features:
 * - Multi-step wizard with validation
 * - Age group configuration
 * - Flexible payment options (early bird, late fees, payment plans)
 * - Requirements configuration (medical, waivers, etc.)
 * - Capacity management
 * - Custom fields support
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  Calendar, 
  DollarSign, 
  Users,
  ChevronRight, 
  ChevronLeft,
  Check,
  Loader2,
  X,
  Plus,
  Trash2,
  Settings,
  FileText,
  ClipboardList,
  Trophy,
  Target,
  Star,
  Clock,
  AlertCircle,
  Info,
  Link2,
} from 'lucide-react';
import { Button, Badge, GlassCard, GlassPanel, GradientText } from '../ui/OSYSComponents';
import { OSYSInput, OSYSTextarea, OSYSSelect, OSYSModal } from '../ui/OSYSFormElements';
import { 
  createRegistration,
  generateDefaultAgeGroups,
  getRegistrationTypeLabel,
  seasonHasRegistration
} from '../../services/registrationService';
import type { 
  Program,
  SportType,
  ProgramRegistration,
  RegistrationType,
  RegistrationOutcome,
  RegistrationAgeGroup,
  RegistrationCustomField,
  ProgramSeason,
  LeagueSeason
} from '../../types';
import { toastError, toastSuccess } from '../../services/toast';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../../services/firebase';

// ============================================
// CONSTANTS
// ============================================

const REGISTRATION_TYPES: { value: RegistrationType; label: string; description: string; icon: string }[] = [
  { value: 'age_pool', label: 'Season Registration', description: 'Seasonal registration with draft or team assignment', icon: '👥' },
  { value: 'tryout', label: 'Tryout', description: 'Evaluation-based team selection', icon: '🎯' },
  { value: 'camp', label: 'Camp', description: 'Multi-day training event', icon: '⛺' },
  { value: 'clinic', label: 'Clinic', description: 'Skills training session', icon: '📋' },
  { value: 'tournament', label: 'Tournament', description: 'Competitive team event', icon: '🏆' },
  { value: 'event', label: 'General Event', description: 'Any other registration event', icon: '📅' }
];

const OUTCOME_TYPES: { value: RegistrationOutcome; label: string; description: string; forTypes: RegistrationType[] }[] = [
  { value: 'draft_pool', label: 'Draft Pool', description: 'Players will be drafted to teams', forTypes: ['age_pool'] },
  { value: 'team_select', label: 'Team Selection', description: 'Coaches select players after evaluation', forTypes: ['tryout'] },
  { value: 'auto_assign', label: 'Auto-Assign', description: 'Automatically assign to teams/groups', forTypes: ['age_pool', 'camp', 'clinic'] },
  { value: 'rsvp_list', label: 'RSVP List', description: 'Just track attendance/participation', forTypes: ['camp', 'clinic', 'event', 'tournament'] },
  { value: 'waitlist', label: 'Waitlist', description: 'Join waitlist for spots', forTypes: ['tryout', 'camp', 'clinic'] }
];

// ============================================
// COMPONENT PROPS
// ============================================

interface Props {
  programId: string;
  program: Program;
  sport?: SportType;
  onComplete?: (registrationId: string) => void;
  onCancel?: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const CommissionerRegistrationSetup: React.FC<Props> = ({
  programId,
  program,
  sport,
  onComplete,
  onCancel
}) => {
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Get sport-specific program name (e.g., "CYFA" for football instead of "Boys And Girls Club")
  const sportToUse = sport || program?.sport || 'football';
  const sportProgramName = useMemo(() => {
    if (!program) return 'Unknown Program';
    const sportLower = sportToUse?.toLowerCase() || '';
    const sportNames = (program as any).sportNames as { [key: string]: string } | undefined;
    return sportNames?.[sportLower] || program.name || 'Unknown Program';
  }, [program, sportToUse]);
  
  // ============================================
  // WIZARD STATE
  // ============================================
  
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 5;
  
  // Step 1: Type Selection
  const [registrationType, setRegistrationType] = useState<RegistrationType>('age_pool');
  const [registrationOutcome, setRegistrationOutcome] = useState<RegistrationOutcome>('draft_pool');
  
  // Step 2: Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [registrationOpenDate, setRegistrationOpenDate] = useState('');
  
  // Season linking (for age_pool type)
  // Can be either ProgramSeason or LeagueSeason depending on league membership
  const [availableSeasons, setAvailableSeasons] = useState<(ProgramSeason | LeagueSeason)[]>([]);
  const [seasonsWithRegistrations, setSeasonsWithRegistrations] = useState<Map<string, string>>(new Map()); // seasonId -> registrationName
  const [linkedSeason, setLinkedSeason] = useState<ProgramSeason | LeagueSeason | null>(null);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [hasValidSeasons, setHasValidSeasons] = useState<boolean | null>(null); // null = still loading, true/false = result
  const [registrationCloseDate, setRegistrationCloseDate] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [location, setLocation] = useState('');
  
  // Step 3: Fees & Payment
  const [registrationFee, setRegistrationFee] = useState(150);
  const [payInFull, setPayInFull] = useState(true);
  const [paymentPlan, setPaymentPlan] = useState(false);
  const [paymentPlanInstallments, setPaymentPlanInstallments] = useState(2);
  const [payInPerson, setPayInPerson] = useState(true);
  const [hasEarlyBird, setHasEarlyBird] = useState(false);
  const [earlyBirdAmount, setEarlyBirdAmount] = useState(0);
  const [earlyBirdDeadline, setEarlyBirdDeadline] = useState('');
  const [hasLateFee, setHasLateFee] = useState(false);
  const [lateFeeAmount, setLateFeeAmount] = useState(25);
  const [lateFeeStartDate, setLateFeeStartDate] = useState('');
  
  // Step 4: Age Groups & Capacity
  const [useAgeGroups, setUseAgeGroups] = useState(true);
  const [ageGroups, setAgeGroups] = useState<RegistrationAgeGroup[]>([]);
  const [hasCapacity, setHasCapacity] = useState(false);
  const [totalCapacity, setTotalCapacity] = useState(100);
  
  // Step 5: Requirements
  const [requireMedical, setRequireMedical] = useState(true);
  const [requireEmergencyContact, setRequireEmergencyContact] = useState(true);
  const [requireUniformSizes, setRequireUniformSizes] = useState(false);
  const [requireWaiver, setRequireWaiver] = useState(true);
  const [waiverText, setWaiverText] = useState('');
  const [customFields, setCustomFields] = useState<RegistrationCustomField[]>([]);
  
  // Loading
  const [creating, setCreating] = useState(false);
  
  // ============================================
  // FETCH ACTIVE SEASONS (League or Program)
  // ============================================
  
  // Check if program is part of a league FOR THIS SPORT
  // Use sport-specific leagueIds first, fall back to legacy leagueId
  const sportKey = sportToUse?.toLowerCase() || 'football';
  const sportLeagueId = (program as any)?.leagueIds?.[sportKey] || 
    // Fall back to legacy leagueId only if it matches the current sport
    ((program as any)?.sport?.toLowerCase() === sportKey ? (program as any)?.leagueId : null);
  const isInLeague = !!sportLeagueId;
  
  // Track if we've done the initial availability check
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  
  // Combined effect: Fetch seasons AND check if Season Registration should be allowed
  // This runs on mount AND when registrationType changes to 'age_pool'
  useEffect(() => {
    const fetchSeasonsAndCheckAvailability = async () => {
      if (!programId) return;
      
      // Always do the availability check on first run, or when switching to age_pool
      const shouldCheck = !initialCheckDone || registrationType === 'age_pool';
      if (!shouldCheck) return;
      
      setLoadingSeasons(true);
      try {
        let seasonsData: (ProgramSeason | LeagueSeason)[] = [];
        
        if (isInLeague && sportLeagueId) {
          const leagueSeasonsQuery = query(
            collection(db, 'leagueSeasons'),
            where('leagueId', '==', sportLeagueId)
          );
          
          const snapshot = await getDocs(leagueSeasonsQuery);
          
          seasonsData = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as LeagueSeason))
            .filter(s => s.status === 'upcoming');
        } else {
          const programSeasonsQuery = query(collection(db, 'programs', programId, 'seasons'));
          
          const snapshot = await getDocs(programSeasonsQuery);
          
          seasonsData = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as ProgramSeason))
            .filter(s => {
              if (s.status !== 'setup') return false;
              const seasonSport = (s as any).sport?.toLowerCase();
              const currentSport = sportToUse?.toLowerCase();
              return !seasonSport || !currentSport || seasonSport === currentSport;
            });
        }
        
        seasonsData.sort((a, b) => {
          const aTime = (a as any).createdAt?.toMillis?.() || (a as any).startDate?.toMillis?.() || 0;
          const bTime = (b as any).createdAt?.toMillis?.() || (b as any).startDate?.toMillis?.() || 0;
          return bTime - aTime;
        });
        
        // Check which seasons already have registrations
        const existingRegistrationsMap = new Map<string, string>();
        await Promise.all(
          seasonsData.map(async (season) => {
            const check = await seasonHasRegistration(programId, season.id);
            if (check.exists && check.registrationName) {
              existingRegistrationsMap.set(season.id, check.registrationName);
            }
          })
        );
        
        setSeasonsWithRegistrations(existingRegistrationsMap);
        setAvailableSeasons(seasonsData);
        
        // KEY CHECK: Are there ANY seasons without registrations?
        const seasonsWithoutRegistrations = seasonsData.filter(s => !existingRegistrationsMap.has(s.id));
        const hasAvailableSeason = seasonsWithoutRegistrations.length > 0;
        
        console.log('[RegistrationSetup] Season availability check:', { 
          totalSeasons: seasonsData.length,
          withRegistrations: existingRegistrationsMap.size,
          available: seasonsWithoutRegistrations.length,
          hasAvailableSeason
        });
        
        // If no seasons available for registration, disable Season Registration
        setHasValidSeasons(hasAvailableSeason);
        setInitialCheckDone(true);
        
        // Auto-switch away from age_pool if no seasons available
        if (!hasAvailableSeason && registrationType === 'age_pool') {
          setRegistrationType('camp');
          setRegistrationOutcome('rsvp_list');
        }
        
        // Auto-select if there's exactly one available season
        if (seasonsWithoutRegistrations.length === 1 && !linkedSeason) {
          handleSeasonSelect(seasonsWithoutRegistrations[0]);
        }
      } catch (error) {
        console.error('Error fetching seasons:', error);
        setHasValidSeasons(true); // Allow on error
        setInitialCheckDone(true);
      } finally {
        setLoadingSeasons(false);
      }
    };
    
    fetchSeasonsAndCheckAvailability();
  }, [programId, registrationType, sportToUse, isInLeague, sportLeagueId]);
  
  // Handle season selection - auto-fill name
  const handleSeasonSelect = (season: ProgramSeason | LeagueSeason) => {
    setLinkedSeason(season);
    // Auto-fill name with sport name + season name
    const suggestedName = `${sportProgramName} ${season.name}`.trim();
    if (!name || name === '') {
      setName(suggestedName);
    }
  };
  
  const handleSeasonDeselect = () => {
    setLinkedSeason(null);
  };
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  useEffect(() => {
    // Set default dates
    const today = new Date();
    const openDate = new Date(today);
    const closeDate = new Date(today);
    closeDate.setDate(closeDate.getDate() + 30);
    
    setRegistrationOpenDate(openDate.toISOString().split('T')[0]);
    setRegistrationCloseDate(closeDate.toISOString().split('T')[0]);
    
    // Event date (for camps, clinics, etc.)
    const evtDate = new Date(closeDate);
    evtDate.setDate(evtDate.getDate() + 7);
    setEventDate(evtDate.toISOString().split('T')[0]);
    
    // Early bird deadline
    const earlyDate = new Date(today);
    earlyDate.setDate(earlyDate.getDate() + 14);
    setEarlyBirdDeadline(earlyDate.toISOString().split('T')[0]);
    
    // Late fee start
    const lateDate = new Date(closeDate);
    lateDate.setDate(lateDate.getDate() - 5);
    setLateFeeStartDate(lateDate.toISOString().split('T')[0]);
    
    // Load age groups from program's sportConfigs (use program's configured groups)
    const sportToUse = sport || program?.sport || 'football';
    const currentYear = new Date().getFullYear();
    
    // Try sportConfigs first (structured format)
    const sportConfig = program?.sportConfigs?.find((sc: any) => 
      sc.sport?.toLowerCase() === sportToUse?.toLowerCase()
    );
    
    if (sportConfig?.ageGroups && sportConfig.ageGroups.length > 0) {
      // Check if ageGroups are strings (old format) or objects (new format)
      const firstItem = sportConfig.ageGroups[0];
      
      if (typeof firstItem === 'string') {
        // Old format: ['5U', '6U', '7U-8U'] - convert to RegistrationAgeGroup
        const programAgeGroups: RegistrationAgeGroup[] = ((sportConfig.ageGroups as unknown) as string[]).map((agLabel: string) => {
          // Parse age from label (e.g., "5U" -> 5, "7U-8U" -> 7)
          const ageMatch = agLabel.match(/(\d+)/);
          const maxAgeMatch = agLabel.match(/(\d+)U?$/);
          const minAge = ageMatch ? parseInt(ageMatch[1]) : 6;
          const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : minAge;
          
          return {
            id: agLabel.toLowerCase().replace(/\s+/g, '-'),
            label: agLabel,
            ageGroups: agLabel.includes('-') ? agLabel.split('-').map(s => s.trim()) : [agLabel],
            minBirthYear: currentYear - maxAge,
            maxBirthYear: currentYear - minAge,
            capacity: 24,
            registrationCount: 0
          };
        });
        setAgeGroups(programAgeGroups);
      } else if (firstItem && typeof firstItem === 'object') {
        // New format: full AgeGroupDivision objects
        const programAgeGroups: RegistrationAgeGroup[] = sportConfig.ageGroups.map((ag: any) => ({
          id: ag.id || ag.label?.toLowerCase().replace(/\s+/g, '-') || `group-${Date.now()}`,
          label: ag.label || 'Unknown',
          ageGroups: ag.ageGroups || [ag.label],
          minBirthYear: ag.minBirthYear || currentYear - 10,
          maxBirthYear: ag.maxBirthYear || currentYear - 6,
          capacity: ag.capacity || 24,
          registrationCount: ag.registrationCount || 0
        }));
        setAgeGroups(programAgeGroups);
      } else {
        // Fallback to defaults
        setAgeGroups(generateDefaultAgeGroups(sportToUse));
      }
    } else {
      // Fall back to generating defaults if program has no config
      setAgeGroups(generateDefaultAgeGroups(sportToUse));
    }
    
    // Set default name based on type
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    if (month >= 7 && month <= 11) {
      setName(`Fall ${year} Registration`);
    } else if (month >= 2 && month <= 5) {
      setName(`Spring ${year} Registration`);
    } else {
      setName(`${year} Registration`);
    }
  }, [sport, program]);
  
  // Update outcome when type changes
  useEffect(() => {
    const validOutcomes = OUTCOME_TYPES.filter(o => o.forTypes.includes(registrationType));
    if (validOutcomes.length > 0 && !validOutcomes.some(o => o.value === registrationOutcome)) {
      setRegistrationOutcome(validOutcomes[0].value);
    }
    
    // Update defaults based on type
    if (registrationType === 'camp' || registrationType === 'clinic') {
      setUseAgeGroups(false);
      setRequireUniformSizes(false);
    } else if (registrationType === 'age_pool') {
      setUseAgeGroups(true);
      setRequireUniformSizes(true);
    }
  }, [registrationType]);
  
  // ============================================
  // VALIDATION
  // ============================================
  
  const validateStep = (stepNum: number): { valid: boolean; message?: string } => {
    switch (stepNum) {
      case 1:
        return { valid: true };
      case 2:
        if (!name.trim()) return { valid: false, message: 'Name is required' };
        if (!registrationOpenDate) return { valid: false, message: 'Open date is required' };
        if (!registrationCloseDate) return { valid: false, message: 'Close date is required' };
        if (new Date(registrationCloseDate) <= new Date(registrationOpenDate)) {
          return { valid: false, message: 'Close date must be after open date' };
        }
        return { valid: true };
      case 3:
        if (registrationFee < 0) return { valid: false, message: 'Fee cannot be negative' };
        if (hasEarlyBird && earlyBirdAmount >= registrationFee) {
          return { valid: false, message: 'Early bird amount must be less than regular fee' };
        }
        return { valid: true };
      case 4:
        if (useAgeGroups && ageGroups.length === 0) {
          return { valid: false, message: 'Add at least one age group' };
        }
        return { valid: true };
      case 5:
        return { valid: true };
      default:
        return { valid: true };
    }
  };
  
  const canProceed = useMemo(() => validateStep(step).valid, [step, name, registrationOpenDate, registrationCloseDate, registrationFee, hasEarlyBird, earlyBirdAmount, useAgeGroups, ageGroups]);
  
  // ============================================
  // HANDLERS
  // ============================================
  
  const handleNext = () => {
    const validation = validateStep(step);
    if (!validation.valid) {
      toastError(validation.message || 'Please complete required fields');
      return;
    }
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  };
  
  const handleBack = () => {
    setStep(s => Math.max(s - 1, 1));
  };
  
  const handleCreate = async () => {
    if (creating) return;
    
    setCreating(true);
    try {
      // Build registration data - avoid undefined values for Firestore
      // Auto-use season name if linked but no custom name provided
      const finalName = name.trim() || (linkedSeason ? `${sportProgramName} ${linkedSeason.name}` : '');
      
      if (!finalName) {
        toastError('Please enter a registration name');
        setCreating(false);
        return;
      }
      
      const registrationData: Omit<ProgramRegistration, 'id' | 'createdAt' | 'updatedAt' | 'registrationCount' | 'paidCount' | 'pendingCount' | 'waitlistCount'> = {
        programId,
        programName: sportProgramName,
        name: finalName,
        sport: sportToUse as SportType,
        type: registrationType,
        outcome: registrationOutcome,
        status: 'draft',
        
        // Dates
        registrationOpenDate,
        registrationCloseDate,
        
        // Capacity
        hasCapacity,
        
        // Fees
        registrationFee,
        paymentOptions: {
          payInFull: registrationFee > 0 ? payInFull : false,
          paymentPlan: registrationFee > 0 ? paymentPlan : false,
          payInPerson: registrationFee > 0 ? payInPerson : false,
          ...(registrationFee > 0 && paymentPlan ? { installmentCount: paymentPlanInstallments } : {})
        },
        
        // Requirements
        requirements: {
          requireMedicalInfo: requireMedical,
          requireEmergencyContact: requireEmergencyContact,
          requireUniformSizes: requireUniformSizes,
          requireWaiver: requireWaiver,
          ...(requireWaiver && waiverText ? { waiverText } : {}),
          ...(customFields.length > 0 ? { customFields } : {})
        },
        
        // Visibility & Settings
        waitlistEnabled: hasCapacity, // Enable waitlist if capacity is limited
        isPublic: true,
        allowOnlineRegistration: true,
        
        createdBy: user?.uid || '',
        
        // Optional fields - only add if they have values
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(eventDate ? { eventDate } : {}),
        ...(eventEndDate ? { eventEndDate } : {}),
        ...(location.trim() ? { eventLocation: location.trim() } : {}),
        ...(useAgeGroups && ageGroups.length > 0 ? { 
          ageGroups: ageGroups.map(ag => ag.id),
          ageGroupConfigs: ageGroups 
        } : {}),
        ...(hasCapacity ? { capacity: totalCapacity } : {}),
        ...(hasEarlyBird && registrationFee > 0 ? { earlyBirdFee: earlyBirdAmount, earlyBirdDeadline } : {}),
        ...(hasLateFee && registrationFee > 0 ? { lateFee: lateFeeAmount, lateAfterDate: lateFeeStartDate } : {}),
        // Link to season if selected
        ...(linkedSeason ? { 
          linkedSeasonId: linkedSeason.id, 
          linkedSeasonName: linkedSeason.name 
        } : {})
      };
      
      const registrationId = await createRegistration(programId, registrationData);
      
      toastSuccess('Registration created successfully!');
      onComplete?.(registrationId);
    } catch (error) {
      console.error('Error creating registration:', error);
      toastError('Failed to create registration');
    } finally {
      setCreating(false);
    }
  };
  
  const addAgeGroup = () => {
    const newId = `custom-${Date.now()}`;
    const currentYear = new Date().getFullYear();
    setAgeGroups([...ageGroups, {
      id: newId,
      label: 'New Age Group',
      ageGroups: [],
      minBirthYear: currentYear - 8,
      maxBirthYear: currentYear - 6,
      capacity: 20,
      registrationCount: 0
    }]);
  };
  
  const updateAgeGroup = (id: string, updates: Partial<RegistrationAgeGroup>) => {
    setAgeGroups(ageGroups.map(ag => ag.id === id ? { ...ag, ...updates } : ag));
  };
  
  const removeAgeGroup = (id: string) => {
    setAgeGroups(ageGroups.filter(ag => ag.id !== id));
  };
  
  const addCustomField = () => {
    setCustomFields([...customFields, {
      id: `field-${Date.now()}`,
      label: '',
      type: 'text',
      required: false
    }]);
  };
  
  const updateCustomField = (id: string, updates: Partial<RegistrationCustomField>) => {
    setCustomFields(customFields.map(f => f.id === id ? { ...f, ...updates } : f));
  };
  
  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter(f => f.id !== id));
  };
  
  // ============================================
  // STEP COMPONENTS
  // ============================================
  
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">What type of registration?</h2>
        <p className="text-slate-400">Choose the registration type that best fits your needs</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REGISTRATION_TYPES.map(type => {
          // Disable Season Registration if no valid seasons exist
          const isSeasonReg = type.value === 'age_pool';
          const isDisabled = isSeasonReg && hasValidSeasons === false;
          const isLoading = isSeasonReg && hasValidSeasons === null;
          
          return (
            <button
              key={type.value}
              onClick={() => !isDisabled && setRegistrationType(type.value)}
              disabled={isDisabled}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                isDisabled
                  ? 'border-amber-500/30 bg-amber-500/5 cursor-not-allowed'
                  : registrationType === type.value
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <div className="flex items-start gap-4">
                <span className={`text-3xl ${isDisabled ? 'opacity-50' : ''}`}>{type.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold ${isDisabled ? 'text-slate-300' : 'text-white'}`}>{type.label}</h3>
                    {isLoading && (
                      <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                    )}
                    {registrationType === type.value && !isDisabled && (
                      <Check className="w-5 h-5 text-purple-500" />
                    )}
                  </div>
                  <p className={`text-sm mt-1 ${isDisabled ? 'text-amber-400' : 'text-slate-400'}`}>
                    {isDisabled 
                      ? '⚠️ All seasons already have registrations - create a new season first'
                      : type.description
                    }
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Outcome Selection */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-white mb-4">What happens after registration?</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {OUTCOME_TYPES.filter(o => o.forTypes.includes(registrationType)).map(outcome => (
            <button
              key={outcome.value}
              onClick={() => setRegistrationOutcome(outcome.value)}
              className={`p-4 rounded-lg border transition-all text-left ${
                registrationOutcome === outcome.value
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{outcome.label}</span>
                {registrationOutcome === outcome.value && (
                  <Check className="w-4 h-4 text-purple-500" />
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">{outcome.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Basic Information</h2>
        <p className="text-slate-400">Set up the registration details</p>
      </div>
      
      <div className="space-y-4">
        {/* Season Linking - Only for Season Registration (age_pool) */}
        {registrationType === 'age_pool' && (
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-5 border border-amber-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white">Link to Season</h3>
            </div>
            
            {loadingSeasons ? (
              <div className="flex items-center gap-2 text-slate-400">
                <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
                Loading seasons...
              </div>
            ) : availableSeasons.length === 0 ? (
              <p className="text-slate-400 text-sm">
                No upcoming seasons available. Seasons that are already active/open or completed cannot have new registrations created. Create a new season first, or create a standalone registration.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-slate-300 text-sm">
                  Select a season to link this registration to:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableSeasons.map((season) => {
                    const hasExistingRegistration = seasonsWithRegistrations.has(season.id);
                    const existingRegName = seasonsWithRegistrations.get(season.id);
                    const isSelected = linkedSeason?.id === season.id;
                    
                    return (
                      <button
                        key={season.id}
                        type="button"
                        disabled={hasExistingRegistration}
                        onClick={() => !hasExistingRegistration && (isSelected ? handleSeasonDeselect() : handleSeasonSelect(season))}
                        className={`flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                          hasExistingRegistration
                            ? 'bg-white/5 border-white/5 cursor-not-allowed opacity-50'
                            : isSelected
                              ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30'
                              : 'bg-white/5 border-white/10 hover:border-amber-500/50 hover:bg-white/10'
                        }`}
                        title={hasExistingRegistration ? `Already has registration: ${existingRegName}` : undefined}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          hasExistingRegistration 
                            ? 'bg-white/10' 
                            : isSelected 
                              ? 'bg-amber-500' 
                              : 'bg-white/10'
                        }`}>
                          <Trophy className={`w-5 h-5 ${
                            hasExistingRegistration 
                              ? 'text-slate-500' 
                              : isSelected 
                                ? 'text-white' 
                                : 'text-amber-400'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${
                            hasExistingRegistration 
                              ? 'text-slate-500' 
                              : isSelected 
                                ? 'text-amber-300' 
                                : 'text-white'
                          }`}>
                            {season.name}
                          </p>
                          {hasExistingRegistration ? (
                            <p className="text-xs text-red-400 truncate">
                              ⚠️ Already has: {existingRegName}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 capitalize">
                              {season.status} • {(season as any).sport || sportToUse || 'All Sports'}
                            </p>
                          )}
                        </div>
                        {isSelected && !hasExistingRegistration && (
                          <div className="flex-shrink-0">
                            <Link2 className="w-5 h-5 text-amber-400" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {linkedSeason && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-amber-400">
                    <Link2 className="w-4 h-4" />
                    <span>Registration will auto-fill: <strong>{sportProgramName} {linkedSeason.name}</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Registration Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={linkedSeason ? `${sportProgramName} ${linkedSeason.name}` : 'e.g., Fall 2025 Registration'}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
          />
          {linkedSeason && !name && (
            <p className="text-xs text-amber-400 mt-1">
              Will use: {sportProgramName} {linkedSeason.name}
            </p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional details about this registration..."
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Registration Opens *
            </label>
            <input
              type="date"
              value={registrationOpenDate}
              onChange={(e) => setRegistrationOpenDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Registration Closes *
            </label>
            <input
              type="date"
              value={registrationCloseDate}
              onChange={(e) => setRegistrationCloseDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
            />
          </div>
        </div>
        
        {(registrationType === 'camp' || registrationType === 'clinic' || registrationType === 'event' || registrationType === 'tournament' || registrationType === 'tryout') && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Event Date
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                />
              </div>
              
              {(registrationType === 'camp' || registrationType === 'tournament') && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    End Date
                  </label>
                  <input
                    type="date"
                    value={eventEndDate}
                    onChange={(e) => setEventEndDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  />
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Main Field, Community Center"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
  
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Fees & Payment</h2>
        <p className="text-slate-400">Configure registration fees and payment options</p>
      </div>
      
      <div className="space-y-6">
        {/* Base Fee */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Registration Fee
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
            <input
              type="number"
              value={registrationFee}
              onChange={(e) => setRegistrationFee(Number(e.target.value))}
              min={0}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-4 py-3 text-white text-xl font-semibold focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
            />
          </div>
          <p className="text-sm text-slate-500 mt-2">Set to $0 for free registration</p>
        </div>
        
        {/* Payment Methods - Only show if fee > 0 */}
        {registrationFee > 0 && (
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="font-semibold text-white mb-4">Payment Options</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={payInFull}
                  onChange={(e) => setPayInFull(e.target.checked)}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
                />
                <div>
                  <span className="text-white">Pay in Full (Online)</span>
                  <p className="text-sm text-slate-500">Accept full payment via PayPal/Stripe</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paymentPlan}
                  onChange={(e) => setPaymentPlan(e.target.checked)}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
                />
                <div className="flex-1">
                  <span className="text-white">Payment Plan</span>
                  <p className="text-sm text-slate-500">Allow split payments</p>
                  {paymentPlan && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        value={paymentPlanInstallments}
                        onChange={(e) => setPaymentPlanInstallments(Number(e.target.value))}
                        min={2}
                        max={6}
                        className="w-20 bg-white/5 border border-white/10 rounded px-3 py-1 text-white text-sm"
                      />
                      <span className="text-slate-400 text-sm">installments</span>
                    </div>
                  )}
                </div>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={payInPerson}
                  onChange={(e) => setPayInPerson(e.target.checked)}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
                />
                <div>
                  <span className="text-white">Pay in Person</span>
                  <p className="text-sm text-slate-500">Allow cash/check payment at registration</p>
                </div>
              </label>
            </div>
          </div>
        )}
        
        {/* Early Bird & Late Fees - Only show if fee > 0 */}
        {registrationFee > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Early Bird */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <label className="flex items-center gap-3 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={hasEarlyBird}
                  onChange={(e) => setHasEarlyBird(e.target.checked)}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
                />
                <div>
                  <span className="text-white font-medium">Early Bird Discount</span>
                  <Star className="w-4 h-4 inline ml-2 text-amber-400" />
                </div>
              </label>
              
              {hasEarlyBird && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Discounted Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input
                        type="number"
                        value={earlyBirdAmount}
                        onChange={(e) => setEarlyBirdAmount(Number(e.target.value))}
                        min={0}
                        max={registrationFee - 1}
                        className="w-full bg-white/5 border border-white/10 rounded pl-8 pr-3 py-2 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Deadline</label>
                    <input
                      type="date"
                      value={earlyBirdDeadline}
                      onChange={(e) => setEarlyBirdDeadline(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
                    />
                  </div>
                  <p className="text-xs text-emerald-400">
                    Save ${registrationFee - earlyBirdAmount} before deadline!
                  </p>
                </div>
              )}
            </div>
          
          {/* Late Fee */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={hasLateFee}
                onChange={(e) => setHasLateFee(e.target.checked)}
                className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
              />
              <div>
                <span className="text-white font-medium">Late Registration Fee</span>
                <Clock className="w-4 h-4 inline ml-2 text-red-400" />
              </div>
            </label>
            
            {hasLateFee && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Additional Fee</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">+$</span>
                    <input
                      type="number"
                      value={lateFeeAmount}
                      onChange={(e) => setLateFeeAmount(Number(e.target.value))}
                      min={0}
                      className="w-full bg-white/5 border border-white/10 rounded pl-10 pr-3 py-2 text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Starts On</label>
                  <input
                    type="date"
                    value={lateFeeStartDate}
                    onChange={(e) => setLateFeeStartDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
                  />
                </div>
                <p className="text-xs text-red-400">
                  Total: ${registrationFee + lateFeeAmount} after this date
                </p>
              </div>
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  );
  
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Age Groups & Capacity</h2>
        <p className="text-slate-400">Configure divisions and limits</p>
      </div>
      
      {/* Use Age Groups Toggle */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useAgeGroups}
            onChange={(e) => setUseAgeGroups(e.target.checked)}
            className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
          />
          <div>
            <span className="text-white font-medium">Use Age Groups/Divisions</span>
            <p className="text-sm text-slate-500">Separate registrants by age</p>
          </div>
        </label>
      </div>
      
      {/* Age Groups List */}
      {useAgeGroups && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Age Groups</h3>
            <Button variant="ghost" onClick={addAgeGroup} className="text-sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Group
            </Button>
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {ageGroups.map(ag => (
              <div 
                key={ag.id}
                className="bg-white/5 rounded-lg p-4 border border-white/10"
              >
                <div className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-6">
                    <label className="block text-xs text-slate-500 mb-1">Label</label>
                    <input
                      type="text"
                      value={ag.label}
                      onChange={(e) => updateAgeGroup(ag.id, { label: e.target.value })}
                      placeholder="e.g., 6U, 7U-8U, 9U-10U"
                      className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-slate-600"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-xs text-slate-500 mb-1">Capacity (per group)</label>
                    <input
                      type="number"
                      value={ag.capacity || ''}
                      onChange={(e) => updateAgeGroup(ag.id, { capacity: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="Unlimited"
                      className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder-slate-600 text-sm"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      onClick={() => removeAgeGroup(ag.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Overall Capacity */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={hasCapacity}
            onChange={(e) => setHasCapacity(e.target.checked)}
            className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
          />
          <div>
            <span className="text-white font-medium">Set Overall Capacity Limit</span>
            <p className="text-sm text-slate-500">Limit total registrations regardless of age groups</p>
          </div>
        </label>
        
        {hasCapacity && (
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-slate-400" />
            <input
              type="number"
              value={totalCapacity}
              onChange={(e) => setTotalCapacity(Number(e.target.value))}
              min={1}
              className="w-32 bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
            />
            <span className="text-slate-400">maximum registrants</span>
          </div>
        )}
      </div>
    </div>
  );
  
  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Requirements</h2>
        <p className="text-slate-400">What information do you need from registrants?</p>
      </div>
      
      {/* Standard Requirements */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h3 className="font-semibold text-white mb-4">Standard Requirements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
            <input
              type="checkbox"
              checked={requireEmergencyContact}
              onChange={(e) => setRequireEmergencyContact(e.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
            />
            <div>
              <span className="text-white">Emergency Contact</span>
              <p className="text-xs text-slate-500">Name, phone, relationship</p>
            </div>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
            <input
              type="checkbox"
              checked={requireMedical}
              onChange={(e) => setRequireMedical(e.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
            />
            <div>
              <span className="text-white">Medical Information</span>
              <p className="text-xs text-slate-500">Allergies, conditions, medications</p>
            </div>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
            <input
              type="checkbox"
              checked={requireUniformSizes}
              onChange={(e) => setRequireUniformSizes(e.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
            />
            <div>
              <span className="text-white">Uniform Sizes</span>
              <p className="text-xs text-slate-500">Jersey, shorts, helmet size</p>
            </div>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
            <input
              type="checkbox"
              checked={requireWaiver}
              onChange={(e) => setRequireWaiver(e.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
            />
            <div>
              <span className="text-white">Liability Waiver</span>
              <p className="text-xs text-slate-500">Digital signature required</p>
            </div>
          </label>
        </div>
        
        {requireWaiver && (
          <div className="mt-4">
            <label className="block text-sm text-slate-400 mb-2">Waiver Text (optional)</label>
            <textarea
              value={waiverText}
              onChange={(e) => setWaiverText(e.target.value)}
              placeholder="Enter custom waiver text or leave blank to use default..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 resize-none text-sm"
            />
          </div>
        )}
      </div>
      
      {/* Custom Fields */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-white">Custom Fields</h3>
            <p className="text-sm text-slate-500">Add your own questions</p>
          </div>
          <Button variant="ghost" onClick={addCustomField} className="text-sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Field
          </Button>
        </div>
        
        {customFields.length > 0 ? (
          <div className="space-y-3">
            {customFields.map(field => (
              <div 
                key={field.id}
                className="bg-white/5 rounded-lg p-4 border border-white/10"
              >
                <div className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateCustomField(field.id, { label: e.target.value })}
                      placeholder="Question/Field Label"
                      className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-slate-500"
                    />
                  </div>
                  <div className="col-span-3">
                    <select
                      value={field.type}
                      onChange={(e) => updateCustomField(field.id, { type: e.target.value as any })}
                      className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm"
                    >
                      <option value="text">Text</option>
                      <option value="textarea">Long Text</option>
                      <option value="number">Number</option>
                      <option value="select">Dropdown</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateCustomField(field.id, { required: e.target.checked })}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-500"
                      />
                      <span className="text-sm text-slate-400">Required</span>
                    </label>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      onClick={() => removeCustomField(field.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {field.type === 'select' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={field.options?.join(', ') || ''}
                      onChange={(e) => updateCustomField(field.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                      placeholder="Options (comma-separated): Option 1, Option 2, Option 3"
                      className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-slate-500"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center py-4">No custom fields added</p>
        )}
      </div>
      
      {/* Review Summary */}
      <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-xl p-6 border border-purple-500/20">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-purple-400" />
          Registration Summary
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400">Type:</span>
            <p className="text-white font-medium">{getRegistrationTypeLabel(registrationType)}</p>
          </div>
          <div>
            <span className="text-slate-400">Fee:</span>
            <p className="text-white font-medium">${registrationFee}</p>
          </div>
          <div>
            <span className="text-slate-400">Opens:</span>
            <p className="text-white font-medium">{new Date(registrationOpenDate).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-slate-400">Closes:</span>
            <p className="text-white font-medium">{new Date(registrationCloseDate).toLocaleDateString()}</p>
          </div>
          {useAgeGroups && (
            <div className="col-span-2">
              <span className="text-slate-400">Age Groups:</span>
              <p className="text-white font-medium">{ageGroups.length} divisions configured</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  
  // ============================================
  // RENDER
  // ============================================
  
  const stepLabels = [
    { icon: <Target className="w-4 h-4" />, label: 'Type' },
    { icon: <FileText className="w-4 h-4" />, label: 'Details' },
    { icon: <DollarSign className="w-4 h-4" />, label: 'Fees' },
    { icon: <Users className="w-4 h-4" />, label: 'Groups' },
    { icon: <Settings className="w-4 h-4" />, label: 'Requirements' }
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 text-white relative z-[70]">
      {/* Header */}
      <div className="bg-black/40 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Create Registration</h1>
              <p className="text-sm text-slate-400">{sportProgramName}</p>
            </div>
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* Step Progress */}
          <div className="flex items-center justify-between mt-6">
            {stepLabels.map((s, i) => (
              <div key={i} className="flex items-center">
                <div 
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                    step === i + 1 
                      ? 'bg-purple-500 text-white' 
                      : step > i + 1 
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {step > i + 1 ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    s.icon
                  )}
                  <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${step > i + 1 ? 'bg-purple-500' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </div>
      
      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={step === 1 ? onCancel : handleBack}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          
          <div className="text-sm text-slate-400">
            Step {step} of {TOTAL_STEPS}
          </div>
          
          {step < TOTAL_STEPS ? (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!canProceed}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="gold"
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create Registration
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommissionerRegistrationSetup;
