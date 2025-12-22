/**
 * Stats Engine v2.0 - NFL-Style Game Recap Component
 * 
 * 3 Tabs like Google/NFL:
 * 1. OVERVIEW - Game Leaders (top performer per category)
 * 2. PLAYER STATS - Full breakdown tables by category
 * 3. TEAM STATS - Side-by-side comparison with visual bars
 * 
 * Created: December 21, 2025
 */

import React, { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { getStatSchema, getStatsByCategory, type StatDefinition, type StatCategory } from '../../config/statSchemas';
import { GlassCard } from '../ui/OSYSComponents';
import { 
  Trophy, Target, Zap, Shield, Users, ChevronDown, ChevronUp,
  TrendingUp, Award, Star
} from 'lucide-react';
import type { GameStatV2, SportType, TeamGameStats } from '../../types';

// =============================================================================
// TYPES
// =============================================================================

interface GameRecapProps {
  gameId: string;
  teamName: string;
  opponentName: string;
  teamScore: number;
  opponentScore: number;
  isHome: boolean;
  playerStats: GameStatV2[];  // All player stats for this game
  teamStats?: TeamGameStats;  // Team-level stats (quarters, efficiency)
  sport?: SportType;
  className?: string;
}

interface CategoryLeader {
  category: string;
  statKey: string;
  statLabel: string;
  player: GameStatV2;
  value: number;
  subStats: string;  // e.g., "27/41, 266 Yds, 1 TD"
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const formatSubStats = (stat: GameStatV2, category: string): string => {
  const s = stat.stats;
  
  if (category === 'passing') {
    return `${s.passCompletions || 0}/${s.passAttempts || 0}, ${s.passYards || 0} Yds, ${s.passTouchdowns || 0} TD`;
  } else if (category === 'rushing') {
    return `${s.rushAttempts || 0} Car, ${s.rushYards || 0} Yds, ${s.rushTouchdowns || 0} TD`;
  } else if (category === 'receiving') {
    return `${s.receptions || 0} Rec, ${s.receivingYards || 0} Yds, ${s.receivingTouchdowns || 0} TD`;
  } else if (category === 'defense') {
    return `${s.tackles || s.soloTackles || 0} Tkl, ${s.sacks || 0} Sack, ${s.defensiveInterceptions || 0} INT`;
  }
  return '';
};

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'passing': return Target;
    case 'rushing': return Zap;
    case 'receiving': return TrendingUp;
    case 'defense': return Shield;
    default: return Star;
  }
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

// Quarter Score Display
const QuarterScores: React.FC<{
  teamName: string;
  opponentName: string;
  teamStats?: TeamGameStats;
  teamTotal: number;
  oppTotal: number;
  isDark: boolean;
}> = ({ teamName, opponentName, teamStats, teamTotal, oppTotal, isDark }) => {
  const hasQuarters = teamStats?.q1Score !== undefined;
  
  return (
    <div className={`rounded-lg overflow-hidden mb-4 ${isDark ? 'bg-black/20' : 'bg-slate-100'}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className={isDark ? 'text-slate-400' : 'text-slate-500'}>
            <th className="text-left p-2 font-medium">Team</th>
            {hasQuarters && (
              <>
                <th className="w-10 text-center p-2 font-medium">1</th>
                <th className="w-10 text-center p-2 font-medium">2</th>
                <th className="w-10 text-center p-2 font-medium">3</th>
                <th className="w-10 text-center p-2 font-medium">4</th>
                {(teamStats?.otScore || teamStats?.oppOtScore) && (
                  <th className="w-10 text-center p-2 font-medium">OT</th>
                )}
              </>
            )}
            <th className="w-12 text-center p-2 font-bold">T</th>
          </tr>
        </thead>
        <tbody>
          <tr className={isDark ? 'text-white' : 'text-zinc-900'}>
            <td className="p-2 font-semibold">{teamName}</td>
            {hasQuarters && (
              <>
                <td className="text-center p-2">{teamStats?.q1Score ?? '-'}</td>
                <td className="text-center p-2">{teamStats?.q2Score ?? '-'}</td>
                <td className="text-center p-2">{teamStats?.q3Score ?? '-'}</td>
                <td className="text-center p-2">{teamStats?.q4Score ?? '-'}</td>
                {(teamStats?.otScore || teamStats?.oppOtScore) && (
                  <td className="text-center p-2">{teamStats?.otScore ?? '-'}</td>
                )}
              </>
            )}
            <td className={`text-center p-2 font-bold ${teamTotal > oppTotal ? 'text-emerald-500' : ''}`}>
              {teamTotal}
            </td>
          </tr>
          <tr className={isDark ? 'text-white' : 'text-zinc-900'}>
            <td className="p-2 font-semibold">{opponentName}</td>
            {hasQuarters && (
              <>
                <td className="text-center p-2">{teamStats?.oppQ1Score ?? '-'}</td>
                <td className="text-center p-2">{teamStats?.oppQ2Score ?? '-'}</td>
                <td className="text-center p-2">{teamStats?.oppQ3Score ?? '-'}</td>
                <td className="text-center p-2">{teamStats?.oppQ4Score ?? '-'}</td>
                {(teamStats?.otScore || teamStats?.oppOtScore) && (
                  <td className="text-center p-2">{teamStats?.oppOtScore ?? '-'}</td>
                )}
              </>
            )}
            <td className={`text-center p-2 font-bold ${oppTotal > teamTotal ? 'text-emerald-500' : ''}`}>
              {oppTotal}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// Game Leaders Card (Overview Tab)
const GameLeaders: React.FC<{
  leaders: CategoryLeader[];
  isDark: boolean;
}> = ({ leaders, isDark }) => {
  if (leaders.length === 0) return null;
  
  return (
    <div className="space-y-4">
      <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
        <Trophy className="w-5 h-5 text-amber-500" />
        Game Leaders
      </h3>
      
      <div className="space-y-3">
        {leaders.map((leader) => {
          const Icon = getCategoryIcon(leader.category);
          return (
            <div 
              key={leader.category}
              className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {leader.statLabel}
                </span>
                <Icon className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    #{leader.player.playerNumber} {leader.player.playerName}
                  </div>
                  <div className={`text-sm ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                    {leader.subStats}
                  </div>
                </div>
                <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {leader.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Player Stats Table (Player Stats Tab)
const PlayerStatsTable: React.FC<{
  category: StatCategory;
  stats: StatDefinition[];
  playerStats: GameStatV2[];
  isDark: boolean;
}> = ({ category, stats, playerStats, isDark }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Get players with stats in this category
  const playersWithStats = useMemo(() => {
    // Define the main stat for sorting each category
    const mainStatKey = stats.length > 0 ? (
      category.key === 'passing' ? 'passYards' :
      category.key === 'rushing' ? 'rushYards' :
      category.key === 'receiving' ? 'receivingYards' :
      category.key === 'defense' ? 'tackles' :
      stats[0].key
    ) : '';
    
    return playerStats
      .filter(p => p.played && stats.some(s => (p.stats[s.key] || 0) > 0))
      .sort((a, b) => (b.stats[mainStatKey] || 0) - (a.stats[mainStatKey] || 0));
  }, [playerStats, stats, category.key]);
  
  if (playersWithStats.length === 0) return null;
  
  // Get display columns (filter to important ones)
  const displayStats = useMemo(() => {
    if (category.key === 'passing') {
      return stats.filter(s => ['passCompletions', 'passAttempts', 'passYards', 'passTouchdowns', 'interceptions', 'longestPass'].includes(s.key));
    } else if (category.key === 'rushing') {
      return stats.filter(s => ['rushAttempts', 'rushYards', 'rushTouchdowns', 'longestRush'].includes(s.key));
    } else if (category.key === 'receiving') {
      return stats.filter(s => ['receptions', 'receivingYards', 'receivingTouchdowns', 'targets', 'longestReception'].includes(s.key));
    } else if (category.key === 'defense') {
      return stats.filter(s => ['soloTackles', 'assistedTackles', 'tackles', 'tacklesForLoss', 'sacks', 'defensiveInterceptions', 'passesDefended'].includes(s.key));
    }
    return stats.slice(0, 6);  // Max 6 columns for other categories
  }, [stats, category.key]);
  
  return (
    <div className={`rounded-lg overflow-hidden ${isDark ? 'bg-white/5' : 'bg-white border border-slate-200'}`}>
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-3 font-bold ${
          isDark ? 'text-white hover:bg-white/5' : 'text-zinc-900 hover:bg-slate-50'
        } transition`}
      >
        <span>{category.label}</span>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {/* Stats Table */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={isDark ? 'bg-black/20 text-slate-400' : 'bg-slate-100 text-slate-500'}>
                <th className="text-left p-2 pl-3 font-medium sticky left-0 bg-inherit">Player</th>
                {displayStats.map(stat => (
                  <th key={stat.key} className="text-center p-2 font-medium min-w-[40px]" title={stat.label}>
                    {stat.abbrev}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {playersWithStats.map((player, idx) => (
                <tr 
                  key={player.playerId}
                  className={`${
                    isDark 
                      ? idx % 2 === 0 ? 'bg-black/10' : 'bg-transparent'
                      : idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'
                  }`}
                >
                  <td className={`p-2 pl-3 font-medium sticky left-0 ${
                    isDark ? 'text-white bg-inherit' : 'text-zinc-900 bg-inherit'
                  }`}>
                    <span className={`text-xs mr-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {player.playerNumber}
                    </span>
                    {player.playerName}
                  </td>
                  {displayStats.map(stat => (
                    <td 
                      key={stat.key} 
                      className={`text-center p-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                    >
                      {player.stats[stat.key] || 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Team Stats Comparison (Team Stats Tab)
const TeamStatsComparison: React.FC<{
  teamName: string;
  opponentName: string;
  teamStats: Record<string, number>;
  teamGameStats?: TeamGameStats;
  isDark: boolean;
}> = ({ teamName, opponentName, teamStats, teamGameStats, isDark }) => {
  
  // Build comparison rows
  const comparisons = useMemo(() => {
    const rows: Array<{ 
      label: string; 
      teamValue: string | number; 
      oppValue?: string | number;
      teamRaw: number;
      oppRaw: number;
    }> = [];
    
    // Total Yards
    const totalYards = (teamStats.passYards || 0) + (teamStats.rushYards || 0) + (teamStats.receivingYards || 0);
    rows.push({ 
      label: 'Total Yards', 
      teamValue: totalYards, 
      teamRaw: totalYards,
      oppRaw: 0 
    });
    
    // Passing Yards
    rows.push({ 
      label: 'Passing Yards', 
      teamValue: teamStats.passYards || 0, 
      teamRaw: teamStats.passYards || 0,
      oppRaw: 0 
    });
    
    // Rushing Yards
    rows.push({ 
      label: 'Rushing Yards', 
      teamValue: teamStats.rushYards || 0, 
      teamRaw: teamStats.rushYards || 0,
      oppRaw: 0 
    });
    
    // First Downs (if available)
    if (teamGameStats?.firstDowns !== undefined) {
      rows.push({ 
        label: 'First Downs', 
        teamValue: teamGameStats.firstDowns, 
        teamRaw: teamGameStats.firstDowns,
        oppRaw: 0 
      });
    }
    
    // 3rd Down Efficiency
    if (teamGameStats?.thirdDownAttempts) {
      rows.push({ 
        label: '3rd Down Efficiency', 
        teamValue: `${teamGameStats.thirdDownConversions || 0}/${teamGameStats.thirdDownAttempts}`, 
        teamRaw: (teamGameStats.thirdDownConversions || 0) / teamGameStats.thirdDownAttempts * 100,
        oppRaw: 0 
      });
    }
    
    // 4th Down Efficiency
    if (teamGameStats?.fourthDownAttempts) {
      rows.push({ 
        label: '4th Down Efficiency', 
        teamValue: `${teamGameStats.fourthDownConversions || 0}/${teamGameStats.fourthDownAttempts}`, 
        teamRaw: (teamGameStats.fourthDownConversions || 0) / teamGameStats.fourthDownAttempts * 100,
        oppRaw: 0 
      });
    }
    
    // Total Plays
    if (teamGameStats?.totalPlays) {
      rows.push({ 
        label: 'Total Plays', 
        teamValue: teamGameStats.totalPlays, 
        teamRaw: teamGameStats.totalPlays,
        oppRaw: 0 
      });
    }
    
    // Time of Possession
    if (teamGameStats?.timeOfPossession) {
      rows.push({ 
        label: 'Time of Possession', 
        teamValue: teamGameStats.timeOfPossession, 
        teamRaw: 0,
        oppRaw: 0 
      });
    }
    
    // Penalties
    if (teamGameStats?.penalties !== undefined) {
      rows.push({ 
        label: 'Penalties (Yards)', 
        teamValue: `${teamGameStats.penalties} (${teamGameStats.penaltyYards || 0})`, 
        teamRaw: teamGameStats.penalties,
        oppRaw: 0 
      });
    }
    
    // Turnovers
    if (teamGameStats?.turnoversLost !== undefined) {
      rows.push({ 
        label: 'Turnovers', 
        teamValue: teamGameStats.turnoversLost, 
        teamRaw: teamGameStats.turnoversLost,
        oppRaw: 0 
      });
    }
    
    // Red Zone
    if (teamGameStats?.redZoneAttempts) {
      rows.push({ 
        label: 'Red Zone (Made/Att)', 
        teamValue: `${teamGameStats.redZoneScores || 0}/${teamGameStats.redZoneAttempts}`, 
        teamRaw: (teamGameStats.redZoneScores || 0) / teamGameStats.redZoneAttempts * 100,
        oppRaw: 0 
      });
    }
    
    // Tackles
    if (teamStats.tackles || teamStats.soloTackles) {
      rows.push({ 
        label: 'Tackles', 
        teamValue: teamStats.tackles || teamStats.soloTackles || 0, 
        teamRaw: teamStats.tackles || teamStats.soloTackles || 0,
        oppRaw: 0 
      });
    }
    
    // Sacks
    if (teamStats.sacks) {
      rows.push({ 
        label: 'Sacks', 
        teamValue: teamStats.sacks, 
        teamRaw: teamStats.sacks,
        oppRaw: 0 
      });
    }
    
    // Interceptions
    if (teamStats.defensiveInterceptions) {
      rows.push({ 
        label: 'Interceptions', 
        teamValue: teamStats.defensiveInterceptions, 
        teamRaw: teamStats.defensiveInterceptions,
        oppRaw: 0 
      });
    }
    
    return rows;
  }, [teamStats, teamGameStats]);
  
  return (
    <div className="space-y-4">
      <div className={`flex justify-between items-center text-sm font-bold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        <span>{teamName}</span>
        <span className="text-xs uppercase tracking-wider">Team Stats</span>
        <span className="text-right opacity-50">{opponentName}</span>
      </div>
      
      <div className="space-y-3">
        {comparisons.map((row, idx) => {
          const maxVal = Math.max(row.teamRaw, row.oppRaw, 1);
          const teamPercent = (row.teamRaw / maxVal) * 100;
          
          return (
            <div key={idx} className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {row.teamValue}
                </span>
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {row.label}
                </span>
                <span className={`text-right opacity-50 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {row.oppValue ?? '-'}
                </span>
              </div>
              
              {/* Progress bar for yards-type stats */}
              {typeof row.teamValue === 'number' && row.teamRaw > 0 && (
                <div className="flex gap-1 mt-1">
                  <div 
                    className="h-1 bg-purple-500 rounded-full transition-all"
                    style={{ width: `${teamPercent}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const GameRecap: React.FC<GameRecapProps> = ({
  gameId,
  teamName,
  opponentName,
  teamScore,
  opponentScore,
  isHome,
  playerStats,
  teamStats,
  sport = 'football',
  className = ''
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [activeTab, setActiveTab] = useState<'overview' | 'players' | 'team'>('overview');
  
  const schema = useMemo(() => getStatSchema(sport), [sport]);
  const categories = schema.categories;
  const statsByCategory = useMemo(() => {
    const map = new Map<string, StatDefinition[]>();
    categories.forEach(cat => {
      map.set(cat.key, getStatsByCategory(sport, cat.key));
    });
    return map;
  }, [sport, categories]);
  
  // Aggregate team totals
  const aggregatedStats = useMemo(() => {
    const sums: Record<string, number> = {};
    playerStats.forEach(p => {
      if (p.played) {
        Object.entries(p.stats).forEach(([key, val]) => {
          sums[key] = (sums[key] || 0) + (val || 0);
        });
      }
    });
    return sums;
  }, [playerStats]);
  
  // Find game leaders
  const gameLeaders = useMemo(() => {
    const leaders: CategoryLeader[] = [];
    
    // Passing leader
    const passingLeader = playerStats
      .filter(p => p.played && (p.stats.passYards || 0) > 0)
      .sort((a, b) => (b.stats.passYards || 0) - (a.stats.passYards || 0))[0];
    if (passingLeader) {
      leaders.push({
        category: 'passing',
        statKey: 'passYards',
        statLabel: 'Passing Yards',
        player: passingLeader,
        value: passingLeader.stats.passYards || 0,
        subStats: formatSubStats(passingLeader, 'passing')
      });
    }
    
    // Rushing leader
    const rushingLeader = playerStats
      .filter(p => p.played && (p.stats.rushYards || 0) > 0)
      .sort((a, b) => (b.stats.rushYards || 0) - (a.stats.rushYards || 0))[0];
    if (rushingLeader) {
      leaders.push({
        category: 'rushing',
        statKey: 'rushYards',
        statLabel: 'Rushing Yards',
        player: rushingLeader,
        value: rushingLeader.stats.rushYards || 0,
        subStats: formatSubStats(rushingLeader, 'rushing')
      });
    }
    
    // Receiving leader
    const receivingLeader = playerStats
      .filter(p => p.played && (p.stats.receivingYards || 0) > 0)
      .sort((a, b) => (b.stats.receivingYards || 0) - (a.stats.receivingYards || 0))[0];
    if (receivingLeader) {
      leaders.push({
        category: 'receiving',
        statKey: 'receivingYards',
        statLabel: 'Receiving Yards',
        player: receivingLeader,
        value: receivingLeader.stats.receivingYards || 0,
        subStats: formatSubStats(receivingLeader, 'receiving')
      });
    }
    
    // Tackles leader
    const tacklesLeader = playerStats
      .filter(p => p.played && ((p.stats.tackles || 0) + (p.stats.soloTackles || 0)) > 0)
      .sort((a, b) => {
        const aTotal = (a.stats.tackles || 0) || (a.stats.soloTackles || 0);
        const bTotal = (b.stats.tackles || 0) || (b.stats.soloTackles || 0);
        return bTotal - aTotal;
      })[0];
    if (tacklesLeader) {
      const tackleVal = (tacklesLeader.stats.tackles || 0) || (tacklesLeader.stats.soloTackles || 0);
      leaders.push({
        category: 'defense',
        statKey: 'tackles',
        statLabel: 'Tackles',
        player: tacklesLeader,
        value: tackleVal,
        subStats: formatSubStats(tacklesLeader, 'defense')
      });
    }
    
    return leaders;
  }, [playerStats]);
  
  // Tab button component
  const TabButton: React.FC<{ id: 'overview' | 'players' | 'team'; label: string }> = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-2.5 text-sm font-bold transition-all ${
        activeTab === id
          ? isDark 
            ? 'bg-purple-600 text-white' 
            : 'bg-purple-600 text-white'
          : isDark
            ? 'text-slate-400 hover:text-white hover:bg-white/5'
            : 'text-slate-600 hover:text-zinc-900 hover:bg-slate-100'
      } ${id === 'overview' ? 'rounded-l-lg' : id === 'team' ? 'rounded-r-lg' : ''}`}
    >
      {label}
    </button>
  );
  
  return (
    <div className={className}>
      {/* Quarter Scores */}
      <QuarterScores
        teamName={teamName}
        opponentName={opponentName}
        teamStats={teamStats}
        teamTotal={teamScore}
        oppTotal={opponentScore}
        isDark={isDark}
      />
      
      {/* Tab Navigation */}
      <div className={`flex mb-4 rounded-lg overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
        <TabButton id="overview" label="OVERVIEW" />
        <TabButton id="players" label="PLAYER STATS" />
        <TabButton id="team" label="TEAM STATS" />
      </div>
      
      {/* Tab Content */}
      <div className="min-h-[200px]">
        {activeTab === 'overview' && (
          <GameLeaders leaders={gameLeaders} isDark={isDark} />
        )}
        
        {activeTab === 'players' && (
          <div className="space-y-4">
            {categories
              .filter(cat => !['participation', 'sportsmanship'].includes(cat.key))
              .map(cat => (
                <PlayerStatsTable
                  key={cat.key}
                  category={cat}
                  stats={statsByCategory.get(cat.key) || []}
                  playerStats={playerStats}
                  isDark={isDark}
                />
              ))}
          </div>
        )}
        
        {activeTab === 'team' && (
          <TeamStatsComparison
            teamName={teamName}
            opponentName={opponentName}
            teamStats={aggregatedStats}
            teamGameStats={teamStats}
            isDark={isDark}
          />
        )}
      </div>
    </div>
  );
};

export default GameRecap;
