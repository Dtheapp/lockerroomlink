/**
 * Commissioner Season Setup Component
 * Wizard for commissioners to create a new season and auto-generate registration pools
 * 
 * Flow:
 * 1. Season Info (name, dates)
 * 2. Sports Selection (which sports for this season)
 * 3. Registration Settings (fees, requirements)
 * 4. Review & Create
 * 
 * On create:
 * - Creates ProgramSeason document
 * - Auto-creates RegistrationPool for each sport + age group division
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { createProgramSeason } from '../../services/programSeasonService';
import { 
  Program,
  SportType, 
  SportAgeGroupConfig,
  ProgramSeason
} from '../../types';
import { 
  Calendar, 
  Trophy, 
  DollarSign, 
  FileText,
  ChevronRight, 
  ChevronLeft,
  Check,
  Loader2,
  Settings,
  Users,
  ClipboardList
} from 'lucide-react';
import { toastSuccess, toastError } from '../../services/toast';

// Sport icons
const SPORT_ICONS: Record<SportType, string> = {
  football: '🏈',
  basketball: '🏀',
  cheer: '📣',
  soccer: '⚽',
  baseball: '⚾',
  volleyball: '🏐',
  other: '🎯'
};

interface Props {
  programId?: string;
  onComplete?: (seasonId: string) => void;
  onCancel?: () => void;
}

export const CommissionerSeasonSetup: React.FC<Props> = ({ programId: propProgramId, onComplete, onCancel }) => {
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { programId: routeProgramId } = useParams<{ programId: string }>();
  const isDark = theme === 'dark';
  
  // Use prop or route param
  const programId = propProgramId || routeProgramId || '';
  
  // Program data
  const [program, setProgram] = useState<Program | null>(null);
  const [loadingProgram, setLoadingProgram] = useState(true);
  
  // Wizard step
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 4;
  
  // Step 1: Season Info
  const [seasonName, setSeasonName] = useState('');
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  const [registrationOpenDate, setRegistrationOpenDate] = useState('');
  const [registrationCloseDate, setRegistrationCloseDate] = useState('');
  
  // Step 2: Sports Selection (from program's available sports)
  const [selectedSports, setSelectedSports] = useState<SportType[]>([]);
  
  // Step 3: Registration Settings
  const [registrationFee, setRegistrationFee] = useState(150); // Default $150
  const [requireMedicalInfo, setRequireMedicalInfo] = useState(true);
  const [requireEmergencyContact, setRequireEmergencyContact] = useState(true);
  const [requireUniformSizes, setRequireUniformSizes] = useState(true);
  const [requireWaiver, setRequireWaiver] = useState(true);
  const [allowPayInFull, setAllowPayInFull] = useState(true);
  const [allowPaymentPlan, setAllowPaymentPlan] = useState(false);
  const [allowInPersonPayment, setAllowInPersonPayment] = useState(true);
  
  // Loading/Error state
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  
  // Load program data
  useEffect(() => {
    const loadProgram = async () => {
      try {
        const programDoc = await getDoc(doc(db, 'programs', programId));
        if (programDoc.exists()) {
          setProgram({ id: programDoc.id, ...programDoc.data() } as Program);
          
          // Pre-select all sports the program offers
          const programData = programDoc.data();
          if (programData.sports) {
            setSelectedSports(programData.sports);
          } else if (programData.sport) {
            setSelectedSports([programData.sport]);
          }
          
          // Set default season name
          const month = new Date().getMonth();
          const year = new Date().getFullYear();
          if (month >= 7 && month <= 11) {
            setSeasonName(`Fall ${year}`);
          } else if (month >= 2 && month <= 5) {
            setSeasonName(`Spring ${year}`);
          } else {
            setSeasonName(`${year} Season`);
          }
          
          // Set default dates
          const today = new Date();
          const openDate = new Date(today);
          const closeDate = new Date(today);
          closeDate.setDate(closeDate.getDate() + 30); // 30 days from now
          
          setRegistrationOpenDate(openDate.toISOString().split('T')[0]);
          setRegistrationCloseDate(closeDate.toISOString().split('T')[0]);
        }
      } catch (err) {
        console.error('Error loading program:', err);
        toastError('Failed to load program');
      } finally {
        setLoadingProgram(false);
      }
    };
    
    loadProgram();
  }, [programId]);
  
  // Validation per step
  const validateStep = (stepNum: number): boolean => {
    setError('');
    
    switch (stepNum) {
      case 1:
        if (!seasonName.trim()) {
          setError('Season name is required');
          return false;
        }
        if (!registrationOpenDate) {
          setError('Registration open date is required');
          return false;
        }
        if (!registrationCloseDate) {
          setError('Registration close date is required');
          return false;
        }
        if (new Date(registrationCloseDate) <= new Date(registrationOpenDate)) {
          setError('Close date must be after open date');
          return false;
        }
        return true;
        
      case 2:
        if (selectedSports.length === 0) {
          setError('Please select at least one sport for this season');
          return false;
        }
        return true;
        
      case 3:
        if (registrationFee < 0) {
          setError('Registration fee cannot be negative');
          return false;
        }
        if (!allowPayInFull && !allowPaymentPlan && !allowInPersonPayment) {
          setError('At least one payment method must be enabled');
          return false;
        }
        return true;
        
      default:
        return true;
    }
  };
  
  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };
  
  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };
  
  // Toggle sport selection
  const toggleSport = (sport: SportType) => {
    setSelectedSports(prev => 
      prev.includes(sport) 
        ? prev.filter(s => s !== sport)
        : [...prev, sport]
    );
  };
  
  // Calculate total pools that will be created
  const getTotalPools = (): number => {
    // Use program.ageGroups (flat array from AgeGroupsManager)
    const programAgeGroups = (program as any)?.ageGroups || [];
    if (programAgeGroups.length === 0) return 0;
    
    // Each selected sport gets pools for each age group
    return selectedSports.length * programAgeGroups.length;
  };
  
  // Create the season
  const handleCreate = async () => {
    if (!validateStep(step) || !program) return;
    
    setCreating(true);
    setError('');
    
    try {
      // Build sports offered using program's ageGroups (from AgeGroupsManager)
      const programAgeGroups: string[] = (program as any)?.ageGroups || [];
      
      const sportsOffered: SportAgeGroupConfig[] = selectedSports.map(sport => {
        // Convert flat ageGroups array to AgeGroupDivision format
        const ageGroupDivisions = programAgeGroups.map(ag => ({
          id: `${sport}-${ag}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          label: ag,
          type: ag.includes('-') ? 'combined' as const : 'single' as const,
          ageGroups: ag.includes('-') ? ag.split('-') : [ag],
          minBirthYear: 2010,
          maxBirthYear: 2020
        }));
        
        return {
          sport,
          ageGroups: ageGroupDivisions
        };
      });
      
      const seasonId = await createProgramSeason(
        programId,
        program.name,
        {
          name: seasonName.trim(),
          year: seasonYear,
          status: 'setup',
          registrationOpenDate,
          registrationCloseDate,
          sportsOffered,
          registrationFee: registrationFee * 100, // Convert to cents
          requireMedicalInfo,
          requireEmergencyContact,
          requireUniformSizes,
          requireWaiver,
          allowPayInFull,
          allowPaymentPlan,
          allowInPersonPayment,
          createdBy: user!.uid
        }
      );
      
      toastSuccess(`Season created with ${getTotalPools()} registration pools!`);
      
      if (onComplete) {
        onComplete(seasonId);
      } else {
        navigate('/commissioner');
      }
      
    } catch (err: any) {
      console.error('Error creating season:', err);
      setError(err.message || 'Failed to create season');
      toastError('Failed to create season');
    } finally {
      setCreating(false);
    }
  };
  
  if (loadingProgram) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-zinc-900' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }
  
  if (!program) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-zinc-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <p className={`text-lg ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            Program not found
          </p>
          <button
            onClick={() => navigate('/commissioner')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen ${isDark ? 'bg-zinc-900' : 'bg-gray-50'}`}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Create New Season
          </h1>
          <p className={`${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
            {program.name} • Set up registration for your upcoming season
          </p>
        </div>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <React.Fragment key={s}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                s < step
                  ? 'bg-green-500 text-white'
                  : s === step
                    ? 'bg-purple-600 text-white'
                    : isDark
                      ? 'bg-white/10 text-slate-400'
                      : 'bg-gray-200 text-gray-500'
              }`}>
                {s < step ? <Check className="w-5 h-5" /> : s}
              </div>
              {s < 4 && (
                <div className={`w-12 h-1 rounded ${
                  s < step 
                    ? 'bg-green-500' 
                    : isDark ? 'bg-white/10' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
        
        {/* Step Labels */}
        <div className="flex justify-between text-xs mb-8 px-4">
          <span className={step >= 1 ? (isDark ? 'text-purple-400' : 'text-purple-600') : (isDark ? 'text-slate-500' : 'text-gray-400')}>
            Season Info
          </span>
          <span className={step >= 2 ? (isDark ? 'text-purple-400' : 'text-purple-600') : (isDark ? 'text-slate-500' : 'text-gray-400')}>
            Sports
          </span>
          <span className={step >= 3 ? (isDark ? 'text-purple-400' : 'text-purple-600') : (isDark ? 'text-slate-500' : 'text-gray-400')}>
            Settings
          </span>
          <span className={step >= 4 ? (isDark ? 'text-purple-400' : 'text-purple-600') : (isDark ? 'text-slate-500' : 'text-gray-400')}>
            Review
          </span>
        </div>
        
        {/* Content Card */}
        <div className={`rounded-xl p-6 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white shadow-lg'}`}>
          
          {/* Step 1: Season Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Season Information
                  </h2>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    Basic details about this season
                  </p>
                </div>
              </div>
              
              {/* Season Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Season Name *
                </label>
                <input
                  type="text"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  placeholder="e.g., Fall 2025, Spring 2026"
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDark 
                      ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                />
              </div>
              
              {/* Year */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Year
                </label>
                <select
                  value={seasonYear}
                  onChange={(e) => setSeasonYear(parseInt(e.target.value))}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDark 
                      ? 'bg-white/5 border-white/10 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                >
                  {[2024, 2025, 2026, 2027].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              
              {/* Registration Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    Registration Opens *
                  </label>
                  <input
                    type="date"
                    value={registrationOpenDate}
                    onChange={(e) => setRegistrationOpenDate(e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg border ${
                      isDark 
                        ? 'bg-white/5 border-white/10 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    Registration Closes *
                  </label>
                  <input
                    type="date"
                    value={registrationCloseDate}
                    onChange={(e) => setRegistrationCloseDate(e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg border ${
                      isDark 
                        ? 'bg-white/5 border-white/10 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Step 2: Sports Selection */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Sports for This Season
                  </h2>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    Select which sports to include
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                {(program.sports || [program.sport]).filter(Boolean).map(sport => {
                  const isSelected = selectedSports.includes(sport as SportType);
                  // Use program.ageGroups (flat array from AgeGroupsManager)
                  const programAgeGroups = (program as any)?.ageGroups || [];
                  const divisionCount = programAgeGroups.length;
                  
                  return (
                    <button
                      key={sport}
                      onClick={() => toggleSport(sport as SportType)}
                      className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-500/20'
                          : isDark
                            ? 'border-white/10 bg-white/5 hover:border-white/30'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{SPORT_ICONS[sport as SportType]}</span>
                        <div className="text-left">
                          <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {sport?.charAt(0).toUpperCase()}{sport?.slice(1)}
                          </div>
                          <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                            {divisionCount} age group{divisionCount !== 1 ? 's' : ''} configured
                          </div>
                        </div>
                      </div>
                      
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-purple-600 border-purple-600'
                          : isDark
                            ? 'border-white/30'
                            : 'border-gray-300'
                      }`}>
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {selectedSports.length > 0 && (
                <div className={`p-3 rounded-lg ${isDark ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-200'}`}>
                  <p className={`text-sm ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                    📊 {getTotalPools()} registration pool{getTotalPools() !== 1 ? 's' : ''} will be created
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Step 3: Registration Settings */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Registration Settings
                  </h2>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    Fees, requirements, and payment options
                  </p>
                </div>
              </div>
              
              {/* Registration Fee */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Registration Fee
                </label>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={registrationFee}
                    onChange={(e) => setRegistrationFee(parseInt(e.target.value) || 0)}
                    className={`w-full pl-8 pr-4 py-3 rounded-lg border ${
                      isDark 
                        ? 'bg-white/5 border-white/10 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                  />
                </div>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                  Set to $0 for free registration
                </p>
              </div>
              
              {/* Requirements */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Required Information
                </label>
                <div className="space-y-3">
                  {[
                    { key: 'medical', label: 'Medical Information', value: requireMedicalInfo, setter: setRequireMedicalInfo, desc: 'Allergies, medications, conditions' },
                    { key: 'emergency', label: 'Emergency Contact', value: requireEmergencyContact, setter: setRequireEmergencyContact, desc: 'Name, phone, relationship' },
                    { key: 'uniform', label: 'Uniform Sizes', value: requireUniformSizes, setter: setRequireUniformSizes, desc: 'Jersey, shorts, helmet sizes' },
                    { key: 'waiver', label: 'Liability Waiver', value: requireWaiver, setter: setRequireWaiver, desc: 'Digital waiver signature' },
                  ].map(item => (
                    <label
                      key={item.key}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer ${
                        isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.value}
                        onChange={(e) => item.setter(e.target.checked)}
                        className="mt-1 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {item.label}
                        </div>
                        <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                          {item.desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Payment Options */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Payment Options
                </label>
                <div className="space-y-3">
                  {[
                    { key: 'full', label: 'Pay in Full', value: allowPayInFull, setter: setAllowPayInFull, desc: 'Full payment at registration' },
                    { key: 'plan', label: 'Payment Plan', value: allowPaymentPlan, setter: setAllowPaymentPlan, desc: 'Allow installments over time' },
                    { key: 'person', label: 'Pay in Person', value: allowInPersonPayment, setter: setAllowInPersonPayment, desc: 'Cash/check at first practice' },
                  ].map(item => (
                    <label
                      key={item.key}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer ${
                        isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.value}
                        onChange={(e) => item.setter(e.target.checked)}
                        className="mt-1 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {item.label}
                        </div>
                        <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                          {item.desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Review & Create
                  </h2>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    Confirm your season setup
                  </p>
                </div>
              </div>
              
              {/* Summary */}
              <div className={`space-y-4 p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                {/* Season Info */}
                <div className="flex items-start gap-3">
                  <Calendar className={`w-5 h-5 mt-0.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                  <div className="flex-1">
                    <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {seasonName}
                    </div>
                    <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      Registration: {new Date(registrationOpenDate).toLocaleDateString()} - {new Date(registrationCloseDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                {/* Sports & Pools */}
                <div className={`border-t ${isDark ? 'border-white/10' : 'border-gray-200'} pt-4`}>
                  <div className="flex items-start gap-3">
                    <Trophy className={`w-5 h-5 mt-0.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                    <div className="flex-1">
                      <div className={`font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Sports & Registration Pools
                      </div>
                      {selectedSports.map(sport => {
                        const sportConfig = program.sportConfigs?.find(sc => sc.sport === sport);
                        const divisions = sportConfig?.ageGroups || [];
                        
                        return (
                          <div key={sport} className="mb-2">
                            <div className="flex items-center gap-2">
                              <span>{SPORT_ICONS[sport]}</span>
                              <span className={isDark ? 'text-white' : 'text-gray-900'}>
                                {sport.charAt(0).toUpperCase()}{sport.slice(1)}
                              </span>
                              <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                                ({divisions.length} pool{divisions.length !== 1 ? 's' : ''})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 ml-7 mt-1">
                              {divisions.map(div => (
                                <span
                                  key={div.id}
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    isDark ? 'bg-white/10 text-slate-300' : 'bg-gray-200 text-gray-600'
                                  }`}
                                >
                                  {div.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                {/* Fee */}
                <div className={`border-t ${isDark ? 'border-white/10' : 'border-gray-200'} pt-4`}>
                  <div className="flex items-start gap-3">
                    <DollarSign className={`w-5 h-5 mt-0.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                    <div>
                      <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        ${registrationFee} per player
                      </div>
                      <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                        {[
                          allowPayInFull && 'Pay in Full',
                          allowPaymentPlan && 'Payment Plan',
                          allowInPersonPayment && 'Pay in Person'
                        ].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Info Banner */}
              <div className={`p-4 rounded-lg ${isDark ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}`}>
                <p className={`text-sm ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                  ✓ <strong>{getTotalPools()} registration pools</strong> will be created automatically.
                  Parents will register to the correct pool based on their child's age.
                </p>
              </div>
            </div>
          )}
          
          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
            <div>
              {step > 1 ? (
                <button
                  onClick={handleBack}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    isDark 
                      ? 'bg-white/5 text-white hover:bg-white/10' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              ) : onCancel ? (
                <button
                  onClick={onCancel}
                  className={`px-4 py-2 rounded-lg ${
                    isDark 
                      ? 'bg-white/5 text-white hover:bg-white/10' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cancel
                </button>
              ) : null}
            </div>
            
            <div>
              {step < TOTAL_STEPS ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Create Season
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommissionerSeasonSetup;
