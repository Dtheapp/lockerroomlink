import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { collection, query, where, getDocs, orderBy, documentId } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { LeagueSeason, LeagueSchedule, LeagueGame, Team, Program } from '../../types';
import { ChevronLeft, Trophy, Medal, TrendingUp, TrendingDown, Minus, Users, Loader2, AlertCircle, Filter, Award, Info, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TeamStanding {
  teamId: string;
  teamName: string;
  teamLogo?: string;
  programName: string;
  ageGroup: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  winPercentage: number;
  streak: string;
  lastFive: ('W' | 'L' | 'T')[];
  headToHead: Record<string, { wins: number; losses: number; ties: number }>;
}

// Standard tiebreaker rules used in youth sports leagues
const TIEBREAKER_RULES = [
  { order: 1, rule: 'Win Percentage', description: 'Teams are first ranked by overall win percentage (wins + 0.5×ties / total games)' },
  { order: 2, rule: 'Head-to-Head Record', description: 'If tied, the team with the better record against the other tied team(s) ranks higher' },
  { order: 3, rule: 'Point Differential', description: 'If still tied, the team with the higher point differential (PF - PA) ranks higher' },
  { order: 4, rule: 'Points Allowed', description: 'If still tied, the team that allowed fewer points (better defense) ranks higher' },
  { order: 5, rule: 'Points Scored', description: 'If still tied, the team that scored more points (better offense) ranks higher' },
];

export default function LeagueStandings() {
  const { leagueData, user } = useAuth();
  const { theme } = useTheme();
  
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProgram, setFilterProgram] = useState<string>('all');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('all');
  const [showTiebreakers, setShowTiebreakers] = useState(false);

  // Get unique age groups from teams
  const ageGroups = useMemo(() => {
    const groups = new Set<string>();
    teams.forEach(t => {
      if (t.ageGroup) groups.add(t.ageGroup);
    });
    // Sort age groups naturally (6U, 8U, 10U, 12U, etc.)
    return Array.from(groups).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [teams]);

  // Auto-select first age group when age groups are loaded
  useEffect(() => {
    if (ageGroups.length > 0 && selectedAgeGroup === 'all') {
      setSelectedAgeGroup(ageGroups[0]);
    }
  }, [ageGroups]);

  useEffect(() => {
    loadData();
  }, [leagueData]);

  useEffect(() => {
    if (selectedSeasonId && teams.length > 0) {
      calculateStandings(selectedSeasonId);
    }
  }, [selectedSeasonId, teams, programs]);

  const loadData = async () => {
    if (!leagueData) return;

    try {
      // Load seasons
      const seasonsQuery = query(
        collection(db, 'leagueSeasons'),
        where('leagueId', '==', leagueData.id)
      );
      const seasonsSnap = await getDocs(seasonsQuery);
      const seasonsList = seasonsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeagueSeason[];
      
      setSeasons(seasonsList);
      
      // Auto-select active season
      const activeSeason = seasonsList.find(s => s.status === 'active') || seasonsList[0];
      if (activeSeason) {
        setSelectedSeasonId(activeSeason.id);
      }

      // Load teams that are IN this league (have leagueId set)
      const teamsQuery = query(
        collection(db, 'teams'),
        where('leagueId', '==', leagueData.id)
      );
      const teamsSnap = await getDocs(teamsQuery);
      const teamsList = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
      setTeams(teamsList);

      // Load programs for these teams (get unique programIds)
      const programIds = [...new Set(teamsList.map(t => t.programId).filter(Boolean))];
      let programsList: Program[] = [];
      
      if (programIds.length > 0) {
        // Firestore 'in' queries are limited to 10 items, so chunk if needed
        const chunks = [];
        for (let i = 0; i < programIds.length; i += 10) {
          chunks.push(programIds.slice(i, i + 10));
        }
        
        for (const chunk of chunks) {
          const programsQuery = query(
            collection(db, 'programs'),
            where(documentId(), 'in', chunk)
          );
          const programsSnap = await getDocs(programsQuery);
          programsList.push(...programsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Program)));
        }
      }
      setPrograms(programsList);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStandings = async (seasonId: string) => {
    if (teams.length === 0) {
      setStandings([]);
      return;
    }

    try {
      // Load all games for this season
      const scheduleQuery = query(
        collection(db, 'leagueSchedules'),
        where('seasonId', '==', seasonId)
      );
      const scheduleSnap = await getDocs(scheduleQuery);
      
      const allGames: LeagueGame[] = [];
      scheduleSnap.docs.forEach(doc => {
        const schedule = doc.data() as LeagueSchedule;
        if (schedule.games) {
          allGames.push(...schedule.games);
        }
      });

      // Calculate standings for each team
      const teamStats: Record<string, TeamStanding> = {};
      
      // Get league sport for sport-specific name lookup
      const leagueSport = leagueData?.sport || '';
      
      // Initialize all teams
      teams.forEach(team => {
        const program = programs.find(p => p.id === team.programId);
        // Use sport-specific name (e.g., 'CYFA') if available, otherwise fall back to org name
        const sportSpecificName = program?.sportNames?.[leagueSport] || program?.name || 'Unknown';
        teamStats[team.id] = {
          teamId: team.id,
          teamName: team.name,
          teamLogo: team.logo,
          programName: sportSpecificName,
          ageGroup: team.ageGroup || 'Unknown',
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          winPercentage: 0,
          streak: '-',
          lastFive: [],
          headToHead: {}
        };
      });

      // Process completed games
      const completedGames = allGames
        .filter(g => g.status === 'completed')
        .sort((a, b) => {
          const dateA = (a.dateTime as any)?.toDate?.() || new Date(a.dateTime as any);
          const dateB = (b.dateTime as any)?.toDate?.() || new Date(b.dateTime as any);
          return dateA.getTime() - dateB.getTime();
        });

      completedGames.forEach(game => {
        const homeTeam = teamStats[game.homeTeamId];
        const awayTeam = teamStats[game.awayTeamId];
        
        if (!homeTeam || !awayTeam) return;

        // Update points
        homeTeam.pointsFor += game.homeScore || 0;
        homeTeam.pointsAgainst += game.awayScore || 0;
        awayTeam.pointsFor += game.awayScore || 0;
        awayTeam.pointsAgainst += game.homeScore || 0;

        // Initialize head-to-head records if needed
        if (!homeTeam.headToHead[game.awayTeamId]) {
          homeTeam.headToHead[game.awayTeamId] = { wins: 0, losses: 0, ties: 0 };
        }
        if (!awayTeam.headToHead[game.homeTeamId]) {
          awayTeam.headToHead[game.homeTeamId] = { wins: 0, losses: 0, ties: 0 };
        }

        // Determine winner
        if ((game.homeScore || 0) > (game.awayScore || 0)) {
          homeTeam.wins++;
          awayTeam.losses++;
          homeTeam.lastFive.push('W');
          awayTeam.lastFive.push('L');
          homeTeam.headToHead[game.awayTeamId].wins++;
          awayTeam.headToHead[game.homeTeamId].losses++;
        } else if ((game.awayScore || 0) > (game.homeScore || 0)) {
          awayTeam.wins++;
          homeTeam.losses++;
          awayTeam.lastFive.push('W');
          homeTeam.lastFive.push('L');
          awayTeam.headToHead[game.homeTeamId].wins++;
          homeTeam.headToHead[game.awayTeamId].losses++;
        } else {
          homeTeam.ties++;
          awayTeam.ties++;
          homeTeam.lastFive.push('T');
          awayTeam.lastFive.push('T');
          homeTeam.headToHead[game.awayTeamId].ties++;
          awayTeam.headToHead[game.homeTeamId].ties++;
        }
      });

      // Calculate win percentage and streak
      Object.values(teamStats).forEach(team => {
        const totalGames = team.wins + team.losses + team.ties;
        team.winPercentage = totalGames > 0 
          ? (team.wins + team.ties * 0.5) / totalGames 
          : 0;
        
        // Keep only last 5
        team.lastFive = team.lastFive.slice(-5);
        
        // Calculate streak
        if (team.lastFive.length > 0) {
          let streak = 1;
          const lastResult = team.lastFive[team.lastFive.length - 1];
          for (let i = team.lastFive.length - 2; i >= 0; i--) {
            if (team.lastFive[i] === lastResult) {
              streak++;
            } else {
              break;
            }
          }
          team.streak = `${lastResult}${streak}`;
        }
      });

      // Sort standings with tiebreakers
      const sortedStandings = Object.values(teamStats).sort((a, b) => {
        // 1. Win percentage
        if (Math.abs(b.winPercentage - a.winPercentage) > 0.0001) {
          return b.winPercentage - a.winPercentage;
        }
        
        // 2. Head-to-head record
        const aVsB = a.headToHead[b.teamId];
        const bVsA = b.headToHead[a.teamId];
        if (aVsB && bVsA) {
          const aH2HWinPct = aVsB.wins + aVsB.losses + aVsB.ties > 0
            ? (aVsB.wins + aVsB.ties * 0.5) / (aVsB.wins + aVsB.losses + aVsB.ties)
            : 0;
          const bH2HWinPct = bVsA.wins + bVsA.losses + bVsA.ties > 0
            ? (bVsA.wins + bVsA.ties * 0.5) / (bVsA.wins + bVsA.losses + bVsA.ties)
            : 0;
          if (Math.abs(aH2HWinPct - bH2HWinPct) > 0.0001) {
            return bH2HWinPct - aH2HWinPct;
          }
        }
        
        // 3. Point differential
        const aDiff = a.pointsFor - a.pointsAgainst;
        const bDiff = b.pointsFor - b.pointsAgainst;
        if (bDiff !== aDiff) return bDiff - aDiff;
        
        // 4. Points allowed (fewer is better)
        if (a.pointsAgainst !== b.pointsAgainst) return a.pointsAgainst - b.pointsAgainst;
        
        // 5. Points scored (more is better)
        return b.pointsFor - a.pointsFor;
      });

      setStandings(sortedStandings);
    } catch (error) {
      console.error('Error calculating standings:', error);
    }
  };

  // Filter standings by age group and program
  const filteredStandings = useMemo(() => {
    let result = standings;
    
    // Filter by age group (if not "all")
    if (selectedAgeGroup !== 'all') {
      result = result.filter(s => s.ageGroup === selectedAgeGroup);
    }
    
    // Filter by program
    if (filterProgram !== 'all') {
      result = result.filter(s => {
        const team = teams.find(t => t.id === s.teamId);
        return team?.programId === filterProgram;
      });
    }
    
    return result;
  }, [standings, selectedAgeGroup, filterProgram, teams]);

  const getStreakColor = (streak: string) => {
    if (streak.startsWith('W')) return 'text-green-400';
    if (streak.startsWith('L')) return 'text-red-400';
    return 'text-gray-400';
  };

  const getResultColor = (result: 'W' | 'L' | 'T') => {
    switch (result) {
      case 'W': return 'bg-green-500';
      case 'L': return 'bg-red-500';
      case 'T': return 'bg-gray-500';
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-300" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center font-bold text-gray-500">{rank}</span>;
    }
  };

  if (!leagueData) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <AlertCircle className="w-16 h-16 text-red-500" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${
      theme === 'dark' ? 'bg-zinc-900 text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Header */}
      <div className={`border-b ${
        theme === 'dark' 
          ? 'bg-black/40 border-white/10' 
          : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Link to="/league" className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
              }`}>
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className={`text-xl font-bold flex items-center gap-2 ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Standings
                </h1>
                <p className={theme === 'dark' ? 'text-sm text-slate-400' : 'text-sm text-slate-600'}>{leagueData.name}</p>
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                className={`rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                  theme === 'dark'
                    ? 'bg-zinc-800 border border-white/10 text-white [&>option]:bg-zinc-800 [&>option]:text-white'
                    : 'bg-white border border-slate-200 text-slate-900'
                }`}
              >
                {seasons.map(season => (
                  <option key={season.id} value={season.id}>{season.name}</option>
                ))}
              </select>
              
              <select
                value={filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
                className={`rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                  theme === 'dark'
                    ? 'bg-zinc-800 border border-white/10 text-white [&>option]:bg-zinc-800 [&>option]:text-white'
                    : 'bg-white border border-slate-200 text-slate-900'
                }`}
              >
                <option value="all">All Programs</option>
                {programs.map(program => {
                  const leagueSport = leagueData?.sport || '';
                  const displayName = program.sportNames?.[leagueSport] || program.name;
                  return (
                    <option key={program.id} value={program.id}>{displayName}</option>
                  );
                })}
              </select>

              <button
                onClick={() => setShowTiebreakers(!showTiebreakers)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                }`}
              >
                <Scale className="w-4 h-4" />
                <span className="hidden sm:inline">Tiebreakers</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Age Group Tabs */}
      {ageGroups.length > 0 && (
        <div className={`border-b ${
          theme === 'dark' ? 'border-white/10' : 'border-slate-200'
        }`}>
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                {ageGroups.map(ageGroup => {
                  const count = standings.filter(s => s.ageGroup === ageGroup).length;
                  return (
                    <button
                      key={ageGroup}
                      onClick={() => setSelectedAgeGroup(ageGroup)}
                      className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
                        selectedAgeGroup === ageGroup
                          ? theme === 'dark'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                            : 'bg-purple-600 text-white shadow-md'
                          : theme === 'dark'
                            ? 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {ageGroup}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        selectedAgeGroup === ageGroup
                          ? 'bg-white/20 text-white'
                          : theme === 'dark'
                            ? 'bg-white/10 text-slate-400'
                            : 'bg-slate-200 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tiebreaker Rules Panel */}
        {showTiebreakers && (
          <div className={`mb-4 rounded-xl p-4 border ${
            theme === 'dark'
              ? 'bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-white/10'
              : 'bg-gradient-to-br from-purple-50 to-blue-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-purple-400" />
              <h3 className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>How Standings Are Determined</h3>
            </div>
            <p className={`text-sm mb-4 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              When teams have identical records, the following tiebreakers are applied in order:
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TIEBREAKER_RULES.map(rule => (
                <div key={rule.order} className="flex gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    theme === 'dark'
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30'
                      : 'bg-purple-100 text-purple-700 border border-purple-200'
                  }`}>
                    {rule.order}
                  </div>
                  <div>
                    <span className={`font-medium text-sm ${
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}>{rule.rule}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {teams.length === 0 ? (
          <div className={`text-center py-12 rounded-2xl border ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10' 
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <Users className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
            }`} />
            <h3 className={`text-lg font-medium ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>No Teams in League Yet</h3>
            <p className={`mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
              Teams need to be added to the league to show standings
            </p>
          </div>
        ) : seasons.length === 0 ? (
          <div className={`text-center py-12 rounded-2xl border ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10' 
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <Trophy className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
            }`} />
            <h3 className={`text-lg font-medium ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>No Seasons Available</h3>
            <p className={`mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Create a season and schedule games to see standings</p>
          </div>
        ) : filteredStandings.length === 0 ? (
          <div className={`text-center py-12 rounded-2xl border ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10' 
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <Users className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
            }`} />
            <h3 className={`text-lg font-medium ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>No Teams in {selectedAgeGroup}</h3>
            <p className={`mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
              {filterProgram !== 'all' 
                ? 'Try selecting a different program or age group' 
                : 'No teams have been added to this age group yet'}
            </p>
          </div>
        ) : (
          <div className={`rounded-2xl border overflow-hidden ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10' 
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}>
                  <tr>
                    <th className={`text-left py-3 px-4 text-sm font-medium w-12 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>#</th>
                    <th className={`text-left py-3 px-4 text-sm font-medium ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>Team</th>
                    <th className={`text-center py-3 px-4 text-sm font-medium w-12 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>W</th>
                    <th className={`text-center py-3 px-4 text-sm font-medium w-12 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>L</th>
                    <th className={`text-center py-3 px-4 text-sm font-medium w-12 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>T</th>
                    <th className={`text-center py-3 px-4 text-sm font-medium w-16 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>PCT</th>
                    <th className={`text-center py-3 px-4 text-sm font-medium w-16 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>PF</th>
                    <th className={`text-center py-3 px-4 text-sm font-medium w-16 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>PA</th>
                    <th className={`text-center py-3 px-4 text-sm font-medium w-16 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>DIFF</th>
                    <th className={`text-center py-3 px-4 text-sm font-medium w-16 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>STK</th>
                    <th className={`text-center py-3 px-4 text-sm font-medium w-24 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>Last 5</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${
                  theme === 'dark' ? 'divide-white/10' : 'divide-slate-100'
                }`}>
                  {filteredStandings.map((standing, index) => {
                    const pointDiff = standing.pointsFor - standing.pointsAgainst;
                    
                    return (
                      <tr key={standing.teamId} className={`transition-colors ${
                        theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                      }`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center">
                            {getRankBadge(index + 1)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {standing.teamLogo ? (
                              <img 
                                src={standing.teamLogo} 
                                alt={standing.teamName}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'
                              }`}>
                                <span className={`text-xs font-bold ${
                                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                                }`}>
                                  {standing.teamName.substring(0, 2).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div>
                              <div className={`font-medium ${
                                theme === 'dark' ? 'text-white' : 'text-slate-900'
                              }`}>{standing.teamName}</div>
                              <div className={`text-xs ${
                                theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
                              }`}>{standing.programName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-green-400">{standing.wins}</td>
                        <td className="py-3 px-4 text-center font-bold text-red-400">{standing.losses}</td>
                        <td className={`py-3 px-4 text-center font-bold ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                        }`}>{standing.ties}</td>
                        <td className={`py-3 px-4 text-center font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        }`}>
                          {standing.winPercentage.toFixed(3)}
                        </td>
                        <td className={`py-3 px-4 text-center ${
                          theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
                        }`}>{standing.pointsFor}</td>
                        <td className={`py-3 px-4 text-center ${
                          theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
                        }`}>{standing.pointsAgainst}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-medium ${pointDiff > 0 ? 'text-green-400' : pointDiff < 0 ? 'text-red-400' : theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {pointDiff > 0 ? '+' : ''}{pointDiff}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-center font-bold ${getStreakColor(standing.streak)}`}>
                          {standing.streak}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            {standing.lastFive.map((result, i) => (
                              <div
                                key={i}
                                className={`w-5 h-5 rounded-full ${getResultColor(result)} flex items-center justify-center text-xs font-bold text-white`}
                              >
                                {result}
                              </div>
                            ))}
                            {standing.lastFive.length === 0 && (
                              <span className={`text-sm ${
                                theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                              }`}>-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className={`mt-4 flex flex-wrap items-center gap-6 text-sm ${
          theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
        }`}>
          <span>W = Wins</span>
          <span>L = Losses</span>
          <span>T = Ties</span>
          <span>PCT = Win Percentage</span>
          <span>PF = Points For</span>
          <span>PA = Points Against</span>
          <span>DIFF = Point Differential</span>
          <span>STK = Streak</span>
        </div>
      </div>
    </div>
  );
}
