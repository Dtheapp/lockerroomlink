import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, doc, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { LeagueSeason, LeagueSchedule, LeagueGame, Program, Team } from '../../types';
import { ChevronLeft, Calendar, Plus, Play, Pause, CheckCircle, Clock, MapPin, Trophy, Filter, Users, Loader2, AlertCircle, MoreVertical, Edit, Trash2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface SeasonWithStats extends LeagueSeason {
  gamesCount: number;
  completedGames: number;
  pendingGames: number;
}

export default function LeagueSeasons() {
  const { leagueData, user } = useAuth();
  const navigate = useNavigate();
  const [seasons, setSeasons] = useState<SeasonWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);

  useEffect(() => {
    loadSeasons();
  }, [leagueData]);

  const loadSeasons = async () => {
    if (!leagueData) return;

    try {
      // Load seasons
      const seasonsQuery = query(
        collection(db, 'leagueSeasons'),
        where('leagueId', '==', leagueData.id),
        orderBy('startDate', 'desc')
      );
      const seasonsSnap = await getDocs(seasonsQuery);
      const seasonsList = seasonsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeagueSeason[];

      // For each season, get game counts
      const seasonsWithStats = await Promise.all(
        seasonsList.map(async (season) => {
          const gamesQuery = query(
            collection(db, 'leagueSchedules'),
            where('seasonId', '==', season.id)
          );
          const gamesSnap = await getDocs(gamesQuery);
          
          let gamesCount = 0;
          let completedGames = 0;
          let pendingGames = 0;

          gamesSnap.docs.forEach(doc => {
            const schedule = doc.data() as LeagueSchedule;
            if (schedule.games) {
              gamesCount += schedule.games.length;
              completedGames += schedule.games.filter(g => g.status === 'completed').length;
              pendingGames += schedule.games.filter(g => g.status === 'scheduled').length;
            }
          });

          return {
            ...season,
            gamesCount,
            completedGames,
            pendingGames
          };
        })
      );

      setSeasons(seasonsWithStats);
    } catch (error) {
      console.error('Error loading seasons:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            <Play className="w-3 h-3" />
            Active
          </span>
        );
      case 'upcoming':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Clock className="w-3 h-3" />
            Upcoming
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  const formatDateRange = (startDate: any, endDate: any) => {
    const start = startDate instanceof Timestamp ? startDate.toDate() : new Date(startDate);
    const end = endDate instanceof Timestamp ? endDate.toDate() : new Date(endDate);
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  if (!leagueData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">No League Found</h2>
        </div>
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
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Seasons & Schedules
                </h1>
                <p className="text-sm text-gray-400">{leagueData.name}</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Season
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : seasons.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
            <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400">No Seasons Yet</h3>
            <p className="text-gray-500 mt-2">Create your first season to start scheduling games</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium mx-auto transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Season
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {seasons.map(season => (
              <div 
                key={season.id} 
                className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
                onClick={() => navigate(`/league/seasons/${season.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{season.name}</h3>
                      {getStatusBadge(season.status)}
                    </div>
                    <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDateRange(season.startDate, season.endDate)}
                    </p>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-6 mt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">{season.gamesCount}</div>
                        <div className="text-xs text-gray-500">Total Games</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">{season.completedGames}</div>
                        <div className="text-xs text-gray-500">Completed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">{season.pendingGames}</div>
                        <div className="text-xs text-gray-500">Upcoming</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSeason(selectedSeason === season.id ? null : season.id);
                      }}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    
                    {selectedSeason === season.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-gray-700 rounded-lg shadow-lg border border-gray-600 py-1 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/league/seasons/${season.id}`);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-600 text-sm text-left"
                        >
                          <Calendar className="w-4 h-4" />
                          View Schedule
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/league/seasons/${season.id}/edit`);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-600 text-sm text-left"
                        >
                          <Edit className="w-4 h-4" />
                          Edit Season
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Season Modal */}
      {showCreateModal && (
        <CreateSeasonModal 
          leagueId={leagueData.id}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadSeasons();
          }}
        />
      )}
    </div>
  );
}

// Create Season Modal Component
interface CreateSeasonModalProps {
  leagueId: string;
  onClose: () => void;
  onCreated: () => void;
}

function CreateSeasonModal({ leagueId, onClose, onCreated }: CreateSeasonModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    registrationDeadline: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, 'leagueSeasons'), {
        leagueId,
        name: formData.name,
        startDate: Timestamp.fromDate(new Date(formData.startDate)),
        endDate: Timestamp.fromDate(new Date(formData.endDate)),
        registrationDeadline: formData.registrationDeadline 
          ? Timestamp.fromDate(new Date(formData.registrationDeadline))
          : null,
        status: 'upcoming',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      onCreated();
    } catch (error) {
      console.error('Error creating season:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md border border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Create New Season</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Season Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Fall 2024"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Registration Deadline
            </label>
            <input
              type="date"
              value={formData.registrationDeadline}
              onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Season
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
