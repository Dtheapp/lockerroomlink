import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp, Timestamp, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Loader2, AlertCircle, ChevronLeft, Users, Calendar } from 'lucide-react';
import { toastSuccess, toastError, toastWarning } from '../../services/toast';
import ScheduleStudio, { ExistingBooking } from './ScheduleStudio';
import { LeagueSeason, Program, Team } from '../../types';

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
}

interface LeagueGame {
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

export default function ScheduleStudioWrapper() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const [searchParams] = useSearchParams();
  const ageGroupParam = searchParams.get('ageGroup');
  
  const { leagueData, user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<LeagueSeason | null>(null);
  const [teams, setTeams] = useState<TeamWithProgram[]>([]);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string | null>(ageGroupParam);
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  const [scheduledAgeGroups, setScheduledAgeGroups] = useState<string[]>([]);
  const [showStudio, setShowStudio] = useState(!!ageGroupParam);
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  useEffect(() => {
    loadData();
  }, [seasonId, leagueData]);

  const loadData = async () => {
    if (!seasonId || !leagueData) return;
    
    try {
      // Load season
      const seasonDoc = await getDoc(doc(db, 'leagueSeasons', seasonId));
      if (!seasonDoc.exists()) {
        navigate('/league/seasons');
        return;
      }
      const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as LeagueSeason;
      setSeason(seasonData);
      setAgeGroups(seasonData.ageGroups || []);

      // Load programs in league
      const programsQuery = query(
        collection(db, 'programs'),
        where('leagueId', '==', leagueData.id)
      );
      const programsSnap = await getDocs(programsQuery);
      const programsMap: Record<string, Program> = {};
      programsSnap.docs.forEach(doc => {
        programsMap[doc.id] = { id: doc.id, ...doc.data() } as Program;
      });
      const programIds = Object.keys(programsMap);

      // Load teams
      if (programIds.length > 0) {
        const allTeams: TeamWithProgram[] = [];
        
        // Batch by 10 (Firestore 'in' limit)
        for (let i = 0; i < programIds.length; i += 10) {
          const batch = programIds.slice(i, i + 10);
          const teamsQuery = query(
            collection(db, 'teams'),
            where('programId', 'in', batch)
          );
          const teamsSnap = await getDocs(teamsQuery);
          teamsSnap.docs.forEach(doc => {
            const data = doc.data() as Team;
            const program = programsMap[data.programId || ''];
            allTeams.push({
              id: doc.id,
              name: data.name,
              ageGroup: data.ageGroup || 'No Age Group',
              programId: data.programId || '',
              programName: program?.name || 'Unknown Program',
              homeField: data.homeField?.name,
              homeFieldAddress: data.homeField?.address,
              color: data.primaryColor,
              logoUrl: data.logo,
            });
          });
        }
        
        setTeams(allTeams);
      }

      // Check which age groups already have schedules
      const schedulesQuery = query(
        collection(db, 'leagueSchedules'),
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
    if (!seasonId || !leagueData || !selectedAgeGroup) {
      throw new Error('Missing required data');
    }

    try {
      // Convert studio games to LeagueGame format
      const leagueGames = games
        .filter(g => g.homeTeam && g.awayTeam) // Only complete games
        .map((game, idx) => ({
          id: `game-${Date.now()}-${idx}`,
          homeTeamId: game.homeTeam.id,
          homeTeamName: game.homeTeam.name,
          awayTeamId: game.awayTeam.id,
          awayTeamName: game.awayTeam.name,
          dateTime: game.date ? Timestamp.fromDate(new Date(game.date)) : Timestamp.now(),
          location: game.venue?.name || '',
          locationAddress: game.venue?.address || '',
          week: game.weekNumber || 1,
          status: 'scheduled' as const,
          ageGroup: selectedAgeGroup,
        }));

      // Check for existing schedule for this age group
      const existingQuery = query(
        collection(db, 'leagueSchedules'),
        where('seasonId', '==', seasonId),
        where('ageGroup', '==', selectedAgeGroup)
      );
      const existingSnap = await getDocs(existingQuery);
      
      let scheduleDocId: string;

      if (existingSnap.docs.length > 0) {
        // Update existing schedule
        const existingDoc = existingSnap.docs[0];
        scheduleDocId = existingDoc.id;
        await updateDoc(doc(db, 'leagueSchedules', existingDoc.id), {
          games: leagueGames,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid,
        });
      } else {
        // Create new schedule
        const newDoc = await addDoc(collection(db, 'leagueSchedules'), {
          leagueId: leagueData.id,
          seasonId: seasonId,
          ageGroup: selectedAgeGroup,
          games: leagueGames,
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
      // For each game, create entries in both teams' games subcollections
      // This enables team views (calendar, upcoming, gameday) to see league games
      // Games are marked as leagueManaged so teams can't edit them
      // =========================================================================
      
      const completeGames = games.filter(g => g.homeTeam && g.awayTeam);
      
      // First, delete existing league-managed games for this schedule to avoid duplicates
      for (const teamData of teams) {
        const teamGamesQuery = query(
          collection(db, 'teams', teamData.id, 'games'),
          where('leagueScheduleId', '==', scheduleDocId)
        );
        const existingTeamGames = await getDocs(teamGamesQuery);
        
        for (const gameDoc of existingTeamGames.docs) {
          // Don't delete games that have scores (completed games with stats)
          const data = gameDoc.data();
          if (data.status === 'completed' && (data.ourScore !== undefined || data.statsEntered)) {
            console.log(`Skipping deletion of completed game ${gameDoc.id} with stats`);
            continue;
          }
          await deleteDoc(gameDoc.ref);
        }
      }
      
      // Now create fresh game entries for each team
      const batch = writeBatch(db);
      let gameNumber = 1;
      
      for (const game of completeGames) {
        const gameDate = game.date ? new Date(game.date) : new Date();
        const dateStr = gameDate.toISOString().split('T')[0];
        const timeStr = game.time?.time || '12:00';
        
        // Create game for HOME team
        const homeTeamGameRef = doc(collection(db, 'teams', game.homeTeam.id, 'games'));
        batch.set(homeTeamGameRef, {
          seasonId: seasonId,
          teamId: game.homeTeam.id,
          gameNumber: gameNumber,
          opponent: game.awayTeam.name,
          opponentTeamId: game.awayTeam.id,
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
          // League management fields - teams cannot edit these games
          leagueManaged: true,
          leagueId: leagueData.id,
          leagueScheduleId: scheduleDocId,
          leagueGameId: leagueGames[gameNumber - 1]?.id || `lg-${Date.now()}-${gameNumber}`,
          ageGroup: selectedAgeGroup,
          week: game.weekNumber || 1,
        });
        
        // Create game for AWAY team
        const awayTeamGameRef = doc(collection(db, 'teams', game.awayTeam.id, 'games'));
        batch.set(awayTeamGameRef, {
          seasonId: seasonId,
          teamId: game.awayTeam.id,
          gameNumber: gameNumber,
          opponent: game.homeTeam.name,
          opponentTeamId: game.homeTeam.id,
          opponentLogoUrl: game.homeTeam.logoUrl || null,
          date: dateStr,
          time: timeStr,
          location: game.venue?.name || game.homeTeam.homeField || 'TBD',
          address: game.venue?.address || game.homeTeam.homeFieldAddress || '',
          isHome: false, // Away team
          isPlayoff: false,
          tags: [],
          status: 'scheduled',
          ticketsEnabled: false,
          statsEntered: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: user?.uid || 'system',
          // League management fields - teams cannot edit these games
          leagueManaged: true,
          leagueId: leagueData.id,
          leagueScheduleId: scheduleDocId,
          leagueGameId: leagueGames[gameNumber - 1]?.id || `lg-${Date.now()}-${gameNumber}`,
          ageGroup: selectedAgeGroup,
          week: game.weekNumber || 1,
        });
        
        gameNumber++;
      }
      
      // Commit all team game writes at once
      await batch.commit();
      
      console.log(`Synced ${completeGames.length} games to ${teams.length * 2} team calendars`);
      
      toastSuccess(`Schedule saved! ${completeGames.length} games synced to team calendars`);

      // Navigate back to season schedule
      navigate(`/league/seasons/${seasonId}`);
    } catch (error) {
      console.error('Error saving schedule:', error);
      throw error;
    }
  };

  const handleClose = () => {
    if (showStudio) {
      setShowStudio(false);
      setSelectedAgeGroup(null);
      setExistingBookings([]); // Clear bookings when closing
    } else {
      navigate(`/league/seasons/${seasonId}`);
    }
  };

  // Load existing bookings from OTHER age groups for conflict detection
  const loadExistingBookings = async (currentAgeGroup: string) => {
    if (!seasonId) return;
    
    setLoadingBookings(true);
    try {
      // Load all schedules for this season EXCEPT the current age group
      const schedulesQuery = query(
        collection(db, 'leagueSchedules'),
        where('seasonId', '==', seasonId)
      );
      const schedulesSnap = await getDocs(schedulesQuery);
      
      const bookings: ExistingBooking[] = [];
      
      schedulesSnap.docs.forEach(doc => {
        const data = doc.data();
        const ageGroup = data.ageGroup;
        
        // Skip current age group (we're editing it)
        if (ageGroup === currentAgeGroup) return;
        
        const games = data.games as LeagueGame[] || [];
        
        games.forEach(game => {
          // Convert Firestore Timestamp to Date
          const gameDate = game.dateTime instanceof Timestamp 
            ? game.dateTime.toDate() 
            : new Date(game.dateTime as any);
          
          // Convert to 24hr time for conflict detection
          const hours = gameDate.getHours().toString().padStart(2, '0');
          const minutes = gameDate.getMinutes().toString().padStart(2, '0');
          const time24 = `${hours}:${minutes}`;
          
          bookings.push({
            date: gameDate,
            time: time24,
            venueId: game.location?.toLowerCase().trim() || '',
            venueName: game.location || 'Unknown Venue',
            ageGroup: ageGroup,
            homeTeam: game.homeTeamName,
            awayTeam: game.awayTeamName,
          });
        });
      });
      
      setExistingBookings(bookings);
      console.log(`Loaded ${bookings.length} existing bookings from other age groups`);
    } catch (error) {
      console.error('Error loading existing bookings:', error);
      // Non-fatal - continue without conflict detection for other age groups
    } finally {
      setLoadingBookings(false);
    }
  };

  // Handle age group selection
  const handleSelectAgeGroup = async (ag: string) => {
    setSelectedAgeGroup(ag);
    await loadExistingBookings(ag);
    setShowStudio(true);
  };

  const teamsInAgeGroup = selectedAgeGroup 
    ? teams.filter(t => t.ageGroup === selectedAgeGroup)
    : [];

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!leagueData || !season) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Season Not Found
          </h2>
        </div>
      </div>
    );
  }

  // If we have a selected age group and showing studio
  if (showStudio && selectedAgeGroup) {
    // Show loading while fetching existing bookings
    if (loadingBookings) {
      return (
        <div className={`min-h-screen flex items-center justify-center ${
          theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
        }`}>
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500 mx-auto mb-4" />
            <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Checking for Conflicts...
            </h2>
            <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Loading schedules from other age groups
            </p>
          </div>
        </div>
      );
    }
    
    const startDate = season.startDate instanceof Timestamp 
      ? season.startDate.toDate() 
      : new Date(season.startDate as any);
      
    return (
      <ScheduleStudio
        seasonId={seasonId!}
        leagueId={leagueData.id}
        ageGroup={selectedAgeGroup}
        teams={teamsInAgeGroup}
        seasonStartDate={startDate}
        existingBookings={existingBookings}
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ageGroups.map(ag => {
            const agTeams = teams.filter(t => t.ageGroup === ag);
            const isScheduled = scheduledAgeGroups.includes(ag);
            
            return (
              <button
                key={ag}
                onClick={() => handleSelectAgeGroup(ag)}
                disabled={loadingBookings}
                className={`
                  p-5 rounded-2xl border text-left transition-all group
                  ${loadingBookings ? 'opacity-50 cursor-wait' : ''}
                  ${isScheduled
                    ? theme === 'dark'
                      ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50'
                      : 'bg-green-50 border-green-200 hover:border-green-300'
                    : theme === 'dark'
                      ? 'bg-white/5 border-white/10 hover:border-purple-500/50 hover:bg-white/10'
                      : 'bg-white border-slate-200 hover:border-purple-500 hover:shadow-lg'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {ag}
                  </span>
                  {isScheduled && (
                    <span className={`
                      text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1
                      ${theme === 'dark' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-green-100 text-green-700'
                      }
                    `}>
                      ✓ Scheduled
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className={`flex items-center gap-1 ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <Users className="w-4 h-4" />
                    {agTeams.length} teams
                  </div>
                </div>
                
                {agTeams.length < 2 && (
                  <div className={`mt-3 text-xs ${
                    theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                  }`}>
                    ⚠️ Need at least 2 teams to create schedule
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {ageGroups.length === 0 && (
          <div className={`text-center py-12 rounded-2xl border-2 border-dashed ${
            theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
          }`}>
            <Calendar className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
            }`} />
            <h3 className={`text-lg font-medium ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>No Age Groups</h3>
            <p className={`mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
              This season has no age groups configured
            </p>
          </div>
        )}

        {/* Summary */}
        {scheduledAgeGroups.length > 0 && (
          <div className={`mt-8 p-4 rounded-xl ${
            theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Schedule Progress
                </span>
                <span className={`text-sm ml-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  {scheduledAgeGroups.length} of {ageGroups.length} age groups scheduled
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
                    style={{ width: `${(scheduledAgeGroups.length / ageGroups.length) * 100}%` }}
                  />
                </div>
                <span className={`text-sm font-medium ${
                  scheduledAgeGroups.length === ageGroups.length ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {Math.round((scheduledAgeGroups.length / ageGroups.length) * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
