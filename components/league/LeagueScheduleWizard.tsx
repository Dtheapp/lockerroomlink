/**
 * League Schedule Wizard
 * World-class multi-step wizard for creating league game schedules
 * 
 * Features:
 * - Team selection by age group
 * - Round-robin schedule generation
 * - Bye week configuration
 * - Home/away balancing
 * - Field mode selection (team home vs league central)
 * - Editable game locations
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Team, LeagueSeason, LeagueGame, LeagueField, Program } from '../../types';
import { toastSuccess, toastError } from '../../services/toast';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  MapPin,
  Settings,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Home,
  Shuffle,
  Plus,
  X,
  Edit2,
  Trash2,
  Save
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface TeamWithProgram extends Team {
  programName?: string;
}

interface ScheduleConfig {
  seasonWeeks: number;
  roundRobinType: 'single' | 'double';
  byeMode: 'none' | 'auto' | 'custom';
  byesPerTeam: number;
  gameDays: string[];
  timeSlots: string[];
}

interface FieldConfig {
  mode: 'team-home' | 'league-central' | 'mixed';
  leagueFields: LeagueField[];
}

interface GeneratedGame {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeProgramId?: string;
  awayProgramId?: string;
  ageGroup: string;
  week: number;
  date: Date;
  time: string;
  location: string;
  locationSource: 'team-home' | 'league-field' | 'manual';
  status: 'scheduled';
  isBye?: boolean;
  byeTeamId?: string;
  byeTeamName?: string;
}

// ============================================================================
// ROUND-ROBIN ALGORITHM
// ============================================================================

function generateRoundRobin(
  teams: TeamWithProgram[],
  config: ScheduleConfig,
  fieldConfig: FieldConfig,
  seasonStartDate: Date
): GeneratedGame[] {
  const games: GeneratedGame[] = [];
  const n = teams.length;
  
  if (n < 2) return games;
  
  // For odd number of teams, add a "BYE" placeholder (natural bye - one team sits each round)
  const teamList = [...teams];
  const hasOddTeams = n % 2 === 1;
  if (hasOddTeams) {
    teamList.push({ id: 'BYE', name: 'BYE', coachId: null } as TeamWithProgram);
  }
  
  const numTeams = teamList.length;
  const rounds = numTeams - 1; // Number of rounds in single round-robin
  const matchesPerRound = numTeams / 2;
  
  // Track home/away counts for balancing
  const homeCount: Record<string, number> = {};
  const awayCount: Record<string, number> = {};
  teams.forEach(t => {
    homeCount[t.id!] = 0;
    awayCount[t.id!] = 0;
  });
  
  // Generate matchups using circle method
  const fixed = teamList[0];
  let rotating = teamList.slice(1);
  
  // Calculate game dates
  const getGameDate = (week: number): Date => {
    const date = new Date(seasonStartDate);
    date.setDate(date.getDate() + ((week - 1) * 7)); // Add weeks
    const dayMap: Record<string, number> = { 
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 
      'Thursday': 4, 'Friday': 5, 'Saturday': 6 
    };
    if (config.gameDays.length > 0) {
      const targetDay = dayMap[config.gameDays[0]] ?? 6;
      while (date.getDay() !== targetDay) {
        date.setDate(date.getDate() + 1);
      }
    }
    return date;
  };
  
  // Get time slot for game
  const getTimeSlot = (gameIndex: number): string => {
    if (config.timeSlots.length === 0) return '9:00 AM';
    return config.timeSlots[gameIndex % config.timeSlots.length];
  };
  
  // Get location for game based on field mode
  const getLocation = (homeTeam: TeamWithProgram): { location: string; source: 'team-home' | 'league-field' | 'manual' } => {
    if (fieldConfig.mode === 'team-home' || fieldConfig.mode === 'mixed') {
      if (homeTeam.homeField?.name) {
        const addr = homeTeam.homeField;
        const location = addr.city && addr.state 
          ? `${addr.name}, ${addr.city}, ${addr.state}`
          : addr.name;
        return { location, source: 'team-home' };
      }
    }
    if (fieldConfig.mode === 'league-central' && fieldConfig.leagueFields.length > 0) {
      const field = fieldConfig.leagueFields[0];
      return { location: field.name, source: 'league-field' };
    }
    return { location: '', source: 'manual' };
  };
  
  // Determine home/away based on balance
  const assignHomeAway = (teamA: TeamWithProgram, teamB: TeamWithProgram): { home: TeamWithProgram; away: TeamWithProgram } => {
    const aBalance = (homeCount[teamA.id!] || 0) - (awayCount[teamA.id!] || 0);
    const bBalance = (homeCount[teamB.id!] || 0) - (awayCount[teamB.id!] || 0);
    
    if (aBalance < bBalance) {
      return { home: teamA, away: teamB };
    } else if (bBalance < aBalance) {
      return { home: teamB, away: teamA };
    } else {
      const totalA = (homeCount[teamA.id!] || 0) + (awayCount[teamA.id!] || 0);
      return totalA % 2 === 0 
        ? { home: teamA, away: teamB }
        : { home: teamB, away: teamA };
    }
  };
  
  // ============================================================================
  // STEP 1: Generate all round-robin rounds (each round = all teams paired up)
  // ============================================================================
  interface Round {
    matchups: Array<{ team1: TeamWithProgram; team2: TeamWithProgram }>;
  }
  const roundRobinRounds: Round[] = [];
  
  for (let r = 0; r < rounds; r++) {
    const currentTeams = [fixed, ...rotating];
    const roundMatchups: Round['matchups'] = [];
    
    for (let match = 0; match < matchesPerRound; match++) {
      const team1 = currentTeams[match];
      const team2 = currentTeams[numTeams - 1 - match];
      roundMatchups.push({ team1, team2 });
    }
    
    roundRobinRounds.push({ matchups: roundMatchups });
    
    // Rotate teams (circle method)
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  
  // For double round-robin, add reverse rounds
  if (config.roundRobinType === 'double') {
    const reverseRounds = roundRobinRounds.map(round => ({
      matchups: round.matchups.map(m => ({ team1: m.team2, team2: m.team1 }))
    }));
    roundRobinRounds.push(...reverseRounds);
  }
  
  const totalGameRounds = roundRobinRounds.length;
  
  // ============================================================================
  // STEP 2: Calculate bye weeks and create week schedule
  // Bye weeks = complete weeks where no games are scheduled (all teams rest)
  // ============================================================================
  let byeWeeks = 0;
  if (config.byeMode === 'auto') {
    byeWeeks = config.seasonWeeks > totalGameRounds 
      ? Math.min(config.seasonWeeks - totalGameRounds, 3) 
      : 0;
  } else if (config.byeMode === 'custom') {
    byeWeeks = config.byesPerTeam; // byesPerTeam = number of league-wide bye weeks
  }
  
  const totalWeeks = totalGameRounds + byeWeeks;
  
  // Determine which weeks are bye weeks (spread evenly)
  const byeWeekNumbers: Set<number> = new Set();
  if (byeWeeks > 0) {
    const interval = Math.floor(totalWeeks / (byeWeeks + 1));
    for (let i = 1; i <= byeWeeks; i++) {
      byeWeekNumbers.add(interval * i);
    }
  }
  
  // ============================================================================
  // STEP 3: Assign rounds to weeks, skipping bye weeks
  // ============================================================================
  let gameId = 1;
  let roundIndex = 0;
  
  for (let week = 1; week <= totalWeeks && roundIndex < roundRobinRounds.length; week++) {
    // Check if this is a bye week
    if (byeWeekNumbers.has(week)) {
      // Add a single bye marker for display
      games.push({
        id: `bye-week-${week}`,
        homeTeamId: 'LEAGUE_BYE',
        awayTeamId: 'LEAGUE_BYE',
        homeTeamName: 'League Bye Week',
        awayTeamName: '',
        ageGroup: '',
        week,
        date: getGameDate(week),
        time: '',
        location: '',
        locationSource: 'manual',
        status: 'scheduled',
        isBye: true,
        byeTeamId: 'LEAGUE_BYE',
        byeTeamName: 'All Teams'
      });
      continue;
    }
    
    // Process this round's matchups
    const round = roundRobinRounds[roundIndex];
    let gameIndex = 0;
    
    for (const matchup of round.matchups) {
      const { team1, team2 } = matchup;
      
      // Check for natural bye (odd teams - one team sits this round)
      if (team1.id === 'BYE' || team2.id === 'BYE') {
        const realTeam = team1.id === 'BYE' ? team2 : team1;
        if (realTeam.id !== 'BYE') {
          games.push({
            id: `game-${gameId++}`,
            homeTeamId: realTeam.id!,
            awayTeamId: '',
            homeTeamName: realTeam.name,
            awayTeamName: '',
            homeProgramId: realTeam.programId,
            ageGroup: realTeam.ageGroup || '',
            week,
            date: getGameDate(week),
            time: '',
            location: '',
            locationSource: 'manual',
            status: 'scheduled',
            isBye: true,
            byeTeamId: realTeam.id!,
            byeTeamName: realTeam.name
          });
        }
        continue;
      }
      
      // Assign home/away with balancing
      const { home, away } = assignHomeAway(team1, team2);
      homeCount[home.id!]++;
      awayCount[away.id!]++;
      
      // Get location
      const { location, source } = getLocation(home);
      
      games.push({
        id: `game-${gameId++}`,
        homeTeamId: home.id!,
        awayTeamId: away.id!,
        homeTeamName: home.name,
        awayTeamName: away.name,
        homeProgramId: home.programId,
        awayProgramId: away.programId,
        ageGroup: home.ageGroup || away.ageGroup || '',
        week,
        date: getGameDate(week),
        time: getTimeSlot(gameIndex),
        location,
        locationSource: source,
        status: 'scheduled'
      });
      
      gameIndex++;
    }
    
    roundIndex++;
  }
  
  return games;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LeagueScheduleWizard() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { leagueData, user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  // Current step (1-4)
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Season data
  const [season, setSeason] = useState<LeagueSeason | null>(null);
  const [existingScheduleAgeGroups, setExistingScheduleAgeGroups] = useState<string[]>([]);
  
  // Step 1: Age Group & Team selection
  const [allTeams, setAllTeams] = useState<TeamWithProgram[]>([]);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  
  // Step 2: Schedule configuration
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    seasonWeeks: 6,
    roundRobinType: 'single',
    byeMode: 'auto',
    byesPerTeam: 1,
    gameDays: ['Saturday'],
    timeSlots: ['9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM']
  });
  
  // Step 3: Field configuration
  const [fieldConfig, setFieldConfig] = useState<FieldConfig>({
    mode: 'team-home',
    leagueFields: []
  });
  
  // Step 4: Generated games
  const [generatedGames, setGeneratedGames] = useState<GeneratedGame[]>([]);
  const [editingGame, setEditingGame] = useState<string | null>(null);
  
  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (!seasonId || !leagueData?.id) {
        setLoading(false);
        return;
      }
      
      try {
        // Load season
        const seasonDoc = await getDoc(doc(db, 'leagueSeasons', seasonId));
        if (!seasonDoc.exists()) {
          toastError('Season not found');
          navigate('/league/seasons');
          return;
        }
        setSeason({ id: seasonDoc.id, ...seasonDoc.data() } as LeagueSeason);
        
        // Load teams from programs in this league
        const programsSnap = await getDocs(
          query(collection(db, 'programs'), where('leagueId', '==', leagueData.id))
        );
        
        const allTeamsData: TeamWithProgram[] = [];
        for (const programDoc of programsSnap.docs) {
          const programData = programDoc.data() as Program;
          
          // Get teams for this program that are linked to the league
          const teamsSnap = await getDocs(
            query(
              collection(db, 'teams'),
              where('programId', '==', programDoc.id),
              where('leagueId', '==', leagueData.id)
            )
          );
          
          teamsSnap.docs.forEach(teamDoc => {
            const teamData = teamDoc.data() as Team;
            allTeamsData.push({
              ...teamData,
              id: teamDoc.id,
              programName: (programData as any).sportNames?.[leagueData.sport || ''] || programData.name
            });
          });
        }
        
        setAllTeams(allTeamsData);
        
        // Load existing league fields
        if (leagueData.fields) {
          setFieldConfig(prev => ({ ...prev, leagueFields: leagueData.fields || [] }));
        }
        
        // Load existing schedules to see which age groups already have schedules
        const schedulesSnap = await getDocs(
          query(collection(db, 'leagueSchedules'), where('seasonId', '==', seasonId))
        );
        const existingAgeGroups: string[] = [];
        schedulesSnap.docs.forEach(schedDoc => {
          const schedData = schedDoc.data();
          if (schedData.ageGroup) {
            existingAgeGroups.push(schedData.ageGroup);
          }
        });
        setExistingScheduleAgeGroups(existingAgeGroups);
        
      } catch (error) {
        console.error('Error loading data:', error);
        toastError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [seasonId, leagueData?.id]);
  
  // Group teams by age group
  const teamsByAgeGroup = useMemo(() => {
    const groups: Record<string, TeamWithProgram[]> = {};
    allTeams.forEach(team => {
      const ag = team.ageGroup || 'No Age Group';
      if (!groups[ag]) groups[ag] = [];
      groups[ag].push(team);
    });
    return groups;
  }, [allTeams]);
  
  // Selected teams
  const selectedTeams = useMemo(() => 
    allTeams.filter(t => selectedTeamIds.has(t.id!)),
    [allTeams, selectedTeamIds]
  );
  
  // Teams missing home field
  const teamsMissingHomeField = useMemo(() => 
    selectedTeams.filter(t => !t.homeField?.name),
    [selectedTeams]
  );
  
  // Calculate schedule summary
  const scheduleSummary = useMemo(() => {
    const n = selectedTeams.length;
    if (n < 2) return null;
    
    const gamesPerTeam = scheduleConfig.roundRobinType === 'double' 
      ? (n - 1) * 2 
      : n - 1;
    
    const totalGames = scheduleConfig.roundRobinType === 'double'
      ? n * (n - 1)
      : (n * (n - 1)) / 2;
    
    const hasOddTeams = n % 2 === 1;
    const naturalByes = hasOddTeams ? 1 : 0;
    
    // Calculate configured byes
    let configuredByes = 0;
    if (scheduleConfig.byeMode === 'auto') {
      configuredByes = scheduleConfig.seasonWeeks > gamesPerTeam ? 1 : 0;
    } else if (scheduleConfig.byeMode === 'custom') {
      configuredByes = scheduleConfig.byesPerTeam;
    }
    
    const totalByesPerTeam = naturalByes + configuredByes;
    const weeksNeeded = gamesPerTeam + configuredByes;
    
    return {
      teamCount: n,
      gamesPerTeam,
      totalGames,
      hasOddTeams,
      naturalByes,
      configuredByes,
      totalByesPerTeam,
      weeksNeeded
    };
  }, [selectedTeams, scheduleConfig]);
  
  // Generate schedule
  const handleGenerate = () => {
    if (!selectedAgeGroup) {
      toastError('Select an age group first');
      return;
    }
    
    if (selectedTeams.length < 2) {
      toastError('Need at least 2 teams to create a schedule');
      return;
    }
    
    const startDate = season?.startDate instanceof Timestamp 
      ? season.startDate.toDate() 
      : new Date(season?.startDate as any);
    
    // Generate round-robin for the selected age group
    const games = generateRoundRobin(selectedTeams, scheduleConfig, fieldConfig, startDate);
    
    // Set age group on all games
    games.forEach(g => { g.ageGroup = selectedAgeGroup; });
    
    setGeneratedGames(games);
    setStep(4);
  };
  
  // Save schedule
  const handleSave = async (publish: boolean = false) => {
    if (!leagueData?.id || !seasonId || generatedGames.length === 0) return;
    
    setSaving(true);
    try {
      // Convert games to LeagueGame format
      const leagueGames: Omit<LeagueGame, 'id'>[] = generatedGames
        .filter(g => !g.isBye)
        .map(g => ({
          id: g.id,
          homeTeamId: g.homeTeamId,
          awayTeamId: g.awayTeamId,
          homeTeamName: g.homeTeamName,
          awayTeamName: g.awayTeamName,
          homeProgramId: g.homeProgramId,
          awayProgramId: g.awayProgramId,
          ageGroup: g.ageGroup,
          week: g.week,
          scheduledDate: Timestamp.fromDate(g.date),
          scheduledTime: g.time,
          dateTime: Timestamp.fromDate(g.date),
          location: g.location,
          locationSource: g.locationSource,
          status: 'scheduled' as const,
          homeScore: 0,
          awayScore: 0
        }));
      
      // Create or update schedule document
      await addDoc(collection(db, 'leagueSchedules'), {
        leagueId: leagueData.id,
        seasonId,
        ageGroup: selectedAgeGroup,
        name: `${season?.name} - ${selectedAgeGroup} Schedule`,
        games: leagueGames,
        status: publish ? 'published' : 'draft',
        createdAt: serverTimestamp(),
        ...(publish && { publishedAt: serverTimestamp() })
      });
      
      toastSuccess(publish ? `${selectedAgeGroup} schedule published!` : `${selectedAgeGroup} schedule saved as draft`);
      navigate(`/league/seasons/${seasonId}`);
      
    } catch (error) {
      console.error('Error saving schedule:', error);
      toastError('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };
  
  // Update game location
  const updateGameLocation = (gameId: string, location: string) => {
    setGeneratedGames(prev => prev.map(g => 
      g.id === gameId 
        ? { ...g, location, locationSource: 'manual' as const }
        : g
    ));
  };
  
  // Render loading
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'}`}>
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }
  
  if (!leagueData || !season) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'}`}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>Season not found</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 border-b ${theme === 'dark' ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-slate-200'} backdrop-blur-xl`}>
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Schedule Wizard
              </h1>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {season.name} • {leagueData.name}
              </p>
            </div>
            <button
              onClick={() => navigate(`/league/seasons/${seasonId}`)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
            >
              Cancel
            </button>
          </div>
          
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {[
              { num: 1, label: 'Teams', icon: Users },
              { num: 2, label: 'Config', icon: Settings },
              { num: 3, label: 'Fields', icon: MapPin },
              { num: 4, label: 'Review', icon: Calendar }
            ].map(({ num, label, icon: Icon }) => (
              <div 
                key={num}
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  step === num 
                    ? 'bg-purple-600 text-white' 
                    : step > num 
                      ? theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                      : theme === 'dark' ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {step > num ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                <span className="text-sm font-medium hidden sm:inline">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Step 1: Age Group & Team Selection */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Age Group Selection */}
            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-white'} border ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
              <h2 className={`text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Select Age Group
              </h2>
              <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                Generate a schedule for one age group at a time. You can create schedules for other age groups after.
              </p>
              
              {Object.keys(teamsByAgeGroup).length === 0 ? (
                <div className="text-center py-8">
                  <Users className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                  <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                    No teams have been finalized for this season yet.
                  </p>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                    Teams must finalize their rosters before scheduling.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(teamsByAgeGroup).sort().map(([ageGroup, teams]) => {
                    const hasSchedule = existingScheduleAgeGroups.includes(ageGroup);
                    const isSelected = selectedAgeGroup === ageGroup;
                    
                    return (
                      <button
                        key={ageGroup}
                        onClick={() => {
                          setSelectedAgeGroup(ageGroup);
                          // Auto-select all teams in this age group
                          const teamIds = new Set(teams.map(t => t.id!));
                          setSelectedTeamIds(teamIds);
                        }}
                        disabled={hasSchedule}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          hasSchedule
                            ? theme === 'dark' ? 'bg-green-500/10 border-green-500/30 cursor-not-allowed' : 'bg-green-50 border-green-200 cursor-not-allowed'
                            : isSelected
                              ? 'bg-purple-600 border-purple-600 text-white'
                              : theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-semibold text-lg ${isSelected ? 'text-white' : theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                              {ageGroup}
                            </p>
                            <p className={`text-sm ${isSelected ? 'text-purple-200' : theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                              {teams.length} teams
                            </p>
                          </div>
                          {hasSchedule ? (
                            <div className="flex items-center gap-1 text-green-500">
                              <CheckCircle2 className="w-5 h-5" />
                              <span className="text-xs font-medium">Scheduled</span>
                            </div>
                          ) : isSelected ? (
                            <Check className="w-5 h-5 text-white" />
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Selected Teams Preview */}
            {selectedAgeGroup && (
              <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-white'} border ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                <h3 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Teams in {selectedAgeGroup}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {teamsByAgeGroup[selectedAgeGroup]?.map(team => (
                    <div 
                      key={team.id}
                      className={`p-3 rounded-lg flex items-center gap-3 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        {team.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                          {team.name}
                        </p>
                        <p className={`text-xs truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                          {team.programName}
                        </p>
                      </div>
                      {team.homeField?.name ? (
                        <MapPin className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
                {teamsMissingHomeField.length > 0 && (
                  <p className="text-sm text-amber-500 mt-3">
                    ⚠️ {teamsMissingHomeField.length} teams missing home field - locations will need to be set manually
                  </p>
                )}
              </div>
            )}
            
            {/* Next Button */}
            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'} border`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {selectedAgeGroup ? `${selectedTeamIds.size} teams in ${selectedAgeGroup}` : 'Select an age group to continue'}
                  </p>
                </div>
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedAgeGroup || selectedTeamIds.size < 2}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2"
                >
                  Next: Configuration
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Step 2: Schedule Configuration */}
        {step === 2 && (
          <div className="space-y-6">
            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-white'} border ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
              <h2 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Schedule Configuration
              </h2>
              
              <div className="space-y-6">
                {/* Season Weeks */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    Season Length (weeks)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={scheduleConfig.seasonWeeks}
                    onChange={(e) => setScheduleConfig(prev => ({ ...prev, seasonWeeks: parseInt(e.target.value) || 6 }))}
                    className={`w-24 px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                  />
                </div>
                
                {/* Round Robin Type */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    Round Robin Type
                  </label>
                  <div className="flex gap-3">
                    {[
                      { value: 'single', label: 'Single', desc: 'Play each team once' },
                      { value: 'double', label: 'Double', desc: 'Home & away vs each team' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setScheduleConfig(prev => ({ ...prev, roundRobinType: opt.value as any }))}
                        className={`flex-1 p-3 rounded-lg border text-left ${
                          scheduleConfig.roundRobinType === opt.value
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <p className="font-medium">{opt.label}</p>
                        <p className={`text-xs ${scheduleConfig.roundRobinType === opt.value ? 'text-purple-200' : theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                          {opt.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Bye Configuration */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    Bye Week Configuration
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'none', label: 'No bye weeks', desc: 'Back-to-back games every week' },
                      { value: 'auto', label: 'Auto-calculate', desc: 'Add bye weeks to fit season length' },
                      { value: 'custom', label: 'Custom', desc: 'Specify number of bye weeks' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setScheduleConfig(prev => ({ ...prev, byeMode: opt.value as any }))}
                        className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 ${
                          scheduleConfig.byeMode === opt.value
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          scheduleConfig.byeMode === opt.value ? 'border-white bg-white' : 'border-current'
                        }`}>
                          {scheduleConfig.byeMode === opt.value && (
                            <div className="w-full h-full rounded-full bg-purple-600 scale-50" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{opt.label}</p>
                          <p className={`text-xs ${scheduleConfig.byeMode === opt.value ? 'text-purple-200' : theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {opt.desc}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  {scheduleConfig.byeMode === 'custom' && (
                    <div className="mt-3">
                      <label className={`block text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                        Number of bye weeks:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={scheduleConfig.byesPerTeam}
                        onChange={(e) => setScheduleConfig(prev => ({ ...prev, byesPerTeam: parseInt(e.target.value) || 1 }))}
                        className={`w-20 px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                      />
                      <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                        All teams rest during bye weeks (league-wide break)
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Schedule Summary */}
                {scheduleSummary && (
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'} border`}>
                    <h3 className={`font-medium mb-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
                      📊 Schedule Summary
                    </h3>
                    <div className={`grid grid-cols-2 gap-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      <div>Teams: <strong>{scheduleSummary.teamCount}</strong></div>
                      <div>Games per team: <strong>{scheduleSummary.gamesPerTeam}</strong></div>
                      <div>Total games: <strong>{scheduleSummary.totalGames}</strong></div>
                      <div>Total weeks: <strong>{scheduleSummary.weeksNeeded}</strong></div>
                      {scheduleSummary.configuredByes > 0 && (
                        <div className="col-span-2 text-green-500">
                          ✅ {scheduleSummary.configuredByes} league-wide bye week{scheduleSummary.configuredByes > 1 ? 's' : ''} (all teams rest)
                        </div>
                      )}
                      {scheduleSummary.hasOddTeams && (
                        <div className="col-span-2 text-amber-500">
                          ⚠️ Odd number of teams - 1 team has bye each round
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center gap-2"
              >
                Next: Field Setup
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* Step 3: Field Configuration */}
        {step === 3 && (
          <div className="space-y-6">
            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-white'} border ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
              <h2 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Field & Location Setup
              </h2>
              
              <div className="space-y-6">
                {/* Field Mode */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    How should game locations be assigned?
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'team-home', label: 'Use Team Home Fields', desc: 'Games at home team\'s field', icon: Home },
                      { value: 'league-central', label: 'Use League Central Fields', desc: 'All games at league-managed fields', icon: MapPin },
                      { value: 'mixed', label: 'Mixed (Recommended)', desc: 'Start with team fields, edit as needed', icon: Shuffle }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFieldConfig(prev => ({ ...prev, mode: opt.value as any }))}
                        className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 ${
                          fieldConfig.mode === opt.value
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <opt.icon className="w-5 h-5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium">{opt.label}</p>
                          <p className={`text-xs ${fieldConfig.mode === opt.value ? 'text-purple-200' : theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {opt.desc}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  {teamsMissingHomeField.length > 0 && fieldConfig.mode !== 'league-central' && (
                    <div className={`mt-3 p-3 rounded-lg ${theme === 'dark' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'} border`}>
                      <p className="text-sm text-amber-500">
                        ⚠️ {teamsMissingHomeField.length} teams missing home field:
                      </p>
                      <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                        {teamsMissingHomeField.map(t => t.name).join(', ')}
                      </p>
                      <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                        These games will need locations assigned manually.
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Game Days */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    Game Days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['Saturday', 'Sunday', 'Friday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'].map(day => (
                      <button
                        key={day}
                        onClick={() => {
                          setScheduleConfig(prev => ({
                            ...prev,
                            gameDays: prev.gameDays.includes(day)
                              ? prev.gameDays.filter(d => d !== day)
                              : [...prev.gameDays, day]
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                          scheduleConfig.gameDays.includes(day)
                            ? 'bg-purple-600 text-white'
                            : theme === 'dark' ? 'bg-white/10 text-slate-300 hover:bg-white/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Time Slots */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    Time Slots
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'].map(time => (
                      <button
                        key={time}
                        onClick={() => {
                          setScheduleConfig(prev => ({
                            ...prev,
                            timeSlots: prev.timeSlots.includes(time)
                              ? prev.timeSlots.filter(t => t !== time)
                              : [...prev.timeSlots, time].sort()
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                          scheduleConfig.timeSlots.includes(time)
                            ? 'bg-purple-600 text-white'
                            : theme === 'dark' ? 'bg-white/10 text-slate-300 hover:bg-white/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleGenerate}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-lg font-medium flex items-center gap-2"
              >
                <Shuffle className="w-4 h-4" />
                Generate Schedule
              </button>
            </div>
          </div>
        )}
        
        {/* Step 4: Review & Edit */}
        {step === 4 && (
          <div className="space-y-6">
            {/* Summary */}
            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'} border`}>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <div>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    ✅ {generatedGames.filter(g => !g.isBye).length} games generated
                  </p>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {generatedGames.filter(g => !g.location).length} games need location assigned
                  </p>
                </div>
              </div>
            </div>
            
            {/* Games by Week */}
            <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
              <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Review Schedule
                </h2>
              </div>
              
              <div className="divide-y divide-white/10">
                {Array.from(new Set(generatedGames.map(g => g.week))).sort((a, b) => a - b).map(week => {
                  const weekGames = generatedGames.filter(g => g.week === week);
                  const ageGroups = Array.from(new Set(weekGames.map(g => g.ageGroup || '').filter(ag => ag && ag !== '')));
                  const hasMultipleAgeGroups = ageGroups.length > 1;
                  
                  return (
                    <div key={week} className="p-4">
                      <h3 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        Week {week}
                      </h3>
                      
                      {/* Check for league bye week */}
                      {weekGames.some(g => g.byeTeamId === 'LEAGUE_BYE') ? (
                        <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
                          <div className="flex items-center gap-2 text-purple-400">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">🏖️ League Bye Week</span>
                            <span className="text-sm text-slate-400">- All teams rest</span>
                          </div>
                        </div>
                      ) : hasMultipleAgeGroups ? (
                        // Show games grouped by age group
                        <div className="space-y-4">
                          {ageGroups.sort().map(ageGroup => (
                            <div key={ageGroup}>
                              <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
                                {ageGroup}
                              </div>
                              <div className="space-y-2">
                                {weekGames.filter(g => g.ageGroup === ageGroup).map(game => (
                                  <div 
                                    key={game.id}
                                    className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}
                                  >
                                    {game.isBye ? (
                                      <div className="flex items-center gap-2 text-amber-500">
                                        <Clock className="w-4 h-4" />
                                        <span className="font-medium">{game.byeTeamName}</span>
                                        <span className="text-sm">- BYE</span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                              {game.homeTeamName}
                                            </span>
                                            <span className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>vs</span>
                                            <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                              {game.awayTeamName}
                                            </span>
                                          </div>
                                          <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                            {game.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} @ {game.time}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <MapPin className={`w-4 h-4 ${game.location ? 'text-green-500' : 'text-amber-500'}`} />
                                          <input
                                            type="text"
                                            value={game.location}
                                            onChange={(e) => updateGameLocation(game.id, e.target.value)}
                                            placeholder="Enter location..."
                                            className={`flex-1 sm:w-48 px-2 py-1 rounded text-sm ${
                                              theme === 'dark' 
                                                ? 'bg-white/10 border-white/10 text-white placeholder-slate-500' 
                                                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                                            } border`}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        // Single age group or no age group - show flat list
                        <div className="space-y-2">
                          {weekGames.map(game => (
                            <div 
                              key={game.id}
                              className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}
                            >
                              {game.isBye ? (
                                <div className="flex items-center gap-2 text-amber-500">
                                  <Clock className="w-4 h-4" />
                                  <span className="font-medium">{game.byeTeamName}</span>
                                  <span className="text-sm">- BYE</span>
                                </div>
                              ) : (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                        {game.homeTeamName}
                                      </span>
                                      <span className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>vs</span>
                                      <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                        {game.awayTeamName}
                                      </span>
                                      {game.ageGroup && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                                          {game.ageGroup}
                                        </span>
                                      )}
                                    </div>
                                    <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                      {game.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} @ {game.time}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <MapPin className={`w-4 h-4 ${game.location ? 'text-green-500' : 'text-amber-500'}`} />
                                    <input
                                      type="text"
                                      value={game.location}
                                      onChange={(e) => updateGameLocation(game.id, e.target.value)}
                                      placeholder="Enter location..."
                                      className={`flex-1 sm:w-48 px-2 py-1 rounded text-sm ${
                                        theme === 'dark' 
                                          ? 'bg-white/10 border-white/10 text-white placeholder-slate-500' 
                                          : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                                      } border`}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(3)}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Draft
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Publish Schedule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
