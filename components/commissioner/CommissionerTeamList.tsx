/**
 * Commissioner Team List Component
 * Lists all teams under a commissioner's program
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getTeamsByProgram } from '../../services/leagueService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Team } from '../../types';
import { 
  Users, 
  Plus, 
  Search, 
  Filter,
  ChevronRight,
  Loader2,
  Shield,
  UserCheck,
  Link2
} from 'lucide-react';

export const CommissionerTeamList: React.FC = () => {
  const { userData } = useAuth();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>('all');
  const [teamStats, setTeamStats] = useState<Record<string, { players: number; coaches: number }>>({});

  useEffect(() => {
    if (!userData?.programId) {
      setLoading(false);
      return;
    }

    const loadTeams = async () => {
      try {
        const teamsData = await getTeamsByProgram(userData.programId!);
        setTeams(teamsData);
        
        // Load player/coach counts for each team
        const stats: Record<string, { players: number; coaches: number }> = {};
        for (const team of teamsData) {
          const playersSnap = await getDocs(collection(db, 'teams', team.id!, 'players'));
          const coachesSnap = await getDocs(collection(db, 'teams', team.id!, 'coaches'));
          stats[team.id!] = {
            players: playersSnap.size,
            coaches: coachesSnap.size,
          };
        }
        setTeamStats(stats);
        
      } catch (error) {
        console.error('Error loading teams:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, [userData?.programId]);

  // Get unique age groups for filter
  const ageGroups = [...new Set(teams.map(t => t.ageGroup).filter(Boolean))];

  // Filter teams
  const filteredTeams = teams.filter(team => {
    const matchesSearch = team.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          team.sport?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAgeGroup = filterAgeGroup === 'all' || team.ageGroup === filterAgeGroup;
    return matchesSearch && matchesAgeGroup;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/commissioner" className="text-gray-400 hover:text-white">
                <Shield className="w-5 h-5" />
              </Link>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <h1 className="text-xl font-bold text-white">Team Management</h1>
            </div>
            <Link
              to="/commissioner/teams/create"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Team</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teams..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterAgeGroup}
              onChange={(e) => setFilterAgeGroup(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Age Groups</option>
              {ageGroups.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Teams Grid */}
        {filteredTeams.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-12 text-center">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              {teams.length === 0 ? 'No Teams Yet' : 'No Teams Found'}
            </h2>
            <p className="text-gray-400 mb-6">
              {teams.length === 0 
                ? 'Create your first team to get started managing your program.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
            {teams.length === 0 && (
              <Link
                to="/commissioner/teams/create"
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Team
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeams.map((team) => (
              <Link
                key={team.id}
                to={`/commissioner/teams/${team.id}`}
                className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-purple-500/50 rounded-xl p-4 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                    style={{ backgroundColor: team.color || '#6366f1' }}
                  >
                    {team.name?.charAt(0) || 'T'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate group-hover:text-purple-400 transition-colors">
                      {team.name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {team.sport} • {team.ageGroup || 'No age group'}
                    </p>
                    
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-gray-300">
                          {teamStats[team.id!]?.players || 0} players
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <UserCheck className="w-4 h-4 text-green-400" />
                        <span className="text-gray-300">
                          {teamStats[team.id!]?.coaches || 0} coaches
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Linked cheer team indicator */}
                {team.linkedCheerTeamId && (
                  <div className="mt-3 pt-3 border-t border-gray-700 flex items-center gap-2 text-sm text-purple-400">
                    <Link2 className="w-4 h-4" />
                    <span>Linked Cheer Team</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {teams.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-4 flex flex-wrap items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{teams.length}</p>
              <p className="text-sm text-gray-400">Total Teams</p>
            </div>
            <div className="h-8 w-px bg-gray-700" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {Object.values(teamStats).reduce((sum, s) => sum + s.players, 0)}
              </p>
              <p className="text-sm text-gray-400">Total Players</p>
            </div>
            <div className="h-8 w-px bg-gray-700" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {Object.values(teamStats).reduce((sum, s) => sum + s.coaches, 0)}
              </p>
              <p className="text-sm text-gray-400">Total Coaches</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommissionerTeamList;
