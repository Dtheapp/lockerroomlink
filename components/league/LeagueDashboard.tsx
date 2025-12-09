/**
 * League Owner Dashboard Component
 * Main dashboard for League Owners to manage their league
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getProgramsByLeague,
  getLeagueSeasons,
  getLeagueSchedules,
  getLeagueRequestsByLeague
} from '../../services/leagueService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Program, LeagueSeason, LeagueSchedule, LeagueRequest, Team } from '../../types';
import { 
  Building2, 
  Users, 
  Shield, 
  Calendar, 
  Trophy, 
  Settings, 
  Plus,
  ChevronRight,
  Bell,
  Activity,
  Loader2,
  Clock,
  CheckCircle2,
  FileText
} from 'lucide-react';

export const LeagueDashboard: React.FC = () => {
  const { user, userData, leagueData } = useAuth();
  
  const [programs, setPrograms] = useState<Program[]>([]);
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [schedules, setSchedules] = useState<LeagueSchedule[]>([]);
  const [requests, setRequests] = useState<LeagueRequest[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPrograms: 0,
    totalTeams: 0,
    activeSeasons: 0,
    pendingRequests: 0,
  });

  useEffect(() => {
    if (!leagueData?.id) {
      setLoading(false);
      return;
    }

    const loadDashboardData = async () => {
      try {
        // Load programs in this league
        const programsData = await getProgramsByLeague(leagueData.id!);
        setPrograms(programsData);
        
        // Load seasons
        const seasonsData = await getLeagueSeasons(leagueData.id!);
        setSeasons(seasonsData);
        
        // Load schedules
        const schedulesData = await getLeagueSchedules(leagueData.id!);
        setSchedules(schedulesData);
        
        // Load pending requests
        const requestsData = await getLeagueRequestsByLeague(leagueData.id!);
        setRequests(requestsData);
        
        // Count teams in league
        const teamsQuery = query(
          collection(db, 'teams'),
          where('leagueId', '==', leagueData.id)
        );
        const teamsSnap = await getDocs(teamsQuery);
        setTeamCount(teamsSnap.size);
        
        // Calculate stats
        setStats({
          totalPrograms: programsData.length,
          totalTeams: teamsSnap.size,
          activeSeasons: seasonsData.filter(s => s.status === 'active').length,
          pendingRequests: requestsData.filter(r => r.status === 'pending').length,
        });
        
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [leagueData?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!userData || userData.role !== 'LeagueOwner') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-4">You need to be a League Owner to view this page.</p>
        </div>
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const activeSeason = seasons.find(s => s.status === 'active');

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/50 to-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {leagueData?.name || 'League Dashboard'}
                </h1>
                <p className="text-gray-400 text-sm">
                  {leagueData?.city}, {leagueData?.state} • {leagueData?.sport}
                </p>
              </div>
            </div>
            <Link
              to="/league/settings"
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5 text-gray-400" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Active Season Banner */}
        {activeSeason ? (
          <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-500/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-sm text-gray-400">Active Season</p>
                <p className="text-white font-medium">{activeSeason.name}</p>
              </div>
            </div>
            <Link
              to={`/league/seasons/${activeSeason.id}`}
              className="text-sm text-green-400 hover:text-green-300 flex items-center gap-1"
            >
              Manage <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-white font-medium">No Active Season</p>
                <p className="text-sm text-gray-400">Create a season to start scheduling games</p>
              </div>
            </div>
            <Link
              to="/league/seasons/create"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              Create Season <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-gray-400 text-sm">Programs</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.totalPrograms}</p>
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
          
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Trophy className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-gray-400 text-sm">Active Seasons</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.activeSeasons}</p>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <span className="text-gray-400 text-sm">Requests</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.pendingRequests}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Link
            to="/league/programs"
            className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-purple-500/50 rounded-xl p-4 flex flex-col items-center gap-2 transition-all group"
          >
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-white font-medium text-sm">Programs</span>
          </Link>
          
          <Link
            to="/league/seasons"
            className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500/50 rounded-xl p-4 flex flex-col items-center gap-2 transition-all group"
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <Calendar className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-white font-medium text-sm">Seasons</span>
          </Link>
          
          <Link
            to="/league/standings"
            className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-green-500/50 rounded-xl p-4 flex flex-col items-center gap-2 transition-all group"
          >
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
              <Activity className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-white font-medium text-sm">Standings</span>
          </Link>
          
          <Link
            to="/league/playoffs"
            className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-yellow-500/50 rounded-xl p-4 flex flex-col items-center gap-2 transition-all group"
          >
            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center group-hover:bg-yellow-500/30 transition-colors">
              <Trophy className="w-6 h-6 text-yellow-400" />
            </div>
            <span className="text-white font-medium text-sm">Playoffs</span>
          </Link>
          
          <Link
            to="/league/requests"
            className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-red-500/50 rounded-xl p-4 flex flex-col items-center gap-2 transition-all group relative"
          >
            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
              <FileText className="w-6 h-6 text-red-400" />
            </div>
            <span className="text-white font-medium text-sm">Requests</span>
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </Link>
        </div>

        {/* Programs List */}
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-white">Member Programs</h2>
            <Link
              to="/league/programs"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {programs.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">No programs have joined the league yet</p>
              <p className="text-sm text-gray-500">Programs can request to join through their Commissioner dashboard</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {programs.slice(0, 5).map((program) => (
                <Link
                  key={program.id}
                  to={`/league/programs/${program.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <Shield className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{program.name}</p>
                      <p className="text-sm text-gray-400">
                        {program.city}, {program.state} • {program.teamCount || 0} teams
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-yellow-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-yellow-400" />
                <h2 className="font-semibold text-yellow-400">Pending Requests</h2>
              </div>
              <Link
                to="/league/requests"
                className="text-sm text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="divide-y divide-yellow-500/10">
              {pendingRequests.slice(0, 3).map((request) => (
                <Link
                  key={request.id}
                  to={`/league/requests/${request.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-yellow-500/5 transition-colors"
                >
                  <div>
                    <p className="text-white font-medium">{request.teamName}</p>
                    <p className="text-sm text-gray-400">
                      Requesting to join league
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
                    Pending
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

export default LeagueDashboard;
