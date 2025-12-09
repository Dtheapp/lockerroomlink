// =============================================================================
// GAME CARD - Display individual game in schedule
// =============================================================================

import React from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  Home,
  Plane,
  Trophy,
  Ticket,
  BarChart3,
  Edit2,
  Trash2,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Play,
  ExternalLink,
  Navigation,
} from 'lucide-react';
import { 
  Game, 
  GAME_TAGS, 
  GAME_STATUS_CONFIG, 
  PLAYOFF_ROUNDS 
} from '../../types/game';
import { formatGameDate, formatGameTime, getCountdownToGame } from '../../services/gameService';

// Helper to generate maps URL - works on both mobile (opens native maps) and desktop
const getMapsUrl = (address: string, location?: string): string => {
  const query = encodeURIComponent(address || location || '');
  // Using Google Maps URL which works universally and opens native apps on mobile
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
};

interface GameCardProps {
  game: Game;
  onEdit?: (game: Game) => void;
  onDelete?: (gameId: string) => void;
  onEnterScore?: (game: Game) => void;
  onEnterStats?: (game: Game) => void;
  onDesignTicket?: (game: Game) => void;
  compact?: boolean;
  showActions?: boolean;
}

export function GameCard({
  game,
  onEdit,
  onDelete,
  onEnterScore,
  onEnterStats,
  onDesignTicket,
  compact = false,
  showActions = true,
}: GameCardProps) {
  const [showMenu, setShowMenu] = React.useState(false);
  const countdown = getCountdownToGame(game);
  const statusConfig = GAME_STATUS_CONFIG[game.status];

  // Determine card styling based on status and type
  const getCardStyle = () => {
    if (game.isPlayoff) {
      return 'border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-orange-500/5';
    }
    if (game.status === 'completed') {
      if (game.result === 'win') return 'border-green-500/30';
      if (game.result === 'loss') return 'border-red-500/30';
      return 'border-slate-500/30';
    }
    if (countdown.isToday) {
      return 'border-orange-500/50 bg-gradient-to-br from-orange-500/10 to-red-500/10';
    }
    return 'border-white/10';
  };

  if (compact) {
    return (
      <div className={`bg-zinc-800/50 rounded-xl p-4 border ${getCardStyle()} transition-all hover:border-white/20`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              game.isHome ? 'bg-orange-500/20' : 'bg-blue-500/20'
            }`}>
              {game.isHome ? (
                <Home className="w-5 h-5 text-orange-400" />
              ) : (
                <Plane className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">
                  {game.isHome ? 'vs' : '@'} {game.opponent}
                </span>
                {game.isPlayoff && (
                  <Trophy className="w-4 h-4 text-yellow-400" />
                )}
              </div>
              <p className="text-sm text-slate-400">
                {formatGameDate(game.date)} • {formatGameTime(game.time)}
              </p>
            </div>
          </div>

          {game.status === 'completed' && game.ourScore !== undefined ? (
            <div className={`text-right ${
              game.result === 'win' ? 'text-green-400' : 
              game.result === 'loss' ? 'text-red-400' : 'text-slate-400'
            }`}>
              <p className="text-lg font-bold">
                {game.ourScore} - {game.opponentScore}
              </p>
              <p className="text-xs uppercase font-medium">
                {game.result === 'win' ? 'W' : game.result === 'loss' ? 'L' : 'T'}
              </p>
            </div>
          ) : (
            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-zinc-800/50 backdrop-blur-sm rounded-xl border ${getCardStyle()} transition-all hover:border-white/20`}>
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-sm text-slate-500 font-medium">Game</div>
              <div className="text-2xl font-bold text-white">#{game.gameNumber}</div>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div>
              <div className="flex items-center gap-2">
                {game.isHome ? (
                  <Home className="w-4 h-4 text-orange-400" />
                ) : (
                  <Plane className="w-4 h-4 text-blue-400" />
                )}
                <span className="text-sm text-slate-400">
                  {game.isHome ? 'Home' : 'Away'}
                </span>
                {game.isPlayoff && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                    🏆 {PLAYOFF_ROUNDS.find(r => r.id === game.playoffRound)?.label || 'Playoff'}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white mt-1">
                {game.isHome ? 'vs' : '@'} {game.opponent}
              </h3>
            </div>
          </div>

          {showActions && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-slate-400" />
              </button>
              {showMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowMenu(false)} 
                  />
                  <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-white/10 rounded-xl overflow-hidden shadow-xl z-20 min-w-[160px]">
                    {onEdit && (
                      <button
                        onClick={() => { onEdit(game); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Game
                      </button>
                    )}
                    {onDesignTicket && game.ticketsEnabled && (
                      <button
                        onClick={() => { onDesignTicket(game); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                      >
                        <Ticket className="w-4 h-4" />
                        Design Ticket
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => { onDelete(game.id); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Date, Time, Location */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
              <Calendar className="w-3.5 h-3.5" />
              Date
            </div>
            <p className="text-white font-medium text-sm">
              {formatGameDate(game.date)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
              <Clock className="w-3.5 h-3.5" />
              Time
            </div>
            <p className="text-white font-medium text-sm">
              {formatGameTime(game.time)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
              <MapPin className="w-3.5 h-3.5" />
              Location
            </div>
            {game.address ? (
              <a
                href={getMapsUrl(game.address, game.location)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 hover:text-orange-300 font-medium text-sm truncate flex items-center gap-1 group"
                title={`Open in Maps: ${game.address}`}
              >
                <Navigation className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate group-hover:underline">{game.location}</span>
              </a>
            ) : (
              <p className="text-white font-medium text-sm truncate" title={game.location}>
                {game.location}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        {game.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {game.tags.map(tagId => {
              const tag = GAME_TAGS.find(t => t.id === tagId);
              return tag ? (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/10 text-orange-400 rounded-lg text-xs"
                >
                  {tag.icon} {tag.label}
                </span>
              ) : null;
            })}
          </div>
        )}

        {/* Status / Score */}
        {game.status === 'completed' && game.ourScore !== undefined ? (
          <div className={`rounded-xl p-4 ${
            game.result === 'win' ? 'bg-green-500/10' : 
            game.result === 'loss' ? 'bg-red-500/10' : 'bg-slate-500/10'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase font-medium">Final Score</p>
                <p className={`text-2xl font-bold ${
                  game.result === 'win' ? 'text-green-400' : 
                  game.result === 'loss' ? 'text-red-400' : 'text-slate-400'
                }`}>
                  {game.ourScore} - {game.opponentScore}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                game.result === 'win' ? 'bg-green-500/20 text-green-400' : 
                game.result === 'loss' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'
              }`}>
                {game.result === 'win' ? 'W' : game.result === 'loss' ? 'L' : 'T'}
              </div>
            </div>
            {!game.statsEntered && onEnterStats && (
              <button
                onClick={() => onEnterStats(game)}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-slate-300 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Enter Game Stats
              </button>
            )}
            {game.statsEntered && (
              <div className="mt-3 flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Stats recorded
              </div>
            )}
          </div>
        ) : game.status === 'scheduled' ? (
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                {countdown.isToday ? (
                  <>
                    <p className="text-orange-400 font-bold">GAME DAY!</p>
                    <p className="text-slate-400 text-sm">
                      {countdown.hours}h {countdown.minutes}m until kickoff
                    </p>
                  </>
                ) : countdown.isPast ? (
                  <p className="text-slate-400">Game time has passed</p>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 uppercase font-medium">Countdown</p>
                    <p className="text-white font-medium">
                      {countdown.days > 0 && `${countdown.days}d `}
                      {countdown.hours}h {countdown.minutes}m
                    </p>
                  </>
                )}
              </div>
              {onEnterScore && countdown.isPast && (
                <button
                  onClick={() => onEnterScore(game)}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-sm font-medium transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Enter Score
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={`${statusConfig.bgColor} rounded-xl p-4`}>
            <div className="flex items-center gap-2">
              <AlertCircle className={`w-5 h-5 ${statusConfig.color}`} />
              <span className={`font-medium ${statusConfig.color}`}>
                Game {statusConfig.label}
              </span>
            </div>
          </div>
        )}

        {/* Ticket badge */}
        {game.ticketsEnabled && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Ticket className="w-4 h-4" />
            <span>
              Tickets {game.ticketDesignId ? 'ready' : 'enabled'}
              {game.ticketPrice && ` • $${game.ticketPrice.toFixed(2)}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default GameCard;
