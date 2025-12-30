/**
 * Public League Page Component
 * Publicly accessible page showing league standings, schedules, teams, and brackets
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { League, LeagueSeason, LeagueSchedule, LeagueGame, PlayoffBracket, Team, Program } from '../../types';
import { 
  Trophy, Calendar, Users, MapPin, Clock, ChevronRight, 
  Building2, Shield, Award, Medal, Crown, Play, 
  CheckCircle, Loader2, AlertCircle, ExternalLink
} from 'lucide-react';

type TabType = 'standings' | 'schedule' | 'teams' | 'playoffs' | 'scores';

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
}

export default function PublicLeaguePage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  
  const [league, setLeague] = useState<League | null>(null);
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [games, setGames] = useState<LeagueGame[]>([]);
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [bracket, setBracket] = useState<PlayoffBracket | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('standings');

  useEffect(() => {
    if (leagueId) loadLeagueData();
  }, [leagueId]);

  useEffect(() => {
    if (selectedSeasonId) {
      loadSeasonData(selectedSeasonId);
    }
  }, [selectedSeasonId]);

  const loadLeagueData = async () => {
    if (!leagueId) return;

    try {
      let leagueData: League | null = null;

      // First try to load by document ID
      const leagueDoc = await getDoc(doc(db, 'leagues', leagueId));
      if (leagueDoc.exists()) {
        leagueData = { id: leagueDoc.id, ...leagueDoc.data() } as League;
      } else {
        // If not found by ID, try to find by username
        const usernameQuery = query(
          collection(db, 'leagues'),
          where('username', '==', leagueId)
        );
        const usernameSnap = await getDocs(usernameQuery);
        if (!usernameSnap.empty) {
          const doc = usernameSnap.docs[0];
          leagueData = { id: doc.id, ...doc.data() } as League;
        }
      }

      if (!leagueData) {
        setLoading(false);
        return;
      }
      setLeague(leagueData);

      // Use the actual league ID for subsequent queries
      const actualLeagueId = leagueData.id!;

      // Check if league allows public view
      if ((leagueData as any).publicProfile === false) {
        setLoading(false);
        return;
      }

      // Load seasons
      const seasonsQuery = query(
        collection(db, 'leagueSeasons'),
        where('leagueId', '==', actualLeagueId),
        orderBy('startDate', 'desc')
      );
      const seasonsSnap = await getDocs(seasonsQuery);
      const seasonsList = seasonsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LeagueSeason));
      setSeasons(seasonsList);

      // Select active or most recent season
      const activeSeason = seasonsList.find(s => s.status === 'active' || s.status === 'playoffs') || seasonsList[0];
      if (activeSeason) {
        setSelectedSeasonId(activeSeason.id);
      }

      // Load programs and teams
      const programsQuery = query(
        collection(db, 'programs'),
        where('leagueId', '==', actualLeagueId)
      );
      const programsSnap = await getDocs(programsQuery);
      const programsList = programsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Program));
      setPrograms(programsList);

      const programIds = programsList.map(p => p.id!);
      if (programIds.length > 0) {
        // Firestore 'in' query limited to 10
        const teamsQuery = query(
          collection(db, 'teams'),
          where('programId', 'in', programIds.slice(0, 10))
        );
        const teamsSnap = await getDocs(teamsQuery);
        setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
      }

    } catch (error) {
      console.error('Error loading league:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSeasonData = async (seasonId: string) => {
    if (!leagueId) return;

    try {
      // Load schedule/games
      const schedulesQuery = query(
        collection(db, 'leagueSchedules'),
        where('seasonId', '==', seasonId)
      );
      const schedulesSnap = await getDocs(schedulesQuery);
      
      const allGames: LeagueGame[] = [];
      schedulesSnap.docs.forEach(doc => {
        const schedule = doc.data() as LeagueSchedule;
        if (schedule.games) {
          allGames.push(...schedule.games);
        }
      });
      
      // Sort by date
      allGames.sort((a, b) => {
        const dateA = a.scheduledDate instanceof Timestamp ? a.scheduledDate.toDate() : new Date(a.scheduledDate as any);
        const dateB = b.scheduledDate instanceof Timestamp ? b.scheduledDate.toDate() : new Date(b.scheduledDate as any);
        return dateA.getTime() - dateB.getTime();
      });
      setGames(allGames);

      // Calculate standings
      calculateStandings(allGames);

      // Load bracket if exists
      const bracketQuery = query(
        collection(db, 'playoffBrackets'),
        where('seasonId', '==', seasonId)
      );
      const bracketSnap = await getDocs(bracketQuery);
      if (!bracketSnap.empty) {
        setBracket({ id: bracketSnap.docs[0].id, ...bracketSnap.docs[0].data() } as PlayoffBracket);
      } else {
        setBracket(null);
      }
    } catch (error) {
      console.error('Error loading season data:', error);
    }
  };

  const calculateStandings = (gamesList: LeagueGame[]) => {
    const teamStats: Record<string, TeamStanding> = {};
    
    // Initialize
    teams.forEach(team => {
      const program = programs.find(p => p.id === team.programId);
      teamStats[team.id!] = {
        teamId: team.id!,
        teamName: team.name,
        programName: program?.name || '',
        wins: 0, losses: 0, ties: 0,
        pointsFor: 0, pointsAgainst: 0,
        winPercentage: 0
      };
    });

    // Process completed games
    gamesList.filter(g => g.status === 'completed').forEach(game => {
      const home = teamStats[game.homeTeamId];
      const away = teamStats[game.awayTeamId];
      if (!home || !away) return;

      home.pointsFor += game.homeScore || 0;
      home.pointsAgainst += game.awayScore || 0;
      away.pointsFor += game.awayScore || 0;
      away.pointsAgainst += game.homeScore || 0;

      if ((game.homeScore || 0) > (game.awayScore || 0)) {
        home.wins++; away.losses++;
      } else if ((game.awayScore || 0) > (game.homeScore || 0)) {
        away.wins++; home.losses++;
      } else {
        home.ties++; away.ties++;
      }
    });

    // Calculate win percentage
    Object.values(teamStats).forEach(team => {
      const total = team.wins + team.losses + team.ties;
      team.winPercentage = total > 0 ? (team.wins + team.ties * 0.5) / total : 0;
    });

    // Sort by win percentage, then wins
    const sorted = Object.values(teamStats).sort((a, b) => {
      if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
      return b.wins - a.wins;
    });

    setStandings(sorted);
  };

  const formatGameDate = (scheduledDate: any, scheduledTime?: string) => {
    const date = scheduledDate instanceof Timestamp ? scheduledDate.toDate() : new Date(scheduledDate);
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: scheduledTime || date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      isPast: date < new Date()
    };
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-5 h-5 text-yellow-400" />;
      case 2: return <Medal className="w-5 h-5 text-gray-300" />;
      case 3: return <Award className="w-5 h-5 text-amber-600" />;
      default: return <span className="w-5 text-center font-bold text-gray-500">{rank}</span>;
    }
  };

  const recentScores = games.filter(g => g.status === 'completed').slice(-10).reverse();
  const upcomingGames = games.filter(g => g.status === 'scheduled').slice(0, 10);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white">League Not Found</h2>
          <p className="text-gray-400 mt-2">This league doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  if ((league as any).publicProfile === false) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white">Private League</h2>
          <p className="text-gray-400 mt-2">This league profile is not public.</p>
        </div>
      </div>
    );
  }

  const selectedSeason = seasons.find(s => s.id === selectedSeasonId);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{league.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-gray-400">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {league.city}, {league.state}
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  {league.sport?.charAt(0).toUpperCase() + league.sport?.slice(1)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {teams.length} Teams
                </span>
              </div>
            </div>
            
            {/* Season Selector */}
            {seasons.length > 0 && (
              <select
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                {seasons.map(season => (
                  <option key={season.id} value={season.id}>
                    {season.name} {season.status === 'active' ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'standings', label: 'Standings', icon: Trophy },
              { id: 'schedule', label: 'Schedule', icon: Calendar },
              { id: 'scores', label: 'Scores', icon: CheckCircle },
              { id: 'teams', label: 'Teams', icon: Users },
              { id: 'playoffs', label: 'Playoffs', icon: Award },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Standings Tab */}
        {activeTab === 'standings' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700">
              <h2 className="font-semibold text-lg">
                {selectedSeason?.name || 'Season'} Standings
              </h2>
            </div>
            {standings.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No standings data available yet
              </div>
            ) : (
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {standings.map((team, index) => (
                      <tr key={team.teamId} className="hover:bg-gray-750">
                        <td className="py-3 px-4">
                          <div className="flex justify-center">{getRankBadge(index + 1)}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium">{team.teamName}</div>
                          <div className="text-xs text-gray-500">{team.programName}</div>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-green-400">{team.wins}</td>
                        <td className="py-3 px-4 text-center font-bold text-red-400">{team.losses}</td>
                        <td className="py-3 px-4 text-center text-gray-400">{team.ties}</td>
                        <td className="py-3 px-4 text-center">{team.winPercentage.toFixed(3)}</td>
                        <td className="py-3 px-4 text-center">{team.pointsFor}</td>
                        <td className="py-3 px-4 text-center">{team.pointsAgainst}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Upcoming Games</h2>
            {upcomingGames.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400 border border-gray-700">
                No upcoming games scheduled
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingGames.map((game, idx) => {
                  const { date, time } = formatGameDate(game.scheduledDate, game.scheduledTime);
                  const homeTeam = teams.find(t => t.id === game.homeTeamId);
                  const awayTeam = teams.find(t => t.id === game.awayTeamId);
                  
                  return (
                    <div key={idx} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[80px]">
                            <div className="text-sm text-gray-500">{date}</div>
                            <div className="font-medium text-blue-400">{time}</div>
                          </div>
                          <div className="h-10 w-px bg-gray-700" />
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{homeTeam?.name || 'TBD'}</span>
                            <span className="text-gray-500">vs</span>
                            <span className="font-medium">{awayTeam?.name || 'TBD'}</span>
                          </div>
                        </div>
                        {game.location && (
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {game.location}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Scores Tab */}
        {activeTab === 'scores' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Recent Scores</h2>
            {recentScores.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400 border border-gray-700">
                No completed games yet
              </div>
            ) : (
              <div className="space-y-3">
                {recentScores.map((game, idx) => {
                  const { date } = formatGameDate(game.scheduledDate);
                  const homeTeam = teams.find(t => t.id === game.homeTeamId);
                  const awayTeam = teams.find(t => t.id === game.awayTeamId);
                  const homeWon = (game.homeScore || 0) > (game.awayScore || 0);
                  const awayWon = (game.awayScore || 0) > (game.homeScore || 0);
                  
                  return (
                    <div key={idx} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                      <div className="text-sm text-gray-500 mb-2">{date} • Final</div>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className={`flex items-center justify-between py-1 ${homeWon ? 'font-bold' : ''}`}>
                            <span>{homeTeam?.name || 'TBD'}</span>
                            <span className="text-xl font-bold">{game.homeScore}</span>
                          </div>
                          <div className={`flex items-center justify-between py-1 ${awayWon ? 'font-bold' : ''}`}>
                            <span>{awayTeam?.name || 'TBD'}</span>
                            <span className="text-xl font-bold">{game.awayScore}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.length === 0 ? (
              <div className="col-span-full bg-gray-800 rounded-xl p-8 text-center text-gray-400 border border-gray-700">
                No teams in this league yet
              </div>
            ) : (
              teams.map(team => {
                const program = programs.find(p => p.id === team.programId);
                const teamStanding = standings.find(s => s.teamId === team.id);
                
                return (
                  <div key={team.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{team.name}</h3>
                        <p className="text-sm text-gray-500">{program?.name}</p>
                        {teamStanding && (
                          <p className="text-sm text-gray-400 mt-1">
                            {teamStanding.wins}-{teamStanding.losses}
                            {teamStanding.ties > 0 && `-${teamStanding.ties}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Playoffs Tab */}
        {activeTab === 'playoffs' && (
          <div>
            {!bracket ? (
              <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400 border border-gray-700">
                <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium">No Playoff Bracket</h3>
                <p className="mt-2">Playoffs haven't started for this season yet</p>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h2 className="text-lg font-semibold mb-4">{(bracket as any).name || 'Playoff Bracket'}</h2>
                {/* Simplified bracket display */}
                <div className="grid gap-4">
                  {((bracket as any).matches || []).map((match: any, idx: number) => {
                    const team1 = teams.find(t => t.id === match.team1Id);
                    const team2 = teams.find(t => t.id === match.team2Id);
                    
                    return (
                      <div key={idx} className="bg-gray-700/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-2">
                          {match.round === 1 ? 'Round 1' : match.round === 2 ? 'Semi-Finals' : 'Finals'}
                        </div>
                        <div className={`flex justify-between items-center py-1 ${match.winnerId === match.team1Id ? 'font-bold text-green-400' : ''}`}>
                          <span>{team1?.name || 'TBD'}</span>
                          <span>{match.team1Score ?? '-'}</span>
                        </div>
                        <div className={`flex justify-between items-center py-1 ${match.winnerId === match.team2Id ? 'font-bold text-green-400' : ''}`}>
                          <span>{team2?.name || 'TBD'}</span>
                          <span>{match.team2Score ?? '-'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-800 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          Powered by OSYS • Operating System for Youth Sports
        </div>
      </div>
    </div>
  );
}
