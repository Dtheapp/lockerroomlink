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
  const [sortField, setSortField] = useState<keyof PlayerSeasonStats>('tds');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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

  // Calculate top stats for SuperAdmin view
  const topStats = useMemo(() => {
    if (teamStats.length === 0) return null;
    const getTopPlayer = (getValue: (s: PlayerSeasonStats) => number) => {
      return teamStats.reduce((prev, current) => 
        getValue(current) > getValue(prev) ? current : prev
      , teamStats[0]);
    };
    return {
      rusher: getTopPlayer(s => (s.rushYards || 0) + (s.recYards || 0)),
      tackler: getTopPlayer(s => s.tackles || 0),
      scorer: getTopPlayer(s => s.tds || 0)
    };
  }, [teamStats]);

  // Client-Side Sorting Logic for SuperAdmin
  const sortedStats = useMemo(() => {
    return [...teamStats].sort((a, b) => {
      const aValue = a[sortField] as number || 0;
      const bValue = b[sortField] as number || 0;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [teamStats, sortField, sortDirection]);

  const handleSort = (field: keyof PlayerSeasonStats) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: keyof PlayerSeasonStats }) => {
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

          {/* Stat Leaders */}
          {topStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-cyan-900/30 to-cyan-950/50 p-4 rounded-xl border border-cyan-800/50">
                <div className="flex items-center gap-2 text-cyan-400 mb-2">
                  <Sword className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">Top Yards</span>
                </div>
                <p className="text-2xl font-black text-cyan-400">
                  {(topStats.rusher.rushYards || 0) + (topStats.rusher.recYards || 0)}
                </p>
                <p className="text-sm text-white">{topStats.rusher.playerName}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-950/50 p-4 rounded-xl border border-emerald-800/50">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <Shield className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">Top Tackler</span>
                </div>
                <p className="text-2xl font-black text-emerald-400">{topStats.tackler.tackles || 0}</p>
                <p className="text-sm text-white">{topStats.tackler.playerName}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-900/30 to-orange-950/50 p-4 rounded-xl border border-orange-800/50">
                <div className="flex items-center gap-2 text-orange-400 mb-2">
                  <Trophy className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">Most TDs</span>
                </div>
                <p className="text-2xl font-black text-orange-400">{topStats.scorer.tds || 0}</p>
                <p className="text-sm text-white">{topStats.scorer.playerName}</p>
              </div>
            </div>
          )}

          {/* Stats Table */}
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                Player Statistics ({currentYear})
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
                {/* MOBILE CARD VIEW */}
                <div className="md:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
                  {sortedStats.map((stat) => {
                    const totalYards = (stat.rushYards || 0) + (stat.recYards || 0);
                    return (
                      <div key={stat.id} className="p-4 bg-white dark:bg-black">
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <h3 className="font-bold text-zinc-900 dark:text-white">{stat.playerName}</h3>
                            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-1 rounded">#{stat.playerNumber}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-black text-orange-500">{stat.tds || 0} <span className="text-xs text-orange-300 font-normal uppercase">TDs</span></div>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded">
                            <div className="text-zinc-400 uppercase tracking-wider text-[10px]">Yds</div>
                            <div className="font-bold text-zinc-900 dark:text-white">{totalYards}</div>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded">
                            <div className="text-zinc-400 uppercase tracking-wider text-[10px]">Rec</div>
                            <div className="font-bold text-zinc-900 dark:text-white">{stat.rec || 0}</div>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded">
                            <div className="text-zinc-400 uppercase tracking-wider text-[10px]">Tkl</div>
                            <div className="font-bold text-zinc-900 dark:text-white">{stat.tackles || 0}</div>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded">
                            <div className="text-zinc-400 uppercase tracking-wider text-[10px]">INT</div>
                            <div className="font-bold text-zinc-900 dark:text-white">{stat.int || 0}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP TABLE VIEW */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white dark:bg-black text-zinc-600 dark:text-zinc-400 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 text-left">#</th>
                        <th className="px-4 py-3 text-left">Player</th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => handleSort('gp')}>
                          <div className="flex items-center justify-center gap-1">GP <SortIcon field="gp"/></div>
                        </th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => handleSort('tds')}>
                          <div className="flex items-center justify-center gap-1">TDs <SortIcon field="tds"/></div>
                        </th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => handleSort('rushYards')}>
                          <div className="flex items-center justify-center gap-1">Rush <SortIcon field="rushYards"/></div>
                        </th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => handleSort('recYards')}>
                          <div className="flex items-center justify-center gap-1">Rec <SortIcon field="recYards"/></div>
                        </th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => handleSort('tackles')}>
                          <div className="flex items-center justify-center gap-1">Tkl <SortIcon field="tackles"/></div>
                        </th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => handleSort('sacks')}>
                          <div className="flex items-center justify-center gap-1">Sacks <SortIcon field="sacks"/></div>
                        </th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => handleSort('int')}>
                          <div className="flex items-center justify-center gap-1">INT <SortIcon field="int"/></div>
                        </th>
                        <th className="px-4 py-3 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => handleSort('ff')}>
                          <div className="flex items-center justify-center gap-1">FF <SortIcon field="ff"/></div>
                        </th>
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
                          <td className="px-4 py-3 text-center">{stat.gp || 0}</td>
                          <td className="px-4 py-3 text-center text-orange-600 dark:text-orange-400 font-bold bg-orange-50/50 dark:bg-orange-900/10">{stat.tds || 0}</td>
                          <td className="px-4 py-3 text-center text-cyan-600 dark:text-cyan-400 font-bold">{stat.rushYards || 0}</td>
                          <td className="px-4 py-3 text-center">{stat.recYards || 0}</td>
                          <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 font-bold">{stat.tackles || 0}</td>
                          <td className="px-4 py-3 text-center">{stat.sacks || 0}</td>
                          <td className="px-4 py-3 text-center text-purple-600 dark:text-purple-400">{stat.int || 0}</td>
                          <td className="px-4 py-3 text-center text-orange-600 dark:text-orange-400">{stat.ff || 0}</td>
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
