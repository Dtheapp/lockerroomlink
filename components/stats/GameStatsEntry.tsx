import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, onSnapshot, orderBy, doc, setDoc, deleteDoc, writeBatch, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Game, GamePlayerStats, Player, PlayerSeasonStats } from '../../types';
import { Plus, Trophy, Calendar, MapPin, Users, ChevronDown, ChevronUp, Save, Trash2, X, Sword, Shield, Target, Check, Edit2, TrendingUp } from 'lucide-react';

// Helper: Format date string without timezone issues
const formatEventDate = (dateStr: string, options?: Intl.DateTimeFormatOptions) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', options || { weekday: 'short', month: 'short', day: 'numeric' });
};

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
  
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(value === 0 ? '' : value.toString());
    }
  }, [value]);

  return (
    <div className="flex-1 min-w-[55px]">
      <label className="block text-[9px] uppercase tracking-wider text-zinc-500 mb-1">{label}</label>
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
        className={`w-full bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-center font-bold ${color} focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-xs placeholder-zinc-600`}
      />
    </div>
  );
};

// Score Input Component
const ScoreInput: React.FC<{ label: string; value: number; onChange: (val: number) => void; color?: string }> = ({ label, value, onChange, color = 'text-white' }) => {
  const [localValue, setLocalValue] = useState(value === 0 ? '' : value.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(value === 0 ? '' : value.toString());
    }
  }, [value]);

  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1">{label}</label>
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
        className={`w-20 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-center font-bold text-2xl ${color} focus:ring-2 focus:ring-orange-500 outline-none`}
      />
    </div>
  );
};

const GameStatsEntry: React.FC = () => {
  const { teamData, userData } = useAuth();
  const currentYear = new Date().getFullYear();
  
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewGameForm, setShowNewGameForm] = useState(false);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [gamePlayerStats, setGamePlayerStats] = useState<Map<string, GamePlayerStats[]>>(new Map());
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // New game form state
  const [newGame, setNewGame] = useState<Partial<Game>>({
    date: new Date().toISOString().split('T')[0],
    opponent: '',
    isHome: true,
    teamScore: 0,
    opponentScore: 0,
    location: '',
    notes: '',
  });

  // Local edits for player stats in a game
  const [editedPlayerStats, setEditedPlayerStats] = useState<Map<string, Partial<GamePlayerStats>>>(new Map());
  
  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<Game | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load games and players
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

    // Load games for current season
    const gamesQuery = query(
      collection(db, 'teams', teamData.id, 'games'),
      where('season', '==', currentYear),
      orderBy('date', 'desc')
    );
    
    const unsubGames = onSnapshot(gamesQuery, (snapshot) => {
      const gamesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Game));
      setGames(gamesData);
      setLoading(false);
    });

    return () => {
      unsubPlayers();
      unsubGames();
    };
  }, [teamData?.id, currentYear]);

  // Load player stats when a game is expanded
  useEffect(() => {
    if (!expandedGameId || !teamData?.id) return;

    const statsQuery = query(
      collection(db, 'teams', teamData.id, 'games', expandedGameId, 'playerStats')
    );

    const unsub = onSnapshot(statsQuery, (snapshot) => {
      const stats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GamePlayerStats));
      setGamePlayerStats(prev => {
        const newMap = new Map(prev);
        newMap.set(expandedGameId, stats);
        return newMap;
      });
    });

    return () => unsub();
  }, [expandedGameId, teamData?.id]);

  // Calculate result from scores
  const getResult = (teamScore: number, opponentScore: number): 'W' | 'L' | 'T' => {
    if (teamScore > opponentScore) return 'W';
    if (teamScore < opponentScore) return 'L';
    return 'T';
  };

  // Add new game
  const handleAddGame = async () => {
    if (!teamData?.id || !userData?.uid || !newGame.opponent || !newGame.date) {
      alert('Please fill in opponent and date');
      return;
    }

    setSaving(true);
    try {
      const gameNumber = games.filter(g => g.season === currentYear).length + 1;
      const result = getResult(newGame.teamScore || 0, newGame.opponentScore || 0);
      
      const gameRef = doc(collection(db, 'teams', teamData.id, 'games'));
      await setDoc(gameRef, {
        teamId: teamData.id,
        season: currentYear,
        gameNumber,
        date: newGame.date,
        opponent: newGame.opponent,
        isHome: newGame.isHome ?? true,
        teamScore: newGame.teamScore || 0,
        opponentScore: newGame.opponentScore || 0,
        result,
        location: newGame.location || '',
        notes: newGame.notes || '',
        createdAt: serverTimestamp(),
        createdBy: userData.uid,
      });

      // Update team record
      await updateTeamRecord();

      setNewGame({
        date: new Date().toISOString().split('T')[0],
        opponent: '',
        isHome: true,
        teamScore: 0,
        opponentScore: 0,
        location: '',
        notes: '',
      });
      setShowNewGameForm(false);
      setSuccessMessage('Game added successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error adding game:', error);
    } finally {
      setSaving(false);
    }
  };

  // Update team record based on games
  const updateTeamRecord = async () => {
    if (!teamData?.id) return;
    
    try {
      const gamesSnapshot = await getDocs(query(
        collection(db, 'teams', teamData.id, 'games'),
        where('season', '==', currentYear)
      ));
      
      let wins = 0, losses = 0, ties = 0;
      gamesSnapshot.docs.forEach(d => {
        const game = d.data() as Game;
        if (game.result === 'W') wins++;
        else if (game.result === 'L') losses++;
        else ties++;
      });

      await setDoc(doc(db, 'teams', teamData.id), {
        record: { wins, losses, ties }
      }, { merge: true });
    } catch (error) {
      console.error('Error updating team record:', error);
    }
  };

  // Delete game
  const handleDeleteGame = async () => {
    if (!teamData?.id || !deleteConfirm) return;
    
    setDeleting(true);
    try {
      // Delete player stats for this game first
      const statsSnapshot = await getDocs(
        collection(db, 'teams', teamData.id, 'games', deleteConfirm.id, 'playerStats')
      );
      
      const batch = writeBatch(db);
      statsSnapshot.docs.forEach(d => {
        batch.delete(d.ref);
      });
      
      // Delete the game
      batch.delete(doc(db, 'teams', teamData.id, 'games', deleteConfirm.id));
      await batch.commit();

      // Update team record
      await updateTeamRecord();
      
      // Recalculate season stats for all players
      await recalculateAllSeasonStats();

      setDeleteConfirm(null);
      setSuccessMessage('Game deleted!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting game:', error);
    } finally {
      setDeleting(false);
    }
  };

  // Get player's stats for a specific game
  const getPlayerGameStats = (gameId: string, playerId: string): Partial<GamePlayerStats> => {
    const key = `${gameId}_${playerId}`;
    if (editedPlayerStats.has(key)) {
      const existing = gamePlayerStats.get(gameId)?.find(s => s.playerId === playerId);
      return { ...getDefaultStats(), ...existing, ...editedPlayerStats.get(key) };
    }
    const existing = gamePlayerStats.get(gameId)?.find(s => s.playerId === playerId);
    return existing || getDefaultStats();
  };

  const getDefaultStats = (): Partial<GamePlayerStats> => ({
    tds: 0, rushYards: 0, rushAttempts: 0, passYards: 0, passAttempts: 0,
    passCompletions: 0, rec: 0, recYards: 0, tackles: 0, soloTackles: 0,
    assistTackles: 0, sacks: 0, int: 0, intYards: 0, ff: 0, fr: 0,
    passDefended: 0, kickReturnYards: 0, puntReturnYards: 0, kickReturnTds: 0,
    puntReturnTds: 0, spts: 0
  });

  // Handle stat change for a player in a game
  const handlePlayerStatChange = (gameId: string, playerId: string, field: keyof GamePlayerStats, value: number) => {
    const key = `${gameId}_${playerId}`;
    setEditedPlayerStats(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(key) || {};
      newMap.set(key, { ...current, [field]: value });
      return newMap;
    });
  };

  // Check if player has unsaved changes in a game
  const hasUnsavedChanges = (gameId: string): boolean => {
    for (const key of editedPlayerStats.keys()) {
      if (key.startsWith(`${gameId}_`)) return true;
    }
    return false;
  };

  // Save all player stats for a game
  const handleSaveGameStats = async (game: Game) => {
    if (!teamData?.id || !userData?.uid) return;

    setSaving(true);
    try {
      const batch = writeBatch(db);
      
      // Get all edited stats for this game
      for (const [key, stats] of editedPlayerStats.entries()) {
        if (!key.startsWith(`${game.id}_`)) continue;
        
        const playerId = key.replace(`${game.id}_`, '');
        const player = players.find(p => p.id === playerId);
        if (!player) continue;

        const docRef = doc(db, 'teams', teamData.id, 'games', game.id, 'playerStats', playerId);
        batch.set(docRef, {
          gameId: game.id,
          playerId: player.id,
          playerName: player.name,
          playerNumber: player.number || 0,
          teamId: teamData.id,
          season: currentYear,
          ...getDefaultStats(),
          ...gamePlayerStats.get(game.id)?.find(s => s.playerId === playerId),
          ...stats,
          updatedAt: serverTimestamp(),
          updatedBy: userData.uid,
        }, { merge: true });
      }

      await batch.commit();

      // Clear edited stats for this game
      setEditedPlayerStats(prev => {
        const newMap = new Map(prev);
        for (const key of [...newMap.keys()]) {
          if (key.startsWith(`${game.id}_`)) {
            newMap.delete(key);
          }
        }
        return newMap;
      });

      // Recalculate season stats for affected players
      await recalculateSeasonStats(game.id);

      setSuccessMessage('Game stats saved!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error saving game stats:', error);
    } finally {
      setSaving(false);
    }
  };

  // Recalculate season stats for players in a specific game
  const recalculateSeasonStats = async (gameId: string) => {
    if (!teamData?.id || !userData?.uid) return;

    try {
      // Get all games for the season
      const gamesSnapshot = await getDocs(query(
        collection(db, 'teams', teamData.id, 'games'),
        where('season', '==', currentYear)
      ));

      // Build a map of player totals
      const playerTotals = new Map<string, Partial<PlayerSeasonStats>>();

      for (const gameDoc of gamesSnapshot.docs) {
        const statsSnapshot = await getDocs(
          collection(db, 'teams', teamData.id, 'games', gameDoc.id, 'playerStats')
        );

        statsSnapshot.docs.forEach(statDoc => {
          const stat = statDoc.data() as GamePlayerStats;
          const existing = playerTotals.get(stat.playerId) || {
            gp: 0, tds: 0, rushYards: 0, rushAttempts: 0, passYards: 0,
            passAttempts: 0, passCompletions: 0, rec: 0, recYards: 0,
            tackles: 0, soloTackles: 0, assistTackles: 0, sacks: 0,
            int: 0, intYards: 0, ff: 0, fr: 0, passDefended: 0,
            kickReturnYards: 0, puntReturnYards: 0, kickReturnTds: 0,
            puntReturnTds: 0, spts: 0,
            playerName: stat.playerName,
            playerNumber: stat.playerNumber,
          };

          // Check if player had any meaningful stats in this game
          const hasStats = (stat.tds || 0) > 0 || (stat.rushYards || 0) > 0 || 
            (stat.passYards || 0) > 0 || (stat.recYards || 0) > 0 || 
            (stat.tackles || 0) > 0 || (stat.rec || 0) > 0;

          playerTotals.set(stat.playerId, {
            ...existing,
            gp: (existing.gp || 0) + (hasStats ? 1 : 0),
            tds: (existing.tds || 0) + (stat.tds || 0),
            rushYards: (existing.rushYards || 0) + (stat.rushYards || 0),
            rushAttempts: (existing.rushAttempts || 0) + (stat.rushAttempts || 0),
            passYards: (existing.passYards || 0) + (stat.passYards || 0),
            passAttempts: (existing.passAttempts || 0) + (stat.passAttempts || 0),
            passCompletions: (existing.passCompletions || 0) + (stat.passCompletions || 0),
            rec: (existing.rec || 0) + (stat.rec || 0),
            recYards: (existing.recYards || 0) + (stat.recYards || 0),
            tackles: (existing.tackles || 0) + (stat.tackles || 0),
            soloTackles: (existing.soloTackles || 0) + (stat.soloTackles || 0),
            assistTackles: (existing.assistTackles || 0) + (stat.assistTackles || 0),
            sacks: (existing.sacks || 0) + (stat.sacks || 0),
            int: (existing.int || 0) + (stat.int || 0),
            intYards: (existing.intYards || 0) + (stat.intYards || 0),
            ff: (existing.ff || 0) + (stat.ff || 0),
            fr: (existing.fr || 0) + (stat.fr || 0),
            passDefended: (existing.passDefended || 0) + (stat.passDefended || 0),
            kickReturnYards: (existing.kickReturnYards || 0) + (stat.kickReturnYards || 0),
            puntReturnYards: (existing.puntReturnYards || 0) + (stat.puntReturnYards || 0),
            kickReturnTds: (existing.kickReturnTds || 0) + (stat.kickReturnTds || 0),
            puntReturnTds: (existing.puntReturnTds || 0) + (stat.puntReturnTds || 0),
            spts: (existing.spts || 0) + (stat.spts || 0),
            playerName: stat.playerName,
            playerNumber: stat.playerNumber,
          });
        });
      }

      // Save aggregated season stats
      const batch = writeBatch(db);
      for (const [playerId, totals] of playerTotals.entries()) {
        const docRef = doc(db, 'teams', teamData.id, 'seasonStats', `${playerId}_${currentYear}`);
        batch.set(docRef, {
          playerId,
          playerName: totals.playerName,
          playerNumber: totals.playerNumber,
          teamId: teamData.id,
          teamName: teamData.name,
          season: currentYear,
          ...totals,
          updatedAt: serverTimestamp(),
          updatedBy: userData.uid,
        }, { merge: true });

        // Also update player's quick stats
        const playerRef = doc(db, 'teams', teamData.id, 'players', playerId);
        batch.set(playerRef, {
          stats: {
            td: totals.tds || 0,
            tkl: totals.tackles || 0,
          }
        }, { merge: true });
      }
      await batch.commit();
    } catch (error) {
      console.error('Error recalculating season stats:', error);
    }
  };

  // Recalculate ALL season stats (used when deleting a game)
  const recalculateAllSeasonStats = async () => {
    await recalculateSeasonStats('');
  };

  // Calculate team season record
  const seasonRecord = useMemo(() => {
    const wins = games.filter(g => g.result === 'W').length;
    const losses = games.filter(g => g.result === 'L').length;
    const ties = games.filter(g => g.result === 'T').length;
    return { wins, losses, ties };
  }, [games]);

  if (!teamData) {
    return (
      <div className="bg-zinc-900 rounded-xl p-12 text-center border border-zinc-800">
        <Trophy className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
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
          <Trophy className="w-6 h-6 text-orange-500" />
          <div>
            <h2 className="text-2xl font-bold text-white">Game Stats</h2>
            <p className="text-sm text-zinc-500">{currentYear} Season • {seasonRecord.wins}-{seasonRecord.losses}{seasonRecord.ties > 0 ? `-${seasonRecord.ties}` : ''}</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowNewGameForm(true)}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-bold transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Game
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2">
          <Check className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      {/* New Game Form */}
      {showNewGameForm && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Add New Game</h3>
            <button onClick={() => setShowNewGameForm(false)} className="text-zinc-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Date *</label>
              <input
                type="date"
                value={newGame.date || ''}
                onChange={(e) => setNewGame({ ...newGame, date: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Opponent *</label>
              <input
                type="text"
                placeholder="e.g., Tigers"
                value={newGame.opponent || ''}
                onChange={(e) => setNewGame({ ...newGame, opponent: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Home/Away</label>
              <select
                value={newGame.isHome ? 'home' : 'away'}
                onChange={(e) => setNewGame({ ...newGame, isHome: e.target.value === 'home' })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="home">Home</option>
                <option value="away">Away</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Our Score</label>
              <input
                type="number"
                min="0"
                value={newGame.teamScore || ''}
                onChange={(e) => setNewGame({ ...newGame, teamScore: parseInt(e.target.value) || 0 })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Opponent Score</label>
              <input
                type="number"
                min="0"
                value={newGame.opponentScore || ''}
                onChange={(e) => setNewGame({ ...newGame, opponentScore: parseInt(e.target.value) || 0 })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Location (optional)</label>
            <input
              type="text"
              placeholder="Stadium or field name"
              value={newGame.location || ''}
              onChange={(e) => setNewGame({ ...newGame, location: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleAddGame}
              disabled={saving || !newGame.opponent || !newGame.date}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white py-2.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Add Game
                </>
              )}
            </button>
            <button
              onClick={() => setShowNewGameForm(false)}
              className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-2.5 rounded-lg font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Games List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
        </div>
      ) : games.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl p-12 text-center border border-zinc-800">
          <Calendar className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Games Yet</h3>
          <p className="text-zinc-500">Click "Add Game" to start tracking game stats.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {games.map((game) => {
            const isExpanded = expandedGameId === game.id;
            const hasChanges = hasUnsavedChanges(game.id);
            const resultColor = game.result === 'W' ? 'text-emerald-400' : game.result === 'L' ? 'text-red-400' : 'text-yellow-400';
            const resultBg = game.result === 'W' ? 'bg-emerald-500' : game.result === 'L' ? 'bg-red-500' : 'bg-yellow-500';

            return (
              <div 
                key={game.id}
                className={`bg-zinc-900 rounded-xl border ${hasChanges ? 'border-orange-500/50' : 'border-zinc-800'} overflow-hidden`}
              >
                {/* Game Header */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setExpandedGameId(isExpanded ? null : game.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 ${resultBg} rounded-lg flex items-center justify-center text-white font-black text-lg`}>
                      {game.result}
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        {game.isHome ? 'vs' : '@'} {game.opponent}
                        {hasChanges && <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded">Unsaved</span>}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <Calendar className="w-3 h-3" />
                        <span>{formatEventDate(game.date)}</span>
                        {game.location && (
                          <>
                            <span>•</span>
                            <MapPin className="w-3 h-3" />
                            <span>{game.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-2xl font-black ${resultColor}`}>
                        {game.teamScore} - {game.opponentScore}
                      </p>
                      <p className="text-xs text-zinc-500">Game {game.gameNumber}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(game); }}
                        className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-zinc-500" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded: Player Stats Entry */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-orange-500" />
                        <h4 className="font-bold text-white">Player Stats for this Game</h4>
                      </div>
                      <button
                        onClick={() => handleSaveGameStats(game)}
                        disabled={saving || !hasChanges}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${
                          hasChanges
                            ? 'bg-orange-600 hover:bg-orange-500 text-white'
                            : 'bg-zinc-800 text-zinc-500'
                        } disabled:opacity-50`}
                      >
                        {saving ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save All
                      </button>
                    </div>

                    {/* Player List with Stats */}
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {players.map(player => {
                        const stats = getPlayerGameStats(game.id, player.id);
                        
                        return (
                          <div key={player.id} className="bg-zinc-800/50 rounded-lg p-3 space-y-3">
                            {/* Player Header */}
                            <div className="flex items-center gap-3">
                              {player.photoUrl ? (
                                <img src={player.photoUrl} alt={player.name} className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-xs font-bold text-zinc-400">
                                  {player.name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-white text-sm">{player.name}</p>
                                <p className="text-[10px] text-zinc-500">#{player.number || '?'} • {player.position || 'N/A'}</p>
                              </div>
                            </div>

                            {/* Stats Grid - Compact */}
                            <div className="grid grid-cols-2 gap-3">
                              {/* Offense */}
                              <div>
                                <div className="flex items-center gap-1 mb-2">
                                  <Sword className="w-3 h-3 text-orange-500" />
                                  <span className="text-[9px] font-bold uppercase text-zinc-500">Offense</span>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                  <StatInput label="TD" value={stats.tds || 0} onChange={(v) => handlePlayerStatChange(game.id, player.id, 'tds', v)} color="text-orange-400" />
                                  <StatInput label="RuYd" value={stats.rushYards || 0} onChange={(v) => handlePlayerStatChange(game.id, player.id, 'rushYards', v)} color="text-cyan-400" />
                                  <StatInput label="Rec" value={stats.rec || 0} onChange={(v) => handlePlayerStatChange(game.id, player.id, 'rec', v)} />
                                  <StatInput label="ReYd" value={stats.recYards || 0} onChange={(v) => handlePlayerStatChange(game.id, player.id, 'recYards', v)} color="text-cyan-400" />
                                </div>
                              </div>

                              {/* Defense */}
                              <div>
                                <div className="flex items-center gap-1 mb-2">
                                  <Shield className="w-3 h-3 text-emerald-500" />
                                  <span className="text-[9px] font-bold uppercase text-zinc-500">Defense</span>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                  <StatInput label="Tkl" value={stats.tackles || 0} onChange={(v) => handlePlayerStatChange(game.id, player.id, 'tackles', v)} color="text-emerald-400" />
                                  <StatInput label="Sack" value={stats.sacks || 0} onChange={(v) => handlePlayerStatChange(game.id, player.id, 'sacks', v)} color="text-purple-400" />
                                  <StatInput label="INT" value={stats.int || 0} onChange={(v) => handlePlayerStatChange(game.id, player.id, 'int', v)} color="text-red-400" />
                                  <StatInput label="FF" value={stats.ff || 0} onChange={(v) => handlePlayerStatChange(game.id, player.id, 'ff', v)} color="text-orange-400" />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Game</h3>
                <p className="text-sm text-zinc-400">This will also delete all player stats for this game</p>
              </div>
            </div>
            
            <div className="bg-zinc-800 rounded-lg p-4 mb-4">
              <p className="font-bold text-white">{deleteConfirm.isHome ? 'vs' : '@'} {deleteConfirm.opponent}</p>
              <p className="text-sm text-zinc-400">{formatEventDate(deleteConfirm.date)} • {deleteConfirm.teamScore}-{deleteConfirm.opponentScore}</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGame}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameStatsEntry;
