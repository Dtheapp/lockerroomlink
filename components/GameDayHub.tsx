/**
 * Game Day Hub - Simplified Game Management
 * 
 * Shows ALL games in a list. Coach clicks to view/manage any game.
 * - Past games: Read-only, shows historical scores
 * - Live game: Editable scores, shown to all users by default
 * - Future games: View only, no score editing until start time
 * 
 * Edit Rules:
 * - Can edit scores ONLY when: game start time passed AND status !== 'completed'
 * - Coach marks game "live" → becomes default view for all users
 * - Coach marks game "completed" → locks scores, shows in history
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { toastSuccess, toastError } from '../services/toast';
import { LiveStreamViewer } from './livestream';
import type { LiveStream, TeamGame } from '../types';
import { 
  Clock, 
  MapPin, 
  Play, 
  Trophy, 
  Video,
  Plus,
  Minus,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Loader2,
  Tv,
  Calendar,
  Target,
  Award,
  StopCircle,
  List,
  Radio
} from 'lucide-react';

interface GameDayHubProps {
  games: TeamGame[];
  liveStreams?: LiveStream[];
  onGoLive?: () => void;
  onOpenStats?: () => void;
  teamId: string;
}

const GameDayHub: React.FC<GameDayHubProps> = ({
  games,
  liveStreams = [],
  onGoLive,
  onOpenStats,
  teamId
}) => {
  const { userData, teamData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  // Helper to parse dates from various formats
  const parseGameDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === 'object' && 'toDate' in dateValue) {
      return dateValue.toDate();
    }
    if (typeof dateValue === 'string') {
      // Handle YYYY-MM-DD format
      const parts = dateValue.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
      return new Date(dateValue);
    }
    return new Date();
  };
  
  // Find the live game (if any) - this is the default view for non-coaches
  const liveGame = useMemo(() => games.find(g => g.status === 'live'), [games]);
  
  // Selected game - coaches can pick any, non-coaches default to live game
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showGameList, setShowGameList] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showLiveStream, setShowLiveStream] = useState(false);
  const [showEndStreamConfirm, setShowEndStreamConfirm] = useState(false);
  const [endingStream, setEndingStream] = useState(false);
  
  // Score editing state
  const [localHomeScore, setLocalHomeScore] = useState(0);
  const [localAwayScore, setLocalAwayScore] = useState(0);
  const [editingScore, setEditingScore] = useState<'home' | 'away' | null>(null);
  const [editScoreValue, setEditScoreValue] = useState('');
  const [homeScoreChange, setHomeScoreChange] = useState<number | null>(null);
  const [awayScoreChange, setAwayScoreChange] = useState<number | null>(null);
  
  const isCoach = userData?.role === 'Coach' || userData?.role === 'SuperAdmin';
  const hasLiveStream = liveStreams.length > 0;
  
  // Get the currently selected game
  const selectedGame = useMemo(() => {
    if (selectedGameId) {
      return games.find(g => g.id === selectedGameId);
    }
    // Default: live game for everyone, or first upcoming game for coaches
    if (liveGame) return liveGame;
    // For coaches, show next upcoming game
    if (isCoach) {
      const upcoming = games.find(g => g.status !== 'completed');
      return upcoming || games[0];
    }
    return games[0];
  }, [selectedGameId, games, liveGame, isCoach]);
  
  // Sync local scores when selected game changes
  useEffect(() => {
    if (selectedGame) {
      setLocalHomeScore(selectedGame.homeScore || 0);
      setLocalAwayScore(selectedGame.awayScore || 0);
    }
  }, [selectedGame?.id, selectedGame?.homeScore, selectedGame?.awayScore]);
  
  // Track previous scores for animation
  const prevHomeScore = React.useRef(selectedGame?.homeScore || 0);
  const prevAwayScore = React.useRef(selectedGame?.awayScore || 0);
  
  useEffect(() => {
    if (!selectedGame) return;
    const newHome = selectedGame.homeScore || 0;
    const newAway = selectedGame.awayScore || 0;
    
    if (newHome > prevHomeScore.current) {
      setHomeScoreChange(newHome - prevHomeScore.current);
      setTimeout(() => setHomeScoreChange(null), 2000);
    }
    if (newAway > prevAwayScore.current) {
      setAwayScoreChange(newAway - prevAwayScore.current);
      setTimeout(() => setAwayScoreChange(null), 2000);
    }
    
    prevHomeScore.current = newHome;
    prevAwayScore.current = newAway;
  }, [selectedGame?.homeScore, selectedGame?.awayScore]);
  
  // Determine if editing is allowed
  const canEditScores = useMemo(() => {
    if (!selectedGame || !isCoach) return false;
    if (selectedGame.status === 'completed') return false;
    
    // Check if game time has passed
    const now = new Date();
    const gameDate = parseGameDate(selectedGame.scheduledDate);
    const gameTime = selectedGame.scheduledTime || '00:00';
    const [hours, minutes] = gameTime.split(':').map(Number);
    gameDate.setHours(hours || 0, minutes || 0, 0, 0);
    
    return now >= gameDate || selectedGame.status === 'live';
  }, [selectedGame, isCoach]);
  
  // Game state derived from status and time
  const gameState = useMemo(() => {
    if (!selectedGame) return 'pregame';
    if (selectedGame.status === 'completed') return 'completed';
    if (selectedGame.status === 'live') return 'live';
    
    // Check if game time has passed
    const now = new Date();
    const gameDate = parseGameDate(selectedGame.scheduledDate);
    const gameTime = selectedGame.scheduledTime || '00:00';
    const [hours, minutes] = gameTime.split(':').map(Number);
    gameDate.setHours(hours || 0, minutes || 0, 0, 0);
    
    if (now >= gameDate) return 'ready';
    return 'pregame';
  }, [selectedGame]);
  
  // Format time for display
  const formatTime = (time?: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
  };
  
  // Format date for display
  const formatDate = (date: any) => {
    if (!date) return '';
    const d = parseGameDate(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  // Sport emoji
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
  
  // Update score in Firebase
  const updateScore = async (team: 'home' | 'away', delta: number) => {
    if (!selectedGame?.id || !canEditScores) return;
    
    const newHome = team === 'home' ? localHomeScore + delta : localHomeScore;
    const newAway = team === 'away' ? localAwayScore + delta : localAwayScore;
    
    // Prevent negative scores
    if (newHome < 0 || newAway < 0) return;
    
    // Optimistic update
    if (team === 'home') {
      setLocalHomeScore(newHome);
      setHomeScoreChange(delta);
    } else {
      setLocalAwayScore(newAway);
      setAwayScoreChange(delta);
    }
    setTimeout(() => {
      setHomeScoreChange(null);
      setAwayScoreChange(null);
    }, 2000);
    
    try {
      // SINGLE SOURCE: Update program season game
      if (!selectedGame.programId || !selectedGame.seasonId) {
        throw new Error('Game missing programId or seasonId');
      }
      await updateDoc(
        doc(db, 'programs', selectedGame.programId, 'seasons', selectedGame.seasonId, 'games', selectedGame.id), 
        {
          homeScore: newHome,
          awayScore: newAway,
          updatedAt: serverTimestamp()
        }
      );
    } catch (err) {
      console.error('Error updating score:', err);
      // Revert on error
      setLocalHomeScore(selectedGame.homeScore || 0);
      setLocalAwayScore(selectedGame.awayScore || 0);
      toastError('Failed to update score');
    }
  };
  
  // Handle direct score edit
  const handleScoreSubmit = async (team: 'home' | 'away') => {
    const newScore = parseInt(editScoreValue, 10);
    if (isNaN(newScore) || newScore < 0 || !selectedGame?.id || !canEditScores) {
      setEditingScore(null);
      return;
    }
    
    const delta = newScore - (team === 'home' ? localHomeScore : localAwayScore);
    if (delta !== 0) {
      await updateScore(team, delta);
    }
    setEditingScore(null);
  };
  
  // Start game (mark as live)
  const startGame = async () => {
    if (!isCoach || !selectedGame?.id || !selectedGame?.programId || !selectedGame?.seasonId) return;
    setIsUpdating(true);
    try {
      // SINGLE SOURCE: Update program season game
      await updateDoc(
        doc(db, 'programs', selectedGame.programId, 'seasons', selectedGame.seasonId, 'games', selectedGame.id),
        {
          status: 'live',
          startedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      );
      toastSuccess('Game started! You can now update the score.');
    } catch (err: any) {
      console.error('Error starting game:', err);
      toastError(`Failed to start game: ${err?.message || 'Permission denied'}`);
    } finally {
      setIsUpdating(false);
    }
  };
  
  // End game (mark as completed)
  const endGame = async () => {
    if (!isCoach || !selectedGame?.id || !selectedGame?.programId || !selectedGame?.seasonId) return;
    setIsUpdating(true);
    try {
      // SINGLE SOURCE: Update program season game with final score
      await updateDoc(
        doc(db, 'programs', selectedGame.programId, 'seasons', selectedGame.seasonId, 'games', selectedGame.id),
        {
          status: 'completed',
          homeScore: localHomeScore,
          awayScore: localAwayScore,
          endedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      );

      toastSuccess('Game completed! Stats can be added from the game history.');
    } catch (err) {
      console.error('Error ending game:', err);
      toastError('Failed to end game');
    } finally {
      setIsUpdating(false);
    }
  };
  
  // End live streams
  const handleEndAllStreams = async () => {
    if (!isCoach || liveStreams.length === 0) return;
    setEndingStream(true);
    try {
      for (const stream of liveStreams) {
        await updateDoc(doc(db, 'teams', teamId, 'liveStreams', stream.id), {
          isLive: false,
          endedAt: serverTimestamp(),
        });
      }
      setShowEndStreamConfirm(false);
      toastSuccess('Live stream ended');
    } catch (err) {
      console.error('Error ending streams:', err);
      toastError('Failed to end stream');
    } finally {
      setEndingStream(false);
    }
  };
  
  // Sort games: live first, then by date/time
  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => {
      // Live games first
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (b.status === 'live' && a.status !== 'live') return 1;
      
      // Then by date
      const aDate = parseGameDate(a.scheduledDate);
      const bDate = parseGameDate(b.scheduledDate);
      return aDate.getTime() - bDate.getTime();
    });
  }, [games]);
  
  if (!selectedGame) return null;
  
  // Get team name based on home/away
  const homeName = selectedGame.isHome ? teamData?.name : selectedGame.opponent;
  const awayName = selectedGame.isHome ? selectedGame.opponent : teamData?.name;

  return (
    <div className={`rounded-2xl overflow-hidden ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-purple-900/30 via-zinc-900 to-zinc-900 border border-purple-500/30' 
        : 'bg-gradient-to-br from-purple-50 via-white to-orange-50 border border-purple-200 shadow-xl'
    }`}>
      {/* Header - Clickable to collapse */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`w-full px-6 py-4 text-left ${
          gameState === 'live' 
            ? 'bg-gradient-to-r from-red-600 to-orange-600' 
            : gameState === 'completed'
              ? 'bg-gradient-to-r from-green-600 to-emerald-600'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600'
        }`}
      >
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
                {games.length} game{games.length !== 1 ? 's' : ''} scheduled
              </p>
            </div>
          </div>
          
          {/* Collapsed view: show current game score */}
          {isCollapsed && selectedGame && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
                <span className="text-white font-bold text-sm truncate max-w-[80px]">{homeName}</span>
                <div className="relative">
                  <span className="text-white font-bold text-lg">{localHomeScore}</span>
                  {homeScoreChange !== null && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-green-300 font-bold text-sm animate-bounce">
                      +{homeScoreChange}
                    </span>
                  )}
                </div>
                <span className="text-white/70">-</span>
                <div className="relative">
                  <span className="text-white font-bold text-lg">{localAwayScore}</span>
                  {awayScoreChange !== null && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-green-300 font-bold text-sm animate-bounce">
                      +{awayScoreChange}
                    </span>
                  )}
                </div>
                <span className="text-white font-bold text-sm truncate max-w-[80px]">{awayName}</span>
              </div>
              <ChevronDown className="w-5 h-5 text-white/70" />
            </div>
          )}
          
          {!isCollapsed && <ChevronUp className="w-5 h-5 text-white/70" />}
        </div>
      </button>

      {/* Main Content */}
      {!isCollapsed && (
        <div className="p-6">
          {/* Game Selector - Click to show list */}
          <div className="mb-6">
            <button
              onClick={() => setShowGameList(!showGameList)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition ${
                theme === 'dark' 
                  ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <List className={`w-5 h-5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
                <div className="text-left">
                  <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    vs {selectedGame.opponent}
                  </div>
                  <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {formatDate(selectedGame.scheduledDate)} • {formatTime(selectedGame.scheduledTime)}
                    {selectedGame.status === 'live' && <span className="ml-2 text-red-500 font-medium">● LIVE</span>}
                    {selectedGame.status === 'completed' && <span className="ml-2 text-green-500 font-medium">✓ Final</span>}
                  </div>
                </div>
              </div>
              {showGameList ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            
            {/* Game List Dropdown */}
            {showGameList && (
              <div className={`mt-2 rounded-xl border overflow-hidden ${
                theme === 'dark' ? 'bg-zinc-800 border-white/10' : 'bg-white border-slate-200 shadow-lg'
              }`}>
                {sortedGames.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => {
                      setSelectedGameId(game.id);
                      setShowGameList(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 border-b last:border-b-0 transition ${
                      game.id === selectedGame.id
                        ? theme === 'dark' ? 'bg-purple-600/20' : 'bg-purple-50'
                        : theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                    } ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}
                  >
                    <div className="flex items-center gap-3">
                      {game.status === 'live' && <Radio className="w-4 h-4 text-red-500 animate-pulse" />}
                      {game.status === 'completed' && <Trophy className="w-4 h-4 text-green-500" />}
                      {game.status !== 'live' && game.status !== 'completed' && <Calendar className="w-4 h-4 text-slate-400" />}
                      <div className="text-left">
                        <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                          vs {game.opponent}
                        </div>
                        <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          {formatDate(game.scheduledDate)} • {formatTime(game.scheduledTime)}
                        </div>
                      </div>
                    </div>
                    {(game.homeScore !== undefined || game.awayScore !== undefined) && (
                      <div className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {game.homeScore || 0} - {game.awayScore || 0}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Score Display */}
          <div className="flex items-center justify-center gap-4 md:gap-8 mb-6">
            {/* Home Team */}
            <div className="flex-1 text-center">
              {selectedGame.isHome && teamData?.logo && (
                <div className="flex justify-center mb-2">
                  <img src={teamData.logo} alt={teamData.name} className="w-12 h-12 md:w-16 md:h-16 object-contain rounded-lg" />
                </div>
              )}
              <div className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {homeName}
              </div>
              {/* Score */}
              <div className="relative inline-block">
                {editingScore === 'home' && canEditScores ? (
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="number"
                      value={editScoreValue}
                      onChange={(e) => setEditScoreValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleScoreSubmit('home');
                        if (e.key === 'Escape') setEditingScore(null);
                      }}
                      autoFocus
                      className={`w-20 text-4xl font-bold text-center rounded-lg ${
                        theme === 'dark' ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-900'
                      }`}
                    />
                    <button onClick={() => handleScoreSubmit('home')} className="p-2 bg-green-600 rounded-lg text-white">
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <span 
                    onClick={() => {
                      if (canEditScores) {
                        setEditingScore('home');
                        setEditScoreValue(String(localHomeScore));
                      }
                    }}
                    className={`text-5xl md:text-6xl font-bold ${
                      canEditScores ? 'cursor-pointer hover:opacity-80' : ''
                    } ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                  >
                    {localHomeScore}
                  </span>
                )}
                {homeScoreChange !== null && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-green-500 font-bold text-xl animate-bounce">
                    +{homeScoreChange}
                  </span>
                )}
              </div>
              {/* Score buttons */}
              {canEditScores && gameState === 'live' && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <button onClick={() => updateScore('home', -1)} className="w-8 h-8 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center font-bold hover:bg-red-500/30">
                    <Minus className="w-4 h-4" />
                  </button>
                  <button onClick={() => updateScore('home', 1)} className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center font-bold hover:bg-green-500/30">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => updateScore('home', 3)} className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm hover:bg-amber-500/30">
                    +3
                  </button>
                  <button onClick={() => updateScore('home', 7)} className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center font-bold text-sm hover:bg-purple-500/30">
                    +7
                  </button>
                </div>
              )}
            </div>

            {/* VS */}
            <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
              VS
            </div>

            {/* Away Team */}
            <div className="flex-1 text-center">
              {!selectedGame.isHome && teamData?.logo && (
                <div className="flex justify-center mb-2">
                  <img src={teamData.logo} alt={teamData.name} className="w-12 h-12 md:w-16 md:h-16 object-contain rounded-lg" />
                </div>
              )}
              <div className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {awayName}
              </div>
              {/* Score */}
              <div className="relative inline-block">
                {editingScore === 'away' && canEditScores ? (
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="number"
                      value={editScoreValue}
                      onChange={(e) => setEditScoreValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleScoreSubmit('away');
                        if (e.key === 'Escape') setEditingScore(null);
                      }}
                      autoFocus
                      className={`w-20 text-4xl font-bold text-center rounded-lg ${
                        theme === 'dark' ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-900'
                      }`}
                    />
                    <button onClick={() => handleScoreSubmit('away')} className="p-2 bg-green-600 rounded-lg text-white">
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <span 
                    onClick={() => {
                      if (canEditScores) {
                        setEditingScore('away');
                        setEditScoreValue(String(localAwayScore));
                      }
                    }}
                    className={`text-5xl md:text-6xl font-bold ${
                      canEditScores ? 'cursor-pointer hover:opacity-80' : ''
                    } ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                  >
                    {localAwayScore}
                  </span>
                )}
                {awayScoreChange !== null && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-green-500 font-bold text-xl animate-bounce">
                    +{awayScoreChange}
                  </span>
                )}
              </div>
              {/* Score buttons */}
              {canEditScores && gameState === 'live' && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <button onClick={() => updateScore('away', -1)} className="w-8 h-8 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center font-bold hover:bg-red-500/30">
                    <Minus className="w-4 h-4" />
                  </button>
                  <button onClick={() => updateScore('away', 1)} className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center font-bold hover:bg-green-500/30">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => updateScore('away', 3)} className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm hover:bg-amber-500/30">
                    +3
                  </button>
                  <button onClick={() => updateScore('away', 7)} className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center font-bold text-sm hover:bg-purple-500/30">
                    +7
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Game Details */}
          <div className={`flex items-center justify-center gap-6 mb-6 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDate(selectedGame.scheduledDate)}
            </div>
            {selectedGame.scheduledTime && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {formatTime(selectedGame.scheduledTime)}
              </div>
            )}
            {selectedGame.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {typeof selectedGame.location === 'object' 
                  ? ((selectedGame.location as any)?.name || 'TBD') 
                  : selectedGame.location}
              </div>
            )}
          </div>

          {/* Live Stream Section - Only during live game */}
          {gameState === 'live' && (hasLiveStream || isCoach) && (
            <div className={`rounded-xl overflow-hidden mb-6 ${theme === 'dark' ? 'bg-black/30' : 'bg-slate-100'}`}>
              {hasLiveStream ? (
                <div>
                  <div className={`flex items-center justify-between px-4 py-2 ${theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className={`font-medium text-sm ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>LIVE</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCoach && (
                        <button onClick={() => setShowEndStreamConfirm(true)} className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition">
                          <StopCircle className="w-3.5 h-3.5" />
                          End Stream
                        </button>
                      )}
                      <button onClick={() => setShowLiveStream(true)} className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white/20 hover:bg-white/30 text-red-600 transition">
                        <Tv className="w-3.5 h-3.5" />
                        Fullscreen
                      </button>
                    </div>
                  </div>
                  <div className="aspect-video bg-black">
                    <LiveStreamViewer streams={liveStreams} teamId={teamId} teamName={teamData?.name || 'Team'} onClose={() => {}} embedded={true} />
                  </div>
                </div>
              ) : isCoach && (
                <button onClick={onGoLive} className="w-full flex items-center justify-center gap-3 px-4 py-4 text-red-500 hover:bg-red-500/10 transition">
                  <Video className="w-6 h-6" />
                  <span className="font-medium">Start Live Stream</span>
                </button>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {/* Pre-game or Ready: Start Game */}
            {isCoach && (gameState === 'pregame' || gameState === 'ready') && (
              <button
                onClick={startGame}
                disabled={isUpdating || gameState === 'pregame'}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-white font-medium rounded-xl transition ${
                  gameState === 'pregame' 
                    ? 'bg-slate-500 cursor-not-allowed opacity-50' 
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'
                }`}
              >
                {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                {gameState === 'pregame' ? 'Waiting for Game Time' : 'Start Game'}
              </button>
            )}

            {/* Live: End Game */}
            {isCoach && gameState === 'live' && (
              <button
                onClick={endGame}
                disabled={isUpdating}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-medium rounded-xl transition"
              >
                {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                End Game
              </button>
            )}

            {/* Completed: Enter Stats */}
            {gameState === 'completed' && isCoach && (
              <button
                onClick={onOpenStats}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl transition"
              >
                <Target className="w-5 h-5" />
                Enter Game Stats
              </button>
            )}
          </div>

          {/* Status messages */}
          {gameState === 'pregame' && (
            <p className={`text-center text-sm mt-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              ⏰ Game starts at {formatTime(selectedGame.scheduledTime)}. Come back then to start live scoring!
            </p>
          )}
          {gameState === 'ready' && isCoach && (
            <p className={`text-center text-sm mt-4 ${theme === 'dark' ? 'text-amber-400/70' : 'text-amber-600'}`}>
              ⚡ Game time has passed. Click "Start Game" to begin live scoring!
            </p>
          )}
          {gameState === 'completed' && (
            <div className="mt-6 text-center">
              {localHomeScore > localAwayScore ? (
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                  selectedGame.isHome ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                }`}>
                  <Trophy className="w-5 h-5" />
                  <span className="font-bold">{selectedGame.isHome ? 'Victory!' : 'Defeat'}</span>
                </div>
              ) : localAwayScore > localHomeScore ? (
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                  !selectedGame.isHome ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                }`}>
                  <Trophy className="w-5 h-5" />
                  <span className="font-bold">{!selectedGame.isHome ? 'Victory!' : 'Defeat'}</span>
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
      )}

      {/* Fullscreen Live Stream Modal */}
      {showLiveStream && liveStreams.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black">
          <LiveStreamViewer streams={liveStreams} teamId={teamId} teamName={teamData?.name || 'Team'} onClose={() => setShowLiveStream(false)} />
        </div>
      )}

      {/* End Stream Confirmation */}
      {showEndStreamConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl p-6 max-w-md w-full border ${theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-200'}`}>
            <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>End Live Stream?</h3>
            <p className={`mb-6 ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>This will end the live stream for all viewers.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowEndStreamConfirm(false)} className={`flex-1 px-4 py-3 rounded-lg border font-medium transition-colors ${theme === 'dark' ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                Cancel
              </button>
              <button onClick={handleEndAllStreams} disabled={endingStream} className="flex-1 px-4 py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {endingStream ? <><Loader2 className="w-5 h-5 animate-spin" />Ending...</> : <><StopCircle className="w-5 h-5" />End Stream</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameDayHub;
