/**
 * Commissioner Team List Component
 * Lists all teams under a commissioner's program
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getTeamsByProgram } from '../../services/leagueService';
import { collection, getDocs, query, where } from 'firebase/firestore';
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
  const { userData, user } = useAuth();
  const { theme } = useTheme();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>('all');
  const [teamStats, setTeamStats] = useState<Record<string, { players: number; coaches: number }>>({});

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const loadTeams = async () => {
      try {
        let teamsData: Team[] = [];
        
        // First try to get teams by programId (for commissioners with programs)
        if (userData?.programId) {
          teamsData = await getTeamsByProgram(userData.programId!);
        }
        
        // Also get teams by ownerId (for team commissioners who own teams directly)
        const ownerQuery = query(collection(db, 'teams'), where('ownerId', '==', user.uid));
        const ownerSnap = await getDocs(ownerQuery);
        const ownerTeams = ownerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
        
        // Merge and dedupe teams
        const teamIds = new Set(teamsData.map(t => t.id));
        for (const team of ownerTeams) {
          if (!teamIds.has(team.id)) {
            teamsData.push(team);
          }
        }
        
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
  }, [userData?.programId, user?.uid]);

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
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-20 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/commissioner" className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
                <Shield className="w-5 h-5" />
              </Link>
              <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
              <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Team Management</h1>
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
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teams..."
              className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                theme === 'dark' 
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
            <select
              value={filterAgeGroup}
              onChange={(e) => setFilterAgeGroup(e.target.value)}
              className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                theme === 'dark' 
                  ? 'bg-gray-800 border-gray-700 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
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
          <div className={`rounded-xl p-12 text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
            <Users className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
            <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {teams.length === 0 ? 'No Teams Yet' : 'No Teams Found'}
            </h2>
            <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
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
                className={`rounded-xl p-4 transition-all group ${
                  theme === 'dark' 
                    ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-purple-500/50' 
                    : 'bg-white hover:bg-gray-50 border border-gray-200 hover:border-purple-400 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                    style={{ backgroundColor: team.color || '#6366f1' }}
                  >
                    {team.name?.charAt(0) || 'T'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-lg font-semibold truncate group-hover:text-purple-500 transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {team.name}
                    </h3>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      {team.sport} • {team.ageGroup || 'No age group'}
                    </p>
                    
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                          {teamStats[team.id!]?.players || 0} players
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <UserCheck className="w-4 h-4 text-green-400" />
                        <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                          {teamStats[team.id!]?.coaches || 0} coaches
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Linked cheer team indicator */}
                {team.linkedCheerTeamId && (
                  <div className={`mt-3 pt-3 border-t flex items-center gap-2 text-sm text-purple-500 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
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
          <div className={`rounded-xl p-4 flex flex-wrap items-center justify-center gap-8 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
            <div className="text-center">
              <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{teams.length}</p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Total Teams</p>
            </div>
            <div className={`h-8 w-px ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className="text-center">
              <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {Object.values(teamStats).reduce((sum, s) => sum + s.players, 0)}
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Total Players</p>
            </div>
            <div className={`h-8 w-px ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className="text-center">
              <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {Object.values(teamStats).reduce((sum, s) => sum + s.coaches, 0)}
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Total Coaches</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommissionerTeamList;
