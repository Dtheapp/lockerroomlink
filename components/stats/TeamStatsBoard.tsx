import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { PlayerSeasonStats, Player } from '../../types';
import PlayerStatsModal from './PlayerStatsModal';
import { TrendingUp, Eye, ArrowUpDown, Trophy, Sword, Shield, Search, Users, BarChart3 } from 'lucide-react';

const TeamStatsBoard: React.FC = () => {
  const { teamData } = useAuth();
  const currentYear = new Date().getFullYear();
  
  const [seasonStats, setSeasonStats] = useState<PlayerSeasonStats[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<keyof PlayerSeasonStats>('tds');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Load players and current season stats
  useEffect(() => {
    if (!teamData?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // Load players
    const playersQuery = query(
      collection(db, 'teams', teamData.id, 'players'),
      orderBy('number', 'asc')
    );

    const unsubPlayers = onSnapshot(playersQuery, (snapshot) => {
      const playersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      setPlayers(playersData);
    });

    // Load current season stats
    const statsQuery = query(
      collection(db, 'teams', teamData.id, 'seasonStats'),
      where('season', '==', currentYear)
    );

    const unsubStats = onSnapshot(statsQuery, (snapshot) => {
      const stats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PlayerSeasonStats));
      setSeasonStats(stats);
      setLoading(false);
    });

    return () => {
      unsubPlayers();
      unsubStats();
    };
  }, [teamData?.id, currentYear]);

  // Calculate top stats for leaders section
  const topStats = useMemo(() => {
    if (seasonStats.length === 0) return null;

    const getTopPlayer = (getValue: (s: PlayerSeasonStats) => number) => {
      return seasonStats.reduce((prev, current) => 
        getValue(current) > getValue(prev) ? current : prev
      , seasonStats[0]);
    };

    return {
      rusher: getTopPlayer(s => (s.rushYards || 0) + (s.recYards || 0)),
      tackler: getTopPlayer(s => s.tackles || 0),
      scorer: getTopPlayer(s => s.tds || 0)
    };
  }, [seasonStats]);

  // Filter and sort stats
  const displayStats = useMemo(() => {
    let filtered = [...seasonStats];
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.playerName.toLowerCase().includes(q) ||
        (s.playerNumber?.toString() || '').includes(q)
      );
    }

    // Sort
    return filtered.sort((a, b) => {
      const aVal = a[sortBy] as number || 0;
      const bVal = b[sortBy] as number || 0;
      return bVal - aVal;
    });
  }, [seasonStats, searchQuery, sortBy]);

  // Get player object for modal
  const getPlayerObject = (stat: PlayerSeasonStats): Player | null => {
    return players.find(p => p.id === stat.playerId) || null;
  };

  const SortHeader = ({ field, label }: { field: keyof PlayerSeasonStats; label: string }) => (
    <th 
      className="px-3 py-2 text-center font-semibold text-zinc-400 cursor-pointer hover:bg-zinc-800 transition-colors"
      onClick={() => setSortBy(field)}
    >
      <div className="flex items-center justify-center gap-1">
        {label}
        {sortBy === field && <ArrowUpDown className="w-3 h-3 text-orange-500" />}
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Player Stats Modal */}
      {selectedPlayer && (
        <PlayerStatsModal 
          player={selectedPlayer} 
          teamName={teamData?.name}
          onClose={() => setSelectedPlayer(null)} 
        />
      )}

      {/* Stat Leaders Cards */}
      {topStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Top Rusher */}
          <div className="bg-gradient-to-br from-cyan-900/30 to-cyan-950/50 p-4 rounded-xl border border-cyan-800/50">
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <Sword className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Top Yards</span>
            </div>
            <p className="text-3xl font-black text-cyan-400">
              {(topStats.rusher.rushYards || 0) + (topStats.rusher.recYards || 0)}
            </p>
            <p className="text-sm text-white font-medium mt-1">{topStats.rusher.playerName}</p>
            <p className="text-xs text-zinc-500">#{topStats.rusher.playerNumber}</p>
          </div>

          {/* Top Tackler */}
          <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-950/50 p-4 rounded-xl border border-emerald-800/50">
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <Shield className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Top Tackler</span>
            </div>
            <p className="text-3xl font-black text-emerald-400">{topStats.tackler.tackles || 0}</p>
            <p className="text-sm text-white font-medium mt-1">{topStats.tackler.playerName}</p>
            <p className="text-xs text-zinc-500">#{topStats.tackler.playerNumber}</p>
          </div>

          {/* Top Scorer */}
          <div className="bg-gradient-to-br from-orange-900/30 to-orange-950/50 p-4 rounded-xl border border-orange-800/50">
            <div className="flex items-center gap-2 text-orange-400 mb-2">
              <Trophy className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Most TDs</span>
            </div>
            <p className="text-3xl font-black text-orange-400">{topStats.scorer.tds || 0}</p>
            <p className="text-sm text-white font-medium mt-1">{topStats.scorer.playerName}</p>
            <p className="text-xs text-zinc-500">#{topStats.scorer.playerNumber}</p>
          </div>
        </div>
      )}

      {/* Full Stats Table */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <div>
              <h3 className="text-lg font-bold text-white">Team Stats</h3>
              <p className="text-xs text-zinc-500">{currentYear} Season</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-orange-500 outline-none w-48"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
          </div>
        ) : displayStats.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart3 className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Stats Yet</h3>
            <p className="text-zinc-500">
              {searchQuery ? 'No players match your search.' : 'Stats will appear here once coaches enter data.'}
            </p>
          </div>
        ) : (
          <>
            {/* MOBILE CARD VIEW */}
            <div className="md:hidden divide-y divide-zinc-800">
              {displayStats.map(stat => {
                const player = getPlayerObject(stat);
                const totalYards = (stat.rushYards || 0) + (stat.recYards || 0);
                
                return (
                  <div 
                    key={stat.id} 
                    className="p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                    onClick={() => player && setSelectedPlayer(player)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-white">{stat.playerName}</h4>
                        <span className="text-xs text-zinc-500">#{stat.playerNumber}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-orange-400">{stat.tds || 0}</p>
                        <p className="text-[10px] uppercase text-zinc-500">TDs</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-zinc-800 p-2 rounded">
                        <p className="text-zinc-500 text-[10px]">GP</p>
                        <p className="font-bold text-white">{stat.gp || 0}</p>
                      </div>
                      <div className="bg-zinc-800 p-2 rounded">
                        <p className="text-zinc-500 text-[10px]">YDS</p>
                        <p className="font-bold text-cyan-400">{totalYards}</p>
                      </div>
                      <div className="bg-zinc-800 p-2 rounded">
                        <p className="text-zinc-500 text-[10px]">TKL</p>
                        <p className="font-bold text-emerald-400">{stat.tackles || 0}</p>
                      </div>
                      <div className="bg-zinc-800 p-2 rounded">
                        <p className="text-zinc-500 text-[10px]">INT</p>
                        <p className="font-bold text-red-400">{stat.int || 0}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-orange-500">
                      <Eye className="w-3 h-3" /> Tap to view full stats
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800/50 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-400">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-400">Player</th>
                    <SortHeader field="gp" label="GP" />
                    <SortHeader field="tds" label="TDs" />
                    <SortHeader field="rushYards" label="RUSH" />
                    <SortHeader field="recYards" label="REC" />
                    <SortHeader field="tackles" label="TKL" />
                    <SortHeader field="sacks" label="SACKS" />
                    <SortHeader field="int" label="INT" />
                    <SortHeader field="ff" label="FF" />
                    <th className="px-3 py-2 text-center font-semibold text-zinc-400">VIEW</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {displayStats.map(stat => {
                    const player = getPlayerObject(stat);
                    
                    return (
                      <tr key={stat.id} className="hover:bg-zinc-800/50 transition-colors">
                        <td className="px-3 py-3 text-zinc-400 font-mono">{stat.playerNumber}</td>
                        <td className="px-3 py-3 text-white font-medium">{stat.playerName}</td>
                        <td className="px-3 py-3 text-center text-zinc-300">{stat.gp || 0}</td>
                        <td className="px-3 py-3 text-center text-orange-400 font-bold">{stat.tds || 0}</td>
                        <td className="px-3 py-3 text-center text-cyan-400">{stat.rushYards || 0}</td>
                        <td className="px-3 py-3 text-center text-cyan-400">{stat.recYards || 0}</td>
                        <td className="px-3 py-3 text-center text-emerald-400 font-bold">{stat.tackles || 0}</td>
                        <td className="px-3 py-3 text-center text-purple-400">{stat.sacks || 0}</td>
                        <td className="px-3 py-3 text-center text-red-400">{stat.int || 0}</td>
                        <td className="px-3 py-3 text-center text-orange-400">{stat.ff || 0}</td>
                        <td className="px-3 py-3 text-center">
                          {player && (
                            <button
                              onClick={() => setSelectedPlayer(player)}
                              className="text-zinc-500 hover:text-orange-500 transition-colors p-1"
                              title="View full stats"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="bg-cyan-900/20 p-4 rounded-xl border border-cyan-800/30">
        <p className="text-xs font-bold text-cyan-400 uppercase mb-2">Stat Key</p>
        <p className="text-sm text-cyan-200/80">
          GP (Games Played) • TDs (Touchdowns) • RUSH (Rushing Yards) • REC (Receiving Yards) • 
          TKL (Tackles) • SACKS • INT (Interceptions) • FF (Forced Fumbles)
        </p>
        <p className="text-xs text-cyan-500 mt-2">
          Tap/click the eye icon or any player row to view their complete stat history.
        </p>
      </div>
    </div>
  );
};

export default TeamStatsBoard;
