/**
 * Game Day Manager Component
 * Shows today's game with:
 * - Pre-game: Countdown timer, game details
 * - During game: Live score updater (coach only), embedded live stream
 * - Post-game: Stats entry, final score
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { toastSuccess, toastError } from '../services/toast';
import { GlassCard, Badge } from './ui/OSYSComponents';
import { LiveStreamViewer } from './livestream';
import type { LiveStream } from '../types';
import { 
  Clock, 
  MapPin, 
  Play, 
  Pause, 
  Trophy, 
  Users,
  Video,
  Plus,
  Minus,
  Check,
  ChevronRight,
  Loader2,
  Tv,
  Calendar,
  Timer,
  Target,
  Award
} from 'lucide-react';

interface TodayGame {
  id: string;
  title: string;
  opponent?: string;
  location?: string;
  time?: string;
  date?: string;
  homeScore?: number;
  awayScore?: number;
  isHome?: boolean;
  status?: 'scheduled' | 'live' | 'completed';
  quarter?: number;
  gameTime?: string;
  teamId?: string;
}

interface GameDayManagerProps {
  game: TodayGame;
  liveStreams?: LiveStream[];
  onGoLive?: () => void;
  onOpenStats?: (gameId: string) => void;
  teamId: string;
}

const GameDayManager: React.FC<GameDayManagerProps> = ({
  game,
  liveStreams = [],
  onGoLive,
  onOpenStats,
  teamId
}) => {
  const { userData, teamData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [countdown, setCountdown] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showLiveStream, setShowLiveStream] = useState(false);
  const [localHomeScore, setLocalHomeScore] = useState(game.homeScore || 0);
  const [localAwayScore, setLocalAwayScore] = useState(game.awayScore || 0);
  const [editingScore, setEditingScore] = useState<'home' | 'away' | null>(null);
  const [editScoreValue, setEditScoreValue] = useState('');
  const [homeScoreChange, setHomeScoreChange] = useState<number | null>(null);
  const [awayScoreChange, setAwayScoreChange] = useState<number | null>(null);
  
  const isCoach = userData?.role === 'Coach' || userData?.role === 'SuperAdmin';
  const hasLiveStream = liveStreams.length > 0;
  
  // Track previous scores for animation
  const prevHomeScore = React.useRef(game.homeScore || 0);
  const prevAwayScore = React.useRef(game.awayScore || 0);
  
  // Sync local scores when game prop changes (for real-time updates from Firebase)
  // Also trigger score change animation
  useEffect(() => {
    const newHome = game.homeScore || 0;
    const newAway = game.awayScore || 0;
    
    // Show score change animation if score increased
    if (newHome > prevHomeScore.current) {
      const diff = newHome - prevHomeScore.current;
      setHomeScoreChange(diff);
      setTimeout(() => setHomeScoreChange(null), 1500);
    }
    if (newAway > prevAwayScore.current) {
      const diff = newAway - prevAwayScore.current;
      setAwayScoreChange(diff);
      setTimeout(() => setAwayScoreChange(null), 1500);
    }
    
    prevHomeScore.current = newHome;
    prevAwayScore.current = newAway;
    setLocalHomeScore(newHome);
    setLocalAwayScore(newAway);
  }, [game.homeScore, game.awayScore]);
  
  // Calculate game state - prioritize explicit status, then time-based
  // Key insight: If game was never started (no status='live' or 'completed'), 
  // coach should still be able to start it even if scheduled time passed
  const gameState = useMemo(() => {
    // Explicit statuses take priority
    if (game.status === 'completed') return 'completed';
    if (game.status === 'live') return 'live';
    
    // For scheduled games, check time
    if (!game.time || !game.date) return 'ready'; // No time? Just show as ready
    
    const now = new Date();
    const [hours, minutes] = game.time.split(':').map(Number);
    const gameDate = new Date(game.date);
    gameDate.setHours(hours || 0, minutes || 0, 0, 0);
    
    // If scheduled time hasn't arrived yet, show countdown
    if (now < gameDate) return 'pregame';
    
    // Scheduled time has passed but game not started - show as "ready" so coach can start
    // This is better than "postgame" which hides all controls
    return 'ready';
  }, [game.time, game.date, game.status]);

  // Countdown timer
  useEffect(() => {
    if (gameState !== 'pregame' || !game.time || !game.date) {
      setCountdown(null);
      return;
    }
    
    const updateCountdown = () => {
      const now = new Date();
      const [hours, minutes] = game.time!.split(':').map(Number);
      const gameDate = new Date(game.date!);
      gameDate.setHours(hours || 0, minutes || 0, 0, 0);
      
      const diff = gameDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        setCountdown(null);
        return;
      }
      
      setCountdown({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      });
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [gameState, game.time, game.date]);

  // Update scores in Firebase (update in global events collection)
  const updateScore = async (team: 'home' | 'away', delta: number) => {
    if (!isCoach || !game.id) return;
    
    const newScore = team === 'home' 
      ? Math.max(0, localHomeScore + delta)
      : Math.max(0, localAwayScore + delta);
    
    if (team === 'home') setLocalHomeScore(newScore);
    else setLocalAwayScore(newScore);
    
    try {
      // Update in global events collection (where game data comes from)
      await updateDoc(doc(db, 'events', game.id), {
        [team === 'home' ? 'homeScore' : 'awayScore']: newScore,
        status: 'live',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error updating score:', err);
      // Revert on error
      if (team === 'home') setLocalHomeScore(game.homeScore || 0);
      else setLocalAwayScore(game.awayScore || 0);
    }
  };

  // Set score directly (for clicking on score to edit)
  const setScoreDirectly = async (team: 'home' | 'away', newScore: number) => {
    if (!isCoach || !game.id) return;
    
    const score = Math.max(0, newScore);
    if (team === 'home') setLocalHomeScore(score);
    else setLocalAwayScore(score);
    
    try {
      await updateDoc(doc(db, 'events', game.id), {
        [team === 'home' ? 'homeScore' : 'awayScore']: score,
        status: 'live',
        updatedAt: serverTimestamp()
      });
      setEditingScore(null);
    } catch (err) {
      console.error('Error setting score:', err);
      if (team === 'home') setLocalHomeScore(game.homeScore || 0);
      else setLocalAwayScore(game.awayScore || 0);
    }
  };

  // Handle score click to edit
  const handleScoreClick = (team: 'home' | 'away') => {
    if (!isCoach || gameState !== 'live') return;
    setEditingScore(team);
    setEditScoreValue(String(team === 'home' ? localHomeScore : localAwayScore));
  };

  // Handle score edit submit
  const handleScoreSubmit = (team: 'home' | 'away') => {
    const score = parseInt(editScoreValue, 10);
    if (!isNaN(score)) {
      setScoreDirectly(team, score);
    }
    setEditingScore(null);
  };

  // Mark game as started
  const startGame = async () => {
    if (!isCoach || !game.id) {
      console.error('[GameDayManager] Cannot start game:', { isCoach, gameId: game.id });
      toastError('You must be a coach to start the game');
      return;
    }
    setIsUpdating(true);
    console.log('[GameDayManager] Starting game:', game.id);
    try {
      await updateDoc(doc(db, 'events', game.id), {
        status: 'live',
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('[GameDayManager] Game started successfully');
      toastSuccess('Game started! You can now update the score.');
    } catch (err: any) {
      console.error('[GameDayManager] Error starting game:', err?.code, err?.message, err);
      toastError(`Failed to start game: ${err?.message || 'Permission denied'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Mark game as completed
  const endGame = async () => {
    if (!isCoach || !game.id) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'events', game.id), {
        status: 'completed',
        homeScore: localHomeScore,
        awayScore: localAwayScore,
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toastSuccess('Game completed! Don\'t forget to enter stats.');
    } catch (err) {
      console.error('Error ending game:', err);
      toastError('Failed to end game');
    } finally {
      setIsUpdating(false);
    }
  };

  // Format time for display
  const formatTime = (time?: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  // Sport emoji based on team sport
  const sportEmoji = useMemo(() => {
    const sport = teamData?.sport?.toLowerCase();
    const emojis: Record<string, string> = {
      football: '🏈',
      basketball: '🏀',
      soccer: '⚽',
      baseball: '⚾',
      volleyball: '🏐',
      hockey: '🏒',
      lacrosse: '🥍',
      softball: '🥎',
    };
    return emojis[sport || ''] || '🏆';
  }, [teamData?.sport]);

  return (
    <div className={`rounded-2xl overflow-hidden ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-purple-900/30 via-zinc-900 to-zinc-900 border border-purple-500/30' 
        : 'bg-gradient-to-br from-purple-50 via-white to-orange-50 border border-purple-200 shadow-xl'
    }`}>
      {/* Header */}
      <div className={`px-6 py-4 ${
        gameState === 'live' 
          ? 'bg-gradient-to-r from-red-600 to-orange-600' 
          : gameState === 'completed'
            ? 'bg-gradient-to-r from-green-600 to-emerald-600'
            : 'bg-gradient-to-r from-purple-600 to-indigo-600'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{sportEmoji}</span>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Game Day
                {gameState === 'live' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-sm animate-pulse">
                    <span className="w-2 h-2 bg-red-400 rounded-full animate-ping" />
                    LIVE
                  </span>
                )}
              </h2>
              <p className="text-white/80 text-sm">
                {game.isHome ? 'vs' : '@'} {game.opponent || 'TBD'}
              </p>
            </div>
          </div>
          
          {/* Game Status Badge */}
          <div className="text-right">
            {gameState === 'pregame' && countdown && (
              <div className="text-white">
                <div className="text-xs uppercase tracking-wider opacity-80">Starts in</div>
                <div className="text-2xl font-mono font-bold">
                  {countdown.hours > 0 && `${countdown.hours}:`}
                  {String(countdown.minutes).padStart(2, '0')}:
                  {String(countdown.seconds).padStart(2, '0')}
                </div>
              </div>
            )}
            {gameState === 'completed' && (
              <div className="flex items-center gap-2 text-white">
                <Trophy className="w-5 h-5" />
                <span className="font-bold">Final</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Score Display */}
        <div className="flex items-center justify-center gap-4 md:gap-6 mb-6">
          {/* Home Team */}
          <div className="flex-1 text-center">
            {/* Team Logo (if available) */}
            {game.isHome && teamData?.logo ? (
              <div className="flex justify-center mb-2">
                <img 
                  src={teamData.logo} 
                  alt={teamData.name}
                  className="w-12 h-12 md:w-16 md:h-16 object-contain rounded-lg"
                />
              </div>
            ) : null}
            <div className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {game.isHome ? teamData?.name : game.opponent}
            </div>
            {/* Score with change animation */}
            <div className="relative inline-block">
              {/* Clickable score for direct edit */}
              {editingScore === 'home' ? (
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="number"
                    value={editScoreValue}
                    onChange={(e) => setEditScoreValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleScoreSubmit('home');
                      if (e.key === 'Escape') setEditingScore(null);
                    }}
                    onBlur={() => handleScoreSubmit('home')}
                    autoFocus
                    className={`w-24 text-5xl font-bold text-center rounded-lg border-2 ${
                      theme === 'dark' 
                        ? 'bg-white/10 border-purple-500 text-white' 
                        : 'bg-white border-purple-500 text-zinc-900'
                    }`}
                    min="0"
                  />
                </div>
              ) : (
                <div 
                  onClick={() => handleScoreClick('home')}
                  className={`text-5xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'} ${
                    isCoach && gameState === 'live' ? 'cursor-pointer hover:text-purple-400 transition' : ''
                  }`}
                  title={isCoach && gameState === 'live' ? 'Click to edit score' : ''}
                >
                  {localHomeScore}
                </div>
              )}
              {/* Score change animation */}
              {homeScoreChange !== null && (
                <div className="absolute -top-2 -right-8 animate-bounce">
                  <span className="text-2xl font-bold text-green-500 drop-shadow-lg animate-pulse">
                    +{homeScoreChange}
                  </span>
                </div>
              )}
            </div>
            {isCoach && gameState === 'live' && (
              <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
                <button
                  onClick={() => updateScore('home', -1)}
                  disabled={localHomeScore === 0}
                  className={`p-2 rounded-lg transition ${
                    localHomeScore === 0 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'bg-red-500/20 hover:bg-red-500/30 text-red-500'
                  }`}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => updateScore('home', 1)}
                  className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-500 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => updateScore('home', 3)}
                  className="px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition text-xs font-bold"
                >
                  +3
                </button>
                <button
                  onClick={() => updateScore('home', 7)}
                  className="px-2 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition text-xs font-bold"
                >
                  +7
                </button>
              </div>
            )}
          </div>

          {/* VS Divider */}
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            VS
          </div>

          {/* Away Team */}
          <div className="flex-1 text-center">
            {/* Team Logo (if available - show our logo if away) */}
            {!game.isHome && teamData?.logo ? (
              <div className="flex justify-center mb-2">
                <img 
                  src={teamData.logo} 
                  alt={teamData.name}
                  className="w-12 h-12 md:w-16 md:h-16 object-contain rounded-lg"
                />
              </div>
            ) : null}
            <div className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {game.isHome ? game.opponent : teamData?.name}
            </div>
            {/* Score with change animation */}
            <div className="relative inline-block">
              {/* Clickable score for direct edit */}
              {editingScore === 'away' ? (
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="number"
                    value={editScoreValue}
                    onChange={(e) => setEditScoreValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleScoreSubmit('away');
                      if (e.key === 'Escape') setEditingScore(null);
                    }}
                    onBlur={() => handleScoreSubmit('away')}
                    autoFocus
                    className={`w-24 text-5xl font-bold text-center rounded-lg border-2 ${
                      theme === 'dark' 
                        ? 'bg-white/10 border-purple-500 text-white' 
                        : 'bg-white border-purple-500 text-zinc-900'
                    }`}
                    min="0"
                  />
                </div>
              ) : (
                <div 
                  onClick={() => handleScoreClick('away')}
                  className={`text-5xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'} ${
                    isCoach && gameState === 'live' ? 'cursor-pointer hover:text-purple-400 transition' : ''
                  }`}
                  title={isCoach && gameState === 'live' ? 'Click to edit score' : ''}
                >
                  {localAwayScore}
                </div>
              )}
              {/* Score change animation */}
              {awayScoreChange !== null && (
                <div className="absolute -top-2 -right-8 animate-bounce">
                  <span className="text-2xl font-bold text-green-500 drop-shadow-lg animate-pulse">
                    +{awayScoreChange}
                  </span>
                </div>
              )}
            </div>
            {isCoach && gameState === 'live' && (
              <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
                <button
                  onClick={() => updateScore('away', -1)}
                  disabled={localAwayScore === 0}
                  className={`p-2 rounded-lg transition ${
                    localAwayScore === 0 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'bg-red-500/20 hover:bg-red-500/30 text-red-500'
                  }`}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => updateScore('away', 1)}
                  className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-500 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => updateScore('away', 3)}
                  className="px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition text-xs font-bold"
                >
                  +3
                </button>
                <button
                  onClick={() => updateScore('away', 7)}
                  className="px-2 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition text-xs font-bold"
                >
                  +7
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Game Details */}
        <div className={`flex items-center justify-center gap-6 mb-6 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          {game.time && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatTime(game.time)}
            </div>
          )}
          {game.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {typeof game.location === 'object' 
                ? ((game.location as any)?.name || (game.location as any)?.address || 'TBD') 
                : game.location}
            </div>
          )}
        </div>

        {/* Live Stream Section */}
        {(hasLiveStream || (isCoach && gameState !== 'completed')) && (
          <div className={`rounded-xl overflow-hidden mb-6 ${
            theme === 'dark' ? 'bg-black/30' : 'bg-slate-100'
          }`}>
            {hasLiveStream ? (
              <div>
                <div className={`flex items-center justify-between px-4 py-3 ${
                  theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className={`font-medium ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                      Live Stream Active
                    </span>
                  </div>
                  <button
                    onClick={() => setShowLiveStream(!showLiveStream)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      showLiveStream
                        ? theme === 'dark' ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-700'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    {showLiveStream ? 'Hide' : 'Watch Live'}
                  </button>
                </div>
                {showLiveStream && (
                  <div className="aspect-video">
                    <LiveStreamViewer 
                      streams={liveStreams}
                      teamId={teamId}
                      teamName={teamData?.name || 'Team'}
                      onClose={() => setShowLiveStream(false)}
                    />
                  </div>
                )}
              </div>
            ) : isCoach && gameState !== 'completed' && (
              <button
                onClick={onGoLive}
                className="w-full flex items-center justify-center gap-3 px-4 py-4 text-red-500 hover:bg-red-500/10 transition"
              >
                <Video className="w-6 h-6" />
                <span className="font-medium">Start Live Stream</span>
              </button>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {/* Pre-game or Ready: Start Game button */}
          {isCoach && (gameState === 'pregame' || gameState === 'ready') && (
            <button
              onClick={startGame}
              disabled={isUpdating}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium rounded-xl transition"
            >
              {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              Start Game
            </button>
          )}

          {/* Live: End Game button */}
          {isCoach && gameState === 'live' && (
            <button
              onClick={endGame}
              disabled={isUpdating}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-medium rounded-xl transition"
            >
              {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              End Game
            </button>
          )}

          {/* Completed: Enter Stats button */}
          {gameState === 'completed' && isCoach && (
            <button
              onClick={() => onOpenStats?.(game.id)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl transition"
            >
              <Target className="w-5 h-5" />
              Enter Game Stats
            </button>
          )}
        </div>

        {/* Coach Tip for ready state */}
        {isCoach && gameState === 'ready' && (
          <p className={`text-center text-sm mt-4 ${theme === 'dark' ? 'text-amber-400/70' : 'text-amber-600'}`}>
            ⚡ Game time has passed. Click "Start Game" to begin live scoring!
          </p>
        )}

        {/* Winner Badge for completed games */}
        {gameState === 'completed' && (
          <div className="mt-6 text-center">
            {localHomeScore > localAwayScore ? (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                game.isHome 
                  ? 'bg-green-500/20 text-green-500' 
                  : 'bg-red-500/20 text-red-500'
              }`}>
                <Trophy className="w-5 h-5" />
                <span className="font-bold">
                  {game.isHome ? 'Victory!' : 'Defeat'}
                </span>
              </div>
            ) : localAwayScore > localHomeScore ? (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                game.isHome 
                  ? 'bg-red-500/20 text-red-500' 
                  : 'bg-green-500/20 text-green-500'
              }`}>
                <Trophy className="w-5 h-5" />
                <span className="font-bold">
                  {game.isHome ? 'Defeat' : 'Victory!'}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/20 text-yellow-500">
                <Award className="w-5 h-5" />
                <span className="font-bold">Tie Game</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameDayManager;
