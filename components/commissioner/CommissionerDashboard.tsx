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
import type { Team, Grievance, Program, UserProfile } from '../../types';
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
  Trash2
} from 'lucide-react';
import { RulesModal } from '../RulesModal';
import { AgeGroupSelector } from '../AgeGroupSelector';

export const CommissionerDashboard: React.FC = () => {
  const { user, userData, programData, leagueData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagues, setLeagues] = useState<Array<{ id: string; name: string; sport?: string; teamIds?: string[] }>>();
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [coachRequests, setCoachRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [editMaxRosterSize, setEditMaxRosterSize] = useState(25);
  const [availableCheerTeams, setAvailableCheerTeams] = useState<Team[]>([]);
  const [editError, setEditError] = useState('');
  const [editing, setEditing] = useState(false);
  
  // Delete team confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Get commissioner type from userData
  // Check role first (TeamCommissioner/LeagueCommissioner), then fall back to commissionerType field
  const isTeamCommissioner = userData?.role === 'TeamCommissioner' || 
                              (userData?.commissionerType === 'team') ||
                              (!userData?.commissionerType && !['LeagueCommissioner', 'LeagueOwner'].includes(userData?.role || ''));
  const isLeagueCommissioner = userData?.role === 'LeagueCommissioner' || 
                                userData?.role === 'LeagueOwner' ||
                                userData?.commissionerType === 'league';

  useEffect(() => {
    if (!userData) {
      setLoading(false);
      return;
    }

    const loadDashboardData = async () => {
      try {
        if (isTeamCommissioner) {
          // Load teams owned by this commissioner
          const teamsQuery = query(
            collection(db, 'teams'),
            where('ownerId', '==', user?.uid)
          );
          const teamsSnap = await getDocs(teamsQuery);
          const teamsData = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
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
        } else {
          // League commissioner - load leagues owned by this commissioner
          const leaguesQuery = query(
            collection(db, 'leagues'),
            where('ownerId', '==', user?.uid)
          );
          const leaguesSnap = await getDocs(leaguesQuery);
          const leaguesData = leaguesSnap.docs.map(doc => {
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
        }
        
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [userData, user?.uid, isTeamCommissioner]);

  const handleCreate = async () => {
    if (!createName.trim()) {
      setCreateError('Name is required');
      return;
    }
    
    // Validate city/state
    if (!createCity.trim()) {
      setCreateError('City is required');
      return;
    }
    if (!createState.trim()) {
      setCreateError('State is required');
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
        
        // Team data
        const teamData = {
          name: createName.trim(),
          sport: createSport,
          ageGroup: primaryAgeGroup,
          ageGroups: ageGroupsArray,
          ageGroupType: createAgeGroupType,
          city: createCity,
          state: createState,
          ownerId: user?.uid,
          ownerName: userData?.name,
          color: '#f97316',
          createdAt: serverTimestamp(),
        };
        
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
          sport: createSport as any,
          coachId: null,
          location: { city: createCity, state: createState },
        } as Team]);
        
        setStats(prev => ({ ...prev, totalTeams: prev.totalTeams + 1 }));
      } else {
        // Create a new league
        const leagueRef = await addDoc(collection(db, 'leagues'), {
          name: createName.trim(),
          sport: createSport,
          city: createCity,
          state: createState,
          ownerId: user?.uid,
          ownerName: userData?.name,
          teamIds: [],
          status: 'active',
          createdAt: serverTimestamp(),
        });
        
        setLeagues(prev => [...prev, { 
          id: leagueRef.id, 
          name: createName.trim(),
          sport: createSport,
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

  // Save edited team
  const handleSaveEdit = async () => {
    if (!editingTeam) return;
    
    if (!editName.trim()) {
      setEditError('Team name is required');
      return;
    }
    if (!editCity.trim()) {
      setEditError('City is required');
      return;
    }
    if (!editState.trim()) {
      setEditError('State is required');
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
      
      const updateData: Record<string, any> = {
        name: editName.trim(),
        sport: editSport,
        ageGroup: primaryAgeGroup,
        ageGroups: ageGroupsArray,
        ageGroupType: editAgeGroupType,
        city: editCity.trim(),
        state: editState.trim(),
        location: { city: editCity.trim(), state: editState.trim() },
        color: editPrimaryColor,
        primaryColor: editPrimaryColor,
        secondaryColor: editSecondaryColor,
        isCheerTeam: editIsCheerTeam,
        maxRosterSize: editMaxRosterSize,
        updatedAt: serverTimestamp(),
      };
      
      // Only update linkedCheerTeamId for non-cheer teams
      if (!editIsCheerTeam) {
        updateData.linkedCheerTeamId = editLinkedCheerTeamId || null;
      }
      
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
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">
                    {isLeagueCommissioner ? 'League Commissioner' : 'Team Commissioner'}
                  </h1>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white border border-white/30`}>
                    {isLeagueCommissioner ? '🏆 League' : '🏈 Team'}
                  </span>
                </div>
                <p className="text-white/80 text-sm">
                  {userData?.name} • {isLeagueCommissioner ? 'Manage leagues and tournaments' : 'Manage teams and rosters'}
                </p>
              </div>
            </div>
            <Link
              to="/profile"
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5 text-white" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        
        {/* Hero Alert: No Teams Yet */}
        {isTeamCommissioner && teams.length === 0 && (
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
                  You're ready to build your program. Let's create your first team!
                </p>
                <p className="text-white/70 text-sm">
                  Set up your team with name, sport, age group, and colors. Then add coaches and players.
                </p>
              </div>
              
              <div className="flex-shrink-0">
                <button
                  onClick={() => navigate('/commissioner/teams/create')}
                  className="px-6 py-3 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Team
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
              <div className={`rounded-xl p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-orange-400" />
                  </div>
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Teams</span>
                </div>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stats.totalTeams}</p>
              </div>
              
              <div className={`rounded-xl p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5 text-green-400" />
                  </div>
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Players</span>
                </div>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stats.totalPlayers}</p>
              </div>
            </>
          )}
          
          <div className={`rounded-xl p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-400" />
              </div>
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Players</span>
            </div>
            <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stats.totalPlayers}</p>
          </div>
          
          <div className={`rounded-xl p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Grievances</span>
            </div>
            <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stats.activeGrievances}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => isLeagueCommissioner ? setShowCreateModal(true) : navigate('/commissioner/teams/create')}
            className={`rounded-xl p-4 flex flex-col items-center gap-2 transition-all group ${
              theme === 'dark' 
                ? `bg-gray-800 hover:bg-gray-750 border border-gray-700 ${isLeagueCommissioner ? 'hover:border-purple-500/50' : 'hover:border-orange-500/50'}`
                : `bg-white hover:bg-slate-50 border border-slate-200 ${isLeagueCommissioner ? 'hover:border-purple-400' : 'hover:border-orange-400'}`
            }`}
          >
            <div className={`w-12 h-12 ${isLeagueCommissioner ? 'bg-purple-500/20 group-hover:bg-purple-500/30' : 'bg-orange-500/20 group-hover:bg-orange-500/30'} rounded-xl flex items-center justify-center transition-colors`}>
              <Plus className={`w-6 h-6 ${isLeagueCommissioner ? 'text-purple-400' : 'text-orange-400'}`} />
            </div>
            <span className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {isLeagueCommissioner ? 'Create League' : 'Create Team'}
            </span>
          </button>
          
          <Link
            to={isLeagueCommissioner ? "/commissioner/leagues" : "/commissioner/teams"}
            className={`rounded-xl p-4 flex flex-col items-center gap-2 transition-all group ${
              theme === 'dark' 
                ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500/50'
                : 'bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-400'
            }`}
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              {isLeagueCommissioner ? (
                <Layers className="w-6 h-6 text-blue-400" />
              ) : (
                <Users className="w-6 h-6 text-blue-400" />
              )}
            </div>
            <span className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {isLeagueCommissioner ? 'Manage Leagues' : 'Manage Teams'}
            </span>
          </Link>
          
          <Link
            to="/commissioner/grievances"
            className={`rounded-xl p-4 flex flex-col items-center gap-2 transition-all group relative ${
              theme === 'dark' 
                ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-yellow-500/50'
                : 'bg-white hover:bg-slate-50 border border-slate-200 hover:border-yellow-400'
            }`}
          >
            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center group-hover:bg-yellow-500/30 transition-colors">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            </div>
            <span className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Grievances</span>
            {pendingGrievances.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {pendingGrievances.length}
              </span>
            )}
          </Link>
          
          <Link
            to="/commissioner/schedule"
            className={`rounded-xl p-4 flex flex-col items-center gap-2 transition-all group ${
              theme === 'dark' 
                ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-green-500/50'
                : 'bg-white hover:bg-slate-50 border border-slate-200 hover:border-green-400'
            }`}
          >
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
              <Calendar className="w-6 h-6 text-green-400" />
            </div>
            <span className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Schedule</span>
          </Link>
        </div>

        {/* Teams or Leagues List */}
        <div className={`rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'}`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
            <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {isLeagueCommissioner ? 'Your Leagues' : 'Your Teams'}
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
            // Team Commissioner - show teams
            teams.length === 0 ? (
              <div className="p-8 text-center">
                <Users className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-slate-400'}`} />
                <p className={`mb-2 font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>🎉 Create your first team for FREE!</p>
                <p className={`mb-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>Get started by creating your first team - it's on us.</p>
                <button
                  onClick={() => navigate('/commissioner/teams/create')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create First Team Free
                </button>
              </div>
            ) : (
              <div className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-slate-200'}`}>
                {teams.slice(0, 5).map((team) => (
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
        </div>

        {/* Getting Started Tips */}
        {((isLeagueCommissioner && leagues.length === 0) || (isTeamCommissioner && teams.length === 0)) && (
          <div className={`${isLeagueCommissioner ? 'bg-purple-500/10 border-purple-500/20' : 'bg-orange-500/10 border-orange-500/20'} border rounded-xl p-6`}>
            <h3 className={`font-bold ${isLeagueCommissioner ? 'text-purple-300' : 'text-orange-300'} mb-4 flex items-center gap-2`}>
              <Target className="w-5 h-5" />
              Getting Started
            </h3>
            <div className="space-y-3">
              {isLeagueCommissioner ? (
                <>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-300 text-sm font-bold">1</span>
                    <div>
                      <p className="text-white font-medium">Create Your First League</p>
                      <p className="text-sm text-gray-400">Set up your league with name, sport, and location</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-300 text-sm font-bold">2</span>
                    <div>
                      <p className="text-white font-medium">Invite Teams to Join</p>
                      <p className="text-sm text-gray-400">Share your league code so team commissioners can register</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-300 text-sm font-bold">3</span>
                    <div>
                      <p className="text-white font-medium">Create Schedules & Manage Games</p>
                      <p className="text-sm text-gray-400">Build season schedules and assign referees</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-300 text-sm font-bold">1</span>
                    <div>
                      <p className="text-white font-medium">Create Your First Team</p>
                      <p className="text-sm text-gray-400">Set up your team with name, sport, and colors</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-300 text-sm font-bold">2</span>
                    <div>
                      <p className="text-white font-medium">Add Players & Coaches</p>
                      <p className="text-sm text-gray-400">Build your roster and assign coaching staff</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-300 text-sm font-bold">3</span>
                    <div>
                      <p className="text-white font-medium">Join a League (Optional)</p>
                      <p className="text-sm text-gray-400">Connect with a league to participate in organized play</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-gray-700 my-8 flex flex-col max-h-[calc(100vh-4rem)]">
            <div className={`p-4 border-b border-gray-700 flex-shrink-0 ${isLeagueCommissioner ? 'bg-purple-900/20' : 'bg-orange-900/20'} rounded-t-2xl`}>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {isLeagueCommissioner ? (
                  <>
                    <Crown className="w-5 h-5 text-purple-400" />
                    Create New League
                  </>
                ) : (
                  <>
                    <Trophy className="w-5 h-5 text-orange-400" />
                    Create New Team
                  </>
                )}
              </h3>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {createError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                  {createError}
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">
                  {isLeagueCommissioner ? 'League Name' : 'Team Name'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={isLeagueCommissioner ? "Atlanta Youth Football League" : "Eastside Eagles"}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2.5 px-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              {/* Custom Team ID */}
              {isTeamCommissioner && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">
                    Team ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={createTeamId}
                    onChange={(e) => setCreateTeamId(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                    placeholder="eastside-eagles-9u"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2.5 px-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    URL-friendly ID for your team. Only lowercase letters, numbers, and dashes.
                  </p>
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">Sport</label>
                <select
                  value={createSport}
                  onChange={(e) => setCreateSport(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="Football">🏈 Football</option>
                  <option value="Basketball">🏀 Basketball</option>
                  <option value="Baseball">⚾ Baseball</option>
                  <option value="Soccer">⚽ Soccer</option>
                  <option value="Cheerleading">📣 Cheerleading</option>
                  <option value="Volleyball">🏐 Volleyball</option>
                </select>
              </div>
              
              {/* Age Group Selection (Teams only) */}
              {isTeamCommissioner && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Age Group *</label>
                  <AgeGroupSelector
                    value={createAgeGroup}
                    onChange={(value, type) => {
                      setCreateAgeGroup(value);
                      setCreateAgeGroupType(type);
                    }}
                    mode="auto"
                    required
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">City <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={createCity}
                    onChange={(e) => setCreateCity(e.target.value)}
                    placeholder="Atlanta"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2.5 px-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">State <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={createState}
                    onChange={(e) => setCreateState(e.target.value)}
                    placeholder="GA"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2.5 px-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-700 flex gap-3 flex-shrink-0 rounded-b-2xl">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !createName.trim() || !createCity.trim() || !createState.trim() || !createTeamId.trim()}
                className={`flex-1 py-2.5 ${
                  isLeagueCommissioner 
                    ? 'bg-purple-600 hover:bg-purple-700' 
                    : 'bg-orange-600 hover:bg-orange-700'
                } text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                {creating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create
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
                <AgeGroupSelector
                  value={editAgeGroup}
                  onChange={(val, type) => {
                    setEditAgeGroup(val);
                    setEditAgeGroupType(type);
                  }}
                  mode={editAgeGroupType}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                    City <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    placeholder="City"
                    className={`w-full border rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                    State <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    placeholder="GA"
                    className={`w-full border rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
                  />
                </div>
              </div>
              
              {/* Sport Selection */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>Sport</label>
                <select
                  value={editSport}
                  onChange={(e) => setEditSport(e.target.value)}
                  className={`w-full border rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                >
                  <option value="Football">🏈 Football</option>
                  <option value="Basketball">🏀 Basketball</option>
                  <option value="Baseball">⚾ Baseball</option>
                  <option value="Soccer">⚽ Soccer</option>
                  <option value="Cheerleading">📣 Cheerleading</option>
                  <option value="Volleyball">🏐 Volleyball</option>
                </select>
              </div>
              
              {/* Colors */}
              <div className="space-y-3">
                <TeamColorPicker
                  label="Primary Color:"
                  value={editPrimaryColor}
                  onChange={setEditPrimaryColor}
                  showHexInput={false}
                />
                <TeamColorPicker
                  label="Secondary Color:"
                  value={editSecondaryColor}
                  onChange={setEditSecondaryColor}
                  showHexInput={false}
                />
                <TeamColorPreview
                  primaryColor={editPrimaryColor}
                  secondaryColor={editSecondaryColor}
                  teamName={editName}
                />
              </div>
              
              {/* Max Roster Size */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>Max Roster Size</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={editMaxRosterSize}
                  onChange={(e) => setEditMaxRosterSize(parseInt(e.target.value) || 25)}
                  className={`w-full border rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                />
              </div>
              
              {/* Cheer Team Toggle */}
              <div className="flex items-center justify-between">
                <label className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                  📣 This is a Cheer Team
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsCheerTeam}
                    onChange={(e) => setEditIsCheerTeam(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              {/* Linked Cheer Team (only show for non-cheer teams) */}
              {!editIsCheerTeam && availableCheerTeams.length > 0 && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                    🔗 Linked Cheer Team
                  </label>
                  <select
                    value={editLinkedCheerTeamId}
                    onChange={(e) => setEditLinkedCheerTeamId(e.target.value)}
                    className={`w-full border rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                  >
                    <option value="">No linked cheer team</option>
                    {availableCheerTeams.map((ct) => (
                      <option key={ct.id} value={ct.id}>{ct.name}</option>
                    ))}
                  </select>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-500'}`}>
                    Link a cheer team to display them together on team pages
                  </p>
                </div>
              )}
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
                disabled={editing || !editName.trim() || !editCity.trim() || !editState.trim()}
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
      
      {/* Delete Confirmation Modal */}
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
