/**
 * PlayerStatsDashboard - World-Class Individual Player Stats
 * 
 * Comprehensive stats view for athletes and parents:
 * - Performance trend charts
 * - Game-by-game breakdown with visualizations
 * - Category stat breakdowns
 * - Progress indicators (getting better/worse)
 * - Sport-specific stat rendering
 * 
 * Created: December 21, 2025
 */

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getStatSchema, getStatDefinition, getStatsByCategory, type StatDefinition } from '../../config/statSchemas';
import { GlassCard } from '../ui/OSYSComponents';
import type { Player } from '../../types';
import { 
  TrendingUp, TrendingDown, Minus, Trophy, Calendar, Target,
  BarChart3, ChevronDown, ChevronUp, Zap, Star, Award,
  ArrowUpRight, ArrowDownRight, Activity, Flame, Shield,
  Gamepad2, User, Medal
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Legend
} from 'recharts';

// Helper: Format date string without timezone issues
const formatEventDate = (dateStr: string, options?: Intl.DateTimeFormatOptions) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', options || { month: 'short', day: 'numeric' });
};

interface GameStat {
  gameId: string;
  week: number;
  opponent: string;
  date: string;
  isHome: boolean;
  result: 'W' | 'L' | 'T' | '';
  score: string;
  stats: Record<string, number>;
}

interface SeasonTotals {
  season: number;
  gamesPlayed: number;
  stats: Record<string, number>;
}

interface PlayerStatsDashboardProps {
  player: Player;
  teamName?: string;
}

const PlayerStatsDashboard: React.FC<PlayerStatsDashboardProps> = ({ player, teamName }) => {
  const { teamData } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // State
  const [gameStats, setGameStats] = useState<GameStat[]>([]);
  const [seasonTotals, setSeasonTotals] = useState<SeasonTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['trends']));
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [allSeasons, setAllSeasons] = useState<Array<{ id: string; name: string; year: number; status: string }>>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  
  // Get sport-specific stat schema
  const sport = teamData?.sport || 'football';
  const statSchema = useMemo(() => getStatSchema(sport), [sport]);
  
  // Key stats for this sport (leaderboard stats are the most important)
  const keyStats = useMemo(() => {
    return statSchema.leaderboardStats.slice(0, 4).map(key => getStatDefinition(sport, key)).filter(Boolean) as StatDefinition[];
  }, [statSchema, sport]);
  
  // Categories with their stats
  const categoriesWithStats = useMemo(() => {
    return statSchema.categories.map(cat => ({
      ...cat,
      stats: getStatsByCategory(sport, cat.key)
    })).filter(cat => cat.stats.length > 0);
  }, [statSchema, sport]);

  const programId = teamData?.programId;
  const teamId = teamData?.id;

  // Load all seasons for this program
  useEffect(() => {
    const loadSeasons = async () => {
      if (!programId) return;
      
      try {
        const seasonsRef = collection(db, 'programs', programId, 'seasons');
        const seasonsSnap = await getDocs(seasonsRef);
        const seasons = seasonsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || `${data.year || 'Unknown'} Season`,
            year: data.year || new Date().getFullYear(),
            status: data.status || 'active'
          };
        });
        
        // Sort by year descending (most recent first)
        seasons.sort((a, b) => b.year - a.year);
        setAllSeasons(seasons);
        
        // Find active season or default to first
        const activeSeason = seasons.find(s => s.status === 'active') ||
                             seasons.find(s => s.status !== 'completed') ||
                             seasons[0];
        
        if (activeSeason) {
          setActiveSeasonId(activeSeason.id);
          setSelectedSeasonId(activeSeason.id);
        }
      } catch (err) {
        console.error('Error loading seasons:', err);
      }
    };
    
    loadSeasons();
  }, [programId]);

  // Fetch player's game-by-game stats from v2.0 path
  useEffect(() => {
    const fetchStats = async () => {
      if (!player?.id || !programId || !selectedSeasonId || !teamId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        // Get all games where this team participated
        const gamesRef = collection(db, 'programs', programId, 'seasons', selectedSeasonId, 'games');
        const gamesSnap = await getDocs(gamesRef);
        
        const playerGameStats: GameStat[] = [];
        const totals: Record<string, number> = {};
        let gamesPlayed = 0;
        
        // Build player name for matching
        const playerName = player.firstName && player.lastName
          ? `${player.firstName} ${player.lastName}`
          : player.name || '';
        const playerNumber = player.number;
        
        for (const gameDoc of gamesSnap.docs) {
          const gameData = gameDoc.data();
          
          // Check if our team played
          const isHome = gameData.homeTeamId === teamId;
          const isAway = gameData.awayTeamId === teamId;
          if (!isHome && !isAway) continue;
          
          // Get ALL stats for this game to find player by multiple means
          const statsRef = collection(db, 'programs', programId, 'seasons', selectedSeasonId, 'games', gameDoc.id, 'stats');
          const allStatsSnap = await getDocs(statsRef);
          
          // Try to find player by multiple means:
          // 1. Direct playerId match
          // 2. Match by athleteId (roster player pointing to global player)
          // 3. Match by name + number
          let matchedStat = allStatsSnap.docs.find(d => {
            const data = d.data();
            // Direct ID match
            if (data.playerId === player.id) return true;
            // Athlete ID match (if roster doc has athleteId pointing to this player)
            if ((player as any).athleteId && data.playerId === (player as any).athleteId) return true;
            // Name + number match (fallback)
            if (playerName && data.playerName === playerName && data.playerNumber === playerNumber) return true;
            return false;
          });
          
          if (!matchedStat) continue;
          
          const statDoc = matchedStat.data();
          if (!statDoc.played) continue;
          
          gamesPlayed++;
          
          // Build game stat object
          const gameStat: GameStat = {
            gameId: gameDoc.id,
            week: gameData.week || 0,
            opponent: isHome ? gameData.awayTeamName : gameData.homeTeamName,
            date: gameData.weekDate || gameData.date || '',
            isHome,
            result: gameData.status === 'completed' 
              ? (isHome 
                ? (gameData.homeScore > gameData.awayScore ? 'W' : gameData.homeScore < gameData.awayScore ? 'L' : 'T')
                : (gameData.awayScore > gameData.homeScore ? 'W' : gameData.awayScore < gameData.homeScore ? 'L' : 'T'))
              : '',
            score: gameData.status === 'completed'
              ? `${isHome ? gameData.homeScore : gameData.awayScore}-${isHome ? gameData.awayScore : gameData.homeScore}`
              : '',
            stats: statDoc.stats || {}
          };
          
          playerGameStats.push(gameStat);
          
          // Accumulate totals
          Object.entries(statDoc.stats || {}).forEach(([key, value]) => {
            totals[key] = (totals[key] || 0) + (value as number || 0);
          });
        }
        
        // Sort by week
        playerGameStats.sort((a, b) => (a.week || 0) - (b.week || 0));
        
        setGameStats(playerGameStats);
        
        // Get selected season year
        const selectedSeason = allSeasons.find(s => s.id === selectedSeasonId);
        setSeasonTotals({
          season: selectedSeason?.year || new Date().getFullYear(),
          gamesPlayed,
          stats: totals
        });
      } catch (err) {
        console.error('Error fetching player stats:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, [player?.id, programId, selectedSeasonId, teamId]);

  // Calculate trend data for charts
  const trendData = useMemo(() => {
    return gameStats.map(g => ({
      name: `W${g.week}`,
      week: g.week,
      ...g.stats,
      totalYards: (g.stats.passYards || 0) + (g.stats.rushYards || 0) + (g.stats.receivingYards || 0),
      totalTDs: (g.stats.passTouchdowns || 0) + (g.stats.rushTouchdowns || 0) + (g.stats.receivingTouchdowns || 0)
    }));
  }, [gameStats]);

  // Calculate if player is improving (compare last 2 games for key stat)
  const getTrend = (statKey: string): 'up' | 'down' | 'same' => {
    if (gameStats.length < 2) return 'same';
    const last = gameStats[gameStats.length - 1]?.stats[statKey] || 0;
    const prev = gameStats[gameStats.length - 2]?.stats[statKey] || 0;
    if (last > prev) return 'up';
    if (last < prev) return 'down';
    return 'same';
  };

  // Calculate per-game average
  const getPerGameAvg = (statKey: string): number => {
    if (!seasonTotals || seasonTotals.gamesPlayed === 0) return 0;
    return Math.round((seasonTotals.stats[statKey] || 0) / seasonTotals.gamesPlayed * 10) / 10;
  };

  // Calculate season high
  const getSeasonHigh = (statKey: string): number => {
    if (gameStats.length === 0) return 0;
    return Math.max(...gameStats.map(g => g.stats[statKey] || 0));
  };

  // Radar chart data for overall performance
  const radarData = useMemo(() => {
    if (!seasonTotals) return [];
    
    // Get max values for normalization (or use reasonable defaults)
    const maxValues: Record<string, number> = {
      passYards: 3000,
      rushYards: 1500,
      receivingYards: 1500,
      passTouchdowns: 30,
      rushTouchdowns: 20,
      tackles: 100,
      sacks: 15,
      defensiveInterceptions: 10
    };
    
    return keyStats.map(stat => ({
      stat: stat.shortLabel,
      value: Math.min(100, Math.round(((seasonTotals.stats[stat.key] || 0) / (maxValues[stat.key] || 100)) * 100)),
      fullMark: 100
    }));
  }, [seasonTotals, keyStats]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton header */}
        <div className={`rounded-xl p-6 animate-pulse ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="h-6 w-32 bg-slate-300 dark:bg-slate-700 rounded" />
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          </div>
        </div>
        {/* Skeleton cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className={`rounded-xl p-4 animate-pulse ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
              <div className="h-8 w-16 bg-slate-300 dark:bg-slate-700 rounded mb-2" />
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ============ PLAYER HEADER ============ */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-4">
          {player.photoUrl ? (
            <img 
              src={player.photoUrl} 
              alt={player.name} 
              className="w-20 h-20 rounded-full object-cover border-4 border-white/30 shadow-lg" 
            />
          ) : (
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg">
              {player.name?.charAt(0) || '?'}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white">{player.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="bg-white/20 text-white text-sm px-3 py-1 rounded-lg font-bold">#{player.number}</span>
              <span className="bg-white/20 text-white text-sm px-3 py-1 rounded-lg">{player.position}</span>
            </div>
            {teamName && <p className="text-white/80 text-sm mt-2">{teamName}</p>}
          </div>
          {/* Season record badge */}
          {seasonTotals && (
            <div className="text-right hidden sm:block">
              <div className="text-3xl font-black text-white">{seasonTotals.gamesPlayed}</div>
              <div className="text-white/80 text-sm">Games Played</div>
            </div>
          )}
        </div>
      </div>

      {/* ============ SEASON SELECTOR ============ */}
      {allSeasons.length > 1 && (
        <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
          <Calendar className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Season:</span>
          <div className="flex gap-2 flex-wrap">
            {allSeasons.map(season => (
              <button
                key={season.id}
                onClick={() => setSelectedSeasonId(season.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  selectedSeasonId === season.id
                    ? 'bg-purple-600 text-white shadow-lg'
                    : isDark
                      ? 'bg-white/10 text-slate-300 hover:bg-white/20'
                      : 'bg-white text-slate-600 hover:bg-slate-200'
                }`}
              >
                {season.year}
                {season.status === 'active' && (
                  <span className="ml-1.5 text-[10px] uppercase opacity-75">Current</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============ NO STATS MESSAGE ============ */}
      {gameStats.length === 0 && !loading ? (
        <GlassCard className={isDark ? '' : 'bg-white border-slate-200'}>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className={`w-16 h-16 mb-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
            <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              No Stats Recorded Yet
            </h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Stats will appear here once recorded by a coach during games.
            </p>
          </div>
        </GlassCard>
      ) : (
        <>
          {/* ============ KEY STAT CARDS ============ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {keyStats.map((stat, idx) => {
              const value = seasonTotals?.stats[stat.key] || 0;
              const trend = getTrend(stat.key);
              const perGame = getPerGameAvg(stat.key);
              const seasonHigh = getSeasonHigh(stat.key);
              
              const colors = ['emerald', 'purple', 'cyan', 'amber'];
              const color = colors[idx % colors.length];
              
              return (
                <GlassCard 
                  key={stat.key} 
                  className={`${isDark ? '' : 'bg-white border-slate-200'} relative overflow-hidden`}
                >
                  {/* Background gradient accent */}
                  <div className={`absolute top-0 right-0 w-20 h-20 bg-${color}-500/10 rounded-bl-full`} />
                  
                  <div className="relative">
                    <div className="flex items-start justify-between mb-2">
                      <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {stat.shortLabel}
                      </span>
                      {trend === 'up' && (
                        <span className="flex items-center text-xs text-emerald-500">
                          <TrendingUp className="w-3 h-3 mr-0.5" /> Up
                        </span>
                      )}
                      {trend === 'down' && (
                        <span className="flex items-center text-xs text-red-500">
                          <TrendingDown className="w-3 h-3 mr-0.5" /> Down
                        </span>
                      )}
                    </div>
                    
                    <div className={`text-3xl font-black mb-1 text-${color}-500`}>
                      {value}
                    </div>
                    
                    <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      <span>{perGame}/game</span>
                      <span className="text-amber-500">⭐ {seasonHigh} high</span>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>

          {/* ============ PERFORMANCE TRENDS (Chart) ============ */}
          <GlassCard className={isDark ? '' : 'bg-white border-slate-200'}>
            <button
              onClick={() => toggleSection('trends')}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-500" />
                <h3 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  Performance Trends
                </h3>
              </div>
              {expandedSections.has('trends') ? (
                <ChevronUp className="w-5 h-5 text-slate-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500" />
              )}
            </button>
            
            {expandedSections.has('trends') && trendData.length > 0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorYards" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorTDs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                    <XAxis 
                      dataKey="name" 
                      stroke={isDark ? '#9ca3af' : '#6b7280'} 
                      fontSize={12}
                    />
                    <YAxis 
                      stroke={isDark ? '#9ca3af' : '#6b7280'} 
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: isDark ? '#1f2937' : '#fff',
                        border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                        borderRadius: '8px',
                        color: isDark ? '#fff' : '#000'
                      }}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="totalYards" 
                      name="Total Yards"
                      stroke="#8b5cf6" 
                      fillOpacity={1}
                      fill="url(#colorYards)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="totalTDs" 
                      name="TDs"
                      stroke="#f59e0b" 
                      fillOpacity={1}
                      fill="url(#colorTDs)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>

          {/* ============ GAME-BY-GAME BREAKDOWN ============ */}
          <GlassCard className={isDark ? '' : 'bg-white border-slate-200'}>
            <button
              onClick={() => toggleSection('games')}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-emerald-500" />
                <h3 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  Game-by-Game Breakdown
                </h3>
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  ({gameStats.length} games)
                </span>
              </div>
              {expandedSections.has('games') ? (
                <ChevronUp className="w-5 h-5 text-slate-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500" />
              )}
            </button>
            
            {expandedSections.has('games') && (
              <div className="space-y-3">
                {gameStats.map((game, idx) => {
                  const resultColor = game.result === 'W' 
                    ? 'bg-emerald-500' 
                    : game.result === 'L' 
                      ? 'bg-red-500' 
                      : 'bg-amber-500';
                  
                  // Get top stats for this game
                  const topGameStats = keyStats
                    .map(s => ({ key: s.key, label: s.shortLabel, value: game.stats[s.key] || 0 }))
                    .filter(s => s.value > 0)
                    .slice(0, 4);
                  
                  // Calculate yards bar width
                  const totalYards = (game.stats.passYards || 0) + (game.stats.rushYards || 0) + (game.stats.receivingYards || 0);
                  const maxYards = Math.max(...gameStats.map(g => 
                    (g.stats.passYards || 0) + (g.stats.rushYards || 0) + (g.stats.receivingYards || 0)
                  ), 1);
                  const barWidth = (totalYards / maxYards) * 100;
                  
                  return (
                    <div 
                      key={game.gameId}
                      className={`rounded-lg p-4 border ${
                        isDark 
                          ? 'bg-white/5 border-white/10' 
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {/* Header Row */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`${resultColor} text-white text-xs font-bold px-2 py-0.5 rounded`}>
                            {game.result || '-'}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                          }`}>
                            W{game.week}
                          </span>
                          <span className={`font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                            {game.isHome ? 'vs' : '@'} {game.opponent}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {game.score && (
                            <span className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                              {game.score}
                            </span>
                          )}
                          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                            {formatEventDate(game.date)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Yards Progress Bar */}
                      {totalYards > 0 && (
                        <div className="mb-3">
                          <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                            <div 
                              className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {totalYards} total yards
                          </div>
                        </div>
                      )}
                      
                      {/* Stats Pills */}
                      <div className="flex flex-wrap gap-2">
                        {topGameStats.map(stat => (
                          <span 
                            key={stat.key}
                            className={`text-xs px-2 py-1 rounded ${
                              isDark 
                                ? 'bg-white/10 text-slate-300' 
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            <strong>{stat.value}</strong> {stat.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* ============ STAT CATEGORIES BREAKDOWN ============ */}
          <GlassCard className={isDark ? '' : 'bg-white border-slate-200'}>
            <button
              onClick={() => toggleSection('categories')}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan-500" />
                <h3 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  Stat Categories
                </h3>
              </div>
              {expandedSections.has('categories') ? (
                <ChevronUp className="w-5 h-5 text-slate-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500" />
              )}
            </button>
            
            {expandedSections.has('categories') && (
              <div className="space-y-4">
                {categoriesWithStats.map(category => {
                  // Only show categories where player has stats
                  const hasStats = category.stats.some(s => (seasonTotals?.stats[s.key] || 0) > 0);
                  if (!hasStats) return null;
                  
                  return (
                    <div key={category.key}>
                      <h4 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        {category.label}
                      </h4>
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {category.stats.map(stat => {
                          const value = seasonTotals?.stats[stat.key] || 0;
                          if (value === 0) return null;
                          
                          return (
                            <div 
                              key={stat.key}
                              className={`p-2 rounded-lg text-center ${
                                isDark 
                                  ? 'bg-white/5 border border-white/10' 
                                  : 'bg-slate-100 border border-slate-200'
                              }`}
                            >
                              <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                {value}
                              </div>
                              <div className={`text-[10px] uppercase tracking-wider ${
                                isDark ? 'text-slate-500' : 'text-slate-500'
                              }`}>
                                {stat.shortLabel}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* ============ SEASON SUMMARY ============ */}
          {seasonTotals && (
            <GlassCard className={isDark ? '' : 'bg-white border-slate-200'}>
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h3 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {seasonTotals.season} Season Summary
                </h3>
              </div>
              
              <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className={`text-3xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      {seasonTotals.gamesPlayed}
                    </div>
                    <div className={`text-xs uppercase ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      Games
                    </div>
                  </div>
                  {keyStats.slice(0, 3).map((stat, idx) => {
                    const colors = ['text-purple-500', 'text-cyan-500', 'text-emerald-500'];
                    return (
                      <div key={stat.key}>
                        <div className={`text-3xl font-black ${colors[idx]}`}>
                          {seasonTotals.stats[stat.key] || 0}
                        </div>
                        <div className={`text-xs uppercase ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          {stat.shortLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
};

export default PlayerStatsDashboard;
