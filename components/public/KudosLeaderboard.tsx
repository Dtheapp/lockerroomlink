import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Trophy, Star, Users, Medal, Crown, TrendingUp, User, ExternalLink } from 'lucide-react';
import type { Player, Team } from '../../types';

interface LeaderboardEntry {
  player: Player;
  team: Team | null;
  teamId: string;
  kudosCount: number;
  followerCount: number;
}

type LeaderboardType = 'kudos' | 'followers';

interface KudosLeaderboardProps {
  onAthleteClick?: (username: string) => void;
  limit?: number;
  showTitle?: boolean;
}

const KudosLeaderboard: React.FC<KudosLeaderboardProps> = ({ 
  onAthleteClick,
  limit: displayLimit = 10,
  showTitle = true 
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('kudos');

  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true);
      try {
        const entries: LeaderboardEntry[] = [];
        
        // Get all teams
        const teamsSnap = await getDocs(collection(db, 'teams'));
        
        for (const teamDoc of teamsSnap.docs) {
          const team = { id: teamDoc.id, ...teamDoc.data() } as Team;
          
          // Get players from this team
          const playersSnap = await getDocs(collection(db, 'teams', teamDoc.id, 'players'));
          
          for (const playerDoc of playersSnap.docs) {
            const player = { id: playerDoc.id, ...playerDoc.data() } as Player;
            
            // Only include players with kudos or followers
            if ((player.kudosCount && player.kudosCount > 0) || 
                (player.followerCount && player.followerCount > 0)) {
              entries.push({
                player,
                team,
                teamId: teamDoc.id,
                kudosCount: player.kudosCount || 0,
                followerCount: player.followerCount || 0,
              });
            }
          }
        }
        
        // Sort by selected type
        entries.sort((a, b) => {
          if (leaderboardType === 'kudos') {
            return b.kudosCount - a.kudosCount;
          }
          return b.followerCount - a.followerCount;
        });
        
        setLeaderboard(entries.slice(0, displayLimit));
      } catch (err) {
        console.error('Error loading leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [leaderboardType, displayLimit]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30">
          <Crown className="text-white" size={16} />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-500 flex items-center justify-center">
          <Medal className="text-white" size={16} />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center">
          <Medal className="text-white" size={16} />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 font-bold text-sm">
        {rank}
      </div>
    );
  };

  const handleAthleteClick = (entry: LeaderboardEntry) => {
    if (onAthleteClick && entry.player.username) {
      onAthleteClick(entry.player.username);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="text-yellow-400" size={20} />
            Leaderboard
          </h3>
        </div>
      )}

      {/* Toggle Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setLeaderboardType('kudos')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            leaderboardType === 'kudos'
              ? 'bg-yellow-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          <Star size={16} />
          Most Kudos
        </button>
        <button
          onClick={() => setLeaderboardType('followers')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            leaderboardType === 'followers'
              ? 'bg-purple-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          <Users size={16} />
          Most Followed
        </button>
      </div>

      {/* Leaderboard List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-8">
          <Trophy className="w-12 h-12 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">No athletes on the leaderboard yet</p>
          <p className="text-zinc-500 text-xs mt-1">
            {leaderboardType === 'kudos' 
              ? 'Give kudos to athletes to see them here!'
              : 'Follow athletes to see them here!'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, index) => (
            <div
              key={`${entry.teamId}_${entry.player.id}`}
              onClick={() => handleAthleteClick(entry)}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${
                index === 0 
                  ? 'bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/30 hover:border-yellow-500/50'
                  : index === 1
                  ? 'bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600'
                  : index === 2
                  ? 'bg-amber-900/10 border border-amber-700/30 hover:border-amber-700/50'
                  : 'bg-zinc-800/30 hover:bg-zinc-800/50'
              }`}
            >
              {/* Rank */}
              {getRankBadge(index + 1)}

              {/* Photo */}
              <div className={`w-10 h-10 rounded-full overflow-hidden ${
                index === 0 ? 'ring-2 ring-yellow-500' : ''
              }`}>
                {entry.player.photoUrl ? (
                  <img 
                    src={entry.player.photoUrl} 
                    alt={entry.player.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
                    <User className="text-zinc-500" size={20} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className={`font-medium truncate ${
                  index === 0 ? 'text-yellow-400' : 'text-white'
                }`}>
                  {entry.player.name}
                </h4>
                {entry.team && (
                  <p className="text-xs text-zinc-500 truncate">{entry.team.name}</p>
                )}
              </div>

              {/* Stats */}
              <div className="text-right">
                {leaderboardType === 'kudos' ? (
                  <div className="flex items-center gap-1">
                    <Star className="text-yellow-400" size={14} fill="currentColor" />
                    <span className={`font-bold ${index === 0 ? 'text-yellow-400' : 'text-white'}`}>
                      {entry.kudosCount}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Users className="text-purple-400" size={14} />
                    <span className={`font-bold ${index === 0 ? 'text-purple-400' : 'text-white'}`}>
                      {entry.followerCount}
                    </span>
                  </div>
                )}
              </div>

              {/* Arrow */}
              {entry.player.username && (
                <ExternalLink className="text-zinc-500" size={14} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KudosLeaderboard;
