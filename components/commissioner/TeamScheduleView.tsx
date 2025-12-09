/**
 * Team Schedule View Component
 * Allows teams/commissioners to view their schedule and request changes
 * Part of Phase 8: Team Self-Scheduling
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { LeagueGame, LeagueSchedule, LeagueSeason, Team } from '../../types';
import { Calendar, Clock, MapPin, Users, AlertCircle, Loader2, ChevronLeft, Send, X, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TeamGame extends LeagueGame {
  isHome: boolean;
  opponentName: string;
}

export default function TeamScheduleView() {
  const { userData, teamData, programData, leagueData } = useAuth();
  
  const [games, setGames] = useState<TeamGame[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState<TeamGame | null>(null);

  useEffect(() => {
    loadSchedule();
  }, [teamData, leagueData]);

  const loadSchedule = async () => {
    if (!teamData?.id || !leagueData?.id) {
      setLoading(false);
      return;
    }

    try {
      // Load all teams for opponent names
      const programsQuery = query(
        collection(db, 'programs'),
        where('leagueId', '==', leagueData.id)
      );
      const programsSnap = await getDocs(programsQuery);
      const programIds = programsSnap.docs.map(d => d.id);

      let allTeams: Team[] = [];
      if (programIds.length > 0) {
        const teamsQuery = query(
          collection(db, 'teams'),
          where('programId', 'in', programIds.slice(0, 10))
        );
        const teamsSnap = await getDocs(teamsQuery);
        allTeams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
        setTeams(allTeams);
      }

      // Load schedules
      const schedulesQuery = query(
        collection(db, 'leagueSchedules'),
        where('leagueId', '==', leagueData.id)
      );
      const schedulesSnap = await getDocs(schedulesQuery);

      const teamGames: TeamGame[] = [];
      schedulesSnap.docs.forEach(doc => {
        const schedule = doc.data() as LeagueSchedule;
        if (schedule.games) {
          schedule.games.forEach(game => {
            if (game.homeTeamId === teamData.id || game.awayTeamId === teamData.id) {
              const isHome = game.homeTeamId === teamData.id;
              const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
              const opponent = allTeams.find(t => t.id === opponentId);
              
              teamGames.push({
                ...game,
                isHome,
                opponentName: opponent?.name || 'TBD'
              });
            }
          });
        }
      });

      // Sort by date
      teamGames.sort((a, b) => {
        const dateA = a.dateTime instanceof Timestamp ? a.dateTime.toDate() : new Date(a.dateTime as any);
        const dateB = b.dateTime instanceof Timestamp ? b.dateTime.toDate() : new Date(b.dateTime as any);
        return dateA.getTime() - dateB.getTime();
      });

      setGames(teamGames);
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatGameDate = (dateTime: any) => {
    const date = dateTime instanceof Timestamp ? dateTime.toDate() : new Date(dateTime);
    return {
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      isPast: date < new Date()
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'in_progress': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const upcomingGames = games.filter(g => g.status === 'scheduled');
  const pastGames = games.filter(g => g.status === 'completed');
  const record = pastGames.reduce((acc, game) => {
    const myScore = game.isHome ? game.homeScore : game.awayScore;
    const theirScore = game.isHome ? game.awayScore : game.homeScore;
    if ((myScore || 0) > (theirScore || 0)) acc.wins++;
    else if ((myScore || 0) < (theirScore || 0)) acc.losses++;
    else acc.ties++;
    return acc;
  }, { wins: 0, losses: 0, ties: 0 });

  if (!leagueData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">Not in a League</h2>
          <p className="text-gray-400 mt-2">Your team is not part of a league yet.</p>
        </div>
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
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                to={userData?.role === 'ProgramCommissioner' ? '/commissioner' : '/dashboard'} 
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Team Schedule
                </h1>
                <p className="text-sm text-gray-400">{teamData?.name} • {leagueData.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Record Summary */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-300">Season Record</h2>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <span className="text-2xl font-bold text-green-400">{record.wins}</span>
                <span className="text-gray-500 text-sm block">W</span>
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold text-red-400">{record.losses}</span>
                <span className="text-gray-500 text-sm block">L</span>
              </div>
              {record.ties > 0 && (
                <div className="text-center">
                  <span className="text-2xl font-bold text-gray-400">{record.ties}</span>
                  <span className="text-gray-500 text-sm block">T</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Games */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Upcoming Games ({upcomingGames.length})
          </h2>
          
          {upcomingGames.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
              <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No upcoming games scheduled</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingGames.map((game, idx) => {
                const { weekday, date, time } = formatGameDate(game.dateTime);
                return (
                  <div key={idx} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[60px]">
                          <div className="text-sm text-gray-500">{weekday}</div>
                          <div className="font-medium">{date}</div>
                          <div className="text-sm text-blue-400">{time}</div>
                        </div>
                        <div className="h-12 w-px bg-gray-700" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${game.isHome ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {game.isHome ? 'HOME' : 'AWAY'}
                            </span>
                            <span className="text-gray-400">vs</span>
                            <span className="font-medium">{game.opponentName}</span>
                          </div>
                          {game.location && (
                            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                              <MapPin className="w-3 h-3" />
                              {game.location}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedGame(game);
                          setShowRequestModal(true);
                        }}
                        className="text-sm text-blue-400 hover:text-blue-300 px-3 py-1 rounded-lg hover:bg-blue-500/10 transition-colors"
                      >
                        Request Change
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Past Games */}
        {pastGames.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Completed Games ({pastGames.length})
            </h2>
            
            <div className="space-y-2">
              {pastGames.slice().reverse().map((game, idx) => {
                const { date } = formatGameDate(game.dateTime);
                const myScore = game.isHome ? game.homeScore : game.awayScore;
                const theirScore = game.isHome ? game.awayScore : game.homeScore;
                const won = (myScore || 0) > (theirScore || 0);
                const tied = myScore === theirScore;
                
                return (
                  <div key={idx} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          won ? 'bg-green-500 text-white' : tied ? 'bg-gray-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {won ? 'W' : tied ? 'T' : 'L'}
                        </span>
                        <span className="text-gray-400 text-sm">{date}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${game.isHome ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                          {game.isHome ? 'vs' : '@'}
                        </span>
                        <span className="font-medium">{game.opponentName}</span>
                      </div>
                      <span className="font-bold">
                        {myScore} - {theirScore}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Request Change Modal */}
      {showRequestModal && selectedGame && (
        <ScheduleChangeRequestModal
          game={selectedGame}
          teamId={teamData?.id || ''}
          leagueId={leagueData.id}
          onClose={() => {
            setShowRequestModal(false);
            setSelectedGame(null);
          }}
        />
      )}
    </div>
  );
}

// Schedule Change Request Modal
interface ScheduleChangeRequestModalProps {
  game: TeamGame;
  teamId: string;
  leagueId: string;
  onClose: () => void;
}

function ScheduleChangeRequestModal({ game, teamId, leagueId, onClose }: ScheduleChangeRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    reason: '',
    preferredDate: '',
    preferredTime: '',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reason) return;
    
    setLoading(true);

    try {
      await addDoc(collection(db, 'scheduleChangeRequests'), {
        teamId,
        leagueId,
        gameDate: game.dateTime,
        opponentId: game.isHome ? game.awayTeamId : game.homeTeamId,
        opponentName: game.opponentName,
        reason: formData.reason,
        preferredDate: formData.preferredDate || null,
        preferredTime: formData.preferredTime || null,
        notes: formData.notes || null,
        status: 'pending',
        createdAt: Timestamp.now()
      });
      
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting request:', error);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-xl w-full max-w-md border border-gray-700 p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Request Submitted!</h2>
          <p className="text-gray-400 mb-4">
            The league administrator will review your request and get back to you.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const { date, time } = (() => {
    const d = game.dateTime instanceof Timestamp ? game.dateTime.toDate() : new Date(game.dateTime as any);
    return {
      date: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    };
  })();

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md border border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Request Schedule Change</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          {/* Game Info */}
          <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
            <div className="text-sm text-gray-400">Current Game</div>
            <div className="font-medium mt-1">
              {game.isHome ? 'vs' : '@'} {game.opponentName}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {date} at {time}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Reason for Change *
              </label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white"
                required
              >
                <option value="">Select a reason</option>
                <option value="facility_conflict">Facility Conflict</option>
                <option value="weather">Weather Concerns</option>
                <option value="team_availability">Team Availability Issue</option>
                <option value="coach_unavailable">Coach Unavailable</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Preferred Date
                </label>
                <input
                  type="date"
                  value={formData.preferredDate}
                  onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Preferred Time
                </label>
                <input
                  type="time"
                  value={formData.preferredTime}
                  onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Additional Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white"
                placeholder="Any additional details..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.reason}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit Request
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
