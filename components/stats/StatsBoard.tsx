import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { PlayerStats } from '../../types';
import { TrendingUp, Eye } from 'lucide-react';

const StatsBoard: React.FC = () => {
  const { teamData } = useAuth();
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);
  const [sortBy, setSortBy] = useState<keyof PlayerStats>('tds');

  useEffect(() => {
    if (!teamData?.id) return;
    setLoading(true);

    const q = query(
      collection(db, 'teams', teamData.id, 'playerStats'),
      orderBy('tds', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerStats));
      setPlayerStats(stats);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamData?.id]);

  const getSortedStats = () => {
    return [...playerStats].sort((a, b) => {
      const aVal = a[sortBy as keyof PlayerStats];
      const bVal = b[sortBy as keyof PlayerStats];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return bVal - aVal;
      }
      return 0;
    });
  };

  const topRusher = playerStats.reduce((top, p) => (p.yards > (top?.yards || 0) ? p : top), playerStats[0]);
  const topTackler = playerStats.reduce((top, p) => (p.tackles > (top?.tackles || 0) ? p : top), playerStats[0]);
  const topTD = playerStats.reduce((top, p) => (p.tds > (top?.tds || 0) ? p : top), playerStats[0]);

  return (
    <div className="space-y-6">
      {/* Quick Leaders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-xl">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Top Rusher (Yds)</p>
          <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">
            {topRusher ? `${topRusher.yards}` : 'N/A'}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300">{topRusher?.playerName || '—'}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-xl">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Top Tackler (Tkls)</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {topTackler ? `${topTackler.tackles}` : 'N/A'}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300">{topTackler?.playerName || '—'}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-xl">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Most TDs</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {topTD ? `${topTD.tds}` : 'N/A'}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300">{topTD?.playerName || '—'}</p>
        </div>
      </div>

      {/* Full Stat Sheet */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-500" />
            Full Stat Sheet
          </h3>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as keyof PlayerStats)}
            className="bg-slate-100 dark:bg-slate-800 p-2 rounded text-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700"
          >
            <option value="tds">TDs</option>
            <option value="yards">Yards</option>
            <option value="tackles">Tackles</option>
            <option value="rec">Receptions</option>
            <option value="sacks">Sacks</option>
            <option value="spts">Sportsmanship</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">#</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">NAME</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">GP</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">TDS</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">YARDS</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">REC</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">TACKLES</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">SACKS</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">INT</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">FF</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">SPTS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-4 text-center text-slate-600 dark:text-slate-400">
                    Loading stats...
                  </td>
                </tr>
              ) : getSortedStats().length > 0 ? (
                getSortedStats().map((stat) => (
                  <tr
                    key={stat.id}
                    onClick={() => setSelectedPlayer(stat)}
                    className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-bold">{stat.playerNumber}</td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{stat.playerName}</td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{stat.gp}</td>
                    <td className="px-4 py-3 text-center text-red-600 dark:text-red-400 font-bold">{stat.tds}</td>
                    <td className="px-4 py-3 text-center text-sky-600 dark:text-sky-400 font-bold">{stat.yards}</td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{stat.rec}</td>
                    <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 font-bold">{stat.tackles}</td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{stat.sacks}</td>
                    <td className="px-4 py-3 text-center text-purple-600 dark:text-purple-400">{stat.int}</td>
                    <td className="px-4 py-3 text-center text-orange-600 dark:text-orange-400">{stat.ff}</td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{stat.spts}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="px-4 py-4 text-center text-slate-600 dark:text-slate-400">
                    No stats recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900/50">
        <p className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase mb-2">Key Junior Stats</p>
        <p className="text-sm text-blue-800 dark:text-blue-300">
          GP (Games Played), TDS (Touchdowns), YARDS (Total Yards), REC (Receptions), TACKLES (Total Tackles),
          SACKS (Sacks), INT (Interceptions), FF (Forced Fumbles), SPTS (Sportsmanship Points)
        </p>
      </div>
    </div>
  );
};

export default StatsBoard;
