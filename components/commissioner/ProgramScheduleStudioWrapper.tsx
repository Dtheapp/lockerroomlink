/**
 * Program Schedule Studio Wrapper
 * Adapts the awesome ScheduleStudio for Team Commissioners
 * Works with program seasons instead of league seasons
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp, Timestamp, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Loader2, AlertCircle, ChevronLeft, Users, Calendar, Plus, X } from 'lucide-react';
import { toastSuccess, toastError, toastWarning } from '../../services/toast';
import ScheduleStudio, { ExistingBooking } from '../league/ScheduleStudio';
import { ProgramSeason, Program, Team } from '../../types';

// Placeholder opponents let a commissioner build a schedule before every team has
// registered in OSYS. They live on the program document and are merged into the
// studio's team list, so they drag onto the board like any other team. They have
// no teams/{id} document, so game sync to team calendars skips them.
const PLACEHOLDER_PREFIX = 'placeholder-';
const isPlaceholderId = (id?: string): boolean => !!id && id.startsWith(PLACEHOLDER_PREFIX);

interface TeamWithProgram {
  id: string;
  name: string;
  ageGroup: string;
  programId: string;
  programName: string;
  homeField?: string;
  homeFieldAddress?: string;
  color?: string;
  logoUrl?: string;
  isPlaceholder?: boolean;
}

interface ProgramGame {
  id: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  dateTime: Timestamp;
  location: string;
  locationAddress?: string;
  week: number;
  status: string;
  ageGroup: string;
}

export default function ProgramScheduleStudioWrapper() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const [searchParams] = useSearchParams();
  const ageGroupParam = searchParams.get('ageGroup');
  
  const { programData, user, userData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  // Get selected sport from localStorage
  const selectedSport = localStorage.getItem('commissioner_selected_sport') || 'football';
  
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<ProgramSeason | null>(null);
  const [teams, setTeams] = useState<TeamWithProgram[]>([]);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string | null>(ageGroupParam);
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  const [scheduledAgeGroups, setScheduledAgeGroups] = useState<string[]>([]);
  const [showStudio, setShowStudio] = useState(!!ageGroupParam);
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([]);
  const [existingGamesForEdit, setExistingGamesForEdit] = useState<any[]>([]);
  const [existingWeeksCount, setExistingWeeksCount] = useState<number | undefined>(undefined);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [hasLoadedForUrlParam, setHasLoadedForUrlParam] = useState(false);

  // --- PLACEHOLDER OPPONENTS ---
  const [placeholderName, setPlaceholderName] = useState('');
  const [placeholderAgeGroup, setPlaceholderAgeGroup] = useState('');
  const [savingPlaceholder, setSavingPlaceholder] = useState(false);

  const placeholderTeams: TeamWithProgram[] = useMemo(() => (
    (((programData as any)?.placeholderTeams as any[]) || []).map((p) => ({
      id: p.id,
      name: p.name,
      ageGroup: p.ageGroup || 'No Age Group',
      programId: programData?.id || '',
      programName: programData?.name || '',
      isPlaceholder: true,
    }))
  ), [programData]);

  // Real teams plus any placeholder opponents for the same age group.
  const teamsForAgeGroup = (ageGroup: string): TeamWithProgram[] => [
    ...teams.filter(t => t.ageGroup === ageGroup),
    ...placeholderTeams.filter(t => t.ageGroup === ageGroup),
  ];

  const handleAddPlaceholder = async () => {
    const name = placeholderName.trim();
    if (!name || !placeholderAgeGroup || !programData?.id) return;

    const existing = ((programData as any).placeholderTeams as any[]) || [];
    if (existing.some((p) => p.name?.toLowerCase() === name.toLowerCase() && p.ageGroup === placeholderAgeGroup)) {
      toastWarning(`"${name}" already exists in ${placeholderAgeGroup}`);
      return;
    }

    setSavingPlaceholder(true);
    try {
      await updateDoc(doc(db, 'programs', programData.id), {
        placeholderTeams: [
          ...existing,
          { id: `${PLACEHOLDER_PREFIX}${Date.now()}`, name, ageGroup: placeholderAgeGroup },
        ],
        updatedAt: serverTimestamp(),
      });
      setPlaceholderName('');
      toastSuccess(`Added "${name}" to ${placeholderAgeGroup}`);
    } catch (err) {
      console.error('Error adding placeholder team:', err);
      toastError('Could not add placeholder team');
    } finally {
      setSavingPlaceholder(false);
    }
  };

  const handleRemovePlaceholder = async (id: string) => {
    if (!programData?.id) return;
    try {
      const existing = ((programData as any).placeholderTeams as any[]) || [];
      await updateDoc(doc(db, 'programs', programData.id), {
        placeholderTeams: existing.filter((p) => p.id !== id),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error removing placeholder team:', err);
      toastError('Could not remove placeholder team');
    }
  };

  useEffect(() => {
    loadData();
  }, [seasonId, programData, selectedSport]);

  // When navigating with URL param, load existing games after data is ready
  useEffect(() => {
    if (
      ageGroupParam && 
      showStudio && 
      selectedAgeGroup && 
      teams.length > 0 && 
      !loadingBookings && 
      !hasLoadedForUrlParam
    ) {
      setHasLoadedForUrlParam(true);
      loadExistingBookingsForUrlParam(selectedAgeGroup);
    }
  }, [ageGroupParam, showStudio, selectedAgeGroup, teams.length, loadingBookings, hasLoadedForUrlParam]);

  const loadExistingBookingsForUrlParam = async (currentAgeGroup: string) => {
    if (!seasonId || !programData?.id) return;
    
    setLoadingBookings(true);
    try {
      const schedulesQuery = query(
        collection(db, 'programs', programData.id, 'schedules'),
        where('seasonId', '==', seasonId)
      );
      const schedulesSnap = await getDocs(schedulesQuery);
      
      const bookings: ExistingBooking[] = [];
      let currentAgeGroupGames: any[] = [];
      let currentAgeGroupWeeksCount: number | undefined = undefined;
      
      schedulesSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const ageGroup = data.ageGroup;
        const games = data.games as ProgramGame[] || [];
        
        if (ageGroup === currentAgeGroup) {
          currentAgeGroupWeeksCount = data.totalWeeks || (data.weeks?.length) || undefined;
          
          const teamsInAg = teamsForAgeGroup(currentAgeGroup);
          currentAgeGroupGames = games.map((game, idx) => {
            const gameDate = game.dateTime instanceof Timestamp 
              ? game.dateTime.toDate() 
              : new Date(game.dateTime as any);
            const hours = gameDate.getHours().toString().padStart(2, '0');
            const minutes = gameDate.getMinutes().toString().padStart(2, '0');
            const time24 = `${hours}:${minutes}`;
            const hour12 = gameDate.getHours() > 12 ? gameDate.getHours() - 12 : gameDate.getHours() === 0 ? 12 : gameDate.getHours();
            const ampm = gameDate.getHours() >= 12 ? 'PM' : 'AM';
            
            return {
              id: game.id || `game-${idx}`,
              weekNumber: game.week || 1,
              date: gameDate.toISOString(),
              homeTeam: teamsInAg.find(t => t.id === game.homeTeamId) || null,
              awayTeam: teamsInAg.find(t => t.id === game.awayTeamId) || null,
              time: {
                id: `time-${time24}`,
                time: time24,
                label: `${hour12}:${minutes.padStart(2, '0')} ${ampm}`,
              },
              venue: game.location ? {
                id: `venue-${game.location.toLowerCase().replace(/\s+/g, '-')}`,
                name: game.location,
                address: game.locationAddress || '',
              } : null,
              status: 'complete' as const,
            };
          });
          return;
        }
        
        // Other age groups for conflict detection
        games.forEach(game => {
          const gameDate = game.dateTime instanceof Timestamp 
            ? game.dateTime.toDate() 
            : new Date(game.dateTime as any);
          const hours = gameDate.getHours().toString().padStart(2, '0');
          const minutes = gameDate.getMinutes().toString().padStart(2, '0');
          bookings.push({
            date: gameDate,
            time: `${hours}:${minutes}`,
            venueId: game.location?.toLowerCase().replace(/\s+/g, '-') || '',
            venueName: game.location || '',
            ageGroup: ageGroup,
            homeTeam: game.homeTeamName || '',
            awayTeam: game.awayTeamName || '',
          });
        });
      });
      
      setExistingBookings(bookings);
      setExistingGamesForEdit(currentAgeGroupGames);
      setExistingWeeksCount(currentAgeGroupWeeksCount);
    } catch (error) {
      console.error('Error loading bookings for URL param:', error);
    } finally {
      setLoadingBookings(false);
    }
  };

  const loadData = async () => {
    if (!seasonId || !programData?.id) return;
    
    try {
      // Load season from program's seasons subcollection
      const seasonDoc = await getDoc(doc(db, 'programs', programData.id, 'seasons', seasonId));
      if (!seasonDoc.exists()) {
        toastError('Season not found');
        navigate('/commissioner');
        return;
      }
      const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as ProgramSeason;
      setSeason(seasonData);

      // Load teams for this program - FILTER BY SELECTED SPORT
      const teamsQuery = query(
        collection(db, 'teams'),
        where('programId', '==', programData.id)
      );
      const teamsSnap = await getDocs(teamsQuery);
      
      // Filter teams by sport
      const sportLower = selectedSport.toLowerCase();
      const allTeams: TeamWithProgram[] = teamsSnap.docs
        .map(doc => {
          const data = doc.data() as Team;
          return {
            id: doc.id,
            name: data.name,
            ageGroup: data.ageGroup || 'No Age Group',
            programId: data.programId || programData.id,
            programName: programData.name || 'Unknown Program',
            homeField: data.homeField?.name,
            homeFieldAddress: data.homeField?.address,
            color: data.primaryColor,
            logoUrl: data.logo,
            sport: data.sport, // Keep sport for filtering
          };
        })
        .filter(team => {
          // Filter by sport - check team.sport matches selectedSport
          const teamSport = ((team as any).sport || '').toLowerCase();
          return !teamSport || teamSport === sportLower;
        });
      
      setTeams(allTeams);
      console.log(`Loaded ${allTeams.length} teams for sport: ${selectedSport}`);
      
      // Extract age groups - FILTER BY SELECTED SPORT
      // 1. From season's sportsOffered for this sport
      // 2. From program's sportConfigs for this sport
      // 3. From teams themselves (already filtered by sport)
      const seasonAgeGroups: string[] = [];
      
      // Try season's sportsOffered first - only for matching sport
      if (seasonData.sportsOffered) {
        seasonData.sportsOffered.forEach((sportConfig: any) => {
          const configSport = (sportConfig.sport || '').toLowerCase();
          // Only include if sport matches or no sport specified
          if (configSport === sportLower || !configSport) {
            if (sportConfig.ageGroups && sportConfig.ageGroups.length > 0) {
              sportConfig.ageGroups.forEach((ag: any) => {
                const label = typeof ag === 'string' ? ag : ag.label;
                if (label && !seasonAgeGroups.includes(label)) {
                  seasonAgeGroups.push(label);
                }
              });
            }
          }
        });
      }
      
      // If still empty, try program's sportConfigs - only for matching sport
      if (seasonAgeGroups.length === 0 && (programData as any).sportConfigs) {
        const sportConfigs = (programData as any).sportConfigs as any[];
        sportConfigs.forEach((config: any) => {
          const configSport = (config.sport || '').toLowerCase();
          // Only include if sport matches
          if (configSport === sportLower) {
            if (config.ageGroups && config.ageGroups.length > 0) {
              config.ageGroups.forEach((ag: string) => {
                if (ag && !seasonAgeGroups.includes(ag)) {
                  seasonAgeGroups.push(ag);
                }
              });
            }
          }
        });
      }
      
      // If still empty, extract from teams (already filtered by sport above)
      if (seasonAgeGroups.length === 0) {
        allTeams.forEach(team => {
          if (team.ageGroup && team.ageGroup !== 'No Age Group' && !seasonAgeGroups.includes(team.ageGroup)) {
            seasonAgeGroups.push(team.ageGroup);
          }
        });
      }
      
      console.log(`Found age groups for ${selectedSport}:`, seasonAgeGroups);
      setAgeGroups(seasonAgeGroups);

      // Check which age groups already have schedules - wrapped in try/catch for permissions
      try {
        const schedulesQuery = query(
          collection(db, 'programs', programData.id, 'schedules'),
          where('seasonId', '==', seasonId)
        );
        const schedulesSnap = await getDocs(schedulesQuery);
        const scheduled: string[] = [];
        schedulesSnap.docs.forEach(doc => {
          const ag = doc.data().ageGroup;
          if (ag && !scheduled.includes(ag)) {
            scheduled.push(ag);
          }
        });
        setScheduledAgeGroups(scheduled);
      } catch (err) {
        console.log('Could not load existing schedules (may not exist yet):', err);
        setScheduledAgeGroups([]);
      }

      // If ageGroup was passed in URL, set it and show studio
      if (ageGroupParam) {
        setSelectedAgeGroup(ageGroupParam);
        setShowStudio(true);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toastError('Failed to load season data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchedule = async (games: any[], weeks: any[]) => {
    if (!seasonId || !programData?.id || !selectedAgeGroup) {
      throw new Error('Missing required data');
    }

    console.log('Saving schedule to program:', programData.id);
    console.log('Current user uid:', user?.uid);
    console.log('User programId:', userData?.programId);
    console.log('User role:', userData?.role);

    try {
      // Convert studio games to ProgramGame format
      const programGames = games
        .filter(g => g.homeTeam && g.awayTeam)
        .map((game, idx) => {
          let gameDateTime: Date;
          
          if (game.date && game.time?.time) {
            const [hours, minutes] = game.time.time.split(':').map(Number);
            const baseDate = game.date instanceof Date 
              ? new Date(game.date.getTime())
              : new Date(game.date);
            baseDate.setHours(hours, minutes, 0, 0);
            gameDateTime = baseDate;
          } else if (game.date) {
            gameDateTime = game.date instanceof Date ? new Date(game.date.getTime()) : new Date(game.date);
          } else {
            gameDateTime = new Date();
          }
          
          return {
            id: `game-${Date.now()}-${idx}`,
            homeTeamId: game.homeTeam.id,
            homeTeamName: game.homeTeam.name,
            awayTeamId: game.awayTeam.id,
            awayTeamName: game.awayTeam.name,
            dateTime: Timestamp.fromDate(gameDateTime),
            location: game.venue?.name || '',
            locationAddress: game.venue?.address || '',
            week: game.weekNumber || 1,
            status: 'scheduled' as const,
            ageGroup: selectedAgeGroup,
            timeLabel: game.time?.label || '',
          };
        });

      // Check for existing schedule for this age group
      const existingQuery = query(
        collection(db, 'programs', programData.id, 'schedules'),
        where('seasonId', '==', seasonId),
        where('ageGroup', '==', selectedAgeGroup)
      );
      const existingSnap = await getDocs(existingQuery);
      
      let scheduleDocId: string;

      if (existingSnap.docs.length > 0) {
        // Update existing schedule
        const existingDoc = existingSnap.docs[0];
        scheduleDocId = existingDoc.id;
        await updateDoc(doc(db, 'programs', programData.id, 'schedules', existingDoc.id), {
          games: programGames,
          totalWeeks: weeks.length,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid,
        });
      } else {
        // Create new schedule
        const newDoc = await addDoc(collection(db, 'programs', programData.id, 'schedules'), {
          programId: programData.id,
          seasonId: seasonId,
          ageGroup: selectedAgeGroup,
          games: programGames,
          totalWeeks: weeks.length,
          byeWeeks: weeks.filter(w => w.isByeWeek).map(w => w.weekNumber),
          createdAt: serverTimestamp(),
          createdBy: user?.uid,
          updatedAt: serverTimestamp(),
        });
        scheduleDocId = newDoc.id;
      }

      // =========================================================================
      // SYNC GAMES TO TEAM CALENDARS
      // =========================================================================
      
      const completeGames = games.filter(g => g.homeTeam && g.awayTeam);
      
      // Delete existing program-managed games for this schedule
      for (const teamData of teams) {
        const teamGamesQuery = query(
          collection(db, 'teams', teamData.id, 'games'),
          where('programScheduleId', '==', scheduleDocId)
        );
        const existingTeamGames = await getDocs(teamGamesQuery);
        
        for (const gameDoc of existingTeamGames.docs) {
          const data = gameDoc.data();
          if (data.status === 'completed' && (data.ourScore !== undefined || data.statsEntered)) {
            continue;
          }
          await deleteDoc(gameDoc.ref);
        }
      }
      
      // Create fresh game entries for each team
      const batch = writeBatch(db);
      let gameNumber = 1;
      
      for (const game of completeGames) {
        const gameDate = game.date ? new Date(game.date) : new Date();
        const dateStr = gameDate.toISOString().split('T')[0];
        const timeStr = game.time?.time || '12:00';
        
        // Create game for HOME team (skipped for placeholders - no teams/{id} doc)
        if (!isPlaceholderId(game.homeTeam.id)) {
        const homeTeamGameRef = doc(collection(db, 'teams', game.homeTeam.id, 'games'));
        batch.set(homeTeamGameRef, {
          seasonId: seasonId,
          teamId: game.homeTeam.id,
          gameNumber: gameNumber,
          opponent: game.awayTeam.name,
          opponentTeamId: isPlaceholderId(game.awayTeam.id) ? null : game.awayTeam.id,
          opponentLogoUrl: game.awayTeam.logoUrl || null,
          date: dateStr,
          time: timeStr,
          location: game.venue?.name || game.homeTeam.homeField || 'TBD',
          address: game.venue?.address || game.homeTeam.homeFieldAddress || '',
          isHome: true,
          isPlayoff: false,
          tags: [],
          status: 'scheduled',
          ticketsEnabled: false,
          statsEntered: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: user?.uid || 'system',
          // Program management fields
          programManaged: true,
          programId: programData.id,
          programScheduleId: scheduleDocId,
          programGameId: programGames[gameNumber - 1]?.id || `pg-${Date.now()}-${gameNumber}`,
          ageGroup: selectedAgeGroup,
          week: game.weekNumber || 1,
        });
        }
        
        // Create game for AWAY team (skipped for placeholders - no teams/{id} doc)
        if (!isPlaceholderId(game.awayTeam.id)) {
        const awayTeamGameRef = doc(collection(db, 'teams', game.awayTeam.id, 'games'));
        batch.set(awayTeamGameRef, {
          seasonId: seasonId,
          teamId: game.awayTeam.id,
          gameNumber: gameNumber,
          opponent: game.homeTeam.name,
          opponentTeamId: isPlaceholderId(game.homeTeam.id) ? null : game.homeTeam.id,
          opponentLogoUrl: game.homeTeam.logoUrl || null,
          date: dateStr,
          time: timeStr,
          location: game.venue?.name || game.homeTeam.homeField || 'TBD',
          address: game.venue?.address || game.homeTeam.homeFieldAddress || '',
          isHome: false,
          isPlayoff: false,
          tags: [],
          status: 'scheduled',
          ticketsEnabled: false,
          statsEntered: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: user?.uid || 'system',
          // Program management fields
          programManaged: true,
          programId: programData.id,
          programScheduleId: scheduleDocId,
          programGameId: programGames[gameNumber - 1]?.id || `pg-${Date.now()}-${gameNumber}`,
          ageGroup: selectedAgeGroup,
          week: game.weekNumber || 1,
        });
        }
        
        gameNumber++;
      }
      
      await batch.commit();
      
      console.log(`Synced ${completeGames.length} games to team calendars`);
      
      toastSuccess(`Schedule saved! ${completeGames.length} games synced to team calendars`);

      // Navigate back to commissioner dashboard
      navigate('/commissioner');
    } catch (error) {
      console.error('Error saving schedule:', error);
      throw error;
    }
  };

  const handleClose = () => {
    navigate('/commissioner');
  };

  const loadExistingBookings = async (currentAgeGroup: string) => {
    if (!seasonId || !programData?.id) return;
    
    setLoadingBookings(true);
    try {
      const schedulesQuery = query(
        collection(db, 'programs', programData.id, 'schedules'),
        where('seasonId', '==', seasonId)
      );
      const schedulesSnap = await getDocs(schedulesQuery);
      
      const bookings: ExistingBooking[] = [];
      let currentAgeGroupGames: any[] = [];
      let currentAgeGroupWeeksCount: number | undefined = undefined;
      
      schedulesSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const ageGroup = data.ageGroup;
        const games = data.games as ProgramGame[] || [];
        
        if (ageGroup === currentAgeGroup) {
          currentAgeGroupWeeksCount = data.totalWeeks || (data.weeks?.length) || undefined;
          const teamsInAgeGroup = teamsForAgeGroup(currentAgeGroup);
          currentAgeGroupGames = games.map((game, idx) => {
            const gameDate = game.dateTime instanceof Timestamp 
              ? game.dateTime.toDate() 
              : new Date(game.dateTime as any);
            const hours = gameDate.getHours().toString().padStart(2, '0');
            const minutes = gameDate.getMinutes().toString().padStart(2, '0');
            const time24 = `${hours}:${minutes}`;
            const hour12 = gameDate.getHours() > 12 ? gameDate.getHours() - 12 : gameDate.getHours() === 0 ? 12 : gameDate.getHours();
            const ampm = gameDate.getHours() >= 12 ? 'PM' : 'AM';
            
            return {
              id: game.id || `game-${idx}`,
              weekNumber: game.week || 1,
              date: gameDate.toISOString(),
              homeTeam: teamsInAgeGroup.find(t => t.id === game.homeTeamId) || null,
              awayTeam: teamsInAgeGroup.find(t => t.id === game.awayTeamId) || null,
              time: {
                id: `time-${time24}`,
                time: time24,
                label: `${hour12}:${minutes.padStart(2, '0')} ${ampm}`,
              },
              venue: game.location ? {
                id: `venue-${game.location.toLowerCase().replace(/\s+/g, '-')}`,
                name: game.location,
                address: game.locationAddress || '',
              } : null,
              status: 'complete' as const,
            };
          });
          return;
        }
        
        // Other age groups for conflict detection
        games.forEach(game => {
          const gameDate = game.dateTime instanceof Timestamp 
            ? game.dateTime.toDate() 
            : new Date(game.dateTime as any);
          const hours = gameDate.getHours().toString().padStart(2, '0');
          const minutes = gameDate.getMinutes().toString().padStart(2, '0');
          bookings.push({
            date: gameDate,
            time: `${hours}:${minutes}`,
            venueId: game.location?.toLowerCase().replace(/\s+/g, '-') || '',
            venueName: game.location || '',
            ageGroup: ageGroup,
            homeTeam: game.homeTeamName || '',
            awayTeam: game.awayTeamName || '',
          });
        });
      });
      
      setExistingBookings(bookings);
      setExistingGamesForEdit(currentAgeGroupGames);
      setExistingWeeksCount(currentAgeGroupWeeksCount);
    } catch (error) {
      console.error('Error loading existing bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleSelectAgeGroup = async (ageGroup: string) => {
    setSelectedAgeGroup(ageGroup);
    await loadExistingBookings(ageGroup);
    setShowStudio(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-500" />
          <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
            Loading schedule studio...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (!season || !programData) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <p className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Season not found
          </p>
          <button
            onClick={() => navigate('/commissioner')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Studio view
  if (showStudio && selectedAgeGroup) {
    if (loadingBookings) {
      return (
        <div className={`min-h-screen flex items-center justify-center ${
          theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
        }`}>
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-500" />
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
              Loading existing schedule...
            </p>
          </div>
        </div>
      );
    }

    const teamsInAgeGroup = teamsForAgeGroup(selectedAgeGroup);
    
    if (teamsInAgeGroup.length < 1) {
      return (
        <div className={`min-h-screen flex items-center justify-center ${
          theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
        }`}>
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
            <p className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              No Teams Yet
            </p>
            <p className={`mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              "{selectedAgeGroup}" has no registered teams. Add a placeholder opponent on the
              previous screen and you can start building the schedule right away.
            </p>
            <button
              onClick={() => setShowStudio(false)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Back to Age Groups
            </button>
          </div>
        </div>
      );
    }

    const startDate = season.seasonStartDate 
      ? new Date(season.seasonStartDate)
      : new Date();
      
    return (
      <ScheduleStudio
        seasonId={seasonId!}
        leagueId={programData.id} // Use programId as the "league" id
        ageGroup={selectedAgeGroup}
        teams={teamsInAgeGroup}
        seasonStartDate={startDate}
        existingBookings={existingBookings}
        existingGames={existingGamesForEdit}
        existingWeeksCount={existingWeeksCount}
        onSave={handleSaveSchedule}
        onClose={handleClose}
      />
    );
  }

  // Age group selection screen
  return (
    <div className={`min-h-screen ${
      theme === 'dark' ? 'bg-zinc-900 text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Header */}
      <div className={`border-b ${
        theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-white border-slate-200'
      }`}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleClose}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={`text-xl font-bold flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                🎨 Schedule Studio
              </h1>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {season.name} • Select an age group to design its schedule
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Age Group Selection */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Select Age Group
          </h2>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Design a visual schedule for one age group at a time
          </p>
        </div>

        {ageGroups.length === 0 ? (
          <div className={`text-center p-8 rounded-xl border ${
            theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
          }`}>
            <Users className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
            <p className={`font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              No Age Groups Found
            </p>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              This season doesn't have any age groups configured yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {ageGroups.map(ageGroup => {
              const realTeams = teams.filter(t => t.ageGroup === ageGroup);
              const placeholders = placeholderTeams.filter(t => t.ageGroup === ageGroup);
              const teamsInGroup = [...realTeams, ...placeholders];
              const hasSchedule = scheduledAgeGroups.includes(ageGroup);
              const canSchedule = teamsInGroup.length >= 1;
              
              return (
                <button
                  key={ageGroup}
                  onClick={() => canSchedule && handleSelectAgeGroup(ageGroup)}
                  disabled={!canSchedule}
                  className={`p-6 rounded-xl border text-left transition-all ${
                    canSchedule
                      ? theme === 'dark'
                        ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-purple-500/50'
                        : 'bg-white border-slate-200 hover:border-purple-500 hover:shadow-lg'
                      : theme === 'dark'
                        ? 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                        : 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      hasSchedule
                        ? 'bg-green-500/20'
                        : theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
                    }`}>
                      <Calendar className={`w-6 h-6 ${
                        hasSchedule ? 'text-green-400' : 'text-purple-500'
                      }`} />
                    </div>
                    {hasSchedule && (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                        ✓ Scheduled
                      </span>
                    )}
                  </div>
                  <h3 className={`font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {ageGroup}
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {realTeams.length} team{realTeams.length !== 1 ? 's' : ''}
                    {placeholders.length > 0 && ` + ${placeholders.length} placeholder${placeholders.length !== 1 ? 's' : ''}`}
                    {!canSchedule && ' (add a team or placeholder)'}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* PLACEHOLDER OPPONENTS */}
        {ageGroups.length > 0 && (
          <div className={`mt-8 rounded-xl border p-5 ${
            theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
          }`}>
            <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Placeholder Opponents
            </h2>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Building the schedule before everyone has registered? Add opponents by name here and
              they'll appear in the studio like any other team. When the real team signs up, swap
              them in and delete the placeholder.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="text"
                value={placeholderName}
                onChange={(e) => setPlaceholderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddPlaceholder(); }}
                placeholder="Team name (e.g. Commerce Tigers)"
                maxLength={60}
                className={`flex-1 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/50 ${
                  theme === 'dark'
                    ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                    : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
              <select
                value={placeholderAgeGroup}
                onChange={(e) => setPlaceholderAgeGroup(e.target.value)}
                className={`rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/50 ${
                  theme === 'dark'
                    ? 'bg-white/5 border border-white/10 text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-900'
                }`}
              >
                <option value="">Age group…</option>
                {ageGroups.map(ag => <option key={ag} value={ag}>{ag}</option>)}
              </select>
              <button
                onClick={handleAddPlaceholder}
                disabled={!placeholderName.trim() || !placeholderAgeGroup || savingPlaceholder}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {savingPlaceholder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </button>
            </div>

            {placeholderTeams.length === 0 ? (
              <p className={`text-sm italic ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                No placeholder opponents yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {placeholderTeams.map(p => (
                  <span
                    key={p.id}
                    className={`inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg text-sm border ${
                      theme === 'dark'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                        : 'bg-amber-50 border-amber-300 text-amber-800'
                    }`}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="opacity-70 text-xs">{p.ageGroup}</span>
                    <button
                      onClick={() => handleRemovePlaceholder(p.id)}
                      className="p-0.5 rounded hover:bg-black/20 transition-colors"
                      title={`Remove ${p.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
