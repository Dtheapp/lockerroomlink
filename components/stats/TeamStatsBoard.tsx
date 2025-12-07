import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { PlayerSeasonStats, Player } from '../../types';
import PlayerStatsModal from './PlayerStatsModal';
import { TrendingUp, Eye, ArrowUpDown, Trophy, Search, Users, BarChart3 } from 'lucide-react';
import { getStats, getSportConfig, type StatConfig } from '../../config/sportConfig';

const TeamStatsBoard: React.FC = () => {
  const { teamData } = useAuth();
  const currentYear = new Date().getFullYear();
  
  // Sport-specific config
  const sportStats = useMemo(() => getStats(teamData?.sport), [teamData?.sport]);
  const sportConfig = useMemo(() => getSportConfig(teamData?.sport), [teamData?.sport]);
  
  const [seasonStats, setSeasonStats] = useState<PlayerSeasonStats[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>('gamesPlayed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Set initial sortBy based on sport's first stat
  useEffect(() => {
    if (sportStats.length > 1) {
      setSortBy(sportStats[1].key); // Skip gamesPlayed, use first actual stat
    }
  }, [sportStats]);

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

  // Calculate top stats for leaders section (sport-aware)
  const topLeaders = useMemo(() => {
    if (seasonStats.length === 0 || sportStats.length < 3) return null;

    const getTopPlayer = (statKey: string) => {
      return seasonStats.reduce((prev, current) => {
        const prevVal = (prev as any)[statKey] || 0;
        const currVal = (current as any)[statKey] || 0;
        return currVal > prevVal ? current : prev;
      }, seasonStats[0]);
    };

    // Get top 3 stats for leaders (skip gamesPlayed)
    const leaderStats = sportStats.filter(s => s.key !== 'gamesPlayed').slice(0, 3);
    
    return leaderStats.map((stat, idx) => ({
      stat,
      player: getTopPlayer(stat.key),
      color: idx === 0 ? 'orange' : idx === 1 ? 'cyan' : 'emerald'
    }));
  }, [seasonStats, sportStats]);

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

    // Sort (dynamic key)
    return filtered.sort((a, b) => {
      const aVal = (a as any)[sortBy] || 0;
      const bVal = (b as any)[sortBy] || 0;
      return bVal - aVal;
    });
  }, [seasonStats, searchQuery, sortBy]);

  // Get player object for modal
  const getPlayerObject = (stat: PlayerSeasonStats): Player | null => {
    return players.find(p => p.id === stat.playerId) || null;
  };

  // Dynamic SortHeader
  const SortHeader = ({ field, label }: { field: string; label: string }) => (
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

  // Get display stats for table (limit columns for mobile-friendliness)
  const tableStats = useMemo(() => {
    // Always show gamesPlayed first, then up to 7 more stats
    const gp = sportStats.find(s => s.key === 'gamesPlayed');
    const others = sportStats.filter(s => s.key !== 'gamesPlayed').slice(0, 7);
    return gp ? [gp, ...others] : others;
  }, [sportStats]);

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

      {/* Stat Leaders Cards - Dynamic */}
      {topLeaders && topLeaders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topLeaders.map((leader, idx) => (
            <div 
              key={leader.stat.key}
              className={`bg-gradient-to-br from-${leader.color}-900/30 to-${leader.color}-950/50 p-4 rounded-xl border border-${leader.color}-800/50`}
              style={{
                background: `linear-gradient(to bottom right, ${idx === 0 ? 'rgb(124 45 18 / 0.3)' : idx === 1 ? 'rgb(22 78 99 / 0.3)' : 'rgb(6 78 59 / 0.3)'}, ${idx === 0 ? 'rgb(67 20 7 / 0.5)' : idx === 1 ? 'rgb(8 51 68 / 0.5)' : 'rgb(2 44 34 / 0.5)'})`,
                borderColor: idx === 0 ? 'rgb(154 52 18 / 0.5)' : idx === 1 ? 'rgb(21 94 117 / 0.5)' : 'rgb(6 95 70 / 0.5)'
              }}
            >
              <div className="flex items-center gap-2 mb-2" style={{ color: idx === 0 ? '#fb923c' : idx === 1 ? '#22d3ee' : '#34d399' }}>
                <Trophy className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Top {leader.stat.label}</span>
              </div>
              <p className="text-3xl font-black" style={{ color: idx === 0 ? '#fb923c' : idx === 1 ? '#22d3ee' : '#34d399' }}>
                {(leader.player as any)[leader.stat.key] || 0}
              </p>
              <p className="text-sm text-white font-medium mt-1">{leader.player.playerName}</p>
              <p className="text-xs text-zinc-500">#{leader.player.playerNumber}</p>
            </div>
          ))}
        </div>
      )}

      {/* Full Stats Table */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <div>
              <h3 className="text-lg font-bold text-white">{sportConfig.name} Stats</h3>
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
            {/* MOBILE CARD VIEW - Dynamic */}
            <div className="md:hidden divide-y divide-zinc-800">
              {displayStats.map(stat => {
                const player = getPlayerObject(stat);
                const mobileStats = tableStats.slice(0, 4); // First 4 stats for mobile
                
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
                      {mobileStats[1] && (
                        <div className="text-right">
                          <p className="text-2xl font-black text-orange-400">
                            {(stat as any)[mobileStats[1].key] || 0}
                          </p>
                          <p className="text-[10px] uppercase text-zinc-500">{mobileStats[1].shortLabel}</p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      {mobileStats.map((statConfig, idx) => (
                        <div key={statConfig.key} className="bg-zinc-800 p-2 rounded">
                          <p className="text-zinc-500 text-[10px]">{statConfig.shortLabel}</p>
                          <p className={`font-bold ${idx === 0 ? 'text-white' : idx === 1 ? 'text-orange-400' : idx === 2 ? 'text-cyan-400' : 'text-emerald-400'}`}>
                            {(stat as any)[statConfig.key] || 0}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-orange-500">
                      <Eye className="w-3 h-3" /> Tap to view full stats
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE - Dynamic */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800/50 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-400">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-400">Player</th>
                    {tableStats.map(statConfig => (
                      <SortHeader key={statConfig.key} field={statConfig.key} label={statConfig.shortLabel} />
                    ))}
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
                        {tableStats.map((statConfig, idx) => (
                          <td 
                            key={statConfig.key} 
                            className={`px-3 py-3 text-center ${
                              idx === 0 ? 'text-zinc-300' : 
                              idx === 1 ? 'text-orange-400 font-bold' : 
                              idx < 4 ? 'text-cyan-400' : 
                              'text-zinc-300'
                            }`}
                          >
                            {(stat as any)[statConfig.key] || 0}
                          </td>
                        ))}
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

      {/* Legend - Dynamic */}
      <div className="bg-cyan-900/20 p-4 rounded-xl border border-cyan-800/30">
        <p className="text-xs font-bold text-cyan-400 uppercase mb-2">Stat Key</p>
        <p className="text-sm text-cyan-200/80">
          {sportStats.map(s => `${s.shortLabel} (${s.label})`).join(' • ')}
        </p>
        <p className="text-xs text-cyan-500 mt-2">
          Tap/click the eye icon or any player row to view their complete stat history.
        </p>
      </div>
    </div>
  );
};

export default TeamStatsBoard;
