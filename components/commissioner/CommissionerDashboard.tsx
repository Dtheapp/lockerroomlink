/**
 * Commissioner Dashboard Component
 * Main dashboard for Commissioners to manage their program/league
 * Supports both "team" commissioners (manage teams) and "league" commissioners (manage leagues)
 */

import React, { useState, useEffect } from 'react';
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
  Settings, 
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
  CheckCircle2
} from 'lucide-react';
import { RulesModal } from '../RulesModal';
import { AgeGroupSelector } from '../AgeGroupSelector';
import { StateSelector, isValidUSState } from '../StateSelector';
import { toastError } from '../../services/toast';

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
  
  // Sport selector - persisted to localStorage
  const [selectedSport, setSelectedSport] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('commissioner_selected_sport') || '';
    }
    return '';
  });
  
  // Get available sports from program
  const availableSports = programData?.sportsOffered?.map((s: any) => s.sport) 
    || programData?.sportConfigs?.map((s: any) => s.sport)
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
  
  // Filter seasons by selected sport
  const filteredSeasons = selectedSport
    ? seasons.filter(s => 
        s.sportsOffered?.some((so: any) => so.sport?.toLowerCase() === selectedSport.toLowerCase()) ||
        (s as any).sport?.toLowerCase() === selectedSport.toLowerCase()
      )
    : seasons;
  
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
  const hasProgram = !!programData || !!userData?.programId;

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
    const programId = programData?.id || userData?.programId;
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
  }, [programData?.id, userData?.programId]);

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
        if (programData?.id || userData?.programId) {
          teamData.programId = programData?.id || userData?.programId;
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
    const programIdToDelete = programData?.id || userData?.programId;
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
    
    const programId = programData?.id || userData?.programId;
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
              <Link
                to="/profile"
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5 text-white" />
              </Link>
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
                onClick={() => navigate('/commissioner/age-groups')}
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
                  {(programData as any)?.ageGroups?.length || 0}
                </p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-500'}`}>
                  Click to manage →
                </p>
              </button>
            </>
          )}
          
          {/* Seasons */}
          <button
            onClick={() => navigate(`/commissioner/season-setup/${programData?.id || userData?.programId}`)}
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
                onClick={() => navigate(`/commissioner/program-setup/${programData?.id || userData?.programId}?mode=info`)}
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

        {/* Teams or Leagues List - Only show if program exists for team commissioners */}
        {(isLeagueCommissioner || hasProgram) && (
        <div className={`rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'}`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
            <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {isLeagueCommissioner ? 'Your Leagues' : 'Season Manager'}
            </h2>
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
            // Team Commissioner - show teams list (simplified)
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
            ) : ((programData as any)?.ageGroups?.length || 0) === 0 ? (
              // No age groups yet
              <div className="p-8 text-center">
                <Layers className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-slate-400'}`} />
                <p className={`mb-2 font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>No age groups yet</p>
                <p className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                  Create age groups first, then create teams and assign age groups to each team.
                </p>
                <button
                  onClick={() => navigate('/commissioner/age-groups')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  <Layers className="w-4 h-4" />
                  Create Age Groups
                </button>
              </div>
            ) : filteredTeams.length === 0 ? (
              // Has age groups but no teams
              <div className="p-8 text-center">
                <Trophy className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-slate-400'}`} />
                <p className={`mb-2 font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>No teams yet</p>
                <p className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                  You have {(programData as any)?.ageGroups?.length || 0} age group(s). Now create teams and assign them to age groups.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Team
                </button>
              </div>
            ) : (
              <div className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-slate-200'}`}>
                {filteredTeams.slice(0, 5).map((team) => (
                  <div
                    key={team.id}
                    className={`flex items-center justify-between px-4 py-3 transition-colors ${theme === 'dark' ? 'hover:bg-gray-750' : 'hover:bg-slate-50'}`}
                  >
                    <Link to={`/team/${team.id}`} className="flex items-center gap-3 flex-1">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: '#f97316' }}
                      >
                        {team.name?.charAt(0) || 'T'}
                      </div>
                      <div>
                        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{team.name}</p>
                        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                          {team.sport || 'Football'} • {team.ageGroups?.length ? team.ageGroups.join(', ') : team.ageGroup || team.location?.city || 'All Ages'}
                        </p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleEditTeam(team, e)}
                        className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'}`}
                        title="Edit Team"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(team, e)}
                        className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'}`}
                        title="Delete Team"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Link to={`/team/${team.id}`}>
                        <ChevronRight className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
          
          {/* Age Group Coverage Indicator - Show which age groups need teams */}
          {!isLeagueCommissioner && hasProgram && ((programData as any)?.ageGroups?.length || 0) > 0 && (() => {
            const allAgeGroups: string[] = (programData as any)?.ageGroups || [];
            const coveredAgeGroups = new Set(filteredTeams.map(t => t.ageGroup || (t.ageGroups && t.ageGroups[0])).filter(Boolean));
            const uncoveredAgeGroups = allAgeGroups.filter(ag => !coveredAgeGroups.has(ag));
            const allCovered = uncoveredAgeGroups.length === 0;
            
            return (
              <div className={`px-4 py-3 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                    Age Group Coverage
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    allCovered 
                      ? 'bg-green-500/20 text-green-500' 
                      : 'bg-amber-500/20 text-amber-500'
                  }`}>
                    {allAgeGroups.length - uncoveredAgeGroups.length}/{allAgeGroups.length} covered
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {allAgeGroups.map((ag: string) => {
                    const hasCoverage = coveredAgeGroups.has(ag);
                    return (
                      <div
                        key={ag}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                          hasCoverage
                            ? theme === 'dark' 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                              : 'bg-green-50 text-green-700 border border-green-200'
                            : theme === 'dark'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {hasCoverage ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {ag}
                      </div>
                    );
                  })}
                </div>
                
                {uncoveredAgeGroups.length > 0 && (
                  <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>
                    ⚠️ Need {uncoveredAgeGroups.length} more team{uncoveredAgeGroups.length > 1 ? 's' : ''} to cover all age groups before creating a season
                  </p>
                )}
                
                {allCovered && (
                  <button
                    onClick={() => navigate(`/commissioner/season-setup/${programData?.id || userData?.programId}`)}
                    className="mt-3 w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    Create Season
                  </button>
                )}
              </div>
            );
          })()}
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
