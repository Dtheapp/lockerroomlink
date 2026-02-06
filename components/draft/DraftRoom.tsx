/**
 * Draft Room - Live Draft Day Experience
 * 
 * THE core component. Real-time picks, timer, mobile-first 3-tap flow,
 * commissioner controls, feed + board views.
 * 
 * Entry points:
 *   Commissioner: /commissioner/draft-day/:draftId
 *   Coach: /draft-day/:draftId
 *   Watch Party: /draft-day/:draftId/watch
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  onDraftEvent,
  onDraftPicks,
  startDraft,
  makePick,
  togglePauseDraft,
  undoLastPick,
  skipTeamPick,
  extendTimer,
  runLottery,
  finalizeDraft,
} from '../../services/draftDayService';
import { getCommissionerDraftPool } from '../../services/draftPoolService';
import { Timestamp } from 'firebase/firestore';
import { DraftEvent, DraftPick, DraftPoolEntry, DraftTeamInfo } from '../../types';
import { Button, Badge } from '../ui/OSYSComponents';
import { toastSuccess, toastError, toastInfo } from '../../services/toast';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipForward,
  Undo2,
  Clock,
  Users,
  Trophy,
  Search,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Shuffle,
  Zap,
  Timer,
  Eye,
  AlertCircle,
  Plus,
  Grid3X3,
  List,
} from 'lucide-react';

// =============================================================================
// PICK TIMER COMPONENT
// =============================================================================

const PickTimer: React.FC<{
  deadline: Date | null;
  isPaused: boolean;
  dark: boolean;
}> = ({ deadline, isPaused, dark }) => {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!deadline || isPaused) return;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadline, isPaused]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft <= 15;
  const isWarning = secondsLeft <= 30;

  // SVG ring
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const maxSeconds = 120;
  const progress = Math.min(secondsLeft / maxSeconds, 1);
  const offset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40" cy="40" r={radius}
            fill="none"
            stroke={dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
            strokeWidth="4"
          />
          <circle
            cx="40" cy="40" r={radius}
            fill="none"
            stroke={isUrgent ? '#ef4444' : isWarning ? '#f59e0b' : '#a855f7'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold font-mono ${
            isUrgent ? 'text-red-500 animate-pulse' : isWarning ? 'text-amber-500' : dark ? 'text-white' : 'text-slate-900'
          }`}>
            {isPaused ? '⏸' : `${minutes}:${seconds.toString().padStart(2, '0')}`}
          </span>
        </div>
      </div>
      <p className={`text-xs mt-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
        {isPaused ? 'Paused' : isUrgent ? 'Hurry!' : 'Time left'}
      </p>
    </div>
  );
};

// =============================================================================
// PLAYER CARD (For picking)
// =============================================================================

const PlayerCard: React.FC<{
  player: DraftPoolEntry;
  onSelect: (player: DraftPoolEntry) => void;
  isSelected: boolean;
  dark: boolean;
  disabled: boolean;
}> = ({ player, onSelect, isSelected, dark, disabled }) => {
  return (
    <button
      onClick={() => !disabled && onSelect(player)}
      disabled={disabled}
      className={`w-full text-left rounded-xl p-3 transition-all ${
        isSelected
          ? 'ring-2 ring-purple-500 bg-purple-500/15 scale-[1.02]'
          : disabled
            ? 'opacity-40 cursor-not-allowed'
            : dark
              ? 'bg-white/5 border border-white/10 hover:bg-white/[0.08] active:scale-[0.98]'
              : 'bg-white border border-slate-200 hover:border-purple-300 active:scale-[0.98]'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
          dark ? 'bg-white/10 text-white' : 'bg-purple-100 text-purple-700'
        }`}>
          {player.playerName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold truncate ${dark ? 'text-white' : 'text-slate-900'}`}>
            {player.playerName}
          </p>
          <div className="flex items-center gap-2">
            {player.preferredPositions?.[0] && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${dark ? 'bg-white/10 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                {player.preferredPositions[0]}
              </span>
            )}
            {player.playerAge && (
              <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                Age {player.playerAge}
              </span>
            )}
          </div>
        </div>
        {isSelected && (
          <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </button>
  );
};

// =============================================================================
// PICK FEED ITEM
// =============================================================================

const PickFeedItem: React.FC<{
  pick: DraftPick;
  teams: DraftTeamInfo[];
  dark: boolean;
  isLatest: boolean;
}> = ({ pick, teams, dark, isLatest }) => {
  const team = teams.find(t => t.teamId === pick.teamId);
  const teamColor = team?.color || '#a855f7';

  if (pick.isUndone) return null;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 transition-all ${
      isLatest ? 'bg-purple-500/10' : ''
    } ${dark ? 'border-b border-white/5' : 'border-b border-slate-100'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white`}
        style={{ backgroundColor: teamColor }}
      >
        #{pick.pick}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate ${dark ? 'text-white' : 'text-slate-900'}`}>
          {pick.playerName}
        </p>
        <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          Rd {pick.round}, Pick {pick.pickInRound} — {pick.teamName}
          {pick.playerPosition && ` • ${pick.playerPosition}`}
        </p>
      </div>
      {pick.isAutoPick && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
          AUTO
        </span>
      )}
    </div>
  );
};

// =============================================================================
// BOARD VIEW (Desktop/Tablet grid)
// =============================================================================

const BoardView: React.FC<{
  picks: DraftPick[];
  teams: DraftTeamInfo[];
  totalRounds: number;
  dark: boolean;
}> = ({ picks, teams, totalRounds, dark }) => {
  const activePicks = picks.filter(p => !p.isUndone);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={`px-2 py-2 text-left text-xs font-medium sticky left-0 z-10 ${dark ? 'bg-zinc-900 text-slate-500' : 'bg-white text-slate-400'}`}>
              Rd
            </th>
            {teams.map(team => (
              <th key={team.teamId} className="px-2 py-2 text-center min-w-[120px]">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: team.color || '#a855f7' }}
                  >
                    {team.teamName.charAt(0)}
                  </div>
                  <span className={`text-xs truncate max-w-[100px] ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {team.teamName}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.min(totalRounds, 20) }, (_, round) => (
            <tr key={round} className={dark ? 'border-t border-white/5' : 'border-t border-slate-100'}>
              <td className={`px-2 py-2 text-xs font-mono sticky left-0 z-10 ${dark ? 'bg-zinc-900 text-slate-600' : 'bg-white text-slate-400'}`}>
                {round + 1}
              </td>
              {teams.map(team => {
                const pick = activePicks.find(p => p.round === round + 1 && p.teamId === team.teamId);
                return (
                  <td key={team.teamId} className="px-1 py-1">
                    {pick ? (
                      <div className={`rounded-lg px-2 py-1.5 text-center ${dark ? 'bg-white/5' : 'bg-slate-50'}`}>
                        <p className={`text-xs font-semibold truncate ${dark ? 'text-white' : 'text-slate-900'}`}>
                          {pick.playerName}
                        </p>
                        {pick.playerPosition && (
                          <p className={`text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {pick.playerPosition}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className={`rounded-lg px-2 py-3 text-center ${dark ? 'bg-white/[0.02]' : 'bg-slate-50/50'}`}>
                        <span className={`text-[10px] ${dark ? 'text-slate-700' : 'text-slate-300'}`}>—</span>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// =============================================================================
// MAIN DRAFT ROOM COMPONENT
// =============================================================================

const DraftRoom: React.FC = () => {
  const { draftId } = useParams();
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const pickListRef = useRef<HTMLDivElement>(null);
  
  const dark = theme === 'dark';
  const isWatchMode = location.pathname.includes('/watch');
  const isCommissioner = ['Commissioner', 'TeamCommissioner', 'ProgramCommissioner'].includes(userData?.role || '');
  const isCoach = userData?.role === 'Coach';
  
  // Core state
  const [draft, setDraft] = useState<DraftEvent | null>(null);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [poolPlayers, setPoolPlayers] = useState<DraftPoolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  
  // UI state
  const [selectedPlayer, setSelectedPlayer] = useState<DraftPoolEntry | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [makingPick, setMakingPick] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'feed' | 'board'>('feed');
  const [showControls, setShowControls] = useState(false);
  
  // Celebration state
  const [celebration, setCelebration] = useState<{ playerName: string; teamName: string; teamColor: string } | null>(null);
  const prevPickCountRef = useRef(0);
  
  // Finalize state
  const [finalizing, setFinalizing] = useState(false);
  
  // Detect programId from draft
  const programId = draft?.programId;

  // =========================================================================
  // REAL-TIME LISTENERS
  // =========================================================================

  useEffect(() => {
    if (!draftId || !programId) return;

    const unsubDraft = onDraftEvent(programId, draftId, setDraft);
    const unsubPicks = onDraftPicks(programId, draftId, (newPicks) => {
      setPicks(newPicks);
    });

    return () => {
      unsubDraft();
      unsubPicks();
    };
  }, [draftId, programId]);

  // Initial load: find the draft across programs
  useEffect(() => {
    if (!draftId || !user) return;

    const findDraft = async () => {
      try {
        if (userData?.programId) {
          const unsub = onDraftEvent(userData.programId, draftId, (d) => {
            if (d) {
              setDraft(d);
              setLoading(false);
            }
          });
          setTimeout(() => setLoading(false), 2000);
          return unsub;
        }
        setLoading(false);
      } catch (err) {
        console.error('Error finding draft:', err);
        setLoading(false);
      }
    };

    findDraft();
  }, [draftId, user, userData?.programId]);

  // Load available players from draft pool
  useEffect(() => {
    if (!draft || !user) return;

    const loadPlayers = async () => {
      setLoadingPlayers(true);
      try {
        const players = await getCommissionerDraftPool(
          draft.createdBy,
          draft.sport,
          draft.ageGroupLabel
        );
        setPoolPlayers(players.filter(p => p.status === 'waiting'));
      } catch (err) {
        console.error('Error loading pool players:', err);
      } finally {
        setLoadingPlayers(false);
      }
    };

    loadPlayers();
  }, [draft?.id, draft?.createdBy, draft?.sport, draft?.ageGroupLabel]);

  // =========================================================================
  // COMPUTED VALUES
  // =========================================================================

  const activePicks = useMemo(() => picks.filter(p => !p.isUndone), [picks]);

  const draftedPlayerIds = useMemo(() => {
    return new Set(activePicks.map(p => p.playerId));
  }, [activePicks]);

  const availablePlayers = useMemo(() => {
    return poolPlayers.filter(p => !draftedPlayerIds.has(p.id));
  }, [poolPlayers, draftedPlayerIds]);

  const filteredPlayers = useMemo(() => {
    let result = availablePlayers;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.playerName.toLowerCase().includes(q));
    }
    if (positionFilter !== 'all') {
      result = result.filter(p => p.preferredPositions?.includes(positionFilter));
    }
    return result;
  }, [availablePlayers, searchQuery, positionFilter]);

  const allPositions = useMemo(() => {
    const pos = new Set<string>();
    poolPlayers.forEach(p => p.preferredPositions?.forEach(pp => pos.add(pp)));
    return Array.from(pos).sort();
  }, [poolPlayers]);

  const currentTeam = useMemo(() => {
    return draft?.teams.find(t => t.teamId === draft.currentTeamId);
  }, [draft?.teams, draft?.currentTeamId]);

  const myTeam = useMemo(() => {
    return draft?.teams.find(t => t.coachId === user?.uid);
  }, [draft?.teams, user?.uid]);

  const isMyPick = currentTeam?.coachId === user?.uid;
  const canPick = (isMyPick && isCoach && draft?.status === 'in_progress') ||
                  (isCommissioner && draft?.status === 'in_progress');

  const pickDeadline = useMemo(() => {
    if (!draft?.currentPickDeadline) return null;
    return draft.currentPickDeadline instanceof Timestamp
      ? draft.currentPickDeadline.toDate()
      : new Date(draft.currentPickDeadline as any);
  }, [draft?.currentPickDeadline]);

  // =========================================================================
  // ACTIONS
  // =========================================================================

  const handleSelectPlayer = useCallback((player: DraftPoolEntry) => {
    setSelectedPlayer(player);
    setShowConfirm(true);
  }, []);

  const handleConfirmPick = useCallback(async () => {
    if (!draft || !selectedPlayer || !programId || !currentTeam) return;

    setMakingPick(true);
    try {
      await makePick(programId, draft.id, {
        round: draft.currentRound,
        pick: draft.currentPick,
        pickInRound: ((draft.currentPick - 1) % draft.teams.length) + 1,
        teamId: currentTeam.teamId,
        teamName: currentTeam.teamName,
        coachId: currentTeam.coachId,
        playerId: selectedPlayer.id,
        playerName: selectedPlayer.playerName,
        playerPosition: selectedPlayer.preferredPositions?.[0],
      });

      toastSuccess(`✅ ${selectedPlayer.playerName} drafted to ${currentTeam.teamName}!`);
      setSelectedPlayer(null);
      setShowConfirm(false);
      setSearchQuery('');
    } catch (err: any) {
      toastError(err.message || 'Failed to make pick');
    } finally {
      setMakingPick(false);
    }
  }, [draft, selectedPlayer, programId, currentTeam]);

  const handleStartDraft = useCallback(async () => {
    if (!draft || !programId) return;
    try {
      await startDraft(programId, draft.id);
      toastSuccess('🏈 Draft is LIVE!');
    } catch (err: any) {
      toastError(err.message || 'Failed to start draft');
    }
  }, [draft, programId]);

  const handlePause = useCallback(async () => {
    if (!draft || !programId) return;
    const isPaused = draft.status === 'paused';
    try {
      await togglePauseDraft(programId, draft.id, !isPaused);
      toastInfo(isPaused ? '▶️ Draft resumed' : '⏸️ Draft paused');
    } catch (err: any) {
      toastError(err.message || 'Failed to toggle pause');
    }
  }, [draft, programId]);

  const handleUndo = useCallback(async () => {
    if (!draft || !programId || !user) return;
    try {
      await undoLastPick(programId, draft.id, user.uid);
      toastInfo('↩️ Last pick undone');
    } catch (err: any) {
      toastError(err.message || 'No picks to undo');
    }
  }, [draft, programId, user]);

  const handleSkip = useCallback(async () => {
    if (!draft || !programId || !user) return;
    try {
      await skipTeamPick(programId, draft.id, user.uid);
      toastInfo('⏭️ Pick skipped');
    } catch (err: any) {
      toastError(err.message || 'Failed to skip');
    }
  }, [draft, programId, user]);

  const handleExtend = useCallback(async () => {
    if (!draft || !programId) return;
    try {
      await extendTimer(programId, draft.id, 60);
      toastInfo('⏱️ +60 seconds added');
    } catch (err: any) {
      toastError(err.message || 'Failed to extend timer');
    }
  }, [draft, programId]);

  const handleLottery = useCallback(async () => {
    if (!draft || !programId) return;
    try {
      await runLottery(programId, draft.id);
      toastSuccess('🎰 Lottery complete! Draft order set.');
    } catch (err: any) {
      toastError(err.message || 'Failed to run lottery');
    }
  }, [draft, programId]);

  // =========================================================================
  // CELEBRATION: Detect new picks for user's team
  // =========================================================================

  useEffect(() => {
    if (!myTeam || activePicks.length === 0) {
      prevPickCountRef.current = activePicks.length;
      return;
    }
    
    // Only trigger on NEW picks (not initial load)
    if (activePicks.length > prevPickCountRef.current && prevPickCountRef.current > 0) {
      const latestPick = activePicks[activePicks.length - 1];
      if (latestPick.teamId === myTeam.teamId) {
        const team = draft?.teams.find(t => t.teamId === latestPick.teamId);
        setCelebration({
          playerName: latestPick.playerName,
          teamName: latestPick.teamName,
          teamColor: team?.color || '#a855f7',
        });
        // Auto-dismiss after 4 seconds
        setTimeout(() => setCelebration(null), 4000);
      }
    }
    prevPickCountRef.current = activePicks.length;
  }, [activePicks, myTeam, draft?.teams]);

  // =========================================================================
  // FINALIZE DRAFT (Commissioner only)
  // =========================================================================

  const handleFinalize = useCallback(async () => {
    if (!draft || !programId || !user) return;
    
    const confirmed = window.confirm(
      `Finalize the ${draft.ageGroupLabel} draft? This will:\n\n` +
      `• Add all ${activePicks.length} drafted players to team rosters\n` +
      `• Send notifications to all parents\n` +
      `• This action cannot be undone\n\n` +
      `Continue?`
    );
    if (!confirmed) return;
    
    setFinalizing(true);
    try {
      const result = await finalizeDraft(programId, draft.id, user.uid);
      toastSuccess(
        `🏆 Draft finalized! ${result.success} players added to rosters.` +
        (result.failed > 0 ? ` (${result.failed} failed)` : '')
      );
    } catch (err: any) {
      toastError(err.message || 'Failed to finalize draft');
    } finally {
      setFinalizing(false);
    }
  }, [draft, programId, user, activePicks.length]);

  // =========================================================================
  // RENDER: Loading
  // =========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-600'}`}>Loading draft...</p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
        <h2 className={`text-xl font-bold mb-2 ${dark ? 'text-white' : 'text-slate-900'}`}>Draft Not Found</h2>
        <p className={`text-sm mb-4 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
          This draft may have been deleted or you don't have access.
        </p>
        <Button variant="primary" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const isLive = draft.status === 'in_progress';
  const isPaused = draft.status === 'paused';
  const isScheduled = draft.status === 'scheduled';
  const isLotteryPending = draft.status === 'lottery_pending';
  const isCompleted = draft.status === 'completed';

  // =========================================================================
  // RENDER: Pre-Draft (Scheduled / Lottery Pending)
  // =========================================================================

  if (isScheduled || isLotteryPending) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className={`p-2 rounded-lg ${dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`text-xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
              🏈 {draft.ageGroupLabel} Draft
            </h1>
            <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
              {draft.programName}
            </p>
          </div>
        </div>

        {/* Status Card */}
        <div className={`rounded-xl p-6 text-center ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
          <div className="text-5xl mb-4">{isLotteryPending ? '🎰' : '📅'}</div>
          <h2 className={`text-2xl font-bold mb-2 ${dark ? 'text-white' : 'text-slate-900'}`}>
            {isLotteryPending ? 'Lottery Time!' : 'Draft Scheduled'}
          </h2>
          <p className={`text-sm mb-1 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
            {draft.totalPlayers} players • {draft.teams.length} teams • {draft.draftType} draft
          </p>
          <p className={`text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            {draft.scheduledDate instanceof Timestamp
              ? draft.scheduledDate.toDate().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
              : 'Date TBD'
            }
          </p>
        </div>

        {/* Draft Order */}
        <div className={`rounded-xl overflow-hidden ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
          <div className={`px-4 py-3 border-b ${dark ? 'border-white/10' : 'border-slate-100'}`}>
            <h3 className={`font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>
              {draft.lotteryCompleted ? '🏆 Draft Order (Lottery Result)' : '📋 Teams'}
            </h3>
          </div>
          <div className={`divide-y ${dark ? 'divide-white/5' : 'divide-slate-100'}`}>
            {draft.draftOrder.map((teamId, idx) => {
              const team = draft.teams.find(t => t.teamId === teamId);
              if (!team) return null;
              return (
                <div key={teamId} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: team.color || '#a855f7' }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${dark ? 'text-white' : 'text-slate-900'}`}>{team.teamName}</p>
                    <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{team.coachName}</p>
                  </div>
                  {team.coachId === user?.uid && (
                    <Badge variant="primary">YOU</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Commissioner Actions */}
        {isCommissioner && (
          <div className="space-y-3">
            {isLotteryPending && !draft.lotteryCompleted && (
              <Button variant="gold" onClick={handleLottery} className="w-full">
                🎰 Run Lottery
              </Button>
            )}
            {(isScheduled || (isLotteryPending && draft.lotteryCompleted)) && (
              <Button variant="primary" onClick={handleStartDraft} className="w-full">
                <Play className="w-4 h-4 mr-2" />
                Start Draft NOW
              </Button>
            )}
          </div>
        )}

        {/* War Room Link (Coaches) */}
        {isCoach && (
          <button
            onClick={() => navigate(`/draft-day/${draftId}/war-room`)}
            className={`w-full rounded-xl p-4 text-left transition-all ${dark ? 'bg-white/5 border border-white/10 hover:bg-white/[0.08]' : 'bg-white border border-slate-200 hover:border-purple-300'}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                🏟️
              </div>
              <div>
                <p className={`font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>War Room</p>
                <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Rank players, set position needs, write scouting notes
                </p>
              </div>
            </div>
          </button>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER: Post-Draft (Completed)
  // =========================================================================

  if (isCompleted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className={`p-2 rounded-lg ${dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`text-xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
              🏆 {draft.ageGroupLabel} Draft — Complete
            </h1>
            <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
              {activePicks.length} picks • {draft.teams.length} teams
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('feed')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'feed' ? 'bg-purple-600 text-white' : dark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <List className="w-4 h-4" /> Feed
          </button>
          <button
            onClick={() => setViewMode('board')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'board' ? 'bg-purple-600 text-white' : dark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Grid3X3 className="w-4 h-4" /> Board
          </button>
        </div>

        {viewMode === 'feed' ? (
          <div className={`rounded-xl overflow-hidden ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            {activePicks.map((pick, i) => (
              <PickFeedItem key={pick.id || i} pick={pick} teams={draft.teams} dark={dark} isLatest={i === activePicks.length - 1} />
            ))}
          </div>
        ) : (
          <div className={`rounded-xl overflow-hidden ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            <BoardView picks={picks} teams={draft.teams} totalRounds={draft.totalRounds} dark={dark} />
          </div>
        )}

        {/* Finalize Button (Commissioner only, not yet finalized) */}
        {isCommissioner && !(draft as any).finalized && (
          <div className={`rounded-xl p-4 ${dark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'}`}>
            <h3 className={`font-semibold mb-1 ${dark ? 'text-white' : 'text-slate-900'}`}>
              🏆 Ready to Finalize?
            </h3>
            <p className={`text-xs mb-3 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
              This will add all {activePicks.length} drafted players to their team rosters and notify parents.
            </p>
            <Button variant="primary" onClick={handleFinalize} disabled={finalizing} className="w-full">
              {finalizing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Finalizing...
                </span>
              ) : (
                '✅ Finalize Draft & Build Rosters'
              )}
            </Button>
          </div>
        )}
        {isCommissioner && (draft as any).finalized && (
          <div className={`rounded-xl p-4 text-center ${dark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'}`}>
            <p className={`text-sm font-medium ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              ✅ Draft finalized — All players added to rosters
            </p>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER: LIVE DRAFT (In Progress / Paused)
  // =========================================================================

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className={`p-1.5 rounded-lg ${dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
                {draft.ageGroupLabel} Draft
              </h1>
              <Badge variant={isPaused ? 'warning' : 'live'}>
                {isPaused ? '⏸ PAUSED' : '🔴 LIVE'}
              </Badge>
            </div>
            <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              Round {draft.currentRound} • Pick #{draft.currentPick} • {draft.playersRemaining} left
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(v => v === 'feed' ? 'board' : 'feed')}
            className={`p-2 rounded-lg ${dark ? 'bg-white/5 hover:bg-white/10 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}
            title={viewMode === 'feed' ? 'Board view' : 'Feed view'}
          >
            {viewMode === 'feed' ? <Grid3X3 className="w-4 h-4" /> : <List className="w-4 h-4" />}
          </button>
          {isCommissioner && (
            <button
              onClick={() => setShowControls(!showControls)}
              className={`p-2 rounded-lg ${showControls ? 'bg-purple-600 text-white' : dark ? 'bg-white/5 hover:bg-white/10 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}
            >
              <Zap className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Commissioner Controls Panel */}
      {isCommissioner && showControls && (
        <div className={`rounded-xl p-3 ${dark ? 'bg-white/5 border border-white/10' : 'bg-purple-50 border border-purple-200'}`}>
          <p className={`text-xs font-medium mb-2 ${dark ? 'text-slate-400' : 'text-purple-600'}`}>⚡ Commissioner Controls</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={handlePause} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}>
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button onClick={handleUndo} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}>
              <Undo2 className="w-3.5 h-3.5" /> Undo Pick
            </button>
            <button onClick={handleSkip} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}>
              <SkipForward className="w-3.5 h-3.5" /> Skip Pick
            </button>
            <button onClick={handleExtend} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}>
              <Plus className="w-3.5 h-3.5" /> +60s
            </button>
          </div>
        </div>
      )}

      {/* On The Clock Banner */}
      {currentTeam && (
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{
            background: `linear-gradient(135deg, ${currentTeam.color || '#a855f7'}dd, ${currentTeam.color || '#a855f7'}88)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
              {currentTeam.teamName.charAt(0)}
            </div>
            <div>
              <p className="text-white/70 text-xs font-medium uppercase tracking-wider">On The Clock</p>
              <p className="text-white font-bold text-lg">{currentTeam.teamName}</p>
              <p className="text-white/60 text-xs">
                {currentTeam.coachName}
                {isMyPick && ' (YOU)'}
              </p>
            </div>
          </div>
          <PickTimer deadline={pickDeadline} isPaused={isPaused} dark={true} />
        </div>
      )}

      {/* Main Content: Two columns on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* LEFT: Pick Feed / Board (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <div className={`rounded-xl overflow-hidden ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            <div className={`px-4 py-2.5 border-b flex items-center justify-between ${dark ? 'border-white/10' : 'border-slate-100'}`}>
              <h3 className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>
                {viewMode === 'feed' ? '📋 Pick Feed' : '📊 Draft Board'}
              </h3>
              <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                {activePicks.length} / {draft.totalPlayers} picks
              </span>
            </div>

            {viewMode === 'feed' ? (
              <div ref={pickListRef} className="max-h-[400px] overflow-y-auto">
                {activePicks.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className={`text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Waiting for first pick...
                    </p>
                  </div>
                ) : (
                  [...activePicks].reverse().map((pick, i) => (
                    <PickFeedItem
                      key={pick.id || i}
                      pick={pick}
                      teams={draft.teams}
                      dark={dark}
                      isLatest={i === 0}
                    />
                  ))
                )}
              </div>
            ) : (
              <BoardView picks={picks} teams={draft.teams} totalRounds={draft.totalRounds} dark={dark} />
            )}
          </div>

          {/* Team Roster Summary */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {draft.teams.map(team => {
              const teamPicks = activePicks.filter(p => p.teamId === team.teamId);
              return (
                <div
                  key={team.teamId}
                  className={`flex-shrink-0 rounded-lg px-3 py-2 min-w-[100px] ${dark ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color || '#a855f7' }} />
                    <span className={`text-xs font-medium truncate ${dark ? 'text-white' : 'text-slate-900'}`}>
                      {team.teamName}
                    </span>
                  </div>
                  <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
                    {teamPicks.length}
                  </p>
                  <p className={`text-[10px] ${dark ? 'text-slate-600' : 'text-slate-400'}`}>players</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Available Players (2 cols) */}
        {!isWatchMode && (canPick || isCommissioner) && (
          <div className="lg:col-span-2 space-y-3">
            <div className={`rounded-xl overflow-hidden ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
              <div className={`px-4 py-2.5 border-b ${dark ? 'border-white/10' : 'border-slate-100'}`}>
                <h3 className={`text-sm font-semibold mb-2 ${dark ? 'text-white' : 'text-slate-900'}`}>
                  🎯 Available Players ({availablePlayers.length})
                </h3>
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search players..."
                    className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm ${
                      dark
                        ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                        : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                    } outline-none focus:ring-2 focus:ring-purple-500/50`}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className={`w-4 h-4 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
                    </button>
                  )}
                </div>
              </div>

              {/* Position filter pills */}
              {allPositions.length > 0 && (
                <div className={`px-4 py-2 flex gap-1.5 overflow-x-auto border-b ${dark ? 'border-white/10' : 'border-slate-100'}`}>
                  <button
                    onClick={() => setPositionFilter('all')}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      positionFilter === 'all' ? 'bg-purple-600 text-white' : dark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    All
                  </button>
                  {allPositions.map(pos => (
                    <button
                      key={pos}
                      onClick={() => setPositionFilter(pos)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                        positionFilter === pos ? 'bg-purple-600 text-white' : dark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              )}

              {/* Player List */}
              <div className="max-h-[450px] overflow-y-auto p-2 space-y-1.5">
                {loadingPlayers ? (
                  <div className="py-8 text-center">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : filteredPlayers.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className={`text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {searchQuery ? 'No players match search' : 'No players available'}
                    </p>
                  </div>
                ) : (
                  filteredPlayers.map(player => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      onSelect={handleSelectPlayer}
                      isSelected={selectedPlayer?.id === player.id}
                      dark={dark}
                      disabled={!canPick}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Watch Mode */}
        {isWatchMode && (
          <div className="lg:col-span-2">
            <div className={`rounded-xl p-6 text-center ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
              <Eye className={`w-8 h-8 mx-auto mb-3 ${dark ? 'text-purple-400' : 'text-purple-600'}`} />
              <h3 className={`font-semibold mb-1 ${dark ? 'text-white' : 'text-slate-900'}`}>Watch Party Mode</h3>
              <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                {draft.playersRemaining} players remaining
              </p>
              <div className="mt-4 h-2 rounded-full overflow-hidden bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500"
                  style={{ width: `${((draft.totalPlayers - draft.playersRemaining) / draft.totalPlayers) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== PICK CONFIRMATION SLIDE-UP ===== */}
      {showConfirm && selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setShowConfirm(false); setSelectedPlayer(null); }}
          />
          <div className={`relative w-full max-w-lg rounded-t-2xl p-6 pb-8 ${
            dark ? 'bg-zinc-900 border-t border-white/10' : 'bg-white border-t border-slate-200'
          }`}
            style={{ animation: 'slideUp 0.3s ease-out' }}
          >
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            <div className="text-center mb-6">
              <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-bold ${
                dark ? 'bg-white/10 text-white' : 'bg-purple-100 text-purple-700'
              }`}>
                {selectedPlayer.playerName.charAt(0)}
              </div>
              <h3 className={`text-xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
                {selectedPlayer.playerName}
              </h3>
              <div className="flex items-center justify-center gap-2 mt-1">
                {selectedPlayer.preferredPositions?.[0] && (
                  <span className={`text-sm px-2 py-0.5 rounded ${dark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                    {selectedPlayer.preferredPositions[0]}
                  </span>
                )}
                {selectedPlayer.playerAge && (
                  <span className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Age {selectedPlayer.playerAge}
                  </span>
                )}
              </div>
            </div>
            <div className={`rounded-xl p-3 mb-5 ${dark ? 'bg-white/5' : 'bg-slate-50'}`}>
              <p className={`text-xs text-center ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                Round {draft.currentRound} • Pick #{draft.currentPick}
              </p>
              <p className={`text-sm font-semibold text-center mt-1 ${dark ? 'text-white' : 'text-slate-900'}`}>
                Drafting to {currentTeam?.teamName}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); setSelectedPlayer(null); }}
                className={`flex-1 py-3 rounded-xl text-sm font-medium ${
                  dark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPick}
                disabled={makingPick}
                className="flex-1 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-500 hover:to-purple-400 disabled:opacity-50"
              >
                {makingPick ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Drafting...
                  </span>
                ) : (
                  '✅ Confirm Pick'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== "YOU'VE BEEN DRAFTED" CELEBRATION ===== */}
      {celebration && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
          style={{ animation: 'celebrationFade 4s ease-out forwards' }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative text-center p-8"
            style={{ animation: 'celebrationPop 0.5s ease-out' }}
          >
            {/* Emoji burst */}
            <div className="text-6xl mb-4" style={{ animation: 'celebrationBounce 0.8s ease-out' }}>
              🎉🏈🎉
            </div>
            <h2 className="text-3xl font-black text-white mb-2 drop-shadow-lg">
              YOU DRAFTED
            </h2>
            <h1
              className="text-4xl font-black mb-3 drop-shadow-lg"
              style={{ color: celebration.teamColor }}
            >
              {celebration.playerName}
            </h1>
            <p className="text-lg text-white/80 font-medium">
              Welcome to {celebration.teamName}! 🏆
            </p>
            {/* Floating emoji particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {['🏈', '⭐', '🔥', '💪', '🎯', '🏆', '✨', '🎊'].map((emoji, i) => (
                <span
                  key={i}
                  className="absolute text-2xl"
                  style={{
                    left: `${10 + (i * 12)}%`,
                    animation: `celebrationFloat ${1.5 + (i * 0.2)}s ease-out ${i * 0.1}s forwards`,
                    opacity: 0,
                  }}
                >
                  {emoji}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes celebrationFade {
          0%, 70% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes celebrationPop {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes celebrationBounce {
          0% { transform: translateY(-30px); opacity: 0; }
          50% { transform: translateY(10px); }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes celebrationFloat {
          0% { transform: translateY(100px); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translateY(-200px) rotate(${Math.random() * 360}deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default DraftRoom;
