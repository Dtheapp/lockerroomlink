import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Game, GamePlayerStats, Player } from '../../types';
import { Trophy, Calendar, MapPin, ChevronDown, ChevronUp, Users, Sword, Shield, TrendingUp, X } from 'lucide-react';

// Helper: Format date string without timezone issues
const formatEventDate = (dateStr: string, options?: Intl.DateTimeFormatOptions) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', options || { weekday: 'short', month: 'short', day: 'numeric' });
};

interface GameDetailModalProps {
  game: Game;
  teamName?: string;
  onClose: () => void;
}

const GameDetailModal: React.FC<GameDetailModalProps> = ({ game, teamName, onClose }) => {
  const { teamData } = useAuth();
  const [playerStats, setPlayerStats] = useState<GamePlayerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamData?.id || !game.id) return;

    const fetchStats = async () => {
      try {
        const snapshot = await getDocs(
          collection(db, 'teams', teamData.id, 'games', game.id, 'playerStats')
        );
        const stats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GamePlayerStats));
        // Sort by player number
        stats.sort((a, b) => (a.playerNumber || 0) - (b.playerNumber || 0));
        setPlayerStats(stats);
      } catch (error) {
        console.error('Error loading game stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [teamData?.id, game.id]);

  const resultColor = game.result === 'W' ? 'from-emerald-600 to-emerald-700' : game.result === 'L' ? 'from-red-600 to-red-700' : 'from-yellow-600 to-yellow-700';
  const resultText = game.result === 'W' ? 'Victory' : game.result === 'L' ? 'Defeat' : 'Tie';

  // Calculate team totals from player stats
  const teamTotals = useMemo(() => {
    return playerStats.reduce((totals, stat) => ({
      tds: totals.tds + (stat.tds || 0),
      rushYards: totals.rushYards + (stat.rushYards || 0),
      passYards: totals.passYards + (stat.passYards || 0),
      recYards: totals.recYards + (stat.recYards || 0),
      tackles: totals.tackles + (stat.tackles || 0),
      sacks: totals.sacks + (stat.sacks || 0),
      int: totals.int + (stat.int || 0),
    }), { tds: 0, rushYards: 0, passYards: 0, recYards: 0, tackles: 0, sacks: 0, int: 0 });
  }, [playerStats]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-zinc-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-zinc-700 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${resultColor} p-6 relative`}>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/20 hover:bg-black/30 rounded-full p-1.5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <p className="text-white/70 text-sm mb-1">{formatEventDate(game.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p className="text-white/80 text-sm mb-3">{game.isHome ? 'Home' : 'Away'} • Game {game.gameNumber}</p>
            
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-4xl font-black text-white">{game.teamScore}</p>
                <p className="text-white/70 text-sm">{teamName || 'Our Team'}</p>
              </div>
              <div className="text-white/50 text-2xl">vs</div>
              <div className="text-center">
                <p className="text-4xl font-black text-white">{game.opponentScore}</p>
                <p className="text-white/70 text-sm">{game.opponent}</p>
              </div>
            </div>
            
            <p className="mt-3 text-lg font-bold text-white">{resultText}</p>
            {game.location && (
              <p className="text-white/60 text-xs mt-1 flex items-center justify-center gap-1">
                <MapPin className="w-3 h-3" /> {game.location}
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-250px)]">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
            </div>
          ) : playerStats.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500">No player stats recorded for this game.</p>
            </div>
          ) : (
            <>
              {/* Team Totals */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Team Totals</h3>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                  <div className="bg-zinc-800 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-orange-400">{teamTotals.tds}</p>
                    <p className="text-[10px] text-zinc-500">TDs</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-cyan-400">{teamTotals.rushYards}</p>
                    <p className="text-[10px] text-zinc-500">Rush Yds</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-cyan-400">{teamTotals.passYards}</p>
                    <p className="text-[10px] text-zinc-500">Pass Yds</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-cyan-400">{teamTotals.recYards}</p>
                    <p className="text-[10px] text-zinc-500">Rec Yds</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-emerald-400">{teamTotals.tackles}</p>
                    <p className="text-[10px] text-zinc-500">Tackles</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-purple-400">{teamTotals.sacks}</p>
                    <p className="text-[10px] text-zinc-500">Sacks</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-red-400">{teamTotals.int}</p>
                    <p className="text-[10px] text-zinc-500">INTs</p>
                  </div>
                </div>
              </div>

              {/* Player Stats */}
              <div>
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Player Stats</h3>
                <div className="space-y-2">
                  {playerStats.filter(s => 
                    s.played ||
                    (s.tds || 0) > 0 || (s.rushYards || 0) > 0 || (s.recYards || 0) > 0 || 
                    (s.passYards || 0) > 0 || (s.tackles || 0) > 0 || (s.sacks || 0) > 0 || 
                    (s.int || 0) > 0 || (s.rec || 0) > 0
                  ).map(stat => (
                    <div key={stat.id} className="bg-zinc-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-orange-500 font-bold text-sm">#{stat.playerNumber || '?'}</span>
                          <span className="font-bold text-white text-sm">{stat.playerName}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs">
                        {(stat.tds || 0) > 0 && <span className="text-orange-400"><strong>{stat.tds}</strong> TD</span>}
                        {(stat.rushYards || 0) > 0 && <span className="text-cyan-400"><strong>{stat.rushYards}</strong> Rush Yds</span>}
                        {(stat.rec || 0) > 0 && <span className="text-white"><strong>{stat.rec}</strong> Rec</span>}
                        {(stat.recYards || 0) > 0 && <span className="text-cyan-400"><strong>{stat.recYards}</strong> Rec Yds</span>}
                        {(stat.passYards || 0) > 0 && <span className="text-cyan-400"><strong>{stat.passYards}</strong> Pass Yds</span>}
                        {(stat.tackles || 0) > 0 && <span className="text-emerald-400"><strong>{stat.tackles}</strong> Tkl</span>}
                        {(stat.sacks || 0) > 0 && <span className="text-purple-400"><strong>{stat.sacks}</strong> Sack</span>}
                        {(stat.int || 0) > 0 && <span className="text-red-400"><strong>{stat.int}</strong> INT</span>}
                        {(stat.ff || 0) > 0 && <span className="text-orange-400"><strong>{stat.ff}</strong> FF</span>}
                        {/* Show if player played but no recorded stats */}
                        {stat.played && 
                          (stat.tds || 0) === 0 && (stat.rushYards || 0) === 0 && (stat.recYards || 0) === 0 && 
                          (stat.passYards || 0) === 0 && (stat.tackles || 0) === 0 && (stat.sacks || 0) === 0 && 
                          (stat.int || 0) === 0 && (stat.rec || 0) === 0 && (stat.ff || 0) === 0 && (
                            <span className="text-zinc-500 italic">Played (no recorded stats)</span>
                          )
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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

const GameHistory: React.FC = () => {
  const { teamData } = useAuth();
  const currentYear = new Date().getFullYear();
  
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(currentYear);

  // Get available seasons
  const availableSeasons = useMemo(() => {
    const seasons = new Set(games.map(g => g.season));
    seasons.add(currentYear);
    return Array.from(seasons).sort((a, b) => b - a);
  }, [games, currentYear]);

  useEffect(() => {
    if (!teamData?.id) {
      setLoading(false);
      return;
    }

    // No orderBy to avoid index requirement - sort in JS
    const gamesQuery = query(
      collection(db, 'teams', teamData.id, 'games')
    );
    
    const unsub = onSnapshot(gamesQuery, (snapshot) => {
      const gamesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Game));
      // Sort by date descending
      gamesData.sort((a, b) => b.date.localeCompare(a.date));
      setGames(gamesData);
      setLoading(false);
    });

    return () => unsub();
  }, [teamData?.id]);

  // Filter games by selected season
  const filteredGames = useMemo(() => {
    return games.filter(g => g.season === selectedSeason);
  }, [games, selectedSeason]);

  // Calculate season record
  const seasonRecord = useMemo(() => {
    const wins = filteredGames.filter(g => g.result === 'W').length;
    const losses = filteredGames.filter(g => g.result === 'L').length;
    const ties = filteredGames.filter(g => g.result === 'T').length;
    const totalPoints = filteredGames.reduce((sum, g) => sum + g.teamScore, 0);
    const opponentPoints = filteredGames.reduce((sum, g) => sum + g.opponentScore, 0);
    return { wins, losses, ties, totalPoints, opponentPoints };
  }, [filteredGames]);

  if (!teamData) {
    return (
      <div className="bg-zinc-900 rounded-xl p-12 text-center border border-zinc-800">
        <Trophy className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">No Team Found</h3>
        <p className="text-zinc-500">Join a team to view game history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-orange-500" />
          <div>
            <h2 className="text-2xl font-bold text-white">Game History</h2>
            <p className="text-sm text-zinc-500">{teamData.name}</p>
          </div>
        </div>
        
        {/* Season Selector */}
        {availableSeasons.length > 1 && (
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white font-medium"
          >
            {availableSeasons.map(season => (
              <option key={season} value={season}>{season} Season</option>
            ))}
          </select>
        )}
      </div>

      {/* Season Summary */}
      <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-xl p-6 border border-zinc-700">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <p className="text-3xl font-black text-white">{seasonRecord.wins}-{seasonRecord.losses}{seasonRecord.ties > 0 ? `-${seasonRecord.ties}` : ''}</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Record</p>
          </div>
          <div>
            <p className="text-3xl font-black text-emerald-400">{seasonRecord.wins}</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Wins</p>
          </div>
          <div>
            <p className="text-3xl font-black text-red-400">{seasonRecord.losses}</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Losses</p>
          </div>
          <div>
            <p className="text-3xl font-black text-cyan-400">{seasonRecord.totalPoints}</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Points For</p>
          </div>
          <div>
            <p className="text-3xl font-black text-orange-400">{seasonRecord.opponentPoints}</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Points Against</p>
          </div>
        </div>
      </div>

      {/* Games List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl p-12 text-center border border-zinc-800">
          <Calendar className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Games Yet</h3>
          <p className="text-zinc-500">No games recorded for {selectedSeason} season.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGames.map((game) => {
            const resultColor = game.result === 'W' ? 'bg-emerald-500' : game.result === 'L' ? 'bg-red-500' : 'bg-yellow-500';
            const scoreDiff = game.teamScore - game.opponentScore;

            return (
              <div
                key={game.id}
                onClick={() => setSelectedGame(game)}
                className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-zinc-700 cursor-pointer transition-all hover:bg-zinc-800/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 ${resultColor} rounded-lg flex items-center justify-center text-white font-black text-lg`}>
                      {game.result}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">
                        {game.isHome ? 'vs' : '@'} {game.opponent}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <Calendar className="w-3 h-3" />
                        <span>{formatEventDate(game.date)}</span>
                        {game.location && (
                          <>
                            <span>•</span>
                            <MapPin className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{game.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-2xl font-black ${game.result === 'W' ? 'text-emerald-400' : game.result === 'L' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {game.teamScore} - {game.opponentScore}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff} pts
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Game Detail Modal */}
      {selectedGame && (
        <GameDetailModal
          game={selectedGame}
          teamName={teamData.name}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </div>
  );
};

export default GameHistory;
