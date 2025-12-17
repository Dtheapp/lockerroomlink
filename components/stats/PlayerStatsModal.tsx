import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { PlayerSeasonStats, Player, Game, GamePlayerStats } from '../../types';
import { X, TrendingUp, Calendar, Trophy, Shield, Sword, Target, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getStats, getSportConfig, type StatConfig } from '../../config/sportConfig';

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
  sport?: string; // Optional sport override (for multi-sport support)
  onClose: () => void;
}

const PlayerStatsModal: React.FC<PlayerStatsModalProps> = ({ player, teamName, sport, onClose }) => {
  const { teamData, selectedSportContext } = useAuth();
  
  // Use sport prop, then selectedSportContext, then teamData as fallback
  const activeSport = sport || selectedSportContext?.sport || teamData?.sport;
  const [seasonStats, setSeasonStats] = useState<PlayerSeasonStats[]>([]);
  const [gameStats, setGameStats] = useState<GameWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [showGameBreakdown, setShowGameBreakdown] = useState(false);

  const currentYear = new Date().getFullYear();
  
  // Sport-specific config - use activeSport which respects multi-sport context
  const sportStats = useMemo(() => getStats(activeSport), [activeSport]);
  const sportConfig = useMemo(() => getSportConfig(activeSport), [activeSport]);
  
  // Get key stats for career totals (first 6 excluding gamesPlayed)
  const careerStatKeys = useMemo(() => {
    return sportStats.filter(s => s.key !== 'gamesPlayed').slice(0, 6);
  }, [sportStats]);

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
            // Only include if player had some stats in this game (check any stat > 0)
            const hasStats = sportStats.some(s => (playerGameStats as any)[s.key] > 0);
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
  }, [player.id, player.teamId, currentYear, sportStats]);

  // Calculate career totals dynamically based on sport
  const careerTotals = useMemo(() => {
    const totals: Record<string, number> = { gp: 0 };
    
    // Initialize all stat keys to 0
    careerStatKeys.forEach(stat => {
      totals[stat.key] = 0;
    });
    
    // Sum up all seasons
    seasonStats.forEach(season => {
      totals.gp += (season.gp || 0);
      careerStatKeys.forEach(stat => {
        totals[stat.key] += ((season as any)[stat.key] || 0);
      });
    });
    
    return totals;
  }, [seasonStats, careerStatKeys]);

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
              {/* Career Totals - Dynamic */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-lg font-bold text-white">Career Totals</h3>
                  <span className="text-xs text-zinc-500">({seasonStats.length} season{seasonStats.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                  <StatBox label="Games" value={careerTotals.gp || 0} color="text-white" />
                  {careerStatKeys.map((stat, idx) => (
                    <StatBox 
                      key={stat.key}
                      label={stat.shortLabel} 
                      value={careerTotals[stat.key] || 0} 
                      color={idx === 0 ? 'text-orange-400' : idx === 1 ? 'text-cyan-400' : idx === 2 ? 'text-emerald-400' : idx === 3 ? 'text-purple-400' : 'text-red-400'} 
                    />
                  ))}
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
                              <p className="text-xs text-zinc-500">{season.gp || 0} {sportConfig.labels.game}s played</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                              {careerStatKeys.slice(0, 2).map((stat, idx) => (
                                <span key={stat.key}>
                                  <span className={idx === 0 ? 'text-orange-400 font-bold' : 'text-cyan-400 font-bold'}>
                                    {(season as any)[stat.key] || 0} {stat.shortLabel}
                                  </span>
                                  {idx === 0 && <span className="text-zinc-500 mx-2">|</span>}
                                </span>
                              ))}
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-zinc-500" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-zinc-500" />
                            )}
                          </div>
                        </button>

                        {/* Expanded Stats - Dynamic */}
                        {isExpanded && (
                          <div className="border-t border-zinc-700 p-4 space-y-4 animate-in slide-in-from-top-2">
                            {/* All Stats in Grid */}
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-sm">
                              {sportStats.filter(s => s.key !== 'gamesPlayed').map((stat, idx) => (
                                <div key={stat.key} className="bg-zinc-900 p-2 rounded">
                                  <p className="text-zinc-500 text-[10px] uppercase">{stat.shortLabel}</p>
                                  <p className={`font-bold ${
                                    idx === 0 ? 'text-orange-400' : 
                                    idx < 3 ? 'text-cyan-400' : 
                                    idx < 5 ? 'text-emerald-400' : 
                                    'text-zinc-300'
                                  }`}>
                                    {(season as any)[stat.key] || 0}
                                  </p>
                                </div>
                              ))}
                            </div>

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
