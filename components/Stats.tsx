import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import StatsBoard from './stats/StatsBoard';
import EditableStatsBoard from './stats/EditableStatsBoard';
import type { Team, PlayerStats } from '../types';
import { BarChart3, Users, TrendingUp, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';

type SortField = keyof PlayerStats;

const Stats: React.FC = () => {
  const { userData, teamData, players } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(false);

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('tds');
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
      const q = query(
        collection(db, 'teams', selectedTeamId, 'playerStats')
        // We fetch raw data, sorting is handled client-side for better UX
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const stats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerStats));
        setPlayerStats(stats);
        setLoading(false);
      });
      return () => unsub();
    }
  }, [selectedTeamId, userData?.role]);

  // Client-Side Sorting Logic
  const sortedStats = useMemo(() => {
    return [...playerStats].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // Fallback for strings (like player name)
      return 0;
    });
  }, [playerStats, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-50" />;
    return sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-orange-500" /> : <ChevronDown className="w-3 h-3 text-orange-500" />;
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-8 h-8 text-orange-500" />
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Team Stats</h1>
      </div>

      {/* Parent View: Read-only Stats */}
      {userData?.role === 'Parent' && (
        <section>
          {!teamData || !players || players.length === 0 ? (
            <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl p-12 text-center border border-slate-200 dark:border-zinc-800">
              <BarChart3 className="w-16 h-16 text-slate-300 dark:text-zinc-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Team Stats Available</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">Add your first player to view team statistics</p>
              <a 
                href="#/roster" 
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                Go to Roster
              </a>
            </div>
          ) : teamData ? (
            <StatsBoard />
          ) : null}
        </section>
      )}

      {/* Coach View: Editable Stats */}
      {userData?.role === 'Coach' && (
        <section>
          {!teamData ? (
            <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl p-12 text-center border border-slate-200 dark:border-zinc-800">
              <BarChart3 className="w-16 h-16 text-slate-300 dark:text-zinc-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Team Assigned</h3>
              <p className="text-slate-600 dark:text-slate-400">Please contact an admin to assign you to a team</p>
            </div>
          ) : (
            <EditableStatsBoard />
          )}
        </section>
      )}

      {/* SuperAdmin View: Team Selector + Stats Table */}
      {userData?.role === 'SuperAdmin' && (
        <section className="space-y-4">
          {/* Team Selector */}
          <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-4">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              Select Team to View Stats
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full md:w-96 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg p-3 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            >
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.id})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                Player Statistics
              </h2>
            </div>

            {loading ? (
                <div className="p-12 flex justify-center">
                    <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
                </div>
            ) : sortedStats.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                    No stats found for this team yet.
                </div>
            ) : (
                <>
                    {/* MOBILE CARD VIEW (Visible on small screens) */}
                    <div className="md:hidden divide-y divide-slate-200 dark:divide-zinc-800">
                        {sortedStats.map((stat) => (
                            <div key={stat.id} className="p-4 bg-white dark:bg-black">
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">{stat.playerName}</h3>
                                        <span className="text-xs bg-slate-100 dark:bg-zinc-900 text-slate-500 px-2 py-1 rounded">#{stat.playerNumber}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-orange-500">{stat.tds} <span className="text-xs text-orange-300 font-normal uppercase">TDs</span></div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                    <div className="bg-slate-50 dark:bg-zinc-900 p-2 rounded">
                                        <div className="text-slate-400 uppercase tracking-wider text-[10px]">Yds</div>
                                        <div className="font-bold text-slate-900 dark:text-white">{stat.yards}</div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-zinc-900 p-2 rounded">
                                        <div className="text-slate-400 uppercase tracking-wider text-[10px]">Rec</div>
                                        <div className="font-bold text-slate-900 dark:text-white">{stat.rec}</div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-zinc-900 p-2 rounded">
                                        <div className="text-slate-400 uppercase tracking-wider text-[10px]">Tkl</div>
                                        <div className="font-bold text-slate-900 dark:text-white">{stat.tackles}</div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-zinc-900 p-2 rounded">
                                        <div className="text-slate-400 uppercase tracking-wider text-[10px]">Sacks</div>
                                        <div className="font-bold text-slate-900 dark:text-white">{stat.sacks}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* DESKTOP TABLE VIEW (Hidden on small screens) */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-white dark:bg-black text-slate-600 dark:text-slate-400 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 text-left">#</th>
                                <th className="px-4 py-3 text-left">Player</th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900" onClick={() => handleSort('gp')}>
                                    <div className="flex items-center justify-center gap-1">GP <SortIcon field="gp"/></div>
                                </th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900" onClick={() => handleSort('tds')}>
                                    <div className="flex items-center justify-center gap-1">TDs <SortIcon field="tds"/></div>
                                </th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900" onClick={() => handleSort('yards')}>
                                    <div className="flex items-center justify-center gap-1">Yards <SortIcon field="yards"/></div>
                                </th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900" onClick={() => handleSort('rec')}>
                                    <div className="flex items-center justify-center gap-1">Rec <SortIcon field="rec"/></div>
                                </th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900" onClick={() => handleSort('tackles')}>
                                    <div className="flex items-center justify-center gap-1">Tkl <SortIcon field="tackles"/></div>
                                </th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900" onClick={() => handleSort('sacks')}>
                                    <div className="flex items-center justify-center gap-1">Sacks <SortIcon field="sacks"/></div>
                                </th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900" onClick={() => handleSort('int')}>
                                    <div className="flex items-center justify-center gap-1">INT <SortIcon field="int"/></div>
                                </th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900" onClick={() => handleSort('ff')}>
                                    <div className="flex items-center justify-center gap-1">FF <SortIcon field="ff"/></div>
                                </th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900" onClick={() => handleSort('spts')}>
                                    <div className="flex items-center justify-center gap-1">SPTS <SortIcon field="spts"/></div>
                                </th>
                            </tr>
                            </thead>
                            <tbody className="text-slate-700 dark:text-slate-300 divide-y divide-slate-200 dark:divide-zinc-800">
                            {sortedStats.map((stat) => (
                                <tr key={stat.id} className="hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors">
                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{stat.playerNumber}</td>
                                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{stat.playerName}</td>
                                    <td className="px-4 py-3 text-center">{stat.gp}</td>
                                    <td className="px-4 py-3 text-center text-orange-600 dark:text-orange-400 font-bold bg-orange-50/50 dark:bg-orange-900/10">{stat.tds}</td>
                                    <td className="px-4 py-3 text-center text-cyan-600 dark:text-cyan-400 font-bold">{stat.yards}</td>
                                    <td className="px-4 py-3 text-center">{stat.rec}</td>
                                    <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 font-bold">{stat.tackles}</td>
                                    <td className="px-4 py-3 text-center">{stat.sacks}</td>
                                    <td className="px-4 py-3 text-center text-purple-600 dark:text-purple-400">{stat.int}</td>
                                    <td className="px-4 py-3 text-center text-orange-600 dark:text-orange-400">{stat.ff}</td>
                                    <td className="px-4 py-3 text-center">{stat.spts}</td>
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
  );
};

export default Stats;