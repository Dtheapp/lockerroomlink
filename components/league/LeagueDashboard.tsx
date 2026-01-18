/**
 * League Owner Dashboard Component
 * World-class dashboard for League Owners to manage their league
 * 
 * Features:
 * - Dark/Light theme support
 * - Today's Games Widget (queries team game docs)
 * - Standings Preview Widget
 * - Pending Actions & Alerts
 * - Premium gradient design
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  getProgramsByLeague,
  getLeagueSeasons,
  getLeagueRequestsByLeague,
  getSeasonFinalizationStatus,
  unfinalizeTeamsForSeason
} from '../../services/leagueService';
import { collection, getDocs, query, where, orderBy, Timestamp, doc, updateDoc, serverTimestamp, deleteDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Program, LeagueSeason, LeagueSchedule, LeagueRequest, Team, TeamGame, League } from '../../types';
import { 
  Building2, 
  Users, 
  Shield, 
  Calendar, 
  Trophy, 
  Settings, 
  Plus,
  ChevronRight,
  ChevronDown,
  Bell,
  Activity,
  Loader2,
  Clock,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Radio,
  MapPin,
  TrendingUp,
  Zap,
  Award,
  Star,
  PlayCircle,
  Play,
  Square,
  Trash2,
  Lock,
  Unlock
} from 'lucide-react';

export const LeagueDashboard: React.FC = () => {
  const { user, userData, leagueData: contextLeagueData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  // Local league data state - allows manual refresh
  const [localLeagueData, setLocalLeagueData] = useState<League | null>(null);
  const [leagueLoading, setLeagueLoading] = useState(true);
  
  // Use local league data if available, otherwise fall back to context
  const leagueData = localLeagueData || contextLeagueData;
  
  // Function to load league for current sport
  const loadLeagueForSport = useCallback(async () => {
    if (!user) {
      setLeagueLoading(false);
      return;
    }
    
    const selectedSport = localStorage.getItem('commissioner_selected_sport')?.toLowerCase() || 'football';
    
    try {
      const leaguesQuery = query(
        collection(db, 'leagues'),
        where('ownerId', '==', user.uid)
      );
      const leaguesSnap = await getDocs(leaguesQuery);
      
      const matchingLeague = leaguesSnap.docs.find(doc => {
        const data = doc.data();
        return data.sport?.toLowerCase() === selectedSport;
      });
      
      if (matchingLeague) {
        setLocalLeagueData({ id: matchingLeague.id, ...matchingLeague.data() } as League);
      } else {
        setLocalLeagueData(null);
      }
    } catch (error) {
      console.error('Error loading league for sport:', error);
      setLocalLeagueData(null);
    } finally {
      setLeagueLoading(false);
    }
  }, [user]);
  
  // Load league on mount and when sport changes
  useEffect(() => {
    loadLeagueForSport();
    
    // Listen for sport changes
    const handleSportChange = () => {
      setLeagueLoading(true);
      loadLeagueForSport();
    };
    
    window.addEventListener('commissioner-sport-changed', handleSportChange);
    return () => {
      window.removeEventListener('commissioner-sport-changed', handleSportChange);
    };
  }, [loadLeagueForSport]);
  
  const [programs, setPrograms] = useState<Program[]>([]);
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [schedules, setSchedules] = useState<LeagueSchedule[]>([]);
  const [requests, setRequests] = useState<LeagueRequest[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [todaysGames, setTodaysGames] = useState<(TeamGame & { homeTeamName?: string; awayTeamName?: string })[]>([]);
  const [stats, setStats] = useState({
    totalPrograms: 0,
    totalTeams: 0,
    activeSeasons: 0,
    pendingRequests: 0,
    gamesThisWeek: 0,
    completedGames: 0,
  });
  const [seasonManagerExpanded, setSeasonManagerExpanded] = useState(true);
  const [memberProgramsExpanded, setMemberProgramsExpanded] = useState(true);
  const [seasonToDelete, setSeasonToDelete] = useState<LeagueSeason | null>(null);
  const [deletingSeason, setDeletingSeason] = useState(false);
  const [teamCountsLoaded, setTeamCountsLoaded] = useState(false);
  
  // Team finalization state
  const [finalizationStatus, setFinalizationStatus] = useState<{
    programFinalizations: { [programId: string]: any };
    allProgramsFinalized: boolean;
    totalPrograms: number;
    finalizedCount: number;
  } | null>(null);
  const [unlockingProgram, setUnlockingProgram] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueData?.id) {
      setLoading(false);
      return;
    }

    const loadDashboardData = async () => {
      try {
        // Load programs in this league
        const programsData = await getProgramsByLeague(leagueData.id!);
        setPrograms(programsData);
        
        // Load seasons
        const seasonsData = await getLeagueSeasons(leagueData.id!);
        setSeasons(seasonsData);
        
        // Fetch finalization status for active/upcoming season
        const activeSeason = seasonsData.find(s => s.status === 'active') || seasonsData.find(s => s.status === 'upcoming');
        if (activeSeason?.id) {
          try {
            const finStatus = await getSeasonFinalizationStatus(leagueData.id!, activeSeason.id);
            setFinalizationStatus(finStatus);
          } catch (err) {
            console.log('Could not fetch finalization status:', err);
          }
        }
        
        // Load schedules from leagueSchedules collection for active/upcoming season
        if (activeSeason?.id) {
          const schedulesQuery = query(
            collection(db, 'leagueSchedules'),
            where('seasonId', '==', activeSeason.id)
          );
          const schedulesSnap = await getDocs(schedulesQuery);
          const schedulesData = schedulesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as LeagueSchedule[];
          setSchedules(schedulesData);
        }
        
        // Load pending requests
        const requestsData = await getLeagueRequestsByLeague(leagueData.id!);
        setRequests(requestsData);
        
        // Count teams in league
        const teamsQuery = query(
          collection(db, 'teams'),
          where('leagueId', '==', leagueData.id)
        );
        const teamsSnap = await getDocs(teamsQuery);
        setTeamCount(teamsSnap.size);
        
        // Fetch today's league games from team game collections
        // Query all programs in league, then their active season games
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        let allGames: (TeamGame & { homeTeamName?: string; awayTeamName?: string })[] = [];
        let weekGamesCount = 0;
        let completedCount = 0;
        
        // Use active season found earlier
        const activeSeasonForGames = seasonsData.find(s => s.status === 'active');
        
        if (activeSeasonForGames && programsData.length > 0) {
          // Query games from each program's season that are league games
          for (const program of programsData) {
            try {
              const gamesQuery = query(
                collection(db, 'programs', program.id!, 'seasons', activeSeasonForGames.id!, 'games'),
                where('isLeagueGame', '==', true),
                where('leagueId', '==', leagueData.id)
              );
              const gamesSnap = await getDocs(gamesQuery);
              
              gamesSnap.docs.forEach(doc => {
                const game = { id: doc.id, ...doc.data() } as TeamGame;
                
                // Check if game is today
                const gameDate = game.date instanceof Timestamp 
                  ? game.date.toDate() 
                  : new Date(game.date as any);
                gameDate.setHours(0, 0, 0, 0);
                
                if (gameDate.getTime() === today.getTime()) {
                  // Avoid duplicates (same game from both team's collections)
                  if (!allGames.some(g => g.id === game.id || (g as any).leagueGameId === (game as any).leagueGameId)) {
                    allGames.push({
                      ...game,
                      homeTeamName: game.homeTeam || (game as any).homeTeamName,
                      awayTeamName: game.opponent || (game as any).awayTeamName
                    });
                  }
                }
                
                // Count games this week
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                if (gameDate >= weekAgo && gameDate <= tomorrow) {
                  weekGamesCount++;
                }
                
                // Count completed
                if (game.status === 'completed') {
                  completedCount++;
                }
              });
            } catch (err) {
              console.log('Error fetching games for program:', program.id, err);
            }
          }
        }
        
        setTodaysGames(allGames);
        
        // Calculate stats
        setStats({
          totalPrograms: programsData.length,
          totalTeams: teamsSnap.size,
          activeSeasons: seasonsData.filter(s => s.status === 'active' || s.status === 'upcoming' || s.status === 'playoffs').length,
          pendingRequests: requestsData.filter(r => r.status === 'pending').length,
          gamesThisWeek: Math.floor(weekGamesCount / 2), // Divide by 2 since each game appears for both teams
          completedGames: Math.floor(completedCount / 2),
        });
        
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [leagueData?.id]);

  // Real-time listener for finalization status on active season
  useEffect(() => {
    if (!leagueData?.id || seasons.length === 0) return;
    
    const activeSeason = seasons.find(s => s.status === 'active') || seasons.find(s => s.status === 'upcoming');
    if (!activeSeason?.id) return;
    
    // Listen to the leagueSeasons document for real-time updates
    const unsubscribe = onSnapshot(
      doc(db, 'leagueSeasons', activeSeason.id),
      async (snapshot) => {
        if (snapshot.exists()) {
          // Recalculate finalization status when document changes
          const finStatus = await getSeasonFinalizationStatus(leagueData.id!, activeSeason.id);
          setFinalizationStatus(finStatus);
        }
      },
      (error) => {
        console.log('Finalization listener error:', error);
      }
    );
    
    return () => unsubscribe();
  }, [leagueData?.id, seasons]);

  // Load team counts and age groups for programs - always load fresh counts for this league
  useEffect(() => {
    if (!leagueData?.id || programs.length === 0 || teamCountsLoaded) return;
    
    const loadTeamCounts = async () => {
      const programsWithCounts = await Promise.all(
        programs.map(async (program) => {
          const teamsSnap = await getDocs(
            query(
              collection(db, 'teams'), 
              where('programId', '==', program.id),
              where('leagueId', '==', leagueData.id)
            )
          );
          // Get unique age groups from teams
          const ageGroups = [...new Set(teamsSnap.docs.map(d => d.data().ageGroup).filter(Boolean))] as string[];
          return { ...program, teamCount: teamsSnap.size, leagueAgeGroups: ageGroups };
        })
      );
      setPrograms(programsWithCounts);
      setTeamCountsLoaded(true);
    };
    
    loadTeamCounts();
  }, [leagueData?.id, programs.length, teamCountsLoaded]);

  // Handle unlocking a program's teams
  const handleUnlockProgram = async (programId: string) => {
    if (!leagueData?.id) return;
    
    const activeSeason = seasons.find(s => s.status === 'active') || seasons.find(s => s.status === 'upcoming');
    if (!activeSeason?.id) return;
    
    setUnlockingProgram(programId);
    try {
      await unfinalizeTeamsForSeason(leagueData.id, activeSeason.id, programId);
      
      // Refresh finalization status
      const finStatus = await getSeasonFinalizationStatus(leagueData.id, activeSeason.id);
      setFinalizationStatus(finStatus);
    } catch (error) {
      console.error('Error unlocking program:', error);
    } finally {
      setUnlockingProgram(null);
    }
  };

  if (loading || leagueLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className={`w-8 h-8 animate-spin ${
            theme === 'dark' ? 'text-purple-500' : 'text-purple-600'
          }`} />
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Loading league data...
          </p>
        </div>
      </div>
    );
  }

  if (!userData || (userData.role !== 'LeagueOwner' && userData.role !== 'LeagueCommissioner')) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <div className={`text-center p-8 rounded-2xl ${
          theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-lg'
        }`}>
          <Building2 className={`w-16 h-16 mx-auto mb-4 ${
            theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
          }`} />
          <h2 className={`text-xl font-semibold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>Access Denied</h2>
          <p className={`mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            You need to be a League Owner to view this page.
          </p>
        </div>
      </div>
    );
  }

  // No league yet for this sport - show create league flow
  if (!leagueData) {
    // Get current selected sport from localStorage
    const selectedSport = typeof window !== 'undefined' 
      ? localStorage.getItem('commissioner_selected_sport') || 'Football'
      : 'Football';
    
    return (
      <div className={`min-h-screen pb-20 ${
        theme === 'dark' 
          ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950' 
          : 'bg-gradient-to-br from-slate-50 via-white to-slate-100'
      }`}>
        <div className="max-w-2xl mx-auto px-4 py-12">
          {/* Welcome Hero */}
          <div className={`text-center mb-8 p-8 rounded-2xl ${
            theme === 'dark'
              ? 'bg-gradient-to-br from-purple-900/30 to-blue-900/20 border border-purple-500/20'
              : 'bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200'
          }`}>
            <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
              theme === 'dark'
                ? 'bg-gradient-to-br from-purple-600/30 to-blue-600/30'
                : 'bg-gradient-to-br from-purple-100 to-blue-100'
            }`}>
              <Trophy className={`w-10 h-10 ${
                theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
              }`} />
            </div>
            <h1 className={`text-2xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              No {selectedSport} League Yet
            </h1>
            <p className={`text-lg mb-6 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
            }`}>
              You don't have a {selectedSport.toLowerCase()} league set up. Create one to get started!
            </p>
            <Link
              to="/league/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/25"
            >
              <Plus className="w-5 h-5" />
              Create {selectedSport} League
            </Link>
          </div>

          {/* Getting Started Steps */}
          <div className={`rounded-2xl p-6 ${
            theme === 'dark'
              ? 'bg-white/5 border border-white/10'
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              <Star className="w-5 h-5 text-amber-400" />
              Getting Started
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  theme === 'dark'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-purple-100 text-purple-600'
                }`}>1</div>
                <div>
                  <h3 className={`font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>Create Your League</h3>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>Set up your league with name, sport, and location</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  theme === 'dark'
                    ? 'bg-slate-700 text-slate-400'
                    : 'bg-slate-100 text-slate-500'
                }`}>2</div>
                <div>
                  <h3 className={`font-medium ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                  }`}>Invite Programs to Join</h3>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                  }`}>Share your league code so program commissioners can register</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  theme === 'dark'
                    ? 'bg-slate-700 text-slate-400'
                    : 'bg-slate-100 text-slate-500'
                }`}>3</div>
                <div>
                  <h3 className={`font-medium ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                  }`}>Create Schedules & Manage Games</h3>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                  }`}>Build season schedules and assign referees</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const activeSeason = seasons.find(s => s.status === 'active');
  const upcomingSeason = seasons.find(s => s.status === 'upcoming');
  const displaySeason = activeSeason || upcomingSeason; // Show active first, then upcoming
  
  // Check if a season has schedules created
  const seasonHasSchedule = (seasonId: string): boolean => {
    return schedules.some(s => s.leagueSeasonId === seasonId || (s as any).seasonId === seasonId);
  };
  
  // Live games (status === 'live')
  const liveGames = todaysGames.filter(g => g.status === 'live');
  const upcomingGames = todaysGames.filter(g => g.status !== 'live' && g.status !== 'completed');

  return (
    <div className={`min-h-screen pb-20 ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950' 
        : 'bg-gradient-to-br from-slate-50 via-white to-slate-100'
    }`}>
      {/* Premium Header */}
      <div className={`relative overflow-hidden ${
        theme === 'dark'
          ? 'bg-gradient-to-r from-purple-900/40 via-zinc-900 to-blue-900/30'
          : 'bg-gradient-to-r from-purple-100 via-white to-blue-50'
      } border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className={`absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl ${
            theme === 'dark' ? 'bg-purple-600/10' : 'bg-purple-200/30'
          }`} />
          <div className={`absolute -bottom-24 -left-24 w-96 h-96 rounded-full blur-3xl ${
            theme === 'dark' ? 'bg-blue-600/10' : 'bg-blue-200/30'
          }`} />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* League logo/icon */}
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden ${
                theme === 'dark'
                  ? 'bg-gradient-to-br from-purple-600/30 to-blue-600/30 border border-purple-500/30'
                  : 'bg-gradient-to-br from-purple-100 to-blue-100 border border-purple-200'
              }`}>
                {leagueData?.logoUrl ? (
                  <img src={leagueData.logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className={`w-8 h-8 ${
                    theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                  }`} />
                )}
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {leagueData?.name || 'League Dashboard'}
                </h1>
                <p className={`text-sm flex items-center gap-2 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    theme === 'dark'
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {leagueData?.sport}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {leagueData?.city}, {leagueData?.state}
                  </span>
                </p>
                {/* Age Groups Display */}
                {leagueData?.ageGroups && leagueData.ageGroups.length > 0 && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs ${
                      theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
                    }`}>Age Groups:</span>
                    {leagueData.ageGroups.map((ag) => (
                      <span
                        key={ag}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          theme === 'dark'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {ag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Link
              to="/league/settings"
              className={`p-2.5 rounded-xl transition-all ${
                theme === 'dark'
                  ? 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10'
                  : 'bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-sm'
              }`}
            >
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Warning Banners */}
        {(!leagueData?.ageGroups || leagueData.ageGroups.length === 0) && (
          <div className={`rounded-2xl p-4 flex items-center justify-between ${
            theme === 'dark'
              ? 'bg-amber-900/30 border border-amber-500/20'
              : 'bg-amber-50 border border-amber-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                theme === 'dark' ? 'bg-amber-500/20' : 'bg-amber-100'
              }`}>
                <AlertTriangle className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                }`} />
              </div>
              <div>
                <p className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>Set Up Age Groups</p>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>Configure age groups before creating seasons</p>
              </div>
            </div>
            <Link
              to="/league/settings"
              className={`flex items-center gap-1 text-sm font-medium px-4 py-2 rounded-xl ${
                theme === 'dark'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              <Settings className="w-4 h-4" /> Go to Settings
            </Link>
          </div>
        )}

        {/* Stats Grid - Premium Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/league/programs" className={`group rounded-2xl p-4 transition-all ${
            theme === 'dark'
              ? 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30'
              : 'bg-white hover:shadow-lg border border-slate-200 hover:border-purple-200'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
              }`}>
                <Shield className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                }`} />
              </div>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>Programs</span>
            </div>
            <p className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>{stats.totalPrograms}</p>
            <p className={`text-xs mt-1 flex items-center gap-1 ${
              theme === 'dark' ? 'text-slate-500 group-hover:text-purple-400' : 'text-slate-400 group-hover:text-purple-600'
            }`}>
              <TrendingUp className="w-3 h-3" /> View all
            </p>
          </Link>
          
          <Link to="/league/programs" className={`group rounded-2xl p-4 transition-all ${
            theme === 'dark'
              ? 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/30'
              : 'bg-white hover:shadow-lg border border-slate-200 hover:border-blue-200'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
              }`}>
                <Users className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`} />
              </div>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>Teams</span>
            </div>
            <p className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>{stats.totalTeams}</p>
            <p className={`text-xs mt-1 flex items-center gap-1 ${
              theme === 'dark' ? 'text-slate-500 group-hover:text-blue-400' : 'text-slate-400 group-hover:text-blue-600'
            }`}>
              <TrendingUp className="w-3 h-3" /> View all
            </p>
          </Link>
          
          <Link to="/league/seasons" className={`group rounded-2xl p-4 transition-all ${
            theme === 'dark'
              ? 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30'
              : 'bg-white hover:shadow-lg border border-slate-200 hover:border-emerald-200'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'
              }`}>
                <Trophy className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
              </div>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>Seasons</span>
            </div>
            <p className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>{stats.activeSeasons}</p>
            <p className={`text-xs mt-1 flex items-center gap-1 ${
              theme === 'dark' ? 'text-slate-500 group-hover:text-emerald-400' : 'text-slate-400 group-hover:text-emerald-600'
            }`}>
              <Calendar className="w-3 h-3" /> Manage
            </p>
          </Link>
          
          <Link to="/league/requests" className={`group relative rounded-2xl p-4 transition-all ${
            theme === 'dark'
              ? 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/30'
              : 'bg-white hover:shadow-lg border border-slate-200 hover:border-amber-200'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                theme === 'dark' ? 'bg-amber-500/20' : 'bg-amber-100'
              }`}>
                <Clock className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                }`} />
              </div>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>Pending Requests</span>
            </div>
            <p className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>{stats.pendingRequests}</p>
            {stats.pendingRequests > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                {stats.pendingRequests}
              </span>
            )}
            <p className={`text-xs mt-1 flex items-center gap-1 ${
              theme === 'dark' ? 'text-slate-500 group-hover:text-amber-400' : 'text-slate-400 group-hover:text-amber-600'
            }`}>
              <Bell className="w-3 h-3" /> Review
            </p>
          </Link>
        </div>

        {/* Today's Games Widget */}
        {(liveGames.length > 0 || upcomingGames.length > 0) && (
          <div className={`rounded-2xl overflow-hidden ${
            theme === 'dark'
              ? 'bg-white/5 border border-white/10'
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <div className={`px-4 py-3 border-b flex items-center justify-between ${
              theme === 'dark' ? 'border-white/10' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <Radio className={`w-5 h-5 ${
                  liveGames.length > 0
                    ? 'text-red-500 animate-pulse'
                    : theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                }`} />
                <h2 className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {liveGames.length > 0 ? 'Live Games' : "Today's Games"}
                </h2>
                {liveGames.length > 0 && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-full animate-pulse">
                    {liveGames.length} LIVE
                  </span>
                )}
              </div>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                {todaysGames.length} game{todaysGames.length !== 1 ? 's' : ''} today
              </span>
            </div>
            
            <div className="divide-y divide-white/5">
              {/* Live games first */}
              {liveGames.map((game) => (
                <div
                  key={game.id}
                  className={`p-4 flex items-center justify-between ${
                    theme === 'dark' ? 'bg-red-500/5' : 'bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
                      LIVE
                    </span>
                    <div>
                      <p className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>
                        {game.homeTeamName || game.homeTeam} vs {game.awayTeamName || game.opponent}
                      </p>
                      <p className={`text-sm ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {(game as any).location || game.venue || 'TBD'}
                      </p>
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    {game.homeScore ?? 0} - {game.awayScore ?? 0}
                  </div>
                </div>
              ))}
              
              {/* Upcoming games */}
              {upcomingGames.slice(0, 3).map((game) => (
                <div
                  key={game.id}
                  className={`p-4 flex items-center justify-between ${
                    theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      theme === 'dark'
                        ? 'bg-slate-700 text-slate-300'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {game.time || 'TBD'}
                    </span>
                    <div>
                      <p className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>
                        {game.homeTeamName || game.homeTeam} vs {game.awayTeamName || game.opponent}
                      </p>
                      <p className={`text-sm ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {(game as any).location || game.venue || 'TBD'}
                      </p>
                    </div>
                  </div>
                  <PlayCircle className={`w-5 h-5 ${
                    theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                  }`} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <Link
            to="/league/programs"
            className={`rounded-2xl p-4 flex flex-col items-center gap-2 transition-all group ${
              theme === 'dark'
                ? 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30'
                : 'bg-white hover:shadow-lg border border-slate-200 hover:border-purple-200'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              theme === 'dark'
                ? 'bg-purple-500/20 group-hover:bg-purple-500/30'
                : 'bg-purple-100 group-hover:bg-purple-200'
            }`}>
              <Shield className={`w-6 h-6 ${
                theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
              }`} />
            </div>
            <span className={`font-medium text-sm ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>Programs</span>
          </Link>
          
          <Link
            to="/league/seasons"
            className={`rounded-2xl p-4 flex flex-col items-center gap-2 transition-all group ${
              theme === 'dark'
                ? 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/30'
                : 'bg-white hover:shadow-lg border border-slate-200 hover:border-blue-200'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              theme === 'dark'
                ? 'bg-blue-500/20 group-hover:bg-blue-500/30'
                : 'bg-blue-100 group-hover:bg-blue-200'
            }`}>
              <Calendar className={`w-6 h-6 ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`} />
            </div>
            <span className={`font-medium text-sm ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>Seasons</span>
          </Link>
          
          <Link
            to="/league/standings"
            className={`rounded-2xl p-4 flex flex-col items-center gap-2 transition-all group ${
              theme === 'dark'
                ? 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30'
                : 'bg-white hover:shadow-lg border border-slate-200 hover:border-emerald-200'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              theme === 'dark'
                ? 'bg-emerald-500/20 group-hover:bg-emerald-500/30'
                : 'bg-emerald-100 group-hover:bg-emerald-200'
            }`}>
              <Activity className={`w-6 h-6 ${
                theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
              }`} />
            </div>
            <span className={`font-medium text-sm ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>Standings</span>
          </Link>
          
          <Link
            to="/league/playoffs"
            className={`rounded-2xl p-4 flex flex-col items-center gap-2 transition-all group ${
              theme === 'dark'
                ? 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/30'
                : 'bg-white hover:shadow-lg border border-slate-200 hover:border-amber-200'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              theme === 'dark'
                ? 'bg-amber-500/20 group-hover:bg-amber-500/30'
                : 'bg-amber-100 group-hover:bg-amber-200'
            }`}>
              <Award className={`w-6 h-6 ${
                theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
              }`} />
            </div>
            <span className={`font-medium text-sm ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>Playoffs</span>
          </Link>
          
          <Link
            to="/league/infractions"
            className={`rounded-2xl p-4 flex flex-col items-center gap-2 transition-all group ${
              theme === 'dark'
                ? 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/30'
                : 'bg-white hover:shadow-lg border border-slate-200 hover:border-red-200'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              theme === 'dark'
                ? 'bg-red-500/20 group-hover:bg-red-500/30'
                : 'bg-red-100 group-hover:bg-red-200'
            }`}>
              <AlertTriangle className={`w-6 h-6 ${
                theme === 'dark' ? 'text-red-400' : 'text-red-600'
              }`} />
            </div>
            <span className={`font-medium text-sm ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>Infractions</span>
          </Link>
          
          <Link
            to="/league/requests"
            className={`relative rounded-2xl p-4 flex flex-col items-center gap-2 transition-all group ${
              theme === 'dark'
                ? 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/30'
                : 'bg-white hover:shadow-lg border border-slate-200 hover:border-orange-200'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              theme === 'dark'
                ? 'bg-orange-500/20 group-hover:bg-orange-500/30'
                : 'bg-orange-100 group-hover:bg-orange-200'
            }`}>
              <FileText className={`w-6 h-6 ${
                theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
              }`} />
            </div>
            <span className={`font-medium text-sm ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>Requests</span>
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </Link>
        </div>

        {/* Season Manager Section - Collapsible */}
        <div className={`rounded-2xl border overflow-hidden ${
          theme === 'dark'
            ? 'bg-white/5 border-white/10'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div 
            className={`px-4 py-3 border-b flex items-center justify-between cursor-pointer select-none ${
              theme === 'dark' ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => setSeasonManagerExpanded(!seasonManagerExpanded)}
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={`w-5 h-5 transition-transform ${
                seasonManagerExpanded ? '' : '-rotate-90'
              } ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
              <h2 className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>Season Manager</h2>
            </div>
            <Link
              to="/league/seasons"
              onClick={(e) => e.stopPropagation()}
              className={`text-sm flex items-center gap-1 ${
                theme === 'dark' 
                  ? 'text-purple-400 hover:text-purple-300' 
                  : 'text-purple-600 hover:text-purple-700'
              }`}
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {seasonManagerExpanded && displaySeason ? (
            <div className={`transition-colors ${
              theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'
            }`}>
              <Link 
                to={`/league/seasons/${displaySeason.id}`}
                className="block px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    displaySeason.status === 'active' 
                      ? 'bg-green-500/20' 
                      : 'bg-blue-500/20'
                  }`}>
                    <Calendar className={`w-5 h-5 ${
                      displaySeason.status === 'active' 
                        ? 'text-green-400' 
                        : 'text-blue-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}>{displaySeason.name}</p>
                    <div className={`text-sm flex items-center gap-2 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {displaySeason.status === 'active' ? (
                        <span className="flex items-center gap-1 text-green-400">
                          <Play className="w-3 h-3" /> In Season
                        </span>
                      ) : displaySeason.status === 'upcoming' ? (
                        <span className="flex items-center gap-1 text-blue-400">
                          <Clock className="w-3 h-3" /> Upcoming
                        </span>
                      ) : null}
                      {displaySeason.startDate && displaySeason.endDate && (
                        <span className="text-xs">
                          • {new Date(displaySeason.startDate instanceof Timestamp ? displaySeason.startDate.toDate() : displaySeason.startDate as any).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(displaySeason.endDate instanceof Timestamp ? displaySeason.endDate.toDate() : displaySeason.endDate as any).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
              
              {/* Age Group Pills */}
              {(displaySeason as any).ageGroups?.length > 0 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                  {(displaySeason as any).ageGroups.slice(0, 5).map((ag: string, idx: number) => (
                    <span 
                      key={idx} 
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        theme === 'dark' 
                          ? 'bg-white/10 text-slate-300' 
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {ag}
                    </span>
                  ))}
                  {(displaySeason as any).ageGroups.length > 5 && (
                    <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      +{(displaySeason as any).ageGroups.length - 5} more
                    </span>
                  )}
                </div>
              )}
              
              {/* Team Finalization Status */}
              {finalizationStatus && finalizationStatus.totalPrograms > 0 && (
                <div className={`mx-4 mb-3 p-3 rounded-lg ${
                  finalizationStatus.allProgramsFinalized
                    ? theme === 'dark' ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'
                    : theme === 'dark' ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {finalizationStatus.allProgramsFinalized ? (
                      <Lock className="w-4 h-4 text-green-500" />
                    ) : (
                      <Unlock className="w-4 h-4 text-amber-500" />
                    )}
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {finalizationStatus.finalizedCount}/{finalizationStatus.totalPrograms} Programs Ready
                    </span>
                    {finalizationStatus.allProgramsFinalized && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                    )}
                  </div>
                  <div className="space-y-1">
                    {programs.map(program => {
                      const pFinal = finalizationStatus.programFinalizations[program.id!];
                      const isFinalized = pFinal?.finalized;
                      // Use sport-specific name if available
                      const sportName = (program as any).sportNames?.[leagueData?.sport || ''] || program.name;
                      // Get age groups from loaded team data (leagueAgeGroups)
                      const ageGroupsList = (program as any).leagueAgeGroups || [];
                      // Check if any schedules exist for this season
                      const hasSchedules = schedules.length > 0;
                      return (
                        <div key={program.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isFinalized ? (
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-500" />
                            )}
                            <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                              {sportName}
                            </span>
                            {isFinalized && (
                              <span className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>
                                ({pFinal.teamCount} teams)
                              </span>
                            )}
                            {ageGroupsList.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {ageGroupsList.map((ag: string) => (
                                  <span key={ag} className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[10px]">
                                    {ag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {isFinalized && !hasSchedules && (
                            <button
                              onClick={() => handleUnlockProgram(program.id!)}
                              disabled={unlockingProgram === program.id}
                              className="text-xs px-2 py-0.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded transition-colors"
                            >
                              {unlockingProgram === program.id ? 'Unlocking...' : 'Unlock'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="px-4 pb-3 flex flex-wrap gap-2">
                {displaySeason.status === 'upcoming' && (
                  <button
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'leagueSeasons', displaySeason.id!), {
                          status: 'active',
                          updatedAt: serverTimestamp()
                        });
                        // Refresh page
                        window.location.reload();
                      } catch (error) {
                        console.error('Error starting season:', error);
                      }
                    }}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Start Season
                  </button>
                )}
                
                {displaySeason.status === 'active' && (
                  <button
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'leagueSeasons', displaySeason.id!), {
                          status: 'completed',
                          updatedAt: serverTimestamp()
                        });
                        window.location.reload();
                      } catch (error) {
                        console.error('Error ending season:', error);
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Square className="w-3.5 h-3.5" />
                    End Season
                  </button>
                )}
                
                {finalizationStatus?.allProgramsFinalized ? (
                  <Link
                    to={`/league/seasons/${displaySeason.id}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      theme === 'dark'
                        ? 'bg-white/10 hover:bg-white/20 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {seasonHasSchedule(displaySeason.id) ? 'Edit Schedule' : 'Build Schedule'}
                  </Link>
                ) : (
                  <div
                    title="All programs must finalize their teams before scheduling"
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-not-allowed opacity-50 ${
                      theme === 'dark'
                        ? 'bg-white/5 text-slate-400'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {seasonHasSchedule(displaySeason.id) ? 'Edit Schedule' : 'Build Schedule'}
                    <Lock className="w-3 h-3 ml-1" />
                  </div>
                )}
                
                <button
                  onClick={() => setSeasonToDelete(displaySeason)}
                  className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ) : seasonManagerExpanded ? (
            <div className="p-6 text-center">
              <Calendar className={`w-12 h-12 mx-auto mb-3 ${
                theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
              }`} />
              <p className={`mb-2 font-medium ${
                theme === 'dark' ? 'text-white' : 'text-slate-800'
              }`}>No Seasons Yet</p>
              <p className={`mb-4 text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>Create your first season to start scheduling games.</p>
              <Link
                to="/league/seasons"
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Create Season
              </Link>
            </div>
          ) : null}
        </div>

        {/* Programs List - Collapsible */}
        <div className={`rounded-2xl overflow-hidden ${
          theme === 'dark'
            ? 'bg-white/5 border border-white/10'
            : 'bg-white border border-slate-200 shadow-sm'
        }`}>
          <div 
            className={`px-4 py-3 border-b flex items-center justify-between cursor-pointer select-none ${
              theme === 'dark' ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => setMemberProgramsExpanded(!memberProgramsExpanded)}
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={`w-5 h-5 transition-transform ${
                memberProgramsExpanded ? '' : '-rotate-90'
              } ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
              <h2 className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>Member Programs</h2>
            </div>
            <Link
              to="/league/programs"
              onClick={(e) => e.stopPropagation()}
              className={`text-sm flex items-center gap-1 ${
                theme === 'dark'
                  ? 'text-purple-400 hover:text-purple-300'
                  : 'text-purple-600 hover:text-purple-700'
              }`}
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {memberProgramsExpanded && programs.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className={`w-12 h-12 mx-auto mb-3 ${
                theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
              }`} />
              <p className={`mb-2 ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>No programs have joined the league yet</p>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
              }`}>Programs can request to join through their Commissioner dashboard</p>
            </div>
          ) : memberProgramsExpanded ? (
            <div className={`divide-y ${
              theme === 'dark' ? 'divide-white/5' : 'divide-slate-100'
            }`}>
              {programs.slice(0, 5).map((program) => {
                // Use sport-specific name if available
                const sportName = (program as any).sportNames?.[leagueData?.sport || ''] || program.name;
                return (
                <Link
                  key={program.id}
                  to={`/league/programs?highlight=${program.id}`}
                  className={`flex items-center justify-between px-4 py-3 transition-colors ${
                    theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
                    }`}>
                      {(program as any).logo ? (
                        <img src={(program as any).logo} alt="" className="w-6 h-6 object-contain rounded" />
                      ) : (
                        <Shield className={`w-5 h-5 ${
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                        }`} />
                      )}
                    </div>
                    <div>
                      <p className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>{sportName}</p>
                      <p className={`text-sm ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {program.city}, {program.state} • {program.teamCount || 0} teams
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 ${
                    theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                  }`} />
                </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Pending Requests Alert */}
        {pendingRequests.length > 0 && (
          <div className={`rounded-2xl overflow-hidden ${
            theme === 'dark'
              ? 'bg-amber-500/10 border border-amber-500/20'
              : 'bg-amber-50 border border-amber-200'
          }`}>
            <div className={`px-4 py-3 border-b flex items-center justify-between ${
              theme === 'dark' ? 'border-amber-500/20' : 'border-amber-200'
            }`}>
              <div className="flex items-center gap-2">
                <Bell className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                }`} />
                <h2 className={`font-semibold ${
                  theme === 'dark' ? 'text-amber-400' : 'text-amber-700'
                }`}>Pending Requests</h2>
              </div>
              <Link
                to="/league/requests"
                className={`text-sm flex items-center gap-1 ${
                  theme === 'dark'
                    ? 'text-amber-400 hover:text-amber-300'
                    : 'text-amber-600 hover:text-amber-700'
                }`}
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className={`divide-y ${
              theme === 'dark' ? 'divide-amber-500/10' : 'divide-amber-100'
            }`}>
              {pendingRequests.slice(0, 3).map((request) => (
                <Link
                  key={request.id}
                  to={`/league/requests/${request.id}`}
                  className={`flex items-center justify-between px-4 py-3 transition-colors ${
                    theme === 'dark' ? 'hover:bg-amber-500/5' : 'hover:bg-amber-100/50'
                  }`}
                >
                  <div>
                    <p className={`font-medium ${
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}>{request.teamName}</p>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Requesting to join league
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    theme === 'dark'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    Pending
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Delete Season Confirmation Modal */}
      {seasonToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl w-full max-w-md border ${
            theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-200 shadow-xl'
          }`}>
            <div className={`p-4 border-b ${
              theme === 'dark' ? 'border-white/10' : 'border-slate-200'
            }`}>
              <h2 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>Delete Season</h2>
            </div>
            
            <div className="p-4">
              <div className={`p-4 rounded-xl mb-4 ${
                theme === 'dark' ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className={`font-medium ${
                      theme === 'dark' ? 'text-red-400' : 'text-red-700'
                    }`}>This action cannot be undone</p>
                    <p className={`text-sm mt-1 ${
                      theme === 'dark' ? 'text-red-400/80' : 'text-red-600'
                    }`}>
                      Deleting this season will remove all schedules and game data associated with it.
                    </p>
                  </div>
                </div>
              </div>
              
              <p className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                Are you sure you want to delete <strong>{seasonToDelete.name}</strong>?
              </p>
            </div>
            
            <div className={`p-4 border-t flex gap-3 ${
              theme === 'dark' ? 'border-white/10' : 'border-slate-200'
            }`}>
              <button
                onClick={() => setSeasonToDelete(null)}
                disabled={deletingSeason}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
                  theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeletingSeason(true);
                  try {
                    await deleteDoc(doc(db, 'leagueSeasons', seasonToDelete.id!));
                    setSeasons(seasons.filter(s => s.id !== seasonToDelete.id));
                    setSeasonToDelete(null);
                  } catch (error) {
                    console.error('Error deleting season:', error);
                  } finally {
                    setDeletingSeason(false);
                  }
                }}
                disabled={deletingSeason}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {deletingSeason ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Season
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeagueDashboard;
