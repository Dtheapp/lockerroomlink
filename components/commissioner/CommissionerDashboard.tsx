/**
 * Commissioner Dashboard Component
 * Main dashboard for Commissioners to manage their program/league
 * Supports both "team" commissioners (manage teams) and "league" commissioners (manage leagues)
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getTeamsByProgram, 
  getGrievancesByProgram,
  getProgram,
  updateProgram
} from '../../services/leagueService';
import { collection, query, where, getDocs, onSnapshot, doc, addDoc, serverTimestamp } from 'firebase/firestore';
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
  Layers
} from 'lucide-react';
import { RulesModal } from '../RulesModal';

export const CommissionerDashboard: React.FC = () => {
  const { user, userData, programData, leagueData } = useAuth();
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
  const [createSport, setCreateSport] = useState('Football');
  const [createCity, setCreateCity] = useState('');
  const [createState, setCreateState] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Get commissioner type from userData (defaults to 'team' for backwards compatibility)
  const commissionerType = userData?.commissionerType || 'team';
  const isLeagueCommissioner = commissionerType === 'league';
  const isTeamCommissioner = commissionerType === 'team';

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
    
    setCreating(true);
    setCreateError('');
    
    try {
      if (isTeamCommissioner) {
        // Create a new team
        const teamRef = await addDoc(collection(db, 'teams'), {
          name: createName.trim(),
          sport: createSport,
          city: createCity,
          state: createState,
          ownerId: user?.uid,
          ownerName: userData?.name,
          color: '#6366f1',
          createdAt: serverTimestamp(),
        });
        
        setTeams(prev => [...prev, { 
          id: teamRef.id, 
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
      setCreateSport('Football');
      setCreateCity('');
      setCreateState('');
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  // Check for valid commissioner role
  const validRoles = ['Commissioner', 'ProgramCommissioner', 'LeagueOwner'];
  if (!userData || !validRoles.includes(userData.role)) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-4">You need to be a Commissioner to view this page.</p>
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
    <div className="min-h-screen bg-gray-900 pb-20">
      {/* Header */}
      <div className={`bg-gradient-to-r ${isLeagueCommissioner ? 'from-purple-900/50 to-indigo-900/50' : 'from-orange-900/50 to-amber-900/50'} border-b border-gray-800`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${isLeagueCommissioner ? 'bg-purple-500/20' : 'bg-orange-500/20'} rounded-xl flex items-center justify-center`}>
                {isLeagueCommissioner ? (
                  <Crown className="w-6 h-6 text-purple-400" />
                ) : (
                  <Trophy className="w-6 h-6 text-orange-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">
                    {isLeagueCommissioner ? 'League Commissioner' : 'Team Commissioner'}
                  </h1>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    isLeagueCommissioner 
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                  }`}>
                    {isLeagueCommissioner ? '🏆 League' : '🏈 Team'}
                  </span>
                </div>
                <p className="text-gray-400 text-sm">
                  {userData?.name} • {isLeagueCommissioner ? 'Manage leagues and tournaments' : 'Manage teams and rosters'}
                </p>
              </div>
            </div>
            <Link
              to="/commissioner/settings"
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5 text-gray-400" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLeagueCommissioner ? (
            <>
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Layers className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-gray-400 text-sm">Leagues</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.totalLeagues}</p>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-gray-400 text-sm">Teams</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.totalTeams}</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-orange-400" />
                  </div>
                  <span className="text-gray-400 text-sm">Teams</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.totalTeams}</p>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="text-gray-400 text-sm">Players</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.totalPlayers}</p>
              </div>
            </>
          )}
          
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-gray-400 text-sm">Players</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.totalPlayers}</p>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <span className="text-gray-400 text-sm">Grievances</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.activeGrievances}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className={`bg-gray-800 hover:bg-gray-750 border border-gray-700 ${isLeagueCommissioner ? 'hover:border-purple-500/50' : 'hover:border-orange-500/50'} rounded-xl p-4 flex flex-col items-center gap-2 transition-all group`}
          >
            <div className={`w-12 h-12 ${isLeagueCommissioner ? 'bg-purple-500/20 group-hover:bg-purple-500/30' : 'bg-orange-500/20 group-hover:bg-orange-500/30'} rounded-xl flex items-center justify-center transition-colors`}>
              <Plus className={`w-6 h-6 ${isLeagueCommissioner ? 'text-purple-400' : 'text-orange-400'}`} />
            </div>
            <span className="text-white font-medium text-sm">
              {isLeagueCommissioner ? 'Create League' : 'Create Team'}
            </span>
          </button>
          
          <Link
            to={isLeagueCommissioner ? "/commissioner/leagues" : "/commissioner/teams"}
            className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500/50 rounded-xl p-4 flex flex-col items-center gap-2 transition-all group"
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              {isLeagueCommissioner ? (
                <Layers className="w-6 h-6 text-blue-400" />
              ) : (
                <Users className="w-6 h-6 text-blue-400" />
              )}
            </div>
            <span className="text-white font-medium text-sm">
              {isLeagueCommissioner ? 'Manage Leagues' : 'Manage Teams'}
            </span>
          </Link>
          
          <Link
            to="/commissioner/grievances"
            className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-yellow-500/50 rounded-xl p-4 flex flex-col items-center gap-2 transition-all group relative"
          >
            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center group-hover:bg-yellow-500/30 transition-colors">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            </div>
            <span className="text-white font-medium text-sm">Grievances</span>
            {pendingGrievances.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {pendingGrievances.length}
              </span>
            )}
          </Link>
          
          <Link
            to="/commissioner/schedule"
            className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-green-500/50 rounded-xl p-4 flex flex-col items-center gap-2 transition-all group"
          >
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
              <Calendar className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-white font-medium text-sm">Schedule</span>
          </Link>
        </div>

        {/* Teams or Leagues List */}
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-white">
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
                <Layers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">No leagues yet. Create your first league to get started.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create League
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {leagues.slice(0, 5).map((league) => (
                  <Link
                    key={league.id}
                    to={`/commissioner/leagues/${league.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold">
                        {league.name?.charAt(0) || 'L'}
                      </div>
                      <div>
                        <p className="text-white font-medium">{league.name}</p>
                        <p className="text-sm text-gray-400">{league.sport} • {(league.teamIds || []).length} teams</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </Link>
                ))}
              </div>
            )
          ) : (
            // Team Commissioner - show teams
            teams.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">No teams yet. Create your first team to get started.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Team
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {teams.slice(0, 5).map((team) => (
                  <Link
                    key={team.id}
                    to={`/team/${team.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: '#f97316' }}
                      >
                        {team.name?.charAt(0) || 'T'}
                      </div>
                      <div>
                        <p className="text-white font-medium">{team.name}</p>
                        <p className="text-sm text-gray-400">{team.sport || 'Football'} • {team.location?.city || 'All Ages'}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </Link>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-gray-700">
            <div className={`p-4 border-b border-gray-700 ${isLeagueCommissioner ? 'bg-purple-900/20' : 'bg-orange-900/20'}`}>
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
            
            <div className="p-4 space-y-4">
              {createError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                  {createError}
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-300">
                  {isLeagueCommissioner ? 'League Name' : 'Team Name'}
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={isLeagueCommissioner ? "Atlanta Youth Football League" : "Eastside Eagles"}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2.5 px-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
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
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">City</label>
                  <input
                    type="text"
                    value={createCity}
                    onChange={(e) => setCreateCity(e.target.value)}
                    placeholder="Atlanta"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2.5 px-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">State</label>
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
            
            <div className="p-4 border-t border-gray-700 flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !createName.trim()}
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
