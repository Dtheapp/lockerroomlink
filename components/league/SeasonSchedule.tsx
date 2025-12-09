import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { LeagueSeason, LeagueSchedule, LeagueGame, Team, Program } from '../../types';
import { ChevronLeft, Calendar, Plus, Play, Clock, CheckCircle, MapPin, Users, Loader2, AlertCircle, Edit, Trash2, X, Save, Filter, ChevronDown, Trophy } from 'lucide-react';

type ViewMode = 'list' | 'calendar' | 'by-team';

export default function SeasonSchedule() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { leagueData, user } = useAuth();
  const navigate = useNavigate();
  
  const [season, setSeason] = useState<LeagueSeason | null>(null);
  const [games, setGames] = useState<LeagueGame[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddGame, setShowAddGame] = useState(false);
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

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
      setSeason({ id: seasonDoc.id, ...seasonDoc.data() } as LeagueSeason);

      // Load schedule
      const scheduleQuery = query(
        collection(db, 'leagueSchedules'),
        where('seasonId', '==', seasonId)
      );
      const scheduleSnap = await getDocs(scheduleQuery);
      
      const allGames: LeagueGame[] = [];
      scheduleSnap.docs.forEach(doc => {
        const schedule = doc.data() as LeagueSchedule;
        if (schedule.games) {
          allGames.push(...schedule.games.map(g => ({ ...g, scheduleId: doc.id })));
        }
      });
      
      // Sort by date
      allGames.sort((a, b) => {
        const dateA = a.dateTime instanceof Timestamp ? a.dateTime.toDate() : new Date(a.dateTime as any);
        const dateB = b.dateTime instanceof Timestamp ? b.dateTime.toDate() : new Date(b.dateTime as any);
        return dateA.getTime() - dateB.getTime();
      });
      
      setGames(allGames);

      // Load teams in league
      const programsQuery = query(
        collection(db, 'programs'),
        where('leagueId', '==', leagueData.id)
      );
      const programsSnap = await getDocs(programsQuery);
      const programIds = programsSnap.docs.map(d => d.id);

      if (programIds.length > 0) {
        const teamsQuery = query(
          collection(db, 'teams'),
          where('programId', 'in', programIds.slice(0, 10)) // Firestore limit
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Clock className="w-3 h-3" />
            Scheduled
          </span>
        );
      case 'in_progress':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <Play className="w-3 h-3" />
            In Progress
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
            <X className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const formatGameDate = (dateTime: any) => {
    const date = dateTime instanceof Timestamp ? dateTime.toDate() : new Date(dateTime);
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    };
  };

  const filteredGames = games.filter(game => {
    const matchesTeam = filterTeam === 'all' || game.homeTeamId === filterTeam || game.awayTeamId === filterTeam;
    const matchesStatus = filterStatus === 'all' || game.status === filterStatus;
    return matchesTeam && matchesStatus;
  });

  // Group games by date for list view
  const gamesByDate = filteredGames.reduce((acc, game) => {
    const { date } = formatGameDate(game.dateTime);
    if (!acc[date]) acc[date] = [];
    acc[date].push(game);
    return acc;
  }, {} as Record<string, LeagueGame[]>);

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
              <Link to="/league/seasons" className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  {season?.name || 'Season Schedule'}
                </h1>
                <p className="text-sm text-gray-400">{games.length} games scheduled</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddGame(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Game
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* View Mode */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            {(['list', 'calendar', 'by-team'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === mode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {mode === 'by-team' ? 'By Team' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Team Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
            >
              <option value="all">All Teams</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {filteredGames.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
            <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400">No Games Found</h3>
            <p className="text-gray-500 mt-2">
              {filterTeam !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Add your first game to this season'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-6">
            {Object.entries(gamesByDate).map(([date, dateGames]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {date}
                </h3>
                <div className="space-y-3">
                  {dateGames.map((game, idx) => (
                    <GameCard key={`${game.homeTeamId}-${game.awayTeamId}-${idx}`} game={game} teams={teams} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'by-team' ? (
          <div className="grid gap-6">
            {teams.map(team => {
              const teamGames = filteredGames.filter(
                g => g.homeTeamId === team.id || g.awayTeamId === team.id
              );
              if (teamGames.length === 0) return null;
              
              return (
                <div key={team.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  <div className="p-4 bg-gray-750 border-b border-gray-700">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-400" />
                      {team.name}
                      <span className="text-sm text-gray-400 font-normal">({teamGames.length} games)</span>
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-700">
                    {teamGames.map((game, idx) => (
                      <GameCard key={`${team.id}-${idx}`} game={game} teams={teams} compact />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Calendar view - simplified grid
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <p className="text-gray-400 text-center">Calendar view coming soon...</p>
          </div>
        )}
      </div>

      {/* Add Game Modal */}
      {showAddGame && seasonId && (
        <AddGameModal
          seasonId={seasonId}
          leagueId={leagueData.id}
          teams={teams}
          onClose={() => setShowAddGame(false)}
          onAdded={() => {
            setShowAddGame(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// Game Card Component
interface GameCardProps {
  game: LeagueGame;
  teams: Team[];
  compact?: boolean;
}

function GameCard({ game, teams, compact }: GameCardProps) {
  const homeTeam = teams.find(t => t.id === game.homeTeamId);
  const awayTeam = teams.find(t => t.id === game.awayTeamId);
  
  const { date, time } = (() => {
    const d = game.dateTime instanceof Timestamp ? game.dateTime.toDate() : new Date(game.dateTime as any);
    return {
      date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    };
  })();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Scheduled</span>;
      case 'in_progress':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Live</span>;
      case 'completed':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Final</span>;
      case 'cancelled':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Cancelled</span>;
      default:
        return null;
    }
  };

  if (compact) {
    return (
      <div className="p-3 flex items-center justify-between hover:bg-gray-750 transition-colors">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400 w-24">
            {date}
          </div>
          <div className="text-sm">
            <span className="font-medium">{homeTeam?.name || 'TBD'}</span>
            <span className="text-gray-500 mx-2">vs</span>
            <span className="font-medium">{awayTeam?.name || 'TBD'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {game.status === 'completed' && (
            <span className="font-bold">
              {game.homeScore} - {game.awayScore}
            </span>
          )}
          {getStatusBadge(game.status)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-lg font-bold">{time}</div>
            {game.location && (
              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {game.location}
              </div>
            )}
          </div>
          
          <div className="h-12 w-px bg-gray-700" />
          
          <div className="flex items-center gap-6">
            {/* Home Team */}
            <div className="text-center min-w-[120px]">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-1">
                <Users className="w-5 h-5" />
              </div>
              <div className="font-medium">{homeTeam?.name || 'TBD'}</div>
              <div className="text-xs text-gray-500">Home</div>
            </div>

            {/* Score or VS */}
            <div className="text-center">
              {game.status === 'completed' ? (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{game.homeScore}</span>
                  <span className="text-gray-500">-</span>
                  <span className="text-2xl font-bold">{game.awayScore}</span>
                </div>
              ) : (
                <span className="text-xl font-bold text-gray-500">VS</span>
              )}
            </div>

            {/* Away Team */}
            <div className="text-center min-w-[120px]">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-1">
                <Users className="w-5 h-5" />
              </div>
              <div className="font-medium">{awayTeam?.name || 'TBD'}</div>
              <div className="text-xs text-gray-500">Away</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(game.status)}
        </div>
      </div>
    </div>
  );
}

// Add Game Modal
interface AddGameModalProps {
  seasonId: string;
  leagueId: string;
  teams: Team[];
  onClose: () => void;
  onAdded: () => void;
}

function AddGameModal({ seasonId, leagueId, teams, onClose, onAdded }: AddGameModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    homeTeamId: '',
    awayTeamId: '',
    date: '',
    time: '',
    location: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.homeTeamId || !formData.awayTeamId || !formData.date || !formData.time) return;
    
    setLoading(true);

    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      
      // Find or create schedule for this league/season
      const scheduleQuery = query(
        collection(db, 'leagueSchedules'),
        where('seasonId', '==', seasonId),
        where('leagueId', '==', leagueId)
      );
      const scheduleSnap = await getDocs(scheduleQuery);
      
      const newGame: LeagueGame = {
        homeTeamId: formData.homeTeamId,
        awayTeamId: formData.awayTeamId,
        dateTime: Timestamp.fromDate(dateTime),
        location: formData.location || undefined,
        status: 'scheduled',
        homeScore: 0,
        awayScore: 0
      };

      if (scheduleSnap.empty) {
        // Create new schedule
        await addDoc(collection(db, 'leagueSchedules'), {
          leagueId,
          seasonId,
          games: [newGame],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      } else {
        // Add to existing schedule
        const scheduleDoc = scheduleSnap.docs[0];
        const existingGames = (scheduleDoc.data() as LeagueSchedule).games || [];
        await updateDoc(doc(db, 'leagueSchedules', scheduleDoc.id), {
          games: [...existingGames, newGame],
          updatedAt: Timestamp.now()
        });
      }

      onAdded();
    } catch (error) {
      console.error('Error adding game:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md border border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Add New Game</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Home Team *
              </label>
              <select
                value={formData.homeTeamId}
                onChange={(e) => setFormData({ ...formData, homeTeamId: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select team</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id} disabled={team.id === formData.awayTeamId}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Away Team *
              </label>
              <select
                value={formData.awayTeamId}
                onChange={(e) => setFormData({ ...formData, awayTeamId: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select team</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id} disabled={team.id === formData.homeTeamId}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Time *
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
              placeholder="Field name or address"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.homeTeamId || !formData.awayTeamId}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Game
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
