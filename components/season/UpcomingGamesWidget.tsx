// =============================================================================
// UPCOMING GAMES WIDGET - Show next games on dashboard
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  Home,
  Plane,
  Trophy,
  ChevronRight,
  Loader2,
  Navigation,
} from 'lucide-react';
import { Game, GAME_TAGS, PLAYOFF_ROUNDS } from '../../types/game';
import { 
  getUpcomingGames, 
  getSeasonScheduleSummary,
  formatGameDate, 
  formatGameTime, 
  getCountdownToGame 
} from '../../services/gameService';
import type { SeasonScheduleSummary } from '../../types/game';

// Helper to generate maps URL - works on both mobile (opens native maps) and desktop
const getMapsUrl = (address: string, location?: string): string => {
  const query = encodeURIComponent(address || location || '');
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
};

interface UpcomingGamesWidgetProps {
  teamId: string;
  seasonId?: string;
  limit?: number;
  onViewSchedule?: () => void;
  compact?: boolean;
}

export function UpcomingGamesWidget({
  teamId,
  seasonId,
  limit = 3,
  onViewSchedule,
  compact = false,
}: UpcomingGamesWidgetProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [summary, setSummary] = useState<SeasonScheduleSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGames();
  }, [teamId, seasonId]);

  const loadGames = async () => {
    try {
      setLoading(true);
      const upcomingGames = await getUpcomingGames(teamId, limit);
      setGames(upcomingGames);

      // Get summary if we have a season
      if (seasonId) {
        const summaryData = await getSeasonScheduleSummary(teamId, seasonId);
        setSummary(summaryData);
      }
    } catch (err) {
      console.error('Error loading upcoming games:', err);
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-orange-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Upcoming Games</h3>
        </div>
        <div className="text-center py-6">
          <p className="text-slate-400 mb-4">No upcoming games scheduled</p>
          {onViewSchedule && (
            <button
              onClick={onViewSchedule}
              className="text-sm text-orange-400 hover:text-orange-300 font-medium"
            >
              Add games to your schedule →
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Upcoming Games</h3>
              {summary && (
                <p className="text-sm text-slate-400">
                  Record: {summary.wins}-{summary.losses}{summary.ties > 0 ? `-${summary.ties}` : ''}
                </p>
              )}
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

      {/* Games List */}
      <div className="divide-y divide-white/5">
        {games.map((game, index) => {
          const countdown = getCountdownToGame(game);
          const isNextGame = index === 0;
          
          return (
            <div 
              key={game.id} 
              className={`p-4 transition-colors ${
                countdown.isToday 
                  ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10' 
                  : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Game Icon */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  game.isHome 
                    ? 'bg-orange-500/20' 
                    : 'bg-blue-500/20'
                }`}>
                  {game.isHome ? (
                    <Home className="w-6 h-6 text-orange-400" />
                  ) : (
                    <Plane className="w-6 h-6 text-blue-400" />
                  )}
                </div>

                {/* Game Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white truncate">
                      {game.isHome ? 'vs' : '@'} {game.opponent}
                    </span>
                    {game.isPlayoff && (
                      <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    )}
                    {countdown.isToday && (
                      <span className="px-2 py-0.5 bg-orange-500/30 text-orange-400 rounded text-xs font-bold animate-pulse">
                        TODAY
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatGameDate(game.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatGameTime(game.time)}
                    </span>
                  </div>

                  {!compact && game.location && (
                    game.address ? (
                      <a
                        href={getMapsUrl(game.address, game.location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-orange-400 hover:text-orange-300 mt-1 group"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Navigation className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate group-hover:underline">{game.location}</span>
                      </a>
                    ) : (
                      <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate">{game.location}</span>
                      </div>
                    )
                  )}

                  {/* Tags */}
                  {!compact && game.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {game.tags.slice(0, 2).map(tagId => {
                        const tag = GAME_TAGS.find(t => t.id === tagId);
                        return tag ? (
                          <span
                            key={tagId}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded text-xs"
                          >
                            {tag.icon}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                {/* Countdown */}
                {isNextGame && !countdown.isPast && !countdown.isToday && (
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold text-white">{countdown.days}</div>
                    <div className="text-xs text-slate-500 uppercase">days</div>
                  </div>
                )}
                {countdown.isToday && !countdown.isPast && (
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-bold text-orange-400">{countdown.hours}h {countdown.minutes}m</div>
                    <div className="text-xs text-slate-500 uppercase">until game</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer - Show if more games */}
      {summary && summary.gamesRemaining > limit && onViewSchedule && (
        <div className="p-4 border-t border-white/5 bg-black/20">
          <button
            onClick={onViewSchedule}
            className="w-full text-center text-sm text-slate-400 hover:text-white transition-colors"
          >
            +{summary.gamesRemaining - limit} more games this season
          </button>
        </div>
      )}
    </div>
  );
}

export default UpcomingGamesWidget;
