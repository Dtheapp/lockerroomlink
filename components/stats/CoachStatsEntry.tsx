import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, onSnapshot, orderBy, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { PlayerSeasonStats, Player } from '../../types';
import { Save, TrendingUp, Users, ChevronDown, ChevronUp, Check, Search, Sword, Shield, Target, AlertCircle, AtSign, Trophy, Star } from 'lucide-react';
import { getStats, getSportConfig, type StatConfig } from '../../config/sportConfig';

// Stat Input Component - defined OUTSIDE main component to prevent re-renders
interface StatInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  color?: string;
}

const StatInput: React.FC<StatInputProps> = ({ label, value, onChange, color = 'text-white' }) => {
  const [localValue, setLocalValue] = useState(value === 0 ? '' : value.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Only sync from parent when value actually changes AND input is not focused
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(value === 0 ? '' : value.toString());
    }
  }, [value]);

  return (
    <div className="flex-1 min-w-[60px]">
      <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</label>
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
          // Only commit to parent on blur
          const numVal = parseInt(localValue, 10) || 0;
          onChange(numVal);
        }}
        placeholder="0"
        className={`w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-center font-bold ${color} focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm placeholder-zinc-600`}
      />
    </div>
  );
};

const CoachStatsEntry: React.FC = () => {
  const { teamData, userData } = useAuth();
  const { theme } = useTheme();
  const currentYear = new Date().getFullYear();
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasonStats, setSeasonStats] = useState<Map<string, PlayerSeasonStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Local edits before saving
  const [editedStats, setEditedStats] = useState<Map<string, Partial<PlayerSeasonStats>>>(new Map());

  // Load players from the team roster
  useEffect(() => {
    if (!teamData?.id) {
      setLoading(false);
      return;
    }
    
    const playersQuery = query(
      collection(db, 'teams', teamData.id, 'players'),
      orderBy('number', 'asc')
    );
    
    const unsubPlayers = onSnapshot(playersQuery, (snapshot) => {
      const playersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      setPlayers(playersData);
    });

    // Load current season stats
    const statsQuery = query(
      collection(db, 'teams', teamData.id, 'seasonStats')
    );
    
    const unsubStats = onSnapshot(statsQuery, (snapshot) => {
      const statsMap = new Map<string, PlayerSeasonStats>();
      snapshot.docs.forEach(d => {
        const stat = { id: d.id, ...d.data() } as PlayerSeasonStats;
        // Only load current year stats
        if (stat.season === currentYear) {
          statsMap.set(stat.playerId, stat);
        }
      });
      setSeasonStats(statsMap);
      setLoading(false);
    });

    return () => {
      unsubPlayers();
      unsubStats();
    };
  }, [teamData?.id, currentYear]);

  // Filter players by search
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return players;
    const q = searchQuery.toLowerCase();
    return players.filter(p => 
      p.name.toLowerCase().includes(q) ||
      (p.number?.toString() || '').includes(q) ||
      (p.position?.toLowerCase() || '').includes(q)
    );
  }, [players, searchQuery]);

  // Get stats for a player (existing or default)
  const getPlayerStats = (playerId: string): Partial<PlayerSeasonStats> => {
    // First check local edits
    if (editedStats.has(playerId)) {
      return { ...getDefaultStats(), ...seasonStats.get(playerId), ...editedStats.get(playerId) };
    }
    // Then check saved stats
    if (seasonStats.has(playerId)) {
      return seasonStats.get(playerId)!;
    }
    // Return defaults
    return getDefaultStats();
  };

  // Get sport-specific stats config
  const sportStats = useMemo(() => getStats(teamData?.sport), [teamData?.sport]);
  const sportConfig = useMemo(() => getSportConfig(teamData?.sport), [teamData?.sport]);

  // Generate default stats based on sport
  const getDefaultStats = (): Partial<PlayerSeasonStats> => {
    const defaults: Record<string, number> = {};
    sportStats.forEach(stat => {
      defaults[stat.key] = 0;
    });
    // Always include gamesPlayed and sportsmanship
    defaults.gp = 0;
    defaults.spts = 0;
    return defaults as Partial<PlayerSeasonStats>;
  };

  // Group stats by category for display
  const groupedStats = useMemo(() => {
    const groups: { category: string; stats: StatConfig[]; icon: React.ReactNode; color: string }[] = [];
    const uncategorized: StatConfig[] = [];
    const categories = new Map<string, StatConfig[]>();
    
    sportStats.forEach(stat => {
      if (stat.key === 'gamesPlayed') return; // Handle separately
      if (stat.category) {
        if (!categories.has(stat.category)) {
          categories.set(stat.category, []);
        }
        categories.get(stat.category)!.push(stat);
      } else {
        uncategorized.push(stat);
      }
    });

    // Map categories to icons/colors based on sport
    const categoryConfig: Record<string, { icon: React.ReactNode; color: string }> = {
      'Offense': { icon: <Sword className="w-4 h-4 text-orange-500" />, color: 'orange' },
      'Defense': { icon: <Shield className="w-4 h-4 text-emerald-500" />, color: 'emerald' },
      'Special Teams': { icon: <Target className="w-4 h-4 text-yellow-500" />, color: 'yellow' },
      // Basketball
      'Scoring': { icon: <Trophy className="w-4 h-4 text-orange-500" />, color: 'orange' },
      'Rebounds': { icon: <Target className="w-4 h-4 text-cyan-500" />, color: 'cyan' },
      // Cheer
      'Competition': { icon: <Trophy className="w-4 h-4 text-orange-500" />, color: 'orange' },
      'Skills': { icon: <Star className="w-4 h-4 text-purple-500" />, color: 'purple' },
    };

    categories.forEach((stats, category) => {
      const config = categoryConfig[category] || { icon: <Target className="w-4 h-4 text-zinc-500" />, color: 'zinc' };
      groups.push({ category, stats, ...config });
    });

    if (uncategorized.length > 0) {
      groups.push({ 
        category: 'Stats', 
        stats: uncategorized, 
        icon: <TrendingUp className="w-4 h-4 text-cyan-500" />, 
        color: 'cyan' 
      });
    }

    return groups;
  }, [sportStats]);

  // Handle stat change - now accepts number directly
  const handleStatChange = (playerId: string, field: keyof PlayerSeasonStats, value: number) => {
    setEditedStats(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(playerId) || {};
      newMap.set(playerId, { ...current, [field]: value });
      return newMap;
    });
  };

  // Save player stats
  const handleSavePlayer = async (player: Player) => {
    if (!teamData?.id || !userData?.uid) return;
    
    setSaving(player.id);
    try {
      const stats = getPlayerStats(player.id);
      const docId = `${player.id}_${currentYear}`;
      const docRef = doc(db, 'teams', teamData.id, 'seasonStats', docId);
      
      await setDoc(docRef, {
        playerId: player.id,
        playerName: player.name,
        playerNumber: player.number || 0,
        teamId: teamData.id,
        teamName: teamData.name,
        season: currentYear,
        ...stats,
        updatedAt: serverTimestamp(),
        updatedBy: userData.uid,
      }, { merge: true });

      // Also update the player's quick stats on their profile (sport-aware)
      const playerRef = doc(db, 'teams', teamData.id, 'players', player.id);
      const quickStats: Record<string, number> = {};
      
      // Get the first 2 stats from sportStats for quick display
      sportStats.slice(0, 2).forEach(stat => {
        if (stat.key !== 'gamesPlayed') {
          quickStats[stat.key] = (stats as any)[stat.key] || 0;
        }
      });
      
      await setDoc(playerRef, { stats: quickStats }, { merge: true });

      // Clear local edits for this player
      setEditedStats(prev => {
        const newMap = new Map(prev);
        newMap.delete(player.id);
        return newMap;
      });

      setSuccessMessage(`${player.name}'s stats saved!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error saving stats:', error);
    } finally {
      setSaving(null);
    }
  };

  // Check if player has unsaved changes
  const hasUnsavedChanges = (playerId: string): boolean => {
    return editedStats.has(playerId);
  };

  if (!teamData) {
    return (
      <div className={`rounded-xl p-12 text-center border ${
        theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <AlertCircle className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-zinc-700' : 'text-slate-300'}`} />
        <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No Team Assigned</h3>
        <p className={theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}>Please contact an admin to assign you to a team.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-orange-500" />
          <div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Stats Entry</h2>
            <p className={`text-sm ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>{currentYear} Season</p>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none w-64 ${
              theme === 'dark' 
                ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' 
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2">
          <Check className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      {/* Player Count */}
      <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>
        <Users className="w-4 h-4" />
        <span className="text-sm">{filteredPlayers.length} players on roster</span>
      </div>

      {/* Player List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className={`rounded-xl p-12 text-center border ${
          theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <Users className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-zinc-700' : 'text-slate-300'}`} />
          <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No Players Found</h3>
          <p className={theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}>
            {searchQuery ? 'Try a different search term.' : 'Add players to your roster first.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPlayers.map(player => {
            const stats = getPlayerStats(player.id);
            const isExpanded = expandedPlayerId === player.id;
            const hasChanges = hasUnsavedChanges(player.id);
            
            // Get first 3 stats for quick preview (sport-specific)
            const previewStats = sportStats.slice(0, 3).filter(s => s.key !== 'gamesPlayed');

            return (
              <div 
                key={player.id}
                className={`rounded-xl border overflow-hidden transition-all ${
                  hasChanges 
                    ? 'border-orange-500/50' 
                    : theme === 'dark' ? 'border-zinc-800' : 'border-slate-200'
                } ${theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}`}
              >
                {/* Player Header */}
                <div 
                  className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                    theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
                >
                  <div className="flex items-center gap-4">
                    {player.photoUrl ? (
                      <img src={player.photoUrl} alt={player.name} className={`w-12 h-12 rounded-full object-cover border-2 ${
                        theme === 'dark' ? 'border-zinc-700' : 'border-slate-200'
                      }`} />
                    ) : (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                        theme === 'dark' ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {player.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className={`font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {player.name}
                        {hasChanges && <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded">Unsaved</span>}
                      </h3>
                      {player.username && (
                        <p className="text-xs text-purple-400 flex items-center gap-0.5">
                          <AtSign className="w-3 h-3" />{player.username}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <span>#{player.number || '?'}</span>
                        <span>•</span>
                        <span>{player.position || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Quick Stats Preview - Dynamic */}
                    <div className="hidden sm:flex items-center gap-4 text-sm">
                      {previewStats.slice(0, 3).map((statConfig, idx) => (
                        <div key={statConfig.key} className="text-center">
                          <p className={`font-bold ${idx === 0 ? 'text-orange-400' : idx === 1 ? 'text-cyan-400' : 'text-emerald-400'}`}>
                            {(stats as any)[statConfig.key] || 0}
                          </p>
                          <p className="text-[10px] text-zinc-500">{statConfig.shortLabel}</p>
                        </div>
                      ))}
                    </div>
                    
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-zinc-500" />
                    )}
                  </div>
                </div>

                {/* Expanded Stats Entry - Dynamic based on sport */}
                {isExpanded && (
                  <div className={`border-t p-4 space-y-4 animate-in slide-in-from-top-2 ${
                    theme === 'dark' ? 'border-zinc-800' : 'border-slate-200'
                  }`}>
                    {/* Games Played (universal) */}
                    <div className="flex items-center gap-4">
                      <div className="w-32">
                        <StatInput 
                          label="Games Played" 
                          value={stats.gp || 0} 
                          onChange={(v) => handleStatChange(player.id, 'gp', v)} 
                          color="text-white" 
                        />
                      </div>
                    </div>

                    {/* Dynamic Stats by Category */}
                    {groupedStats.map((group) => (
                      <div key={group.category}>
                        <div className="flex items-center gap-2 mb-3">
                          {group.icon}
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{group.category}</span>
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                          {group.stats.map((statConfig, idx) => {
                            const colorClass = idx === 0 ? `text-${group.color}-400` : 
                                              idx < 3 ? 'text-cyan-400' : 'text-zinc-300';
                            return (
                              <StatInput 
                                key={statConfig.key}
                                label={statConfig.shortLabel} 
                                value={(stats as any)[statConfig.key] || 0} 
                                onChange={(v) => handleStatChange(player.id, statConfig.key as keyof PlayerSeasonStats, v)} 
                                color={colorClass}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Sportsmanship (universal) */}
                    <div className={`pt-3 border-t ${theme === 'dark' ? 'border-zinc-800' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <div className="w-40">
                          <StatInput 
                            label="Sportsmanship Pts" 
                            value={stats.spts || 0} 
                            onChange={(v) => handleStatChange(player.id, 'spts', v)} 
                            color="text-lime-400" 
                          />
                        </div>
                        
                        {/* Save Button */}
                        <button
                          onClick={() => handleSavePlayer(player)}
                          disabled={saving === player.id}
                          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                            hasChanges 
                              ? 'bg-orange-600 hover:bg-orange-500 text-white' 
                              : theme === 'dark' 
                                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          } disabled:opacity-50`}
                        >
                          {saving === player.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              Save Stats
                            </>
                          )}
                        </button>
                      </div>
                    </div>
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

export default CoachStatsEntry;
