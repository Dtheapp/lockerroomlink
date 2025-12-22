/**
 * Stats Engine v2.0 - Stat Leaders Widget
 * 
 * Compact widget showing top performers in key stat categories.
 * Used on Coach Dashboard and Team pages.
 * 
 * Created: December 21, 2025
 */

import React, { useState, useMemo } from 'react';
import { useStatLeaders } from '../../hooks/useStatsV2';
import { getLeaderboardStatKeys, getStatDefinition } from '../../config/statSchemas';
import { useTheme } from '../../contexts/ThemeContext';
import { Trophy, ChevronRight, TrendingUp, Users } from 'lucide-react';
import type { SportType, StatLeaderV2 } from '../../types';

interface StatLeadersWidgetProps {
  programId: string;
  seasonId: string;
  sport: SportType;
  teamId?: string;  // If provided, only show players from this team
  maxLeaders?: number;
  onViewAll?: () => void;
}

const StatLeadersWidget: React.FC<StatLeadersWidgetProps> = ({
  programId,
  seasonId,
  sport,
  teamId,
  maxLeaders = 3,
  onViewAll
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Get leaderboard stat keys for this sport
  const leaderboardStats = useMemo(() => getLeaderboardStatKeys(sport), [sport]);
  
  // State for selected stat category
  const [selectedStat, setSelectedStat] = useState(leaderboardStats[0] || '');
  
  // Fetch leaders for selected stat
  const { leaders, loading, error } = useStatLeaders(programId, seasonId, selectedStat, maxLeaders + 5);
  
  // Filter by team if provided
  const filteredLeaders = useMemo(() => {
    if (!teamId) return leaders.slice(0, maxLeaders);
    return leaders.filter(l => l.teamId === teamId).slice(0, maxLeaders);
  }, [leaders, teamId, maxLeaders]);
  
  // Get stat definition for display
  const statDef = useMemo(() => getStatDefinition(sport, selectedStat), [sport, selectedStat]);
  
  if (!programId || !seasonId) {
    return null;
  }

  return (
    <div className={`rounded-xl overflow-hidden ${
      isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-white border border-slate-200 shadow-sm'
    }`}>
      {/* Header */}
      <div className={`p-4 flex items-center justify-between ${
        isDark ? 'border-b border-zinc-700' : 'border-b border-slate-200'
      }`}>
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold">Stat Leaders</h3>
        </div>
        
        {onViewAll && (
          <button
            onClick={onViewAll}
            className={`text-xs flex items-center gap-1 ${
              isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500'
            }`}
          >
            View All <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Stat Category Tabs */}
      <div className={`flex gap-1 p-2 overflow-x-auto ${isDark ? 'bg-zinc-900/50' : 'bg-slate-50'}`}>
        {leaderboardStats.slice(0, 6).map(statKey => {
          const def = getStatDefinition(sport, statKey);
          const isSelected = selectedStat === statKey;
          
          return (
            <button
              key={statKey}
              onClick={() => setSelectedStat(statKey)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? isDark
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-500 text-white'
                  : isDark
                    ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {def?.abbrev || statKey}
            </button>
          );
        })}
      </div>
      
      {/* Leaders List */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className={`text-center py-8 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
            <p className="text-sm">Failed to load leaders</p>
          </div>
        ) : filteredLeaders.length === 0 ? (
          <div className={`text-center py-8 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No stats recorded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLeaders.map((leader, index) => (
              <LeaderRow
                key={leader.playerId}
                leader={leader}
                rank={index + 1}
                statLabel={statDef?.shortLabel || selectedStat}
                isDark={isDark}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// LEADER ROW COMPONENT
// =============================================================================

interface LeaderRowProps {
  leader: StatLeaderV2;
  rank: number;
  statLabel: string;
  isDark: boolean;
}

const LeaderRow: React.FC<LeaderRowProps> = ({ leader, rank, statLabel, isDark }) => {
  const getRankStyle = () => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black';
      case 2:
        return 'bg-gradient-to-r from-slate-400 to-slate-300 text-black';
      case 3:
        return 'bg-gradient-to-r from-amber-700 to-amber-600 text-white';
      default:
        return isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-slate-200 text-slate-600';
    }
  };

  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg ${
      isDark ? 'hover:bg-zinc-700/50' : 'hover:bg-slate-50'
    }`}>
      {/* Rank Badge */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${getRankStyle()}`}>
        {rank}
      </div>
      
      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
            #{leader.playerNumber}
          </span>
          <span className={`font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {leader.playerName}
          </span>
        </div>
        {leader.teamName && (
          <p className={`text-xs truncate ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
            {leader.teamName}
          </p>
        )}
      </div>
      
      {/* Stat Value */}
      <div className="text-right">
        <div className={`text-lg font-black ${
          rank === 1 ? 'text-amber-500' : isDark ? 'text-white' : 'text-slate-900'
        }`}>
          {leader.statValue}
        </div>
        <div className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
          {statLabel}
        </div>
      </div>
    </div>
  );
};

export default StatLeadersWidget;
