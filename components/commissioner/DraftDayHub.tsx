/**
 * Draft Day Hub
 * Landing page for Draft Day feature
 * - Commissioners: See all drafts, create new ones
 * - Coaches: See drafts they're part of, access war room
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { onProgramDrafts, getDraftsForCoach } from '../../services/draftDayService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { DraftEvent } from '../../types';
import { Timestamp } from 'firebase/firestore';
import {
  Button,
  Badge,
  GlassCard,
  GradientText,
} from '../ui/OSYSComponents';
import EmptyState from '../ui/EmptyState';
import Skeleton from '../ui/Skeleton';
import {
  Plus,
  Calendar,
  Users,
  Trophy,
  Clock,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Shuffle,
  ChevronRight,
  Zap,
  Timer,
} from 'lucide-react';
import { toastError } from '../../services/toast';

// Status config for badges
const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'primary' | 'gold' | 'success' | 'live' | 'coming' | 'warning' | 'error'; icon: React.ReactNode }> = {
  scheduled: { label: 'Scheduled', variant: 'primary', icon: <Calendar className="w-3 h-3" /> },
  lottery_pending: { label: 'Lottery Pending', variant: 'gold', icon: <Shuffle className="w-3 h-3" /> },
  in_progress: { label: 'LIVE', variant: 'live', icon: <Zap className="w-3 h-3" /> },
  paused: { label: 'Paused', variant: 'warning', icon: <Pause className="w-3 h-3" /> },
  completed: { label: 'Completed', variant: 'success', icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', variant: 'error', icon: <XCircle className="w-3 h-3" /> },
};

// Sport emojis
const SPORT_EMOJI: Record<string, string> = {
  football: '🏈', basketball: '🏀', soccer: '⚽', baseball: '⚾',
  cheer: '📣', volleyball: '🏐', other: '🎯',
};

const DraftDayHub: React.FC = () => {
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [drafts, setDrafts] = useState<DraftEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'live' | 'completed'>('all');
  
  const isCommissioner = ['Commissioner', 'TeamCommissioner', 'ProgramCommissioner'].includes(userData?.role || '');
  const isCoach = userData?.role === 'Coach';

  useEffect(() => {
    if (!user) return;
    
    const loadDrafts = async () => {
      try {
        if (isCommissioner && userData?.programId) {
          // Commissioner: listen to their program's drafts
          const unsub = onProgramDrafts(userData.programId, (d) => {
            setDrafts(d);
            setLoading(false);
          });
          return unsub;
        } else if (isCoach) {
          // Coach: find all programs they're part of via their teams
          const teamsSnap = await getDocs(
            query(collection(db, 'teams'), where('coachId', '==', user.uid))
          );
          const programIds = [...new Set(
            teamsSnap.docs
              .map(d => d.data().programId)
              .filter(Boolean)
          )] as string[];
          
          if (programIds.length > 0) {
            const coachDrafts = await getDraftsForCoach(user.uid, programIds);
            setDrafts(coachDrafts);
          }
          setLoading(false);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading drafts:', err);
        toastError('Failed to load drafts');
        setLoading(false);
      }
    };
    
    loadDrafts();
  }, [user, userData?.programId, isCommissioner, isCoach]);

  const formatDate = (date: Timestamp | Date | any) => {
    if (!date) return 'TBD';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { 
      weekday: 'short', month: 'short', day: 'numeric', 
      hour: 'numeric', minute: '2-digit' 
    });
  };

  const getTimeUntil = (date: Timestamp | Date | any) => {
    if (!date) return '';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff < 0) return 'Past due';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${mins}m`;
  };

  const filteredDrafts = drafts.filter(d => {
    if (filter === 'upcoming') return ['scheduled', 'lottery_pending'].includes(d.status);
    if (filter === 'live') return ['in_progress', 'paused'].includes(d.status);
    if (filter === 'completed') return ['completed', 'cancelled'].includes(d.status);
    return true;
  });

  const liveDrafts = drafts.filter(d => d.status === 'in_progress');
  const upcomingDrafts = drafts.filter(d => ['scheduled', 'lottery_pending'].includes(d.status));

  const handleDraftClick = (draft: DraftEvent) => {
    if (isCommissioner) {
      if (draft.status === 'in_progress' || draft.status === 'paused') {
        navigate(`/commissioner/draft-day/${draft.id}`);
      } else {
        navigate(`/commissioner/draft-day/${draft.id}`);
      }
    } else {
      navigate(`/draft-day/${draft.id}`);
    }
  };

  const dark = theme === 'dark';

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
            🏈 Draft Day
          </h1>
          <p className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
            {isCommissioner 
              ? 'Create and manage live drafts for your program' 
              : 'View your upcoming drafts and prep your war room'}
          </p>
        </div>
        {isCommissioner && (
          <Button
            variant="primary"
            onClick={() => navigate(
              isCommissioner 
                ? '/commissioner/draft-day/setup' 
                : '/draft-day/setup'
            )}
          >
            <Plus className="w-4 h-4 mr-1" />
            Create Draft
          </Button>
        )}
      </div>

      {/* Live Draft Banner */}
      {liveDrafts.length > 0 && (
        <div 
          onClick={() => handleDraftClick(liveDrafts[0])}
          className="relative overflow-hidden rounded-xl cursor-pointer group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-purple-600 to-red-600 animate-pulse opacity-80" />
          <div className="relative px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <div>
                <p className="text-white font-bold text-lg">DRAFT IS LIVE!</p>
                <p className="text-white/80 text-sm">
                  {liveDrafts[0].ageGroupLabel} • Round {liveDrafts[0].currentRound}, Pick #{liveDrafts[0].currentPick}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white">
              <span className="text-sm font-medium">Enter Draft Room</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      )}

      {/* Stats Row */}
      {drafts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className={`rounded-xl p-4 text-center ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            <p className={`text-2xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{drafts.length}</p>
            <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-600'}`}>Total Drafts</p>
          </div>
          <div className={`rounded-xl p-4 text-center ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            <p className={`text-2xl font-bold text-purple-500`}>{upcomingDrafts.length}</p>
            <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-600'}`}>Upcoming</p>
          </div>
          <div className={`rounded-xl p-4 text-center ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            <p className={`text-2xl font-bold text-emerald-500`}>
              {drafts.filter(d => d.status === 'completed').length}
            </p>
            <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-600'}`}>Completed</p>
          </div>
        </div>
      )}

      {/* Filter Pills */}
      {drafts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'upcoming', 'live', 'completed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : dark 
                    ? 'bg-white/5 text-slate-300 hover:bg-white/10' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'live' && '🔴 '}{f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && drafts.length === 0 && (
        <EmptyState
          type="generic"
          icon={Trophy}
          title="No Drafts Yet"
          description={
            isCommissioner
              ? "Create your first Draft Day event! Set up a draft for any age group pool with 2+ teams."
              : "No drafts have been scheduled for your teams yet. Your commissioner will set one up when it's time."
          }
          onAction={isCommissioner ? () => navigate('/commissioner/draft-day/setup') : undefined}
          actionLabel={isCommissioner ? 'Create First Draft' : undefined}
        />
      )}

      {/* Draft Cards */}
      {!loading && filteredDrafts.length > 0 && (
        <div className="space-y-3">
          {filteredDrafts.map(draft => {
            const status = STATUS_CONFIG[draft.status] || STATUS_CONFIG.scheduled;
            const isLive = draft.status === 'in_progress';
            const isPaused = draft.status === 'paused';
            const myTeam = isCoach 
              ? draft.teams.find(t => t.coachId === user?.uid) 
              : null;
            
            return (
              <div
                key={draft.id}
                onClick={() => handleDraftClick(draft)}
                className={`rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.01] ${
                  isLive 
                    ? 'ring-2 ring-red-500/50' 
                    : isPaused 
                      ? 'ring-2 ring-amber-500/30' 
                      : ''
                } ${dark ? 'bg-white/5 border border-white/10 hover:bg-white/[0.07]' : 'bg-white border border-slate-200 hover:shadow-md'}`}
              >
                {/* Card Header */}
                <div className={`px-4 py-3 flex items-center justify-between border-b ${dark ? 'border-white/10' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{SPORT_EMOJI[draft.sport] || '🎯'}</span>
                    <div>
                      <h3 className={`font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>
                        {draft.ageGroupLabel} Draft
                      </h3>
                      {draft.programName && (
                        <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {draft.programName}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant={status.variant}>
                    <span className="flex items-center gap-1">
                      {status.icon} {status.label}
                    </span>
                  </Badge>
                </div>

                {/* Card Body */}
                <div className="px-4 py-3 space-y-3">
                  {/* Key Info Row */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Calendar className={`w-3.5 h-3.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
                      <span className={dark ? 'text-slate-300' : 'text-slate-700'}>
                        {formatDate(draft.scheduledDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className={`w-3.5 h-3.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
                      <span className={dark ? 'text-slate-300' : 'text-slate-700'}>
                        {draft.totalPlayers} players • {draft.teams.length} teams
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Shuffle className={`w-3.5 h-3.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
                      <span className={dark ? 'text-slate-300' : 'text-slate-700'}>
                        {draft.draftType.charAt(0).toUpperCase() + draft.draftType.slice(1)} Draft
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Timer className={`w-3.5 h-3.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
                      <span className={dark ? 'text-slate-300' : 'text-slate-700'}>
                        {draft.pickTimerSeconds}s per pick
                      </span>
                    </div>
                  </div>

                  {/* Teams Preview */}
                  <div className="flex flex-wrap gap-2">
                    {draft.teams.map(team => (
                      <div
                        key={team.teamId}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${
                          myTeam?.teamId === team.teamId
                            ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30'
                            : dark 
                              ? 'bg-white/5 text-slate-400' 
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {team.teamName}
                        {myTeam?.teamId === team.teamId && (
                          <span className="text-[10px] ml-1 opacity-70">YOU</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Live Progress */}
                  {(isLive || isPaused) && (
                    <div className={`rounded-lg px-3 py-2 ${dark ? 'bg-white/5' : 'bg-slate-50'}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className={dark ? 'text-slate-400' : 'text-slate-500'}>
                          Round {draft.currentRound} • Pick #{draft.currentPick}
                        </span>
                        <span className={dark ? 'text-white' : 'text-slate-900'}>
                          {draft.playersRemaining} players left
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-white/10">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all"
                          style={{ 
                            width: `${((draft.totalPlayers - draft.playersRemaining) / draft.totalPlayers) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Upcoming countdown */}
                  {['scheduled', 'lottery_pending'].includes(draft.status) && (
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                        Starts in {getTimeUntil(draft.scheduledDate)}
                      </span>
                      {isCoach && (
                        <span className={`text-xs flex items-center gap-1 ${dark ? 'text-purple-400' : 'text-purple-600'}`}>
                          Prep War Room <ChevronRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DraftDayHub;
