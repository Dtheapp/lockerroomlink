import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, getDocs, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import TeamStatsBoard from './stats/TeamStatsBoard';
import CoachStatsEntry from './stats/CoachStatsEntry';
import GameStatsEntry from './stats/GameStatsEntry';
import GameHistory from './stats/GameHistory';
import type { Team, PlayerSeasonStats } from '../types';
import { BarChart3, Users, TrendingUp, ArrowUpDown, ChevronDown, ChevronUp, Trophy, Shield, Sword, Calendar, ClipboardList, AlertTriangle, Save } from 'lucide-react';
import NoAthleteBlock from './NoAthleteBlock';
import { getStats, getSportConfig, type StatConfig } from '../config/sportConfig';

const Stats: React.FC = () => {
  const { userData, teamData, players, loading: authLoading } = useAuth();
  const currentYear = new Date().getFullYear();
  
  // Tab state for Coach view
  const [activeTab, setActiveTab] = useState<'games' | 'season'>('games');
  
  // Unsaved changes warning state
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingTabChange, setPendingTabChange] = useState<'games' | 'season' | null>(null);
  const gameStatsHasChangesRef = useRef(false);
  
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
      color: idx === 0 ? 'orange' : idx === 1 ? 'cyan' : 'emerald'
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
    return sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-orange-500" /> : <ChevronDown className="w-3 h-3 text-orange-500" />;
  };

  // Listen for unsaved changes from GameStatsEntry
  useEffect(() => {
    const handleUnsavedChanges = (e: CustomEvent) => {
      gameStatsHasChangesRef.current = e.detail?.hasChanges || false;
    };

    window.addEventListener('gameStatsUnsavedChanges' as any, handleUnsavedChanges);
    return () => window.removeEventListener('gameStatsUnsavedChanges' as any, handleUnsavedChanges);
  }, []);

  // Handle tab change with unsaved changes check
  const handleTabChange = useCallback((newTab: 'games' | 'season') => {
    if (newTab === activeTab) return;
    
    // If switching FROM games tab and there are unsaved changes, show warning
    if (activeTab === 'games' && gameStatsHasChangesRef.current) {
      setPendingTabChange(newTab);
      setShowUnsavedWarning(true);
    } else {
      setActiveTab(newTab);
    }
  }, [activeTab]);

  // Handle discard and proceed
  const handleDiscardAndSwitch = () => {
    // Dispatch event to clear unsaved changes in GameStatsEntry
    window.dispatchEvent(new CustomEvent('clearGameStatsChanges'));
    gameStatsHasChangesRef.current = false;
    if (pendingTabChange) {
      setActiveTab(pendingTabChange);
    }
    setShowUnsavedWarning(false);
    setPendingTabChange(null);
  };

  // Handle save and proceed
  const handleSaveAndSwitch = () => {
    // Dispatch event to save changes in GameStatsEntry
    window.dispatchEvent(new CustomEvent('saveGameStatsChanges', {
      detail: {
        onComplete: () => {
          gameStatsHasChangesRef.current = false;
          if (pendingTabChange) {
            setActiveTab(pendingTabChange);
          }
          setShowUnsavedWarning(false);
          setPendingTabChange(null);
        }
      }
    }));
  };

  return (
    <NoAthleteBlock featureName="Stats">
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-8 h-8 text-orange-500" />
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Team Stats</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{currentYear} Season</p>
        </div>
      </div>

      {/* Parent View: Read-only Stats with Game History */}
      {userData?.role === 'Parent' && (
        <section>
          {authLoading ? (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-12 text-center border border-zinc-200 dark:border-zinc-800">
              <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-orange-500 mx-auto mb-4"></div>
              <p className="text-zinc-600 dark:text-zinc-400">Loading team data...</p>
            </div>
          ) : !teamData || !players || players.length === 0 ? (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-12 text-center border border-zinc-200 dark:border-zinc-800">
              <BarChart3 className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">No Team Stats Available</h3>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">Add your first player to view team statistics</p>
              <a 
                href="#/roster" 
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                Go to Roster
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tabs for Parent */}
              <div className="flex gap-2 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => setActiveTab('games')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all ${
                    activeTab === 'games'
                      ? 'bg-orange-600 text-white shadow-lg'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Trophy className="w-5 h-5" />
                  Game History
                </button>
                <button
                  onClick={() => setActiveTab('season')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all ${
                    activeTab === 'season'
                      ? 'bg-orange-600 text-white shadow-lg'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  <ClipboardList className="w-5 h-5" />
                  Season Stats
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'games' ? (
                <GameHistory />
              ) : (
                <TeamStatsBoard />
              )}
            </div>
          )}
        </section>
      )}

      {/* Coach View: Tabs for Game Stats and Season Stats */}
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
              {/* Tabs */}
              <div className="flex gap-2 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => handleTabChange('games')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all ${
                    activeTab === 'games'
                      ? 'bg-orange-600 text-white shadow-lg'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Trophy className="w-5 h-5" />
                  Game Stats
                </button>
                <button
                  onClick={() => handleTabChange('season')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all ${
                    activeTab === 'season'
                      ? 'bg-orange-600 text-white shadow-lg'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  <ClipboardList className="w-5 h-5" />
                  Season Totals
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'games' ? (
                <GameStatsEntry />
              ) : (
                <CoachStatsEntry />
              )}
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
              <Users className="w-5 h-5 text-orange-500" />
              Select Team to View Stats
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full md:w-96 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg p-3 text-zinc-900 dark:text-white font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
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
                <TrendingUp className="w-5 h-5 text-orange-500" />
                {sportConfig.name} Statistics ({currentYear})
              </h2>
            </div>

            {loading ? (
              <div className="p-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
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
                              <div className="text-2xl font-black text-orange-500">
                                {(stat as any)[mobileStats[1].key] || 0} 
                                <span className="text-xs text-orange-300 font-normal uppercase ml-1">{mobileStats[1].shortLabel}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          {mobileStats.map((statConfig, idx) => (
                            <div key={statConfig.key} className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded">
                              <div className="text-zinc-400 uppercase tracking-wider text-[10px]">{statConfig.shortLabel}</div>
                              <div className={`font-bold ${idx === 1 ? 'text-orange-500' : 'text-zinc-900 dark:text-white'}`}>
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
                                idx === 1 ? 'text-orange-600 dark:text-orange-400 font-bold bg-orange-50/50 dark:bg-orange-900/10' : 
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

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-orange-500/50 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Unsaved Changes</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">You have unsaved stat changes</p>
              </div>
            </div>
            
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              Are you sure you want to switch tabs? Your changes will be lost if you don't save them.
            </p>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSaveAndSwitch}
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
              <button
                onClick={handleDiscardAndSwitch}
                className="w-full py-2.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-white rounded-lg font-medium transition-colors"
              >
                Discard Changes
              </button>
              <button
                onClick={() => { setShowUnsavedWarning(false); setPendingTabChange(null); }}
                className="w-full py-2.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </NoAthleteBlock>
  );
};

export default Stats;
