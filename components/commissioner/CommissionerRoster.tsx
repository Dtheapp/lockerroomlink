/**
 * Commissioner Roster Component
 * View-only roster with ability to remove players from teams
 * Commissioners don't add players - that's done by parents/coaches
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Team, Player } from '../../types';
import { 
  Shield, 
  Users, 
  Loader2, 
  Search,
  UserMinus,
  AlertTriangle,
  ChevronDown,
  User,
  Star,
  Crown,
  AtSign
} from 'lucide-react';

interface TeamWithPlayers extends Team {
  players: Player[];
}

export const CommissionerRoster: React.FC = () => {
  const { userData, user } = useAuth();
  const { theme } = useTheme();
  
  const [teams, setTeams] = useState<TeamWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [removingPlayer, setRemovingPlayer] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ playerId: string; playerName: string; teamId: string; teamName: string } | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const loadTeamsAndPlayers = async () => {
      try {
        // Get teams owned by this commissioner
        const teamsQuery = query(
          collection(db, 'teams'),
          where('ownerId', '==', user.uid)
        );
        const teamsSnap = await getDocs(teamsQuery);
        
        const teamsWithPlayers: TeamWithPlayers[] = [];
        
        for (const teamDoc of teamsSnap.docs) {
          const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
          
          // Get players for this team
          const playersSnap = await getDocs(collection(db, 'teams', teamDoc.id, 'players'));
          const playersRaw = playersSnap.docs.map(doc => ({ 
            id: doc.id, 
            teamId: teamDoc.id,
            ...doc.data() 
          } as Player));
          
          // ENRICH with athlete profile data (photo, username, dob, uniform sizes)
          const players = await Promise.all(playersRaw.map(async (player) => {
            if (player.athleteId) {
              try {
                const athleteDoc = await getDoc(doc(db, 'players', player.athleteId));
                if (athleteDoc.exists()) {
                  const athleteData = athleteDoc.data();
                  // Handle DOB - could be string or Firestore Timestamp
                  let dobValue = athleteData.dob || athleteData.dateOfBirth || player.dob || player.dateOfBirth;
                  if (dobValue && typeof dobValue === 'object' && dobValue.toDate) {
                    dobValue = dobValue.toDate().toISOString().split('T')[0];
                  }
                  return {
                    ...player,
                    photoUrl: athleteData.photoUrl || player.photoUrl,
                    username: athleteData.username || player.username,
                    dob: dobValue,
                    dateOfBirth: dobValue,
                    nickname: athleteData.nickname || player.nickname,
                    firstName: athleteData.firstName || player.firstName,
                    lastName: athleteData.lastName || player.lastName,
                    name: athleteData.name || player.name,
                    // Uniform sizes from athlete profile
                    helmetSize: athleteData.helmetSize || player.helmetSize,
                    shirtSize: athleteData.shirtSize || player.shirtSize,
                    pantSize: athleteData.pantSize || player.pantSize,
                  };
                }
              } catch (err) {
                console.log('[CommissionerRoster] Could not enrich player:', player.athleteId);
              }
            }
            return player;
          }));
          
          teamsWithPlayers.push({
            ...teamData,
            players
          });
        }
        
        setTeams(teamsWithPlayers);
        
        // Auto-select first team if only one
        if (teamsWithPlayers.length === 1) {
          setSelectedTeamId(teamsWithPlayers[0].id!);
        }
        
      } catch (error) {
        console.error('Error loading teams and players:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeamsAndPlayers();
  }, [user?.uid]);

  const handleRemovePlayer = async () => {
    if (!confirmRemove) return;
    
    setRemovingPlayer(confirmRemove.playerId);
    
    try {
      // Delete player from team's players subcollection
      await deleteDoc(doc(db, 'teams', confirmRemove.teamId, 'players', confirmRemove.playerId));
      
      // Update local state
      setTeams(prev => prev.map(team => {
        if (team.id === confirmRemove.teamId) {
          return {
            ...team,
            players: team.players.filter(p => p.id !== confirmRemove.playerId)
          };
        }
        return team;
      }));
      
      setConfirmRemove(null);
    } catch (error) {
      console.error('Error removing player:', error);
      alert('Failed to remove player. Please try again.');
    } finally {
      setRemovingPlayer(null);
    }
  };

  // Get all players across all teams or filtered by selected team
  const getFilteredPlayers = () => {
    let allPlayers: (Player & { teamName: string; teamColor: string })[] = [];
    
    teams.forEach(team => {
      if (selectedTeamId === 'all' || team.id === selectedTeamId) {
        team.players.forEach(player => {
          allPlayers.push({
            ...player,
            teamName: team.name || 'Unknown Team',
            teamColor: team.color || '#6366f1'
          });
        });
      }
    });
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      allPlayers = allPlayers.filter(player =>
        player.name?.toLowerCase().includes(query) ||
        player.position?.toLowerCase().includes(query) ||
        player.number?.toString().includes(query) ||
        player.teamName?.toLowerCase().includes(query)
      );
    }
    
    return allPlayers;
  };

  const filteredPlayers = getFilteredPlayers();
  const totalPlayers = teams.reduce((sum, team) => sum + team.players.length, 0);

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
          <div className="flex items-center gap-3">
            <Link to="/commissioner" className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
              <Shield className="w-5 h-5" />
            </Link>
            <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Team Rosters</h1>
          </div>
          <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            View players across your teams • {totalPlayers} total players
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Team Selector */}
          <div className="relative">
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className={`appearance-none pl-4 pr-10 py-2.5 rounded-lg border focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                theme === 'dark' 
                  ? 'bg-gray-800 border-gray-700 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="all">All Teams ({totalPlayers} players)</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.players.length} players)
                </option>
              ))}
            </select>
            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
          
          {/* Search */}
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players by name, position, or number..."
              className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                theme === 'dark' 
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>
        </div>

        {/* No Teams */}
        {teams.length === 0 ? (
          <div className={`rounded-xl p-12 text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
            <Users className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
            <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>No Teams Yet</h2>
            <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Create teams first, then coaches and parents can add players.
            </p>
            <Link
              to="/commissioner/teams/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Create Team
            </Link>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className={`rounded-xl p-12 text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
            <Users className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
            <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {searchQuery ? 'No Players Found' : 'No Players Yet'}
            </h2>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              {searchQuery 
                ? 'Try adjusting your search criteria.' 
                : 'Players are added by coaches and parents, not commissioners.'}
            </p>
          </div>
        ) : (
          /* Players Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlayers.map((player) => {
              const isStarter = player.isStarter;
              const isCaptain = player.isCaptain;
              
              return (
                <div 
                  key={`${player.teamId}-${player.id}`}
                  className={`rounded-xl p-4 relative overflow-hidden transition-all duration-300 ${
                    isStarter 
                      ? 'ring-2 ring-amber-400/50 border-amber-400' 
                      : ''
                  } ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}
                  style={isStarter ? { boxShadow: '0 0 20px rgba(251, 191, 36, 0.3)' } : {}}
                >
                  {/* Starter Badge */}
                  {isStarter && (
                    <div className="absolute top-2 left-2 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full px-2 py-0.5 shadow-lg flex items-center gap-1 z-10">
                      <Star className="w-3 h-3 text-white fill-white" />
                      <span className="text-[10px] font-bold text-white uppercase">Starter</span>
                    </div>
                  )}
                  
                  <div className={`flex items-start gap-3 ${isStarter ? 'mt-6' : ''}`}>
                    {/* Player Photo or Number */}
                    {player.photoUrl ? (
                      <img 
                        src={player.photoUrl} 
                        alt={player.name}
                        className={`w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 ${
                          isStarter ? 'border-amber-400' : 'border-gray-300 dark:border-gray-600'
                        }`}
                      />
                    ) : (
                      <div 
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${
                          isStarter ? 'ring-2 ring-amber-400' : ''
                        }`}
                        style={{ backgroundColor: player.teamColor }}
                      >
                        {player.number || '?'}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold truncate flex items-center gap-1.5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {player.name}
                        {isCaptain && <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                      </h3>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {player.position || 'TBD'} • {player.teamName}
                      </p>
                      {/* Clickable Username */}
                      {player.username && (
                        <Link 
                          to={`/athlete/${player.username}`}
                          className="flex items-center gap-1 mt-1 hover:opacity-80 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <AtSign className="w-3 h-3 text-purple-500" />
                          <span className="text-xs text-purple-600 dark:text-purple-400 font-medium hover:underline">{player.username}</span>
                        </Link>
                      )}
                    </div>
                    
                    {/* Remove Button */}
                    <button
                      onClick={() => setConfirmRemove({
                        playerId: player.id!,
                        playerName: player.name,
                        teamId: player.teamId!,
                        teamName: player.teamName
                      })}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Remove from team"
                    >
                      <UserMinus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Remove Confirmation Modal */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl p-6 max-w-md w-full ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Remove Player?
                </h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  This cannot be undone
                </p>
              </div>
            </div>
            
            <p className={`mb-6 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Are you sure you want to remove <strong>{confirmRemove.playerName}</strong> from <strong>{confirmRemove.teamName}</strong>?
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                disabled={removingPlayer === confirmRemove.playerId}
                className={`flex-1 py-2.5 rounded-lg transition-colors ${
                  theme === 'dark' 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleRemovePlayer}
                disabled={removingPlayer === confirmRemove.playerId}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {removingPlayer === confirmRemove.playerId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserMinus className="w-4 h-4" />
                )}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionerRoster;
