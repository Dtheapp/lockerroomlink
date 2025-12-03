import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { PlayerStats } from '../../types';
import { TrendingUp, Eye, ArrowUpDown } from 'lucide-react';

const StatsBoard: React.FC = () => {
  const { teamData } = useAuth();
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<keyof PlayerStats>('tds');

  useEffect(() => {
    if (!teamData?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // Fetch raw data; sorting is handled client-side
    const q = query(
      collection(db, 'teams', teamData.id, 'playerStats'),
      orderBy('tds', 'desc') // Default initial sort for Firebase
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerStats));
      setPlayerStats(stats);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamData?.id]);

  // OPTIMIZATION: Memoize the top leaders to prevent recalculation on every render
  const { topRusher, topTackler, topTD } = useMemo(() => {
      if (playerStats.length === 0) return { topRusher: null, topTackler: null, topTD: null };

      const getTopPlayer = (key: keyof PlayerStats) => {
          return playerStats.reduce((prev, current) => 
              ((current[key] as number) || 0) > ((prev[key] as number) || 0) ? current : prev
          , playerStats[0]);
      };

      return {
          topRusher: getTopPlayer('yards'),
          topTackler: getTopPlayer('tackles'),
          topTD: getTopPlayer('tds')
      };
  }, [playerStats]);


  // Client-Side Sort
  const getSortedStats = useMemo(() => {
    return [...playerStats].sort((a, b) => {
      const aVal = a[sortBy as keyof PlayerStats];
      const bVal = b[sortBy as keyof PlayerStats];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return bVal - aVal; // Always descending for simplicity in the Read-Only board
      }
      return 0;
    });
  }, [playerStats, sortBy]);


  const getColumnHeader = (title: string, field: keyof PlayerStats) => (
      <th 
        className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
        onClick={() => setSortBy(field)}
      >
        <div className="flex items-center justify-center gap-1">
            {title}
            {sortBy === field && <ArrowUpDown className="w-3 h-3"/>}
        </div>
      </th>
  );


  return (
    <div className="space-y-6">
      {/* Quick Leaders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-lg dark:shadow-xl">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Top Rusher (Yds)</p>
          <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">
            {topRusher ? `${topRusher.yards}` : 'N/A'}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300">{topRusher?.playerName || '—'}</p>
        </div>

        <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-lg dark:shadow-xl">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Top Tackler (Tkls)</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {topTackler ? `${topTackler.tackles}` : 'N/A'}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300">{topTackler?.playerName || '—'}</p>
        </div>

        <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-lg dark:shadow-xl">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Most TDs</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {topTD ? `${topTD.tds}` : 'N/A'}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300">{topTD?.playerName || '—'}</p>
        </div>
      </div>

      {/* Full Stat Sheet */}
      <div className="bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-lg dark:shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-500" />
            Full Stat Sheet
          </h3>
          {/* Mobile Sort Select (Visible on small screens) */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as keyof PlayerStats)}
            className="md:hidden bg-slate-100 dark:bg-slate-800 p-2 rounded text-sm text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-800"
          >
            <option value="tds">Sort by TDs</option>
            <option value="yards">Sort by Yards</option>
            <option value="tackles">Sort by Tackles</option>
            <option value="rec">Sort by Receptions</option>
            <option value="sacks">Sort by Sacks</option>
            <option value="spts">Sort by Sportsmanship</option>
          </select>
        </div>

        {loading ? (
            <div className="p-4 text-center text-slate-600 dark:text-slate-400">
                Loading stats...
            </div>
        ) : getSortedStats().length > 0 ? (
            <>
                {/* 1. MOBILE CARD/VERTICAL VIEW (md:hidden) */}
                <div className="md:hidden divide-y divide-slate-200 dark:divide-zinc-800">
                    {getSortedStats().map((stat) => (
                        <div key={stat.id} className="p-4 bg-white dark:bg-zinc-900">
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">{stat.playerName}</h3>
                                    <span className="text-xs bg-slate-100 dark:bg-zinc-800 text-slate-600 px-2 py-1 rounded">#{stat.playerNumber}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black text-red-600 dark:text-red-400">{stat.tds} <span className="text-xs text-red-300 font-normal uppercase">TDs</span></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                <div className="bg-slate-50 dark:bg-zinc-950 p-2 rounded border border-slate-200 dark:border-zinc-800">
                                    <div className="text-slate-400 uppercase tracking-wider text-[10px]">Yds</div>
                                    <div className="font-bold text-sky-600 dark:text-sky-400">{stat.yards}</div>
                                </div>
                                <div className="bg-slate-50 dark:bg-zinc-950 p-2 rounded border border-slate-200 dark:border-zinc-800">
                                    <div className="text-slate-400 uppercase tracking-wider text-[10px]">Tkl</div>
                                    <div className="font-bold text-emerald-600 dark:text-emerald-400">{stat.tackles}</div>
                                </div>
                                <div className="bg-slate-50 dark:bg-zinc-950 p-2 rounded border border-slate-200 dark:border-zinc-800">
                                    <div className="text-slate-400 uppercase tracking-wider text-[10px]">Sks</div>
                                    <div className="font-bold text-slate-900 dark:text-white">{stat.sacks}</div>
                                </div>
                                <div className="bg-slate-50 dark:bg-zinc-950 p-2 rounded border border-slate-200 dark:border-zinc-800">
                                    <div className="text-slate-400 uppercase tracking-wider text-[10px]">GP</div>
                                    <div className="font-bold text-slate-900 dark:text-white">{stat.gp}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>


                {/* 2. DESKTOP TABLE VIEW (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">#</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">NAME</th>
                                {getColumnHeader('GP', 'gp')}
                                {getColumnHeader('TDS', 'tds')}
                                {getColumnHeader('YARDS', 'yards')}
                                {getColumnHeader('REC', 'rec')}
                                {getColumnHeader('TACKLES', 'tackles')}
                                {getColumnHeader('SACKS', 'sacks')}
                                {getColumnHeader('INT', 'int')}
                                {getColumnHeader('FF', 'ff')}
                                {getColumnHeader('SPTS', 'spts')}
                            </tr>
                        </thead>
                        <tbody>
                            {getSortedStats().map((stat) => (
                                <tr
                                    key={stat.id}
                                    className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </>
        ) : (
            <tr>
                <td colSpan={11} className="px-4 py-4 text-center text-slate-600 dark:text-slate-400">
                    No stats recorded yet.
                </td>
            </tr>
        )}
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