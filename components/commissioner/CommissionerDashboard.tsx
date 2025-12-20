/**
 * Commissioner Dashboard Component
 * Main dashboard for Commissioners to manage their program/league
 * Supports both "team" commissioners (manage teams) and "league" commissioners (manage leagues)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { TeamColorPicker, TeamColorPreview } from '../TeamColorPicker';
import { 
  getTeamsByProgram, 
  getGrievancesByProgram,
  getProgram,
  updateProgram
} from '../../services/leagueService';
import { collection, query, where, getDocs, onSnapshot, doc, addDoc, setDoc, getDoc, serverTimestamp, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Team, Grievance, Program, UserProfile, ProgramSeason } from '../../types';
import { 
  Users, 
  Shield, 
  AlertTriangle, 
  Calendar, 
  Trophy, 
  Plus,
  ChevronRight,
  Bell,
  TrendingUp,
  Activity,
  UserPlus,
  Loader2,
  Building2,
  FileText,
  Crown,
  Target,
  Layers,
  Edit2,
  Trash2,
  Link2,
  Search,
  X,
  CheckCircle2,
  Check,
  ChevronDown,
  Play,
  Square,
  AlertCircle,
  Settings
} from 'lucide-react';
import { RulesModal } from '../RulesModal';
import { AgeGroupSelector } from '../AgeGroupSelector';
import { StateSelector, isValidUSState } from '../StateSelector';
import { toastError, toastSuccess, toastInfo } from '../../services/toast';
import { CommissionerSeasonSetup } from './CommissionerSeasonSetup';

export const CommissionerDashboard: React.FC = () => {
  const { user, userData, programData, leagueData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagues, setLeagues] = useState<Array<{ id: string; name: string; sport?: string; teamIds?: string[] }>>();
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [coachRequests, setCoachRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState<ProgramSeason[]>([]);
  
  // Dashboard draft pool states (inline on dashboard, not modal)
  const [dashboardDraftPoolPlayers, setDashboardDraftPoolPlayers] = useState<any[]>([]);
  const [dashboardDraftFilter, setDashboardDraftFilter] = useState<string>('all');
  const [loadingDashboardDraft, setLoadingDashboardDraft] = useState(false);
  const [draftingPlayerId, setDraftingPlayerId] = useState<string | null>(null);
  const [decliningPlayerId, setDecliningPlayerId] = useState<string | null>(null);
  const [showDraftToTeamModal, setShowDraftToTeamModal] = useState(false);
  const [playerToDraft, setPlayerToDraft] = useState<any>(null);
  
  // Draft pool modal states
  const [showDraftPoolModal, setShowDraftPoolModal] = useState(false);
  const [selectedPoolSeason, setSelectedPoolSeason] = useState<ProgramSeason | null>(null);
  const [draftPoolPlayers, setDraftPoolPlayers] = useState<any[]>([]);
  const [draftPoolSortBy, setDraftPoolSortBy] = useState<string>('all');
  const [loadingPoolPlayers, setLoadingPoolPlayers] = useState(false);
  
  // Sport selector - persisted to localStorage
  const [selectedSport, setSelectedSport] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('commissioner_selected_sport') || '';
    }
    return '';
  });
  
  // Get available sports from program
  const availableSports = (programData as any)?.sportsOffered?.map((s: any) => s.sport) 
    || (programData as any)?.sportConfigs?.map((s: any) => s.sport)
    || (programData?.sport ? [programData.sport] : [])
    || [];
  
  // Auto-select first sport if none selected
  useEffect(() => {
    if (!selectedSport && availableSports.length > 0) {
      const firstSport = availableSports[0];
      setSelectedSport(firstSport);
      localStorage.setItem('commissioner_selected_sport', firstSport);
    }
  }, [availableSports, selectedSport]);
  
  // Listen for sport changes from sidebar selector
  useEffect(() => {
    const handleSportChange = (e: CustomEvent) => {
      setSelectedSport(e.detail);
    };
    window.addEventListener('commissioner-sport-changed', handleSportChange as EventListener);
    return () => {
      window.removeEventListener('commissioner-sport-changed', handleSportChange as EventListener);
    };
  }, []);
  
  // Handle sport change
  const handleSportChange = (sport: string) => {
    setSelectedSport(sport);
    localStorage.setItem('commissioner_selected_sport', sport);
  };
  
  // Filter teams by selected sport
  const filteredTeams = selectedSport 
    ? teams.filter(t => t.sport?.toLowerCase() === selectedSport.toLowerCase())
    : teams;
  
  // Filter seasons by selected sport - memoize to prevent infinite loops
  const filteredSeasons = useMemo(() => {
    return selectedSport
      ? seasons.filter(s => 
          s.sportsOffered?.some((so: any) => so.sport?.toLowerCase() === selectedSport.toLowerCase()) ||
          (s as any).sport?.toLowerCase() === selectedSport.toLowerCase()
        )
      : seasons;
  }, [seasons, selectedSport]);
  
  // Helper: Check if sport has age groups and teams configured
  const canCreateSeason = (): { canCreate: boolean; missingAgeGroups: boolean; missingTeams: boolean } => {
    const sportConfigs = (programData as any)?.sportConfigs || [];
    const currentSportConfig = sportConfigs.find((sc: any) => sc.sport?.toLowerCase() === selectedSport?.toLowerCase());
    const sportAgeGroupCount = currentSportConfig?.ageGroups?.length || 0;
    const sportTeamsCount = filteredTeams.length;
    
    return {
      canCreate: sportAgeGroupCount > 0 && sportTeamsCount > 0,
      missingAgeGroups: sportAgeGroupCount === 0,
      missingTeams: sportTeamsCount === 0
    };
  };
  
  // Handler: Validate before opening create season modal
  const handleCreateSeasonClick = () => {
    const { canCreate, missingAgeGroups, missingTeams } = canCreateSeason();
    
    if (!canCreate) {
      const sportName = selectedSport?.charAt(0).toUpperCase() + selectedSport?.slice(1).toLowerCase();
      if (missingAgeGroups && missingTeams) {
        toastError(`Configure age groups and teams for ${sportName} first`);
      } else if (missingAgeGroups) {
        toastError(`Configure age groups for ${sportName} first`);
      } else if (missingTeams) {
        toastError(`Create at least one team for ${sportName} first`);
      }
      return;
    }
    
    setShowSeasonModal(true);
  };
  
  const [stats, setStats] = useState({
    totalTeams: 0,
    totalPlayers: 0,
    totalLeagues: 0,
    activeGrievances: 0,
    pendingRequests: 0,
  });
  
  // Rules modals state
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showConductModal, setShowConductModal] = useState(false);
  
  // Create team/league modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createTeamId, setCreateTeamId] = useState('');
  const [createSport, setCreateSport] = useState('Football');
  const [createAgeGroup, setCreateAgeGroup] = useState<string | string[]>('');
  const [createAgeGroupType, setCreateAgeGroupType] = useState<'single' | 'multi'>('single');
  const [createCity, setCreateCity] = useState('');
  const [createState, setCreateState] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Edit team modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editName, setEditName] = useState('');
  const [editTeamId, setEditTeamId] = useState('');
  const [editAgeGroup, setEditAgeGroup] = useState<string | string[]>('');
  const [editAgeGroupType, setEditAgeGroupType] = useState<'single' | 'multi'>('single');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editSport, setEditSport] = useState('Football');
  const [editPrimaryColor, setEditPrimaryColor] = useState('#f97316');
  const [editSecondaryColor, setEditSecondaryColor] = useState('#1e293b');
  const [editIsCheerTeam, setEditIsCheerTeam] = useState(false);
  const [editLinkedCheerTeamId, setEditLinkedCheerTeamId] = useState('');
  // For cheer teams - link to sport team
  const [editLinkedToTeamId, setEditLinkedToTeamId] = useState('');
  const [editLinkedToTeamName, setEditLinkedToTeamName] = useState('');
  const [editSportTeamSearch, setEditSportTeamSearch] = useState('');
  const [editSportTeamResults, setEditSportTeamResults] = useState<{id: string; name: string; sport: string}[]>([]);
  const [searchingSportTeams, setSearchingSportTeams] = useState(false);
  const [editMaxRosterSize, setEditMaxRosterSize] = useState(25);
  const [availableCheerTeams, setAvailableCheerTeams] = useState<Team[]>([]);
  const [editError, setEditError] = useState('');
  const [editing, setEditing] = useState(false);
  
  // Delete team confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Delete program confirmation
  const [showDeleteProgramConfirm, setShowDeleteProgramConfirm] = useState(false);
  const [deletingProgram, setDeletingProgram] = useState(false);
  
  // Delete season confirmation
  const [deleteSeasonConfirm, setDeleteSeasonConfirm] = useState<ProgramSeason | null>(null);
  const [deletingSeason, setDeletingSeason] = useState(false);
  
  // Season creation modal
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  
  // Season management modal (view/edit seasons)
  const [showSeasonManageModal, setShowSeasonManageModal] = useState(false);
  const [selectedSeasonForEdit, setSelectedSeasonForEdit] = useState<ProgramSeason | null>(null);
  const [isEditingSeasonMode, setIsEditingSeasonMode] = useState(false);
  const [editSeasonData, setEditSeasonData] = useState<{
    name: string;
    seasonStartDate: string;
    seasonEndDate: string;
    registrationOpenDate: string;
    registrationCloseDate: string;
    registrationFee: number;
    // Required fields toggles
    requireWaiver: boolean;
    requireMedicalInfo: boolean;
    requireEmergencyContact: boolean;
    requireUniformSizes: boolean;
    // Payment options - multi-select
    paymentOptions: {
      payInFull: boolean;
      payAsYouGo: boolean;
      payInCash: boolean;
    };
  } | null>(null);
  const [savingSeasonEdit, setSavingSeasonEdit] = useState(false);
  
  // Season lifecycle control states
  const [updatingSeasonStatus, setUpdatingSeasonStatus] = useState(false);
  const [showEndSeasonConfirm, setShowEndSeasonConfirm] = useState(false);
  
  // Collapse completed seasons by default
  const [showCompletedSeasons, setShowCompletedSeasons] = useState(false);
  
  // Add team to age group state
  const [showAddTeamToAgeGroup, setShowAddTeamToAgeGroup] = useState(false);
  const [newTeamAgeGroup, setNewTeamAgeGroup] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false);
  
  // Filter existing teams for autocomplete suggestions
  const teamSuggestions = teams.filter(t => 
    newTeamName.length > 0 && 
    t.name.toLowerCase().includes(newTeamName.toLowerCase()) &&
    t.ageGroup !== newTeamAgeGroup // Don't show teams already in this age group
  ).slice(0, 5);
  
  // Helper to get season status based on dates
  const getSeasonStatus = (season: ProgramSeason) => {
    const now = new Date();
    const regOpen = season.registrationOpenDate ? new Date(season.registrationOpenDate) : null;
    const regClose = season.registrationCloseDate ? new Date(season.registrationCloseDate) : null;
    const seasonStart = season.seasonStartDate ? new Date(season.seasonStartDate) : null;
    const seasonEnd = season.seasonEndDate ? new Date(season.seasonEndDate) : null;
    
    // If season has explicit completed status
    if (season.status === 'completed') return { label: 'Completed', color: 'gray', icon: '⚫' };
    
    // Check based on dates
    if (seasonEnd && now > seasonEnd) return { label: 'Completed', color: 'gray', icon: '⚫' };
    if (seasonStart && now >= seasonStart && (!seasonEnd || now <= seasonEnd)) return { label: 'In Season', color: 'green', icon: '🟢' };
    if (regOpen && regClose && now >= regOpen && now <= regClose) return { label: 'Registration Open', color: 'blue', icon: '🔵' };
    if (regOpen && now < regOpen) return { label: 'Upcoming', color: 'purple', icon: '🟣' };
    if (regClose && now > regClose && (!seasonStart || now < seasonStart)) return { label: 'Registration Closed', color: 'amber', icon: '🟡' };
    
    // Fallback based on status field
    if (season.status === 'active') return { label: 'Active', color: 'green', icon: '🟢' };
    if (season.status === 'registration_open') return { label: 'Registration Open', color: 'blue', icon: '🔵' };
    if (season.status === 'setup') return { label: 'Setup', color: 'purple', icon: '🟣' };
    
    return { label: 'Setup', color: 'purple', icon: '🟣' };
  };
  
  // Get commissioner type from userData
  // Check role first (TeamCommissioner/LeagueCommissioner/ProgramCommissioner), then fall back to commissionerType field
  const isTeamCommissioner = userData?.role === 'TeamCommissioner' || 
                              userData?.role === 'ProgramCommissioner' ||
                              userData?.role === 'Commissioner' ||
                              (userData?.commissionerType === 'team') ||
                              (!userData?.commissionerType && !['LeagueCommissioner', 'LeagueOwner'].includes(userData?.role || ''));
  const isLeagueCommissioner = userData?.role === 'LeagueCommissioner' || 
                                userData?.role === 'LeagueOwner' ||
                                userData?.commissionerType === 'league';
  
  // Check if user has a program
  const hasProgram = !!programData;

  useEffect(() => {
    if (!userData) {
      setLoading(false);
      return;
    }

    // Use real-time listeners for instant updates
    const unsubscribers: (() => void)[] = [];

    if (isTeamCommissioner) {
      // Real-time listener for teams owned by this commissioner
      const teamsQuery = query(
        collection(db, 'teams'),
        where('ownerId', '==', user?.uid)
      );
      
      const unsubscribeTeams = onSnapshot(teamsQuery, async (snapshot) => {
        const teamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
        setTeams(teamsData);
        
        // Calculate player count
        let totalPlayers = 0;
        for (const team of teamsData) {
          const playersSnap = await getDocs(collection(db, 'teams', team.id!, 'players'));
          totalPlayers += playersSnap.size;
        }
        
        setStats(prev => ({
          ...prev,
          totalTeams: teamsData.length,
          totalPlayers,
        }));
        setLoading(false);
      }, (error) => {
        console.error('Error loading teams:', error);
        setLoading(false);
      });
      
      unsubscribers.push(unsubscribeTeams);
    } else {
      // League commissioner - real-time listener for leagues
      const leaguesQuery = query(
        collection(db, 'leagues'),
        where('ownerId', '==', user?.uid)
      );
      
      const unsubscribeLeagues = onSnapshot(leaguesQuery, async (snapshot) => {
        const leaguesData = snapshot.docs.map(doc => {
          const data = doc.data();
          return { 
            id: doc.id, 
            name: data.name || 'Unnamed League',
            sport: data.sport,
            teamIds: data.teamIds || []
          };
        });
        setLeagues(leaguesData);
        
        // Get total teams across all leagues
        let totalTeams = 0;
        let totalPlayers = 0;
        for (const league of leaguesData) {
          const leagueTeamIds = league.teamIds || [];
          totalTeams += leagueTeamIds.length;
          
          for (const teamId of leagueTeamIds) {
            const playersSnap = await getDocs(collection(db, 'teams', teamId, 'players'));
            totalPlayers += playersSnap.size;
          }
        }
        
        setStats(prev => ({
          ...prev,
          totalLeagues: leaguesData.length,
          totalTeams,
          totalPlayers,
        }));
        setLoading(false);
      }, (error) => {
        console.error('Error loading leagues:', error);
        setLoading(false);
      });
      
      unsubscribers.push(unsubscribeLeagues);
    }

    // Cleanup all listeners
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [userData, user?.uid, isTeamCommissioner]);

  // Real-time listener for seasons
  useEffect(() => {
    const programId = programData?.id;
    if (!programId) {
      setSeasons([]);
      return;
    }

    const seasonsRef = collection(db, 'programs', programId, 'seasons');
    const q = query(seasonsRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const seasonsData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as ProgramSeason));
      setSeasons(seasonsData);
    }, (error) => {
      console.error('Error loading seasons:', error);
    });

    return () => unsubscribe();
  }, [programData?.id]);

  // Load draft pool players when modal opens
  useEffect(() => {
    const loadPoolPlayers = async () => {
      if (!showDraftPoolModal || !selectedPoolSeason) {
        setDraftPoolPlayers([]);
        return;
      }
      
      setLoadingPoolPlayers(true);
      try {
        const programId = programData?.id;
        if (!programId) return;
        
        // Get all registrations from the draftPool subcollection
        const draftPoolRef = collection(db, 'programs', programId, 'seasons', selectedPoolSeason.id, 'draftPool');
        const draftPoolSnap = await getDocs(draftPoolRef);
        
        const allPlayers: any[] = draftPoolSnap.docs.map(doc => {
          const data = doc.data();
          console.log('📋 Draft pool player data:', data);
          return {
            id: doc.id,
            ...data,
            ageGroup: data.ageGroupName || 'Unknown'
          };
        });
        
        console.log('✅ Loaded draft pool players:', allPlayers.length);
        setDraftPoolPlayers(allPlayers);
      } catch (error) {
        console.error('Error loading pool players:', error);
      } finally {
        setLoadingPoolPlayers(false);
      }
    };
    
    loadPoolPlayers();
  }, [showDraftPoolModal, selectedPoolSeason, programData?.id]);

  // Load dashboard draft pool players (all from current season)
  useEffect(() => {
    const loadDashboardDraftPool = async () => {
      if (!programData?.id || filteredSeasons.length === 0) {
        setDashboardDraftPoolPlayers([]);
        return;
      }
      
      setLoadingDashboardDraft(true);
      try {
        // Get the current/active season
        const activeSeason = filteredSeasons.find(s => s.status === 'registration_open' || s.status === 'active') || filteredSeasons[0];
        if (!activeSeason) {
          setDashboardDraftPoolPlayers([]);
          return;
        }
        
        // Get all registrations from the draftPool subcollection
        const draftPoolRef = collection(db, 'programs', programData.id, 'seasons', activeSeason.id, 'draftPool');
        const draftPoolSnap = await getDocs(draftPoolRef);
        
        const allPlayers: any[] = draftPoolSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            seasonId: activeSeason.id,
            seasonName: activeSeason.name,
            ...data,
            ageGroup: data.ageGroupName || 'Unknown'
          };
        });
        
        console.log('📋 Dashboard draft pool loaded:', allPlayers.length, 'players');
        setDashboardDraftPoolPlayers(allPlayers);
      } catch (error) {
        console.error('Error loading dashboard draft pool:', error);
      } finally {
        setLoadingDashboardDraft(false);
      }
    };
    
    loadDashboardDraftPool();
  }, [programData?.id, filteredSeasons]);

  // Get unique age groups from dashboard draft pool
  const dashboardAgeGroups = [...new Set(dashboardDraftPoolPlayers.map(p => p.ageGroup))].filter(Boolean).sort();

  // Handle drafting a player to a team
  const handleDraftPlayer = async (player: any, teamId: string, teamName: string) => {
    if (!programData?.id || !player.seasonId) return;
    
    setDraftingPlayerId(player.id);
    try {
      // Get team data for age group
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      const teamAgeGroup = teamDoc.exists() ? teamDoc.data()?.ageGroup : null;
      
      // Look up athlete profile for photo/username if not in draft pool data
      let photoUrl = player.photoUrl || null;
      let username = player.username || player.playerUsername || null;
      let dobValue = player.dateOfBirth || player.athleteDateOfBirth || player.dob || player.playerDob || null;
      
      if (player.athleteId && (!photoUrl || !username || !dobValue)) {
        try {
          const athleteDoc = await getDoc(doc(db, 'players', player.athleteId));
          if (athleteDoc.exists()) {
            const athleteData = athleteDoc.data();
            photoUrl = photoUrl || athleteData.photoUrl || null;
            username = username || athleteData.username || null;
            dobValue = dobValue || athleteData.dob || athleteData.dateOfBirth || null;
            console.log('📸 Looked up athlete profile for photo/username/dob');
          }
        } catch (err) {
          console.log('Could not look up athlete profile:', err);
        }
      }
      
      // 1. Add player to team roster (teams/{teamId}/players collection)
      const playerData = {
        name: `${player.athleteFirstName} ${player.athleteLastName}`,
        firstName: player.athleteFirstName,
        lastName: player.athleteLastName,
        number: player.jerseyNumber || null,
        position: player.position || null,
        parentName: player.parentName,
        parentEmail: player.parentEmail,
        parentPhone: player.parentPhone,
        parentId: player.parentUserId || null,
        parentUserId: player.parentUserId || null,
        athleteId: player.athleteId || null,
        dateOfBirth: dobValue,
        dob: dobValue, // Also save as dob for roster compatibility
        ageGroup: player.ageGroup || teamAgeGroup || null,
        photoUrl: photoUrl, // From athlete profile lookup
        username: username, // From athlete profile lookup
        status: 'active',
        draftedAt: serverTimestamp(),
        draftedBy: user?.uid,
        draftedByName: userData?.displayName || 'Commissioner',
        seasonId: player.seasonId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      const rosterRef = await addDoc(collection(db, 'teams', teamId, 'players'), playerData);
      console.log('✅ Step 1: Added player to roster:', rosterRef.id);
      
      // 2. Update the draft pool entry
      const draftPoolRef = doc(db, 'programs', programData.id, 'seasons', player.seasonId, 'draftPool', player.id);
      await updateDoc(draftPoolRef, {
        status: 'drafted',
        draftedToTeamId: teamId,
        draftedToTeamName: teamName,
        rosterPlayerId: rosterRef.id,
        draftedAt: serverTimestamp(),
        draftedBy: user?.uid,
        updatedAt: serverTimestamp()
      });
      console.log('✅ Step 2: Updated draft pool entry');
      
      // 3. Update the player document in top-level players collection
      // SYNC coach-assigned fields so parent's "My Athletes" view shows them
      if (player.athleteId) {
        const playerRef = doc(db, 'players', player.athleteId);
        await updateDoc(playerRef, {
          teamId: teamId,
          teamName: teamName,
          rosterPlayerId: rosterRef.id,
          // Sync coach-assigned fields from draft
          number: player.jerseyNumber || 0,
          position: player.position || 'TBD',
          draftPoolStatus: 'drafted',
          draftPoolDraftedAt: serverTimestamp(),
          draftPoolDraftedBy: userData?.displayName || 'Commissioner',
          status: 'active',
          updatedAt: serverTimestamp()
        });
        console.log('✅ Step 3: Updated top-level player document with number/position');
      }
      
      // 4. Send notification to parent
      if (player.parentUserId) {
        await addDoc(collection(db, 'notifications'), {
          userId: player.parentUserId,
          type: 'player_drafted',
          title: '🎉 Player Drafted!',
          message: `${player.athleteFirstName} ${player.athleteLastName} has been drafted to ${teamName}!`,
          category: 'team',
          priority: 'high',
          read: false,
          link: '/dashboard',
          metadata: {
            athleteName: `${player.athleteFirstName} ${player.athleteLastName}`,
            teamId: teamId,
            teamName: teamName,
            draftedBy: userData?.displayName || 'Commissioner',
          },
          createdAt: serverTimestamp()
        });
        console.log('✅ Step 4: Sent notification to parent');
      }
      
      // Remove from local state
      setDashboardDraftPoolPlayers(prev => prev.filter(p => p.id !== player.id));
      
      toastSuccess(`${player.athleteFirstName} ${player.athleteLastName} drafted to ${teamName}!`);
      setShowDraftToTeamModal(false);
      setPlayerToDraft(null);
    } catch (error: any) {
      console.error('Error drafting player:', error);
      toastError(error.message || 'Failed to draft player');
    } finally {
      setDraftingPlayerId(null);
    }
  };

  // Handle declining a player registration
  const handleDeclinePlayer = async (player: any) => {
    if (!programData?.id || !player.seasonId) return;
    
    const reason = prompt('Enter reason for declining (optional):');
    
    setDecliningPlayerId(player.id);
    try {
      const draftPoolRef = doc(db, 'programs', programData.id, 'seasons', player.seasonId, 'draftPool', player.id);
      
      // Update the draft pool entry
      await updateDoc(draftPoolRef, {
        status: 'declined',
        declinedAt: serverTimestamp(),
        declinedBy: user?.uid,
        declinedReason: reason || 'Registration declined by commissioner',
        updatedAt: serverTimestamp()
      });
      
      // Update the player document
      if (player.athleteId) {
        const playerRef = doc(db, 'players', player.athleteId);
        await updateDoc(playerRef, {
          draftPoolStatus: 'declined',
          draftPoolDeclinedReason: reason || 'Registration declined by commissioner',
          draftPoolUpdatedAt: serverTimestamp()
        });
      }
      
      // Remove from local state
      setDashboardDraftPoolPlayers(prev => prev.filter(p => p.id !== player.id));
      
      toastSuccess(`${player.athleteFirstName} ${player.athleteLastName} registration declined`);
    } catch (error: any) {
      console.error('Error declining player:', error);
      toastError(error.message || 'Failed to decline registration');
    } finally {
      setDecliningPlayerId(null);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      setCreateError('Name is required');
      return;
    }
    
    // Validate team ID
    if (!createTeamId.trim()) {
      setCreateError('Team ID is required');
      return;
    }
    
    // Validate age group for teams
    if (isTeamCommissioner) {
      const hasAgeGroup = Array.isArray(createAgeGroup) ? createAgeGroup.length > 0 : !!createAgeGroup;
      if (!hasAgeGroup) {
        setCreateError('Please select an age group');
        return;
      }
    }
    
    // Get sport from sidebar selection
    const currentSport = selectedSport || localStorage.getItem('commissioner_selected_sport') || 'Football';
    
    // Get city/state from program or fallback to form
    const teamCity = programData?.city || createCity || '';
    const teamState = programData?.state || createState || '';
    
    if (!teamCity || !teamState) {
      setCreateError('Program city/state not set. Please update your program first.');
      return;
    }
    
    setCreating(true);
    setCreateError('');
    
    try {
      if (isTeamCommissioner) {
        // Validate custom team ID if provided
        const customTeamId = createTeamId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        if (customTeamId) {
          // Check if team ID already exists
          const existingTeam = await getDoc(doc(db, 'teams', customTeamId));
          if (existingTeam.exists()) {
            setCreateError(`Team ID "${customTeamId}" is already taken. Please choose a different ID.`);
            setCreating(false);
            return;
          }
        }
        
        // Prepare age group data
        const primaryAgeGroup = Array.isArray(createAgeGroup) ? createAgeGroup[0] : createAgeGroup;
        const ageGroupsArray = Array.isArray(createAgeGroup) ? createAgeGroup : [createAgeGroup];
        
        // Team data - include programId if commissioner has a program
        const teamData: any = {
          name: createName.trim(),
          sport: currentSport,
          ageGroup: primaryAgeGroup,
          ageGroups: ageGroupsArray,
          ageGroupType: createAgeGroupType,
          city: teamCity,
          state: teamState,
          location: {
            city: teamCity,
            state: teamState,
          },
          ownerId: user?.uid,
          ownerName: userData?.name,
          color: programData?.primaryColor || '#f97316',
          primaryColor: programData?.primaryColor || '#f97316',
          secondaryColor: programData?.secondaryColor || '#1e293b',
          createdAt: serverTimestamp(),
        };
        
        // Link to program if exists
        if (programData?.id) {
          teamData.programId = programData.id;
          teamData.programName = programData?.name || '';
        }
        
        // Create team with custom ID or auto-generated ID
        let teamId: string;
        if (customTeamId) {
          await setDoc(doc(db, 'teams', customTeamId), teamData);
          teamId = customTeamId;
        } else {
          const teamRef = await addDoc(collection(db, 'teams'), teamData);
          teamId = teamRef.id;
        }
        
        setTeams(prev => [...prev, { 
          id: teamId, 
          name: createName.trim(),
          sport: currentSport as any,
          coachId: null,
          location: { city: teamCity, state: teamState },
        } as Team]);
        
        setStats(prev => ({ ...prev, totalTeams: prev.totalTeams + 1 }));
      } else {
        // Create a new league
        const leagueRef = await addDoc(collection(db, 'leagues'), {
          name: createName.trim(),
          sport: currentSport,
          city: teamCity,
          state: teamState,
          ownerId: user?.uid,
          ownerName: userData?.name,
          teamIds: [],
          status: 'active',
          createdAt: serverTimestamp(),
        });
        
        setLeagues(prev => [...prev, { 
          id: leagueRef.id, 
          name: createName.trim(),
          sport: currentSport,
        }]);
        
        setStats(prev => ({ ...prev, totalLeagues: prev.totalLeagues + 1 }));
      }
      
      setShowCreateModal(false);
      setCreateName('');
      setCreateTeamId('');
      setCreateSport('Football');
      setCreateAgeGroup('');
      setCreateAgeGroupType('single');
      setCreateCity('');
      setCreateState('');
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  // Open edit modal for a team
  const handleEditTeam = async (team: Team, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingTeam(team);
    setEditName(team.name || '');
    setEditTeamId(team.id || '');
    setEditAgeGroup(team.ageGroups || team.ageGroup || '');
    setEditAgeGroupType(team.ageGroupType || 'single');
    setEditCity(team.location?.city || team.city || '');
    setEditState(team.location?.state || team.state || '');
    setEditSport(team.sport || 'Football');
    setEditPrimaryColor(team.primaryColor || team.color || '#f97316');
    setEditSecondaryColor(team.secondaryColor || '#1e293b');
    setEditIsCheerTeam(team.isCheerTeam || false);
    setEditLinkedCheerTeamId(team.linkedCheerTeamId || '');
    setEditLinkedToTeamId(team.linkedToTeamId || '');
    setEditLinkedToTeamName(team.linkedToTeamName || '');
    setEditSportTeamSearch('');
    setEditSportTeamResults([]);
    setEditMaxRosterSize(team.maxRosterSize || 25);
    setEditError('');
    
    // Load available cheer teams (exclude current team, only include cheer teams)
    if (!team.isCheerTeam) {
      const cheerQuery = query(
        collection(db, 'teams'),
        where('isCheerTeam', '==', true),
        where('ownerId', '==', user?.uid)
      );
      const cheerSnap = await getDocs(cheerQuery);
      const cheerTeams = cheerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setAvailableCheerTeams(cheerTeams);
    } else {
      setAvailableCheerTeams([]);
    }
    
    setShowEditModal(true);
  };

  // Search for sport teams to link cheer team to (in edit modal)
  const handleEditSearchSportTeams = async () => {
    if (!user?.uid || !editSportTeamSearch.trim()) return;
    
    setSearchingSportTeams(true);
    try {
      // Search teams owned by this user (filter out cheer teams client-side to avoid index)
      const teamsQuery = query(
        collection(db, 'teams'),
        where('ownerId', '==', user.uid)
      );
      const snap = await getDocs(teamsQuery);
      
      const searchLower = editSportTeamSearch.toLowerCase();
      const results = snap.docs
        .filter(doc => !doc.data().isCheerTeam && doc.id !== editingTeam?.id) // Exclude cheer teams and current team
        .map(doc => ({
          id: doc.id,
          name: doc.data().name || 'Unnamed Team',
          sport: doc.data().sport || 'football',
        }))
        .filter(team => team.name.toLowerCase().includes(searchLower));
      
      setEditSportTeamResults(results);
    } catch (err) {
      console.error('Error searching sport teams:', err);
    } finally {
      setSearchingSportTeams(false);
    }
  };

  // Save edited team
  const handleSaveEdit = async () => {
    if (!editingTeam) return;
    
    if (!editName.trim()) {
      setEditError('Team name is required');
      return;
    }
    
    const hasAgeGroup = Array.isArray(editAgeGroup) ? editAgeGroup.length > 0 : !!editAgeGroup;
    if (!hasAgeGroup) {
      setEditError('Please select an age group');
      return;
    }
    
    setEditing(true);
    setEditError('');
    
    try {
      // Check if team ID changed and validate new ID
      const newTeamId = editTeamId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      const teamIdChanged = newTeamId && newTeamId !== editingTeam.id;
      
      if (teamIdChanged) {
        // Check if new team ID already exists
        const existingTeam = await getDoc(doc(db, 'teams', newTeamId));
        if (existingTeam.exists()) {
          setEditError(`Team ID "${newTeamId}" is already taken. Please choose a different ID.`);
          setEditing(false);
          return;
        }
      }
      
      const primaryAgeGroup = Array.isArray(editAgeGroup) ? editAgeGroup[0] : editAgeGroup;
      const ageGroupsArray = Array.isArray(editAgeGroup) ? editAgeGroup : [editAgeGroup];
      
      // Only update name, teamId, and ageGroup - other fields stay from program
      const updateData: Record<string, any> = {
        name: editName.trim(),
        ageGroup: primaryAgeGroup,
        ageGroups: ageGroupsArray,
        ageGroupType: editAgeGroupType,
        updatedAt: serverTimestamp(),
      };
      
      if (teamIdChanged) {
        // Create new document with new ID, copy all data
        const oldTeamDoc = await getDoc(doc(db, 'teams', editingTeam.id!));
        const oldData = oldTeamDoc.data();
        
        // Create new team document
        await setDoc(doc(db, 'teams', newTeamId), {
          ...oldData,
          ...updateData,
        });
        
        // Copy subcollections (players, plays, events, etc.)
        const subcollections = ['players', 'plays', 'events', 'assignedPlays'];
        for (const subcol of subcollections) {
          const subcolSnap = await getDocs(collection(db, 'teams', editingTeam.id!, subcol));
          for (const subDoc of subcolSnap.docs) {
            await setDoc(doc(db, 'teams', newTeamId, subcol, subDoc.id), subDoc.data());
          }
        }
        
        // Delete old team document and subcollections
        for (const subcol of subcollections) {
          const subcolSnap = await getDocs(collection(db, 'teams', editingTeam.id!, subcol));
          for (const subDoc of subcolSnap.docs) {
            await deleteDoc(doc(db, 'teams', editingTeam.id!, subcol, subDoc.id));
          }
        }
        await deleteDoc(doc(db, 'teams', editingTeam.id!));
        
        // Update local state with new ID
        setTeams(prev => prev.map(t => 
          t.id === editingTeam.id 
            ? { ...t, id: newTeamId, name: editName.trim(), location: { city: editCity.trim(), state: editState.trim() } }
            : t
        ));
      } else {
        // Just update the existing document
        await updateDoc(doc(db, 'teams', editingTeam.id!), updateData);
        
        // Update local state
        setTeams(prev => prev.map(t => 
          t.id === editingTeam.id 
            ? { ...t, name: editName.trim(), location: { city: editCity.trim(), state: editState.trim() } }
            : t
        ));
      }
      
      setShowEditModal(false);
      setEditingTeam(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update team');
    } finally {
      setEditing(false);
    }
  };

  // Open delete confirmation
  const handleDeleteClick = (team: Team, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingTeam(team);
    setShowDeleteConfirm(true);
  };

  // Confirm delete team
  const handleConfirmDelete = async () => {
    if (!deletingTeam) return;
    
    setDeleting(true);
    
    try {
      const batch = writeBatch(db);
      
      // Delete all players from team
      const playersSnap = await getDocs(collection(db, 'teams', deletingTeam.id!, 'players'));
      for (const playerDoc of playersSnap.docs) {
        batch.delete(doc(db, 'teams', deletingTeam.id!, 'players', playerDoc.id));
      }
      
      // Delete all plays from team
      const playsSnap = await getDocs(collection(db, 'teams', deletingTeam.id!, 'plays'));
      for (const playDoc of playsSnap.docs) {
        batch.delete(doc(db, 'teams', deletingTeam.id!, 'plays', playDoc.id));
      }
      
      // Delete all events from team
      const eventsSnap = await getDocs(collection(db, 'teams', deletingTeam.id!, 'events'));
      for (const eventDoc of eventsSnap.docs) {
        batch.delete(doc(db, 'teams', deletingTeam.id!, 'events', eventDoc.id));
      }
      
      // Delete assigned plays
      const assignedPlaysSnap = await getDocs(collection(db, 'teams', deletingTeam.id!, 'assignedPlays'));
      for (const assignedDoc of assignedPlaysSnap.docs) {
        batch.delete(doc(db, 'teams', deletingTeam.id!, 'assignedPlays', assignedDoc.id));
      }
      
      // Delete the team document itself
      batch.delete(doc(db, 'teams', deletingTeam.id!));
      
      await batch.commit();
      
      // Update local state
      setTeams(prev => prev.filter(t => t.id !== deletingTeam.id));
      setStats(prev => ({ 
        ...prev, 
        totalTeams: prev.totalTeams - 1,
        totalPlayers: prev.totalPlayers - (playersSnap.size || 0)
      }));
      
      setShowDeleteConfirm(false);
      setDeletingTeam(null);
    } catch (err: any) {
      console.error('Error deleting team:', err);
      alert('Failed to delete team: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Delete program handler
  const handleDeleteProgram = async () => {
    const programIdToDelete = programData?.id;
    if (!programIdToDelete) return;
    
    setDeletingProgram(true);
    
    try {
      const batch = writeBatch(db);
      
      // Delete all seasons under this program
      const seasonsSnap = await getDocs(collection(db, 'programs', programIdToDelete, 'seasons'));
      for (const seasonDoc of seasonsSnap.docs) {
        // Delete all pools under each season
        const poolsSnap = await getDocs(collection(db, 'programs', programIdToDelete, 'seasons', seasonDoc.id, 'pools'));
        for (const poolDoc of poolsSnap.docs) {
          // Delete all players in pool
          const playersSnap = await getDocs(collection(db, 'programs', programIdToDelete, 'seasons', seasonDoc.id, 'pools', poolDoc.id, 'players'));
          for (const playerDoc of playersSnap.docs) {
            batch.delete(playerDoc.ref);
          }
          batch.delete(poolDoc.ref);
        }
        batch.delete(seasonDoc.ref);
      }
      
      // Delete the program document itself
      batch.delete(doc(db, 'programs', programIdToDelete));
      
      // Remove programId from user profile
      if (user?.uid) {
        batch.update(doc(db, 'users', user.uid), {
          programId: null,
          role: 'Commissioner', // Reset role back to Commissioner
          updatedAt: serverTimestamp()
        });
      }
      
      await batch.commit();
      
      setShowDeleteProgramConfirm(false);
      
      // Redirect to fresh start
      window.location.reload();
    } catch (err: any) {
      console.error('Error deleting program:', err);
      alert('Failed to delete program: ' + err.message);
    } finally {
      setDeletingProgram(false);
    }
  };

  // Handle delete season
  const handleDeleteSeason = async () => {
    if (!deleteSeasonConfirm) return;
    
    const programId = programData?.id;
    if (!programId) return;
    
    setDeletingSeason(true);
    
    try {
      const batch = writeBatch(db);
      const seasonId = deleteSeasonConfirm.id;
      
      // Delete all pools under this season
      const poolsSnap = await getDocs(collection(db, 'programs', programId, 'seasons', seasonId, 'pools'));
      for (const poolDoc of poolsSnap.docs) {
        // Delete all players in pool
        const playersSnap = await getDocs(collection(db, 'programs', programId, 'seasons', seasonId, 'pools', poolDoc.id, 'players'));
        for (const playerDoc of playersSnap.docs) {
          batch.delete(playerDoc.ref);
        }
        batch.delete(poolDoc.ref);
      }
      
      // Delete the season document
      batch.delete(doc(db, 'programs', programId, 'seasons', seasonId));
      
      await batch.commit();
      
      // Remove from local state
      setSeasons(prev => prev.filter(s => s.id !== seasonId));
      setDeleteSeasonConfirm(null);
      
      console.log('✅ Season deleted:', seasonId);
    } catch (err: any) {
      console.error('Error deleting season:', err);
      alert('Failed to delete season: ' + err.message);
    } finally {
      setDeletingSeason(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-slate-100'}`}>
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  // Check for valid commissioner role
  const validRoles = ['Commissioner', 'ProgramCommissioner', 'LeagueOwner', 'TeamCommissioner', 'LeagueCommissioner'];
  if (!userData || !validRoles.includes(userData.role)) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-gray-900' : 'bg-slate-100'}`}>
        <div className="text-center">
          <Shield className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-slate-400'}`} />
          <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Access Denied</h2>
          <p className={`mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>You need to be a Commissioner to view this page.</p>
          <Link 
            to="/auth?signup=true"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Shield className="w-4 h-4" />
            Sign Up as Commissioner
          </Link>
        </div>
      </div>
    );
  }

  const pendingGrievances = grievances.filter(g => g.status === 'submitted' || g.status === 'under_review');

  return (
    <div className={`min-h-screen pb-20 ${theme === 'dark' ? 'bg-gray-900' : 'bg-slate-100'}`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${isLeagueCommissioner ? 'from-purple-600 to-indigo-600' : 'from-purple-600 to-pink-600'}`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center`}>
                {isLeagueCommissioner ? (
                  <Crown className="w-6 h-6 text-white" />
                ) : (
                  <Trophy className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {isLeagueCommissioner ? 'League Commissioner' : 'Team Commissioner'}
                </h1>
                <p className="text-white/80 text-sm">
                  {userData?.name} • {isLeagueCommissioner ? 'Manage leagues and tournaments' : 'Manage teams and rosters'}
                </p>
              </div>
            </div>
            
            {/* Sport Badge - Always visible on right */}
            <div className="flex items-center gap-3">
              {/* Sport Badge with Icon */}
              {(() => {
                const sport = selectedSport || localStorage.getItem('commissioner_selected_sport') || 'Football';
                const sportEmoji: Record<string, string> = {
                  'Football': '🏈',
                  'Basketball': '🏀',
                  'Soccer': '⚽',
                  'Baseball': '⚾',
                  'Softball': '🥎',
                  'Volleyball': '🏐',
                  'Cheer': '📣',
                  'Track': '🏃',
                  'Wrestling': '🤼',
                  'Hockey': '🏒',
                  'Lacrosse': '🥍',
                  'Tennis': '🎾',
                  'Golf': '⛳',
                  'Swimming': '🏊',
                };
                return (
                  <div className="flex items-center gap-2 bg-white/20 px-3 py-2 rounded-lg border border-white/30">
                    <span className="text-lg">{sportEmoji[sport] || '🏆'}</span>
                    <span className="text-white font-medium text-sm">{sport}</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        
        {/* Hero Alert: No Teams Yet */}
        {isTeamCommissioner && teams.length === 0 && !hasProgram && (
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 rounded-2xl p-8 text-white shadow-2xl">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <Trophy className="w-10 h-10 text-white" />
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                  🎉 Welcome to OSYS, Commissioner!
                </h2>
                <p className="text-white/90 text-lg mb-1">
                  You're ready to build your program. Let's set it up!
                </p>
                <p className="text-white/70 text-sm">
                  Configure your sports and age groups. Then open registration and create teams from your player pool.
                </p>
              </div>
              
              <div className="flex-shrink-0">
                <button
                  onClick={() => navigate('/commissioner/program-setup')}
                  className="px-6 py-3 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2"
                >
                  <Building2 className="w-5 h-5" />
                  Setup Your Program
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hero Alert: No Leagues Yet (for League Commissioners) */}
        {isLeagueCommissioner && leagues.length === 0 && (
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-500 rounded-2xl p-8 text-white shadow-2xl">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <Crown className="w-10 h-10 text-white" />
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                  🎉 Welcome to OSYS, Commissioner!
                </h2>
                <p className="text-white/90 text-lg mb-1">
                  You're ready to build your league. Let's create your first one!
                </p>
                <p className="text-white/70 text-sm">
                  Set up your league with name, sport, and location. Then invite teams to join.
                </p>
              </div>
              
              <div className="flex-shrink-0">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-white text-purple-600 font-bold rounded-xl hover:bg-purple-50 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First League
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLeagueCommissioner ? (
            <>
              <div className={`rounded-xl p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Layers className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Leagues</span>
                </div>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stats.totalLeagues}</p>
              </div>
              
              <div className={`rounded-xl p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Teams</span>
                </div>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stats.totalTeams}</p>
              </div>
            </>
          ) : (
            <>
              {/* Teams - Clickable (redirect to age groups if none) */}
              <button
                onClick={() => {
                  const ageGroupCount = (programData as any)?.ageGroups?.length || 0;
                  if (!hasProgram) {
                    toastError('Set up your program first');
                    navigate('/commissioner/program-setup');
                  } else if (ageGroupCount === 0) {
                    toastError('Create age groups first');
                    navigate('/commissioner/age-groups');
                  } else {
                    navigate('/commissioner/teams');
                  }
                }}
                className={`rounded-xl p-4 text-left transition-all hover:scale-[1.02] ${
                  theme === 'dark' 
                    ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-orange-500/50' 
                    : 'bg-white border border-slate-200 hover:border-orange-400 hover:shadow-lg'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-orange-400" />
                  </div>
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                    Teams
                  </span>
                </div>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {filteredTeams.length}
                </p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-500'}`}>
                  Click to manage →
                </p>
              </button>
              
              {/* Age Groups - Clickable */}
              <button
                onClick={() => {
                  // Get sport-specific age groups count
                  const sportConfigs = (programData as any)?.sportConfigs || [];
                  const currentSportConfig = sportConfigs.find((sc: any) => sc.sport?.toLowerCase() === selectedSport?.toLowerCase());
                  const sportAgeGroupCount = currentSportConfig?.ageGroups?.length || 0;
                  
                  // If no age groups for this sport, show info but still navigate (they need to create them)
                  if (sportAgeGroupCount === 0) {
                    toastInfo(`No age groups configured for ${selectedSport}. Create some now!`);
                  }
                  navigate('/commissioner/age-groups');
                }}
                className={`rounded-xl p-4 text-left transition-all hover:scale-[1.02] ${
                  theme === 'dark' 
                    ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-purple-500/50' 
                    : 'bg-white border border-slate-200 hover:border-purple-400 hover:shadow-lg'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Layers className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                    Age Groups
                  </span>
                </div>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {(() => {
                    // Get sport-specific age groups count ONLY - no fallback to legacy
                    const sportConfigs = (programData as any)?.sportConfigs || [];
                    const currentSportConfig = sportConfigs.find((sc: any) => sc.sport?.toLowerCase() === selectedSport?.toLowerCase());
                    return currentSportConfig?.ageGroups?.length || 0;
                  })()}
                </p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-500'}`}>
                  Click to manage →
                </p>
              </button>
            </>
          )}
          
          {/* Seasons */}
          <button
            onClick={() => setShowSeasonManageModal(true)}
            className={`rounded-xl p-4 text-left transition-all hover:scale-[1.02] ${
              theme === 'dark' 
                ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500/50' 
                : 'bg-white border border-slate-200 hover:border-blue-400 hover:shadow-lg'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Seasons</span>
            </div>
            <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {filteredSeasons.length}
            </p>
            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`}>
              Click to manage →
            </p>
          </button>
          
          {/* Grievances */}
          <Link
            to="/commissioner/grievances"
            className={`rounded-xl p-4 text-left transition-all hover:scale-[1.02] ${
              theme === 'dark' 
                ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-yellow-500/50' 
                : 'bg-white border border-slate-200 hover:border-yellow-400 hover:shadow-lg'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Grievances</span>
            </div>
            <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stats.activeGrievances}</p>
          </Link>
        </div>

        {/* No Program Yet - Setup Prompt */}
        {!hasProgram && isTeamCommissioner && (
          <div className={`rounded-xl p-6 ${
            theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-slate-200'
          }`}>
            <div className="text-center">
              <Building2 className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-slate-400'}`} />
              <p className={`mb-2 font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>No program yet</p>
              <p className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                Set up your program to start creating age groups and teams.
              </p>
              <button
                onClick={() => navigate('/commissioner/program-setup')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Building2 className="w-4 h-4" />
                Setup Your Program
              </button>
            </div>
          </div>
        )}

        {/* Program Name Banner (if has program) */}
        {hasProgram && programData && (
          <div className={`rounded-xl p-4 flex items-center justify-between ${
            theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              {/* Logo or Initial */}
              {(programData as any).logoUrl ? (
                <img 
                  src={(programData as any).logoUrl} 
                  alt={programData.name || 'Logo'}
                  className="w-12 h-12 rounded-xl object-cover"
                />
              ) : (
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                  style={{ 
                    background: programData.primaryColor && programData.secondaryColor
                      ? `linear-gradient(135deg, ${programData.primaryColor}, ${programData.secondaryColor})`
                      : 'linear-gradient(135deg, #7c3aed, #ec4899)'
                  }}
                >
                  {programData.name?.charAt(0) || 'P'}
                </div>
              )}
              <div>
                <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {programData.name}
                </h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                  {programData.city}, {programData.state}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/commissioner/program-setup/${programData?.id}?mode=info`)}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'}`}
                title="Edit Program"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowDeleteProgramConfirm(true)}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                title="Delete Program"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Draft Pool Section - Only for Team Commissioners with pending registrations */}
        {!isLeagueCommissioner && hasProgram && dashboardDraftPoolPlayers.filter(p => p.status === 'available' || !p.status).length > 0 && (
          <div className={`rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'}`}>
            <div className={`px-4 py-3 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <Users className={`w-5 h-5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
                <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Draft Pool
                </h2>
                <span className={`text-sm px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
                  {dashboardDraftPoolPlayers.filter(p => p.status === 'available' || !p.status).length} pending
                </span>
              </div>
              <button
                onClick={() => setShowDraftPoolModal(true)}
                className={`text-sm ${theme === 'dark' ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500'} flex items-center gap-1`}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {/* Age Group Filter Pills */}
            {dashboardAgeGroups.length > 1 && (
              <div className={`px-4 py-3 flex flex-wrap gap-2 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
                <button
                  onClick={() => setDashboardDraftFilter('all')}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    dashboardDraftFilter === 'all'
                      ? theme === 'dark' ? 'bg-purple-600 text-white' : 'bg-purple-600 text-white'
                      : theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All
                </button>
                {dashboardAgeGroups.map(ag => (
                  <button
                    key={ag}
                    onClick={() => setDashboardDraftFilter(ag)}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                      dashboardDraftFilter === ag
                        ? theme === 'dark' ? 'bg-purple-600 text-white' : 'bg-purple-600 text-white'
                        : theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {ag}
                  </button>
                ))}
              </div>
            )}
            
            {/* Draft Pool Players */}
            {loadingDashboardDraft ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : (
              <div className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-slate-200'}`}>
                {dashboardDraftPoolPlayers
                  .filter(p => (p.status === 'available' || !p.status) && (dashboardDraftFilter === 'all' || p.ageGroup === dashboardDraftFilter))
                  .slice(0, 10)
                  .map((player) => (
                    <div
                      key={player.id}
                      className={`px-4 py-3 flex items-center justify-between ${theme === 'dark' ? 'hover:bg-gray-750' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
                          {player.athleteFirstName?.charAt(0) || '?'}{player.athleteLastName?.charAt(0) || ''}
                        </div>
                        <div>
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            {player.athleteFirstName} {player.athleteLastName}
                          </p>
                          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                            {player.ageGroup} • {player.position || 'No position'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setPlayerToDraft(player);
                            setShowDraftToTeamModal(true);
                          }}
                          disabled={draftingPlayerId === player.id}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                            draftingPlayerId === player.id
                              ? 'bg-gray-500 text-white cursor-wait'
                              : theme === 'dark'
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {draftingPlayerId === player.id ? 'Drafting...' : 'Draft'}
                        </button>
                        <button
                          onClick={() => handleDeclinePlayer(player)}
                          disabled={decliningPlayerId === player.id}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                            decliningPlayerId === player.id
                              ? 'bg-gray-500 text-white cursor-wait'
                              : theme === 'dark'
                              ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400'
                              : 'bg-red-100 hover:bg-red-200 text-red-600'
                          }`}
                        >
                          {decliningPlayerId === player.id ? 'Declining...' : 'Decline'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Teams or Leagues List - Only show if program exists for team commissioners */}
        {(isLeagueCommissioner || hasProgram) && (
        <div className={`rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'}`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {isLeagueCommissioner ? 'Your Leagues' : 'Season Manager'}
              </h2>
              {!isLeagueCommissioner && selectedSport && (
                <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                  — {selectedSport.charAt(0).toUpperCase() + selectedSport.slice(1).toLowerCase()}
                  {(() => {
                    const sportLower = selectedSport.toLowerCase();
                    const sportName = (programData as any)?.sportNames?.[sportLower] || programData?.name;
                    return sportName ? ` | ${sportName}` : '';
                  })()}
                </span>
              )}
            </div>
            <Link
              to={isLeagueCommissioner ? "/commissioner/leagues" : "/commissioner/teams"}
              className={`text-sm ${isLeagueCommissioner ? 'text-purple-400 hover:text-purple-300' : 'text-orange-400 hover:text-orange-300'} flex items-center gap-1`}
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {isLeagueCommissioner ? (
            // League Commissioner - show leagues
            leagues.length === 0 ? (
              <div className="p-8 text-center">
                <Layers className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-slate-400'}`} />
                <p className={`mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>No leagues yet. Create your first league to get started.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create League
                </button>
              </div>
            ) : (
              <div className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-slate-200'}`}>
                {leagues.slice(0, 5).map((league) => (
                  <Link
                    key={league.id}
                    to={`/commissioner/leagues/${league.id}`}
                    className={`flex items-center justify-between px-4 py-3 transition-colors ${theme === 'dark' ? 'hover:bg-gray-750' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold">
                        {league.name?.charAt(0) || 'L'}
                      </div>
                      <div>
                        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{league.name}</p>
                        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>{league.sport} • {(league.teamIds || []).length} teams</p>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`} />
                  </Link>
                ))}
              </div>
            )
          ) : (
            // Team Commissioner - Season Manager
            !hasProgram ? (
              // No program set up yet
              <div className="p-8 text-center">
                <Building2 className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-slate-400'}`} />
                <p className={`mb-2 font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Setup your program first</p>
                <p className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                  Create your program to start managing teams and seasons.
                </p>
                <button
                  onClick={() => navigate('/commissioner/program-setup')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  <Building2 className="w-4 h-4" />
                  Setup Your Program
                </button>
              </div>
            ) : filteredSeasons.length === 0 ? (
              // No season yet - show create season CTA or warning
              (() => {
                const { canCreate, missingAgeGroups, missingTeams } = canCreateSeason();
                const sportName = selectedSport?.charAt(0).toUpperCase() + selectedSport?.slice(1).toLowerCase();
                
                if (!canCreate) {
                  return (
                    <div className="p-8 text-center">
                      <AlertCircle className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-500'}`} />
                      <p className={`mb-2 font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                        Setup Required Before Creating Season
                      </p>
                      <p className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                        {missingAgeGroups && missingTeams
                          ? `Configure age groups and create teams for ${sportName} first.`
                          : missingAgeGroups
                            ? `Configure age groups for ${sportName} first.`
                            : `Create at least one team for ${sportName} first.`
                        }
                      </p>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        {missingAgeGroups && (
                          <button
                            onClick={() => setShowAgeGroupsModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                          >
                            <Settings className="w-4 h-4" />
                            Configure Age Groups
                          </button>
                        )}
                        {missingTeams && (
                          <button
                            onClick={() => navigate('/commissioner/teams/create')}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                          >
                            <Users className="w-4 h-4" />
                            Create Team
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className="p-8 text-center">
                    <Calendar className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} />
                    <p className={`mb-2 font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                      Create Your First Season
                    </p>
                    <p className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                      Set up registration pools for parents to register their kids.
                    </p>
                    <button
                      onClick={handleCreateSeasonClick}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                    >
                      <Calendar className="w-5 h-5" />
                      Create Season
                    </button>
                  </div>
                );
              })()
            ) : (
              // Has seasons - show season list with active first, completed collapsed
              (() => {
                // Separate active and completed seasons
                const activeSeasons = filteredSeasons.filter(s => 
                  s.status !== 'completed' && getSeasonStatus(s).label !== 'Completed'
                );
                const completedSeasons = filteredSeasons.filter(s => 
                  s.status === 'completed' || getSeasonStatus(s).label === 'Completed'
                );
                
                // Helper to render a season item
                const renderSeasonItem = (season: ProgramSeason) => {
                  const statusInfo = getSeasonStatus(season);
                  const isCompleted = season.status === 'completed' || statusInfo.label === 'Completed';
                  
                  return (
                  <div
                    key={season.id}
                    className={`transition-colors cursor-pointer ${theme === 'dark' ? 'hover:bg-gray-750' : 'hover:bg-slate-50'}`}
                  >
                    <div 
                      onClick={() => {
                        setSelectedSeasonForEdit(season);
                        setShowSeasonManageModal(true);
                      }}
                      className="flex items-center justify-between px-4 py-3"
                    >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isCompleted ? 'bg-gray-500/20' : 'bg-blue-500/20'}`}>
                        <Calendar className={`w-5 h-5 ${isCompleted ? 'text-gray-400' : 'text-blue-400'}`} />
                      </div>
                      <div>
                        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{season.name}</p>
                        <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                          {statusInfo.icon} {statusInfo.label}
                          {season.seasonStartDate && season.seasonEndDate && (
                            <span className="ml-2 text-xs">
                              • {new Date(season.seasonStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(season.seasonEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteSeasonConfirm(season); }}
                        className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'}`}
                        title="Delete Season"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {/* Only show edit for non-completed seasons */}
                      {!isCompleted && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Go directly to edit mode
                            setSelectedSeasonForEdit(season);
                            setIsEditingSeasonMode(true);
                            const seasonPaymentOptions = (season as any).paymentOptions || {};
                            setEditSeasonData({
                              name: season.name,
                              seasonStartDate: season.seasonStartDate || '',
                              seasonEndDate: season.seasonEndDate || '',
                              registrationOpenDate: season.registrationOpenDate,
                              registrationCloseDate: season.registrationCloseDate,
                              registrationFee: season.registrationFee || 0,
                              requireWaiver: (season as any).requireWaiver !== false,
                              requireMedicalInfo: (season as any).requireMedicalInfo === true,
                              requireEmergencyContact: (season as any).requireEmergencyContact !== false,
                              requireUniformSizes: (season as any).requireUniformSizes === true,
                              paymentOptions: {
                                payInFull: seasonPaymentOptions.payInFull !== false,
                                payAsYouGo: seasonPaymentOptions.payAsYouGo === true,
                                payInCash: seasonPaymentOptions.payInCash === true
                              }
                            });
                            setShowSeasonManageModal(true);
                          }}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-purple-400 hover:bg-purple-500/10' : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50'}`}
                          title="Edit Season"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Age Groups Summary */}
                  {season.sportsOffered && season.sportsOffered.length > 0 && (
                    <div className={`px-4 pb-3 pt-0 flex flex-wrap gap-1.5`}>
                      {season.sportsOffered.flatMap(sc => sc.ageGroups || []).slice(0, 4).map((ag) => {
                        const teamsCount = teams.filter(t => 
                          t.ageGroup === ag.label || 
                          t.ageGroups?.some(a => ag.ageGroups.includes(a))
                        ).length;
                        return (
                          <span key={ag.id} className={`text-xs px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-white/10 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
                            {ag.label} ({teamsCount})
                          </span>
                        );
                      })}
                      {season.sportsOffered.flatMap(sc => sc.ageGroups || []).length > 4 && (
                        <span className={`text-xs px-2 py-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                          +{season.sportsOffered.flatMap(sc => sc.ageGroups || []).length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Quick Action Buttons - Only for non-completed seasons */}
                  {!isCompleted && (
                  <div className={`px-4 pb-3 flex flex-wrap gap-2`}>
                    {/* Start Season Button - Show if not active/completed */}
                    {season.status !== 'active' && season.status !== 'completed' && statusInfo.label !== 'In Season' && statusInfo.label !== 'Completed' && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!programData?.id || updatingSeasonStatus) return;
                          setUpdatingSeasonStatus(true);
                          try {
                            // Close registration by setting end date to yesterday so it properly shows as ended
                            const yesterday = new Date();
                            yesterday.setDate(yesterday.getDate() - 1);
                            const yesterdayStr = yesterday.toISOString().split('T')[0];
                            await updateDoc(doc(db, 'programs', programData.id, 'seasons', season.id), {
                              status: 'active',
                              registrationCloseDate: yesterdayStr,
                              startedAt: serverTimestamp(),
                              updatedAt: serverTimestamp()
                            });
                            toastSuccess('Season started! Registration is now closed.');
                          } catch (error) {
                            console.error('Error starting season:', error);
                            toastError('Failed to start season');
                          } finally {
                            setUpdatingSeasonStatus(false);
                          }
                        }}
                        disabled={updatingSeasonStatus}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Start Season
                      </button>
                    )}
                    
                    {/* End Season Button - Show if active */}
                    {(season.status === 'active' || statusInfo.label === 'In Season') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSeasonForEdit(season);
                          setShowEndSeasonConfirm(true);
                        }}
                        disabled={updatingSeasonStatus}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <Square className="w-3.5 h-3.5" />
                        End Season
                      </button>
                    )}
                    
                    {/* Add Games Button - Only enabled when season is active */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (season.status === 'active' || statusInfo.label === 'In Season') {
                          navigate(`/commissioner/schedule-builder/${season.id}`);
                        } else {
                          toastError('Start the season first before adding games');
                        }
                      }}
                      disabled={season.status !== 'active' && statusInfo.label !== 'In Season'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                        season.status === 'active' || statusInfo.label === 'In Season'
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : theme === 'dark' 
                            ? 'bg-white/10 text-slate-500 cursor-not-allowed' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      title={season.status !== 'active' && statusInfo.label !== 'In Season' ? 'Start season first' : (season.scheduleBuilt ? 'Edit schedule' : 'Build schedule')}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      {season.scheduleBuilt ? 'Edit Schedule' : 'Build Schedule'}
                    </button>
                  </div>
                  )}
                  </div>
                  );
                };
                
                return (
                <div className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-slate-200'}`}>
                  {/* Active Seasons First */}
                  {activeSeasons.slice(0, 3).map(renderSeasonItem)}
                  
                  {/* Start Next Season - Only show if no active seasons but have completed */}
                  {activeSeasons.length === 0 && completedSeasons.length > 0 && (
                    <div className="px-4 py-3">
                      <button
                        onClick={handleCreateSeasonClick}
                        className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Start Next Season
                      </button>
                    </div>
                  )}
                  
                  {/* Completed Seasons - Collapsed by default */}
                  {completedSeasons.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowCompletedSeasons(!showCompletedSeasons)}
                        className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${
                          theme === 'dark' ? 'hover:bg-gray-750' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Check className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`} />
                          <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                            Completed Seasons ({completedSeasons.length})
                          </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 transition-transform ${
                          showCompletedSeasons ? 'rotate-180' : ''
                        } ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`} />
                      </button>
                      
                      {showCompletedSeasons && (
                        <div className={`${theme === 'dark' ? 'bg-gray-800/50' : 'bg-slate-50'}`}>
                          {completedSeasons.map(renderSeasonItem)}
                        </div>
                      )}
                    </>
                  )}
                </div>
                );
              })()
            )
          )}
        </div>
        )}

        {/* Getting Started Tips */}
        {((isLeagueCommissioner && leagues.length === 0) || (isTeamCommissioner && teams.length === 0)) && (
          <div className={`border rounded-xl p-6 ${
            theme === 'dark' 
              ? isLeagueCommissioner ? 'bg-purple-500/10 border-purple-500/20' : 'bg-orange-500/10 border-orange-500/20'
              : isLeagueCommissioner ? 'bg-purple-50 border-purple-200' : 'bg-orange-50 border-orange-200'
          }`}>
            <h3 className={`font-bold mb-4 flex items-center gap-2 ${
              theme === 'dark'
                ? isLeagueCommissioner ? 'text-purple-300' : 'text-orange-300'
                : isLeagueCommissioner ? 'text-purple-700' : 'text-orange-700'
            }`}>
              <Target className="w-5 h-5" />
              Getting Started
            </h3>
            <div className="space-y-3">
              {isLeagueCommissioner ? (
                <>
                  <div className="flex items-start gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${theme === 'dark' ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>1</span>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Create Your First League</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Set up your league with name, sport, and location</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${theme === 'dark' ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>2</span>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Invite Teams to Join</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Share your league code so team commissioners can register</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${theme === 'dark' ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>3</span>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Create Schedules & Manage Games</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Build season schedules and assign referees</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${theme === 'dark' ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700'}`}>1</span>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Setup Your Program</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Configure sports and age groups for your organization</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${theme === 'dark' ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700'}`}>2</span>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Create a Season & Open Registration</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Players register into age group pools</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${theme === 'dark' ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700'}`}>3</span>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Create Teams & Draft Players</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Build teams from your registration pools</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Create Modal - Simplified */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl w-full max-w-md border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 border-b rounded-t-2xl ${theme === 'dark' ? 'border-gray-700 bg-purple-900/20' : 'border-slate-200 bg-purple-50'}`}>
              <h3 className={`text-lg font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <Trophy className="w-5 h-5 text-purple-500" />
                Create Team
              </h3>
            </div>
            
            <div className="p-4 space-y-4">
              {createError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                  {createError}
                </div>
              )}
              
              {/* Team Name */}
              <div className="space-y-1">
                <label className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                  Team Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g., Tigers, Eagles, Panthers"
                  className={`w-full rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme === 'dark' ? 'bg-gray-700 border border-gray-600 text-white placeholder-gray-400' : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400'}`}
                />
              </div>
              
              {/* Team ID */}
              <div className="space-y-1">
                <label className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                  Team ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={createTeamId}
                  onChange={(e) => setCreateTeamId(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                  placeholder="e.g., tigers-6u"
                  className={`w-full rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm ${theme === 'dark' ? 'bg-gray-700 border border-gray-600 text-white placeholder-gray-400' : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400'}`}
                />
                <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-slate-500'}`}>
                  URL-friendly ID. Only lowercase letters, numbers, and dashes.
                </p>
              </div>
              
              {/* Age Group - Simple dropdown from program's age groups */}
              <div className="space-y-1">
                <label className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                  Age Group <span className="text-red-400">*</span>
                </label>
                {((programData as any)?.ageGroups?.length > 0) ? (
                  <select
                    value={typeof createAgeGroup === 'string' ? createAgeGroup : ''}
                    onChange={(e) => setCreateAgeGroup(e.target.value)}
                    className={`w-full rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme === 'dark' ? 'bg-gray-700 border border-gray-600 text-white' : 'bg-white border border-slate-300 text-slate-900'}`}
                  >
                    <option value="">Select age group...</option>
                    {((programData as any)?.ageGroups || []).map((ag: string) => (
                      <option key={ag} value={ag}>{ag}</option>
                    ))}
                  </select>
                ) : (
                  <div className={`p-3 rounded-lg text-center ${theme === 'dark' ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
                    <p className={`text-sm ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'}`}>
                      No age groups created yet.
                    </p>
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        navigate('/commissioner/age-groups');
                      }}
                      className="mt-2 text-sm text-purple-500 hover:text-purple-400 font-medium"
                    >
                      Create Age Groups →
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className={`p-4 border-t flex gap-3 rounded-b-2xl ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
              <button
                onClick={() => setShowCreateModal(false)}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !createName.trim() || !createTeamId.trim() || !createAgeGroup}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create Team
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Team Modal */}
      {showEditModal && editingTeam && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 border-b flex items-center justify-between flex-shrink-0 ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
              <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <Edit2 className="w-5 h-5 text-blue-400" />
                Edit Team
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {editError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
                  {editError}
                </div>
              )}
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                  Team Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter team name"
                  className={`w-full border rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                  Team ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editTeamId}
                  onChange={(e) => setEditTeamId(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                  placeholder="unique-team-id"
                  className={`w-full border rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
                />
                <p className="text-xs text-yellow-500 mt-1">⚠️ Changing Team ID will migrate all data to new ID</p>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                  Age Group <span className="text-red-400">*</span>
                </label>
                {/* Show dropdown with program's saved age groups */}
                {(() => {
                  const programAgeGroups = (programData as any)?.ageGroups || [];
                  const currentAgeGroup = Array.isArray(editAgeGroup) ? editAgeGroup[0] : editAgeGroup;
                  return (
                    <div>
                      <div className={`w-full border rounded-lg py-2.5 px-3 mb-2 ${theme === 'dark' ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700'}`}>
                        Selected: {currentAgeGroup || 'None'}
                      </div>
                      {programAgeGroups.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {programAgeGroups.map((ag: string) => (
                            <button
                              key={ag}
                              type="button"
                              onClick={() => {
                                setEditAgeGroup(ag);
                                setEditAgeGroupType('single');
                              }}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                currentAgeGroup === ag
                                  ? 'bg-purple-600 text-white'
                                  : theme === 'dark'
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {ag}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                          No age groups configured. Go to Age Groups to add some.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            
            <div className={`p-4 border-t flex gap-3 flex-shrink-0 ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
              <button
                onClick={() => setShowEditModal(false)}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editing || !editName.trim()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {editing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Team Confirmation Modal */}
      {showDeleteConfirm && deletingTeam && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl w-full max-w-md border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Delete Team?</h2>
              <p className={`mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                Are you sure you want to delete <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>"{deletingTeam.name}"</span>?
              </p>
              <p className="text-red-500 text-sm mb-6">
                ⚠️ This action cannot be undone. All players, plays, and events associated with this team will be permanently deleted.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingTeam(null);
                  }}
                  className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Team
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Program Confirmation Modal */}
      {showDeleteProgramConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl w-full max-w-md border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Delete Program?</h2>
              <p className={`mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                Are you sure you want to delete <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>"{programData?.name || 'this program'}"</span>?
              </p>
              <p className="text-red-500 text-sm mb-6">
                ⚠️ This will delete ALL seasons, player pools, and registrations. You will need to set up everything from scratch.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteProgramConfirm(false)}
                  className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProgram}
                  disabled={deletingProgram}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deletingProgram ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Program
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Season Confirmation Modal */}
      {deleteSeasonConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl w-full max-w-md border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Delete Season?</h2>
              <p className={`mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                Are you sure you want to delete <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>"{deleteSeasonConfirm.name}"</span>?
              </p>
              <p className="text-red-500 text-sm mb-6">
                ⚠️ This will delete all player pools and registrations for this season.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteSeasonConfirm(null)}
                  className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSeason}
                  disabled={deletingSeason}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deletingSeason ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Season
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* End Season Confirmation Modal */}
      {showEndSeasonConfirm && selectedSeasonForEdit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`rounded-2xl w-full max-w-md border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Square className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>End Season?</h2>
              <p className={`mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                Are you sure you want to end <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>"{selectedSeasonForEdit.name}"</span>?
              </p>
              <div className={`p-3 rounded-lg mb-4 ${theme === 'dark' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
                <p className={`text-sm flex items-start gap-2 text-left ${theme === 'dark' ? 'text-amber-400' : 'text-amber-700'}`}>
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    This will mark the season as completed. All players will remain on their teams until released manually or a new season begins.
                  </span>
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEndSeasonConfirm(false)}
                  className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!programData?.id || updatingSeasonStatus) return;
                    setUpdatingSeasonStatus(true);
                    try {
                      await updateDoc(doc(db, 'programs', programData.id, 'seasons', selectedSeasonForEdit.id), {
                        status: 'completed',
                        completedAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                      });
                      setSelectedSeasonForEdit({ ...selectedSeasonForEdit, status: 'completed' });
                      setShowEndSeasonConfirm(false);
                      toastSuccess('Season ended successfully!');
                    } catch (error) {
                      console.error('Error ending season:', error);
                      toastError('Failed to end season');
                    } finally {
                      setUpdatingSeasonStatus(false);
                    }
                  }}
                  disabled={updatingSeasonStatus}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {updatingSeasonStatus ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Square className="w-4 h-4" />
                      End Season
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Season Management Modal */}
      {showSeasonManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-xl shadow-xl ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {selectedSeasonForEdit ? selectedSeasonForEdit.name : 'Manage Seasons'}
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                    {selectedSeasonForEdit 
                      ? `${getSeasonStatus(selectedSeasonForEdit).icon} ${getSeasonStatus(selectedSeasonForEdit).label}` 
                      : `${filteredSeasons.length} season${filteredSeasons.length !== 1 ? 's' : ''}`
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowSeasonManageModal(false); setSelectedSeasonForEdit(null); setIsEditingSeasonMode(false); setEditSeasonData(null); }}
                className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {selectedSeasonForEdit ? (
                // Show selected season details / edit form
                <div className="space-y-4">
                  {/* Season Name */}
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Season Name</label>
                    {isEditingSeasonMode ? (
                      <input
                        type="text"
                        value={editSeasonData?.name || ''}
                        onChange={(e) => setEditSeasonData(prev => prev ? {...prev, name: e.target.value} : null)}
                        className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900'} border focus:ring-2 focus:ring-purple-500/50`}
                      />
                    ) : (
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedSeasonForEdit.name}</p>
                    )}
                  </div>
                  
                  {/* Season Dates */}
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <h4 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Season Dates</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Starts</label>
                        {isEditingSeasonMode ? (
                          <input
                            type="date"
                            value={editSeasonData?.seasonStartDate || ''}
                            onChange={(e) => setEditSeasonData(prev => prev ? {...prev, seasonStartDate: e.target.value} : null)}
                            className={`w-full px-3 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900'} border focus:ring-2 focus:ring-purple-500/50`}
                          />
                        ) : (
                          <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {selectedSeasonForEdit.seasonStartDate ? new Date(selectedSeasonForEdit.seasonStartDate).toLocaleDateString() : 'Not set'}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Ends</label>
                        {isEditingSeasonMode ? (
                          <input
                            type="date"
                            value={editSeasonData?.seasonEndDate || ''}
                            onChange={(e) => setEditSeasonData(prev => prev ? {...prev, seasonEndDate: e.target.value} : null)}
                            className={`w-full px-3 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900'} border focus:ring-2 focus:ring-purple-500/50`}
                          />
                        ) : (
                          <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {selectedSeasonForEdit.seasonEndDate ? new Date(selectedSeasonForEdit.seasonEndDate).toLocaleDateString() : 'Not set'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Registration Dates */}
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Registration</h4>
                      {selectedSeasonForEdit.status !== 'setup' && selectedSeasonForEdit.status !== 'registration_open' && (
                        <span className={`text-xs px-2 py-0.5 rounded ${theme === 'dark' ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                          🔒 Locked
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Opens</label>
                        {isEditingSeasonMode && (selectedSeasonForEdit.status === 'setup' || selectedSeasonForEdit.status === 'registration_open') ? (
                          <input
                            type="date"
                            value={editSeasonData?.registrationOpenDate || ''}
                            onChange={(e) => setEditSeasonData(prev => prev ? {...prev, registrationOpenDate: e.target.value} : null)}
                            className={`w-full px-3 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900'} border focus:ring-2 focus:ring-purple-500/50`}
                          />
                        ) : (
                          <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {new Date(selectedSeasonForEdit.registrationOpenDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Closes</label>
                        {isEditingSeasonMode && (selectedSeasonForEdit.status === 'setup' || selectedSeasonForEdit.status === 'registration_open') ? (
                          <input
                            type="date"
                            value={editSeasonData?.registrationCloseDate || ''}
                            onChange={(e) => setEditSeasonData(prev => prev ? {...prev, registrationCloseDate: e.target.value} : null)}
                            className={`w-full px-3 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900'} border focus:ring-2 focus:ring-purple-500/50`}
                          />
                        ) : (
                          <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {new Date(selectedSeasonForEdit.registrationCloseDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Fee & Stats */}
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <h4 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Season Info</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Registration Fee</label>
                        {isEditingSeasonMode && (selectedSeasonForEdit.status === 'setup' || selectedSeasonForEdit.status === 'registration_open') ? (
                          <div className="relative">
                            <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>$</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={(editSeasonData?.registrationFee || 0) / 100}
                              onChange={(e) => setEditSeasonData(prev => prev ? {...prev, registrationFee: Math.round(parseFloat(e.target.value || '0') * 100)} : null)}
                              className={`w-full pl-7 pr-3 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900'} border focus:ring-2 focus:ring-purple-500/50`}
                            />
                          </div>
                        ) : (
                          <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {selectedSeasonForEdit.registrationFee ? `$${selectedSeasonForEdit.registrationFee / 100}` : 'Free'}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Draft Pools</label>
                        <button
                          onClick={() => {
                            setSelectedPoolSeason(selectedSeasonForEdit);
                            setShowDraftPoolModal(true);
                          }}
                          className={`font-medium text-sm underline ${theme === 'dark' ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500'}`}
                        >
                          {selectedSeasonForEdit.totalPools || selectedSeasonForEdit.sportsOffered?.reduce((acc, s) => acc + (s.ageGroups?.length || 0), 0) || 0} pools
                        </button>
                      </div>
                      <div>
                        <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Registrations</label>
                        <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {selectedSeasonForEdit.totalRegistrations || 0}
                        </p>
                      </div>
                    </div>
                    
                    {/* Payment Options - Only show if editing AND fee > 0 */}
                    {isEditingSeasonMode && editSeasonData && editSeasonData.registrationFee > 0 && (
                      <div className={`mt-4 pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                        <label className={`block text-xs mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                          Payment Options (select at least one) <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-2">
                          {[
                            { key: 'payInFull', label: 'Pay in Full', desc: 'Full payment at registration' },
                            { key: 'payAsYouGo', label: 'Pay as You Go', desc: 'Payment plan / installments' },
                            { key: 'payInCash', label: 'Pay in Cash', desc: 'Pay at the field in person' }
                          ].map(({ key, label, desc }) => (
                            <label key={key} className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                              (editSeasonData.paymentOptions as any)[key]
                                ? theme === 'dark' ? 'bg-purple-600/20 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'
                                : theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'
                            }`}>
                              <div>
                                <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{label}</p>
                                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{desc}</p>
                              </div>
                              <input
                                type="checkbox"
                                checked={(editSeasonData.paymentOptions as any)[key]}
                                onChange={(e) => setEditSeasonData(prev => prev ? {
                                  ...prev, 
                                  paymentOptions: { ...prev.paymentOptions, [key]: e.target.checked }
                                } : null)}
                                className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              />
                            </label>
                          ))}
                        </div>
                        {/* Warning if no option selected */}
                        {!editSeasonData.paymentOptions.payInFull && !editSeasonData.paymentOptions.payAsYouGo && !editSeasonData.paymentOptions.payInCash && (
                          <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                            <span>⚠️</span> Select at least one payment option
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Required Fields Settings - Only show in edit mode AND when registration is still open */}
                  {isEditingSeasonMode && editSeasonData && (selectedSeasonForEdit.status === 'setup' || selectedSeasonForEdit.status === 'registration_open') && (
                    <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                      <h4 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Registration Requirements</h4>
                      <div className="space-y-3">
                        {[
                          { key: 'requireWaiver', label: 'Waiver & Liability Release', desc: 'Require parents to accept waiver' },
                          { key: 'requireMedicalInfo', label: 'Medical Information', desc: 'Collect allergies, conditions, medications' },
                          { key: 'requireEmergencyContact', label: 'Emergency Contact', desc: 'Require emergency contact info' },
                          { key: 'requireUniformSizes', label: 'Uniform Sizes', desc: 'Collect jersey and shorts sizes' },
                        ].map(({ key, label, desc }) => (
                          <label key={key} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                            theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-white hover:bg-gray-50 border border-gray-200'
                          }`}>
                            <div>
                              <p className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{label}</p>
                              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{desc}</p>
                            </div>
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={(editSeasonData as any)[key]}
                                onChange={(e) => setEditSeasonData(prev => prev ? {...prev, [key]: e.target.checked} : null)}
                                className="sr-only peer"
                              />
                              <div className={`w-11 h-6 rounded-full peer-focus:ring-2 peer-focus:ring-purple-500/50 transition-colors ${
                                (editSeasonData as any)[key] 
                                  ? 'bg-purple-600' 
                                  : theme === 'dark' ? 'bg-white/20' : 'bg-gray-300'
                              }`}></div>
                              <div className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                (editSeasonData as any)[key] ? 'translate-x-5' : 'translate-x-0'
                              }`}></div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Age Groups & Teams */}
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Age Groups & Teams</h4>
                      {(selectedSeasonForEdit.status === 'active' || selectedSeasonForEdit.status === 'completed') && (
                        <span className={`text-xs px-2 py-0.5 rounded ${theme === 'dark' ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                          🔒 Draft ended
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      {selectedSeasonForEdit.sportsOffered?.map((sportConfig) => (
                        <div key={sportConfig.sport}>
                          {selectedSeasonForEdit.sportsOffered && selectedSeasonForEdit.sportsOffered.length > 1 && (
                            <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
                              {sportConfig.sport}
                            </p>
                          )}
                          <div className="space-y-2">
                            {sportConfig.ageGroups?.map((ageGroup) => {
                              const teamsForAge = teams.filter(t => 
                                t.ageGroup === ageGroup.label || 
                                t.ageGroups?.some(ag => ageGroup.ageGroups.includes(ag))
                              );
                              return (
                                <div key={ageGroup.id} className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
                                  <div className="flex items-center justify-between">
                                    <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                      {ageGroup.label}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${teamsForAge.length > 0 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                        {teamsForAge.length} team{teamsForAge.length !== 1 ? 's' : ''}
                                      </span>
                                      {selectedSeasonForEdit.status !== 'active' && selectedSeasonForEdit.status !== 'completed' && (
                                        <button
                                          onClick={() => {
                                            // Set up to add team for this age group
                                            setNewTeamAgeGroup(ageGroup.label);
                                            setNewTeamName('');
                                            setShowAddTeamToAgeGroup(true);
                                          }}
                                          className="text-xs px-2 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1"
                                        >
                                          <Plus className="w-3 h-3" /> Add
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {teamsForAge.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {teamsForAge.map(team => (
                                        <span key={team.id} className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-white/10 text-slate-300' : 'bg-gray-100 text-gray-700'}`}>
                                          {team.name}
                                          {selectedSeasonForEdit.status !== 'active' && selectedSeasonForEdit.status !== 'completed' && (
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                if (!confirm(`Remove "${team.name}" from ${ageGroup.label}?`)) return;
                                                try {
                                                  // Clear the age group from the team
                                                  await updateDoc(doc(db, 'teams', team.id!), {
                                                    ageGroup: null,
                                                    ageGroups: [],
                                                    seasonId: null,
                                                    updatedAt: serverTimestamp()
                                                  });
                                                  // Update local state
                                                  setTeams(prev => prev.map(t => 
                                                    t.id === team.id 
                                                      ? { ...t, ageGroup: undefined, ageGroups: [] }
                                                      : t
                                                  ));
                                                  toastSuccess(`${team.name} removed from ${ageGroup.label}`);
                                                } catch (err) {
                                                  console.error('Error removing team:', err);
                                                  toastError('Failed to remove team');
                                                }
                                              }}
                                              className={`ml-0.5 p-0.5 rounded-full hover:bg-red-500/20 ${theme === 'dark' ? 'text-slate-400 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {(!selectedSeasonForEdit.sportsOffered || selectedSeasonForEdit.sportsOffered.length === 0) && (
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                          No age groups configured
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Add Team to Age Group Mini Modal */}
                  {showAddTeamToAgeGroup && (
                    <div className={`p-4 rounded-lg border-2 ${theme === 'dark' ? 'bg-purple-900/20 border-purple-500/30' : 'bg-purple-50 border-purple-200'}`}>
                      <h4 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        Add Team to {newTeamAgeGroup}
                      </h4>
                      
                      {/* Input with autocomplete */}
                      <div className="relative mb-3">
                        <input
                          type="text"
                          value={newTeamName}
                          onChange={(e) => {
                            setNewTeamName(e.target.value);
                            setShowTeamSuggestions(true);
                          }}
                          onFocus={() => setShowTeamSuggestions(true)}
                          placeholder="Team name (e.g., Tigers Blue)"
                          className={`w-full px-3 py-2.5 rounded-lg text-sm ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white placeholder-slate-400' : 'bg-white border-gray-300 text-gray-900'} border focus:ring-2 focus:ring-purple-500/50`}
                        />
                        
                        {/* Autocomplete suggestions */}
                        {showTeamSuggestions && teamSuggestions.length > 0 && (
                          <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto ${theme === 'dark' ? 'bg-zinc-800 border border-white/20' : 'bg-white border border-gray-200'}`}>
                            <p className={`px-3 py-1.5 text-xs font-medium ${theme === 'dark' ? 'text-slate-400 bg-zinc-900/50' : 'text-gray-500 bg-gray-50'}`}>
                              Existing teams - click to assign
                            </p>
                            {teamSuggestions.map(team => (
                              <button
                                key={team.id}
                                onClick={async () => {
                                  // Assign existing team to this age group
                                  try {
                                    await updateDoc(doc(db, 'teams', team.id!), {
                                      ageGroup: newTeamAgeGroup,
                                      ageGroups: [newTeamAgeGroup],
                                      seasonId: selectedSeasonForEdit?.id,
                                      updatedAt: serverTimestamp()
                                    });
                                    // Update local state
                                    setTeams(prev => prev.map(t => 
                                      t.id === team.id 
                                        ? { ...t, ageGroup: newTeamAgeGroup, ageGroups: [newTeamAgeGroup] }
                                        : t
                                    ));
                                    toastSuccess(`${team.name} assigned to ${newTeamAgeGroup}!`);
                                    setShowAddTeamToAgeGroup(false);
                                    setNewTeamName('');
                                    setNewTeamAgeGroup('');
                                    setShowTeamSuggestions(false);
                                  } catch (err) {
                                    console.error('Error assigning team:', err);
                                    toastError('Failed to assign team');
                                  }
                                }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-purple-500/20 flex items-center justify-between ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                              >
                                <span>{team.name}</span>
                                {team.ageGroup && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-white/10 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>
                                    {team.ageGroup}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Action buttons - stack on mobile */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={async () => {
                            if (!newTeamName.trim() || !programData?.id) return;
                            try {
                              // Create team in Firestore
                              const teamRef = await addDoc(collection(db, 'teams'), {
                                name: newTeamName.trim(),
                                programId: programData.id,
                                seasonId: selectedSeasonForEdit?.id,
                                ageGroup: newTeamAgeGroup,
                                ageGroups: [newTeamAgeGroup],
                                sport: programData.sport || 'football',
                                ownerId: user?.uid,
                                status: 'active',
                                createdAt: serverTimestamp(),
                                updatedAt: serverTimestamp()
                              });
                              
                              // Add to local state for immediate UI update
                              setTeams(prev => [...prev, {
                                id: teamRef.id,
                                name: newTeamName.trim(),
                                programId: programData.id,
                                seasonId: selectedSeasonForEdit?.id,
                                ageGroup: newTeamAgeGroup,
                                ageGroups: [newTeamAgeGroup],
                                sport: programData.sport || 'football',
                                ownerId: user?.uid,
                                coachId: null,
                                status: 'active'
                              } as Team]);
                              
                              toastSuccess(`Team "${newTeamName}" created!`);
                              setShowAddTeamToAgeGroup(false);
                              setNewTeamName('');
                              setNewTeamAgeGroup('');
                              setShowTeamSuggestions(false);
                            } catch (err) {
                              console.error('Error creating team:', err);
                              toastError('Failed to create team');
                            }
                          }}
                          disabled={!newTeamName.trim()}
                          className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg text-sm font-medium"
                        >
                          + Create New Team
                        </button>
                        <button
                          onClick={() => {
                            setShowAddTeamToAgeGroup(false);
                            setNewTeamName('');
                            setNewTeamAgeGroup('');
                            setShowTeamSuggestions(false);
                          }}
                          className={`py-2.5 px-4 rounded-lg text-sm font-medium ${theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {isEditingSeasonMode ? (
                      <>
                        <button
                          onClick={() => {
                            setIsEditingSeasonMode(false);
                            setEditSeasonData(null);
                          }}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium ${theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (!editSeasonData || !selectedSeasonForEdit) return;
                            
                            // Validate: all age groups must have at least 1 team
                            const ageGroupsWithoutTeams: string[] = [];
                            selectedSeasonForEdit.sportsOffered?.forEach((sportConfig: any) => {
                              sportConfig.ageGroups?.forEach((ageGroup: any) => {
                                const teamsForAge = teams.filter(t => 
                                  t.ageGroup === ageGroup.label || 
                                  t.ageGroups?.some((ag: string) => ageGroup.ageGroups.includes(ag))
                                );
                                if (teamsForAge.length === 0) {
                                  ageGroupsWithoutTeams.push(ageGroup.label);
                                }
                              });
                            });
                            
                            if (ageGroupsWithoutTeams.length > 0) {
                              toastError(`Each age group needs at least 1 team. Missing: ${ageGroupsWithoutTeams.join(', ')}`);
                              return;
                            }
                            
                            // Validate: if fee > 0, require at least one payment option
                            if (editSeasonData.registrationFee > 0) {
                              const hasPaymentOption = editSeasonData.paymentOptions.payInFull || 
                                                       editSeasonData.paymentOptions.payAsYouGo || 
                                                       editSeasonData.paymentOptions.payInCash;
                              if (!hasPaymentOption) {
                                toastError('Please select at least one payment option');
                                return;
                              }
                            }
                            
                            setSavingSeasonEdit(true);
                            try {
                              const programId = programData?.id;
                              if (!programId) throw new Error('No program ID');
                              
                              await updateDoc(doc(db, 'programs', programId, 'seasons', selectedSeasonForEdit.id), {
                                name: editSeasonData.name,
                                seasonStartDate: editSeasonData.seasonStartDate,
                                seasonEndDate: editSeasonData.seasonEndDate,
                                registrationOpenDate: editSeasonData.registrationOpenDate,
                                registrationCloseDate: editSeasonData.registrationCloseDate,
                                registrationFee: editSeasonData.registrationFee,
                                // Required fields
                                requireWaiver: editSeasonData.requireWaiver,
                                requireMedicalInfo: editSeasonData.requireMedicalInfo,
                                requireEmergencyContact: editSeasonData.requireEmergencyContact,
                                requireUniformSizes: editSeasonData.requireUniformSizes,
                                // Payment options (only if fee > 0)
                                ...(editSeasonData.registrationFee > 0 && { paymentOptions: editSeasonData.paymentOptions }),
                                updatedAt: serverTimestamp()
                              });
                              
                              // Update local state
                              setSelectedSeasonForEdit({
                                ...selectedSeasonForEdit,
                                ...editSeasonData
                              });
                              setIsEditingSeasonMode(false);
                              setEditSeasonData(null);
                              toastSuccess('Season updated successfully!');
                            } catch (error) {
                              console.error('Error updating season:', error);
                              toastError('Failed to update season');
                            } finally {
                              setSavingSeasonEdit(false);
                            }
                          }}
                          disabled={savingSeasonEdit}
                          className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                        >
                          {savingSeasonEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Save Changes
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setSelectedSeasonForEdit(null)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium ${theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          ← Back
                        </button>
                        {/* Only show edit button for non-completed seasons */}
                        {selectedSeasonForEdit.status !== 'completed' && getSeasonStatus(selectedSeasonForEdit).label !== 'Completed' ? (
                          <button
                            onClick={() => {
                              setIsEditingSeasonMode(true);
                              const seasonPaymentOptions = (selectedSeasonForEdit as any).paymentOptions || {};
                              setEditSeasonData({
                                name: selectedSeasonForEdit.name,
                                seasonStartDate: selectedSeasonForEdit.seasonStartDate || '',
                                seasonEndDate: selectedSeasonForEdit.seasonEndDate || '',
                                registrationOpenDate: selectedSeasonForEdit.registrationOpenDate,
                                registrationCloseDate: selectedSeasonForEdit.registrationCloseDate,
                                registrationFee: selectedSeasonForEdit.registrationFee || 0,
                                requireWaiver: (selectedSeasonForEdit as any).requireWaiver !== false,
                                requireMedicalInfo: (selectedSeasonForEdit as any).requireMedicalInfo === true,
                                requireEmergencyContact: (selectedSeasonForEdit as any).requireEmergencyContact !== false,
                                requireUniformSizes: (selectedSeasonForEdit as any).requireUniformSizes === true,
                                paymentOptions: {
                                  payInFull: seasonPaymentOptions.payInFull !== false,
                                  payAsYouGo: seasonPaymentOptions.payAsYouGo === true,
                                  payInCash: seasonPaymentOptions.payInCash === true
                                }
                              });
                            }}
                            className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit Season
                          </button>
                        ) : (
                          <div className={`flex-1 py-2 rounded-lg text-sm font-medium text-center ${theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                            🔒 Completed seasons cannot be edited
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Season Lifecycle Controls - Only show when not editing */}
                  {!isEditingSeasonMode && selectedSeasonForEdit && (
                    <div className={`mt-4 p-4 rounded-lg ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                      <h4 className={`font-medium mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        <Activity className="w-4 h-4 text-blue-400" />
                        Season Lifecycle
                      </h4>
                      <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                        Current Status: <span className="font-medium">{getSeasonStatus(selectedSeasonForEdit).icon} {getSeasonStatus(selectedSeasonForEdit).label}</span>
                      </p>
                      
                      <div className="flex flex-col gap-2">
                        {/* Start Season Button - Show if registration is open or closed but season hasn't started */}
                        {(selectedSeasonForEdit.status === 'registration_open' || 
                          selectedSeasonForEdit.status === 'setup' ||
                          (!selectedSeasonForEdit.status && getSeasonStatus(selectedSeasonForEdit).label !== 'In Season' && getSeasonStatus(selectedSeasonForEdit).label !== 'Completed')
                        ) && (
                          <button
                            onClick={async () => {
                              if (!programData?.id || updatingSeasonStatus) return;
                              setUpdatingSeasonStatus(true);
                              try {
                                // Close registration by setting end date to yesterday so it properly shows as ended
                                const yesterday = new Date();
                                yesterday.setDate(yesterday.getDate() - 1);
                                const yesterdayStr = yesterday.toISOString().split('T')[0];
                                await updateDoc(doc(db, 'programs', programData.id, 'seasons', selectedSeasonForEdit.id), {
                                  status: 'active',
                                  registrationCloseDate: yesterdayStr,
                                  startedAt: serverTimestamp(),
                                  updatedAt: serverTimestamp()
                                });
                                setSelectedSeasonForEdit({ ...selectedSeasonForEdit, status: 'active', registrationCloseDate: yesterdayStr });
                                toastSuccess('Season started! Registration is now closed.');
                              } catch (error) {
                                console.error('Error starting season:', error);
                                toastError('Failed to start season');
                              } finally {
                                setUpdatingSeasonStatus(false);
                              }
                            }}
                            disabled={updatingSeasonStatus}
                            className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                          >
                            {updatingSeasonStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Start Season
                          </button>
                        )}
                        
                        {/* End Season Button - Show if season is active */}
                        {(selectedSeasonForEdit.status === 'active' || getSeasonStatus(selectedSeasonForEdit).label === 'In Season') && (
                          <button
                            onClick={() => setShowEndSeasonConfirm(true)}
                            disabled={updatingSeasonStatus}
                            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                          >
                            <Square className="w-4 h-4" />
                            End Season
                          </button>
                        )}
                        
                        {/* Complete Season Info - Show if already completed */}
                        {(selectedSeasonForEdit.status === 'completed' || getSeasonStatus(selectedSeasonForEdit).label === 'Completed') && (
                          <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                            <p className={`text-sm flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>
                              <CheckCircle2 className="w-4 h-4 text-gray-400" />
                              This season has been completed
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Show all seasons list
                <div className="space-y-3">
                  {filteredSeasons.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} />
                      <p className={`font-medium mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        No Seasons Yet
                      </p>
                      <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                        Create your first season to set up registration.
                      </p>
                    </div>
                  ) : (
                    <>
                      {filteredSeasons.map(season => {
                        const statusInfo = getSeasonStatus(season);
                        const isCompleted = season.status === 'completed' || statusInfo.label === 'Completed';
                        return (
                          <button
                            key={season.id}
                            onClick={() => setSelectedSeasonForEdit(season)}
                            className={`w-full p-4 rounded-lg text-left flex items-center justify-between ${
                              theme === 'dark' 
                                ? 'bg-white/5 hover:bg-white/10 border border-white/10' 
                                : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                            }`}
                          >
                            <div>
                              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {season.name}
                              </p>
                              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                                {statusInfo.icon} {statusInfo.label}
                                {season.seasonStartDate && season.seasonEndDate && (
                                  <span className="ml-2">
                                    • {new Date(season.seasonStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(season.seasonEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </p>
                            </div>
                            {isCompleted ? (
                              <span className={`text-xs px-2 py-1 rounded ${theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>🔒 View Only</span>
                            ) : (
                              <Edit2 className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                            )}
                          </button>
                        );
                      })}
                      {/* Show Create New Season button if all seasons are completed */}
                      {filteredSeasons.every(s => s.status === 'completed' || getSeasonStatus(s).label === 'Completed') && (
                        <button
                          onClick={() => {
                            const { canCreate, missingAgeGroups, missingTeams } = canCreateSeason();
                            if (!canCreate) {
                              const sportName = selectedSport?.charAt(0).toUpperCase() + selectedSport?.slice(1).toLowerCase();
                              if (missingAgeGroups && missingTeams) {
                                toastError(`Configure age groups and teams for ${sportName} first`);
                              } else if (missingAgeGroups) {
                                toastError(`Configure age groups for ${sportName} first`);
                              } else if (missingTeams) {
                                toastError(`Create at least one team for ${sportName} first`);
                              }
                              return;
                            }
                            setShowSeasonManageModal(false);
                            setShowSeasonModal(true);
                          }}
                          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 mt-4"
                        >
                          <Plus className="w-4 h-4" />
                          Create New Season
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Season Creation Modal */}
      {showSeasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-2xl max-h-[90vh] rounded-xl shadow-xl overflow-hidden ${theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}`}>
            <div className="max-h-[90vh] overflow-y-auto">
              <CommissionerSeasonSetup
                programId={programData?.id}
                selectedSport={selectedSport}
                onComplete={(seasonId) => {
                  setShowSeasonModal(false);
                  toastSuccess('Season created successfully!');
                }}
                onCancel={() => setShowSeasonModal(false)}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Draft Pool Modal */}
      {showDraftPoolModal && selectedPoolSeason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-2xl max-h-[85vh] rounded-xl shadow-xl overflow-hidden ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Draft Pool - {selectedPoolSeason.name}
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                    {selectedPoolSeason.totalRegistrations || 0} total registrations
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowDraftPoolModal(false); setSelectedPoolSeason(null); setDraftPoolPlayers([]); setDraftPoolSortBy('all'); }}
                className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Filter by Age Group */}
            <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setDraftPoolSortBy('all')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    draftPoolSortBy === 'all'
                      ? 'bg-purple-600 text-white'
                      : theme === 'dark' ? 'bg-white/10 text-slate-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {selectedPoolSeason.sportsOffered?.flatMap(s => s.ageGroups || []).map(ag => (
                  <button
                    key={ag.id}
                    onClick={() => setDraftPoolSortBy(ag.label)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      draftPoolSortBy === ag.label
                        ? 'bg-purple-600 text-white'
                        : theme === 'dark' ? 'bg-white/10 text-slate-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {ag.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Player List */}
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              {loadingPoolPlayers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
              ) : draftPoolPlayers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-purple-400/50' : 'text-purple-300'}`} />
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>No Players Registered</p>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                    Players will appear here once parents register.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {draftPoolPlayers
                    .filter(p => draftPoolSortBy === 'all' || p.ageGroup === draftPoolSortBy)
                    .map((player, idx) => (
                      <div 
                        key={player.id || idx}
                        className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                              {(player.athleteFirstName || player.firstName)?.[0]}{(player.athleteLastName || player.lastName)?.[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Player Name */}
                              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {player.athleteFirstName || player.firstName} {player.athleteLastName || player.lastName}
                                {player.athleteNickname && (
                                  <span className={`ml-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                                    "{player.athleteNickname}"
                                  </span>
                                )}
                              </p>
                              
                              {/* Username - clickable */}
                              {player.athleteUsername ? (
                                <button
                                  onClick={() => navigate(`/profile/${player.athleteUsername}`)}
                                  className="text-xs text-purple-500 hover:text-purple-400 hover:underline block"
                                >
                                  @{player.athleteUsername}
                                </button>
                              ) : (
                                <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
                                  No username linked
                                </span>
                              )}
                              
                              {/* Jersey & Position */}
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                {player.preferredJerseyNumber && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                                    #{player.preferredJerseyNumber}
                                    {player.alternateJerseyNumbers?.length > 0 && (
                                      <span className="opacity-60"> (alt: {player.alternateJerseyNumbers.join(', ')})</span>
                                    )}
                                  </span>
                                )}
                                {player.preferredPosition && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                                    {player.preferredPosition}
                                  </span>
                                )}
                              </div>
                              
                              {/* Coach Notes / Suggestions */}
                              {player.coachNotes ? (
                                <div className={`text-xs mt-1.5 p-2 rounded ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                                  <span className={`font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Notes: </span>
                                  <span className={`italic ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>
                                    "{player.coachNotes}"
                                  </span>
                                </div>
                              ) : (
                                <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
                                  No notes provided
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${theme === 'dark' ? 'bg-white/10 text-slate-300' : 'bg-gray-200 text-gray-700'}`}>
                            {player.ageGroup || 'No Age Group'}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Draft to Team Modal */}
      {showDraftToTeamModal && playerToDraft && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className={`px-4 py-3 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <div>
                <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Draft Player to Team</h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {playerToDraft.athleteFirstName} {playerToDraft.athleteLastName} • {playerToDraft.ageGroup}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDraftToTeamModal(false);
                  setPlayerToDraft(null);
                }}
                className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {teams.length === 0 ? (
                <div className="text-center py-8">
                  <Users className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>No Teams Available</p>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Create teams first before drafting players.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {teams
                    .filter(t => t.sport?.toLowerCase() === selectedSport?.toLowerCase())
                    .filter(t => t.ageGroup?.toLowerCase() === playerToDraft.ageGroup?.toLowerCase())
                    .map((team) => (
                      <button
                        key={team.id}
                        onClick={() => handleDraftPlayer(playerToDraft, team.id, team.teamName || team.name || 'Unknown Team')}
                        disabled={draftingPlayerId === playerToDraft.id}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                          theme === 'dark' 
                            ? 'bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-green-500/50' 
                            : 'bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
                          {(team.teamName || team.name)?.charAt(0) || 'T'}
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {team.teamName || team.name}
                          </p>
                          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            {team.ageGroup || 'No age group'} • {(team.players || []).length} players
                          </p>
                        </div>
                        <ChevronRight className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                      </button>
                    ))}
                  {teams
                    .filter(t => t.sport?.toLowerCase() === selectedSport?.toLowerCase())
                    .filter(t => t.ageGroup?.toLowerCase() === playerToDraft.ageGroup?.toLowerCase())
                    .length === 0 && (
                    <div className="text-center py-8">
                      <Users className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>No Matching Teams</p>
                      <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        No teams found for age group "{playerToDraft.ageGroup}". Create a team with this age group first.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Rules Modal */}
      <RulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        leagueId={leagueData?.id}
        canEdit={true}
        type="rules"
      />
      
      {/* Code of Conduct Modal */}
      <RulesModal
        isOpen={showConductModal}
        onClose={() => setShowConductModal(false)}
        leagueId={leagueData?.id}
        canEdit={true}
        type="codeOfConduct"
      />
    </div>
  );
};

export default CommissionerDashboard;
