/**
 * Commissioner Dashboard Component
 * Main dashboard for Program Commissioners to manage their program
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
import { collection, query, where, getDocs, onSnapshot, doc } from 'firebase/firestore';
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
  Building2
} from 'lucide-react';

export const CommissionerDashboard: React.FC = () => {
  const { user, userData, programData, leagueData } = useAuth();
  const navigate = useNavigate();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [coachRequests, setCoachRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTeams: 0,
    totalPlayers: 0,
    activeGrievances: 0,
    pendingRequests: 0,
  });

  useEffect(() => {
    if (!userData?.programId) {
      setLoading(false);
      return;
    }

    const loadDashboardData = async () => {
      try {
        // Load teams
        const teamsData = await getTeamsByProgram(userData.programId!);
        setTeams(teamsData);
        
        // Load grievances
        const grievancesData = await getGrievancesByProgram(userData.programId!);
        setGrievances(grievancesData);
        
        // Calculate stats
        let totalPlayers = 0;
        for (const team of teamsData) {
          const playersSnap = await getDocs(collection(db, 'teams', team.id!, 'players'));
          totalPlayers += playersSnap.size;
        }
        
        setStats({
          totalTeams: teamsData.length,
          totalPlayers,
          activeGrievances: grievancesData.filter(g => g.status !== 'resolved').length,
          pendingRequests: 0, // Will implement coach request system
        });
        
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [userData?.programId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!userData || userData.role !== 'ProgramCommissioner') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-4">You need to be a Program Commissioner to view this page.</p>
          <Link 
            to="/commissioner/signup"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Shield className="w-4 h-4" />
            Become a Commissioner
          </Link>
        </div>
      </div>
    );
  }

  const pendingGrievances = grievances.filter(g => g.status === 'submitted' || g.status === 'under_review');

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/50 to-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {programData?.name || 'Commissioner Dashboard'}
                </h1>
                <p className="text-gray-400 text-sm">
                  {programData?.sport} • {programData?.city}, {programData?.state}
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
        {/* League Affiliation Banner */}
        {leagueData ? (
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">League Affiliation</p>
                <p className="text-white font-medium">{leagueData.name}</p>
              </div>
            </div>
            <Link
              to="/league"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              View League <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-white font-medium">Independent Program</p>
                <p className="text-sm text-gray-400">Not affiliated with a league</p>
              </div>
            </div>
            <Link
              to="/leagues/browse"
              className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              Join a League <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
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
          
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <span className="text-gray-400 text-sm">Grievances</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.activeGrievances}</p>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-gray-400 text-sm">Requests</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.pendingRequests}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/commissioner/teams/create"
            className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-purple-500/50 rounded-xl p-4 flex flex-col items-center gap-2 transition-all group"
          >
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
              <Plus className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-white font-medium text-sm">Create Team</span>
          </Link>
          
          <Link
            to="/commissioner/teams"
            className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500/50 rounded-xl p-4 flex flex-col items-center gap-2 transition-all group"
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-white font-medium text-sm">Manage Teams</span>
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

        {/* Teams List */}
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-white">Your Teams</h2>
            <Link
              to="/commissioner/teams"
              className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {teams.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">No teams yet. Create your first team to get started.</p>
              <Link
                to="/commissioner/teams/create"
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Team
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {teams.slice(0, 5).map((team) => (
                <Link
                  key={team.id}
                  to={`/commissioner/teams/${team.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: team.color || '#6366f1' }}
                    >
                      {team.name?.charAt(0) || 'T'}
                    </div>
                    <div>
                      <p className="text-white font-medium">{team.name}</p>
                      <p className="text-sm text-gray-400">{team.ageGroup || 'No age group'}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pending Grievances */}
        {pendingGrievances.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-yellow-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-yellow-400" />
                <h2 className="font-semibold text-yellow-400">Pending Grievances</h2>
              </div>
              <Link
                to="/commissioner/grievances"
                className="text-sm text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="divide-y divide-yellow-500/10">
              {pendingGrievances.slice(0, 3).map((grievance) => (
                <Link
                  key={grievance.id}
                  to={`/commissioner/grievances/${grievance.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-yellow-500/5 transition-colors"
                >
                  <div>
                    <p className="text-white font-medium">{grievance.title}</p>
                    <p className="text-sm text-gray-400">
                      {grievance.type} • {new Date(grievance.createdAt?.toDate?.() || grievance.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    grievance.status === 'submitted' 
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {grievance.status === 'submitted' ? 'New' : 'In Review'}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommissionerDashboard;
