/**
 * Stats Engine v2.0 - Team Stats Summary
 * 
 * Displays aggregated team stats (all players combined).
 * Shows totals, per-game averages, and category breakdowns.
 * 
 * Created: December 21, 2025
 */

import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { getStatSchema, getStatDefinition, formatStatValue } from '../../config/statSchemas';
import { Trophy, Users, TrendingUp, Target, Shield, Zap, ChevronDown, ChevronUp, Loader2, Gamepad2, User, X, Calendar, Award } from 'lucide-react';
import { GlassCard } from '../ui/OSYSComponents';
import type { SportType, GameStatV2, Player } from '../../types';

interface TeamStatsSummaryProps {
  programId?: string;
  seasonId?: string;
  teamId?: string;
  sport?: SportType;
  className?: string;
  embedded?: boolean; // If true, hide outer card and header (for embedding in parent section)
}

interface CategoryStats {
  category: string;
  stats: { key: string; label: string; total: number; perGame: number }[];
}

// Drill-down breakdown data
interface StatBreakdown {
  statKey: string;
  statLabel: string;
  total: number;
  byGame: { gameId: string; opponent: string; date: string; value: number }[];
  byPlayer: { playerId: string; playerName: string; jerseyNumber: string; position: string; value: number }[];
}

interface GameInfo {
  id: string;
  opponent: string;
  date: any;
}

const TeamStatsSummary: React.FC<TeamStatsSummaryProps> = ({
  programId: propProgramId,
  seasonId: propSeasonId,
  teamId: propTeamId,
  sport: propSport,
  className = '',
  embedded = false,
}) => {
  const { theme } = useTheme();
  const { teamData } = useAuth();
  const isDark = theme === 'dark';
  
  // Use props or fall back to context
  const programId = propProgramId || teamData?.programId;
  const teamId = propTeamId || teamData?.id;
  const sport = propSport || teamData?.sport || 'football';
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allGameStats, setAllGameStats] = useState<GameStatV2[]>([]);
  const [gameInfoMap, setGameInfoMap] = useState<Map<string, GameInfo>>(new Map());
  const [playerInfoMap, setPlayerInfoMap] = useState<Map<string, Player>>(new Map());
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(propSeasonId || teamData?.currentSeasonId || null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Passing', 'Rushing', 'Defense']));
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSectionExpanded, setIsSectionExpanded] = useState(true); // For embedded mode collapse
  
  // Drill-down state
  const [selectedStat, setSelectedStat] = useState<StatBreakdown | null>(null);
  const [breakdownView, setBreakdownView] = useState<'game' | 'player'>('player');
  
  // Find active season if not provided
  useEffect(() => {
    const findActiveSeason = async () => {
      if (!programId) return;
      if (propSeasonId || teamData?.currentSeasonId) {
        setActiveSeasonId(propSeasonId || teamData?.currentSeasonId || null);
        return;
      }
      
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
  }, [programId, propSeasonId, teamData?.currentSeasonId]);
  
  // Fetch all game stats for this team's players
  useEffect(() => {
    const fetchTeamStats = async () => {
      if (!programId || !activeSeasonId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Get all games in this season
        const gamesRef = collection(db, 'programs', programId, 'seasons', activeSeasonId, 'games');
        const gamesSnap = await getDocs(gamesRef);
        
        const allStats: GameStatV2[] = [];
        const gameInfos = new Map<string, GameInfo>();
        const playerIds = new Set<string>();
        
        // For each game, get all player stats
        for (const gameDoc of gamesSnap.docs) {
          const gameData = gameDoc.data();
          gameInfos.set(gameDoc.id, {
            id: gameDoc.id,
            opponent: gameData.opponent || gameData.awayTeam || 'Unknown',
            date: gameData.date || gameData.scheduledAt,
          });
          
          const statsRef = collection(db, 'programs', programId, 'seasons', activeSeasonId, 'games', gameDoc.id, 'stats');
          
          // If teamId specified, filter by it
          let statsQuery;
          if (teamId) {
            statsQuery = query(statsRef, where('teamId', '==', teamId));
          } else {
            statsQuery = statsRef;
          }
          
          const statsSnap = await getDocs(statsQuery);
          
          for (const statDoc of statsSnap.docs) {
            const data = statDoc.data() as GameStatV2;
            if (data.played) {
              allStats.push(data);
              playerIds.add(data.playerId);
            }
          }
        }
        
        // Fetch player info
        const playerInfos = new Map<string, Player>();
        if (teamId) {
          const playersRef = collection(db, 'teams', teamId, 'players');
          const playersSnap = await getDocs(playersRef);
          playersSnap.forEach(doc => {
            playerInfos.set(doc.id, { id: doc.id, ...doc.data() } as Player);
          });
        }
        
        setGameInfoMap(gameInfos);
        setPlayerInfoMap(playerInfos);
        setAllGameStats(allStats);
      } catch (err) {
        console.error('Error fetching team stats:', err);
        setError('Failed to load team stats');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTeamStats();
  }, [programId, activeSeasonId, teamId]);
  
  // Aggregate stats by category
  const { teamTotals, gamesPlayed, categoryStats } = useMemo(() => {
    const totals: Record<string, number> = {};
    const gameIds = new Set<string>();
    
    // Sum all stats
    allGameStats.forEach(gameStat => {
      gameIds.add(gameStat.gameId);
      
      if (gameStat.stats && typeof gameStat.stats === 'object') {
        Object.entries(gameStat.stats).forEach(([key, value]) => {
          if (typeof value === 'number') {
            totals[key] = (totals[key] || 0) + value;
          }
        });
      }
    });
    
    const gamesCount = gameIds.size;
    
    // Organize by category
    const schema = getStatSchema(sport);
    const categories: CategoryStats[] = [];
    
    if (schema && schema.categories && schema.stats) {
      // Group stats by category
      const statsByCategory: Record<string, typeof schema.stats> = {};
      
      schema.stats.forEach(statDef => {
        if (!statDef || !statDef.category) return;
        const catKey = statDef.category.key;
        if (!statsByCategory[catKey]) {
          statsByCategory[catKey] = [];
        }
        statsByCategory[catKey].push(statDef);
      });
      
      // Build category stats in order
      schema.categories.forEach(cat => {
        const catStats = statsByCategory[cat.key] || [];
        const displayStats: { key: string; label: string; total: number; perGame: number }[] = [];
        
        catStats.forEach(statDef => {
          if (!statDef) return;
          const total = totals[statDef.key] || 0;
          // Show stats with values > 0
          if (total > 0) {
            displayStats.push({
              key: statDef.key,
              label: statDef.shortLabel || statDef.label,
              total,
              perGame: gamesCount > 0 ? Math.round((total / gamesCount) * 10) / 10 : 0,
            });
          }
        });
        
        if (displayStats.length > 0) {
          categories.push({
            category: cat.label,
            stats: displayStats,
          });
        }
      });
    }
    
    return { teamTotals: totals, gamesPlayed: gamesCount, categoryStats: categories };
  }, [allGameStats, sport]);
  
  // Top stats for quick view
  const topStats = useMemo(() => {
    if (sport === 'football') {
      return [
        { label: 'Total TDs', value: (teamTotals.passTouchdowns || 0) + (teamTotals.rushTouchdowns || 0) + (teamTotals.receivingTouchdowns || 0), icon: Trophy, color: 'text-amber-500' },
        { label: 'Pass Yards', value: teamTotals.passYards || 0, icon: Target, color: 'text-purple-500' },
        { label: 'Rush Yards', value: teamTotals.rushYards || 0, icon: Zap, color: 'text-emerald-500' },
        { label: 'Tackles', value: teamTotals.tackles || 0, icon: Shield, color: 'text-cyan-500' },
      ];
    } else if (sport === 'basketball') {
      return [
        { label: 'Points', value: teamTotals.points || 0, icon: Trophy, color: 'text-amber-500' },
        { label: 'Rebounds', value: teamTotals.totalRebounds || 0, icon: Target, color: 'text-purple-500' },
        { label: 'Assists', value: teamTotals.assists || 0, icon: Zap, color: 'text-emerald-500' },
        { label: 'Steals', value: teamTotals.steals || 0, icon: Shield, color: 'text-cyan-500' },
      ];
    } else if (sport === 'soccer') {
      return [
        { label: 'Goals', value: teamTotals.goals || 0, icon: Trophy, color: 'text-amber-500' },
        { label: 'Assists', value: teamTotals.assists || 0, icon: Target, color: 'text-purple-500' },
        { label: 'Shots', value: teamTotals.shots || 0, icon: Zap, color: 'text-emerald-500' },
        { label: 'Saves', value: teamTotals.saves || 0, icon: Shield, color: 'text-cyan-500' },
      ];
    }
    // Default
    return [
      { label: 'Games', value: gamesPlayed, icon: Trophy, color: 'text-amber-500' },
    ];
  }, [sport, teamTotals, gamesPlayed]);
  
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };
  
  // Generate breakdown when clicking a stat
  const handleStatClick = (statKey: string, statLabel: string) => {
    // Aggregate by game
    const byGameMap = new Map<string, number>();
    const byPlayerMap = new Map<string, number>();
    let total = 0;
    
    allGameStats.forEach(gameStat => {
      const value = gameStat.stats?.[statKey] || 0;
      if (value > 0) {
        total += value;
        
        // By game
        const existing = byGameMap.get(gameStat.gameId) || 0;
        byGameMap.set(gameStat.gameId, existing + value);
        
        // By player
        const playerExisting = byPlayerMap.get(gameStat.playerId) || 0;
        byPlayerMap.set(gameStat.playerId, playerExisting + value);
      }
    });
    
    // Convert to sorted arrays
    const byGame = Array.from(byGameMap.entries())
      .map(([gameId, value]) => {
        const gameInfo = gameInfoMap.get(gameId);
        const dateVal = gameInfo?.date;
        let dateStr = '';
        if (dateVal?.toDate) {
          dateStr = dateVal.toDate().toLocaleDateString();
        } else if (dateVal?.seconds) {
          dateStr = new Date(dateVal.seconds * 1000).toLocaleDateString();
        } else if (typeof dateVal === 'string') {
          dateStr = dateVal;
        }
        return {
          gameId,
          opponent: gameInfo?.opponent || 'Unknown',
          date: dateStr,
          value,
        };
      })
      .sort((a, b) => b.value - a.value);
    
    const byPlayer = Array.from(byPlayerMap.entries())
      .map(([playerId, value]) => {
        const playerInfo = playerInfoMap.get(playerId);
        return {
          playerId,
          playerName: playerInfo?.firstName && playerInfo?.lastName 
            ? `${playerInfo.firstName} ${playerInfo.lastName}`
            : playerInfo?.name || 'Unknown',
          jerseyNumber: String(playerInfo?.number || '-'),
          position: playerInfo?.position || '-',
          value,
        };
      })
      .sort((a, b) => b.value - a.value);
    
    setSelectedStat({
      statKey,
      statLabel,
      total,
      byGame,
      byPlayer,
    });
    setBreakdownView('player');
  };
  
  // Loading state
  if (loading) {
    return (
      <GlassCard className={`${className} ${isDark ? '' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      </GlassCard>
    );
  }
  
  // No data state
  if (!programId || !activeSeasonId) {
    return (
      <GlassCard className={`${className} ${isDark ? '' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Users className={`w-12 h-12 mb-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
          <p className={`text-lg font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            No Season Selected
          </p>
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Team stats will appear once a season is active
          </p>
        </div>
      </GlassCard>
    );
  }
  
  if (allGameStats.length === 0) {
    return (
      <GlassCard className={`${className} ${isDark ? '' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <TrendingUp className={`w-12 h-12 mb-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
          <p className={`text-lg font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            No Stats Yet
          </p>
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Enter game stats to see team totals
          </p>
        </div>
      </GlassCard>
    );
  }
  
  // Content to render (shared between embedded and standalone modes)
  const content = (
    <>
      {/* Header - Only show if not embedded */}
      {!embedded && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition"
        >
          <div className="text-left">
            <h2 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              <Users className="w-6 h-6 text-purple-500" />
              Team Stats
            </h2>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Combined totals from all players
            </p>
          </div>
          <div className={isDark ? 'text-slate-400' : 'text-slate-500'}>
            {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </div>
        </button>
      )}
      
      {/* Section Title for embedded mode - COLLAPSIBLE */}
      {embedded && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            <h3 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Stat Breakdown by Category
            </h3>
          </div>
          <button
            onClick={() => setIsSectionExpanded(!isSectionExpanded)}
            className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'} transition`}
          >
            {isSectionExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      )}
      
      {(!isCollapsed || embedded) && isSectionExpanded && (
        <>
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {topStats.map((stat, i) => (
              <div 
                key={i}
                className={`p-4 rounded-xl text-center ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}
              >
                <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {stat.value.toLocaleString()}
                </div>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
      
          {/* Category Breakdown */}
          <div className="space-y-2">
            {categoryStats.map(({ category, stats }) => (
              <div key={category} className={`rounded-lg overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className={`w-full flex items-center justify-between p-3 font-bold text-sm ${
                    isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-100'
                  } transition`}
                >
                  <span>{category}</span>
                  {expandedCategories.has(category) ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
            
                {/* Category Stats */}
                {expandedCategories.has(category) && (
                  <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-3 pt-0`}>
                    {stats.map(stat => (
                      <button 
                        key={stat.key}
                        onClick={() => handleStatClick(stat.key, stat.label)}
                        className={`p-2 rounded-lg text-center transition-all hover:scale-105 cursor-pointer group ${
                          isDark 
                            ? 'bg-black/20 hover:bg-purple-500/20 hover:ring-1 hover:ring-purple-500/50' 
                            : 'bg-white hover:bg-purple-50 hover:ring-1 hover:ring-purple-300'
                        }`}
                      >
                        <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                          {stat.total.toLocaleString()}
                        </div>
                        <div className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          {stat.label}
                        </div>
                        <div className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                          {stat.perGame} avg
                        </div>
                        <div className={`text-[9px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-purple-400' : 'text-purple-500'}`}>
                          Tap for breakdown
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      
      {/* ========== BREAKDOWN MODAL ========== */}
      {selectedStat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-lg max-h-[80vh] overflow-hidden rounded-2xl shadow-2xl ${
            isDark ? 'bg-zinc-900 border border-white/10' : 'bg-white border border-slate-200'
          }`}>
            {/* Modal Header */}
            <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div>
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {selectedStat.statLabel} Breakdown
                </h3>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Total: <span className="text-purple-500 font-bold">{selectedStat.total.toLocaleString()}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedStat(null)}
                className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* View Toggle */}
            <div className={`p-3 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className={`p-1 rounded-xl inline-flex ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                <button
                  onClick={() => setBreakdownView('player')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                    breakdownView === 'player'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : isDark 
                        ? 'text-slate-400 hover:text-white hover:bg-white/5' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <User className="w-4 h-4" />
                  By Player
                </button>
                <button
                  onClick={() => setBreakdownView('game')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                    breakdownView === 'game'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : isDark 
                        ? 'text-slate-400 hover:text-white hover:bg-white/5' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <Gamepad2 className="w-4 h-4" />
                  By Game
                </button>
              </div>
            </div>
            
            {/* Breakdown Content */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {/* BY PLAYER VIEW */}
              {breakdownView === 'player' && (
                <div className="space-y-2">
                  {selectedStat.byPlayer.length === 0 ? (
                    <p className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      No player data available
                    </p>
                  ) : (
                    selectedStat.byPlayer.map((player, idx) => (
                      <div 
                        key={player.playerId}
                        className={`flex items-center gap-3 p-3 rounded-xl ${
                          isDark ? 'bg-white/5' : 'bg-slate-50'
                        }`}
                      >
                        {/* Rank */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          idx === 0 
                            ? 'bg-amber-500/20 text-amber-500'
                            : idx === 1
                              ? 'bg-slate-400/20 text-slate-400'
                              : idx === 2
                                ? 'bg-orange-500/20 text-orange-500'
                                : isDark ? 'bg-white/5 text-slate-500' : 'bg-slate-200 text-slate-500'
                        }`}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                        </div>
                        
                        {/* Player Info */}
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                            {player.playerName}
                          </div>
                          <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            #{player.jerseyNumber} • {player.position}
                          </div>
                        </div>
                        
                        {/* Value */}
                        <div className="text-right">
                          <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                            {player.value.toLocaleString()}
                          </div>
                          <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                            {((player.value / selectedStat.total) * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              
              {/* BY GAME VIEW */}
              {breakdownView === 'game' && (
                <div className="space-y-2">
                  {selectedStat.byGame.length === 0 ? (
                    <p className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      No game data available
                    </p>
                  ) : (
                    selectedStat.byGame.map((game, idx) => (
                      <div 
                        key={game.gameId}
                        className={`flex items-center gap-3 p-3 rounded-xl ${
                          isDark ? 'bg-white/5' : 'bg-slate-50'
                        }`}
                      >
                        {/* Game Icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isDark ? 'bg-purple-500/20' : 'bg-purple-100'
                        }`}>
                          <Gamepad2 className="w-5 h-5 text-purple-500" />
                        </div>
                        
                        {/* Game Info */}
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                            vs {game.opponent}
                          </div>
                          <div className={`text-xs flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            <Calendar className="w-3 h-3" />
                            {game.date || 'Date TBD'}
                          </div>
                        </div>
                        
                        {/* Value */}
                        <div className="text-right">
                          <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                            {game.value.toLocaleString()}
                          </div>
                          <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                            {((game.value / selectedStat.total) * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className={`p-4 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <button
                onClick={() => setSelectedStat(null)}
                className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
  
  // Return wrapped or unwrapped based on embedded mode
  if (embedded) {
    return <div className={className}>{content}</div>;
  }
  
  return (
    <GlassCard className={`${className} ${isDark ? '' : 'bg-white border-slate-200'}`}>
      {content}
    </GlassCard>
  );
};

export default TeamStatsSummary;
