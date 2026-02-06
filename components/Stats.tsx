import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, onSnapshot, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import GameStatsEntryV2 from './stats/GameStatsEntryV2';
import TeamStatsSummary from './stats/TeamStatsSummary';
import StatsDashboard from './stats/StatsDashboard';
import PlayerStatsDashboard from './stats/PlayerStatsDashboard';
import type { Team, PlayerSeasonStats, Player } from '../types';
import { BarChart3, Users, TrendingUp, ArrowUpDown, ChevronDown, ChevronUp, Trophy, User, Gamepad2, RefreshCw } from 'lucide-react';
import NoAthleteBlock from './NoAthleteBlock';
import { getStats, getSportConfig, type StatConfig } from '../config/sportConfig';
import { toastSuccess, toastError } from '../services/toast';

const Stats: React.FC = () => {
  const { userData, teamData, players, loading: authLoading, selectedPlayer } = useAuth();
  const { theme } = useTheme();
  const currentYear = new Date().getFullYear();
  const isDark = theme === 'dark';
  
  // Parent view mode toggle (my stats vs team stats)
  const [parentViewMode, setParentViewMode] = useState<'my' | 'team'>('my');
  
  // Collapsible section states
  const [teamStatsExpanded, setTeamStatsExpanded] = useState(true);
  const [gameStatsExpanded, setGameStatsExpanded] = useState(true);
  
  // SuperAdmin states
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [teamStats, setTeamStats] = useState<PlayerSeasonStats[]>([]);
  const [loading, setLoading] = useState(false);

  // Sorting State for SuperAdmin view
  const [sortField, setSortField] = useState<string>('gamesPlayed');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Get sport config from selected team (for SuperAdmin) or teamData
  const selectedTeam = useMemo(() => 
    teams.find(t => t.id === selectedTeamId), 
    [teams, selectedTeamId]
  );
  const sportStats = useMemo(() => getStats(selectedTeam?.sport || teamData?.sport), [selectedTeam?.sport, teamData?.sport]);
  const sportConfig = useMemo(() => getSportConfig(selectedTeam?.sport || teamData?.sport), [selectedTeam?.sport, teamData?.sport]);

  // Set initial sort field based on sport
  useEffect(() => {
    if (sportStats.length > 1) {
      setSortField(sportStats[1].key); // Skip gamesPlayed, use first actual stat
    }
  }, [sportStats]);

  // Fetch all teams for SuperAdmin
  useEffect(() => {
    if (userData?.role === 'SuperAdmin') {
      const fetchTeams = async () => {
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        const teamsData = teamsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Team));
        setTeams(teamsData);
        if (teamsData.length > 0) {
          setSelectedTeamId(teamsData[0].id);
        }
      };
      fetchTeams();
    }
  }, [userData?.role]);

  // Fetch stats for selected team (SuperAdmin only)
  useEffect(() => {
    if (userData?.role === 'SuperAdmin' && selectedTeamId) {
      setLoading(true);
      const statsQuery = query(
        collection(db, 'teams', selectedTeamId, 'seasonStats'),
        where('season', '==', currentYear)
      );
      const unsub = onSnapshot(statsQuery, (snapshot) => {
        const stats = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PlayerSeasonStats));
        setTeamStats(stats);
        setLoading(false);
      });
      return () => unsub();
    }
  }, [selectedTeamId, userData?.role, currentYear]);

  // Calculate top stats for SuperAdmin view (dynamic based on sport)
  const topLeaders = useMemo(() => {
    if (teamStats.length === 0 || sportStats.length < 3) return null;
    
    const getTopPlayer = (statKey: string) => {
      return teamStats.reduce((prev, current) => {
        const prevVal = (prev as any)[statKey] || 0;
        const currVal = (current as any)[statKey] || 0;
        return currVal > prevVal ? current : prev;
      }, teamStats[0]);
    };

    // Get top 3 stats for leaders (skip gamesPlayed)
    const leaderStats = sportStats.filter(s => s.key !== 'gamesPlayed').slice(0, 3);
    
    return leaderStats.map((stat, idx) => ({
      stat,
      player: getTopPlayer(stat.key),
      color: idx === 0 ? 'purple' : idx === 1 ? 'cyan' : 'emerald'
    }));
  }, [teamStats, sportStats]);

  // Client-Side Sorting Logic for SuperAdmin (dynamic)
  const sortedStats = useMemo(() => {
    return [...teamStats].sort((a, b) => {
      const aValue = (a as any)[sortField] || 0;
      const bValue = (b as any)[sortField] || 0;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [teamStats, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-zinc-600 opacity-50" />;
    return sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-purple-500" /> : <ChevronDown className="w-3 h-3 text-purple-500" />;
  };

  // Backfill state for admin
  const [isBackfilling, setIsBackfilling] = useState(false);

  // One-click backfill for all players on team rosters
  const handleBackfillHistory = async () => {
    if (userData?.role !== 'SuperAdmin') return;
    
    setIsBackfilling(true);
    let updated = 0;
    let skipped = 0;
    let noTeam = 0;
    
    try {
      // APPROACH: Scan global players collection and look for teamId field
      console.log('📊 Backfill: Scanning global players collection...');
      const globalPlayersSnap = await getDocs(collection(db, 'players'));
      console.log('📊 Backfill: Found', globalPlayersSnap.docs.length, 'global players');
      
      // Cache teams for lookup
      const teamsSnap = await getDocs(collection(db, 'teams'));
      const teamsMap = new Map<string, any>();
      teamsSnap.docs.forEach(d => teamsMap.set(d.id, { id: d.id, ...d.data() }));
      console.log('📊 Backfill: Cached', teamsMap.size, 'teams');
      
      for (const playerDoc of globalPlayersSnap.docs) {
        const player = playerDoc.data();
        const playerId = playerDoc.id;
        const teamId = player.teamId;
        
        console.log('📊 Player:', player.firstName, player.lastName, '| teamId:', teamId);
        
        if (!teamId) {
          console.log('📊 No teamId, checking if player is in any team roster subcollection...');
          noTeam++;
          continue;
        }
        
        // Get team data
        const team = teamsMap.get(teamId);
        if (!team) {
          console.log('📊 Team not found:', teamId);
          skipped++;
          continue;
        }
        
        if (!team.programId) {
          console.log('📊 Team has no programId:', teamId);
          skipped++;
          continue;
        }
        
        const existingHistory = player.teamHistory || [];
        
        // Check if already has this team in history
        if (existingHistory.some((e: any) => e.teamId === teamId)) {
          console.log('📊 Already has history for team:', teamId);
          skipped++;
          continue;
        }
        
        // Add team history entry
        const historyEntry = {
          teamId,
          teamName: team.name || 'Team',
          programId: team.programId,
          programName: team.programName || '',
          sport: team.sport || 'football',
          seasonId: team.currentSeasonId || null,
          seasonYear: new Date().getFullYear(),
          ageGroup: player.ageGroup || team.ageGroup || null,
          joinedAt: player.draftedAt || player.createdAt || new Date(),
          leftAt: null,
          status: 'active'
        };
        
        await updateDoc(doc(db, 'players', playerId), {
          teamHistory: [...existingHistory, historyEntry]
        });
        
        console.log('📊 ✅ Added history for:', player.firstName, player.lastName, '-> team:', team.name);
        updated++;
      }
      
      toastSuccess(`Backfill complete! Updated: ${updated}, Skipped: ${skipped}, No team: ${noTeam}`);
      console.log('📊 Backfill Summary - Updated:', updated, 'Skipped:', skipped, 'No team:', noTeam);
    } catch (err: any) {
      console.error('Backfill error:', err);
      toastError(`Backfill failed: ${err.message}`);
    } finally {
      setIsBackfilling(false);
    }
  };

  return (
    <NoAthleteBlock featureName="Stats" allowDraftPool>
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-purple-500" />
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              {(userData?.role === 'Parent' || userData?.role === 'Athlete') ? 'My Stats' : 'Team Stats'}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{currentYear} Season</p>
          </div>
        </div>
        
        {/* SuperAdmin: Backfill button */}
        {userData?.role === 'SuperAdmin' && (
          <button
            onClick={handleBackfillHistory}
            disabled={isBackfilling}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isBackfilling ? 'animate-spin' : ''}`} />
            {isBackfilling ? 'Syncing...' : 'Sync Stats History'}
          </button>
        )}
      </div>

      {/* Athlete View: Individual Player Stats */}
      {userData?.role === 'Athlete' && (
        <section>
          {authLoading ? (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-12 text-center border border-zinc-200 dark:border-zinc-800">
              <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-purple-500 mx-auto mb-4"></div>
              <p className="text-zinc-600 dark:text-zinc-400">Loading your stats...</p>
            </div>
          ) : !selectedPlayer ? (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-12 text-center border border-zinc-200 dark:border-zinc-800">
              <User className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">No Player Profile Found</h3>
              <p className="text-zinc-600 dark:text-zinc-400">Your stats will appear here once you're added to a team roster.</p>
            </div>
          ) : (
            <PlayerStatsDashboard player={selectedPlayer} teamName={teamData?.name} />
          )}
        </section>
      )}

      {/* Parent View: Individual Player Stats with player selector + Team Stats toggle */}
      {userData?.role === 'Parent' && (
        <section>
          {authLoading ? (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-12 text-center border border-zinc-200 dark:border-zinc-800">
              <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-purple-500 mx-auto mb-4"></div>
              <p className="text-zinc-600 dark:text-zinc-400">Loading stats...</p>
            </div>
          ) : !players || players.length === 0 ? (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-12 text-center border border-zinc-200 dark:border-zinc-800">
              <BarChart3 className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">No Athletes Added</h3>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">Add an athlete to view their statistics</p>
              <Link 
                to="/profile" 
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                Add Athlete
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* View Toggle: My Stats | Team Stats */}
              <div className={`p-1 rounded-xl inline-flex ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                <button
                  onClick={() => setParentViewMode('my')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                    parentViewMode === 'my'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : isDark 
                        ? 'text-slate-400 hover:text-white hover:bg-white/5' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <User className="w-4 h-4" />
                  My Stats
                </button>
                <button
                  onClick={() => setParentViewMode('team')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                    parentViewMode === 'team'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : isDark 
                        ? 'text-slate-400 hover:text-white hover:bg-white/5' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Team Stats
                </button>
              </div>

              {/* MY STATS VIEW - Uses selectedPlayer from AuthContext (no duplicate selector) */}
              {parentViewMode === 'my' && (
                <PlayerStatsDashboard 
                  player={selectedPlayer || players[0]} 
                  teamName={teamData?.name} 
                />
              )}

              {/* TEAM STATS VIEW */}
              {parentViewMode === 'team' && (
                <div className="space-y-6">
                  {!teamData ? (
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-12 text-center border border-zinc-200 dark:border-zinc-800">
                      <Users className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">No Team Connected</h3>
                      <p className="text-zinc-600 dark:text-zinc-400">Your athlete needs to be on a team to view team stats.</p>
                    </div>
                  ) : (
                    <>
                      {/* Performance Analytics Dashboard (read-only for parents) */}
                      <StatsDashboard />
                      
                      {/* Detailed Category Breakdowns */}
                      <TeamStatsSummary embedded />
                      
                      {/* Game Stats (read-only for parents) */}
                      <div className={`rounded-xl border overflow-hidden ${
                        isDark 
                          ? 'bg-white/5 border-white/10' 
                          : 'bg-white border-slate-200 shadow-sm'
                      }`}>
                        <div className="p-4">
                          <GameStatsEntryV2 readOnly />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Coach View: Team Stats + Game Stats (both collapsible) */}
      {userData?.role === 'Coach' && (
        <section>
          {!teamData ? (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-12 text-center border border-zinc-200 dark:border-zinc-800">
              <BarChart3 className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">No Team Assigned</h3>
              <p className="text-zinc-600 dark:text-zinc-400">Please contact an admin to assign you to a team</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* ============ TEAM STATS SECTION (Collapsible) ============ */}
              <div className={`rounded-xl border overflow-hidden ${
                isDark 
                  ? 'bg-white/5 border-white/10' 
                  : 'bg-white border-slate-200 shadow-sm'
              }`}>
                {/* Team Stats Header */}
                <button
                  onClick={() => setTeamStatsExpanded(!teamStatsExpanded)}
                  className={`w-full flex items-center justify-between p-4 transition-colors ${
                    isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                      <TrendingUp className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="text-left">
                      <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        Team Stats
                      </h2>
                      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Season performance, analytics & leaderboards
                      </p>
                    </div>
                  </div>
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                    {teamStatsExpanded ? (
                      <ChevronUp className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                    ) : (
                      <ChevronDown className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                    )}
                  </div>
                </button>
                
                {/* Team Stats Content */}
                {teamStatsExpanded && (
                  <div className={`p-4 pt-0 space-y-6 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    {/* Performance Analytics Dashboard */}
                    <StatsDashboard />
                    
                    {/* Detailed Category Breakdowns */}
                    <TeamStatsSummary embedded />
                  </div>
                )}
              </div>

              {/* ============ GAME STATS SECTION (Collapsible) ============ */}
              <div className={`rounded-xl border overflow-hidden ${
                isDark 
                  ? 'bg-white/5 border-white/10' 
                  : 'bg-white border-slate-200 shadow-sm'
              }`}>
                {/* Game Stats Header */}
                <button
                  onClick={() => setGameStatsExpanded(!gameStatsExpanded)}
                  className={`w-full flex items-center justify-between p-4 transition-colors ${
                    isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                      <Gamepad2 className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="text-left">
                      <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        Game Stats
                      </h2>
                      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Enter & view stats for individual games
                      </p>
                    </div>
                  </div>
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                    {gameStatsExpanded ? (
                      <ChevronUp className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                    ) : (
                      <ChevronDown className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                    )}
                  </div>
                </button>
                
                {/* Game Stats Content */}
                {gameStatsExpanded && (
                  <div className={`p-4 pt-2 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <GameStatsEntryV2 />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* SuperAdmin View: Team Selector + Stats Overview */}
      {userData?.role === 'SuperAdmin' && (
        <section className="space-y-6">
          {/* Team Selector */}
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              Select Team to View Stats
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full md:w-96 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg p-3 text-zinc-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            >
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.id})
                </option>
              ))}
            </select>
          </div>

          {/* Stat Leaders - Dynamic */}
          {topLeaders && topLeaders.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topLeaders.map((leader, idx) => (
                <div 
                  key={leader.stat.key}
                  className="p-4 rounded-xl border"
                  style={{
                    background: `linear-gradient(to bottom right, ${idx === 0 ? 'rgb(124 45 18 / 0.3)' : idx === 1 ? 'rgb(22 78 99 / 0.3)' : 'rgb(6 78 59 / 0.3)'}, ${idx === 0 ? 'rgb(67 20 7 / 0.5)' : idx === 1 ? 'rgb(8 51 68 / 0.5)' : 'rgb(2 44 34 / 0.5)'})`,
                    borderColor: idx === 0 ? 'rgb(154 52 18 / 0.5)' : idx === 1 ? 'rgb(21 94 117 / 0.5)' : 'rgb(6 95 70 / 0.5)'
                  }}
                >
                  <div className="flex items-center gap-2 mb-2" style={{ color: idx === 0 ? '#fb923c' : idx === 1 ? '#22d3ee' : '#34d399' }}>
                    <Trophy className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Top {leader.stat.label}</span>
                  </div>
                  <p className="text-2xl font-black" style={{ color: idx === 0 ? '#fb923c' : idx === 1 ? '#22d3ee' : '#34d399' }}>
                    {(leader.player as any)[leader.stat.key] || 0}
                  </p>
                  <p className="text-sm text-white">{leader.player.playerName}</p>
                </div>
              ))}
            </div>
          )}

          {/* Stats Table */}
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                {sportConfig.name} Statistics ({currentYear})
              </h2>
            </div>

            {loading ? (
              <div className="p-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-purple-500"></div>
              </div>
            ) : sortedStats.length === 0 ? (
              <div className="p-12 text-center text-zinc-500">
                No stats found for this team yet.
              </div>
            ) : (
              <>
                {/* MOBILE CARD VIEW - Dynamic */}
                <div className="md:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
                  {sortedStats.map((stat) => {
                    const mobileStats = sportStats.slice(0, 4);
                    return (
                      <div key={stat.id} className="p-4 bg-white dark:bg-black">
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <h3 className="font-bold text-zinc-900 dark:text-white">{stat.playerName}</h3>
                            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-1 rounded">#{stat.playerNumber}</span>
                          </div>
                          {mobileStats[1] && (
                            <div className="text-right">
                              <div className="text-2xl font-black text-purple-500">
                                {(stat as any)[mobileStats[1].key] || 0} 
                                <span className="text-xs text-purple-300 font-normal uppercase ml-1">{mobileStats[1].shortLabel}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          {mobileStats.map((statConfig, idx) => (
                            <div key={statConfig.key} className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded">
                              <div className="text-zinc-400 uppercase tracking-wider text-[10px]">{statConfig.shortLabel}</div>
                              <div className={`font-bold ${idx === 1 ? 'text-purple-500' : 'text-zinc-900 dark:text-white'}`}>
                                {(stat as any)[statConfig.key] || 0}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP TABLE VIEW - Dynamic */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white dark:bg-black text-zinc-600 dark:text-zinc-400 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 text-left">#</th>
                        <th className="px-4 py-3 text-left">Player</th>
                        {sportStats.slice(0, 8).map(statConfig => (
                          <th 
                            key={statConfig.key}
                            className="px-4 py-3 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" 
                            onClick={() => handleSort(statConfig.key)}
                          >
                            <div className="flex items-center justify-center gap-1">
                              {statConfig.shortLabel} <SortIcon field={statConfig.key}/>
                            </div>
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => handleSort('spts')}>
                          <div className="flex items-center justify-center gap-1">SPTS <SortIcon field="spts"/></div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-700 dark:text-zinc-300 divide-y divide-zinc-200 dark:divide-zinc-800">
                      {sortedStats.map((stat) => (
                        <tr key={stat.id} className="hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                          <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">{stat.playerNumber}</td>
                          <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{stat.playerName}</td>
                          {sportStats.slice(0, 8).map((statConfig, idx) => (
                            <td 
                              key={statConfig.key}
                              className={`px-4 py-3 text-center ${
                                idx === 0 ? '' : 
                                idx === 1 ? 'text-purple-600 dark:text-purple-400 font-bold bg-purple-50/50 dark:bg-purple-900/10' : 
                                idx < 4 ? 'text-cyan-600 dark:text-cyan-400 font-bold' : 
                                ''
                              }`}
                            >
                              {(stat as any)[statConfig.key] || 0}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-center">{stat.spts || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
    </NoAthleteBlock>
  );
};

export default Stats;
