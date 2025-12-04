import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { PlayerSeasonStats, Player } from '../../types';
import { Save, TrendingUp, Users, ChevronDown, ChevronUp, Check, Search, Sword, Shield, Target, AlertCircle } from 'lucide-react';

const CoachStatsEntry: React.FC = () => {
  const { teamData, userData } = useAuth();
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

  const getDefaultStats = (): Partial<PlayerSeasonStats> => ({
    gp: 0, tds: 0, rushYards: 0, rushAttempts: 0, passYards: 0, passAttempts: 0,
    passCompletions: 0, rec: 0, recYards: 0, tackles: 0, soloTackles: 0,
    assistTackles: 0, sacks: 0, int: 0, intYards: 0, ff: 0, fr: 0,
    passDefended: 0, kickReturnYards: 0, puntReturnYards: 0, kickReturnTds: 0,
    puntReturnTds: 0, spts: 0
  });

  // Handle stat change
  const handleStatChange = (playerId: string, field: keyof PlayerSeasonStats, value: string) => {
    const numValue = parseInt(value) || 0;
    setEditedStats(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(playerId) || {};
      newMap.set(playerId, { ...current, [field]: numValue });
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

      // Also update the player's quick stats on their profile
      const playerRef = doc(db, 'teams', teamData.id, 'players', player.id);
      await setDoc(playerRef, {
        stats: {
          td: stats.tds || 0,
          tkl: stats.tackles || 0,
        }
      }, { merge: true });

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

  // Stat input component
  const StatInput = ({ 
    label, 
    value, 
    onChange, 
    color = 'text-white',
    small = false 
  }: { 
    label: string; 
    value: number; 
    onChange: (val: string) => void;
    color?: string;
    small?: boolean;
  }) => (
    <div className={small ? 'flex-1 min-w-[60px]' : ''}>
      <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-center font-bold ${color} focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm`}
      />
    </div>
  );

  if (!teamData) {
    return (
      <div className="bg-zinc-900 rounded-xl p-12 text-center border border-zinc-800">
        <AlertCircle className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">No Team Assigned</h3>
        <p className="text-zinc-500">Please contact an admin to assign you to a team.</p>
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
            <h2 className="text-2xl font-bold text-white">Stats Entry</h2>
            <p className="text-sm text-zinc-500">{currentYear} Season</p>
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
            className="pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-orange-500 outline-none w-64"
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
      <div className="flex items-center gap-2 text-zinc-400">
        <Users className="w-4 h-4" />
        <span className="text-sm">{filteredPlayers.length} players on roster</span>
      </div>

      {/* Player List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl p-12 text-center border border-zinc-800">
          <Users className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Players Found</h3>
          <p className="text-zinc-500">
            {searchQuery ? 'Try a different search term.' : 'Add players to your roster first.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPlayers.map(player => {
            const stats = getPlayerStats(player.id);
            const isExpanded = expandedPlayerId === player.id;
            const hasChanges = hasUnsavedChanges(player.id);
            const totalYards = (stats.rushYards || 0) + (stats.recYards || 0);

            return (
              <div 
                key={player.id}
                className={`bg-zinc-900 rounded-xl border ${hasChanges ? 'border-orange-500/50' : 'border-zinc-800'} overflow-hidden transition-all`}
              >
                {/* Player Header */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
                >
                  <div className="flex items-center gap-4">
                    {player.photoUrl ? (
                      <img src={player.photoUrl} alt={player.name} className="w-12 h-12 rounded-full object-cover border-2 border-zinc-700" />
                    ) : (
                      <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-lg font-bold text-zinc-400">
                        {player.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        {player.name}
                        {hasChanges && <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded">Unsaved</span>}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <span>#{player.number || '?'}</span>
                        <span>•</span>
                        <span>{player.position || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Quick Stats Preview */}
                    <div className="hidden sm:flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="text-orange-400 font-bold">{stats.tds || 0}</p>
                        <p className="text-[10px] text-zinc-500">TDs</p>
                      </div>
                      <div className="text-center">
                        <p className="text-cyan-400 font-bold">{totalYards}</p>
                        <p className="text-[10px] text-zinc-500">YDS</p>
                      </div>
                      <div className="text-center">
                        <p className="text-emerald-400 font-bold">{stats.tackles || 0}</p>
                        <p className="text-[10px] text-zinc-500">TKL</p>
                      </div>
                    </div>
                    
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-zinc-500" />
                    )}
                  </div>
                </div>

                {/* Expanded Stats Entry */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 p-4 space-y-4 animate-in slide-in-from-top-2">
                    {/* Games Played */}
                    <div className="flex items-center gap-4">
                      <div className="w-32">
                        <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1">Games Played</label>
                        <input
                          type="number"
                          min="0"
                          value={stats.gp || 0}
                          onChange={(e) => handleStatChange(player.id, 'gp', e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-center font-bold text-white text-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Offensive Stats */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Sword className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Offense</span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                        <StatInput label="TDs" value={stats.tds || 0} onChange={(v) => handleStatChange(player.id, 'tds', v)} color="text-orange-400" />
                        <StatInput label="Rush Yds" value={stats.rushYards || 0} onChange={(v) => handleStatChange(player.id, 'rushYards', v)} color="text-cyan-400" />
                        <StatInput label="Rush Att" value={stats.rushAttempts || 0} onChange={(v) => handleStatChange(player.id, 'rushAttempts', v)} />
                        <StatInput label="Rec" value={stats.rec || 0} onChange={(v) => handleStatChange(player.id, 'rec', v)} />
                        <StatInput label="Rec Yds" value={stats.recYards || 0} onChange={(v) => handleStatChange(player.id, 'recYards', v)} color="text-cyan-400" />
                        <StatInput label="Pass Yds" value={stats.passYards || 0} onChange={(v) => handleStatChange(player.id, 'passYards', v)} color="text-cyan-400" />
                        <StatInput label="Comp/Att" value={stats.passCompletions || 0} onChange={(v) => handleStatChange(player.id, 'passCompletions', v)} />
                      </div>
                    </div>

                    {/* Defensive Stats */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Defense</span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                        <StatInput label="Tackles" value={stats.tackles || 0} onChange={(v) => handleStatChange(player.id, 'tackles', v)} color="text-emerald-400" />
                        <StatInput label="Solo" value={stats.soloTackles || 0} onChange={(v) => handleStatChange(player.id, 'soloTackles', v)} />
                        <StatInput label="Assists" value={stats.assistTackles || 0} onChange={(v) => handleStatChange(player.id, 'assistTackles', v)} />
                        <StatInput label="Sacks" value={stats.sacks || 0} onChange={(v) => handleStatChange(player.id, 'sacks', v)} color="text-purple-400" />
                        <StatInput label="INTs" value={stats.int || 0} onChange={(v) => handleStatChange(player.id, 'int', v)} color="text-red-400" />
                        <StatInput label="FF" value={stats.ff || 0} onChange={(v) => handleStatChange(player.id, 'ff', v)} color="text-orange-400" />
                        <StatInput label="FR" value={stats.fr || 0} onChange={(v) => handleStatChange(player.id, 'fr', v)} />
                      </div>
                    </div>

                    {/* Special Teams */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Special Teams</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <StatInput label="KR Yds" value={stats.kickReturnYards || 0} onChange={(v) => handleStatChange(player.id, 'kickReturnYards', v)} color="text-yellow-400" />
                        <StatInput label="KR TDs" value={stats.kickReturnTds || 0} onChange={(v) => handleStatChange(player.id, 'kickReturnTds', v)} color="text-orange-400" />
                        <StatInput label="PR Yds" value={stats.puntReturnYards || 0} onChange={(v) => handleStatChange(player.id, 'puntReturnYards', v)} color="text-yellow-400" />
                        <StatInput label="PR TDs" value={stats.puntReturnTds || 0} onChange={(v) => handleStatChange(player.id, 'puntReturnTds', v)} color="text-orange-400" />
                      </div>
                    </div>

                    {/* Sportsmanship */}
                    <div className="pt-3 border-t border-zinc-800">
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
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
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
