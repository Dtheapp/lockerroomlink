/**
 * Commissioner Team List Component
 * Lists all teams under a commissioner's program, grouped by sport with collapsible sections
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  ChevronRight,
  ChevronDown,
  Loader2,
  Shield,
  UserCheck,
  Link2
} from 'lucide-react';

// Sport icons
const SPORT_ICONS: Record<string, string> = {
  football: '🏈',
  basketball: '🏀',
  cheer: '📣',
  soccer: '⚽',
  baseball: '⚾',
  volleyball: '🏐',
  other: '🎯'
};

export const CommissionerTeamList: React.FC = () => {
  const { userData, user, programData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  // Get selected sport from localStorage
  const selectedSportFromDropdown = localStorage.getItem('commissioner_selected_sport')?.toLowerCase() || '';

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamStats, setTeamStats] = useState<Record<string, { players: number; coaches: number }>>({});
  
  // Track which sport sections are expanded
  const [expandedSports, setExpandedSports] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const loadTeams = async () => {
      try {
        let teamsData: Team[] = [];
        
        // First try to get teams by programId (for commissioners with programs)
        if (programData?.id) {
          teamsData = await getTeamsByProgram(programData.id);
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
        
        // Auto-expand the selected sport from dropdown
        if (selectedSportFromDropdown) {
          setExpandedSports(new Set([selectedSportFromDropdown]));
        } else if (teamsData.length > 0) {
          // Expand first sport if none selected
          const firstSport = teamsData[0]?.sport?.toLowerCase();
          if (firstSport) {
            setExpandedSports(new Set([firstSport]));
          }
        }
        
        // Load player/coach counts for each team
        const stats: Record<string, { players: number; coaches: number }> = {};
        
        // Get all coaches in one query for efficiency
        const coachesQuery = query(collection(db, 'users'), where('role', '==', 'Coach'));
        const allCoachesSnap = await getDocs(coachesQuery);
        const coachesByTeam: Record<string, number> = {};
        
        allCoachesSnap.docs.forEach(doc => {
          const coachData = doc.data();
          const teamIds = coachData.teamIds || [];
          if (coachData.teamId && !teamIds.includes(coachData.teamId)) {
            teamIds.push(coachData.teamId);
          }
          teamIds.forEach((tid: string) => {
            coachesByTeam[tid] = (coachesByTeam[tid] || 0) + 1;
          });
        });
        
        // Get player counts from subcollection
        for (const team of teamsData) {
          const playersSnap = await getDocs(collection(db, 'teams', team.id!, 'players'));
          stats[team.id!] = {
            players: playersSnap.size,
            coaches: coachesByTeam[team.id!] || 0,
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
  }, [programData?.id, user?.uid, selectedSportFromDropdown]);

  // Group teams by sport
  const teamsBySport = useMemo(() => {
    const grouped: Record<string, Team[]> = {};
    
    teams.forEach(team => {
      const sport = team.sport?.toLowerCase() || 'other';
      if (!grouped[sport]) {
        grouped[sport] = [];
      }
      grouped[sport].push(team);
    });
    
    // Sort sports alphabetically, but put selected sport first
    const sortedSports = Object.keys(grouped).sort((a, b) => {
      if (a === selectedSportFromDropdown) return -1;
      if (b === selectedSportFromDropdown) return 1;
      return a.localeCompare(b);
    });
    
    return { grouped, sortedSports };
  }, [teams, selectedSportFromDropdown]);

  // Filter teams by search query
  const filterTeams = (teamList: Team[]) => {
    if (!searchQuery) return teamList;
    return teamList.filter(team => 
      team.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.ageGroup?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Toggle sport section
  const toggleSport = (sport: string) => {
    setExpandedSports(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sport)) {
        newSet.delete(sport);
      } else {
        newSet.add(sport);
      }
      return newSet;
    });
  };

  // Get display name for sport
  const getSportDisplayName = (sport: string) => {
    return sport.charAt(0).toUpperCase() + sport.slice(1);
  };

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
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Search */}
        <div className="relative">
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

        {/* No teams at all */}
        {teams.length === 0 ? (
          <div className={`rounded-xl p-12 text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
            <Users className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
            <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              No Teams Yet
            </h2>
            <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Create your first team to get started managing your program.
            </p>
            <Link
              to="/commissioner/teams/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Team
            </Link>
          </div>
        ) : (
          /* Sport Sections */
          <div className="space-y-4">
            {teamsBySport.sortedSports.map(sport => {
              const sportTeams = filterTeams(teamsBySport.grouped[sport]);
              const isExpanded = expandedSports.has(sport);
              const totalPlayers = sportTeams.reduce((sum, t) => sum + (teamStats[t.id!]?.players || 0), 0);
              const totalCoaches = sportTeams.reduce((sum, t) => sum + (teamStats[t.id!]?.coaches || 0), 0);
              
              return (
                <div 
                  key={sport}
                  className={`rounded-xl overflow-hidden ${
                    theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'
                  }`}
                >
                  {/* Sport Header - Collapsible */}
                  <div 
                    className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                      theme === 'dark' ? 'hover:bg-gray-750' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggleSport(sport)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{SPORT_ICONS[sport] || '🎯'}</span>
                      <div>
                        <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {getSportDisplayName(sport)}
                        </h2>
                        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                          {sportTeams.length} team{sportTeams.length !== 1 ? 's' : ''} • {totalPlayers} players • {totalCoaches} coaches
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* Create Team Button for this sport */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Store the sport so create team form can pre-select it
                          localStorage.setItem('commissioner_create_team_sport', sport);
                          navigate('/commissioner/teams/create');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Team
                      </button>
                      
                      {/* Expand/Collapse Icon */}
                      {isExpanded ? (
                        <ChevronDown className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                      ) : (
                        <ChevronRight className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                      )}
                    </div>
                  </div>
                  
                  {/* Teams Grid - Collapsible */}
                  {isExpanded && (
                    <div className={`border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                      {sportTeams.length === 0 ? (
                        <div className="p-8 text-center">
                          <p className={`${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                            {searchQuery ? 'No teams match your search' : 'No teams in this sport yet'}
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                          {sportTeams.map((team) => (
                            <Link
                              key={team.id}
                              to={`/commissioner/teams/${team.id}`}
                              className={`rounded-xl p-4 transition-all group ${
                                theme === 'dark' 
                                  ? 'bg-gray-750 hover:bg-gray-700 border border-gray-600 hover:border-purple-500/50' 
                                  : 'bg-gray-50 hover:bg-white border border-gray-200 hover:border-purple-400 hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-start gap-3 sm:gap-4">
                                {team.logo ? (
                                  <img 
                                    src={team.logo} 
                                    alt={team.name} 
                                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div 
                                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-white text-lg sm:text-xl font-bold flex-shrink-0"
                                    style={{ backgroundColor: team.color || '#f59e0b' }}
                                  >
                                    {team.name?.charAt(0) || 'T'}
                                  </div>
                                )}
                                
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  <h3 className={`text-base sm:text-lg font-semibold truncate group-hover:text-purple-500 transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {team.name}
                                  </h3>
                                  <p className={`text-sm truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {team.ageGroup || 'No age group'}
                                  </p>
                                  
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 sm:mt-3">
                                    <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                                      <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                                      <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                                        {teamStats[team.id!]?.players || 0} players
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                                      <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
                                      <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                                        {teamStats[team.id!]?.coaches || 0} coaches
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Linked cheer team indicator */}
                              {team.linkedCheerTeamId && (
                                <div className={`mt-3 pt-3 border-t flex items-center gap-2 text-sm text-purple-500 ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`}>
                                  <Link2 className="w-4 h-4" />
                                  <span>Linked Cheer Team</span>
                                </div>
                              )}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
