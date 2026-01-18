import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { LeagueSeason, LeagueSchedule, LeagueGame, Team, Program } from '../../types';
import { ChevronLeft, Calendar, Plus, Play, Clock, CheckCircle, MapPin, Users, Loader2, AlertCircle, Edit, Trash2, X, Save, Filter, ChevronDown, Trophy, Settings, PlayCircle, StopCircle, Palette } from 'lucide-react';
import { toastSuccess, toastError } from '../../services/toast';

type ViewMode = 'list' | 'calendar' | 'by-team';

interface AgeGroupInfo {
  name: string;
  teamCount: number;
  gameCount: number;
  isScheduled: boolean;
}

export default function SeasonSchedule() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { leagueData, user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [season, setSeason] = useState<LeagueSeason | null>(null);
  const [games, setGames] = useState<LeagueGame[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddGame, setShowAddGame] = useState(false);
  const [showEditSeason, setShowEditSeason] = useState(false);
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>('all');
  const [ageGroupInfos, setAgeGroupInfos] = useState<AgeGroupInfo[]>([]);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

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

      // Load schedule
      const scheduleQuery = query(
        collection(db, 'leagueSchedules'),
        where('seasonId', '==', seasonId)
      );
      const scheduleSnap = await getDocs(scheduleQuery);
      
      const allGames: LeagueGame[] = [];
      const scheduledAgeGroups = new Set<string>();
      const gameCountByAgeGroup: Record<string, number> = {};
      
      scheduleSnap.docs.forEach(doc => {
        const schedule = doc.data() as LeagueSchedule;
        if (schedule.ageGroup) {
          scheduledAgeGroups.add(schedule.ageGroup);
        }
        if (schedule.games) {
          allGames.push(...schedule.games.map(g => ({ ...g, scheduleId: doc.id })));
          // Count games per age group
          if (schedule.ageGroup) {
            gameCountByAgeGroup[schedule.ageGroup] = (gameCountByAgeGroup[schedule.ageGroup] || 0) + schedule.games.length;
          }
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
      
      let allTeams: Team[] = [];

      if (programIds.length > 0) {
        // Batch by 10 for Firestore limit
        for (let i = 0; i < programIds.length; i += 10) {
          const batch = programIds.slice(i, i + 10);
          const teamsQuery = query(
            collection(db, 'teams'),
            where('programId', 'in', batch)
          );
          const teamsSnap = await getDocs(teamsQuery);
          allTeams.push(...teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
        }
        setTeams(allTeams);
      }
      
      // Build age group info from season data
      const ageGroups = seasonData.ageGroups || [];
      const infos: AgeGroupInfo[] = ageGroups.map(ag => {
        const teamCount = allTeams.filter(t => t.ageGroup === ag).length;
        return {
          name: ag,
          teamCount,
          gameCount: gameCountByAgeGroup[ag] || 0,
          isScheduled: scheduledAgeGroups.has(ag),
        };
      });
      setAgeGroupInfos(infos);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
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
    const matchesAgeGroup = filterAgeGroup === 'all' || game.ageGroup === filterAgeGroup;
    return matchesTeam && matchesStatus && matchesAgeGroup;
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
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <AlertCircle className={`w-16 h-16 ${theme === 'dark' ? 'text-red-500' : 'text-red-600'}`} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <Loader2 className={`w-8 h-8 animate-spin ${theme === 'dark' ? 'text-purple-500' : 'text-purple-600'}`} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-20 ${
      theme === 'dark'
        ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 text-white'
        : 'bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900'
    }`}>
      {/* Header */}
      <div className={`border-b ${
        theme === 'dark'
          ? 'bg-black/40 backdrop-blur-xl border-white/10'
          : 'bg-white/80 backdrop-blur-xl border-slate-200'
      }`}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                to="/league/seasons" 
                className={`p-2 rounded-xl transition-colors ${
                  theme === 'dark'
                    ? 'hover:bg-white/10 text-slate-400 hover:text-white'
                    : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className={`text-xl font-bold flex items-center gap-2 ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  <Calendar className={`w-5 h-5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
                  {season?.name || 'Season Schedule'}
                </h1>
                <div className="flex items-center gap-3">
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {games.length} games scheduled
                  </p>
                  {/* Setup Progress Indicator */}
                  {ageGroupInfos.length > 0 && (() => {
                    const totalTeams = ageGroupInfos.reduce((sum, ag) => sum + ag.teamCount, 0);
                    const teamsWithGames = ageGroupInfos.reduce((sum, ag) => ag.gameCount > 0 ? sum + ag.teamCount : sum, 0);
                    const percent = totalTeams > 0 ? Math.round((teamsWithGames / totalTeams) * 100) : 0;
                    return (
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-16 rounded-full overflow-hidden ${
                          theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'
                        }`}>
                          <div 
                            className={`h-full transition-all duration-500 ${
                              percent === 100 ? 'bg-emerald-500' : 'bg-purple-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${
                          percent === 100 
                            ? 'text-emerald-400' 
                            : theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          {percent}%
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/league/seasons/${seasonId}/schedule-studio`)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white shadow-lg shadow-purple-500/25`}
              >
                <Palette className="w-4 h-4" />
                <span className="hidden sm:inline">🎨 Studio</span>
              </button>
              <button
                onClick={() => setShowEditSeason(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Edit Season</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Age Group Cards - Quick access to Schedule Studio per age group */}
      {ageGroupInfos.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className={`w-4 h-4 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
            <h2 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Age Groups
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {ageGroupInfos.filter(ag => ag.teamCount > 0).map((ag) => (
              <div
                key={ag.name}
                onClick={() => navigate(`/league/seasons/${seasonId}/schedule-studio?ageGroup=${encodeURIComponent(ag.name)}`)}
                className={`flex-shrink-0 cursor-pointer rounded-xl p-4 transition-all hover:scale-[1.02] ${
                  theme === 'dark'
                    ? 'bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-white/10'
                    : 'bg-white border border-slate-200 hover:border-purple-400 hover:shadow-md'
                }`}
                style={{ minWidth: '160px' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {ag.name}
                  </span>
                  {ag.isScheduled && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400">
                      Scheduled
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                    {ag.teamCount} teams
                  </span>
                  <span className={theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}>
                    {ag.gameCount} games
                  </span>
                </div>
                <div className={`mt-2 flex items-center gap-1 text-xs ${
                  ag.gameCount > 0 
                    ? 'text-amber-400' 
                    : theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                }`}>
                  <Palette className="w-3 h-3" />
                  {ag.gameCount > 0 ? 'Edit Schedule' : 'Open Studio'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* View Mode */}
          <div className={`flex rounded-xl p-1 ${
            theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-100 border border-slate-200'
          }`}>
            {(['list', 'calendar', 'by-team'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === mode 
                    ? 'bg-purple-600 text-white shadow-md'
                    : theme === 'dark'
                      ? 'text-slate-400 hover:text-white hover:bg-white/10'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {mode === 'by-team' ? 'By Team' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Team Filter */}
          <div className="flex items-center gap-2">
            <Filter className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className={`rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white'
                  : 'bg-white border border-slate-200 text-slate-900'
              }`}
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
            className={`rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500/50 ${
              theme === 'dark'
                ? 'bg-white/5 border border-white/10 text-white'
                : 'bg-white border border-slate-200 text-slate-900'
            }`}
          >
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Age Group Filter - only show if multiple age groups have games */}
          {ageGroupInfos.filter(ag => ag.gameCount > 0).length > 1 && (
            <select
              value={filterAgeGroup}
              onChange={(e) => setFilterAgeGroup(e.target.value)}
              className={`rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white'
                  : 'bg-white border border-slate-200 text-slate-900'
              }`}
            >
              <option value="all">All Age Groups</option>
              {ageGroupInfos.filter(ag => ag.gameCount > 0).map(ag => (
                <option key={ag.name} value={ag.name}>{ag.name} ({ag.gameCount})</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {filteredGames.length === 0 ? (
          <div className={`text-center py-12 rounded-2xl border-2 border-dashed ${
            theme === 'dark'
              ? 'bg-white/5 border-white/10'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <Calendar className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
            }`} />
            <h3 className={`text-lg font-medium ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>No Games Found</h3>
            <p className={`mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
              {filterTeam !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Add your first game to this season'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-4">
            {Object.entries(gamesByDate).map(([date, dateGames]) => {
              const isCollapsed = collapsedDates.has(date);
              const toggleCollapse = () => {
                setCollapsedDates(prev => {
                  const next = new Set(prev);
                  if (next.has(date)) {
                    next.delete(date);
                  } else {
                    next.add(date);
                  }
                  return next;
                });
              };
              
              return (
                <div key={date} className={`rounded-xl overflow-hidden border ${
                  theme === 'dark' ? 'border-white/10' : 'border-slate-200'
                }`}>
                  {/* Collapsible Header */}
                  <button
                    onClick={toggleCollapse}
                    className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${
                      theme === 'dark'
                        ? 'bg-white/5 hover:bg-white/10'
                        : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className={`w-4 h-4 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
                      <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {date}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        theme === 'dark' ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {dateGames.length} {dateGames.length === 1 ? 'game' : 'games'}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${
                      isCollapsed ? '-rotate-90' : ''
                    } ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                  </button>
                  
                  {/* Games - Collapsible */}
                  {!isCollapsed && (
                    <div className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-slate-100'}`}>
                      {dateGames.map((game, idx) => (
                        <GameCard key={`${game.homeTeamId}-${game.awayTeamId}-${idx}`} game={game} teams={teams} theme={theme} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : viewMode === 'by-team' ? (
          <div className="grid gap-6">
            {teams.map(team => {
              const teamGames = filteredGames.filter(
                g => g.homeTeamId === team.id || g.awayTeamId === team.id
              );
              if (teamGames.length === 0) return null;
              
              return (
                <div key={team.id} className={`rounded-2xl border overflow-hidden ${
                  theme === 'dark'
                    ? 'bg-white/5 border-white/10'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className={`p-4 border-b ${
                    theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <h3 className={`font-semibold flex items-center gap-2 ${
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}>
                      <Users className={`w-5 h-5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
                      {team.name}
                      <span className={`text-sm font-normal ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                      }`}>({teamGames.length} games)</span>
                    </h3>
                  </div>
                  <div className={`divide-y ${theme === 'dark' ? 'divide-white/10' : 'divide-slate-200'}`}>
                    {teamGames.map((game, idx) => (
                      <GameCard key={`${team.id}-${idx}`} game={game} teams={teams} compact theme={theme} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Calendar view - coming soon
          <div className={`rounded-2xl p-8 text-center ${
            theme === 'dark'
              ? 'bg-white/5 border border-white/10'
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <Calendar className={`w-12 h-12 mx-auto mb-4 ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
            }`} />
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
              Calendar view coming soon...
            </p>
          </div>
        )}
      </div>

      {/* Add Game Modal */}
      {showAddGame && seasonId && (
        <AddGameModal
          seasonId={seasonId}
          leagueId={leagueData.id}
          teams={teams}
          theme={theme}
          onClose={() => setShowAddGame(false)}
          onAdded={() => {
            setShowAddGame(false);
            loadData();
          }}
        />
      )}

      {/* Edit Season Modal */}
      {showEditSeason && season && (
        <EditSeasonModal
          season={season}
          theme={theme}
          onClose={() => setShowEditSeason(false)}
          onSaved={() => {
            setShowEditSeason(false);
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
  theme: 'dark' | 'light';
}

function GameCard({ game, teams, compact, theme }: GameCardProps) {
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
        return <span className={`text-xs px-2 py-0.5 rounded-full ${
          theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
        }`}>Scheduled</span>;
      case 'in_progress':
        return <span className={`text-xs px-2 py-0.5 rounded-full ${
          theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
        }`}>Live</span>;
      case 'completed':
        return <span className={`text-xs px-2 py-0.5 rounded-full ${
          theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
        }`}>Final</span>;
      case 'cancelled':
        return <span className={`text-xs px-2 py-0.5 rounded-full ${
          theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
        }`}>Cancelled</span>;
      default:
        return null;
    }
  };

  if (compact) {
    return (
      <div className={`p-3 flex items-center justify-between transition-colors ${
        theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`text-sm w-24 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            {date}
          </div>
          <div className={`text-sm w-16 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
            {time}
          </div>
          <div className="text-sm flex items-center gap-2">
            {homeTeam?.logo ? (
              <img src={homeTeam.logo} alt="" className="w-5 h-5 rounded object-cover" />
            ) : null}
            <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {homeTeam?.name || 'TBD'}
            </span>
            <span className={`mx-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>vs</span>
            {awayTeam?.logo ? (
              <img src={awayTeam.logo} alt="" className="w-5 h-5 rounded object-cover" />
            ) : null}
            <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {awayTeam?.name || 'TBD'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {game.ageGroup && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
            }`}>
              {game.ageGroup}
            </span>
          )}
          {game.status === 'completed' && (
            <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {game.homeScore} - {game.awayScore}
            </span>
          )}
          {getStatusBadge(game.status)}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-4 border transition-all ${
      theme === 'dark'
        ? 'bg-white/5 border-white/10 hover:border-purple-500/30'
        : 'bg-white border-slate-200 hover:border-purple-300 shadow-sm'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {time}
            </div>
            {game.location && (
              <div className={`text-xs flex items-center gap-1 mt-1 ${
                theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
              }`}>
                <MapPin className="w-3 h-3" />
                {game.location}
              </div>
            )}
          </div>
          
          <div className={`h-12 w-px ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />
          
          <div className="flex items-center gap-6">
            {/* Home Team */}
            <div className="text-center min-w-[120px]">
              {homeTeam?.logo ? (
                <img 
                  src={homeTeam.logo} 
                  alt={homeTeam.name}
                  className="w-10 h-10 rounded-xl object-cover mx-auto mb-1"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-1">
                  <Users className="w-5 h-5 text-white" />
                </div>
              )}
              <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {homeTeam?.name || 'TBD'}
              </div>
              <div className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Home</div>
            </div>

            {/* Score or VS */}
            <div className="text-center">
              {game.status === 'completed' ? (
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {game.homeScore}
                  </span>
                  <span className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>-</span>
                  <span className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {game.awayScore}
                  </span>
                </div>
              ) : (
                <span className={`text-xl font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  VS
                </span>
              )}
            </div>

            {/* Away Team */}
            <div className="text-center min-w-[120px]">
              {awayTeam?.logo ? (
                <img 
                  src={awayTeam.logo} 
                  alt={awayTeam.name}
                  className="w-10 h-10 rounded-xl object-cover mx-auto mb-1"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mx-auto mb-1">
                  <Users className="w-5 h-5 text-white" />
                </div>
              )}
              <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {awayTeam?.name || 'TBD'}
              </div>
              <div className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Away</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {game.ageGroup && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
            }`}>
              {game.ageGroup}
            </span>
          )}
          {getStatusBadge(game.status)}
        </div>
      </div>
    </div>
  );
}

// Edit Season Modal
interface EditSeasonModalProps {
  season: LeagueSeason;
  theme: 'dark' | 'light';
  onClose: () => void;
  onSaved: () => void;
}

function EditSeasonModal({ season, theme, onClose, onSaved }: EditSeasonModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: season.name || '',
    startDate: season.startDate instanceof Timestamp 
      ? season.startDate.toDate().toISOString().split('T')[0]
      : new Date(season.startDate as any).toISOString().split('T')[0],
    endDate: season.endDate instanceof Timestamp 
      ? season.endDate.toDate().toISOString().split('T')[0]
      : new Date(season.endDate as any).toISOString().split('T')[0],
    registrationDeadline: season.registrationDeadline instanceof Timestamp 
      ? season.registrationDeadline.toDate().toISOString().split('T')[0]
      : season.registrationDeadline 
        ? new Date(season.registrationDeadline as any).toISOString().split('T')[0]
        : '',
    status: season.status || 'upcoming'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateDoc(doc(db, 'leagueSeasons', season.id!), {
        name: formData.name,
        startDate: Timestamp.fromDate(new Date(formData.startDate)),
        endDate: Timestamp.fromDate(new Date(formData.endDate)),
        registrationDeadline: formData.registrationDeadline 
          ? Timestamp.fromDate(new Date(formData.registrationDeadline))
          : null,
        status: formData.status,
        updatedAt: Timestamp.now()
      });
      
      toastSuccess('Season updated successfully!');
      onSaved();
    } catch (error) {
      console.error('Error updating season:', error);
      toastError('Failed to update season');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSeason = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'leagueSeasons', season.id!), {
        status: 'active',
        updatedAt: Timestamp.now()
      });
      toastSuccess('Season started!');
      onSaved();
    } catch (error) {
      console.error('Error starting season:', error);
      toastError('Failed to start season');
    } finally {
      setLoading(false);
    }
  };

  const handleEndSeason = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'leagueSeasons', season.id!), {
        status: 'completed',
        updatedAt: Timestamp.now()
      });
      toastSuccess('Season ended!');
      onSaved();
    } catch (error) {
      console.error('Error ending season:', error);
      toastError('Failed to end season');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl w-full max-w-md ${
        theme === 'dark'
          ? 'bg-zinc-900 border border-white/10'
          : 'bg-white border border-slate-200 shadow-xl'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-white/10' : 'border-slate-200'
        }`}>
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>Edit Season</h2>
          <button 
            onClick={onClose} 
            className={`p-2 rounded-xl transition-colors ${
              theme === 'dark'
                ? 'hover:bg-white/10 text-slate-400'
                : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
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
              className={`w-full rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                  : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
              required
            />
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
                className={`w-full rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500/50 ${
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
                className={`w-full rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500/50 ${
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
              className={`w-full rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white'
                  : 'bg-slate-50 border border-slate-200 text-slate-900'
              }`}
            />
          </div>

          {/* Quick Actions */}
          {season.status === 'upcoming' && (
            <button
              type="button"
              onClick={handleStartSeason}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
            >
              <PlayCircle className="w-5 h-5" />
              Start Season
            </button>
          )}

          {season.status === 'active' && (
            <button
              type="button"
              onClick={handleEndSeason}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
            >
              <StopCircle className="w-5 h-5" />
              End Season
            </button>
          )}

          <div className={`flex justify-end gap-3 pt-4 border-t ${
            theme === 'dark' ? 'border-white/10' : 'border-slate-200'
          }`}>
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
              disabled={loading}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-2 rounded-xl font-medium text-white transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Game Modal
interface AddGameModalProps {
  seasonId: string;
  leagueId: string;
  teams: Team[];
  theme: 'dark' | 'light';
  onClose: () => void;
  onAdded: () => void;
}

function AddGameModal({ seasonId, leagueId, teams, theme, onClose, onAdded }: AddGameModalProps) {
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
      const homeTeam = teams.find(t => t.id === formData.homeTeamId);
      const awayTeam = teams.find(t => t.id === formData.awayTeamId);
      
      // Find or create schedule for this league/season
      const scheduleQuery = query(
        collection(db, 'leagueSchedules'),
        where('seasonId', '==', seasonId),
        where('leagueId', '==', leagueId)
      );
      const scheduleSnap = await getDocs(scheduleQuery);
      
      const newGame: Omit<LeagueGame, 'id'> & { id?: string } = {
        homeTeamId: formData.homeTeamId,
        awayTeamId: formData.awayTeamId,
        homeTeamName: homeTeam?.name || 'TBD',
        awayTeamName: awayTeam?.name || 'TBD',
        scheduledDate: Timestamp.fromDate(dateTime),
        scheduledTime: formData.time,
        dateTime: Timestamp.fromDate(dateTime),
        location: formData.location || '',
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

      toastSuccess('Game added successfully!');
      onAdded();
    } catch (error) {
      console.error('Error adding game:', error);
      toastError('Failed to add game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl w-full max-w-md ${
        theme === 'dark'
          ? 'bg-zinc-900 border border-white/10'
          : 'bg-white border border-slate-200 shadow-xl'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-white/10' : 'border-slate-200'
        }`}>
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>Add New Game</h2>
          <button 
            onClick={onClose} 
            className={`p-2 rounded-xl transition-colors ${
              theme === 'dark'
                ? 'hover:bg-white/10 text-slate-400'
                : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Home Team *
              </label>
              <select
                value={formData.homeTeamId}
                onChange={(e) => setFormData({ ...formData, homeTeamId: e.target.value })}
                className={`w-full rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500/50 ${
                  theme === 'dark'
                    ? 'bg-white/5 border border-white/10 text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-900'
                }`}
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
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Away Team *
              </label>
              <select
                value={formData.awayTeamId}
                onChange={(e) => setFormData({ ...formData, awayTeamId: e.target.value })}
                className={`w-full rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500/50 ${
                  theme === 'dark'
                    ? 'bg-white/5 border border-white/10 text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-900'
                }`}
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
              <label className={`block text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className={`w-full rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500/50 ${
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
                Time *
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className={`w-full rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500/50 ${
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
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className={`w-full rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                  : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
              placeholder="Field name or address"
            />
          </div>

          <div className={`flex justify-end gap-3 pt-4 border-t ${
            theme === 'dark' ? 'border-white/10' : 'border-slate-200'
          }`}>
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
              disabled={loading || !formData.homeTeamId || !formData.awayTeamId}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-2 rounded-xl font-medium text-white transition-colors"
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
