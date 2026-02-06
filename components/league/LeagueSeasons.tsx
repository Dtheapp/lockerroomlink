import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { collection, query, where, getDocs, orderBy, doc, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { LeagueSeason, LeagueSchedule, LeagueGame, Program, Team } from '../../types';
import { ChevronLeft, Calendar, Plus, Play, Pause, CheckCircle, Clock, MapPin, Trophy, Filter, Users, Loader2, AlertCircle, MoreVertical, Edit, Trash2, X, Square, PlayCircle, StopCircle, UserMinus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { startLeagueSeason, endLeagueSeason, closeSeasonRegistration, moveSeasonToPlayoffs } from '../../services/leagueService';

interface SeasonWithStats extends LeagueSeason {
  gamesCount: number;
  completedGames: number;
  pendingGames: number;
  registrationOpen?: boolean;
  scheduledAgeGroups: string[]; // Age groups that have schedules created
}

export default function LeagueSeasons() {
  const { leagueData, user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [seasons, setSeasons] = useState<SeasonWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showEndSeasonModal, setShowEndSeasonModal] = useState<SeasonWithStats | null>(null);

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
          const scheduledAgeGroups: Set<string> = new Set();

          gamesSnap.docs.forEach(doc => {
            const schedule = doc.data() as LeagueSchedule;
            // Track which age groups have schedules
            if ((schedule as any).ageGroup) {
              scheduledAgeGroups.add((schedule as any).ageGroup);
            }
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
            pendingGames,
            scheduledAgeGroups: Array.from(scheduledAgeGroups)
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

  const getStatusBadge = (status: string, registrationOpen?: boolean) => {
    switch (status) {
      case 'active':
        return (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
              <Play className="w-3 h-3" />
              Active
            </span>
            {registrationOpen && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Users className="w-3 h-3" />
                Registration Open
              </span>
            )}
          </div>
        );
      case 'upcoming':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Clock className="w-3 h-3" />
            Upcoming
          </span>
        );
      case 'playoffs':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <Trophy className="w-3 h-3" />
            Playoffs
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

  const handleStartSeason = async (season: SeasonWithStats) => {
    if (!leagueData) return;
    setActionLoading(season.id);
    try {
      await startLeagueSeason(leagueData.id, season.id);
      await loadSeasons();
    } catch (error) {
      console.error('Error starting season:', error);
    } finally {
      setActionLoading(null);
      setSelectedSeason(null);
    }
  };

  const handleCloseRegistration = async (season: SeasonWithStats) => {
    if (!leagueData) return;
    setActionLoading(season.id);
    try {
      await closeSeasonRegistration(leagueData.id, season.id);
      await loadSeasons();
    } catch (error) {
      console.error('Error closing registration:', error);
    } finally {
      setActionLoading(null);
      setSelectedSeason(null);
    }
  };

  const handleMoveToPlayoffs = async (season: SeasonWithStats) => {
    if (!leagueData) return;
    setActionLoading(season.id);
    try {
      await moveSeasonToPlayoffs(leagueData.id, season.id);
      await loadSeasons();
    } catch (error) {
      console.error('Error moving to playoffs:', error);
    } finally {
      setActionLoading(null);
      setSelectedSeason(null);
    }
  };

  const handleEndSeason = async (season: SeasonWithStats) => {
    if (!leagueData) return;
    setActionLoading(season.id);
    try {
      const result = await endLeagueSeason(leagueData.id, season.id);
      console.log('Season ended:', result);
      setShowEndSeasonModal(null);
      await loadSeasons();
    } catch (error) {
      console.error('Error ending season:', error);
    } finally {
      setActionLoading(null);
      setSelectedSeason(null);
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
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No League Found</h2>
        </div>
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
          <div className="flex items-center justify-between">
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
                  <Calendar className={theme === 'dark' ? 'w-5 h-5 text-purple-400' : 'w-5 h-5 text-purple-600'} />
                  Seasons & Schedules
                </h1>
                <p className={theme === 'dark' ? 'text-sm text-slate-400' : 'text-sm text-slate-600'}>{leagueData.name}</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 px-4 py-2 rounded-xl font-medium text-white transition-all shadow-lg shadow-purple-500/25"
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
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : seasons.length === 0 ? (
          <div className={`text-center py-12 rounded-2xl border ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10' 
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <Calendar className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
            }`} />
            <h3 className={`text-lg font-medium ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>No Seasons Yet</h3>
            <p className={`mt-2 ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
            }`}>Create your first season to start scheduling games</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 px-4 py-2 rounded-xl font-medium text-white mx-auto transition-all"
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
                className={`rounded-2xl p-5 border transition-colors cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-white/5 border-white/10 hover:border-white/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
                onClick={() => navigate(`/league/seasons/${season.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className={`font-semibold text-lg ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>{season.name}</h3>
                      {getStatusBadge(season.status, (season as any).registrationOpen)}
                    </div>
                    <p className={`text-sm mt-1 flex items-center gap-1 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      <Calendar className="w-4 h-4" />
                      {formatDateRange(season.startDate, season.endDate)}
                    </p>
                    
                    {/* Age Group Pills - Shows scheduled status */}
                    {season.ageGroups && season.ageGroups.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {season.ageGroups.slice(0, 5).map((ag, idx) => {
                          const isScheduled = season.scheduledAgeGroups?.includes(ag);
                          return (
                            <span 
                              key={idx} 
                              className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                isScheduled
                                  ? theme === 'dark'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-green-50 text-green-700 border border-green-200'
                                  : theme === 'dark' 
                                    ? 'bg-white/10 text-slate-300' 
                                    : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isScheduled && <CheckCircle className="w-3 h-3" />}
                              {ag}
                            </span>
                          );
                        })}
                        {season.ageGroups.length > 5 && (
                          <span className={`text-xs px-2 py-0.5 ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            +{season.ageGroups.length - 5} more
                          </span>
                        )}
                        {/* Schedule Progress Summary */}
                        {season.scheduledAgeGroups && season.scheduledAgeGroups.length > 0 && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            season.scheduledAgeGroups.length === season.ageGroups.length
                              ? theme === 'dark'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-green-50 text-green-700'
                              : theme === 'dark'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-yellow-50 text-yellow-700'
                          }`}>
                            {season.scheduledAgeGroups.length}/{season.ageGroups.length} scheduled
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Stats */}
                    <div className="flex items-center gap-6 mt-4">
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        }`}>{season.gamesCount}</div>
                        <div className={`text-xs ${
                          theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
                        }`}>Total Games</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">{season.completedGames}</div>
                        <div className={`text-xs ${
                          theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
                        }`}>Completed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">{season.pendingGames}</div>
                        <div className={`text-xs ${
                          theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
                        }`}>Upcoming</div>
                      </div>
                    </div>
                    
                    {/* Inline Action Buttons */}
                    {season.status !== 'completed' && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {/* Start Season Button - Only for upcoming */}
                        {season.status === 'upcoming' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartSeason(season);
                            }}
                            disabled={actionLoading === season.id}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                          >
                            {actionLoading === season.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                            Start Season
                          </button>
                        )}
                        
                        {/* End Season Button - Only for active/playoffs */}
                        {(season.status === 'active' || season.status === 'playoffs') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowEndSeasonModal(season);
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                          >
                            <Square className="w-3.5 h-3.5" />
                            End Season
                          </button>
                        )}
                        
                        {/* Edit Schedule Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/league/seasons/${season.id}`);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                            theme === 'dark'
                              ? 'bg-white/10 hover:bg-white/20 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          {season.gamesCount > 0 ? 'Edit Schedule' : 'Build Schedule'}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSeason(selectedSeason === season.id ? null : season.id);
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                      }`}
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    
                    {selectedSeason === season.id && (
                      <div className={`absolute right-0 top-full mt-1 w-56 rounded-xl shadow-lg border py-1 z-10 ${
                        theme === 'dark'
                          ? 'bg-zinc-800 border-white/10'
                          : 'bg-white border-slate-200'
                      }`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/league/seasons/${season.id}`);
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left ${
                            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                          }`}
                        >
                          <Calendar className="w-4 h-4" />
                          View Schedule
                        </button>
                        
                        {/* Status-based actions */}
                        {season.status === 'upcoming' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartSeason(season);
                            }}
                            disabled={actionLoading === season.id}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-green-400 ${
                              theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                            }`}
                          >
                            {actionLoading === season.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <PlayCircle className="w-4 h-4" />
                            )}
                            Start Season
                          </button>
                        )}
                        
                        {season.status === 'active' && (season as any).registrationOpen && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloseRegistration(season);
                            }}
                            disabled={actionLoading === season.id}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-yellow-400 ${
                              theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                            }`}
                          >
                            {actionLoading === season.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <UserMinus className="w-4 h-4" />
                            )}
                            Close Registration
                          </button>
                        )}
                        
                        {season.status === 'active' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveToPlayoffs(season);
                            }}
                            disabled={actionLoading === season.id}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-yellow-400 ${
                              theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                            }`}
                          >
                            {actionLoading === season.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trophy className="w-4 h-4" />
                            )}
                            Move to Playoffs
                          </button>
                        )}
                        
                        {(season.status === 'active' || season.status === 'playoffs') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSeason(null);
                              setShowEndSeasonModal(season);
                            }}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-red-400 ${
                              theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                            }`}
                          >
                            <StopCircle className="w-4 h-4" />
                            End Season
                          </button>
                        )}
                        
                        <div className={`border-t my-1 ${
                          theme === 'dark' ? 'border-white/10' : 'border-slate-200'
                        }`} />
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Navigate to schedule page where Edit Season modal exists
                            navigate(`/league/seasons/${season.id}`);
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left ${
                            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                          }`}
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
          leagueAgeGroups={(leagueData as any).ageGroups || []}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadSeasons();
          }}
          theme={theme}
        />
      )}

      {/* End Season Confirmation Modal */}
      {showEndSeasonModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl w-full max-w-md border ${
            theme === 'dark'
              ? 'bg-zinc-900 border-white/10'
              : 'bg-white border-slate-200 shadow-xl'
          }`}>
            <div className={`flex items-center justify-between p-4 border-b ${
              theme === 'dark' ? 'border-white/10' : 'border-slate-200'
            }`}>
              <h2 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                End Season
              </h2>
              <button onClick={() => setShowEndSeasonModal(null)} className={`p-2 rounded-lg ${
                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
              }`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-4">
                <h3 className="font-medium text-red-300 mb-2">Warning: This action is permanent!</h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  Ending "{showEndSeasonModal.name}" will:
                </p>
                <ul className={`text-sm mt-2 space-y-1 list-disc list-inside ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  <li>Remove ALL players from ALL team rosters</li>
                  <li>Archive player stats and standings for history</li>
                  <li>Mark the season as completed</li>
                  <li>Close registration permanently</li>
                </ul>
              </div>
              
              <p className={`text-sm mb-4 ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Player data will be preserved in the season history. Teams will need to rebuild rosters for the next season.
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowEndSeasonModal(null)}
                  className={`px-4 py-2 transition-colors ${
                    theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleEndSeason(showEndSeasonModal)}
                  disabled={actionLoading === showEndSeasonModal.id}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 px-4 py-2 rounded-xl font-medium text-white transition-colors"
                >
                  {actionLoading === showEndSeasonModal.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <StopCircle className="w-4 h-4" />
                  )}
                  End Season & Clear Rosters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Create Season Modal Component
interface CreateSeasonModalProps {
  leagueId: string;
  leagueAgeGroups: string[];
  onClose: () => void;
  onCreated: () => void;
  theme: string;
}

function CreateSeasonModal({ leagueId, leagueAgeGroups, onClose, onCreated, theme }: CreateSeasonModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    registrationDeadline: ''
  });
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([]);

  const toggleAgeGroup = (ag: string) => {
    if (selectedAgeGroups.includes(ag)) {
      setSelectedAgeGroups(selectedAgeGroups.filter(a => a !== ag));
    } else {
      setSelectedAgeGroups([...selectedAgeGroups, ag]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedAgeGroups.length === 0) {
      alert('Please select at least one age group for this season');
      return;
    }
    
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
        ageGroups: selectedAgeGroups,
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

  // If no age groups configured, show setup message
  if (!leagueAgeGroups || leagueAgeGroups.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className={`rounded-2xl w-full max-w-md border ${
          theme === 'dark'
            ? 'bg-zinc-900 border-white/10'
            : 'bg-white border-slate-200 shadow-xl'
        }`}>
          <div className={`flex items-center justify-between p-4 border-b ${
            theme === 'dark' ? 'border-white/10' : 'border-slate-200'
          }`}>
            <h2 className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>Setup Required</h2>
            <button onClick={onClose} className={`p-2 rounded-lg ${
              theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}>
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 text-center">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
              theme === 'dark' ? 'bg-amber-500/20' : 'bg-amber-100'
            }`}>
              <AlertCircle className={`w-8 h-8 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`} />
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>Age Groups Required</h3>
            <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Before creating a season, you need to set up age groups in League Settings. 
              This allows teams to register for the correct age divisions.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-xl ${
                  theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Cancel
              </button>
              <a
                href="/league/settings"
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-xl font-medium"
              >
                Go to Settings
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl w-full max-w-md border ${
        theme === 'dark'
          ? 'bg-zinc-900 border-white/10'
          : 'bg-white border-slate-200 shadow-xl'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-white/10' : 'border-slate-200'
        }`}>
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>Create New Season</h2>
          <button onClick={onClose} className={`p-2 rounded-lg ${
            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
          }`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Season Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                  : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
              placeholder="e.g., Spring 2026"
              required
            />
          </div>

          {/* Age Groups Selection */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Age Groups *
            </label>
            <div className="flex flex-wrap gap-2">
              {leagueAgeGroups.map(ag => (
                <button
                  key={ag}
                  type="button"
                  onClick={() => toggleAgeGroup(ag)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedAgeGroups.includes(ag)
                      ? 'bg-purple-600 text-white'
                      : theme === 'dark'
                        ? 'bg-white/10 text-slate-300 hover:bg-white/20'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {ag}
                </button>
              ))}
            </div>
            {selectedAgeGroups.length === 0 && (
              <p className="text-xs text-amber-500 mt-1">Select at least one age group</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Start Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className={`w-full rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                  theme === 'dark'
                    ? 'bg-white/5 border border-white/10 text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-900'
                }`}
                required
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                End Date *
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className={`w-full rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                  theme === 'dark'
                    ? 'bg-white/5 border border-white/10 text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-900'
                }`}
                required
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Team Registration Deadline
            </label>
            <input
              type="date"
              value={formData.registrationDeadline}
              onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
              className={`w-full rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white'
                  : 'bg-slate-50 border border-slate-200 text-slate-900'
              }`}
            />
            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
              Last day for teams to request to join this season
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 transition-colors ${
                theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedAgeGroups.length === 0}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 px-4 py-2 rounded-xl font-medium text-white transition-all shadow-lg shadow-purple-500/25"
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
