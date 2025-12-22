/**
 * Stats Engine v2.0 - Game Stats Entry Component
 * 
 * Writes to: programs/{programId}/seasons/{seasonId}/games/{gameId}/stats/{playerId}
 * 
 * Created: December 21, 2025
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, onSnapshot, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useUnsavedChanges } from '../../contexts/UnsavedChangesContext';
import { 
  saveGameStatsBatch, 
  getGameStatsByTeam, 
  createEmptyGameStat 
} from '../../services/statsServiceV2';
import { 
  getStatSchema, 
  getStatsByCategory,
  getEmptyStats,
  calculateDerivedStats,
  type StatDefinition,
  type StatCategory 
} from '../../config/statSchemas';
import GameRecap from './GameRecap';
import type { Game, Player, GameStatV2, SportType } from '../../types';
import { 
  Trophy, Calendar, ChevronDown, ChevronUp, Save, 
  Check, AlertTriangle, Users, MapPin
} from 'lucide-react';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const formatEventDate = (dateStr: string, options?: Intl.DateTimeFormatOptions) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', options || { weekday: 'short', month: 'short', day: 'numeric' });
};

// =============================================================================
// STAT INPUT COMPONENT
// =============================================================================

interface StatInputProps {
  statDef: StatDefinition;
  value: number;
  onChange: (val: number) => void;
  theme: 'dark' | 'light';
}

const StatInput: React.FC<StatInputProps> = React.memo(({ statDef, value, onChange, theme }) => {
  const [localValue, setLocalValue] = useState(value === 0 ? '' : value.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';
  
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(value === 0 ? '' : value.toString());
    }
  }, [value]);

  return (
    <div className="flex-1 min-w-[60px]">
      <label className={`block text-[9px] uppercase tracking-wider mb-1 font-semibold truncate ${
        isDark ? 'text-zinc-400' : 'text-slate-500'
      }`} title={statDef.label}>
        {statDef.abbrev}
      </label>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={localValue}
        onChange={(e) => {
          const newVal = e.target.value.replace(/[^0-9]/g, '');
          setLocalValue(newVal);
        }}
        onBlur={() => {
          const numVal = parseInt(localValue, 10) || 0;
          onChange(numVal);
        }}
        placeholder="0"
        className={`w-full rounded px-1.5 py-1.5 text-center font-bold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm ${
          isDark 
            ? 'bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600'
            : 'bg-slate-100 border border-slate-300 text-slate-900 placeholder-slate-400'
        }`}
      />
    </div>
  );
});

StatInput.displayName = 'StatInput';

// =============================================================================
// PLAYER STAT ROW COMPONENT
// =============================================================================

interface PlayerStatRowProps {
  player: Player;
  stats: Record<string, number>;
  played: boolean;
  onPlayedChange: (played: boolean) => void;
  onStatChange: (key: string, value: number) => void;
  categories: StatCategory[];
  statsByCategory: Map<string, StatDefinition[]>;
  theme: 'dark' | 'light';
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const PlayerStatRow: React.FC<PlayerStatRowProps> = React.memo(({
  player,
  stats,
  played,
  onPlayedChange,
  onStatChange,
  categories,
  statsByCategory,
  theme,
  isExpanded,
  onToggleExpand
}) => {
  const isDark = theme === 'dark';
  
  // Calculate quick totals for collapsed view
  const quickTotals = useMemo(() => {
    const totals: string[] = [];
    // Show first 4 non-zero stats
    Object.entries(stats).forEach(([key, val]) => {
      if (val > 0 && totals.length < 4) {
        totals.push(`${key.replace(/([A-Z])/g, ' $1').trim().split(' ').map(w => w[0]).join('')}: ${val}`);
      }
    });
    return totals.join(' | ') || 'No stats';
  }, [stats]);
  
  return (
    <div className={`rounded-lg overflow-hidden mb-2 ${
      isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-white border border-slate-200'
    }`}>
      {/* Player Header Row */}
      <div 
        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-opacity-80 ${
          isDark ? 'hover:bg-zinc-700/50' : 'hover:bg-slate-50'
        }`}
        onClick={onToggleExpand}
      >
        {/* Played Checkbox */}
        <label 
          className="flex items-center gap-2 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={played}
            onChange={(e) => onPlayedChange(e.target.checked)}
            className="w-4 h-4 rounded border-zinc-600 text-purple-500 focus:ring-purple-500"
          />
        </label>
        
        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
              #{player.number || '?'}
            </span>
            <span className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {player.firstName && player.lastName 
                ? `${player.firstName} ${player.lastName}` 
                : player.name || 'Unknown Player'}
            </span>
            {player.position && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-slate-200 text-slate-600'
              }`}>
                {player.position}
              </span>
            )}
          </div>
          {!isExpanded && played && (
            <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              {quickTotals}
            </p>
          )}
        </div>
        
        {/* Expand Button */}
        <button className={`p-1 rounded ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>
      
      {/* Expanded Stat Entry */}
      {isExpanded && played && (
        <div className={`p-3 pt-0 space-y-4 ${isDark ? 'border-t border-zinc-700' : 'border-t border-slate-200'}`}>
          {categories.filter(cat => cat.key !== 'participation').map(category => {
            const categoryStats = statsByCategory.get(category.key) || [];
            // Filter out calculated stats - those are auto-computed
            const editableStats = categoryStats.filter(s => !s.calculated);
            
            if (editableStats.length === 0) return null;
            
            return (
              <div key={category.key}>
                <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${
                  isDark ? 'text-zinc-400' : 'text-slate-500'
                }`}>
                  {category.label}
                </h4>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {editableStats.map(stat => (
                    <StatInput
                      key={stat.key}
                      statDef={stat}
                      value={stats[stat.key] || 0}
                      onChange={(val) => onStatChange(stat.key, val)}
                      theme={theme}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Not Played Message */}
      {isExpanded && !played && (
        <div className={`p-4 text-center ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
          <p className="text-sm">Check the box to mark player as played and enter stats</p>
        </div>
      )}
    </div>
  );
});

PlayerStatRow.displayName = 'PlayerStatRow';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface GameStatsEntryV2Props {
  readOnly?: boolean; // If true, hide edit controls (for parent view)
}

const GameStatsEntryV2: React.FC<GameStatsEntryV2Props> = ({ readOnly = false }) => {
  const { teamData, userData } = useAuth();
  const { theme } = useTheme();
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const isDark = theme === 'dark';
  
  // State
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Stats data: gameId -> playerId -> stats
  const [gameStats, setGameStats] = useState<Map<string, Map<string, GameStatV2>>>(new Map());
  
  // Local edits (before save)
  const [localEdits, setLocalEdits] = useState<Map<string, GameStatV2>>(new Map());
  
  // Active season/program context
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  
  // Sport config
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

  // =============================================================================
  // LOAD DATA
  // =============================================================================
  
  useEffect(() => {
    if (!teamData?.id) {
      setLoading(false);
      return;
    }

    // Load players
    const playersQuery = query(
      collection(db, 'teams', teamData.id, 'players'),
      orderBy('number', 'asc')
    );
    
    const unsubPlayers = onSnapshot(playersQuery, (snapshot) => {
      const playersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      setPlayers(playersData);
    });

    // Load games from program/season
    const loadGames = async () => {
      if (!teamData.programId) {
        setLoading(false);
        return;
      }
      
      try {
        // Find active season
        const seasonsRef = collection(db, 'programs', teamData.programId, 'seasons');
        const seasonsSnap = await getDocs(seasonsRef);
        const seasons = seasonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const activeSeason = seasons.find((s: any) => s.status === 'active') ||
                             seasons.find((s: any) => s.status !== 'completed') ||
                             seasons[0];
        
        if (!activeSeason) {
          setGames([]);
          setLoading(false);
          return;
        }
        
        setActiveSeasonId(activeSeason.id);
        
        // Listen to games
        const gamesRef = collection(db, 'programs', teamData.programId, 'seasons', activeSeason.id, 'games');
        const unsubGames = onSnapshot(gamesRef, async (snapshot) => {
          const gamesData: Game[] = [];
          
          // Check which games have stats entered
          const statsPromises = snapshot.docs.map(async (d) => {
            const statsRef = collection(db, 'programs', teamData.programId!, 'seasons', activeSeason.id, 'games', d.id, 'stats');
            const statsSnap = await getDocs(statsRef);
            return { gameId: d.id, hasStats: !statsSnap.empty };
          });
          const statsResults = await Promise.all(statsPromises);
          const statsMap = new Map(statsResults.map(r => [r.gameId, r.hasStats]));
          
          snapshot.docs.forEach(d => {
            const data = d.data();
            
            // Only include games where this team plays
            const isHome = data.homeTeamId === teamData.id;
            const isAway = data.awayTeamId === teamData.id;
            if (!isHome && !isAway) return;
            
            gamesData.push({
              id: d.id,
              teamId: teamData.id,
              date: data.weekDate || '',
              week: data.week,  // Include week number
              opponent: isHome ? data.awayTeamName : data.homeTeamName,
              isHome,
              teamScore: isHome ? (data.homeScore ?? 0) : (data.awayScore ?? 0),
              opponentScore: isHome ? (data.awayScore ?? 0) : (data.homeScore ?? 0),
              location: data.location || '',
              status: data.status || 'scheduled',
              season: new Date().getFullYear(),
              hasStats: statsMap.get(d.id) || false,  // Include hasStats flag
              // Quarter scores - map to team perspective
              homeQ1: data.homeQ1,
              homeQ2: data.homeQ2,
              homeQ3: data.homeQ3,
              homeQ4: data.homeQ4,
              homeOT: data.homeOT,
              awayQ1: data.awayQ1,
              awayQ2: data.awayQ2,
              awayQ3: data.awayQ3,
              awayQ4: data.awayQ4,
              awayOT: data.awayOT,
            } as Game);
          });
          
          // Sort by week (ascending) for clarity
          gamesData.sort((a, b) => ((a as any).week || 0) - ((b as any).week || 0));
          setGames(gamesData);
          setLoading(false);
        });
        
        return () => unsubGames();
      } catch (err) {
        console.error('Error loading games:', err);
        setError('Failed to load games');
        setLoading(false);
      }
    };
    
    loadGames();
    
    return () => unsubPlayers();
  }, [teamData?.id, teamData?.programId]);

  // Load stats when game is expanded
  useEffect(() => {
    if (!expandedGameId || !teamData?.id || !teamData?.programId || !activeSeasonId) return;
    
    const loadStats = async () => {
      try {
        const stats = await getGameStatsByTeam(
          teamData.programId!,
          activeSeasonId,
          expandedGameId,
          teamData.id
        );
        
        // Convert to map
        const statsMap = new Map<string, GameStatV2>();
        stats.forEach(s => statsMap.set(s.playerId, s));
        
        setGameStats(prev => {
          const newMap = new Map(prev);
          newMap.set(expandedGameId, statsMap);
          return newMap;
        });
        
        // Initialize local edits with existing stats
        const editMap = new Map<string, GameStatV2>();
        stats.forEach(s => editMap.set(`${expandedGameId}_${s.playerId}`, s));
        setLocalEdits(prev => new Map([...prev, ...editMap]));
        
      } catch (err) {
        console.error('Error loading game stats:', err);
      }
    };
    
    loadStats();
  }, [expandedGameId, teamData?.id, teamData?.programId, activeSeasonId]);

  // =============================================================================
  // HANDLERS
  // =============================================================================
  
  const getLocalEditKey = (gameId: string, playerId: string) => `${gameId}_${playerId}`;
  
  const getOrCreatePlayerStats = useCallback((gameId: string, player: Player): GameStatV2 => {
    const key = getLocalEditKey(gameId, player.id);
    const existing = localEdits.get(key);
    
    if (existing) return existing;
    
    // Find game info
    const game = games.find(g => g.id === gameId);
    
    // Build player name - handle both firstName/lastName and legacy name field
    const playerName = player.firstName && player.lastName
      ? `${player.firstName} ${player.lastName}`
      : player.name || 'Unknown Player';
    
    return createEmptyGameStat(
      player.id,
      playerName,
      player.number || 0,
      teamData!.id,
      teamData!.name || '',
      gameId,
      teamData!.programId!,
      activeSeasonId!,
      sport,
      game?.date || '',
      game?.opponent || '',
      game?.isHome ?? true
    );
  }, [localEdits, games, teamData, activeSeasonId, sport]);

  const handlePlayedChange = useCallback((gameId: string, player: Player, played: boolean) => {
    const key = getLocalEditKey(gameId, player.id);
    const current = getOrCreatePlayerStats(gameId, player);
    
    setLocalEdits(prev => {
      const newMap = new Map(prev);
      newMap.set(key, { ...current, played });
      return newMap;
    });
    
    setHasUnsavedChanges(true);
  }, [getOrCreatePlayerStats, setHasUnsavedChanges]);

  const handleStatChange = useCallback((gameId: string, player: Player, statKey: string, value: number) => {
    const key = getLocalEditKey(gameId, player.id);
    const current = getOrCreatePlayerStats(gameId, player);
    
    setLocalEdits(prev => {
      const newMap = new Map(prev);
      const newStats = { ...current.stats, [statKey]: value };
      newMap.set(key, { ...current, stats: newStats, played: true });
      return newMap;
    });
    
    setHasUnsavedChanges(true);
  }, [getOrCreatePlayerStats, setHasUnsavedChanges]);

  const handleSave = async () => {
    if (!expandedGameId || !userData?.uid || !teamData?.programId || !activeSeasonId) return;
    
    setSaving(true);
    setError(null);
    
    try {
      // Get all edits for this game
      const gameEdits: GameStatV2[] = [];
      localEdits.forEach((stat, key) => {
        if (key.startsWith(`${expandedGameId}_`)) {
          gameEdits.push(stat);
        }
      });
      
      // Only save players who played
      const toSave = gameEdits.filter(s => s.played);
      
      if (toSave.length === 0) {
        setError('No player stats to save. Mark players as played first.');
        setSaving(false);
        return;
      }
      
      await saveGameStatsBatch(toSave, userData.uid, userData.name || 'Coach');
      
      setSuccessMessage(`Saved stats for ${toSave.length} players!`);
      setHasUnsavedChanges(false);
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Error saving stats:', err);
      const errorMessage = err?.message || err?.code || 'Unknown error';
      setError(`Failed to save stats: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleGameClick = (gameId: string, status?: string) => {
    if (status !== 'completed') {
      // Can't enter stats for non-completed games
      return;
    }
    
    if (expandedGameId === gameId) {
      setExpandedGameId(null);
      setExpandedPlayerId(null);
    } else {
      setExpandedGameId(gameId);
      setExpandedPlayerId(null);
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================
  
  if (loading) {
    return (
      <div className={`flex items-center justify-center py-20 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!teamData?.programId) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
        <h3 className="text-lg font-semibold mb-2">No Program Connected</h3>
        <p className="text-sm">Your team must be part of a program to enter game stats.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-purple-500" />
          {readOnly ? 'Game Stats' : 'Game Stats Entry'}
        </h2>
        
        {!readOnly && expandedGameId && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              saving
                ? 'bg-zinc-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white'
            }`}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Stats'}
          </button>
        )}
      </div>
      
      {/* Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
          <Check className="w-5 h-5" />
          {successMessage}
        </div>
      )}
      
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Games List */}
      {games.length === 0 ? (
        <div className={`text-center py-12 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-slate-100'}`}>
          <Calendar className="w-12 h-12 mx-auto mb-4 text-zinc-500" />
          <h3 className="text-lg font-semibold mb-2">No Games Scheduled</h3>
          <p className="text-sm text-zinc-500">Games will appear here when scheduled by the commissioner.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {games.map(game => {
            const isExpanded = expandedGameId === game.id;
            const isCompleted = game.status === 'completed';
            const isWin = game.teamScore > game.opponentScore;
            const isLoss = game.teamScore < game.opponentScore;
            
            return (
              <div
                key={game.id}
                className={`rounded-xl overflow-hidden transition-all ${
                  isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-white border border-slate-200 shadow-sm'
                }`}
              >
                {/* Game Header */}
                <div
                  onClick={() => handleGameClick(game.id, game.status)}
                  className={`p-4 flex items-center gap-4 ${
                    isCompleted ? 'cursor-pointer hover:bg-opacity-80' : 'cursor-not-allowed opacity-60'
                  } ${isDark ? 'hover:bg-zinc-700/30' : 'hover:bg-slate-50'}`}
                >
                  {/* Status Indicator */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                    isCompleted
                      ? isWin
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isLoss
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-400'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}>
                    {isCompleted ? (isWin ? 'W' : isLoss ? 'L' : 'T') : '⏳'}
                  </div>
                  
                  {/* Game Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Week Badge */}
                      {(game as any).week && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                        }`}>
                          W{(game as any).week}
                        </span>
                      )}
                      <span className="font-semibold">
                        {game.isHome ? 'vs' : '@'} {game.opponent}
                      </span>
                      {isCompleted && (
                        <span className={`text-sm font-bold ${
                          isWin ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-amber-400'
                        }`}>
                          {game.teamScore} - {game.opponentScore}
                        </span>
                      )}
                    </div>
                    <div className={`text-xs flex items-center gap-3 mt-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatEventDate(game.date)}
                      </span>
                      {game.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {game.location}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Stats Indicator - shows if stats have been entered */}
                  {isCompleted && (
                    <div className={`flex items-center gap-2`}>
                      {(game as any).hasStats ? (
                        <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                          isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          <Check className="w-3 h-3" />
                          Stats ✓
                        </span>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                          isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                        }`}>
                          <AlertTriangle className="w-3 h-3" />
                          No Stats
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Expand Button */}
                  {isCompleted && (
                    <div className={isDark ? 'text-zinc-400' : 'text-slate-400'}>
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  )}
                  
                  {!isCompleted && (
                    <span className={`text-xs px-2 py-1 rounded ${
                      isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {game.status === 'live' ? 'In Progress' : 'Upcoming'}
                    </span>
                  )}
                </div>
                
                {/* Expanded Stats Entry */}
                {isExpanded && isCompleted && (
                  <div className={`p-4 ${isDark ? 'border-t border-zinc-700 bg-zinc-900/50' : 'border-t border-slate-200 bg-slate-50'}`}>
                    
                    {/* NFL-Style Game Recap */}
                    <GameRecap
                      gameId={game.id}
                      teamName={teamData?.name || 'Team'}
                      opponentName={game.opponent}
                      teamScore={game.teamScore}
                      opponentScore={game.opponentScore}
                      isHome={game.isHome}
                      playerStats={Array.from(localEdits.values()).filter(s => s.gameId === game.id)}
                      teamStats={{
                        // Map quarter scores to team perspective
                        q1Score: game.isHome ? game.homeQ1 : game.awayQ1,
                        q2Score: game.isHome ? game.homeQ2 : game.awayQ2,
                        q3Score: game.isHome ? game.homeQ3 : game.awayQ3,
                        q4Score: game.isHome ? game.homeQ4 : game.awayQ4,
                        otScore: game.isHome ? game.homeOT : game.awayOT,
                        oppQ1Score: game.isHome ? game.awayQ1 : game.homeQ1,
                        oppQ2Score: game.isHome ? game.awayQ2 : game.homeQ2,
                        oppQ3Score: game.isHome ? game.awayQ3 : game.homeQ3,
                        oppQ4Score: game.isHome ? game.awayQ4 : game.homeQ4,
                        oppOtScore: game.isHome ? game.awayOT : game.homeOT,
                      }}
                      sport={sport}
                      className="mb-6"
                    />
                    
                    {/* Edit Player Stats - Only show for coaches */}
                    {!readOnly && (
                      <>
                        <div className="flex items-center gap-2 mb-4">
                          <Users className="w-4 h-4 text-purple-500" />
                          <h3 className="font-semibold">Edit Player Stats</h3>
                          <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                            ({players.length} players)
                          </span>
                        </div>
                    
                        {players.length === 0 ? (
                          <p className="text-center py-8 text-zinc-500">
                            No players on roster. Add players to enter stats.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {players.map(player => {
                              const key = getLocalEditKey(game.id, player.id);
                              const stats = localEdits.get(key) || getOrCreatePlayerStats(game.id, player);
                          
                              return (
                                <PlayerStatRow
                                  key={player.id}
                                  player={player}
                                  stats={stats.stats}
                                  played={stats.played}
                                  onPlayedChange={(played) => handlePlayedChange(game.id, player, played)}
                                  onStatChange={(statKey, value) => handleStatChange(game.id, player, statKey, value)}
                                  categories={categories}
                                  statsByCategory={statsByCategory}
                                  theme={theme}
                                  isExpanded={expandedPlayerId === player.id}
                                  onToggleExpand={() => setExpandedPlayerId(
                                    expandedPlayerId === player.id ? null : player.id
                                  )}
                                />
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GameStatsEntryV2;
