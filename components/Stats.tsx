import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import StatsBoard from './stats/StatsBoard';
import EditableStatsBoard from './stats/EditableStatsBoard';
import type { Team, PlayerStats } from '../types';
import { BarChart3, Users, TrendingUp } from 'lucide-react';

const Stats: React.FC = () => {
  const { userData } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(false);

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
        collection(db, 'teams', selectedTeamId, 'playerStats'),
        orderBy('tds', 'desc')
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const stats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerStats));
        setPlayerStats(stats);
        setLoading(false);
      });
      return () => unsub();
    }
  }, [selectedTeamId, userData?.role]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-8 h-8 text-orange-500" />
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Team Stats</h1>
      </div>

      {/* Parent View: Read-only Stats */}
      {userData?.role === 'Parent' && (
        <section>
          <StatsBoard />
        </section>
      )}

      {/* Coach View: Editable Stats */}
      {userData?.role === 'Coach' && (
        <section>
          <EditableStatsBoard />
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

          {/* Stats Table */}
          <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                Player Statistics
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white dark:bg-black text-slate-600 dark:text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Player</th>
                    <th className="px-4 py-3 text-center">GP</th>
                    <th className="px-4 py-3 text-center">TDs</th>
                    <th className="px-4 py-3 text-center">Yards</th>
                    <th className="px-4 py-3 text-center">Rec</th>
                    <th className="px-4 py-3 text-center">Tackles</th>
                    <th className="px-4 py-3 text-center">Sacks</th>
                    <th className="px-4 py-3 text-center">INT</th>
                    <th className="px-4 py-3 text-center">FF</th>
                    <th className="px-4 py-3 text-center">SPTS</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center">
                        <div className="flex justify-center">
                          <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
                        </div>
                      </td>
                    </tr>
                  ) : playerStats.length > 0 ? (
                    playerStats.map((stat) => (
                      <tr
                        key={stat.id}
                        className="border-b border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-black transition-colors"
                      >
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{stat.playerNumber}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{stat.playerName}</td>
                        <td className="px-4 py-3 text-center">{stat.gp}</td>
                        <td className="px-4 py-3 text-center text-orange-600 dark:text-orange-400 font-bold">{stat.tds}</td>
                        <td className="px-4 py-3 text-center text-cyan-600 dark:text-cyan-400 font-bold">{stat.yards}</td>
                        <td className="px-4 py-3 text-center">{stat.rec}</td>
                        <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 font-bold">{stat.tackles}</td>
                        <td className="px-4 py-3 text-center">{stat.sacks}</td>
                        <td className="px-4 py-3 text-center text-purple-600 dark:text-purple-400">{stat.int}</td>
                        <td className="px-4 py-3 text-center text-orange-600 dark:text-orange-400">{stat.ff}</td>
                        <td className="px-4 py-3 text-center">{stat.spts}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                        No stats found for this team. Stats will appear once coaches enter player data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Stats;
