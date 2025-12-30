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
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { createProgramSeason } from '../../services/programSeasonService';
import type { Team } from '../../types';
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
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  Search
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
  selectedSport?: string; // If provided, only show this sport (from dropdown filter)
  isLeagueMember?: boolean; // If true, skip season steps and focus on registration only
  leagueName?: string; // Name of the league for display
  onComplete?: (seasonId: string) => void;
  onCancel?: () => void;
}

export const CommissionerSeasonSetup: React.FC<Props> = ({ programId: propProgramId, selectedSport: propSelectedSport, isLeagueMember = false, leagueName, onComplete, onCancel }) => {
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
  const [seasonStartDate, setSeasonStartDate] = useState('');
  const [seasonEndDate, setSeasonEndDate] = useState('');
  
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
  
  // Teams data for age group coverage
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  
  // Age group detail modal
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string | null>(null);
  const [untyingTeamId, setUntyingTeamId] = useState<string | null>(null);
  
  // Team selection for age group
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [assigningTeamId, setAssigningTeamId] = useState<string | null>(null);
  const [confirmChangeTeam, setConfirmChangeTeam] = useState<{team: Team; fromAgeGroup: string; toAgeGroup: string} | null>(null);
  
  // Load program data
  useEffect(() => {
    const loadProgram = async () => {
      try {
        const programDoc = await getDoc(doc(db, 'programs', programId));
        if (programDoc.exists()) {
          setProgram({ id: programDoc.id, ...programDoc.data() } as Program);
          
          // Pre-select sport based on filter or all sports
          const programData = programDoc.data();
          if (propSelectedSport) {
            // If sport filter is active, only use that sport
            setSelectedSports([propSelectedSport.toLowerCase() as SportType]);
          } else if (programData.sports) {
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
          
          // Season dates (start after registration closes, run for ~4 months)
          const startDate = new Date(closeDate);
          startDate.setDate(startDate.getDate() + 7); // 1 week after registration closes
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 4); // 4 months season
          
          setRegistrationOpenDate(openDate.toISOString().split('T')[0]);
          setRegistrationCloseDate(closeDate.toISOString().split('T')[0]);
          setSeasonStartDate(startDate.toISOString().split('T')[0]);
          setSeasonEndDate(endDate.toISOString().split('T')[0]);
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
  
  // Load teams for this program
  useEffect(() => {
    const loadTeams = async () => {
      if (!programId) return;
      
      try {
        const teamsQuery = query(
          collection(db, 'teams'),
          where('programId', '==', programId)
        );
        const teamsSnap = await getDocs(teamsQuery);
        const teamsData = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
        setTeams(teamsData);
      } catch (err) {
        console.error('Error loading teams:', err);
      } finally {
        setLoadingTeams(false);
      }
    };
    
    loadTeams();
  }, [programId]);
  
  // Get teams for a specific age group AND sport
  const getTeamsForAgeGroup = (ageGroup: string, sport?: string): Team[] => {
    return teams.filter(t => {
      // Filter by sport if provided
      if (sport && t.sport?.toLowerCase() !== sport.toLowerCase()) return false;
      
      // Check if team's ageGroup matches
      if (t.ageGroup === ageGroup) return true;
      // Check if ageGroups array contains the age group
      if (t.ageGroups?.includes(ageGroup)) return true;
      // For combined age groups like "7U-8U", check if either part matches
      if (ageGroup.includes('-')) {
        const parts = ageGroup.split('-');
        return parts.some(part => t.ageGroup === part || t.ageGroups?.includes(part));
      }
      return false;
    });
  };
  
  // Get age groups for a specific sport from sportConfigs ONLY - no fallback to legacy
  const getAgeGroupsForSport = (sport: string): string[] => {
    const sportConfigs = (program as any)?.sportConfigs || [];
    const sportConfig = sportConfigs.find((sc: any) => sc.sport?.toLowerCase() === sport.toLowerCase());
    return sportConfig?.ageGroups || [];
  };
  
  // Untie a team from an age group (doesn't delete the team)
  const handleUntieTeam = async (teamId: string, ageGroup: string) => {
    setUntyingTeamId(teamId);
    try {
      // Update team to remove the age group
      await updateDoc(doc(db, 'teams', teamId), {
        ageGroup: null,
        ageGroups: [],
        updatedAt: serverTimestamp()
      });
      
      // Update local teams state
      setTeams(prev => prev.map(t => 
        t.id === teamId 
          ? { ...t, ageGroup: undefined, ageGroups: [] }
          : t
      ));
      
      toastSuccess(`Team untied from ${ageGroup}`);
    } catch (err) {
      console.error('Error untying team:', err);
      toastError('Failed to untie team');
    } finally {
      setUntyingTeamId(null);
    }
  };
  
  // Assign a team to an age group
  const handleAssignTeam = async (team: Team, ageGroup: string) => {
    // Check if team already has a different age group
    const currentAgeGroup = team.ageGroup || (team.ageGroups?.[0]);
    if (currentAgeGroup && currentAgeGroup !== ageGroup) {
      // Show confirmation dialog
      setConfirmChangeTeam({ team, fromAgeGroup: currentAgeGroup, toAgeGroup: ageGroup });
      return;
    }
    
    // Proceed with assignment
    await doAssignTeam(team.id, ageGroup);
  };
  
  // Actually perform the team assignment
  const doAssignTeam = async (teamId: string, ageGroup: string) => {
    setAssigningTeamId(teamId);
    try {
      // Update team with single age group (not array)
      await updateDoc(doc(db, 'teams', teamId), {
        ageGroup: ageGroup,
        ageGroups: [ageGroup], // Keep in sync but single value
        updatedAt: serverTimestamp()
      });
      
      // Update local teams state
      setTeams(prev => prev.map(t => 
        t.id === teamId 
          ? { ...t, ageGroup: ageGroup, ageGroups: [ageGroup] }
          : t
      ));
      
      toastSuccess(`Team assigned to ${ageGroup}`);
      setConfirmChangeTeam(null);
    } catch (err) {
      console.error('Error assigning team:', err);
      toastError('Failed to assign team');
    } finally {
      setAssigningTeamId(null);
    }
  };
  
  // Get teams available for selection (not already assigned to another age group or no age group)
  const getAvailableTeams = (ageGroup: string): Team[] => {
    const query = teamSearchQuery.toLowerCase();
    return teams.filter(t => {
      // Filter by search query if present
      if (query && !t.name?.toLowerCase().includes(query)) return false;
      return true;
    });
  };
  
  // Check if team is assigned to this age group
  const isTeamAssignedToAgeGroup = (team: Team, ageGroup: string): boolean => {
    if (team.ageGroup === ageGroup) return true;
    if (team.ageGroups?.includes(ageGroup)) return true;
    return false;
  };
  
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
          setError('Registration close date must be after open date');
          return false;
        }
        if (!seasonStartDate) {
          setError('Season start date is required');
          return false;
        }
        if (!seasonEndDate) {
          setError('Season end date is required');
          return false;
        }
        if (new Date(seasonEndDate) <= new Date(seasonStartDate)) {
          setError('Season end date must be after start date');
          return false;
        }
        return true;
        
      case 2:
        if (selectedSports.length === 0) {
          setError('Please select at least one sport for this season');
          return false;
        }
        // Check all age groups for EACH selected sport have at least one team
        for (const sport of selectedSports) {
          const sportAgeGroups = getAgeGroupsForSport(sport);
          const uncoveredGroups = sportAgeGroups.filter(ag => getTeamsForAgeGroup(ag, sport).length === 0);
          if (uncoveredGroups.length > 0) {
            const sportName = sport.charAt(0).toUpperCase() + sport.slice(1);
            setError(`${sportName}: ${uncoveredGroups.length} age group${uncoveredGroups.length > 1 ? 's' : ''} still need teams: ${uncoveredGroups.join(', ')}`);
            return false;
          }
        }
        return true;
        
      case 3:
        if (registrationFee < 0) {
          setError('Registration fee cannot be negative');
          return false;
        }
        // Only require payment method if fee > 0
        if (registrationFee > 0 && !allowPayInFull && !allowPaymentPlan && !allowInPersonPayment) {
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
  
  // Calculate total pools that will be created (sport-specific age groups)
  const getTotalPools = (): number => {
    let total = 0;
    for (const sport of selectedSports) {
      const sportAgeGroups = getAgeGroupsForSport(sport);
      total += sportAgeGroups.length;
    }
    return total;
  };
  
  // Create the season
  const handleCreate = async () => {
    if (!validateStep(step) || !program) return;
    
    setCreating(true);
    setError('');
    
    try {
      // Build sports offered using SPORT-SPECIFIC ageGroups from sportConfigs
      const sportsOffered: SportAgeGroupConfig[] = selectedSports.map(sport => {
        // Get age groups for THIS sport
        const sportAgeGroups = getAgeGroupsForSport(sport);
        
        // Convert flat ageGroups array to AgeGroupDivision format
        const ageGroupDivisions = sportAgeGroups.map(ag => ({
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
          seasonStartDate,
          seasonEndDate,
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
      
      toastSuccess(`Season created with ${getTotalPools()} draft pools!`);
      
      if (onComplete) {
        onComplete(seasonId);
      } else {
        navigate('/commissioner');
      }
      
    } catch (err: any) {
      console.error('Error creating season:', err);
      setError(err.message || (isLeagueMember ? 'Failed to create registration' : 'Failed to create season'));
      toastError(isLeagueMember ? 'Failed to create registration' : 'Failed to create season');
    } finally {
      setCreating(false);
    }
  };
  
  if (loadingProgram) {
    return (
      <div className={`${onCancel ? 'p-8' : 'min-h-screen'} flex items-center justify-center ${isDark ? 'bg-zinc-900' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }
  
  if (!program) {
    return (
      <div className={`${onCancel ? 'p-8' : 'min-h-screen'} flex items-center justify-center ${isDark ? 'bg-zinc-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <p className={`text-lg ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            Program not found
          </p>
          <button
            onClick={() => onCancel ? onCancel() : navigate('/commissioner')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`${onCancel ? '' : 'min-h-screen'} ${isDark ? 'bg-zinc-900' : 'bg-gray-50'}`}>
      <div className={`max-w-3xl mx-auto px-4 ${onCancel ? 'py-6' : 'py-8'}`}>
        {/* Header with close button if in modal */}
        <div className="text-center mb-8 relative">
          {onCancel && (
            <button
              onClick={onCancel}
              className={`absolute -top-2 right-0 p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}
            >
              <X className="w-6 h-6" />
            </button>
          )}
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {isLeagueMember 
              ? `Create Player Registration`
              : `Create New ${propSelectedSport ? `${propSelectedSport.charAt(0).toUpperCase()}${propSelectedSport.slice(1).toLowerCase()} ` : ''}Season`
            }
          </h1>
          <p className={`${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
            {isLeagueMember 
              ? `${program.name} • Open registration for players to join your age groups`
              : `${program.name} • Set up registration for your upcoming season`
            }
          </p>
          {isLeagueMember && leagueName && (
            <p className={`mt-2 text-sm px-3 py-1 rounded-full inline-block ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
              League schedules managed by {leagueName}
            </p>
          )}
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
            {isLeagueMember ? 'Registration Info' : 'Season Info'}
          </span>
          <span className={step >= 2 ? (isDark ? 'text-purple-400' : 'text-purple-600') : (isDark ? 'text-slate-500' : 'text-gray-400')}>
            Age Groups
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
              
              {/* Season Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    Season Starts *
                  </label>
                  <input
                    type="date"
                    value={seasonStartDate}
                    onChange={(e) => setSeasonStartDate(e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg border ${
                      isDark 
                        ? 'bg-white/5 border-white/10 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    Season Ends *
                  </label>
                  <input
                    type="date"
                    value={seasonEndDate}
                    onChange={(e) => setSeasonEndDate(e.target.value)}
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
                    Sports & Age Groups
                  </h2>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    Review team coverage for each age group
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Filter to only show the selected sport if one is passed from dropdown */}
                {(program.sports || [program.sport])
                  .filter(Boolean)
                  .filter(sport => !propSelectedSport || sport.toLowerCase() === propSelectedSport.toLowerCase())
                  .map(sport => {
                  const isSelected = selectedSports.includes(sport as SportType);
                  // Get sport-specific age groups
                  const sportAgeGroups: string[] = getAgeGroupsForSport(sport);
                  const coveredGroups = sportAgeGroups.filter(ag => getTeamsForAgeGroup(ag, sport).length > 0);
                  
                  return (
                    <div key={sport} className="space-y-3">
                      {/* Sport Header - Non-clickable when single sport is filtered */}
                      {propSelectedSport ? (
                        // Single sport mode - just show header, no toggle
                        <div className={`w-full p-4 rounded-xl border-2 flex items-center justify-between border-purple-500 bg-purple-500/20`}>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{SPORT_ICONS[sport as SportType]}</span>
                            <div className="text-left">
                              <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {sport?.charAt(0).toUpperCase()}{sport?.slice(1)}
                              </div>
                              <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                                {coveredGroups.length}/{sportAgeGroups.length} age groups have teams
                              </div>
                            </div>
                          </div>
                          
                          <div className="w-6 h-6 rounded-full bg-purple-600 border-2 border-purple-600 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        // Multi-sport mode - allow toggling
                        <button
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
                                {coveredGroups.length}/{sportAgeGroups.length} age groups have teams
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
                      )}
                      
                      {/* Age Groups Grid - Show when sport is selected */}
                      {isSelected && (
                        <div className={`ml-4 p-4 rounded-lg ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                          <p className={`text-xs font-medium mb-3 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                            Click an age group to see teams • Green = has team(s)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {sportAgeGroups.map((ag: string) => {
                              const teamsForGroup = getTeamsForAgeGroup(ag, sport);
                              const hasTeams = teamsForGroup.length > 0;
                              
                              return (
                                <button
                                  key={ag}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAgeGroup(ag);
                                  }}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all hover:scale-105 ${
                                    hasTeams
                                      ? isDark 
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' 
                                        : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                                      : isDark
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                  }`}
                                >
                                  {hasTeams ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4" />
                                  )}
                                  {ag}
                                  {hasTeams && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${isDark ? 'bg-green-500/30' : 'bg-green-200'}`}>
                                      {teamsForGroup.length}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          
                          {/* Coverage summary */}
                          <div className={`mt-3 pt-3 border-t flex items-center justify-between ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                              {coveredGroups.length === sportAgeGroups.length 
                                ? '✅ All age groups have at least 1 team'
                                : `⚠️ ${sportAgeGroups.length - coveredGroups.length} age group(s) need teams`
                              }
                            </span>
                            <button
                              onClick={() => {
                                if (onCancel) onCancel();
                                navigate('/commissioner/teams');
                              }}
                              className="text-xs text-purple-500 hover:text-purple-400 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Manage Teams
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {selectedSports.length > 0 && (
                <div className={`p-3 rounded-lg ${isDark ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-200'}`}>
                  <p className={`text-sm ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                    📊 {getTotalPools()} draft pool{getTotalPools() !== 1 ? 's' : ''} will be created
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
              
              {/* Payment Options - Only show if fee > 0 */}
              {registrationFee > 0 && (
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
              )}
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
                      Season: {new Date(seasonStartDate).toLocaleDateString()} - {new Date(seasonEndDate).toLocaleDateString()}
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
                        Sports & Draft Pools
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
                  ✓ <strong>{getTotalPools()} draft pools</strong> will be created automatically.
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
                      {isLeagueMember ? 'Create Registration' : 'Create Season'}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Age Group Teams Modal - Select/Assign Teams */}
      {selectedAgeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-xl shadow-xl ${isDark ? 'bg-zinc-900 border border-white/10' : 'bg-white'}`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  getTeamsForAgeGroup(selectedAgeGroup).length > 0
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {selectedAgeGroup} Teams
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    Select teams for this age group
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedAgeGroup(null);
                  setTeamSearchQuery('');
                }}
                className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Search Bar */}
            <div className={`p-4 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="Search teams..."
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${
                    isDark 
                      ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                />
              </div>
            </div>
            
            {/* Modal Body - Team List */}
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              {loadingTeams ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                </div>
              ) : teams.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
                  <p className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    No Teams Created
                  </p>
                  <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    Create teams first in the Manage Teams section.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedAgeGroup(null);
                      if (onCancel) onCancel();
                      navigate('/commissioner/teams');
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Go to Manage Teams
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {getAvailableTeams(selectedAgeGroup).map(team => {
                    const isAssigned = isTeamAssignedToAgeGroup(team, selectedAgeGroup);
                    const hasOtherAgeGroup = team.ageGroup && team.ageGroup !== selectedAgeGroup;
                    
                    return (
                      <div
                        key={team.id}
                        className={`p-3 rounded-lg flex items-center justify-between transition-all ${
                          isAssigned
                            ? isDark 
                              ? 'bg-green-500/10 border border-green-500/30' 
                              : 'bg-green-50 border border-green-200'
                            : isDark 
                              ? 'bg-white/5 border border-white/10 hover:border-purple-500/50' 
                              : 'bg-gray-50 border border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isAssigned 
                              ? 'bg-green-500/20 text-green-500' 
                              : isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                          }`}>
                            <span className="text-lg font-medium">{team.name?.charAt(0) || 'T'}</span>
                          </div>
                          <div>
                            <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {team.name}
                            </div>
                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                              {team.ageGroup 
                                ? `Currently: ${team.ageGroup}` 
                                : 'No age group assigned'
                              }
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Button */}
                        {isAssigned ? (
                          <button
                            onClick={() => handleUntieTeam(team.id!, selectedAgeGroup)}
                            disabled={untyingTeamId === team.id}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                              isDark 
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                            }`}
                          >
                            {untyingTeamId === team.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <X className="w-3.5 h-3.5" />
                            )}
                            Remove
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAssignTeam(team, selectedAgeGroup)}
                            disabled={assigningTeamId === team.id}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                              hasOtherAgeGroup
                                ? isDark 
                                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' 
                                  : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                : isDark 
                                  ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' 
                                  : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                            }`}
                          >
                            {assigningTeamId === team.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                            {hasOtherAgeGroup ? 'Change' : 'Assign'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  
                  {getAvailableTeams(selectedAgeGroup).length === 0 && teamSearchQuery && (
                    <div className="text-center py-4">
                      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                        No teams match "{teamSearchQuery}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className={`p-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {getTeamsForAgeGroup(selectedAgeGroup).length} team(s) assigned
                </span>
                <button
                  onClick={() => {
                    setSelectedAgeGroup(null);
                    setTeamSearchQuery('');
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirm Change Age Group Modal */}
      {confirmChangeTeam && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-xl shadow-xl p-6 ${isDark ? 'bg-zinc-900 border border-white/10' : 'bg-white'}`}>
            <AlertTriangle className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
            <h3 className={`text-lg font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Change Age Group?
            </h3>
            <p className={`text-sm text-center mb-6 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
              <strong>{confirmChangeTeam.team.name}</strong> is currently assigned to <strong>{confirmChangeTeam.fromAgeGroup}</strong>. 
              This will change it to <strong>{confirmChangeTeam.toAgeGroup}</strong>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmChangeTeam(null)}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Cancel
              </button>
              <button
                onClick={() => doAssignTeam(confirmChangeTeam.team.id!, confirmChangeTeam.toAgeGroup)}
                disabled={assigningTeamId === confirmChangeTeam.team.id}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {assigningTeamId === confirmChangeTeam.team.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Change'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionerSeasonSetup;
