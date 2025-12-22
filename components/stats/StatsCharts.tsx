/**
 * Stats Engine v2.0 - World-Class Stats Visualizations
 * 
 * Beautiful charts and graphs for stats analysis.
 * Uses Recharts for professional-grade visualizations.
 * 
 * Created: December 21, 2025
 */

import React, { useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Trophy, Target, Zap } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface GameDataPoint {
  game: string;
  gameNumber: number;
  opponent: string;
  date: string;
  [statKey: string]: string | number;
}

interface PlayerRadarData {
  category: string;
  value: number;
  fullMark: number;
}

// =============================================================================
// COLOR PALETTE
// =============================================================================

const CHART_COLORS = {
  primary: '#a855f7',      // Purple
  secondary: '#22d3ee',    // Cyan
  tertiary: '#f59e0b',     // Amber
  quaternary: '#10b981',   // Emerald
  danger: '#ef4444',       // Red
  gradient: {
    start: '#a855f7',
    end: '#6366f1'
  }
};

const STAT_COLORS: Record<string, string> = {
  passingYards: '#a855f7',
  rushingYards: '#22d3ee',
  receivingYards: '#f59e0b',
  touchdowns: '#10b981',
  tackles: '#ef4444',
  interceptions: '#ec4899',
  sacks: '#8b5cf6',
  points: '#f59e0b',
  rebounds: '#22d3ee',
  assists: '#10b981',
  goals: '#a855f7',
};

// =============================================================================
// PERFORMANCE TREND CHART
// =============================================================================

interface PerformanceTrendProps {
  data: GameDataPoint[];
  statKeys: string[];
  statLabels: Record<string, string>;
  theme: 'dark' | 'light';
  height?: number;
}

export const PerformanceTrendChart: React.FC<PerformanceTrendProps> = ({
  data,
  statKeys,
  statLabels,
  theme,
  height = 280
}) => {
  const isDark = theme === 'dark';
  
  const colors = [
    CHART_COLORS.primary,
    CHART_COLORS.secondary,
    CHART_COLORS.tertiary,
    CHART_COLORS.quaternary
  ];

  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-[${height}px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
        <p>No game data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          {statKeys.map((key, i) => (
            <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke={isDark ? '#27272a' : '#e2e8f0'} 
          vertical={false}
        />
        <XAxis 
          dataKey="game" 
          stroke={isDark ? '#71717a' : '#94a3b8'}
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          stroke={isDark ? '#71717a' : '#94a3b8'}
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? '#18181b' : '#ffffff',
            border: `1px solid ${isDark ? '#27272a' : '#e2e8f0'}`,
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
          labelStyle={{ color: isDark ? '#ffffff' : '#18181b', fontWeight: 'bold' }}
          itemStyle={{ color: isDark ? '#a1a1aa' : '#64748b' }}
        />
        <Legend 
          wrapperStyle={{ paddingTop: '10px' }}
          formatter={(value) => (
            <span style={{ color: isDark ? '#a1a1aa' : '#64748b', fontSize: '12px' }}>
              {statLabels[value] || value}
            </span>
          )}
        />
        {statKeys.map((key, i) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            name={key}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            fill={`url(#gradient-${key})`}
            dot={{ fill: colors[i % colors.length], strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, stroke: isDark ? '#18181b' : '#ffffff', strokeWidth: 2 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
};

// =============================================================================
// PLAYER RADAR CHART (Skill Balance)
// =============================================================================

interface PlayerRadarProps {
  data: PlayerRadarData[];
  theme: 'dark' | 'light';
  playerName?: string;
  height?: number;
}

export const PlayerRadarChart: React.FC<PlayerRadarProps> = ({
  data,
  theme,
  playerName,
  height = 300
}) => {
  const isDark = theme === 'dark';

  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-[${height}px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
        <p>No stats available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
        <PolarGrid 
          stroke={isDark ? '#3f3f46' : '#cbd5e1'}
          strokeDasharray="3 3"
        />
        <PolarAngleAxis 
          dataKey="category"
          tick={{ fill: isDark ? '#a1a1aa' : '#64748b', fontSize: 11 }}
        />
        <PolarRadiusAxis 
          angle={90}
          domain={[0, 100]}
          tick={{ fill: isDark ? '#71717a' : '#94a3b8', fontSize: 10 }}
          axisLine={false}
        />
        <Radar
          name={playerName || 'Stats'}
          dataKey="value"
          stroke={CHART_COLORS.primary}
          fill={CHART_COLORS.primary}
          fillOpacity={0.3}
          strokeWidth={2}
          dot={{ fill: CHART_COLORS.primary, strokeWidth: 0, r: 4 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? '#18181b' : '#ffffff',
            border: `1px solid ${isDark ? '#27272a' : '#e2e8f0'}`,
            borderRadius: '8px'
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
};

// =============================================================================
// STAT COMPARISON BARS
// =============================================================================

interface StatBarData {
  name: string;
  value: number;
  maxValue: number;
  trend?: 'up' | 'down' | 'same';
  trendPercent?: number;
}

interface StatComparisonBarsProps {
  data: StatBarData[];
  theme: 'dark' | 'light';
  showTrend?: boolean;
}

export const StatComparisonBars: React.FC<StatComparisonBarsProps> = ({
  data,
  theme,
  showTrend = true
}) => {
  const isDark = theme === 'dark';

  return (
    <div className="space-y-3">
      {data.map((stat, index) => {
        const percentage = stat.maxValue > 0 ? (stat.value / stat.maxValue) * 100 : 0;
        
        return (
          <div key={stat.name} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {stat.name}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {stat.value.toLocaleString()}
                </span>
                {showTrend && stat.trend && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${
                    stat.trend === 'up' ? 'text-emerald-500' :
                    stat.trend === 'down' ? 'text-red-500' :
                    isDark ? 'text-zinc-500' : 'text-slate-400'
                  }`}>
                    {stat.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                    {stat.trend === 'down' && <TrendingDown className="w-3 h-3" />}
                    {stat.trend === 'same' && <Minus className="w-3 h-3" />}
                    {stat.trendPercent !== undefined && `${stat.trendPercent > 0 ? '+' : ''}${stat.trendPercent}%`}
                  </span>
                )}
              </div>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(percentage, 100)}%`,
                  background: `linear-gradient(90deg, ${CHART_COLORS.primary}, ${CHART_COLORS.secondary})`
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================
// SPARKLINE (Inline Mini Chart)
// =============================================================================

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  showDot?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = CHART_COLORS.primary,
  width = 80,
  height = 24,
  showDot = true
}) => {
  const chartData = data.map((value, index) => ({ value, index }));

  if (data.length < 2) {
    return <div style={{ width, height }} />;
  }

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData} margin={{ top: 2, right: 4, bottom: 2, left: 4 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          activeDot={showDot ? { r: 3, fill: color } : false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

// =============================================================================
// LEADERBOARD HORIZONTAL BARS
// =============================================================================

interface LeaderboardEntry {
  rank: number;
  name: string;
  value: number;
  avatarUrl?: string;
  position?: string;
}

interface LeaderboardChartProps {
  data: LeaderboardEntry[];
  statLabel: string;
  theme: 'dark' | 'light';
  maxItems?: number;
}

export const LeaderboardChart: React.FC<LeaderboardChartProps> = ({
  data,
  statLabel,
  theme,
  maxItems = 5
}) => {
  const isDark = theme === 'dark';
  const displayData = data.slice(0, maxItems);
  const maxValue = Math.max(...displayData.map(d => d.value), 1);

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (rank === 2) return 'bg-slate-400/20 text-slate-300 border-slate-400/30';
    if (rank === 3) return 'bg-orange-600/20 text-orange-400 border-orange-500/30';
    return isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-slate-100 text-slate-500 border-slate-200';
  };

  return (
    <div className="space-y-2">
      {displayData.map((entry) => (
        <div 
          key={entry.rank}
          className={`flex items-center gap-3 p-2 rounded-lg ${
            isDark ? 'bg-white/5' : 'bg-slate-50'
          }`}
        >
          {/* Rank Badge */}
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${getRankColor(entry.rank)}`}>
            {entry.rank}
          </div>
          
          {/* Avatar */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
          }`}>
            {entry.avatarUrl ? (
              <img src={entry.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              entry.name.charAt(0).toUpperCase()
            )}
          </div>
          
          {/* Name & Bar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {entry.name}
              </span>
              <span className={`text-sm font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                {entry.value}
              </span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(entry.value / maxValue) * 100}%`,
                  background: entry.rank === 1 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' :
                              entry.rank === 2 ? 'linear-gradient(90deg, #94a3b8, #cbd5e1)' :
                              entry.rank === 3 ? 'linear-gradient(90deg, #ea580c, #f97316)' :
                              `linear-gradient(90deg, ${CHART_COLORS.primary}, ${CHART_COLORS.secondary})`
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// GAME PERFORMANCE SUMMARY BAR
// =============================================================================

interface GameSummary {
  game: string;
  opponent: string;
  result: 'W' | 'L' | 'T';
  score: string;
  totalYards: number;
  maxYards: number;
}

interface GamePerformanceBarsProps {
  games: GameSummary[];
  theme: 'dark' | 'light';
}

export const GamePerformanceBars: React.FC<GamePerformanceBarsProps> = ({
  games,
  theme
}) => {
  const isDark = theme === 'dark';

  return (
    <div className="space-y-2">
      {games.map((game, index) => (
        <div 
          key={index}
          className={`flex items-center gap-3 p-2 rounded-lg ${
            isDark ? 'bg-white/5' : 'bg-slate-50'
          }`}
        >
          {/* Result Badge */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
            game.result === 'W' ? 'bg-emerald-500/20 text-emerald-400' :
            game.result === 'L' ? 'bg-red-500/20 text-red-400' :
            'bg-amber-500/20 text-amber-400'
          }`}>
            {game.result}
          </div>
          
          {/* Game Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                vs {game.opponent}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                  {game.score}
                </span>
                <span className={`text-sm font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                  {game.totalYards} yds
                </span>
              </div>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(game.totalYards / game.maxYards) * 100}%`,
                  background: game.result === 'W' 
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : game.result === 'L'
                    ? 'linear-gradient(90deg, #ef4444, #f87171)'
                    : 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// STAT HIGHLIGHT CARD
// =============================================================================

interface StatHighlightProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'same';
  trendValue?: string;
  icon?: React.ReactNode;
  color?: 'purple' | 'cyan' | 'amber' | 'emerald' | 'red';
  theme: 'dark' | 'light';
  sparklineData?: number[];
}

export const StatHighlightCard: React.FC<StatHighlightProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  color = 'purple',
  theme,
  sparklineData
}) => {
  const isDark = theme === 'dark';
  
  const colorClasses = {
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30'
  };
  
  const iconColors = {
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    red: 'text-red-400'
  };

  return (
    <div className={`p-4 rounded-xl border bg-gradient-to-br ${colorClasses[color]} ${
      isDark ? '' : 'bg-white'
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <div className={`flex items-center gap-2 mb-1 ${iconColors[color]}`}>
            {icon}
            <span className={`text-xs font-bold uppercase tracking-wider ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              {title}
            </span>
          </div>
          <div className={`text-3xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          {subtitle && (
            <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              {subtitle}
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-1">
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium ${
              trend === 'up' ? 'text-emerald-500' :
              trend === 'down' ? 'text-red-500' :
              'text-slate-400'
            }`}>
              {trend === 'up' && <TrendingUp className="w-3 h-3" />}
              {trend === 'down' && <TrendingDown className="w-3 h-3" />}
              {trend === 'same' && <Minus className="w-3 h-3" />}
              {trendValue}
            </div>
          )}
          {sparklineData && sparklineData.length > 1 && (
            <Sparkline 
              data={sparklineData} 
              color={STAT_COLORS[color] || CHART_COLORS.primary}
              width={60}
              height={20}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default {
  PerformanceTrendChart,
  PlayerRadarChart,
  StatComparisonBars,
  Sparkline,
  LeaderboardChart,
  GamePerformanceBars,
  StatHighlightCard
};
