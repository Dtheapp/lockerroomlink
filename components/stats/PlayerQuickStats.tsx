/**
 * Stats Engine v2.0 - Player Quick Stats Component
 * 
 * Compact stat display for player cards in parent profiles, roster pages, etc.
 * Dynamically shows sport-appropriate stats instead of hardcoded TD/TKL.
 * 
 * Created: December 21, 2025
 */

import React, { useMemo } from 'react';
import { getQuickStatKeys, getStatDefinition } from '../../config/statSchemas';
import { useTheme } from '../../contexts/ThemeContext';
import { Sword, Shield, Target, Zap, Star, Trophy } from 'lucide-react';
import type { SportType } from '../../types';

// Map stat keys to icons
const STAT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  // Football
  rushYards: Zap,
  rushTouchdowns: Trophy,
  receivingYards: Target,
  receivingTouchdowns: Trophy,
  passYards: Target,
  passTouchdowns: Trophy,
  tackles: Shield,
  sacks: Shield,
  defensiveInterceptions: Shield,
  // Basketball
  points: Star,
  totalRebounds: Shield,
  assists: Target,
  steals: Zap,
  blocks: Shield,
  // Soccer
  goals: Trophy,
  shots: Target,
  saves: Shield,
  // Baseball
  hits: Target,
  homeRuns: Trophy,
  rbi: Star,
  strikeoutsThrown: Zap,
  // Volleyball
  kills: Zap,
  digs: Shield,
  serviceAces: Star,
  // Cheer
  stuntsHit: Star,
  spiritPoints: Trophy,
  // Default
  default: Star,
};

interface PlayerQuickStatsProps {
  stats: Record<string, number>;
  sport: SportType;
  maxStats?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

const PlayerQuickStats: React.FC<PlayerQuickStatsProps> = ({
  stats,
  sport,
  maxStats = 4,
  size = 'sm',
  showLabels = true,
  className = ''
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Get the quick stat keys for this sport
  const quickStatKeys = useMemo(() => getQuickStatKeys(sport), [sport]);
  
  // Build display stats - only show non-zero values
  const displayStats = useMemo(() => {
    const result: { key: string; value: number; label: string; abbrev: string; Icon: React.FC<{ className?: string }> }[] = [];
    
    for (const key of quickStatKeys) {
      if (result.length >= maxStats) break;
      
      const value = stats[key] || 0;
      if (value === 0) continue;
      
      const def = getStatDefinition(sport, key);
      const Icon = STAT_ICONS[key] || STAT_ICONS.default;
      
      result.push({
        key,
        value,
        label: def?.shortLabel || key,
        abbrev: def?.abbrev || key.substring(0, 3).toUpperCase(),
        Icon,
      });
    }
    
    return result;
  }, [stats, sport, quickStatKeys, maxStats]);
  
  if (displayStats.length === 0) {
    return (
      <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'} ${className}`}>
        No stats yet
      </span>
    );
  }
  
  // Size classes
  const sizeClasses = {
    sm: {
      container: 'gap-2',
      icon: 'w-3 h-3',
      value: 'text-xs font-bold',
      label: 'text-[10px]',
    },
    md: {
      container: 'gap-3',
      icon: 'w-4 h-4',
      value: 'text-sm font-bold',
      label: 'text-xs',
    },
    lg: {
      container: 'gap-4',
      icon: 'w-5 h-5',
      value: 'text-base font-bold',
      label: 'text-sm',
    },
  };
  
  const sizes = sizeClasses[size];

  return (
    <div className={`flex flex-wrap items-center ${sizes.container} ${className}`}>
      {displayStats.map(({ key, value, abbrev, Icon }) => (
        <div key={key} className="flex items-center gap-1">
          <Icon className={`${sizes.icon} ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
          <span className={`${sizes.value} ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {value}
          </span>
          {showLabels && (
            <span className={`${sizes.label} ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
              {abbrev}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// SEASON TOTALS VARIANT
// =============================================================================

interface PlayerSeasonTotalsProps {
  totals: Record<string, number>;
  sport: SportType;
  gamesPlayed?: number;
  className?: string;
}

export const PlayerSeasonTotals: React.FC<PlayerSeasonTotalsProps> = ({
  totals,
  sport,
  gamesPlayed,
  className = ''
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const quickStatKeys = useMemo(() => getQuickStatKeys(sport), [sport]);
  
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Games Played Header */}
      {gamesPlayed !== undefined && (
        <div className={`text-xs uppercase tracking-wider font-semibold ${
          isDark ? 'text-zinc-500' : 'text-slate-500'
        }`}>
          {gamesPlayed} Games Played
        </div>
      )}
      
      {/* Stat Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {quickStatKeys.slice(0, 6).map(key => {
          const value = totals[key] || 0;
          const def = getStatDefinition(sport, key);
          
          return (
            <div
              key={key}
              className={`text-center p-3 rounded-lg ${
                isDark ? 'bg-zinc-800/50' : 'bg-slate-100'
              }`}
            >
              <div className={`text-xl font-black ${
                value > 0 
                  ? isDark ? 'text-white' : 'text-slate-900'
                  : isDark ? 'text-zinc-600' : 'text-slate-400'
              }`}>
                {value}
              </div>
              <div className={`text-[10px] uppercase tracking-wider font-semibold ${
                isDark ? 'text-zinc-500' : 'text-slate-500'
              }`}>
                {def?.abbrev || key}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// CAREER BESTS VARIANT
// =============================================================================

interface PlayerCareerBestsProps {
  highs: Record<string, { value: number; gameId?: string; date?: string; opponent?: string }>;
  sport: SportType;
  className?: string;
}

export const PlayerCareerBests: React.FC<PlayerCareerBestsProps> = ({
  highs,
  sport,
  className = ''
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const quickStatKeys = useMemo(() => getQuickStatKeys(sport), [sport]);
  
  // Filter to only show stats with highs > 0
  const displayHighs = useMemo(() => {
    return quickStatKeys
      .filter(key => highs[key]?.value > 0)
      .slice(0, 4)
      .map(key => ({
        key,
        ...highs[key],
        def: getStatDefinition(sport, key),
      }));
  }, [highs, quickStatKeys, sport]);
  
  if (displayHighs.length === 0) return null;

  return (
    <div className={className}>
      <div className={`flex items-center gap-2 mb-3 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
        <Trophy className="w-4 h-4" />
        <span className="text-sm font-bold uppercase tracking-wider">Career Highs</span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {displayHighs.map(({ key, value, opponent, def }) => (
          <div
            key={key}
            className={`p-3 rounded-lg border ${
              isDark 
                ? 'bg-amber-500/10 border-amber-500/20' 
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            <div className={`text-2xl font-black ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              {value}
            </div>
            <div className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {def?.shortLabel || key}
            </div>
            {opponent && (
              <div className={`text-[10px] mt-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                vs {opponent}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerQuickStats;
