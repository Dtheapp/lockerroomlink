/**
 * Stats Engine v2.0 - Stats Dashboard with Visualizations
 * 
 * World-class stats visualization dashboard combining charts,
 * trends, leaderboards, and detailed breakdowns.
 * 
 * Created: December 21, 2025
 */

import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { getStatSchema, getStatsByCategory, type StatDefinition } from '../../config/statSchemas';
import { 
  PerformanceTrendChart, 
  PlayerRadarChart, 
  LeaderboardChart,
  StatHighlightCard,
  GamePerformanceBars,
  Sparkline
} from './StatsCharts';
import { GlassCard } from '../ui/OSYSComponents';
import { 
  Trophy, TrendingUp, Target, Zap, Shield, Users, 
  BarChart3, Activity, Award, ChevronDown, ChevronUp,
  Loader2, Calendar
} from 'lucide-react';
import type { SportType, GameStatV2, Game } from '../../types';

interface PlayerTotals {
  playerId: string;
  playerName: string;
  playerNumber: number;
  position?: string;
  gamesPlayed: number;
  stats: Record<string, number>;
  gameByGame: Array<{ game: string; opponent: string; stats: Record<string, number> }>;
}

const StatsDashboard: React.FC = () => {
  const { teamData } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [loading, setLoading] = useState(true);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [playerTotals, setPlayerTotals] = useState<PlayerTotals[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [teamGameStats, setTeamGameStats] = useState<Array<{
    gameId: string;
    game: string;
    opponent: string;
    date: string;
    result: 'W' | 'L' | 'T';
    score: string;
    stats: Record<string, number>;
  }>>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  
  const programId = teamData?.programId;
  const teamId = teamData?.id;
  const sport = (teamData?.sport || 'football') as SportType;
  
  const schema = useMemo(() => getStatSchema(sport), [sport]);
  
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
  
  // Load games and stats
  useEffect(() => {
    const loadData = async () => {
      if (!programId || !activeSeasonId || !teamId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      
      try {
        // Load games - filter by team participation
        const gamesRef = collection(db, 'programs', programId, 'seasons', activeSeasonId, 'games');
        const gamesSnap = await getDocs(gamesRef);
        
        const gamesData: Game[] = [];
        gamesSnap.docs.forEach(doc => {
          const data = doc.data();
          
          // Only include games where this team plays
          const isHome = data.homeTeamId === teamId;
          const isAway = data.awayTeamId === teamId;
          if (!isHome && !isAway) return;
          if (data.status !== 'completed') return;
          
          gamesData.push({
            id: doc.id,
            teamId: teamId,
            date: data.weekDate || data.date || '',
            week: data.week || 0,
            opponent: isHome ? data.awayTeamName : data.homeTeamName,
            isHome,
            teamScore: isHome ? (data.homeScore ?? 0) : (data.awayScore ?? 0),
            opponentScore: isHome ? (data.awayScore ?? 0) : (data.homeScore ?? 0),
            location: data.location || '',
            status: data.status || 'scheduled',
            season: new Date().getFullYear(),
          } as Game);
        });
        
        // Sort by week number (ascending)
        gamesData.sort((a, b) => ((a as any).week || 0) - ((b as any).week || 0));
        
        setGames(gamesData);
        
        // Load all stats and aggregate
        const playerStatsMap = new Map<string, PlayerTotals>();
        const gameStatsArray: typeof teamGameStats = [];
        
        for (let i = 0; i < gamesData.length; i++) {
          const game = gamesData[i];
          const weekNum = (game as any).week || (i + 1);
          const gameLabel = `W${weekNum}`;
          
          const statsRef = collection(db, 'programs', programId, 'seasons', activeSeasonId, 'games', game.id, 'stats');
          const statsQuery = query(statsRef, where('teamId', '==', teamId));
          const statsSnap = await getDocs(statsQuery);
          
          // Aggregate team game stats
          const gameTeamStats: Record<string, number> = {};
          
          statsSnap.docs.forEach(statDoc => {
            const stat = statDoc.data() as GameStatV2;
            if (!stat.played) return;
            
            // Add to game team totals
            Object.entries(stat.stats).forEach(([key, value]) => {
              gameTeamStats[key] = (gameTeamStats[key] || 0) + (value || 0);
            });
            
            // Add to player totals
            const existing = playerStatsMap.get(stat.playerId);
            
            if (existing) {
              existing.gamesPlayed++;
              Object.entries(stat.stats).forEach(([key, value]) => {
                existing.stats[key] = (existing.stats[key] || 0) + (value || 0);
              });
              existing.gameByGame.push({
                game: gameLabel,
                opponent: game.opponent,
                stats: { ...stat.stats }
              });
            } else {
              playerStatsMap.set(stat.playerId, {
                playerId: stat.playerId,
                playerName: stat.playerName,
                playerNumber: stat.playerNumber,
                position: stat.position,
                gamesPlayed: 1,
                stats: { ...stat.stats },
                gameByGame: [{
                  game: gameLabel,
                  opponent: game.opponent,
                  stats: { ...stat.stats }
                }]
              });
            }
          });
          
          // Calculate total yards for game
          const totalYards = (gameTeamStats.passYards || 0) + (gameTeamStats.rushYards || 0) + (gameTeamStats.receivingYards || 0);
          
          gameStatsArray.push({
            gameId: game.id,
            game: gameLabel,
            opponent: game.opponent,
            date: game.date,
            result: game.teamScore > game.opponentScore ? 'W' : game.teamScore < game.opponentScore ? 'L' : 'T',
            score: `${game.teamScore}-${game.opponentScore}`,
            stats: gameTeamStats
          });
        }
        
        setPlayerTotals(Array.from(playerStatsMap.values()));
        setTeamGameStats(gameStatsArray);
      } catch (err) {
        console.error('Error loading stats:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [programId, activeSeasonId, teamId]);
  
  // Calculate highlights
  const highlights = useMemo(() => {
    const totals: Record<string, number> = {};
    let totalGames = games.length;
    let wins = 0;
    
    teamGameStats.forEach(g => {
      if (g.result === 'W') wins++;
      Object.entries(g.stats).forEach(([key, val]) => {
        totals[key] = (totals[key] || 0) + val;
      });
    });
    
    // Calculate trends (last game vs previous)
    const getTrend = (key: string): { trend: 'up' | 'down' | 'same'; percent: number } => {
      if (teamGameStats.length < 2) return { trend: 'same', percent: 0 };
      const last = teamGameStats[teamGameStats.length - 1]?.stats[key] || 0;
      const prev = teamGameStats[teamGameStats.length - 2]?.stats[key] || 0;
      if (prev === 0) return { trend: last > 0 ? 'up' : 'same', percent: 0 };
      const percent = Math.round(((last - prev) / prev) * 100);
      return {
        trend: percent > 0 ? 'up' : percent < 0 ? 'down' : 'same',
        percent: Math.abs(percent)
      };
    };
    
    return {
      totalGames,
      wins,
      losses: teamGameStats.filter(g => g.result === 'L').length,
      passYards: totals.passYards || 0,
      rushYards: totals.rushYards || 0,
      touchdowns: (totals.passTouchdowns || 0) + (totals.rushTouchdowns || 0) + (totals.receivingTouchdowns || 0),
      tackles: totals.tackles || totals.soloTackles || 0,
      passingTrend: getTrend('passYards'),
      rushingTrend: getTrend('rushYards'),
      // Sparklines
      passingSparkline: teamGameStats.map(g => g.stats.passYards || 0),
      rushingSparkline: teamGameStats.map(g => g.stats.rushYards || 0),
    };
  }, [teamGameStats, games]);
  
  // Top performers
  const topPerformers = useMemo(() => {
    const getLeaders = (statKey: string, label: string) => {
      return playerTotals
        .filter(p => (p.stats[statKey] || 0) > 0)
        .sort((a, b) => (b.stats[statKey] || 0) - (a.stats[statKey] || 0))
        .slice(0, 5)
        .map((p, i) => ({
          rank: i + 1,
          name: p.playerName,
          value: p.stats[statKey] || 0,
          position: p.position
        }));
    };
    
    return {
      passingYards: getLeaders('passYards', 'Passing Yards'),
      rushingYards: getLeaders('rushYards', 'Rushing Yards'),
      touchdowns: playerTotals
        .map(p => ({
          ...p,
          totalTDs: (p.stats.passTouchdowns || 0) + (p.stats.rushTouchdowns || 0) + (p.stats.receivingTouchdowns || 0)
        }))
        .filter(p => p.totalTDs > 0)
        .sort((a, b) => b.totalTDs - a.totalTDs)
        .slice(0, 5)
        .map((p, i) => ({
          rank: i + 1,
          name: p.playerName,
          value: p.totalTDs,
          position: p.position
        })),
      tackles: getLeaders('totalTackles', 'Tackles').length > 0 
        ? getLeaders('totalTackles', 'Tackles')
        : getLeaders('soloTackles', 'Solo Tackles')
    };
  }, [playerTotals]);
  
  // Chart data
  const trendChartData = useMemo(() => {
    return teamGameStats.map(g => ({
      game: g.game,
      gameNumber: parseInt(g.game.replace('G', '')),
      opponent: g.opponent,
      date: g.date,
      passYards: g.stats.passYards || 0,
      rushYards: g.stats.rushYards || 0,
      touchdowns: (g.stats.passTouchdowns || 0) + (g.stats.rushTouchdowns || 0)
    }));
  }, [teamGameStats]);
  
  // Game performance data
  const gamePerformanceData = useMemo(() => {
    const maxYards = Math.max(...teamGameStats.map(g => 
      (g.stats.passYards || 0) + (g.stats.rushYards || 0)
    ), 1);
    
    return teamGameStats.map(g => ({
      game: g.game,
      opponent: g.opponent,
      result: g.result,
      score: g.score,
      totalYards: (g.stats.passYards || 0) + (g.stats.rushYards || 0),
      maxYards
    }));
  }, [teamGameStats]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }
  
  if (teamGameStats.length === 0) {
    return (
      <GlassCard className={isDark ? '' : 'bg-white border-slate-200'}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className={`w-12 h-12 mb-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
          <p className={`text-lg font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            No Stats Data Yet
          </p>
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Charts and trends will appear after entering game stats
          </p>
        </div>
      </GlassCard>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-purple-500" />
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Performance Analytics
          </h2>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'} transition`}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>
      
      {isExpanded && (
        <>
          {/* Highlight Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatHighlightCard
              title="Season Record"
              value={`${highlights.wins}-${highlights.losses}`}
              subtitle={`${highlights.totalGames} games played`}
              icon={<Trophy className="w-4 h-4" />}
              color={highlights.wins > highlights.losses ? 'emerald' : highlights.wins < highlights.losses ? 'red' : 'amber'}
              theme={theme}
            />
            <StatHighlightCard
              title="Pass Yards"
              value={highlights.passYards}
              subtitle={`${Math.round(highlights.passYards / Math.max(highlights.totalGames, 1))} per game`}
              trend={highlights.passingTrend.trend}
              trendValue={`${highlights.passingTrend.percent}%`}
              icon={<Target className="w-4 h-4" />}
              color="purple"
              theme={theme}
              sparklineData={highlights.passingSparkline}
            />
            <StatHighlightCard
              title="Rush Yards"
              value={highlights.rushYards}
              subtitle={`${Math.round(highlights.rushYards / Math.max(highlights.totalGames, 1))} per game`}
              trend={highlights.rushingTrend.trend}
              trendValue={`${highlights.rushingTrend.percent}%`}
              icon={<Zap className="w-4 h-4" />}
              color="cyan"
              theme={theme}
              sparklineData={highlights.rushingSparkline}
            />
            <StatHighlightCard
              title="Touchdowns"
              value={highlights.touchdowns}
              subtitle={`${(highlights.touchdowns / Math.max(highlights.totalGames, 1)).toFixed(1)} per game`}
              icon={<Award className="w-4 h-4" />}
              color="amber"
              theme={theme}
            />
          </div>
          
          {/* Performance Trend Chart */}
          <GlassCard className={isDark ? '' : 'bg-white border-slate-200'}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-purple-500" />
              <h3 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                Performance Trends
              </h3>
            </div>
            <PerformanceTrendChart
              data={trendChartData}
              statKeys={['passYards', 'rushYards', 'touchdowns']}
              statLabels={{
                passYards: 'Pass Yards',
                rushYards: 'Rush Yards',
                touchdowns: 'TDs'
              }}
              theme={theme}
            />
          </GlassCard>
          
          {/* Leaderboards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Passing Leaders */}
            {topPerformers.passingYards.length > 0 && (
              <GlassCard className={isDark ? '' : 'bg-white border-slate-200'}>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-purple-500" />
                  <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    Top Passers
                  </h4>
                </div>
                <LeaderboardChart
                  data={topPerformers.passingYards}
                  statLabel="Pass Yards"
                  theme={theme}
                  maxItems={3}
                />
              </GlassCard>
            )}
            
            {/* Rushing Leaders */}
            {topPerformers.rushingYards.length > 0 && (
              <GlassCard className={isDark ? '' : 'bg-white border-slate-200'}>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-cyan-500" />
                  <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    Top Rushers
                  </h4>
                </div>
                <LeaderboardChart
                  data={topPerformers.rushingYards}
                  statLabel="Rush Yards"
                  theme={theme}
                  maxItems={3}
                />
              </GlassCard>
            )}
            
            {/* TD Leaders */}
            {topPerformers.touchdowns.length > 0 && (
              <GlassCard className={isDark ? '' : 'bg-white border-slate-200'}>
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-amber-500" />
                  <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    TD Leaders
                  </h4>
                </div>
                <LeaderboardChart
                  data={topPerformers.touchdowns}
                  statLabel="Touchdowns"
                  theme={theme}
                  maxItems={3}
                />
              </GlassCard>
            )}
          </div>
          
          {/* Game-by-Game Performance */}
          <GlassCard className={isDark ? '' : 'bg-white border-slate-200'}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-purple-500" />
              <h3 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                Game-by-Game Performance
              </h3>
            </div>
            <GamePerformanceBars
              games={gamePerformanceData}
              theme={theme}
            />
          </GlassCard>
        </>
      )}
    </div>
  );
};

export default StatsDashboard;
