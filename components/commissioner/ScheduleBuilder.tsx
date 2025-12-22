/**
 * Schedule Builder Component
 * Robust week-by-week schedule builder for Team Commissioners
 * Allows setting up all games for all teams across the entire season
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { db } from '../../services/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  writeBatch,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { 
  ChevronLeft, 
  ChevronRight,
  Calendar, 
  Plus, 
  Clock, 
  MapPin, 
  Loader2, 
  Edit2, 
  Trash2, 
  X, 
  Save,
  Check,
  AlertCircle,
  Coffee,
  Lock
} from 'lucide-react';
import { toastSuccess, toastError, toastInfo } from '../../services/toast';
import type { Team, ProgramSeason } from '../../types';

interface Game {
  id?: string;
  week: number;
  weekDate: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  time: string;
  location: string;
  ageGroup: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  statsEntered?: boolean; // For tracking finalized games
  isNew?: boolean; // For tracking unsaved games
}

// Check if a game is locked (past start time or finalized)
const isGameLocked = (game: Game): boolean => {
  // Game is finalized (completed with stats entered)
  if (game.status === 'completed' && game.statsEntered) {
    return true;
  }
  
  // Parse date as local time (avoids UTC timezone shift)
  const parseLocalDateForLock = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  
  // Game start time has passed
  if (game.weekDate && game.time) {
    const [hours, minutes] = game.time.split(':').map(Number);
    const gameDateTime = parseLocalDateForLock(game.weekDate);
    gameDateTime.setHours(hours || 0, minutes || 0, 0, 0);
    if (gameDateTime <= new Date()) {
      return true;
    }
  } else if (game.weekDate) {
    // No time set, check if date has passed
    const gameDate = parseLocalDateForLock(game.weekDate);
    gameDate.setHours(23, 59, 59, 999); // End of day
    if (gameDate < new Date()) {
      return true;
    }
  }
  
  return false;
};

// Format 24-hour time string to 12-hour format (respects user's locale/timezone)
const formatTime12Hour = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return time24;
  const period = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 || 12;
  // Only show minutes if not :00
  if (minutes === 0) {
    return `${hour12}${period}`;
  }
  return `${hour12}:${String(minutes).padStart(2, '0')}${period}`;
};

interface ByeWeek {
  id?: string;
  week: number;
  weekDate: string;
  teamId: string;
  teamName: string;
  ageGroup: string;
  isNew?: boolean;
}

interface TeamScheduleStatus {
  teamId: string;
  teamName: string;
  ageGroup: string;
  hasGame: boolean;
  hasBye: boolean;
  game?: Game;
  bye?: ByeWeek;
  matchedFrom?: string; // If matched from opponent's game entry
}

interface ScheduleSetup {
  numberOfWeeks: number;
  startDate: string;
}

export default function ScheduleBuilder() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { userData, programData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Setup state
  const [showSetup, setShowSetup] = useState(true);
  const [setup, setSetup] = useState<ScheduleSetup>({ numberOfWeeks: 8, startDate: '' });
  
  // Data state
  const [season, setSeason] = useState<ProgramSeason | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [byes, setByes] = useState<ByeWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // UI state
  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('all');
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [deleteWeekModal, setDeleteWeekModal] = useState<number | null>(null); // Week number to delete
  const [showLeaveModal, setShowLeaveModal] = useState(false); // Unsaved changes confirmation

  // Warn on browser back/refresh if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved schedule changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Form state for adding game
  const [gameForm, setGameForm] = useState({
    opponentId: '',
    opponentName: '', // For typing custom opponent or selecting from list
    time: '10:00',
    location: '',
    isHome: true,
    isByeMode: false, // Toggle between game input and bye mode
    gameDate: '' // Custom date for this game (defaults to week date)
  });

  // Helper to parse YYYY-MM-DD as local date (avoids UTC timezone shift)
  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Get unique age groups from teams
  const ageGroups = useMemo(() => {
    return [...new Set(teams.map(t => t.ageGroup).filter(Boolean))] as string[];
  }, [teams]);

  // Filter teams by selected age group
  const filteredTeams = useMemo(() => {
    if (selectedAgeGroup === 'all') return teams;
    return teams.filter(t => t.ageGroup === selectedAgeGroup);
  }, [teams, selectedAgeGroup]);

  // Calculate week dates based on start date
  const weekDates = useMemo(() => {
    if (!setup.startDate) return [];
    const dates: string[] = [];
    // Parse date as local time (not UTC) by splitting the string
    const [year, month, day] = setup.startDate.split('-').map(Number);
    const start = new Date(year, month - 1, day); // month is 0-indexed
    for (let i = 0; i < setup.numberOfWeeks; i++) {
      const weekDate = new Date(start);
      weekDate.setDate(start.getDate() + (i * 7));
      // Format as YYYY-MM-DD without timezone shift
      const y = weekDate.getFullYear();
      const m = String(weekDate.getMonth() + 1).padStart(2, '0');
      const d = String(weekDate.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
    }
    return dates;
  }, [setup.startDate, setup.numberOfWeeks]);

  // Get team schedule status for current week
  const getTeamScheduleStatus = useMemo((): TeamScheduleStatus[] => {
    return filteredTeams.map(team => {
      // Check if team has a game this week (as home or away)
      const homeGame = games.find(g => g.week === currentWeek && g.homeTeamId === team.id);
      const awayGame = games.find(g => g.week === currentWeek && g.awayTeamId === team.id);
      const bye = byes.find(b => b.week === currentWeek && b.teamId === team.id);
      
      const game = homeGame || awayGame;
      // matchedFrom is only set if this team is away AND the home team is a real system team
      const matchedFrom = awayGame && !homeGame && awayGame.homeTeamId !== 'external' 
        ? awayGame.homeTeamName 
        : undefined;
      
      return {
        teamId: team.id,
        teamName: team.name || 'Unknown Team',
        ageGroup: team.ageGroup || '',
        hasGame: !!game,
        hasBye: !!bye,
        game,
        bye,
        matchedFrom
      };
    });
  }, [filteredTeams, games, byes, currentWeek]);

  // Calculate week completion status
  const weekCompletionStatus = useMemo(() => {
    const status: { week: number; complete: boolean; total: number; done: number }[] = [];
    for (let week = 1; week <= setup.numberOfWeeks; week++) {
      const weekGames = games.filter(g => g.week === week);
      const weekByes = byes.filter(b => b.week === week);
      
      // For each team, check if they have a game or bye
      let teamsWithSchedule = 0;
      teams.forEach(team => {
        const hasGame = weekGames.some(g => g.homeTeamId === team.id || g.awayTeamId === team.id);
        const hasBye = weekByes.some(b => b.teamId === team.id);
        if (hasGame || hasBye) teamsWithSchedule++;
      });
      
      status.push({
        week,
        complete: teamsWithSchedule === teams.length && teams.length > 0,
        total: teams.length,
        done: teamsWithSchedule
      });
    }
    return status;
  }, [games, byes, teams, setup.numberOfWeeks]);

  useEffect(() => {
    if (seasonId && programData?.id) {
      loadData();
    }
  }, [seasonId, programData?.id]);

  const loadData = async () => {
    if (!seasonId || !programData?.id) return;

    setLoading(true);
    try {
      // Load season
      const seasonDoc = await getDoc(doc(db, 'programs', programData.id, 'seasons', seasonId));
      if (!seasonDoc.exists()) {
        toastError('Season not found');
        navigate('/commissioner');
        return;
      }
      const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as ProgramSeason;
      setSeason(seasonData);

      // Set default start date from season if available
      if (seasonData.seasonStartDate) {
        setSetup(prev => ({ ...prev, startDate: seasonData.seasonStartDate || '' }));
      }

      // Load teams for this program
      const teamsQuery = query(
        collection(db, 'teams'),
        where('programId', '==', programData.id)
      );
      const teamsSnap = await getDocs(teamsQuery);
      // Only include teams with ageGroup set (live teams)
      const teamsData = teamsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Team))
        .filter(t => t.ageGroup && t.ageGroup.trim() !== '');
      setTeams(teamsData);

      // Load existing games for this season
      const gamesQuery = query(collection(db, 'programs', programData.id, 'seasons', seasonId, 'games'));
      const gamesSnap = await getDocs(gamesQuery);
      const gamesData = gamesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      setGames(gamesData);

      // Load existing byes
      const byesQuery = query(collection(db, 'programs', programData.id, 'seasons', seasonId, 'byes'));
      const byesSnap = await getDocs(byesQuery);
      const byesData = byesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ByeWeek));
      setByes(byesData);

      // If there are existing games, skip setup
      if (gamesData.length > 0 || byesData.length > 0) {
        // Infer number of weeks from existing data (max week found, not defaulting to 8)
        const allWeeks = [
          ...gamesData.map(g => g.week || 1),
          ...byesData.map(b => b.week || 1)
        ];
        const maxWeek = allWeeks.length > 0 ? Math.max(...allWeeks) : 1;
        setSetup(prev => ({ ...prev, numberOfWeeks: maxWeek }));
        setShowSetup(false);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toastError('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  const handleStartBuilding = () => {
    if (!setup.startDate) {
      toastError('Please select a start date');
      return;
    }
    if (setup.numberOfWeeks < 1 || setup.numberOfWeeks > 20) {
      toastError('Please enter between 1 and 20 weeks');
      return;
    }
    setShowSetup(false);
  };

  const handleAddGame = (teamId: string) => {
    // Check if we have an opponent (either from system or custom typed)
    const opponentName = gameForm.opponentName.trim();
    if (!opponentName) {
      toastError('Please enter an opponent');
      return;
    }

    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    // Check if opponent matches a system team
    const systemOpponent = teams.find(t => 
      t.name?.toLowerCase() === opponentName.toLowerCase() || t.id === gameForm.opponentId
    );

    const newGame: Game = {
      week: currentWeek,
      weekDate: gameForm.gameDate || weekDates[currentWeek - 1] || '',
      homeTeamId: gameForm.isHome ? teamId : (systemOpponent?.id || 'external'),
      homeTeamName: gameForm.isHome ? (team.name || 'Unknown') : opponentName,
      awayTeamId: gameForm.isHome ? (systemOpponent?.id || 'external') : teamId,
      awayTeamName: gameForm.isHome ? opponentName : (team.name || 'Unknown'),
      time: gameForm.time,
      location: gameForm.location,
      ageGroup: team.ageGroup || '',
      status: 'scheduled',
      isNew: true
    };

    // Remove any existing bye for this team (and system opponent if applicable)
    setByes(prev => prev.filter(b => {
      if (b.week !== currentWeek) return true;
      if (b.teamId === teamId) return false;
      if (systemOpponent && b.teamId === systemOpponent.id) return false;
      return true;
    }));

    // Remove any existing game for this team (and system opponent if applicable)
    setGames(prev => prev.filter(g => {
      if (g.week !== currentWeek) return true;
      if (g.homeTeamId === teamId || g.awayTeamId === teamId) return false;
      if (systemOpponent && (g.homeTeamId === systemOpponent.id || g.awayTeamId === systemOpponent.id)) return false;
      return true;
    }));

    setGames(prev => [...prev, newGame]);
    setHasUnsavedChanges(true);
    setEditingTeam(null);
    setGameForm({ opponentId: '', opponentName: '', time: '10:00', location: '', isHome: true, isByeMode: false, gameDate: '' });
    toastSuccess(`Game added: ${newGame.homeTeamName} vs ${newGame.awayTeamName}`);
  };

  const handleAddBye = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    // Remove any existing game for this team this week
    setGames(prev => prev.filter(g => 
      !(g.week === currentWeek && (g.homeTeamId === teamId || g.awayTeamId === teamId))
    ));

    const newBye: ByeWeek = {
      week: currentWeek,
      weekDate: weekDates[currentWeek - 1] || '',
      teamId,
      teamName: team.name || 'Unknown',
      ageGroup: team.ageGroup || '',
      isNew: true
    };

    setByes(prev => [...prev.filter(b => !(b.week === currentWeek && b.teamId === teamId)), newBye]);
    setHasUnsavedChanges(true);
    setEditingTeam(null);
    toastInfo(`${team.name} has a bye week ${currentWeek}`);
  };

  const handleRemoveGame = (game: Game) => {
    setGames(prev => prev.filter(g => g !== game));
    setHasUnsavedChanges(true);
  };

  const handleRemoveBye = (bye: ByeWeek) => {
    setByes(prev => prev.filter(b => b !== bye));
    setHasUnsavedChanges(true);
  };

  const handleAddWeek = () => {
    setSetup(prev => ({ ...prev, numberOfWeeks: prev.numberOfWeeks + 1 }));
    setHasUnsavedChanges(true);
  };

  const handleRemoveWeek = (weekNum: number) => {
    if (setup.numberOfWeeks <= 1) {
      toastError('Must have at least 1 week');
      return;
    }
    // Remove games and byes for this week
    setGames(prev => prev.filter(g => g.week !== weekNum).map(g => ({
      ...g,
      week: g.week > weekNum ? g.week - 1 : g.week
    })));
    setByes(prev => prev.filter(b => b.week !== weekNum).map(b => ({
      ...b,
      week: b.week > weekNum ? b.week - 1 : b.week
    })));
    setSetup(prev => ({ ...prev, numberOfWeeks: prev.numberOfWeeks - 1 }));
    if (currentWeek > setup.numberOfWeeks - 1) {
      setCurrentWeek(setup.numberOfWeeks - 1);
    }
    setHasUnsavedChanges(true);
  };

  const handleSaveAll = async () => {
    if (!programData?.id || !seasonId) return;

    setSaving(true);
    try {
      const gamesRef = collection(db, 'programs', programData.id, 'seasons', seasonId, 'games');
      const byesRef = collection(db, 'programs', programData.id, 'seasons', seasonId, 'byes');

      // SINGLE SOURCE OF TRUTH ARCHITECTURE:
      // All games live in programs/{programId}/seasons/{seasonId}/games
      // NO syncing to events collection - teams read directly from here

      // Step 1: Collect existing game data (scores, status) to preserve
      const existingGamesSnap = await getDocs(gamesRef);
      const existingGamesMap = new Map<string, any>();
      existingGamesSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        // Key by homeTeamId-awayTeamId-week for matching
        const key = `${data.homeTeamId}-${data.awayTeamId}-${data.week}`;
        existingGamesMap.set(key, {
          id: docSnap.id,
          homeScore: data.homeScore,
          awayScore: data.awayScore,
          status: data.status,
          stats: data.stats, // Preserve any stats that were added
        });
      });
      
      console.log('[ScheduleBuilder] Preserved data from', existingGamesMap.size, 'existing games');

      // Step 2: Delete existing games and byes
      const batch = writeBatch(db);
      existingGamesSnap.docs.forEach(docSnap => batch.delete(docSnap.ref));
      
      const existingByes = await getDocs(byesRef);
      existingByes.docs.forEach(docSnap => batch.delete(docSnap.ref));

      await batch.commit();

      // Step 3: Add all games (with preserved scores/status from existing games)
      for (const game of games) {
        const { isNew, id, ...gameData } = game;
        
        // Check if this game existed before (same matchup, same week)
        const matchKey = `${game.homeTeamId}-${game.awayTeamId}-${game.week}`;
        const existingData = existingGamesMap.get(matchKey);
        
        // Build game document - preserving scores if game was played
        const gameDoc: any = {
          ...gameData,
          // Preserve existing scores/status if game was played, otherwise default
          homeScore: existingData?.homeScore ?? 0,
          awayScore: existingData?.awayScore ?? 0,
          status: existingData?.status || 'scheduled',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        // Preserve stats if they exist
        if (existingData?.stats) {
          gameDoc.stats = existingData.stats;
        }
        
        await addDoc(gamesRef, gameDoc);
      }

      // Step 4: Add all byes (simple, no scores to preserve)
      for (const bye of byes) {
        const { isNew, id, ...byeData } = bye;
        await addDoc(byesRef, {
          ...byeData,
          createdAt: serverTimestamp()
        });
      }

      // Mark all as saved
      setGames(prev => prev.map(g => ({ ...g, isNew: false })));
      setByes(prev => prev.map(b => ({ ...b, isNew: false })));
      setHasUnsavedChanges(false);
      
      // Update season to mark schedule as built
      if (programData?.id && seasonId) {
        await updateDoc(doc(db, 'programs', programData.id, 'seasons', seasonId), {
          scheduleBuilt: true,
          updatedAt: serverTimestamp()
        });
      }
      
      toastSuccess(`Schedule saved! ${games.length} games and ${byes.length} bye weeks`);
      
    } catch (error) {
      console.error('Error saving schedule:', error);
      toastError('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  // REMOVED: syncGameToTeamEvents - no longer needed with single-source architecture
  // REMOVED: syncByeToTeamEvents - no longer needed with single-source architecture

  // Get available opponents for a team (same age group, not already scheduled this week)
  const getAvailableOpponents = (teamId: string, ageGroup: string) => {
    const scheduledTeamIds = new Set<string>();
    
    // Get all teams that already have a game this week
    games.filter(g => g.week === currentWeek).forEach(g => {
      scheduledTeamIds.add(g.homeTeamId);
      scheduledTeamIds.add(g.awayTeamId);
    });

    // Get all teams with bye this week
    byes.filter(b => b.week === currentWeek).forEach(b => {
      scheduledTeamIds.add(b.teamId);
    });

    return teams.filter(t => 
      t.id !== teamId && 
      t.ageGroup === ageGroup && 
      !scheduledTeamIds.has(t.id)
    );
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  // Setup Screen
  if (showSetup) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="max-w-lg mx-auto px-4 py-12">
          <button
            onClick={() => navigate('/commissioner')}
            className={`flex items-center gap-2 mb-6 ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Dashboard
          </button>

          <div className={`rounded-xl p-6 ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
            <div className="text-center mb-6">
              <Calendar className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
              <h1 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Schedule Builder
              </h1>
              <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {season?.name || 'Season'} • Set up games for all teams
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Number of Weeks
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={setup.numberOfWeeks}
                  onChange={(e) => setSetup(prev => ({ ...prev, numberOfWeeks: parseInt(e.target.value) || 8 }))}
                  className={`w-full px-4 py-3 rounded-lg border text-lg ${
                    theme === 'dark' 
                      ? 'bg-gray-900 border-gray-700 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Season Start Date (Week 1)
                </label>
                <input
                  type="date"
                  value={setup.startDate}
                  onChange={(e) => setSetup(prev => ({ ...prev, startDate: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-lg border text-lg ${
                    theme === 'dark' 
                      ? 'bg-gray-900 border-gray-700 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  <strong>{teams.length}</strong> teams across <strong>{ageGroups.length}</strong> age groups
                </p>
              </div>

              <button
                onClick={handleStartBuilding}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                Start Building Schedule
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Schedule Builder
  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 ${theme === 'dark' ? 'bg-gray-900/95 border-gray-800' : 'bg-white/95 border-gray-200'} border-b backdrop-blur-sm`}>
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (hasUnsavedChanges) {
                    setShowLeaveModal(true);
                  } else {
                    navigate('/commissioner');
                  }
                }}
                className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {season?.name || 'Season'} Schedule
                </h1>
                <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {setup.numberOfWeeks} weeks • {games.length} games • {byes.length} byes
                </p>
              </div>
            </div>
            <button
              onClick={handleSaveAll}
              disabled={saving || !hasUnsavedChanges}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium ${
                hasUnsavedChanges 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                  : theme === 'dark' ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {hasUnsavedChanges ? 'Save All' : 'Saved'}
            </button>
          </div>

          {/* Week Navigation */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 overflow-visible">
            {Array.from({ length: setup.numberOfWeeks }, (_, i) => i + 1).map(week => {
              const status = weekCompletionStatus[week - 1];
              const isComplete = status?.complete;
              const hasContent = (status?.done || 0) > 0;
              
              return (
                <div key={week} className="relative flex-shrink-0 group" style={{ marginTop: '4px' }}>
                  <button
                    onClick={() => setCurrentWeek(week)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
                      currentWeek === week
                        ? 'bg-purple-600 text-white'
                        : isComplete
                          ? theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                          : hasContent
                            ? theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                            : theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {isComplete && <Check className="w-3 h-3" />}
                    W{week}
                  </button>
                  {/* Delete week button - shows on hover */}
                  {setup.numberOfWeeks > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteWeekModal(week);
                      }}
                      className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white hover:bg-red-600`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
            {/* Add Week Button */}
            <button
              onClick={handleAddWeek}
              className={`flex-shrink-0 px-2 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 ${
                theme === 'dark' ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Add week"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Age Group Filter */}
          {ageGroups.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedAgeGroup('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                  selectedAgeGroup === 'all'
                    ? 'bg-purple-600 text-white'
                    : theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                }`}
              >
                All Age Groups
              </button>
              {ageGroups.map(ag => (
                <button
                  key={ag}
                  onClick={() => setSelectedAgeGroup(ag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                    selectedAgeGroup === ag
                      ? 'bg-purple-600 text-white'
                      : theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {ag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Week Info Banner */}
      <div className={`border-b ${theme === 'dark' ? 'bg-gray-800/50 border-gray-800' : 'bg-purple-50 border-purple-100'}`}>
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Week {currentWeek}
              </h2>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {weekDates[currentWeek - 1] ? parseLocalDate(weekDates[currentWeek - 1]).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Date not set'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentWeek(prev => Math.max(1, prev - 1))}
                disabled={currentWeek === 1}
                className={`p-2 rounded-lg ${currentWeek === 1 ? 'opacity-50 cursor-not-allowed' : ''} ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentWeek(prev => Math.min(setup.numberOfWeeks, prev + 1))}
                disabled={currentWeek === setup.numberOfWeeks}
                className={`p-2 rounded-lg ${currentWeek === setup.numberOfWeeks ? 'opacity-50 cursor-not-allowed' : ''} ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Teams List */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="space-y-3">
          {getTeamScheduleStatus.map(status => (
            <div
              key={status.teamId}
              className={`rounded-xl p-4 ${
                theme === 'dark' 
                  ? 'bg-gray-800 border border-gray-700' 
                  : 'bg-white border border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏈</span>
                  <div>
                    <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {status.teamName}
                    </h3>
                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                      {status.ageGroup}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {status.hasGame ? (
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1.5 rounded-lg ${
                        status.game && isGameLocked(status.game) 
                          ? theme === 'dark' ? 'bg-gray-500/20' : 'bg-gray-100'
                          : theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100'
                      }`}>
                        {status.game && isGameLocked(status.game) && (
                          <Lock className={`w-3 h-3 inline mr-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                        )}
                        <span className={`text-sm font-medium ${
                          status.game && isGameLocked(status.game)
                            ? theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            : theme === 'dark' ? 'text-green-400' : 'text-green-700'
                        }`}>
                          {status.game?.homeTeamId === status.teamId ? (
                            <>vs {status.game?.awayTeamName}</>
                          ) : (
                            <>@ {status.game?.homeTeamName}</>
                          )}
                        </span>
                        {status.game?.time && (
                          <span className={`text-xs ml-2 ${
                            status.game && isGameLocked(status.game)
                              ? theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                              : theme === 'dark' ? 'text-green-500' : 'text-green-600'
                          }`}>
                            {formatTime12Hour(status.game.time)}
                          </span>
                        )}
                      </div>
                      {/* Only show delete button if not matched from opponent AND not locked */}
                      {!status.matchedFrom && status.game && !isGameLocked(status.game) && (
                        <button
                          onClick={() => handleRemoveGame(status.game!)}
                          className={`p-1.5 rounded ${theme === 'dark' ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                          title="Remove game"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      {/* Show lock tooltip for locked games */}
                      {status.game && isGameLocked(status.game) && !status.matchedFrom && (
                        <div 
                          className={`p-1.5 rounded ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
                          title="Game is locked (already started or finalized)"
                        >
                          <Lock className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ) : status.hasBye ? (
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 ${theme === 'dark' ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                        <Coffee className="w-4 h-4" />
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-amber-400' : 'text-amber-700'}`}>
                          BYE WEEK
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveBye(status.bye!)}
                        className={`p-1.5 rounded ${theme === 'dark' ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : editingTeam === status.teamId ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* BYE Toggle Button - First */}
                      <button
                        onClick={() => {
                          if (gameForm.isByeMode) {
                            // Turning off BYE mode
                            setGameForm(prev => ({ ...prev, isByeMode: false }));
                          } else {
                            // Turning on BYE mode
                            setGameForm(prev => ({ ...prev, isByeMode: true, opponentName: '', opponentId: '' }));
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
                          gameForm.isByeMode
                            ? 'bg-amber-500 text-white'
                            : theme === 'dark' ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        }`}
                      >
                        <Coffee className="w-4 h-4" />
                        BYE
                      </button>

                      {/* Show game inputs only when NOT in BYE mode */}
                      {!gameForm.isByeMode && (
                        <>
                          {/* Combo input: type custom OR select from datalist */}
                          <div className="relative">
                            <input
                              type="text"
                              list={`opponents-${status.teamId}`}
                              placeholder="Type or select opponent"
                              value={gameForm.opponentName}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Check if it matches a system team
                                const match = getAvailableOpponents(status.teamId, status.ageGroup)
                                  .find(t => t.name?.toLowerCase() === value.toLowerCase());
                                setGameForm(prev => ({ 
                                  ...prev, 
                                  opponentName: value,
                                  opponentId: match?.id || ''
                                }));
                              }}
                              className={`px-2 py-1.5 rounded-lg border text-sm w-44 ${
                                theme === 'dark' 
                                  ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500' 
                                  : 'bg-white border-gray-300 text-gray-900'
                              }`}
                            />
                            <datalist id={`opponents-${status.teamId}`}>
                              {getAvailableOpponents(status.teamId, status.ageGroup).map(t => (
                                <option key={t.id} value={t.name || ''} />
                              ))}
                            </datalist>
                          </div>
                          <input
                            type="time"
                            value={gameForm.time}
                            onChange={(e) => setGameForm(prev => ({ ...prev, time: e.target.value }))}
                            className={`px-2 py-1.5 rounded-lg border text-sm w-24 ${
                              theme === 'dark' 
                                ? 'bg-gray-900 border-gray-700 text-white' 
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                          />
                          <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>/</span>
                          <input
                            type="date"
                            value={gameForm.gameDate || weekDates[currentWeek - 1] || ''}
                            onChange={(e) => setGameForm(prev => ({ ...prev, gameDate: e.target.value }))}
                            className={`px-2 py-1.5 rounded-lg border text-sm w-32 ${
                              theme === 'dark' 
                                ? 'bg-gray-900 border-gray-700 text-white' 
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                            title="Game date (defaults to week date)"
                          />
                          <input
                            type="text"
                            placeholder="Location"
                            value={gameForm.location}
                            onChange={(e) => setGameForm(prev => ({ ...prev, location: e.target.value }))}
                            className={`px-2 py-1.5 rounded-lg border text-sm w-28 ${
                              theme === 'dark' 
                                ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600' 
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                          />
                          <label className={`flex items-center gap-1 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            <input
                              type="checkbox"
                              checked={gameForm.isHome}
                              onChange={(e) => setGameForm(prev => ({ ...prev, isHome: e.target.checked }))}
                              className="rounded"
                            />
                            Home
                          </label>
                        </>
                      )}

                      {/* Confirm button */}
                      <button
                        onClick={() => {
                          if (gameForm.isByeMode) {
                            handleAddBye(status.teamId);
                          } else {
                            handleAddGame(status.teamId);
                          }
                        }}
                        className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      {/* Cancel button */}
                      <button
                        onClick={() => {
                          setEditingTeam(null);
                          setGameForm({ opponentId: '', opponentName: '', time: '10:00', location: '', isHome: true, isByeMode: false, gameDate: '' });
                        }}
                        className={`p-1.5 rounded ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 text-xs ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}>
                        <AlertCircle className="w-3 h-3" />
                        Not scheduled
                      </span>
                      <button
                        onClick={() => setEditingTeam(status.teamId)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredTeams.length === 0 && (
          <div className={`text-center py-12 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
            <h3 className={`text-lg font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              No Teams Found
            </h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Add teams to your program first
            </p>
          </div>
        )}
      </div>

      {/* Week Navigation Footer */}
      <div className={`sticky bottom-0 border-t ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setCurrentWeek(prev => Math.max(1, prev - 1))}
            disabled={currentWeek === 1}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              currentWeek === 1 
                ? 'opacity-50 cursor-not-allowed' 
                : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
            } ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous Week
          </button>
          
          <span className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
            Week {currentWeek} of {setup.numberOfWeeks}
          </span>
          
          <button
            onClick={() => setCurrentWeek(prev => Math.min(setup.numberOfWeeks, prev + 1))}
            disabled={currentWeek === setup.numberOfWeeks}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              currentWeek === setup.numberOfWeeks 
                ? 'opacity-50 cursor-not-allowed' 
                : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
            } ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
          >
            Next Week
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Delete Week Confirmation Modal */}
      {deleteWeekModal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-sm w-full rounded-xl p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-xl`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Delete Week {deleteWeekModal}?
                </h3>
              </div>
            </div>
            <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              All games and bye weeks scheduled for Week {deleteWeekModal} will be removed. 
              Remaining weeks will be renumbered.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteWeekModal(null)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                  theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleRemoveWeek(deleteWeekModal);
                  setDeleteWeekModal(null);
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
              >
                Delete Week
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Page Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-md w-full rounded-xl p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-xl`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Unsaved Schedule Changes
                </h3>
              </div>
            </div>
            <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              You have unsaved changes to this schedule:
            </p>
            <ul className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} list-disc pl-5 space-y-1`}>
              <li>{games.filter(g => g.isNew).length} new game(s) scheduled</li>
              <li>{byes.filter(b => b.isNew).length} bye week(s) set</li>
            </ul>
            <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Would you like to save before leaving?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                  theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Keep Editing
              </button>
              <button
                onClick={() => {
                  setShowLeaveModal(false);
                  navigate('/commissioner');
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                  theme === 'dark' ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30' : 'bg-red-50 text-red-600 hover:bg-red-100'
                }`}
              >
                Discard & Leave
              </button>
              <button
                onClick={async () => {
                  await handleSaveAll();
                  setShowLeaveModal(false);
                  navigate('/commissioner');
                }}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save & Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
