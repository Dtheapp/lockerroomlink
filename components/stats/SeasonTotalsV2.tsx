/**
 * Stats Engine v2.0 - Season Totals Component
 * 
 * Displays aggregated season stats for each player.
 * Reads from: programs/{programId}/seasons/{seasonId}/games/{gameId}/stats/{playerId}
 * Aggregates all games to show player season totals.
 * 
 * Created: December 21, 2025
 */

import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { getStatSchema, getStatsByCategory, type StatDefinition, type StatCategory } from '../../config/statSchemas';
import { 
  Trophy, Users, TrendingUp, Search, ChevronDown, ChevronUp, 
  Loader2, Target, Zap, Shield, User
} from 'lucide-react';
import { GlassCard } from '../ui/OSYSComponents';
import StatsDashboard from './StatsDashboard';
import type { SportType, GameStatV2, Player } from '../../types';

interface PlayerSeasonTotals {
  playerId: string;
  playerName: string;
  playerNumber: number;
  position?: string;
  gamesPlayed: number;
  stats: Record<string, number>;
  avatarUrl?: string;
}

const SeasonTotalsV2: React.FC = () => {
  const { teamData } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerTotals, setPlayerTotals] = useState<PlayerSeasonTotals[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('gamesPlayed');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  const programId = teamData?.programId;
  const teamId = teamData?.id;
  const sport = (teamData?.sport || 'football') as SportType;
  
  const schema = useMemo(() => getStatSchema(sport), [sport]);
  const categories = schema.categories;
  const statsByCategory = useMemo(() => {
    const map = new Map<string, StatDefinition[]>();
    categories.forEach(cat => {
      map.set(cat.key, getStatsByCategory(sport, cat.key));
    });
    return map;
  }, [sport, categories]);
  
  // Find active season
  useEffect(() => {
    const findActiveSeason = async () => {
      if (!programId) return;
      
      try {
        const seasonsRef = collection(db, 'programs', programId, 'seasons');
        const seasonsSnap = await getDocs(seasonsRef);
        const seasons = seasonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const activeSeason = seasons.find((s: any) => s.status === 'active') ||
                             seasons.find((s: any) => s.status !== 'completed') ||
                             seasons[0];
        
        if (activeSeason) {
          setActiveSeasonId(activeSeason.id);
        }
      } catch (err) {
        console.error('Error finding active season:', err);
      }
    };
    
    findActiveSeason();
  }, [programId]);
  
  // Load players
  useEffect(() => {
    if (!teamId) return;
    
    const loadPlayers = async () => {
      try {
        const playersRef = collection(db, 'teams', teamId, 'players');
        const playersSnap = await getDocs(playersRef);
        const playersData = playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
        setPlayers(playersData);
      } catch (err) {
        console.error('Error loading players:', err);
      }
    };
    
    loadPlayers();
  }, [teamId]);
  
  // Load all game stats and aggregate by player
  useEffect(() => {
    const loadSeasonStats = async () => {
      if (!programId || !activeSeasonId || !teamId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Get all games for this season
        const gamesRef = collection(db, 'programs', programId, 'seasons', activeSeasonId, 'games');
        const gamesSnap = await getDocs(gamesRef);
        
        // Aggregate stats per player
        const playerStatsMap = new Map<string, PlayerSeasonTotals>();
        
        for (const gameDoc of gamesSnap.docs) {
          const gameId = gameDoc.id;
          
          // Get stats for this game
          const statsRef = collection(db, 'programs', programId, 'seasons', activeSeasonId, 'games', gameId, 'stats');
          const statsQuery = query(statsRef, where('teamId', '==', teamId));
          const statsSnap = await getDocs(statsQuery);
          
          statsSnap.docs.forEach(statDoc => {
            const stat = statDoc.data() as GameStatV2;
            
            if (!stat.played) return;
            
            const existing = playerStatsMap.get(stat.playerId);
            
            if (existing) {
              existing.gamesPlayed++;
              // Add all stats
              Object.entries(stat.stats).forEach(([key, value]) => {
                existing.stats[key] = (existing.stats[key] || 0) + (value || 0);
              });
            } else {
              // Find player info from roster
              const player = players.find(p => p.id === stat.playerId);
              
              playerStatsMap.set(stat.playerId, {
                playerId: stat.playerId,
                playerName: stat.playerName || player?.name || 
                  (player?.firstName && player?.lastName ? `${player.firstName} ${player.lastName}` : 'Unknown'),
                playerNumber: stat.playerNumber || player?.number || 0,
                position: player?.position,
                gamesPlayed: 1,
                stats: { ...stat.stats },
                avatarUrl: (player as any)?.avatarUrl
              });
            }
          });
        }
        
        setPlayerTotals(Array.from(playerStatsMap.values()));
      } catch (err) {
        console.error('Error loading season stats:', err);
        setError('Failed to load season stats');
      } finally {
        setLoading(false);
      }
    };
    
    if (players.length > 0) {
      loadSeasonStats();
    }
  }, [programId, activeSeasonId, teamId, players]);
  
  // Filter and sort players
  const filteredPlayers = useMemo(() => {
    let result = [...playerTotals];
    
    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.playerName.toLowerCase().includes(q) ||
        p.playerNumber.toString().includes(q) ||
        p.position?.toLowerCase().includes(q)
      );
    }
    
    // Sort
    result.sort((a, b) => {
      let aVal = sortBy === 'gamesPlayed' ? a.gamesPlayed : (a.stats[sortBy] || 0);
      let bVal = sortBy === 'gamesPlayed' ? b.gamesPlayed : (b.stats[sortBy] || 0);
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
    
    return result;
  }, [playerTotals, searchQuery, sortBy, sortDir]);
  
  // Get top stat for quick display
  const getTopStats = (stats: Record<string, number>): Array<{ key: string; abbrev: string; value: number }> => {
    const result: Array<{ key: string; abbrev: string; value: number }> = [];
    
    statsByCategory.forEach((statDefs) => {
      statDefs.forEach(statDef => {
        const value = stats[statDef.key] || 0;
        if (value > 0) {
          result.push({ key: statDef.key, abbrev: statDef.abbrev, value });
        }
      });
    });
    
    // Return top 4 stats by value
    return result.sort((a, b) => b.value - a.value).slice(0, 4);
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }
  
  // No season
  if (!activeSeasonId) {
    return (
      <GlassCard className={isDark ? '' : 'bg-white border-slate-200'}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className={`w-12 h-12 mb-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
          <p className={`text-lg font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            No Active Season
          </p>
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Season stats will appear once games are played
          </p>
        </div>
      </GlassCard>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Performance Analytics Dashboard */}
      <StatsDashboard />
      
      {/* Player Season Stats */}
      <div className="space-y-4">
        {/* Header with Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Player Stats
            </h2>
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              • {playerTotals.length} player{playerTotals.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-10 pr-4 py-2 rounded-lg text-sm w-full sm:w-64 ${
              isDark 
                ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
            } border focus:ring-2 focus:ring-purple-500 outline-none`}
          />
        </div>
      </div>
      
      {/* No Stats State */}
      {filteredPlayers.length === 0 ? (
        <GlassCard className={isDark ? '' : 'bg-white border-slate-200'}>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className={`w-12 h-12 mb-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
            <p className={`text-lg font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {searchQuery ? 'No Players Found' : 'No Stats Recorded Yet'}
            </p>
            <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              {searchQuery ? 'Try a different search term' : 'Enter game stats to see season totals'}
            </p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {filteredPlayers.map((player, index) => {
            const isExpanded = expandedPlayerId === player.playerId;
            const topStats = getTopStats(player.stats);
            
            return (
              <div
                key={player.playerId}
                className={`rounded-xl overflow-hidden transition-all ${
                  isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-white border border-slate-200 shadow-sm'
                }`}
              >
                {/* Player Row */}
                <button
                  onClick={() => setExpandedPlayerId(isExpanded ? null : player.playerId)}
                  className={`w-full p-4 flex items-center gap-4 text-left ${
                    isDark ? 'hover:bg-zinc-700/30' : 'hover:bg-slate-50'
                  } transition`}
                >
                  {/* Rank Badge */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    index === 0 ? 'bg-amber-500/20 text-amber-400' :
                    index === 1 ? 'bg-slate-400/20 text-slate-300' :
                    index === 2 ? 'bg-orange-600/20 text-orange-400' :
                    isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {index + 1}
                  </div>
                  
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                  }`}>
                    {player.avatarUrl ? (
                      <img src={player.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      player.playerName.charAt(0).toUpperCase()
                    )}
                  </div>
                  
                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        {player.playerName}
                      </span>
                      {player.position && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {player.position}
                        </span>
                      )}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                      #{player.playerNumber} • {player.gamesPlayed} game{player.gamesPlayed !== 1 ? 's' : ''}
                    </div>
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="hidden sm:flex items-center gap-3">
                    {topStats.slice(0, 2).map(stat => (
                      <div key={stat.key} className="text-center">
                        <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                          {stat.value}
                        </div>
                        <div className={`text-[9px] uppercase ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                          {stat.abbrev}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Expand Icon */}
                  <div className={isDark ? 'text-zinc-400' : 'text-slate-400'}>
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>
                
                {/* Expanded Stats */}
                {isExpanded && (
                  <div className={`p-4 ${isDark ? 'border-t border-zinc-700 bg-zinc-900/50' : 'border-t border-slate-200 bg-slate-50'}`}>
                    <div className="space-y-3">
                      {categories.map(cat => {
                        const catStats = statsByCategory.get(cat.key) || [];
                        const statsWithValues = catStats.filter(s => (player.stats[s.key] || 0) > 0);
                        
                        if (statsWithValues.length === 0) return null;
                        
                        return (
                          <div key={cat.key}>
                            <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${
                              isDark ? 'text-purple-400' : 'text-purple-600'
                            }`}>
                              {cat.label}
                            </h4>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                              {statsWithValues.map(statDef => (
                                <div 
                                  key={statDef.key}
                                  className={`p-2 rounded-lg text-center ${
                                    isDark ? 'bg-black/30' : 'bg-white'
                                  }`}
                                >
                                  <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                    {player.stats[statDef.key]?.toLocaleString() || 0}
                                  </div>
                                  <div className={`text-[9px] uppercase tracking-wider ${
                                    isDark ? 'text-slate-500' : 'text-slate-500'
                                  }`}>
                                    {statDef.abbrev}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};

export default SeasonTotalsV2;
