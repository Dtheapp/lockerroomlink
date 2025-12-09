import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { LeagueSeason, LeagueSchedule, LeagueGame, Team, Program } from '../../types';
import { ChevronLeft, Trophy, Medal, TrendingUp, TrendingDown, Minus, Users, Loader2, AlertCircle, Filter, Award } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TeamStanding {
  teamId: string;
  teamName: string;
  programName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  winPercentage: number;
  streak: string;
  lastFive: ('W' | 'L' | 'T')[];
}

export default function LeagueStandings() {
  const { leagueData, user } = useAuth();
  
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProgram, setFilterProgram] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [leagueData]);

  useEffect(() => {
    if (selectedSeasonId) {
      calculateStandings(selectedSeasonId);
    }
  }, [selectedSeasonId, teams]);

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

      // Load programs
      const programsQuery = query(
        collection(db, 'programs'),
        where('leagueId', '==', leagueData.id)
      );
      const programsSnap = await getDocs(programsQuery);
      const programsList = programsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Program));
      setPrograms(programsList);
      const programIds = programsList.map(p => p.id);

      // Load teams
      if (programIds.length > 0) {
        const teamsQuery = query(
          collection(db, 'teams'),
          where('programId', 'in', programIds.slice(0, 10))
        );
        const teamsSnap = await getDocs(teamsQuery);
        setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStandings = async (seasonId: string) => {
    if (teams.length === 0) return;

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
      
      // Initialize all teams
      teams.forEach(team => {
        const program = programs.find(p => p.id === team.programId);
        teamStats[team.id] = {
          teamId: team.id,
          teamName: team.name,
          programName: program?.name || 'Unknown',
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          winPercentage: 0,
          streak: '-',
          lastFive: []
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

        // Determine winner
        if ((game.homeScore || 0) > (game.awayScore || 0)) {
          homeTeam.wins++;
          awayTeam.losses++;
          homeTeam.lastFive.push('W');
          awayTeam.lastFive.push('L');
        } else if ((game.awayScore || 0) > (game.homeScore || 0)) {
          awayTeam.wins++;
          homeTeam.losses++;
          awayTeam.lastFive.push('W');
          homeTeam.lastFive.push('L');
        } else {
          homeTeam.ties++;
          awayTeam.ties++;
          homeTeam.lastFive.push('T');
          awayTeam.lastFive.push('T');
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

      // Sort standings
      const sortedStandings = Object.values(teamStats).sort((a, b) => {
        // First by win percentage
        if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
        // Then by wins
        if (b.wins !== a.wins) return b.wins - a.wins;
        // Then by point differential
        const aDiff = a.pointsFor - a.pointsAgainst;
        const bDiff = b.pointsFor - b.pointsAgainst;
        return bDiff - aDiff;
      });

      setStandings(sortedStandings);
    } catch (error) {
      console.error('Error calculating standings:', error);
    }
  };

  const filteredStandings = filterProgram === 'all'
    ? standings
    : standings.filter(s => {
        const team = teams.find(t => t.id === s.teamId);
        return team?.programId === filterProgram;
      });

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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <AlertCircle className="w-16 h-16 text-red-500" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/league" className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Standings
                </h1>
                <p className="text-sm text-gray-400">{leagueData.name}</p>
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex items-center gap-3">
              <select
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              >
                {seasons.map(season => (
                  <option key={season.id} value={season.id}>{season.name}</option>
                ))}
              </select>
              
              <select
                value={filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              >
                <option value="all">All Programs</option>
                {programs.map(program => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {seasons.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
            <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400">No Seasons Available</h3>
            <p className="text-gray-500 mt-2">Create a season and schedule games to see standings</p>
          </div>
        ) : filteredStandings.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400">No Teams Found</h3>
            <p className="text-gray-500 mt-2">
              {filterProgram !== 'all' ? 'Try selecting a different program' : 'Add teams to your league to see standings'}
            </p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-750">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 w-12">#</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Team</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400 w-12">W</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400 w-12">L</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400 w-12">T</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400 w-16">PCT</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400 w-16">PF</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400 w-16">PA</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400 w-16">DIFF</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400 w-16">STK</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400 w-24">Last 5</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredStandings.map((standing, index) => {
                    const pointDiff = standing.pointsFor - standing.pointsAgainst;
                    
                    return (
                      <tr key={standing.teamId} className="hover:bg-gray-750 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center">
                            {getRankBadge(index + 1)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium">{standing.teamName}</div>
                            <div className="text-xs text-gray-500">{standing.programName}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-green-400">{standing.wins}</td>
                        <td className="py-3 px-4 text-center font-bold text-red-400">{standing.losses}</td>
                        <td className="py-3 px-4 text-center font-bold text-gray-400">{standing.ties}</td>
                        <td className="py-3 px-4 text-center font-medium">
                          {standing.winPercentage.toFixed(3)}
                        </td>
                        <td className="py-3 px-4 text-center">{standing.pointsFor}</td>
                        <td className="py-3 px-4 text-center">{standing.pointsAgainst}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-medium ${pointDiff > 0 ? 'text-green-400' : pointDiff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
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
                                className={`w-5 h-5 rounded-full ${getResultColor(result)} flex items-center justify-center text-xs font-bold`}
                              >
                                {result}
                              </div>
                            ))}
                            {standing.lastFive.length === 0 && (
                              <span className="text-gray-500 text-sm">-</span>
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
        <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-gray-500">
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
