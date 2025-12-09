// =============================================================================
// RECENT RESULTS WIDGET - Show recent game results on dashboard
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Trophy,
  ChevronRight,
  Loader2,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Game } from '../../types/game';
import { 
  getRecentCompletedGames,
  formatGameDate,
} from '../../services/gameService';

interface RecentResultsWidgetProps {
  teamId: string;
  limit?: number;
  onViewSchedule?: () => void;
}

export function RecentResultsWidget({
  teamId,
  limit = 5,
  onViewSchedule,
}: RecentResultsWidgetProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGames();
  }, [teamId]);

  const loadGames = async () => {
    try {
      setLoading(true);
      const recentGames = await getRecentCompletedGames(teamId, limit);
      setGames(recentGames);
    } catch (err) {
      console.error('Error loading recent results:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
            <Target className="w-5 h-5 text-green-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Recent Results</h3>
        </div>
        <div className="text-center py-6">
          <p className="text-slate-400">No completed games yet</p>
        </div>
      </div>
    );
  }

  // Calculate stats
  const wins = games.filter(g => g.result === 'win').length;
  const losses = games.filter(g => g.result === 'loss').length;
  const ties = games.filter(g => g.result === 'tie').length;

  return (
    <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Recent Results</h3>
              <p className="text-sm text-slate-400">
                Last {games.length} games: {wins}W-{losses}L{ties > 0 ? `-${ties}T` : ''}
              </p>
            </div>
          </div>
          {onViewSchedule && (
            <button
              onClick={onViewSchedule}
              className="text-sm text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1"
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results List */}
      <div className="divide-y divide-white/5">
        {games.map((game) => (
          <div key={game.id} className="p-4 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-4">
              {/* Result Icon */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                game.result === 'win' 
                  ? 'bg-green-500/20' 
                  : game.result === 'loss'
                  ? 'bg-red-500/20'
                  : 'bg-slate-500/20'
              }`}>
                {game.result === 'win' ? (
                  <TrendingUp className="w-5 h-5 text-green-400" />
                ) : game.result === 'loss' ? (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                ) : (
                  <Minus className="w-5 h-5 text-slate-400" />
                )}
              </div>

              {/* Game Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white truncate">
                    {game.isHome ? 'vs' : '@'} {game.opponent}
                  </span>
                  {game.isPlayoff && (
                    <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {formatGameDate(game.date)}
                </p>
              </div>

              {/* Score */}
              <div className="text-right flex-shrink-0">
                <div className={`text-xl font-bold ${
                  game.result === 'win' 
                    ? 'text-green-400' 
                    : game.result === 'loss'
                    ? 'text-red-400'
                    : 'text-slate-400'
                }`}>
                  {game.ourScore} - {game.opponentScore}
                </div>
                <div className={`text-xs font-bold uppercase ${
                  game.result === 'win' 
                    ? 'text-green-500' 
                    : game.result === 'loss'
                    ? 'text-red-500'
                    : 'text-slate-500'
                }`}>
                  {game.result === 'win' ? 'W' : game.result === 'loss' ? 'L' : 'T'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RecentResultsWidget;
