/**
 * Commissioner Program Setup Component
 * Wizard for commissioners to set up their program with sports and age groups
 * 
 * Flow:
 * 1. Program Info (name, location, branding)
 * 2. Sports Selection (which sports this program offers)
 * 3. Age Group Configuration (per sport - single or combined age groups)
 * 4. Review & Create
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { 
  SportType, 
  SportAgeGroupConfig, 
  AgeGroupDivision,
  AGE_GROUPS,
  getBirthYearRange 
} from '../../types';
import { StateSelector } from '../StateSelector';
import { 
  Building2, 
  MapPin, 
  Palette, 
  Trophy, 
  Users, 
  ChevronRight, 
  ChevronLeft,
  Check,
  Plus,
  X,
  Loader2,
  Settings,
  Calendar,
  Camera,
  Upload
} from 'lucide-react';
import { toastSuccess, toastError } from '../../services/toast';

// Available sports with icons and details
const SPORTS_CONFIG: { sport: SportType; label: string; icon: string; defaultAgeGroups: string[] }[] = [
  { sport: 'football', label: 'Football', icon: '🏈', defaultAgeGroups: ['6U', '7U', '8U', '9U', '10U', '11U', '12U', '13U', '14U'] },
  { sport: 'basketball', label: 'Basketball', icon: '🏀', defaultAgeGroups: ['6U', '7U', '8U', '9U', '10U', '11U', '12U', '13U', '14U'] },
  { sport: 'cheer', label: 'Cheer', icon: '📣', defaultAgeGroups: ['6U', '7U', '8U', '9U', '10U', '11U', '12U', '13U', '14U'] },
  { sport: 'soccer', label: 'Soccer', icon: '⚽', defaultAgeGroups: ['6U', '7U', '8U', '9U', '10U', '11U', '12U', '13U', '14U'] },
  { sport: 'baseball', label: 'Baseball', icon: '⚾', defaultAgeGroups: ['6U', '7U', '8U', '9U', '10U', '11U', '12U', '13U', '14U'] },
  { sport: 'volleyball', label: 'Volleyball', icon: '🏐', defaultAgeGroups: ['6U', '7U', '8U', '9U', '10U', '11U', '12U', '13U', '14U'] },
];

// Youth age groups (most common)
const YOUTH_AGE_GROUPS = ['5U', '6U', '7U', '8U', '9U', '10U', '11U', '12U', '13U', '14U'];

interface Props {
  programId?: string;
  onComplete?: (programId: string) => void;
  onCancel?: () => void;
}

export const CommissionerProgramSetup: React.FC<Props> = ({ programId: propProgramId, onComplete, onCancel }) => {
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { programId: routeProgramId } = useParams<{ programId: string }>();
  const [searchParams] = useSearchParams();
  const isDark = theme === 'dark';
  
  // Use prop or route param for editing existing program
  const editingProgramId = propProgramId || routeProgramId;
  const isEditing = !!editingProgramId;
  
  // Info-only mode is now the DEFAULT - no wizard steps needed
  // Sports are selected via sidebar dropdown, age groups have their own page
  const infoOnlyMode = true; // Always info-only now
  
  // Sport edit mode: just edit age groups for a specific sport (legacy, may remove later)
  const sportEditMode = searchParams.get('mode') === 'sport';
  const editingSport = searchParams.get('sport') || '';
  
  // No wizard needed - just one step
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 1;
  
  // Step 1: Program Info
  const [programName, setProgramName] = useState('');
  const [programType, setProgramType] = useState<'youth' | 'middleschool' | 'highschool' | 'college' | 'adult'>('youth');
  const [programZipcode, setProgramZipcode] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [programCity, setProgramCity] = useState('');
  const [programState, setProgramState] = useState('');
  const [zipcodeLookupLoading, setZipcodeLookupLoading] = useState(false);
  const [zipcodeError, setZipcodeError] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#7c3aed'); // Purple default
  const [secondaryColor, setSecondaryColor] = useState('#1e293b');
  
  // Step 2: Sports Selection
  const [selectedSports, setSelectedSports] = useState<SportType[]>([]);
  
  // Step 3: Age Group Configuration per sport
  const [sportConfigs, setSportConfigs] = useState<Map<SportType, AgeGroupDivision[]>>(new Map());
  const [currentConfigSport, setCurrentConfigSport] = useState<SportType | null>(null);
  
  // Loading/Error state
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(!!editingProgramId);
  const [error, setError] = useState('');
  
  // Track if user already has org info saved (for simplified flow)
  const [hasOrgInfo, setHasOrgInfo] = useState(false);
  
  // Track which sports already have programs (not editable for new programs)
  const [existingPrograms, setExistingPrograms] = useState<Map<SportType, { id: string; name: string }>>(new Map());
  
  // Load org info from user profile on mount
  useEffect(() => {
    if (!userData) return;
    
    // Pre-fill from user's saved org info
    if (userData.orgName) {
      setProgramName(userData.orgName);
      setHasOrgInfo(true);
    }
    if (userData.orgZipcode) setProgramZipcode(userData.orgZipcode);
    if (userData.orgCity) setProgramCity(userData.orgCity);
    if (userData.orgState) setProgramState(userData.orgState);
    if (userData.primaryColor) setPrimaryColor(userData.primaryColor);
    if (userData.secondaryColor) setSecondaryColor(userData.secondaryColor);
    
    // If they already have org info, start on step 2 (Sports Selection)
    if (userData.orgName && userData.orgCity && userData.orgState && !isEditing) {
      setStep(2);
    }
  }, [userData, isEditing]);
  
  // Reset state when switching between create/edit modes
  useEffect(() => {
    if (editingProgramId) {
      // Editing mode - set loading and let the load effect handle it
      setLoading(true);
      setStep(1);
    }
  }, [editingProgramId]);
  
  // Load existing programs to see which sports are already set up
  useEffect(() => {
    if (!user?.uid || isEditing) return; // Don't check if editing existing program
    
    const loadExistingPrograms = async () => {
      try {
        const programsQuery = query(
          collection(db, 'programs'),
          where('commissionerId', '==', user.uid)
        );
        const programsSnap = await getDocs(programsQuery);
        
        const existing = new Map<SportType, { id: string; name: string }>();
        programsSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          const programSports = data.sports || (data.sport ? [data.sport] : []);
          programSports.forEach((sport: SportType) => {
            existing.set(sport, { id: docSnap.id, name: data.name || 'Unnamed' });
          });
        });
        
        setExistingPrograms(existing);
      } catch (err) {
        console.error('Error loading existing programs:', err);
      }
    };
    
    loadExistingPrograms();
  }, [user?.uid, isEditing]);
  
  // Load existing program data if editing
  useEffect(() => {
    if (!editingProgramId) return;
    
    const loadProgram = async () => {
      try {
        const programDoc = await getDoc(doc(db, 'programs', editingProgramId));
        if (programDoc.exists()) {
          const data = programDoc.data();
          setProgramName(data.name || '');
          setProgramType(data.programType || 'youth');
          setProgramCity(data.city || '');
          setProgramState(data.state || '');
          setPrimaryColor(data.primaryColor || '#7c3aed');
          setSecondaryColor(data.secondaryColor || '#1e293b');
          setLogoUrl(data.logoUrl || '');
          
          // Load sports
          if (data.sports?.length) {
            setSelectedSports(data.sports);
          } else if (data.sport) {
            setSelectedSports([data.sport]);
          }
          
          // Load sport configs - stored as array of { sport, ageGroups }
          if (data.sportConfigs && Array.isArray(data.sportConfigs)) {
            const configMap = new Map<SportType, AgeGroupDivision[]>();
            data.sportConfigs.forEach((sc: { sport: string; ageGroups: AgeGroupDivision[] }) => {
              if (sc.sport && sc.ageGroups) {
                configMap.set(sc.sport.toLowerCase() as SportType, sc.ageGroups);
              }
            });
            setSportConfigs(configMap);
          }
        }
      } catch (err) {
        console.error('Error loading program:', err);
        setError('Failed to load program data');
      } finally {
        setLoading(false);
      }
    };
    
    loadProgram();
  }, [editingProgramId]);
  
  // Zipcode lookup function
  const lookupZipcode = async (zipcode: string) => {
    // Only lookup if 5 digits
    if (zipcode.length !== 5 || !/^\d{5}$/.test(zipcode)) {
      return;
    }
    
    setZipcodeLookupLoading(true);
    setZipcodeError('');
    
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${zipcode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.places && data.places.length > 0) {
          const place = data.places[0];
          setProgramCity(place['place name'] || '');
          setProgramState(place['state abbreviation'] || '');
        }
      } else if (response.status === 404) {
        setZipcodeError('Invalid zipcode');
      }
    } catch (err) {
      console.error('Zipcode lookup failed:', err);
      // Don't show error - user can manually enter
    } finally {
      setZipcodeLookupLoading(false);
    }
  };
  
  // Handle zipcode change
  const handleZipcodeChange = (value: string) => {
    // Only allow digits, max 5
    const cleaned = value.replace(/\D/g, '').slice(0, 5);
    setProgramZipcode(cleaned);
    setZipcodeError('');
    
    // Auto-lookup when 5 digits entered
    if (cleaned.length === 5) {
      lookupZipcode(cleaned);
    }
  };
  
  // Validation per step
  const validateStep = (stepNum: number): boolean => {
    setError('');
    
    switch (stepNum) {
      case 1:
        if (!programName.trim()) {
          setError('Program name is required');
          return false;
        }
        if (!programCity.trim()) {
          setError('City is required');
          return false;
        }
        if (!programState.trim()) {
          setError('State is required');
          return false;
        }
        return true;
        
      case 2:
        if (selectedSports.length === 0) {
          setError('Please select at least one sport');
          return false;
        }
        return true;
        
      case 3:
        // Check each sport has at least one age group configured
        for (const sport of selectedSports) {
          const divisions = sportConfigs.get(sport) || [];
          if (divisions.length === 0) {
            setError(`Please configure age groups for ${sport}`);
            return false;
          }
        }
        return true;
        
      default:
        return true;
    }
  };
  
  const handleNext = async () => {
    if (validateStep(step)) {
      // Save org info to user profile when completing step 1
      if (step === 1 && user?.uid) {
        try {
          await setDoc(doc(db, 'users', user.uid), {
            orgName: programName.trim(),
            orgZipcode: programZipcode.trim(),
            orgCity: programCity.trim(),
            orgState: programState.trim(),
            primaryColor,
            secondaryColor,
            updatedAt: serverTimestamp()
          }, { merge: true });
          setHasOrgInfo(true);
        } catch (err) {
          console.error('Error saving org info:', err);
          // Continue anyway, just log the error
        }
      }
      
      // Initialize sport configs when moving from step 2 to 3
      if (step === 2) {
        const newConfigs = new Map(sportConfigs);
        for (const sport of selectedSports) {
          if (!newConfigs.has(sport)) {
            // Add default single age groups
            const sportInfo = SPORTS_CONFIG.find(s => s.sport === sport);
            const defaultDivisions: AgeGroupDivision[] = (sportInfo?.defaultAgeGroups || YOUTH_AGE_GROUPS).map(ag => {
              const { minYear, maxYear } = getBirthYearRange(ag, new Date().getFullYear());
              return {
                id: ag.toLowerCase(),
                label: ag,
                ageGroups: [ag],
                type: 'single',
                minBirthYear: minYear,
                maxBirthYear: maxYear
              };
            });
            newConfigs.set(sport, defaultDivisions);
          }
        }
        setSportConfigs(newConfigs);
        setCurrentConfigSport(selectedSports[0]);
      }
      setStep(step + 1);
    }
  };
  
  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };
  
  // Toggle sport selection (prevent selecting sports that already have programs)
  const toggleSport = (sport: SportType) => {
    // If this sport already has a program and we're not editing it, don't allow toggle
    if (existingPrograms.has(sport) && !isEditing) {
      return; // Sport is locked
    }
    
    setSelectedSports(prev => 
      prev.includes(sport) 
        ? prev.filter(s => s !== sport)
        : [...prev, sport]
    );
  };
  
  // Add combined age group division
  const addCombinedDivision = (sport: SportType, ageGroups: string[]) => {
    if (ageGroups.length < 2) return;
    
    const label = `${ageGroups[0]}-${ageGroups[ageGroups.length - 1]}`;
    const id = label.toLowerCase().replace(/\s+/g, '-');
    
    // Get birth year range spanning all selected age groups
    const years = ageGroups.map(ag => getBirthYearRange(ag, new Date().getFullYear()));
    const minBirthYear = Math.min(...years.map(y => y.minYear));
    const maxBirthYear = Math.max(...years.map(y => y.maxYear));
    
    const newDivision: AgeGroupDivision = {
      id,
      label,
      ageGroups,
      type: 'combined',
      minBirthYear,
      maxBirthYear
    };
    
    setSportConfigs(prev => {
      const newConfigs = new Map(prev);
      const existing = newConfigs.get(sport) || [];
      
      // Remove single divisions that are being combined
      const filtered = existing.filter(d => 
        d.type === 'combined' || !ageGroups.includes(d.ageGroups[0])
      );
      
      newConfigs.set(sport, [...filtered, newDivision]);
      return newConfigs;
    });
  };
  
  // Remove a division
  const removeDivision = (sport: SportType, divisionId: string) => {
    setSportConfigs(prev => {
      const newConfigs = new Map(prev);
      const existing = newConfigs.get(sport) || [];
      newConfigs.set(sport, existing.filter(d => d.id !== divisionId));
      return newConfigs;
    });
  };
  
  // Add a single age group division
  const addSingleDivision = (sport: SportType, ageGroup: string) => {
    const { minYear, maxYear } = getBirthYearRange(ageGroup, new Date().getFullYear());
    const newDivision: AgeGroupDivision = {
      id: ageGroup.toLowerCase(),
      label: ageGroup,
      ageGroups: [ageGroup],
      type: 'single',
      minBirthYear: minYear,
      maxBirthYear: maxYear
    };
    
    setSportConfigs(prev => {
      const newConfigs = new Map(prev);
      const existing = newConfigs.get(sport) || [];
      // Check if already exists
      if (existing.some(d => d.id === newDivision.id)) return prev;
      // Add and sort by age group number
      const updated = [...existing, newDivision].sort((a, b) => {
        const numA = parseInt(a.label.replace(/[^0-9]/g, '')) || 0;
        const numB = parseInt(b.label.replace(/[^0-9]/g, '')) || 0;
        return numA - numB;
      });
      newConfigs.set(sport, updated);
      return newConfigs;
    });
  };
  
  // Reset to single age groups
  const resetToSingleDivisions = (sport: SportType) => {
    const sportInfo = SPORTS_CONFIG.find(s => s.sport === sport);
    const defaultDivisions: AgeGroupDivision[] = (sportInfo?.defaultAgeGroups || YOUTH_AGE_GROUPS).map(ag => {
      const { minYear, maxYear } = getBirthYearRange(ag, new Date().getFullYear());
      return {
        id: ag.toLowerCase(),
        label: ag,
        ageGroups: [ag],
        type: 'single',
        minBirthYear: minYear,
        maxBirthYear: maxYear
      };
    });
    
    setSportConfigs(prev => {
      const newConfigs = new Map(prev);
      newConfigs.set(sport, defaultDivisions);
      return newConfigs;
    });
  };
  
  // Create the program (simplified - just basic info, no sports/age groups here)
  const handleCreate = async () => {
    if (!validateStep(1)) return;
    
    setCreating(true);
    setError('');
    
    try {
      // Generate program ID from name
      const programId = programName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      // Get selected sport from sidebar (localStorage)
      const selectedSport = localStorage.getItem('commissioner_selected_sport') || 'Football';
      
      const programData = {
        name: programName.trim(),
        programType, // youth, highschool, college, adult
        sport: selectedSport, // From sidebar selection
        city: programCity.trim(),
        state: programState.trim(),
        zipcode: programZipcode.trim(),
        primaryColor,
        secondaryColor,
        logoUrl: logoUrl || '',
        commissionerId: user?.uid,
        commissionerName: userData?.name || 'Unknown',
        status: 'active',
        ageGroups: [], // Age groups managed separately
        teamIds: [],
        teamCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'programs', programId), programData);
      
      // Update user as program commissioner
      await setDoc(doc(db, 'users', user!.uid), {
        role: 'ProgramCommissioner',
        programId,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      toastSuccess('Program created successfully!');
      
      if (onComplete) {
        onComplete(programId);
      } else {
        navigate('/commissioner');
      }
      
    } catch (err: any) {
      console.error('Error creating program:', err);
      setError(err.message || 'Failed to create program');
      toastError('Failed to create program');
    } finally {
      setCreating(false);
    }
  };
  
  // Save just the program info (info-only mode)
  const handleSaveInfoOnly = async () => {
    if (!validateStep(1)) return;
    if (!editingProgramId) return;
    
    setCreating(true);
    setError('');
    
    try {
      // Update just the basic info fields
      await setDoc(doc(db, 'programs', editingProgramId), {
        name: programName.trim(),
        programType, // youth, highschool, college, adult
        city: programCity.trim(),
        state: programState.trim(),
        primaryColor,
        secondaryColor,
        logoUrl: logoUrl || '',
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Also update user profile with org info
      if (user?.uid) {
        await setDoc(doc(db, 'users', user.uid), {
          orgName: programName.trim(),
          orgCity: programCity.trim(),
          orgState: programState.trim(),
          orgZipcode: programZipcode.trim(),
          primaryColor,
          secondaryColor,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      
      toastSuccess('Program info updated!');
      navigate('/commissioner');
      
    } catch (err: any) {
      console.error('Error updating program:', err);
      setError(err.message || 'Failed to update program');
      toastError('Failed to update program');
    } finally {
      setCreating(false);
    }
  };
  
  // Save just the sport age groups (sport edit mode)
  const handleSaveSportAgeGroups = async () => {
    if (!editingProgramId || !editingSport) return;
    
    setCreating(true);
    setError('');
    
    try {
      // Get the current sport config for the editing sport
      const sportKey = editingSport.toLowerCase() as SportType;
      const newAgeGroups = sportConfigs.get(sportKey) || [];
      
      // Fetch current program to update sportConfigs
      const programRef = doc(db, 'programs', editingProgramId);
      const programSnap = await getDoc(programRef);
      
      if (!programSnap.exists()) {
        throw new Error('Program not found');
      }
      
      const currentData = programSnap.data();
      const currentConfigs = currentData.sportConfigs || [];
      
      // Update the specific sport's age groups
      const updatedConfigs = currentConfigs.map((sc: any) => {
        if (sc.sport?.toLowerCase() === sportKey) {
          return { ...sc, ageGroups: newAgeGroups };
        }
        return sc;
      });
      
      await setDoc(programRef, {
        sportConfigs: updatedConfigs,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      toastSuccess(`${editingSport} age groups updated!`);
      navigate('/commissioner');
      
    } catch (err: any) {
      console.error('Error updating sport age groups:', err);
      setError(err.message || 'Failed to update age groups');
      toastError('Failed to update age groups');
    } finally {
      setCreating(false);
    }
  };
  
  // Combined age group selector component
  const CombineAgeGroupsSelector: React.FC<{ sport: SportType }> = ({ sport }) => {
    const [selecting, setSelecting] = useState(false);
    const [selectedForCombine, setSelectedForCombine] = useState<string[]>([]);
    
    const currentDivisions = sportConfigs.get(sport) || [];
    
    // Only show age groups that are currently SINGLE divisions (can be combined)
    // Don't show age groups that are already in combined divisions
    const singleDivisionAgeGroups = currentDivisions
      .filter(d => d.type === 'single')
      .map(d => d.label);
    
    // Get age groups that are already in combined divisions (disabled)
    const combinedAgeGroups = currentDivisions
      .filter(d => d.type === 'combined')
      .flatMap(d => d.ageGroups);
    
    // Don't show combine button if less than 2 single age groups available
    if (singleDivisionAgeGroups.length < 2 && !selecting) {
      return null;
    }
    
    const toggleForCombine = (ag: string) => {
      setSelectedForCombine(prev => 
        prev.includes(ag) ? prev.filter(a => a !== ag) : [...prev, ag]
      );
    };
    
    const handleCombine = () => {
      if (selectedForCombine.length >= 2) {
        // Sort age groups numerically
        const sorted = [...selectedForCombine].sort((a, b) => {
          const numA = parseInt(a.replace('U', ''));
          const numB = parseInt(b.replace('U', ''));
          return numA - numB;
        });
        addCombinedDivision(sport, sorted);
        setSelectedForCombine([]);
        setSelecting(false);
      }
    };
    
    if (!selecting) {
      return (
        <button
          onClick={() => setSelecting(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed transition-colors ${
            isDark 
              ? 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10' 
              : 'border-purple-300 text-purple-600 hover:bg-purple-50'
          }`}
        >
          <Plus className="w-4 h-4" />
          Combine Age Groups
        </button>
      );
    }
    
    return (
      <div className={`p-4 rounded-lg border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Select age groups to combine:
          </span>
          <button onClick={() => { setSelecting(false); setSelectedForCombine([]); }}>
            <X className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-3">
          {singleDivisionAgeGroups.map(ag => {
            const isSelected = selectedForCombine.includes(ag);
            
            return (
              <button
                key={ag}
                onClick={() => toggleForCombine(ag)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-600 text-white'
                    : isDark
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {ag}
              </button>
            );
          })}
        </div>
        
        {selectedForCombine.length >= 2 && (
          <button
            onClick={handleCombine}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Check className="w-4 h-4" />
            Create {selectedForCombine.sort((a, b) => parseInt(a) - parseInt(b)).join('-')} Division
          </button>
        )}
        
        {selectedForCombine.length === 1 && (
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            Select at least 2 age groups to combine
          </p>
        )}
      </div>
    );
  };
  
  // Add back a single age group that was removed
  const AddAgeGroupSelector: React.FC<{ sport: SportType }> = ({ sport }) => {
    const [selecting, setSelecting] = useState(false);
    
    const sportInfo = SPORTS_CONFIG.find(s => s.sport === sport);
    const availableAgeGroups = sportInfo?.defaultAgeGroups || YOUTH_AGE_GROUPS;
    const currentDivisions = sportConfigs.get(sport) || [];
    
    // Get all age groups currently in any division
    const usedAgeGroups = currentDivisions.flatMap(d => d.ageGroups);
    
    // Find age groups that are NOT currently used
    const missingAgeGroups = availableAgeGroups.filter(ag => !usedAgeGroups.includes(ag));
    
    // Don't show if no missing age groups
    if (missingAgeGroups.length === 0) return null;
    
    if (!selecting) {
      return (
        <button
          onClick={() => setSelecting(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed transition-colors ${
            isDark 
              ? 'border-green-500/30 text-green-400 hover:bg-green-500/10' 
              : 'border-green-300 text-green-600 hover:bg-green-50'
          }`}
        >
          <Plus className="w-4 h-4" />
          Add Age Group
        </button>
      );
    }
    
    return (
      <div className={`p-4 rounded-lg border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Add age group:
          </span>
          <button onClick={() => setSelecting(false)}>
            <X className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {missingAgeGroups.map(ag => (
            <button
              key={ag}
              onClick={() => {
                addSingleDivision(sport, ag);
                setSelecting(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isDark
                  ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30'
                  : 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200'
              }`}
            >
              + {ag}
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  // Show loading state while fetching program data
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-zinc-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className={`${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
            Loading program data...
          </p>
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
            {sportEditMode ? `Edit ${editingSport} Age Groups` : isEditing ? 'Edit Program' : 'Set Up Your Program'}
          </h1>
          <p className={`${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
            {sportEditMode ? 'Configure which age groups are available for this sport' : 'Enter your program name, location, and colors'}
          </p>
        </div>
        
        {/* No progress steps needed - simplified to single page */}
        
        {/* Step labels removed - single page now */}
        
        {/* Content Card */}
        <div className={`rounded-xl p-6 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white shadow-lg'}`}>
          
          {/* Sport Edit Mode: Just show age groups for the specific sport */}
          {sportEditMode && editingSport && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center text-xl">
                  {editingSport.toLowerCase() === 'football' ? '🏈' : 
                   editingSport.toLowerCase() === 'basketball' ? '🏀' : 
                   editingSport.toLowerCase() === 'soccer' ? '⚽' : 
                   editingSport.toLowerCase() === 'baseball' ? '⚾' : 
                   editingSport.toLowerCase() === 'volleyball' ? '🏐' : 
                   editingSport.toLowerCase() === 'cheer' ? '📣' : '🏆'}
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {editingSport} Age Groups
                  </h2>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    Add, remove, or combine age groups
                  </p>
                </div>
              </div>
              
              {/* Current Divisions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Current Age Groups
                  </h3>
                  <button
                    onClick={() => resetToSingleDivisions(editingSport.toLowerCase() as SportType)}
                    className={`text-sm ${isDark ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Reset to Default
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {(sportConfigs.get(editingSport.toLowerCase() as SportType) || []).map(division => (
                    <div
                      key={division.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                        division.type === 'combined'
                          ? 'bg-purple-500/20 border border-purple-500/30'
                          : isDark
                            ? 'bg-white/10 border border-white/10'
                            : 'bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {division.label}
                      </span>
                      <button
                        onClick={() => removeDivision(editingSport.toLowerCase() as SportType, division.id)}
                        className={`p-0.5 rounded hover:bg-red-500/20 ${isDark ? 'text-slate-400 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  {(sportConfigs.get(editingSport.toLowerCase() as SportType) || []).length === 0 && (
                    <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                      No age groups configured. Add some below.
                    </p>
                  )}
                </div>
              </div>
              
              {/* Add Age Groups */}
              <AddAgeGroupSelector sport={editingSport.toLowerCase() as SportType} />
              
              {/* Combine Age Groups */}
              <CombineAgeGroupsSelector sport={editingSport.toLowerCase() as SportType} />
            </div>
          )}
          
          {/* Step 1: Program Info */}
          {step === 1 && !sportEditMode && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Program Information
                  </h2>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    Basic details about your organization
                  </p>
                </div>
              </div>
              
              {/* Logo Upload */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Program Logo
                </label>
                <div className="flex items-center gap-4">
                  {/* Logo Preview/Upload Button */}
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 border-dashed transition-all hover:scale-105 ${
                      isDark 
                        ? 'border-purple-500/50 bg-white/5 hover:border-purple-400' 
                        : 'border-purple-300 bg-purple-50 hover:border-purple-400'
                    } ${uploadingLogo ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        {uploadingLogo ? (
                          <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                        ) : (
                          <>
                            <Camera className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                            <span className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Add Logo</span>
                          </>
                        )}
                      </div>
                    )}
                    {/* Overlay on hover when logo exists */}
                    {logoUrl && !uploadingLogo && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      // Validate file size (max 2MB)
                      if (file.size > 2 * 1024 * 1024) {
                        toastError('Image must be less than 2MB');
                        return;
                      }
                      
                      setUploadingLogo(true);
                      try {
                        const programId = editingProgramId || programName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `program-${Date.now()}`;
                        const storageRef = ref(storage, `programs/${programId}/logo`);
                        await uploadBytes(storageRef, file);
                        const url = await getDownloadURL(storageRef);
                        setLogoUrl(url);
                        toastSuccess('Logo uploaded!');
                      } catch (err) {
                        console.error('Error uploading logo:', err);
                        toastError('Failed to upload logo');
                      } finally {
                        setUploadingLogo(false);
                      }
                    }}
                  />
                  <div>
                    <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      {logoUrl ? 'Click to change logo' : 'Upload your program logo'}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                      PNG, JPG up to 2MB. Square images work best.
                    </p>
                  </div>
                </div>
              </div>

              {/* Program Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Program Name *
                </label>
                <input
                  type="text"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="e.g., CYFL Tigers, Arlington Youth Sports"
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDark 
                      ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                />
              </div>
              
              {/* Program Type */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Program Type *
                </label>
                <select
                  value={programType}
                  onChange={(e) => setProgramType(e.target.value as 'youth' | 'middleschool' | 'highschool' | 'college' | 'adult')}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDark 
                      ? 'bg-white/5 border-white/10 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                >
                  <option value="youth">Youth (Ages 5-12)</option>
                  <option value="middleschool">Middle School (JV/Varsity)</option>
                  <option value="highschool">High School (JV/Varsity)</option>
                  <option value="college">College (JV/Varsity)</option>
                  <option value="adult">Adult (18+)</option>
                </select>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                  This determines which age groups are available
                </p>
              </div>
              
              {/* Location - Zipcode First */}
              <div className="space-y-4">
                <div className="max-w-[200px]">
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    Zipcode *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={programZipcode}
                      onChange={(e) => handleZipcodeChange(e.target.value)}
                      placeholder="e.g., 75428"
                      maxLength={5}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        zipcodeError
                          ? 'border-red-500'
                          : isDark 
                            ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' 
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                    />
                    {zipcodeLookupLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                      </div>
                    )}
                  </div>
                  {zipcodeError && (
                    <p className="text-red-500 text-sm mt-1">{zipcodeError}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      City *
                    </label>
                    <input
                      type="text"
                      value={programCity}
                      onChange={(e) => setProgramCity(e.target.value)}
                      placeholder="Auto-filled from zipcode"
                      className={`w-full px-4 py-3 rounded-lg border ${
                        isDark 
                          ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      State *
                    </label>
                    <StateSelector
                      value={programState}
                      onChange={setProgramState}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        isDark 
                          ? 'bg-white/5 border-white/10 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                    />
                  </div>
                </div>
              </div>
              
              {/* Colors */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Program Colors
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Primary:</span>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Secondary:</span>
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                  </div>
                  <div 
                    className="w-24 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                  >
                    Preview
                  </div>
                </div>
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
              <button
                onClick={() => navigate('/commissioner')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  isDark 
                    ? 'bg-white/5 text-white hover:bg-white/10' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Cancel
              </button>
            </div>
            
            <div>
              {isEditing ? (
                <button
                  onClick={handleSaveInfoOnly}
                  disabled={creating}
                  className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
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
                      Create Program
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

export default CommissionerProgramSetup;
