/**
 * Coach War Room - Pre-Draft Strategy Center
 * 
 * Coaches rank available players, set position needs, write scouting notes,
 * and configure auto-draft before the live draft begins.
 * 
 * Route: /draft-day/:draftId/war-room
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getDraftEvent,
  getWarRoom,
  saveWarRoom,
} from '../../services/draftDayService';
import { getCommissionerDraftPool } from '../../services/draftPoolService';
import { DraftEvent, DraftPoolEntry, CoachWarRoom } from '../../types';
import { Button, Badge } from '../ui/OSYSComponents';
import { toastSuccess, toastError, toastInfo } from '../../services/toast';
import {
  ArrowLeft,
  Save,
  GripVertical,
  Star,
  StickyNote,
  Shield,
  Zap,
  ChevronUp,
  ChevronDown,
  Search,
  X,
  Target,
  Plus,
  Minus,
  ToggleLeft,
  ToggleRight,
  Clock,
  Users,
  AlertCircle,
} from 'lucide-react';

const WarRoom: React.FC = () => {
  const { draftId } = useParams();
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const dark = theme === 'dark';
  
  // Core state
  const [draft, setDraft] = useState<DraftEvent | null>(null);
  const [poolPlayers, setPoolPlayers] = useState<DraftPoolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // War room state
  const [rankedPlayerIds, setRankedPlayerIds] = useState<string[]>([]);
  const [playerNotes, setPlayerNotes] = useState<Record<string, string>>({});
  const [positionNeeds, setPositionNeeds] = useState<{ position: string; count: number }[]>([]);
  const [autoDraftEnabled, setAutoDraftEnabled] = useState(false);
  
  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rankings' | 'needs' | 'notes'>('rankings');
  
  // =========================================================================
  // LOAD DATA
  // =========================================================================
  
  useEffect(() => {
    if (!draftId || !user || !userData?.programId) return;
    
    const loadData = async () => {
      try {
        // Load draft event
        const draftData = await getDraftEvent(userData.programId!, draftId);
        if (!draftData) {
          setLoading(false);
          return;
        }
        setDraft(draftData);
        
        // Load pool players
        const players = await getCommissionerDraftPool(
          draftData.createdBy,
          draftData.sport,
          draftData.ageGroupLabel
        );
        setPoolPlayers(players.filter(p => p.status === 'waiting'));
        
        // Load existing war room data
        const warRoom = await getWarRoom(
          userData.programId!,
          draftId,
          user.uid
        );
        
        if (warRoom) {
          setRankedPlayerIds(warRoom.playerRankings || []);
          setPlayerNotes(warRoom.playerNotes || {});
          setPositionNeeds(warRoom.positionNeeds || []);
          setAutoDraftEnabled(warRoom.autoDraftEnabled || false);
        } else {
          // Default: rank players by order in pool
          setRankedPlayerIds(players.filter(p => p.status === 'waiting').map(p => p.id));
        }
      } catch (err) {
        console.error('Error loading war room:', err);
        toastError('Failed to load war room data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [draftId, user, userData?.programId]);
  
  // =========================================================================
  // COMPUTED
  // =========================================================================
  
  const rankedPlayers = useMemo(() => {
    const playerMap = new Map(poolPlayers.map(p => [p.id, p]));
    const ranked = rankedPlayerIds
      .map(id => playerMap.get(id))
      .filter(Boolean) as DraftPoolEntry[];
    
    // Add any unranked players at the bottom
    const rankedSet = new Set(rankedPlayerIds);
    const unranked = poolPlayers.filter(p => !rankedSet.has(p.id));
    
    return [...ranked, ...unranked];
  }, [rankedPlayerIds, poolPlayers]);
  
  const filteredRankedPlayers = useMemo(() => {
    if (!searchQuery) return rankedPlayers;
    const q = searchQuery.toLowerCase();
    return rankedPlayers.filter(p => p.playerName.toLowerCase().includes(q));
  }, [rankedPlayers, searchQuery]);
  
  const allPositions = useMemo(() => {
    const pos = new Set<string>();
    poolPlayers.forEach(p => p.preferredPositions?.forEach(pp => pos.add(pp)));
    return Array.from(pos).sort();
  }, [poolPlayers]);
  
  // =========================================================================
  // RANKING ACTIONS
  // =========================================================================
  
  const movePlayer = useCallback((playerId: string, direction: 'up' | 'down') => {
    setRankedPlayerIds(prev => {
      const idx = prev.indexOf(playerId);
      if (idx === -1) return prev;
      
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      
      const newArr = [...prev];
      [newArr[idx], newArr[newIdx]] = [newArr[newIdx], newArr[idx]];
      return newArr;
    });
  }, []);
  
  const moveToTop = useCallback((playerId: string) => {
    setRankedPlayerIds(prev => {
      const filtered = prev.filter(id => id !== playerId);
      return [playerId, ...filtered];
    });
  }, []);
  
  // Simple drag-and-drop via state
  const handleDragStart = useCallback((playerId: string) => {
    setDraggedId(playerId);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    
    setRankedPlayerIds(prev => {
      const dragIdx = prev.indexOf(draggedId);
      const targetIdx = prev.indexOf(targetId);
      if (dragIdx === -1 || targetIdx === -1) return prev;
      
      const newArr = [...prev];
      newArr.splice(dragIdx, 1);
      newArr.splice(targetIdx, 0, draggedId);
      return newArr;
    });
  }, [draggedId]);
  
  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
  }, []);
  
  // =========================================================================
  // NOTES
  // =========================================================================
  
  const saveNote = useCallback((playerId: string, note: string) => {
    setPlayerNotes(prev => ({
      ...prev,
      [playerId]: note,
    }));
    setEditingNoteId(null);
    setNoteText('');
  }, []);
  
  // =========================================================================
  // POSITION NEEDS
  // =========================================================================
  
  const addPositionNeed = useCallback((position: string) => {
    setPositionNeeds(prev => {
      const existing = prev.find(n => n.position === position);
      if (existing) {
        return prev.map(n => n.position === position ? { ...n, count: n.count + 1 } : n);
      }
      return [...prev, { position, count: 1 }];
    });
  }, []);
  
  const adjustPositionNeed = useCallback((position: string, delta: number) => {
    setPositionNeeds(prev => {
      return prev
        .map(n => n.position === position ? { ...n, count: Math.max(0, n.count + delta) } : n)
        .filter(n => n.count > 0);
    });
  }, []);
  
  // =========================================================================
  // SAVE
  // =========================================================================
  
  const handleSave = useCallback(async () => {
    if (!draft || !user || !userData?.programId) return;
    
    setSaving(true);
    try {
      const warRoom: CoachWarRoom = {
        coachId: user.uid,
        coachName: userData.name || 'Coach',
        draftId: draft.id,
        playerRankings: rankedPlayerIds,
        positionNeeds,
        autoDraftEnabled,
        playerNotes,
      };
      
      await saveWarRoom(userData.programId, draft.id, warRoom);
      toastSuccess('💾 War Room saved!');
    } catch (err: any) {
      toastError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [draft, user, userData, rankedPlayerIds, positionNeeds, autoDraftEnabled, playerNotes]);
  
  // =========================================================================
  // RENDER: Loading / Not Found
  // =========================================================================
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }
  
  if (!draft) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
        <h2 className={`text-xl font-bold mb-2 ${dark ? 'text-white' : 'text-slate-900'}`}>Draft Not Found</h2>
        <Button variant="primary" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }
  
  const myTeam = draft.teams.find(t => t.coachId === user?.uid);
  const draftStarted = draft.status === 'in_progress' || draft.status === 'paused';
  
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className={`p-1.5 rounded-lg ${dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
                🏟️ War Room
              </h1>
              {draftStarted && <Badge variant="live">LIVE</Badge>}
            </div>
            <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              {draft.ageGroupLabel} • {myTeam?.teamName || 'Your Team'} • {poolPlayers.length} players
            </p>
          </div>
        </div>
        
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      
      {/* Live Draft Link */}
      {draftStarted && (
        <button
          onClick={() => navigate(`/draft-day/${draftId}`)}
          className="w-full rounded-xl p-3 bg-gradient-to-r from-red-600/20 to-purple-600/20 border border-red-500/30 text-center"
        >
          <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>
            🔴 Draft is LIVE — Tap to enter Draft Room
          </p>
        </button>
      )}
      
      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5">
        {[
          { id: 'rankings' as const, icon: Star, label: 'Rankings' },
          { id: 'needs' as const, icon: Target, label: 'Needs' },
          { id: 'notes' as const, icon: StickyNote, label: 'Notes' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : dark
                  ? 'text-slate-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* ================================================================= */}
      {/* TAB: Rankings                                                      */}
      {/* ================================================================= */}
      {activeTab === 'rankings' && (
        <div className="space-y-3">
          {/* Auto-Draft Toggle */}
          <div className={`rounded-xl p-3 flex items-center justify-between ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            <div>
              <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>
                ⚡ Auto-Draft
              </p>
              <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                If timer expires, auto-pick from your rankings
              </p>
            </div>
            <button
              onClick={() => setAutoDraftEnabled(!autoDraftEnabled)}
              className={`p-1 rounded-lg transition-colors ${autoDraftEnabled ? 'text-purple-500' : dark ? 'text-slate-600' : 'text-slate-300'}`}
            >
              {autoDraftEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players..."
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-sm ${
                dark
                  ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                  : 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400'
              } outline-none focus:ring-2 focus:ring-purple-500/50`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className={`w-4 h-4 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
              </button>
            )}
          </div>
          
          {/* Ranked Player List */}
          <div className={`rounded-xl overflow-hidden ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            <div className={`px-4 py-2.5 border-b ${dark ? 'border-white/10' : 'border-slate-100'}`}>
              <p className={`text-xs font-medium ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                📋 Drag or use arrows to rank • #{1} = pick first
              </p>
            </div>
            
            <div className="max-h-[500px] overflow-y-auto">
              {filteredRankedPlayers.map((player, idx) => {
                const rank = rankedPlayerIds.indexOf(player.id) + 1;
                const hasNote = !!playerNotes[player.id];
                
                return (
                  <div
                    key={player.id}
                    draggable
                    onDragStart={() => handleDragStart(player.id)}
                    onDragOver={(e) => handleDragOver(e, player.id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 px-3 py-2.5 transition-all ${
                      draggedId === player.id ? 'opacity-40 scale-95' : ''
                    } ${dark ? 'border-b border-white/5 hover:bg-white/[0.03]' : 'border-b border-slate-50 hover:bg-slate-50'}`}
                  >
                    {/* Drag Handle */}
                    <GripVertical className={`w-4 h-4 cursor-grab active:cursor-grabbing flex-shrink-0 ${dark ? 'text-slate-600' : 'text-slate-300'}`} />
                    
                    {/* Rank Number */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      rank <= 3
                        ? 'bg-amber-500/20 text-amber-500'
                        : rank <= 10
                          ? 'bg-purple-500/20 text-purple-400'
                          : dark ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {rank || '—'}
                    </div>
                    
                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${dark ? 'text-white' : 'text-slate-900'}`}>
                        {player.playerName}
                      </p>
                      <div className="flex items-center gap-2">
                        {player.preferredPositions?.[0] && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'bg-white/10 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                            {player.preferredPositions[0]}
                          </span>
                        )}
                        {player.playerAge && (
                          <span className={`text-[10px] ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
                            Age {player.playerAge}
                          </span>
                        )}
                        {hasNote && (
                          <StickyNote className="w-3 h-3 text-amber-500" />
                        )}
                      </div>
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => movePlayer(player.id, 'up')}
                        className={`p-1 rounded ${dark ? 'hover:bg-white/10 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => movePlayer(player.id, 'down')}
                        className={`p-1 rounded ${dark ? 'hover:bg-white/10 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveToTop(player.id)}
                        className={`p-1 rounded ${dark ? 'hover:bg-white/10 text-amber-500' : 'hover:bg-slate-100 text-amber-500'}`}
                        title="Move to #1"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* ================================================================= */}
      {/* TAB: Position Needs                                                */}
      {/* ================================================================= */}
      {activeTab === 'needs' && (
        <div className="space-y-4">
          <div className={`rounded-xl p-4 ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            <h3 className={`text-sm font-semibold mb-3 ${dark ? 'text-white' : 'text-slate-900'}`}>
              🎯 Position Needs
            </h3>
            <p className={`text-xs mb-4 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
              Set how many players you need at each position. This helps prioritize your rankings.
            </p>
            
            {/* Current Needs */}
            {positionNeeds.length > 0 && (
              <div className="space-y-2 mb-4">
                {positionNeeds.map(need => (
                  <div
                    key={need.position}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${dark ? 'bg-white/5' : 'bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className={`w-4 h-4 ${dark ? 'text-purple-400' : 'text-purple-600'}`} />
                      <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-slate-900'}`}>
                        {need.position}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => adjustPositionNeed(need.position, -1)}
                        className={`p-1 rounded ${dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className={`text-lg font-bold w-6 text-center ${dark ? 'text-white' : 'text-slate-900'}`}>
                        {need.count}
                      </span>
                      <button
                        onClick={() => adjustPositionNeed(need.position, 1)}
                        className={`p-1 rounded ${dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add Position */}
            <div>
              <p className={`text-xs font-medium mb-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                Add position need:
              </p>
              <div className="flex flex-wrap gap-2">
                {allPositions
                  .filter(p => !positionNeeds.find(n => n.position === p))
                  .map(pos => (
                    <button
                      key={pos}
                      onClick={() => addPositionNeed(pos)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        dark
                          ? 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      + {pos}
                    </button>
                  ))}
                {allPositions.length === 0 && (
                  <p className={`text-xs ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
                    No positions available from player pool
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Position Breakdown from Pool */}
          <div className={`rounded-xl p-4 ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            <h3 className={`text-sm font-semibold mb-3 ${dark ? 'text-white' : 'text-slate-900'}`}>
              📊 Pool Breakdown
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allPositions.map(pos => {
                const count = poolPlayers.filter(p => p.preferredPositions?.includes(pos)).length;
                const need = positionNeeds.find(n => n.position === pos);
                return (
                  <div
                    key={pos}
                    className={`rounded-lg px-3 py-2 ${dark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}
                  >
                    <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{pos}</p>
                    <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{count}</p>
                    {need && (
                      <p className={`text-[10px] ${need.count > count ? 'text-red-400' : 'text-emerald-400'}`}>
                        Need {need.count} • {count >= need.count ? '✅' : `⚠️ Short ${need.count - count}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* ================================================================= */}
      {/* TAB: Notes                                                         */}
      {/* ================================================================= */}
      {activeTab === 'notes' && (
        <div className="space-y-3">
          <div className={`rounded-xl overflow-hidden ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            <div className={`px-4 py-2.5 border-b ${dark ? 'border-white/10' : 'border-slate-100'}`}>
              <p className={`text-xs font-medium ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                📝 Tap a player to add scouting notes
              </p>
            </div>
            
            <div className="max-h-[500px] overflow-y-auto">
              {poolPlayers.map(player => {
                const note = playerNotes[player.id];
                const isEditing = editingNoteId === player.id;
                
                return (
                  <div
                    key={player.id}
                    className={`px-4 py-3 ${dark ? 'border-b border-white/5' : 'border-b border-slate-50'}`}
                  >
                    <button
                      onClick={() => {
                        if (isEditing) {
                          saveNote(player.id, noteText);
                        } else {
                          setEditingNoteId(player.id);
                          setNoteText(note || '');
                        }
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${dark ? 'text-white' : 'text-slate-900'}`}>
                            {player.playerName}
                          </p>
                          {player.preferredPositions?.[0] && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'bg-white/10 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                              {player.preferredPositions[0]}
                            </span>
                          )}
                        </div>
                        <StickyNote className={`w-3.5 h-3.5 ${note ? 'text-amber-500' : dark ? 'text-slate-700' : 'text-slate-300'}`} />
                      </div>
                    </button>
                    
                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Fast kid, great hands, needs work on blocking..."
                          autoFocus
                          rows={3}
                          className={`w-full rounded-lg px-3 py-2 text-sm resize-none ${
                            dark
                              ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                              : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                          } outline-none focus:ring-2 focus:ring-purple-500/50`}
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => { setEditingNoteId(null); setNoteText(''); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${dark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-600'}`}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveNote(player.id, noteText)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white"
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    ) : note ? (
                      <p className={`text-xs mt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {note}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* Bottom Save Bar (sticky on mobile) */}
      <div className={`sticky bottom-4 rounded-xl p-3 flex items-center justify-between ${dark ? 'bg-zinc-800/90 border border-white/10 backdrop-blur-xl' : 'bg-white/90 border border-slate-200 backdrop-blur-xl shadow-lg'}`}>
        <div>
          <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
            {rankedPlayerIds.length} ranked • {Object.keys(playerNotes).filter(k => playerNotes[k]).length} notes • {positionNeeds.length} position needs
          </p>
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
};

export default WarRoom;
