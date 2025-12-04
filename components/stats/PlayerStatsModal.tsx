import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { PlayerSeasonStats, Player, Game, GamePlayerStats } from '../../types';
import { X, TrendingUp, Calendar, Trophy, Shield, Sword, Target, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

// Helper: Format date string without timezone issues
const formatEventDate = (dateStr: string, options?: Intl.DateTimeFormatOptions) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', options || { month: 'short', day: 'numeric' });
};

interface GameWithStats {
  game: Game;
  stats: GamePlayerStats;
}

interface PlayerStatsModalProps {
  player: Player;
  teamName?: string;
  onClose: () => void;
}

const PlayerStatsModal: React.FC<PlayerStatsModalProps> = ({ player, teamName, onClose }) => {
  const [seasonStats, setSeasonStats] = useState<PlayerSeasonStats[]>([]);
  const [gameStats, setGameStats] = useState<GameWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [showGameBreakdown, setShowGameBreakdown] = useState(false);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const fetchPlayerStats = async () => {
      setLoading(true);
      try {
        // Query season stats
        const statsQuery = query(
          collection(db, 'teams', player.teamId, 'seasonStats'),
          where('playerId', '==', player.id)
        );
        const snapshot = await getDocs(statsQuery);
        const stats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PlayerSeasonStats));
        stats.sort((a, b) => (b.season || 0) - (a.season || 0));
        setSeasonStats(stats);
        
        // Fetch game-by-game stats for current year
        const gamesSnapshot = await getDocs(query(
          collection(db, 'teams', player.teamId, 'games'),
          where('season', '==', currentYear)
        ));
        
        const gamesWithStats: GameWithStats[] = [];
        for (const gameDoc of gamesSnapshot.docs) {
          const game = { id: gameDoc.id, ...gameDoc.data() } as Game;
          const playerStatsDoc = await getDocs(query(
            collection(db, 'teams', player.teamId, 'games', game.id, 'playerStats'),
            where('playerId', '==', player.id)
          ));
          
          if (playerStatsDoc.docs.length > 0) {
            const playerGameStats = { id: playerStatsDoc.docs[0].id, ...playerStatsDoc.docs[0].data() } as GamePlayerStats;
            // Only include if player had some stats in this game
            const hasStats = (playerGameStats.tds || 0) > 0 || (playerGameStats.rushYards || 0) > 0 || 
              (playerGameStats.recYards || 0) > 0 || (playerGameStats.tackles || 0) > 0 ||
              (playerGameStats.rec || 0) > 0 || (playerGameStats.sacks || 0) > 0 ||
              (playerGameStats.int || 0) > 0;
            if (hasStats) {
              gamesWithStats.push({ game, stats: playerGameStats });
            }
          }
        }
        
        // Sort by date descending
        gamesWithStats.sort((a, b) => b.game.date.localeCompare(a.game.date));
        setGameStats(gamesWithStats);
        
        // Auto-expand current year if exists
        if (stats.some(s => s.season === currentYear)) {
          setExpandedSeason(currentYear);
        } else if (stats.length > 0) {
          setExpandedSeason(stats[0].season);
        }
      } catch (error) {
        console.error('Error fetching player stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerStats();
  }, [player.id, player.teamId, currentYear]);

  // Calculate career totals
  const careerTotals = useMemo(() => {
    return seasonStats.reduce((totals, season) => ({
      gp: totals.gp + (season.gp || 0),
      tds: totals.tds + (season.tds || 0),
      totalYards: totals.totalYards + (season.rushYards || 0) + (season.recYards || 0) + (season.passYards || 0),
      tackles: totals.tackles + (season.tackles || 0),
      sacks: totals.sacks + (season.sacks || 0),
      int: totals.int + (season.int || 0),
    }), { gp: 0, tds: 0, totalYards: 0, tackles: 0, sacks: 0, int: 0 });
  }, [seasonStats]);

  const StatBox = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-zinc-700 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-6 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/20 hover:bg-black/30 rounded-full p-1.5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            {player.photoUrl ? (
              <img src={player.photoUrl} alt={player.name} className="w-16 h-16 rounded-full object-cover border-2 border-white/30" />
            ) : (
              <div className="w-16 h-16 bg-orange-800 rounded-full flex items-center justify-center text-2xl font-bold text-white">
                {player.name.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-2xl font-black text-white">{player.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded">#{player.number}</span>
                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded">{player.position}</span>
              </div>
              {teamName && <p className="text-white/70 text-sm mt-1">{teamName}</p>}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
            </div>
          ) : seasonStats.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Stats Recorded Yet</h3>
              <p className="text-zinc-500">Stats will appear here once recorded by a coach.</p>
            </div>
          ) : (
            <>
              {/* Career Totals */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-lg font-bold text-white">Career Totals</h3>
                  <span className="text-xs text-zinc-500">({seasonStats.length} season{seasonStats.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  <StatBox label="Games" value={careerTotals.gp} color="text-white" />
                  <StatBox label="TDs" value={careerTotals.tds} color="text-orange-400" />
                  <StatBox label="Yards" value={careerTotals.totalYards} color="text-cyan-400" />
                  <StatBox label="Tackles" value={careerTotals.tackles} color="text-emerald-400" />
                  <StatBox label="Sacks" value={careerTotals.sacks} color="text-purple-400" />
                  <StatBox label="INTs" value={careerTotals.int} color="text-red-400" />
                </div>
              </div>

              {/* Season Breakdown */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-cyan-500" />
                  <h3 className="text-lg font-bold text-white">Season History</h3>
                </div>
                
                <div className="space-y-3">
                  {seasonStats.map(season => {
                    const isExpanded = expandedSeason === season.season;
                    const totalYards = (season.rushYards || 0) + (season.recYards || 0) + (season.passYards || 0);
                    
                    return (
                      <div 
                        key={season.id} 
                        className="bg-zinc-800/50 rounded-lg border border-zinc-700 overflow-hidden"
                      >
                        {/* Season Header */}
                        <button
                          onClick={() => setExpandedSeason(isExpanded ? null : season.season)}
                          className="w-full p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="bg-orange-600 text-white font-bold px-3 py-1 rounded text-lg">
                              {season.season}
                            </div>
                            <div className="text-left">
                              <p className="text-white font-medium">{season.teamName || teamName || 'Team'}</p>
                              <p className="text-xs text-zinc-500">{season.gp || 0} games played</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                              <span className="text-orange-400 font-bold">{season.tds || 0} TDs</span>
                              <span className="text-zinc-500 mx-2">|</span>
                              <span className="text-cyan-400 font-bold">{totalYards} YDS</span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-zinc-500" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-zinc-500" />
                            )}
                          </div>
                        </button>

                        {/* Expanded Stats */}
                        {isExpanded && (
                          <div className="border-t border-zinc-700 p-4 space-y-4 animate-in slide-in-from-top-2">
                            {/* Offensive Stats */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Sword className="w-4 h-4 text-orange-500" />
                                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Offense</span>
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-sm">
                                <div className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">TDs</p>
                                  <p className="text-orange-400 font-bold">{season.tds || 0}</p>
                                </div>
                                <div className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">Rush Yds</p>
                                  <p className="text-cyan-400 font-bold">{season.rushYards || 0}</p>
                                </div>
                                <div className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">Rush Att</p>
                                  <p className="text-white font-bold">{season.rushAttempts || 0}</p>
                                </div>
                                <div className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">Rec</p>
                                  <p className="text-white font-bold">{season.rec || 0}</p>
                                </div>
                                <div className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">Rec Yds</p>
                                  <p className="text-cyan-400 font-bold">{season.recYards || 0}</p>
                                </div>
                                <div className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">Pass Yds</p>
                                  <p className="text-cyan-400 font-bold">{season.passYards || 0}</p>
                                </div>
                                <div className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">Pass Comp</p>
                                  <p className="text-white font-bold">{season.passCompletions || 0}/{season.passAttempts || 0}</p>
                                </div>
                              </div>
                            </div>

                            {/* Defensive Stats */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-4 h-4 text-emerald-500" />
                                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Defense</span>
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-sm">
                                <div className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">Tackles</p>
                                  <p className="text-emerald-400 font-bold">{season.tackles || 0}</p>
                                </div>
                                <div className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">Solo</p>
                                  <p className="text-white font-bold">{season.soloTackles || 0}</p>
                                </div>
                                <div className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">Sacks</p>
                                  <p className="text-purple-400 font-bold">{season.sacks || 0}</p>
                                </div>
                                <div className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">INTs</p>
                                  <p className="text-red-400 font-bold">{season.int || 0}</p>
                                </div>
                                <div className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">FF</p>
                                  <p className="text-orange-400 font-bold">{season.ff || 0}</p>
                                </div>
                                <div className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">FR</p>
                                  <p className="text-white font-bold">{season.fr || 0}</p>
                                </div>
                                <div className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">Pass Def</p>
                                  <p className="text-white font-bold">{season.passDefended || 0}</p>
                                </div>
                              </div>
                            </div>

                            {/* Special Teams */}
                            {((season.kickReturnYards || 0) > 0 || (season.puntReturnYards || 0) > 0) && (
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <Target className="w-4 h-4 text-yellow-500" />
                                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Special Teams</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                                  <div className="bg-zinc-900 p-2 rounded">
                                    <p className="text-zinc-500 text-[10px] uppercase">KR Yds</p>
                                    <p className="text-yellow-400 font-bold">{season.kickReturnYards || 0}</p>
                                  </div>
                                  <div className="bg-zinc-900 p-2 rounded">
                                    <p className="text-zinc-500 text-[10px] uppercase">KR TDs</p>
                                    <p className="text-orange-400 font-bold">{season.kickReturnTds || 0}</p>
                                  </div>
                                  <div className="bg-zinc-900 p-2 rounded">
                                    <p className="text-zinc-500 text-[10px] uppercase">PR Yds</p>
                                    <p className="text-yellow-400 font-bold">{season.puntReturnYards || 0}</p>
                                  </div>
                                  <div className="bg-zinc-900 p-2 rounded">
                                    <p className="text-zinc-500 text-[10px] uppercase">PR TDs</p>
                                    <p className="text-orange-400 font-bold">{season.puntReturnTds || 0}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Sportsmanship */}
                            {(season.spts || 0) > 0 && (
                              <div className="pt-2 border-t border-zinc-700">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-zinc-500 uppercase">Sportsmanship Points</span>
                                  <span className="text-lg font-bold text-lime-400">{season.spts}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Game-by-Game Breakdown for Current Year */}
              {gameStats.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowGameBreakdown(!showGameBreakdown)}
                    className="w-full flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700 hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-emerald-500" />
                      <h3 className="text-lg font-bold text-white">Game-by-Game ({currentYear})</h3>
                      <span className="text-xs text-zinc-500">({gameStats.length} games)</span>
                    </div>
                    {showGameBreakdown ? (
                      <ChevronUp className="w-5 h-5 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-zinc-500" />
                    )}
                  </button>
                  
                  {showGameBreakdown && (
                    <div className="mt-3 space-y-2">
                      {gameStats.map(({ game, stats }) => {
                        const resultColor = game.result === 'W' ? 'text-emerald-400' : game.result === 'L' ? 'text-red-400' : 'text-yellow-400';
                        const resultBg = game.result === 'W' ? 'bg-emerald-500' : game.result === 'L' ? 'bg-red-500' : 'bg-yellow-500';
                        
                        return (
                          <div key={game.id} className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-800">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`${resultBg} text-white text-xs font-bold px-2 py-0.5 rounded`}>{game.result}</span>
                                <span className="text-sm font-medium text-white">{game.isHome ? 'vs' : '@'} {game.opponent}</span>
                              </div>
                              <span className="text-xs text-zinc-500">{formatEventDate(game.date)}</span>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs">
                              {(stats.tds || 0) > 0 && <span className="text-orange-400"><strong>{stats.tds}</strong> TD</span>}
                              {(stats.rushYards || 0) > 0 && <span className="text-cyan-400"><strong>{stats.rushYards}</strong> Rush</span>}
                              {(stats.rec || 0) > 0 && <span className="text-white"><strong>{stats.rec}</strong> Rec</span>}
                              {(stats.recYards || 0) > 0 && <span className="text-cyan-400"><strong>{stats.recYards}</strong> RecYd</span>}
                              {(stats.tackles || 0) > 0 && <span className="text-emerald-400"><strong>{stats.tackles}</strong> Tkl</span>}
                              {(stats.sacks || 0) > 0 && <span className="text-purple-400"><strong>{stats.sacks}</strong> Sack</span>}
                              {(stats.int || 0) > 0 && <span className="text-red-400"><strong>{stats.int}</strong> INT</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-700 bg-zinc-950">
          <button
            onClick={onClose}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerStatsModal;
