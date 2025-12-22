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
 * 
 * System Team Integration:
 * - If opponent is a system team (opponentTeamId exists), fetch their data
 * - Show opponent's logo, record, and link to their public team page
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, serverTimestamp, getDoc, increment, collection, query, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { toastSuccess, toastError } from '../services/toast';
import { LiveStreamViewer } from './livestream';
import type { LiveStream, TeamGame, Team } from '../types';
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
  Radio,
  ExternalLink
} from 'lucide-react';

// Opponent team data cache type
interface OpponentTeamData {
  id: string;
  name: string;
  logo?: string;
  primaryColor?: string;
  record?: { wins: number; losses: number; ties: number };
}

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
  
  // Opponent team data cache - fetch system team data
  const [opponentTeamCache, setOpponentTeamCache] = useState<Record<string, OpponentTeamData>>({});
  const [loadingOpponent, setLoadingOpponent] = useState(false);
  
  // Score editing state
  const [localHomeScore, setLocalHomeScore] = useState(0);
  const [localAwayScore, setLocalAwayScore] = useState(0);
  const [editingScore, setEditingScore] = useState<'home' | 'away' | null>(null);
  const [editScoreValue, setEditScoreValue] = useState('');
  const [homeScoreChange, setHomeScoreChange] = useState<number | null>(null);
  const [awayScoreChange, setAwayScoreChange] = useState<number | null>(null);
  
  // Countdown timer state
  const [countdown, setCountdown] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [, forceUpdate] = useState(0); // Force re-render when countdown hits 0
  
  // Quarter scoring state
  const [currentQuarter, setCurrentQuarter] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [quarterScores, setQuarterScores] = useState({
    homeQ1: 0, homeQ2: 0, homeQ3: 0, homeQ4: 0, homeOT: 0,
    awayQ1: 0, awayQ2: 0, awayQ3: 0, awayQ4: 0, awayOT: 0,
  });
  
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
  
  // REAL-TIME SYNC: Always keep local state in sync with Firestore data
  // This ensures ALL users (coaches, refs, scorekeepers) see the same live data
  // We track what we're currently writing to avoid overwriting our own pending update
  const pendingUpdate = useRef<{ home?: number; away?: number } | null>(null);
  const lastSyncedGameId = useRef<string | null>(null);
  
  useEffect(() => {
    if (!selectedGame) return;
    
    // Always sync from Firestore - this is the source of truth
    const firestoreHome = selectedGame.homeScore || 0;
    const firestoreAway = selectedGame.awayScore || 0;
    
    // Only skip sync if we have a pending write that matches
    // (prevents flickering when our own update comes back from Firestore)
    const skipHomeSync = pendingUpdate.current?.home === firestoreHome;
    const skipAwaySync = pendingUpdate.current?.away === firestoreAway;
    
    if (!skipHomeSync) {
      setLocalHomeScore(firestoreHome);
    }
    if (!skipAwaySync) {
      setLocalAwayScore(firestoreAway);
    }
    
    // Clear pending update once Firestore catches up
    if (skipHomeSync || skipAwaySync) {
      pendingUpdate.current = null;
    }
    
    // Sync quarter data
    setCurrentQuarter((selectedGame as any).currentQuarter || 1);
    setQuarterScores({
      homeQ1: (selectedGame as any).homeQ1 || 0,
      homeQ2: (selectedGame as any).homeQ2 || 0,
      homeQ3: (selectedGame as any).homeQ3 || 0,
      homeQ4: (selectedGame as any).homeQ4 || 0,
      homeOT: (selectedGame as any).homeOT || 0,
      awayQ1: (selectedGame as any).awayQ1 || 0,
      awayQ2: (selectedGame as any).awayQ2 || 0,
      awayQ3: (selectedGame as any).awayQ3 || 0,
      awayQ4: (selectedGame as any).awayQ4 || 0,
      awayOT: (selectedGame as any).awayOT || 0,
    });
    
    // Log when switching games
    if (selectedGame.id !== lastSyncedGameId.current) {
      console.log('[GameDayHub] Switched to game:', selectedGame.id, 'scores:', firestoreHome, firestoreAway);
      lastSyncedGameId.current = selectedGame.id;
    }
  }, [selectedGame?.id, selectedGame?.homeScore, selectedGame?.awayScore, (selectedGame as any)?.currentQuarter, (selectedGame as any)?.homeQ1, (selectedGame as any)?.homeQ2, (selectedGame as any)?.homeQ3, (selectedGame as any)?.homeQ4, (selectedGame as any)?.homeOT, (selectedGame as any)?.awayQ1, (selectedGame as any)?.awayQ2, (selectedGame as any)?.awayQ3, (selectedGame as any)?.awayQ4, (selectedGame as any)?.awayOT]);
  
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
  
  // Fetch opponent team data when game changes
  useEffect(() => {
    const fetchOpponentTeam = async () => {
      if (!selectedGame?.opponentTeamId) return;
      if (selectedGame.opponentTeamId === 'external') return;
      
      // Always fetch fresh data (don't rely on cache) to ensure accurate records
      setLoadingOpponent(true);
      try {
        console.log('[GameDayHub] Fetching opponent team data:', selectedGame.opponentTeamId);
        const teamDoc = await getDoc(doc(db, 'teams', selectedGame.opponentTeamId));
        if (teamDoc.exists()) {
          const team = teamDoc.data() as Team;
          const opponentId = selectedGame.opponentTeamId;
          let calculatedRecord = { wins: 0, losses: 0, ties: 0 };
          
          // Query ALL games from the program schedule to get opponent's FULL record
          // The `games` prop only contains OUR team's games, so we need to query fresh
          const programId = teamData?.programId || selectedGame.programId;
          const seasonId = selectedGame.seasonId;
          
          console.log('[GameDayHub] Program/Season for opponent lookup:', programId, seasonId);
          
          if (programId && seasonId) {
            try {
              // Collection path: programs/{programId}/seasons/{seasonId}/games (NOT 'schedule')
              const allGamesQuery = query(collection(db, 'programs', programId, 'seasons', seasonId, 'games'));
              const allGamesSnapshot = await getDocs(allGamesQuery);
              
              console.log('[GameDayHub] Found', allGamesSnapshot.docs.length, 'total games in season');
              
              allGamesSnapshot.docs.forEach(gameDoc => {
                const gameData = gameDoc.data();
                if (gameData.status !== 'completed') return;
                
                // Check if this game involves the opponent
                const opponentIsHome = gameData.homeTeamId === opponentId;
                const opponentIsAway = gameData.awayTeamId === opponentId;
                
                if (!opponentIsHome && !opponentIsAway) return; // Not their game
                
                const oppScore = opponentIsHome ? (gameData.homeScore ?? 0) : (gameData.awayScore ?? 0);
                const enemyScore = opponentIsHome ? (gameData.awayScore ?? 0) : (gameData.homeScore ?? 0);
                
                if (oppScore > enemyScore) calculatedRecord.wins++;
                else if (oppScore < enemyScore) calculatedRecord.losses++;
                else calculatedRecord.ties++;
              });
              
              console.log('[GameDayHub] Calculated opponent FULL record:', opponentId, '=', calculatedRecord);
            } catch (scheduleError) {
              console.warn('[GameDayHub] Could not fetch program schedule:', scheduleError);
              // Fallback to team.record if schedule query fails
              calculatedRecord = team.record || { wins: 0, losses: 0, ties: 0 };
            }
          } else {
            console.warn('[GameDayHub] No program/season info, using team.record fallback');
            // Fallback to team.record if no program/season info
            calculatedRecord = team.record || { wins: 0, losses: 0, ties: 0 };
          }
          
          const opponentData: OpponentTeamData = {
            id: teamDoc.id,
            name: team.name,
            logo: team.logo,
            primaryColor: team.primaryColor || team.color,
            record: calculatedRecord
          };
          setOpponentTeamCache(prev => ({
            ...prev,
            [selectedGame.opponentTeamId!]: opponentData
          }));
          console.log('[GameDayHub] Opponent team data loaded:', opponentData.name, 'Record:', calculatedRecord);
        } else {
          console.warn('[GameDayHub] Opponent team document not found:', selectedGame.opponentTeamId);
        }
      } catch (error) {
        console.error('[GameDayHub] Error fetching opponent team:', error);
      } finally {
        setLoadingOpponent(false);
      }
    };
    
    fetchOpponentTeam();
  }, [selectedGame?.opponentTeamId, selectedGame?.seasonId, teamData?.programId]);
  
  // Get opponent team data for current game
  const opponentTeam = useMemo(() => {
    console.log('[GameDayHub] opponentTeam lookup:', {
      opponentTeamId: selectedGame?.opponentTeamId,
      cacheKeys: Object.keys(opponentTeamCache),
      cachedData: selectedGame?.opponentTeamId ? opponentTeamCache[selectedGame.opponentTeamId] : null
    });
    if (!selectedGame?.opponentTeamId) return null;
    if (selectedGame.opponentTeamId === 'external') return null;
    return opponentTeamCache[selectedGame.opponentTeamId] || null;
  }, [selectedGame?.opponentTeamId, opponentTeamCache]);
  
  // Calculate our team's record from completed games (matches dashboard's getTeamRecord logic exactly)
  const ourTeamRecord = useMemo(() => {
    const completedGames = games.filter(g => g.status === 'completed');
    let wins = 0, losses = 0, ties = 0;
    
    completedGames.forEach(game => {
      // Determine if we're home - check multiple fields for robustness
      // Some games use homeTeamId, others use teamId + isHome flag
      let isHome = false;
      
      if (game.homeTeamId && teamData?.id) {
        isHome = game.homeTeamId === teamData.id;
      } else if (game.awayTeamId && teamData?.id) {
        isHome = game.awayTeamId !== teamData.id;
      } else {
        // Fallback to isHome flag on the game object
        isHome = game.isHome ?? false;
      }
      
      const teamScore = isHome ? (game.homeScore ?? 0) : (game.awayScore ?? 0);
      const oppScore = isHome ? (game.awayScore ?? 0) : (game.homeScore ?? 0);
      
      if (teamScore > oppScore) wins++;
      else if (teamScore < oppScore) losses++;
      else ties++;
    });
    
    return { wins, losses, ties };
  }, [games, teamData?.id]);
  
  // Navigate to team page (uses navigate from top of component)
  const handleTeamClick = (teamId: string) => {
    navigate(`/team/${teamId}`);
  };
  
  // Display values: Coaches use local state (for optimistic updates), others use real-time Firestore values
  const displayHomeScore = isCoach ? localHomeScore : (selectedGame?.homeScore || 0);
  const displayAwayScore = isCoach ? localAwayScore : (selectedGame?.awayScore || 0);
  const displayQuarter = isCoach ? currentQuarter : ((selectedGame as any)?.currentQuarter || 1);
  const displayQuarterScores = isCoach ? quarterScores : {
    homeQ1: (selectedGame as any)?.homeQ1 || 0,
    homeQ2: (selectedGame as any)?.homeQ2 || 0,
    homeQ3: (selectedGame as any)?.homeQ3 || 0,
    homeQ4: (selectedGame as any)?.homeQ4 || 0,
    homeOT: (selectedGame as any)?.homeOT || 0,
    awayQ1: (selectedGame as any)?.awayQ1 || 0,
    awayQ2: (selectedGame as any)?.awayQ2 || 0,
    awayQ3: (selectedGame as any)?.awayQ3 || 0,
    awayQ4: (selectedGame as any)?.awayQ4 || 0,
    awayOT: (selectedGame as any)?.awayOT || 0,
  };
  
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
  
  // Countdown timer - updates every second when in pregame state
  useEffect(() => {
    if (!selectedGame || gameState !== 'pregame') {
      setCountdown(null);
      return;
    }
    
    const gameTime = selectedGame.scheduledTime || '00:00';
    const [hours, minutes] = gameTime.split(':').map(Number);
    const gameDate = parseGameDate(selectedGame.scheduledDate);
    gameDate.setHours(hours || 0, minutes || 0, 0, 0);
    
    const updateCountdown = () => {
      const now = new Date();
      const diff = gameDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        setCountdown(null);
        // Force re-render to switch to 'ready' state
        forceUpdate(prev => prev + 1);
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
  }, [selectedGame, gameState]);
  
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
  
  // Update score in Firebase using ATOMIC INCREMENT
  // This prevents race conditions when multiple coaches edit simultaneously
  const [isUpdatingScore, setIsUpdatingScore] = useState(false);
  
  const updateScore = async (team: 'home' | 'away', delta: number) => {
    if (!selectedGame?.id || !canEditScores || isUpdatingScore) {
      console.log('[GameDayHub] updateScore blocked', { 
        gameId: selectedGame?.id, 
        canEditScores, 
        isUpdatingScore 
      });
      return;
    }
    
    // Prevent negative scores - check BOTH total score AND quarter score
    const currentScore = team === 'home' ? localHomeScore : localAwayScore;
    const quarterKey = currentQuarter === 5 ? 'OT' : `Q${currentQuarter}`;
    const quarterField = `${team}${quarterKey}` as keyof typeof quarterScores;
    const currentQuarterScore = quarterScores[quarterField] || 0;
    
    // Block if total score would go negative
    if (currentScore + delta < 0) {
      console.log('[GameDayHub] updateScore blocked - total score would go negative');
      return;
    }
    
    // Block if quarter score would go negative (important for minus button!)
    if (currentQuarterScore + delta < 0) {
      console.log('[GameDayHub] updateScore blocked - quarter score would go negative');
      return;
    }
    
    setIsUpdatingScore(true);
    console.log('[GameDayHub] updateScore called:', { team, delta, currentQuarter, currentScore, currentQuarterScore });
    
    // Calculate expected new scores for pending update tracking
    const expectedNewScore = currentScore + delta;
    const expectedQuarterScore = currentQuarterScore + delta;
    
    // OPTIMISTIC UPDATE: Show the change immediately to the user who clicked
    // Also track pending update so we don't double-update when Firestore echoes back
    if (team === 'home') {
      setLocalHomeScore(expectedNewScore); // Show new score immediately!
      setHomeScoreChange(delta);
      pendingUpdate.current = { ...pendingUpdate.current, home: expectedNewScore };
    } else {
      setLocalAwayScore(expectedNewScore); // Show new score immediately!
      setAwayScoreChange(delta);
      pendingUpdate.current = { ...pendingUpdate.current, away: expectedNewScore };
    }
    
    // Update quarter score optimistically too
    setQuarterScores(prev => ({
      ...prev,
      [quarterField]: expectedQuarterScore
    }));
    
    setTimeout(() => {
      setHomeScoreChange(null);
      setAwayScoreChange(null);
    }, 2000);
    
    try {
      // SINGLE SOURCE: Update program season game with ATOMIC INCREMENT
      if (!selectedGame.programId || !selectedGame.seasonId) {
        throw new Error('Game missing programId or seasonId');
      }
      
      // Use Firestore increment() for atomic updates - no race conditions!
      const scoreField = team === 'home' ? 'homeScore' : 'awayScore';
      
      console.log('[GameDayHub] Writing ATOMIC INCREMENT to Firestore:', {
        path: `programs/${selectedGame.programId}/seasons/${selectedGame.seasonId}/games/${selectedGame.id}`,
        [scoreField]: `increment(${delta})`,
        [quarterField]: `increment(${delta})`,
        currentQuarter
      });
      
      await updateDoc(
        doc(db, 'programs', selectedGame.programId, 'seasons', selectedGame.seasonId, 'games', selectedGame.id), 
        {
          [scoreField]: increment(delta),
          [quarterField]: increment(delta),
          currentQuarter,
          updatedAt: serverTimestamp()
        }
      );
      console.log('[GameDayHub] Firestore atomic increment SUCCESS');
    } catch (err) {
      console.error('[GameDayHub] Firestore write ERROR:', err);
      // Clear pending update on error - will resync from Firestore
      pendingUpdate.current = null;
      toastError('Failed to update score');
    } finally {
      setIsUpdatingScore(false);
    }
  };
  
  // Change quarter
  const changeQuarter = async (quarter: 1 | 2 | 3 | 4 | 5) => {
    if (!selectedGame?.id || !selectedGame?.programId || !selectedGame?.seasonId) {
      console.log('[GameDayHub] changeQuarter blocked - missing IDs');
      return;
    }
    
    console.log('[GameDayHub] changeQuarter called:', quarter);
    setCurrentQuarter(quarter);
    
    try {
      await updateDoc(
        doc(db, 'programs', selectedGame.programId, 'seasons', selectedGame.seasonId, 'games', selectedGame.id),
        {
          currentQuarter: quarter,
          updatedAt: serverTimestamp()
        }
      );
    } catch (err) {
      console.error('Error changing quarter:', err);
      setCurrentQuarter((selectedGame as any).currentQuarter || 1);
      toastError('Failed to change quarter');
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
  
  // Sort games: live first, then by date/time (newest first, week 1 at bottom)
  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => {
      // Live games first
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (b.status === 'live' && a.status !== 'live') return 1;
      
      // Then by date (descending - newest/current week on top, week 1 at bottom)
      const aDate = parseGameDate(a.scheduledDate);
      const bDate = parseGameDate(b.scheduledDate);
      return bDate.getTime() - aDate.getTime();
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
                  <span className="text-white font-bold text-lg">{displayHomeScore}</span>
                  {homeScoreChange !== null && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-green-300 font-bold text-sm animate-bounce">
                      +{homeScoreChange}
                    </span>
                  )}
                </div>
                <span className="text-white/70">-</span>
                <div className="relative">
                  <span className="text-white font-bold text-lg">{displayAwayScore}</span>
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

          {/* Quarter Selector - Only during live game for coaches */}
          {isCoach && gameState === 'live' && (
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Current Period:
                </span>
                <div className="flex gap-1">
                  {([1, 2, 3, 4] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => changeQuarter(q)}
                      className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${
                        currentQuarter === q
                          ? 'bg-purple-600 text-white shadow-lg scale-110'
                          : theme === 'dark'
                            ? 'bg-white/10 text-slate-300 hover:bg-white/20'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      Q{q}
                    </button>
                  ))}
                  <button
                    onClick={() => changeQuarter(5)}
                    className={`px-3 h-10 rounded-lg font-bold text-sm transition-all ${
                      currentQuarter === 5
                        ? 'bg-amber-500 text-white shadow-lg scale-110'
                        : theme === 'dark'
                          ? 'bg-white/10 text-slate-300 hover:bg-white/20'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    OT
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Score Display */}
          <div className="flex items-center justify-center gap-4 md:gap-8 mb-6">
            {/* Home Team */}
            <div className="flex-1 text-center">
              {/* Logo: Show our team logo if we're home, OR opponent logo if opponent is home */}
              {selectedGame.isHome ? (
                teamData?.logo && (
                  <div className="flex justify-center mb-2">
                    <img src={teamData.logo} alt={teamData.name} className="w-12 h-12 md:w-16 md:h-16 object-contain rounded-lg" />
                  </div>
                )
              ) : (
                opponentTeam?.logo ? (
                  <div 
                    className="flex justify-center mb-2 cursor-pointer group"
                    onClick={() => opponentTeam && handleTeamClick(opponentTeam.id)}
                  >
                    <img 
                      src={opponentTeam.logo} 
                      alt={opponentTeam.name} 
                      className="w-12 h-12 md:w-16 md:h-16 object-contain rounded-lg group-hover:scale-105 transition-transform"
                    />
                  </div>
                ) : loadingOpponent && (
                  <div className="flex justify-center mb-2">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-white/10 animate-pulse" />
                  </div>
                )
              )}
              {/* Team Name + Record */}
              <div className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {!selectedGame.isHome && opponentTeam ? (
                  <span 
                    onClick={() => handleTeamClick(opponentTeam.id)}
                    className="hover:text-purple-400 hover:underline transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    {homeName}
                    <ExternalLink className="w-3 h-3 opacity-50 inline" />
                  </span>
                ) : (
                  homeName
                )}
              </div>
              {/* Record display */}
              {/* If we're home (left side shows our team) - show our record */}
              {selectedGame.isHome && (ourTeamRecord.wins > 0 || ourTeamRecord.losses > 0 || ourTeamRecord.ties > 0) && (
                <div className={`text-xs mb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                  ({ourTeamRecord.wins}-{ourTeamRecord.losses}{ourTeamRecord.ties ? `-${ourTeamRecord.ties}` : ''})
                </div>
              )}
              {/* If we're away (left side shows opponent) - show opponent record */}
              {!selectedGame.isHome && opponentTeam?.record && (
                <div className={`text-xs mb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                  ({opponentTeam.record.wins}-{opponentTeam.record.losses}{opponentTeam.record.ties ? `-${opponentTeam.record.ties}` : ''})
                </div>
              )}
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
                        setEditScoreValue(String(displayHomeScore));
                      }
                    }}
                    className={`text-5xl md:text-6xl font-bold ${
                      canEditScores ? 'cursor-pointer hover:opacity-80' : ''
                    } ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                  >
                    {displayHomeScore}
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
                <div className={`flex items-center justify-center gap-2 mt-3 ${isUpdatingScore ? 'opacity-50 pointer-events-none' : ''}`}>
                  <button onClick={() => updateScore('home', -1)} disabled={isUpdatingScore} className="w-8 h-8 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center font-bold hover:bg-red-500/30 disabled:cursor-not-allowed">
                    <Minus className="w-4 h-4" />
                  </button>
                  <button onClick={() => updateScore('home', 1)} disabled={isUpdatingScore} className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center font-bold hover:bg-green-500/30 disabled:cursor-not-allowed">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => updateScore('home', 3)} disabled={isUpdatingScore} className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm hover:bg-amber-500/30 disabled:cursor-not-allowed">
                    +3
                  </button>
                  <button onClick={() => updateScore('home', 7)} disabled={isUpdatingScore} className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center font-bold text-sm hover:bg-purple-500/30 disabled:cursor-not-allowed">
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
              {/* Logo: Show our team logo if we're away, OR opponent logo if opponent is away */}
              {!selectedGame.isHome ? (
                teamData?.logo && (
                  <div className="flex justify-center mb-2">
                    <img src={teamData.logo} alt={teamData.name} className="w-12 h-12 md:w-16 md:h-16 object-contain rounded-lg" />
                  </div>
                )
              ) : (
                opponentTeam?.logo ? (
                  <div 
                    className="flex justify-center mb-2 cursor-pointer group"
                    onClick={() => opponentTeam && handleTeamClick(opponentTeam.id)}
                  >
                    <img 
                      src={opponentTeam.logo} 
                      alt={opponentTeam.name} 
                      className="w-12 h-12 md:w-16 md:h-16 object-contain rounded-lg group-hover:scale-105 transition-transform"
                    />
                  </div>
                ) : loadingOpponent && (
                  <div className="flex justify-center mb-2">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-white/10 animate-pulse" />
                  </div>
                )
              )}
              {/* Team Name + Record */}
              <div className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {selectedGame.isHome && opponentTeam ? (
                  <span 
                    onClick={() => handleTeamClick(opponentTeam.id)}
                    className="hover:text-purple-400 hover:underline transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    {awayName}
                    <ExternalLink className="w-3 h-3 opacity-50 inline" />
                  </span>
                ) : (
                  awayName
                )}
              </div>
              {/* Record display */}
              {/* If we're home (right side shows opponent) - show opponent record */}
              {selectedGame.isHome && opponentTeam?.record && (
                <div className={`text-xs mb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                  ({opponentTeam.record.wins}-{opponentTeam.record.losses}{opponentTeam.record.ties ? `-${opponentTeam.record.ties}` : ''})
                </div>
              )}
              {/* If we're away (right side shows our team) - show our record */}
              {!selectedGame.isHome && (ourTeamRecord.wins > 0 || ourTeamRecord.losses > 0 || ourTeamRecord.ties > 0) && (
                <div className={`text-xs mb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                  ({ourTeamRecord.wins}-{ourTeamRecord.losses}{ourTeamRecord.ties ? `-${ourTeamRecord.ties}` : ''})
                </div>
              )}
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
                        setEditScoreValue(String(displayAwayScore));
                      }
                    }}
                    className={`text-5xl md:text-6xl font-bold ${
                      canEditScores ? 'cursor-pointer hover:opacity-80' : ''
                    } ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                  >
                    {displayAwayScore}
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
                <div className={`flex items-center justify-center gap-2 mt-3 ${isUpdatingScore ? 'opacity-50 pointer-events-none' : ''}`}>
                  <button onClick={() => updateScore('away', -1)} disabled={isUpdatingScore} className="w-8 h-8 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center font-bold hover:bg-red-500/30 disabled:cursor-not-allowed">
                    <Minus className="w-4 h-4" />
                  </button>
                  <button onClick={() => updateScore('away', 1)} disabled={isUpdatingScore} className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center font-bold hover:bg-green-500/30 disabled:cursor-not-allowed">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => updateScore('away', 3)} disabled={isUpdatingScore} className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm hover:bg-amber-500/30 disabled:cursor-not-allowed">
                    +3
                  </button>
                  <button onClick={() => updateScore('away', 7)} disabled={isUpdatingScore} className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center font-bold text-sm hover:bg-purple-500/30 disabled:cursor-not-allowed">
                    +7
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quarter-by-Quarter Box Score */}
          {(gameState === 'live' || gameState === 'completed') && (
            <div className={`mb-6 rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
                    <th className="text-left p-2 font-medium w-1/3">Team</th>
                    <th className="w-10 text-center p-2 font-medium">1</th>
                    <th className="w-10 text-center p-2 font-medium">2</th>
                    <th className="w-10 text-center p-2 font-medium">3</th>
                    <th className="w-10 text-center p-2 font-medium">4</th>
                    {(displayQuarterScores.homeOT > 0 || displayQuarterScores.awayOT > 0) && (
                      <th className="w-10 text-center p-2 font-medium">OT</th>
                    )}
                    <th className="w-12 text-center p-2 font-bold">T</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={`${theme === 'dark' ? 'text-white' : 'text-zinc-900'} ${
                    displayHomeScore > displayAwayScore ? (theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-100') : ''
                  }`}>
                    <td className="p-2 font-semibold truncate">
                      {selectedGame.isHome ? teamData?.name : selectedGame.opponent}
                    </td>
                    <td className={`text-center p-2 ${displayQuarter === 1 ? 'text-purple-500 font-bold' : ''}`}>
                      {displayQuarterScores.homeQ1 || '-'}
                    </td>
                    <td className={`text-center p-2 ${displayQuarter === 2 ? 'text-purple-500 font-bold' : ''}`}>
                      {displayQuarterScores.homeQ2 || '-'}
                    </td>
                    <td className={`text-center p-2 ${displayQuarter === 3 ? 'text-purple-500 font-bold' : ''}`}>
                      {displayQuarterScores.homeQ3 || '-'}
                    </td>
                    <td className={`text-center p-2 ${displayQuarter === 4 ? 'text-purple-500 font-bold' : ''}`}>
                      {displayQuarterScores.homeQ4 || '-'}
                    </td>
                    {(displayQuarterScores.homeOT > 0 || displayQuarterScores.awayOT > 0) && (
                      <td className={`text-center p-2 ${displayQuarter === 5 ? 'text-amber-500 font-bold' : ''}`}>
                        {displayQuarterScores.homeOT || '-'}
                      </td>
                    )}
                    <td className={`text-center p-2 font-bold text-lg ${displayHomeScore > displayAwayScore ? 'text-emerald-500' : ''}`}>
                      {displayHomeScore}
                    </td>
                  </tr>
                  <tr className={`${theme === 'dark' ? 'text-white' : 'text-zinc-900'} ${
                    displayAwayScore > displayHomeScore ? (theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-100') : ''
                  }`}>
                    <td className="p-2 font-semibold truncate">
                      {selectedGame.isHome ? selectedGame.opponent : teamData?.name}
                    </td>
                    <td className={`text-center p-2 ${displayQuarter === 1 ? 'text-purple-500 font-bold' : ''}`}>
                      {displayQuarterScores.awayQ1 || '-'}
                    </td>
                    <td className={`text-center p-2 ${displayQuarter === 2 ? 'text-purple-500 font-bold' : ''}`}>
                      {displayQuarterScores.awayQ2 || '-'}
                    </td>
                    <td className={`text-center p-2 ${displayQuarter === 3 ? 'text-purple-500 font-bold' : ''}`}>
                      {displayQuarterScores.awayQ3 || '-'}
                    </td>
                    <td className={`text-center p-2 ${displayQuarter === 4 ? 'text-purple-500 font-bold' : ''}`}>
                      {displayQuarterScores.awayQ4 || '-'}
                    </td>
                    {(displayQuarterScores.homeOT > 0 || displayQuarterScores.awayOT > 0) && (
                      <td className={`text-center p-2 ${displayQuarter === 5 ? 'text-amber-500 font-bold' : ''}`}>
                        {displayQuarterScores.awayOT || '-'}
                      </td>
                    )}
                    <td className={`text-center p-2 font-bold text-lg ${displayAwayScore > displayHomeScore ? 'text-emerald-500' : ''}`}>
                      {displayAwayScore}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

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
                {gameState === 'pregame' ? (
                  countdown ? (
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Starts in {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
                    </span>
                  ) : 'Waiting for Game Time'
                ) : 'Start Game'}
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
            <div className={`text-center mt-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              {countdown ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm text-slate-400">⏰ Game starts at {formatTime(selectedGame.scheduledTime)}</p>
                  <div className="flex items-center gap-2 justify-center">
                    <div className={`flex flex-col items-center px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'}`}>
                      <span className="text-2xl font-bold font-mono text-purple-400">{String(countdown.hours).padStart(2, '0')}</span>
                      <span className="text-xs text-slate-400">HRS</span>
                    </div>
                    <span className="text-2xl font-bold text-purple-400">:</span>
                    <div className={`flex flex-col items-center px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'}`}>
                      <span className="text-2xl font-bold font-mono text-purple-400">{String(countdown.minutes).padStart(2, '0')}</span>
                      <span className="text-xs text-slate-400">MIN</span>
                    </div>
                    <span className="text-2xl font-bold text-purple-400">:</span>
                    <div className={`flex flex-col items-center px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'}`}>
                      <span className="text-2xl font-bold font-mono text-purple-400">{String(countdown.seconds).padStart(2, '0')}</span>
                      <span className="text-xs text-slate-400">SEC</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">⏰ Game starts at {formatTime(selectedGame.scheduledTime)}. Come back then to start live scoring!</p>
              )}
            </div>
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
