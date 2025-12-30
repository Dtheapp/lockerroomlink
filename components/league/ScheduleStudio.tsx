import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  ChevronLeft, ChevronRight, Save, RotateCcw, Wand2, Plus, Trash2, Clock,
  MapPin, Users, AlertTriangle, CheckCircle, XCircle, GripVertical, Calendar,
  Home, Building2, X, Loader2, Info, Eye, EyeOff, Maximize2, Minimize2
} from 'lucide-react';
import { toastSuccess, toastError, toastInfo, toastWarning } from '../../services/toast';
import { Team, Program } from '../../types';

// ============================================================================
// TYPES
// ============================================================================

interface TeamWithProgram {
  id: string;
  name: string;
  ageGroup: string;
  programId: string;
  programName: string;
  homeField?: string;
  homeFieldAddress?: string;
  color?: string;
}

interface Venue {
  id: string;
  name: string;
  address?: string;
  isTeamHome?: boolean;
  teamId?: string;
}

interface TimeSlot {
  id: string;
  time: string;
  label: string;
}

interface ScheduledGame {
  id: string;
  homeTeam: TeamWithProgram | null;
  awayTeam: TeamWithProgram | null;
  time: TimeSlot | null;
  venue: Venue | null;
  status: 'incomplete' | 'complete' | 'conflict';
  conflictReason?: string;
}

interface WeekData {
  weekNumber: number;
  games: ScheduledGame[];
  isByeWeek: boolean;
}

interface StudioProps {
  seasonId: string;
  leagueId: string;
  ageGroup: string;
  teams: TeamWithProgram[];
  existingGames?: ScheduledGame[];
  seasonStartDate: Date;
  onSave: (games: ScheduledGame[], weeks: WeekData[]) => Promise<void>;
  onClose: () => void;
}

// ============================================================================
// DRAGGABLE COMPONENTS
// ============================================================================

interface DraggableItemProps {
  id: string;
  type: 'team' | 'time' | 'venue';
  children: React.ReactNode;
  data: any;
  disabled?: boolean;
}

function DraggableItem({ id, type, children, data, disabled }: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { type, ...data },
    disabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`transition-all ${isDragging ? 'z-50 scale-105' : ''}`}
    >
      {children}
    </div>
  );
}

// ============================================================================
// DROP ZONES
// ============================================================================

interface DropZoneProps {
  id: string;
  accepts: ('team' | 'time' | 'venue')[];
  children: React.ReactNode;
  className?: string;
  isOver?: boolean;
}

function DropZone({ id, accepts, children, className, isOver }: DropZoneProps) {
  const { setNodeRef, isOver: dropping } = useDroppable({
    id,
    data: { accepts },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        ${className}
        ${dropping ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-900' : ''}
      `}
    >
      {children}
    </div>
  );
}

// ============================================================================
// GAME CARD COMPONENT
// ============================================================================

interface GameCardProps {
  game: ScheduledGame;
  weekNumber: number;
  onRemoveTeam: (position: 'home' | 'away') => void;
  onRemoveTime: () => void;
  onRemoveVenue: () => void;
  onDeleteGame: () => void;
  theme: string;
}

function GameCard({ game, weekNumber, onRemoveTeam, onRemoveTime, onRemoveVenue, onDeleteGame, theme }: GameCardProps) {
  const isComplete = game.homeTeam && game.awayTeam && game.time && game.venue;
  const hasConflict = game.status === 'conflict';

  return (
    <div className={`
      relative rounded-xl p-4 border-2 transition-all
      ${hasConflict 
        ? 'border-red-500/50 bg-red-500/10' 
        : isComplete 
          ? 'border-green-500/30 bg-green-500/5' 
          : 'border-yellow-500/30 bg-yellow-500/5'
      }
      ${theme === 'dark' ? '' : 'bg-white shadow-sm'}
    `}>
      {/* Delete button */}
      <button
        onClick={onDeleteGame}
        className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transition-all hover:scale-110"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Status indicator */}
      <div className="absolute top-2 left-2">
        {hasConflict ? (
          <AlertTriangle className="w-4 h-4 text-red-400" />
        ) : isComplete ? (
          <CheckCircle className="w-4 h-4 text-green-400" />
        ) : (
          <Clock className="w-4 h-4 text-yellow-400" />
        )}
      </div>

      {/* Teams row */}
      <div className="flex items-center justify-center gap-3 mt-4">
        {/* Home Team Drop Zone */}
        <DropZone
          id={`${game.id}-home`}
          accepts={['team']}
          className={`
            flex-1 min-h-[60px] rounded-lg border-2 border-dashed p-2 flex items-center justify-center
            ${game.homeTeam 
              ? 'border-solid border-white/20 bg-white/5' 
              : 'border-white/10 hover:border-purple-500/50'
            }
          `}
        >
          {game.homeTeam ? (
            <div className="flex items-center gap-2 group">
              <div 
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: game.homeTeam.color || '#8b5cf6' }}
              />
              <div className="text-center">
                <div className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {game.homeTeam.name}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Home className="w-3 h-3" /> Home
                </div>
              </div>
              <button
                onClick={() => onRemoveTeam('home')}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-500">Drop Home Team</span>
          )}
        </DropZone>

        <span className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>VS</span>

        {/* Away Team Drop Zone */}
        <DropZone
          id={`${game.id}-away`}
          accepts={['team']}
          className={`
            flex-1 min-h-[60px] rounded-lg border-2 border-dashed p-2 flex items-center justify-center
            ${game.awayTeam 
              ? 'border-solid border-white/20 bg-white/5' 
              : 'border-white/10 hover:border-purple-500/50'
            }
          `}
        >
          {game.awayTeam ? (
            <div className="flex items-center gap-2 group">
              <div 
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: game.awayTeam.color || '#8b5cf6' }}
              />
              <div className="text-center">
                <div className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {game.awayTeam.name}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  Away
                </div>
              </div>
              <button
                onClick={() => onRemoveTeam('away')}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-500">Drop Away Team</span>
          )}
        </DropZone>
      </div>

      {/* Time & Venue Row */}
      <div className="flex items-center gap-2 mt-3">
        {/* Time Drop Zone */}
        <DropZone
          id={`${game.id}-time`}
          accepts={['time']}
          className={`
            flex-1 min-h-[36px] rounded-lg border-2 border-dashed px-3 py-1.5 flex items-center justify-center
            ${game.time 
              ? 'border-solid border-white/20 bg-white/5' 
              : 'border-white/10 hover:border-purple-500/50'
            }
          `}
        >
          {game.time ? (
            <div className="flex items-center gap-2 group w-full">
              <Clock className="w-4 h-4 text-purple-400" />
              <span className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {game.time.label}
              </span>
              <button
                onClick={onRemoveTime}
                className="ml-auto opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Drop Time
            </span>
          )}
        </DropZone>

        {/* Venue Drop Zone */}
        <DropZone
          id={`${game.id}-venue`}
          accepts={['venue']}
          className={`
            flex-1 min-h-[36px] rounded-lg border-2 border-dashed px-3 py-1.5 flex items-center justify-center
            ${game.venue 
              ? 'border-solid border-white/20 bg-white/5' 
              : 'border-white/10 hover:border-purple-500/50'
            }
          `}
        >
          {game.venue ? (
            <div className="flex items-center gap-2 group w-full">
              <MapPin className="w-4 h-4 text-amber-400" />
              <span className={`text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {game.venue.name}
              </span>
              <button
                onClick={onRemoveVenue}
                className="ml-auto opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Drop Venue
            </span>
          )}
        </DropZone>
      </div>

      {/* Conflict warning */}
      {hasConflict && game.conflictReason && (
        <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {game.conflictReason}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// WEEK LANE COMPONENT
// ============================================================================

interface WeekLaneProps {
  week: WeekData;
  teams: TeamWithProgram[];
  scheduledTeamIds: Set<string>;
  onAddGame: () => void;
  onUpdateGame: (gameId: string, updates: Partial<ScheduledGame>) => void;
  onDeleteGame: (gameId: string) => void;
  onToggleBye: () => void;
  theme: string;
  getGameDate: (weekNumber: number) => Date;
}

function WeekLane({ 
  week, 
  teams, 
  scheduledTeamIds, 
  onAddGame, 
  onUpdateGame, 
  onDeleteGame, 
  onToggleBye, 
  theme,
  getGameDate 
}: WeekLaneProps) {
  const gameDate = getGameDate(week.weekNumber);
  const dateStr = gameDate.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });

  // Calculate teams scheduled this week
  const teamsThisWeek = new Set<string>();
  week.games.forEach(game => {
    if (game.homeTeam) teamsThisWeek.add(game.homeTeam.id);
    if (game.awayTeam) teamsThisWeek.add(game.awayTeam.id);
  });

  const unscheduledTeams = teams.filter(t => !teamsThisWeek.has(t.id));
  const allTeamsScheduled = unscheduledTeams.length === 0 || (unscheduledTeams.length === 1 && teams.length % 2 === 1);

  return (
    <div className={`
      rounded-2xl border overflow-hidden
      ${week.isByeWeek 
        ? theme === 'dark' 
          ? 'bg-slate-800/50 border-slate-600/50' 
          : 'bg-slate-100 border-slate-300'
        : theme === 'dark' 
          ? 'bg-white/5 border-white/10' 
          : 'bg-white border-slate-200'
      }
    `}>
      {/* Week Header */}
      <div className={`
        px-4 py-3 border-b flex items-center justify-between
        ${week.isByeWeek
          ? theme === 'dark'
            ? 'bg-slate-700/50 border-slate-600/50'
            : 'bg-slate-200 border-slate-300'
          : theme === 'dark' 
            ? 'bg-black/20 border-white/10' 
            : 'bg-slate-50 border-slate-200'
        }
      `}>
        <div className="flex items-center gap-3">
          <span className={`
            text-lg font-bold
            ${theme === 'dark' ? 'text-white' : 'text-slate-900'}
          `}>
            Week {week.weekNumber}
          </span>
          <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            {dateStr}
          </span>
          {allTeamsScheduled && !week.isByeWeek && (
            <CheckCircle className="w-4 h-4 text-green-400" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleBye}
            className={`
              text-xs px-2 py-1 rounded-lg transition-colors
              ${week.isByeWeek
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : theme === 'dark'
                  ? 'bg-white/5 text-slate-400 hover:bg-white/10'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }
            `}
          >
            {week.isByeWeek ? '🔓 Remove Bye' : '🔒 Make Bye Week'}
          </button>
          {!week.isByeWeek && (
            <button
              onClick={onAddGame}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add Game
            </button>
          )}
        </div>
      </div>

      {/* Week Content */}
      <div className="p-4">
        {week.isByeWeek ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">😴</div>
            <div className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              League Bye Week
            </div>
            <div className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
              All teams rest this week
            </div>
          </div>
        ) : week.games.length === 0 ? (
          <DropZone
            id={`week-${week.weekNumber}-empty`}
            accepts={['team']}
            className={`
              min-h-[120px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center
              ${theme === 'dark' 
                ? 'border-white/10 hover:border-purple-500/30' 
                : 'border-slate-200 hover:border-purple-500/30'
              }
            `}
          >
            <Users className={`w-8 h-8 mb-2 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
            <span className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
              Drag teams here to create matchups
            </span>
            <span className={`text-xs ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
              or click "Add Game" above
            </span>
          </DropZone>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {week.games.map(game => (
              <GameCard
                key={game.id}
                game={game}
                weekNumber={week.weekNumber}
                onRemoveTeam={(pos) => {
                  if (pos === 'home') {
                    onUpdateGame(game.id, { homeTeam: null });
                  } else {
                    onUpdateGame(game.id, { awayTeam: null });
                  }
                }}
                onRemoveTime={() => onUpdateGame(game.id, { time: null })}
                onRemoveVenue={() => onUpdateGame(game.id, { venue: null })}
                onDeleteGame={() => onDeleteGame(game.id)}
                theme={theme}
              />
            ))}
          </div>
        )}

        {/* Unscheduled teams indicator */}
        {!week.isByeWeek && unscheduledTeams.length > 0 && (
          <div className={`
            mt-4 p-3 rounded-lg border
            ${theme === 'dark' 
              ? 'bg-yellow-500/10 border-yellow-500/20' 
              : 'bg-yellow-50 border-yellow-200'
            }
          `}>
            <div className="flex items-center gap-2 text-sm text-yellow-400 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Unscheduled this week:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unscheduledTeams.map(team => (
                <span
                  key={team.id}
                  className={`
                    text-xs px-2 py-1 rounded-full
                    ${theme === 'dark' 
                      ? 'bg-white/10 text-slate-300' 
                      : 'bg-white text-slate-700'
                    }
                  `}
                >
                  {team.name}
                </span>
              ))}
              {unscheduledTeams.length === 1 && teams.length % 2 === 1 && (
                <span className="text-xs text-yellow-500 italic ml-2">
                  (Bye this week - odd number of teams)
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN SCHEDULE STUDIO COMPONENT
// ============================================================================

export default function ScheduleStudio({
  seasonId,
  leagueId,
  ageGroup,
  teams,
  existingGames,
  seasonStartDate,
  onSave,
  onClose,
}: StudioProps) {
  const { theme } = useTheme();
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [totalWeeks, setTotalWeeks] = useState(10);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'team' | 'time' | 'venue' | null>(null);
  const [activeData, setActiveData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showPalette, setShowPalette] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAddVenueModal, setShowAddVenueModal] = useState(false);
  const [showRemoveWeekWarning, setShowRemoveWeekWarning] = useState<number | null>(null);
  const [customVenues, setCustomVenues] = useState<Venue[]>([]);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueAddress, setNewVenueAddress] = useState('');

  // Generate time slots
  const timeSlots: TimeSlot[] = useMemo(() => {
    const slots: TimeSlot[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      const time24 = `${hour.toString().padStart(2, '0')}:00`;
      const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      slots.push({
        id: `time-${time24}`,
        time: time24,
        label: `${hour12}:00 ${ampm}`,
      });
      // Add half-hour slots
      slots.push({
        id: `time-${hour.toString().padStart(2, '0')}:30`,
        time: `${hour.toString().padStart(2, '0')}:30`,
        label: `${hour12}:30 ${ampm}`,
      });
    }
    return slots;
  }, []);

  // Generate venues from team home fields + custom venues
  const venues: Venue[] = useMemo(() => {
    const teamVenues: Venue[] = teams
      .filter(t => t.homeField)
      .map(t => ({
        id: `venue-${t.id}`,
        name: t.homeField || `${t.name} Home`,
        address: t.homeFieldAddress,
        isTeamHome: true,
        teamId: t.id,
      }));
    return [...teamVenues, ...customVenues];
  }, [teams, customVenues]);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize weeks on first render only
  useEffect(() => {
    if (weeks.length === 0) {
      const initialWeeks: WeekData[] = [];
      for (let i = 1; i <= totalWeeks; i++) {
        initialWeeks.push({
          weekNumber: i,
          games: [],
          isByeWeek: false,
        });
      }
      setWeeks(initialWeeks);
    }
  }, []); // Only run once on mount

  // Handle adding weeks (preserves existing data)
  const handleAddWeek = () => {
    const newWeekNumber = weeks.length + 1;
    setWeeks(prev => [...prev, {
      weekNumber: newWeekNumber,
      games: [],
      isByeWeek: false,
    }]);
    setTotalWeeks(newWeekNumber);
  };

  // Handle removing weeks (warns if games exist)
  const handleRemoveWeek = () => {
    if (weeks.length <= 1) return;
    
    const lastWeek = weeks[weeks.length - 1];
    
    // Check if the last week has any games
    if (lastWeek.games.length > 0 || lastWeek.isByeWeek) {
      setShowRemoveWeekWarning(lastWeek.weekNumber);
      return;
    }
    
    // Safe to remove - no games
    confirmRemoveWeek();
  };

  // Confirm removal of week
  const confirmRemoveWeek = () => {
    setWeeks(prev => prev.slice(0, -1));
    setTotalWeeks(prev => Math.max(1, prev - 1));
    setShowRemoveWeekWarning(null);
  };

  // Get game date for a week number
  const getGameDate = useCallback((weekNumber: number): Date => {
    const date = new Date(seasonStartDate);
    date.setDate(date.getDate() + ((weekNumber - 1) * 7));
    // Default to Saturday
    while (date.getDay() !== 6) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }, [seasonStartDate]);

  // Create a new empty game
  const createNewGame = (weekNumber: number): ScheduledGame => ({
    id: `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    homeTeam: null,
    awayTeam: null,
    time: null,
    venue: null,
    status: 'incomplete',
  });

  // Add game to a week
  const handleAddGame = (weekNumber: number) => {
    setWeeks(prev => prev.map(week => {
      if (week.weekNumber === weekNumber) {
        return {
          ...week,
          games: [...week.games, createNewGame(weekNumber)],
        };
      }
      return week;
    }));
  };

  // Update a game
  const handleUpdateGame = (weekNumber: number, gameId: string, updates: Partial<ScheduledGame>) => {
    setWeeks(prev => prev.map(week => {
      if (week.weekNumber === weekNumber) {
        return {
          ...week,
          games: week.games.map(game => {
            if (game.id === gameId) {
              const updated = { ...game, ...updates };
              // Update status
              if (updated.homeTeam && updated.awayTeam && updated.time && updated.venue) {
                updated.status = 'complete';
              } else {
                updated.status = 'incomplete';
              }
              return updated;
            }
            return game;
          }),
        };
      }
      return week;
    }));
  };

  // Delete a game
  const handleDeleteGame = (weekNumber: number, gameId: string) => {
    setWeeks(prev => prev.map(week => {
      if (week.weekNumber === weekNumber) {
        return {
          ...week,
          games: week.games.filter(game => game.id !== gameId),
        };
      }
      return week;
    }));
  };

  // Toggle bye week
  const handleToggleBye = (weekNumber: number) => {
    setWeeks(prev => prev.map(week => {
      if (week.weekNumber === weekNumber) {
        return {
          ...week,
          isByeWeek: !week.isByeWeek,
          games: !week.isByeWeek ? [] : week.games, // Clear games when making bye week
        };
      }
      return week;
    }));
  };

  // Calculate scheduled teams per week
  const getScheduledTeamIds = useCallback((weekNumber: number): Set<string> => {
    const week = weeks.find(w => w.weekNumber === weekNumber);
    const ids = new Set<string>();
    if (week) {
      week.games.forEach(game => {
        if (game.homeTeam) ids.add(game.homeTeam.id);
        if (game.awayTeam) ids.add(game.awayTeam.id);
      });
    }
    return ids;
  }, [weeks]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    setActiveType(active.data.current?.type);
    setActiveData(active.data.current);
  };

  // Handle drag cancel - IMPORTANT for cleanup
  const handleDragCancel = () => {
    setActiveId(null);
    setActiveType(null);
    setActiveData(null);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    // Always reset state at the end, regardless of what happens
    const resetState = () => {
      setActiveId(null);
      setActiveType(null);
      setActiveData(null);
    };

    if (!over) {
      resetState();
      return;
    }

    try {
      const activeType = active.data.current?.type;
      const overId = over.id as string;

      // Parse the drop zone ID
      // Drop zone IDs look like: "game-1735612345678-abc123def-home" or "game-1735612345678-abc123def-away"
      // We need to extract the game ID (everything except the last part) and the slot type (last part)
      
      if (overId.startsWith('game-')) {
        // Dropped on a game slot
        const slotType = overId.split('-').pop(); // 'home', 'away', 'time', 'venue'
        // Game ID is everything except the last segment
        const lastDashIndex = overId.lastIndexOf('-');
        const gameId = overId.substring(0, lastDashIndex);
        
        // Find which week this game is in
        const weekWithGame = weeks.find(w => w.games.some(g => g.id === gameId));
        
        if (weekWithGame) {
          if (activeType === 'team' && (slotType === 'home' || slotType === 'away')) {
            // Check if team is already scheduled this week
            const scheduledIds = getScheduledTeamIds(weekWithGame.weekNumber);
            if (scheduledIds.has(active.data.current?.team?.id)) {
              toastWarning('This team is already scheduled for this week');
            } else {
              handleUpdateGame(weekWithGame.weekNumber, gameId, {
                [slotType === 'home' ? 'homeTeam' : 'awayTeam']: active.data.current?.team,
              });
            }
          } else if (activeType === 'time' && slotType === 'time') {
            handleUpdateGame(weekWithGame.weekNumber, gameId, {
              time: active.data.current?.timeSlot,
            });
          } else if (activeType === 'venue' && slotType === 'venue') {
            handleUpdateGame(weekWithGame.weekNumber, gameId, {
              venue: active.data.current?.venue,
            });
          }
        }
      } else if (overId.startsWith('week-') && overId.endsWith('-empty')) {
        // Dropped on empty week - create new game with this team
        // Format: "week-1-empty", "week-2-empty", etc.
        const weekNumber = parseInt(overId.split('-')[1]);
        
        if (activeType === 'team') {
          const scheduledIds = getScheduledTeamIds(weekNumber);
          if (scheduledIds.has(active.data.current?.team?.id)) {
            toastWarning('This team is already scheduled for this week');
          } else {
            const newGame = createNewGame(weekNumber);
            newGame.homeTeam = active.data.current?.team;
            setWeeks(prev => prev.map(week => {
              if (week.weekNumber === weekNumber) {
                return { ...week, games: [...week.games, newGame] };
              }
              return week;
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error in drag end:', error);
    } finally {
      // ALWAYS reset state
      resetState();
    }
  };

  // Auto-fill with round robin
  const handleAutoFill = () => {
    if (teams.length < 2) {
      toastError('Need at least 2 teams to generate a schedule');
      return;
    }

    // Simple round-robin generation
    const teamList = [...teams];
    if (teamList.length % 2 !== 0) {
      // Add a "BYE" placeholder for odd number of teams
      teamList.push({ id: 'BYE', name: 'BYE', ageGroup: '', programId: '', programName: '' });
    }

    const n = teamList.length;
    const rounds = n - 1;
    const matchesPerRound = n / 2;

    const newWeeks: WeekData[] = [];
    
    for (let round = 0; round < Math.min(rounds, totalWeeks); round++) {
      const games: ScheduledGame[] = [];
      
      for (let match = 0; match < matchesPerRound; match++) {
        const home = (round + match) % (n - 1);
        let away = (n - 1 - match + round) % (n - 1);
        
        if (match === 0) {
          away = n - 1;
        }

        const homeTeam = teamList[home].id === 'BYE' ? null : teamList[home];
        const awayTeam = teamList[away].id === 'BYE' ? null : teamList[away];

        // Only add game if neither team is BYE
        if (homeTeam && awayTeam) {
          games.push({
            id: `game-${Date.now()}-${round}-${match}`,
            homeTeam,
            awayTeam,
            time: null,
            venue: homeTeam?.homeField ? {
              id: `venue-${homeTeam.id}`,
              name: homeTeam.homeField,
              address: homeTeam.homeFieldAddress,
              isTeamHome: true,
              teamId: homeTeam.id,
            } : null,
            status: 'incomplete',
          });
        }
      }

      newWeeks.push({
        weekNumber: round + 1,
        games,
        isByeWeek: false,
      });
    }

    // Fill remaining weeks as empty
    for (let i = rounds; i < totalWeeks; i++) {
      newWeeks.push({
        weekNumber: i + 1,
        games: [],
        isByeWeek: i >= rounds, // Extra weeks are bye weeks
      });
    }

    setWeeks(newWeeks);
    toastSuccess(`Generated ${rounds} rounds of games for ${teams.length} teams`);
  };

  // Save schedule
  const handleSave = async () => {
    setSaving(true);
    try {
      // Flatten games from all weeks
      const allGames = weeks.flatMap(week => 
        week.games.map(game => ({
          ...game,
          weekNumber: week.weekNumber,
          date: getGameDate(week.weekNumber),
        }))
      );
      
      await onSave(allGames, weeks);
      toastSuccess('Schedule saved successfully!');
    } catch (error) {
      console.error('Error saving schedule:', error);
      toastError('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  // Add custom venue
  const handleAddVenue = () => {
    if (!newVenueName.trim()) {
      toastWarning('Please enter a venue name');
      return;
    }
    const newVenue: Venue = {
      id: `venue-custom-${Date.now()}`,
      name: newVenueName.trim(),
      address: newVenueAddress.trim() || undefined,
      isTeamHome: false,
    };
    setCustomVenues(prev => [...prev, newVenue]);
    setNewVenueName('');
    setNewVenueAddress('');
    setShowAddVenueModal(false);
    toastSuccess('Venue added!');
  };

  // Calculate stats
  const stats = useMemo(() => {
    let totalGames = 0;
    let completeGames = 0;
    let incompleteGames = 0;
    let byeWeeks = 0;

    weeks.forEach(week => {
      if (week.isByeWeek) {
        byeWeeks++;
      } else {
        week.games.forEach(game => {
          totalGames++;
          if (game.status === 'complete') completeGames++;
          else incompleteGames++;
        });
      }
    });

    return { totalGames, completeGames, incompleteGames, byeWeeks };
  }, [weeks]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={`
        fixed inset-0 z-50 flex flex-col
        ${theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'}
        ${isFullscreen ? '' : 'md:p-4'}
      `}>
        {/* Header */}
        <div className={`
          shrink-0 px-4 py-3 border-b flex items-center justify-between
          ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-white border-slate-200'}
        `}>
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                🎨 Schedule Studio
              </h1>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {ageGroup} • {teams.length} Teams
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-6">
            <div className="text-center">
              <div className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {stats.totalGames}
              </div>
              <div className="text-xs text-slate-500">Games</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-400">{stats.completeGames}</div>
              <div className="text-xs text-slate-500">Complete</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-400">{stats.incompleteGames}</div>
              <div className="text-xs text-slate-500">Incomplete</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-400">{stats.byeWeeks}</div>
              <div className="text-xs text-slate-500">Bye Weeks</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPalette(!showPalette)}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'bg-white/5 hover:bg-white/10 text-slate-400' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              title={showPalette ? 'Hide Palette' : 'Show Palette'}
            >
              {showPalette ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'bg-white/5 hover:bg-white/10 text-slate-400' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={handleAutoFill}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors
                ${theme === 'dark'
                  ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }
              `}
            >
              <Wand2 className="w-4 h-4" />
              Auto-Fill
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 px-4 py-2 rounded-xl font-medium text-white transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Palette Sidebar */}
          {showPalette && (
            <div className={`
              w-64 shrink-0 border-r overflow-y-auto
              ${theme === 'dark' ? 'bg-black/20 border-white/10' : 'bg-white border-slate-200'}
            `}>
              {/* Weeks Config */}
              <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                <label className={`block text-xs font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  Total Weeks
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRemoveWeek}
                    disabled={weeks.length <= 1}
                    className={`p-2 rounded-lg transition-colors ${
                      weeks.length <= 1 
                        ? 'opacity-50 cursor-not-allowed' 
                        : theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className={`flex-1 text-center font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {weeks.length}
                  </span>
                  <button
                    onClick={handleAddWeek}
                    className={`p-2 rounded-lg ${
                      theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Teams */}
              <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Teams
                  </span>
                  <span className="text-xs text-slate-500">({teams.length})</span>
                </div>
                <div className="space-y-2">
                  {teams.map(team => (
                    <DraggableItem
                      key={team.id}
                      id={`team-${team.id}`}
                      type="team"
                      data={{ team }}
                    >
                      <div className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab
                        ${theme === 'dark' 
                          ? 'bg-white/5 hover:bg-white/10 border border-white/10' 
                          : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'
                        }
                      `}>
                        <GripVertical className="w-4 h-4 text-slate-500" />
                        <div 
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: team.color || '#8b5cf6' }}
                        />
                        <span className={`text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                          {team.name}
                        </span>
                      </div>
                    </DraggableItem>
                  ))}
                </div>
              </div>

              {/* Time Slots */}
              <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Times
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                  {timeSlots.filter(t => t.time.endsWith(':00')).map(slot => (
                    <DraggableItem
                      key={slot.id}
                      id={slot.id}
                      type="time"
                      data={{ timeSlot: slot }}
                    >
                      <div className={`
                        text-center px-2 py-1.5 rounded-lg cursor-grab text-xs
                        ${theme === 'dark' 
                          ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300' 
                          : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700'
                        }
                      `}>
                        {slot.label}
                      </div>
                    </DraggableItem>
                  ))}
                </div>
              </div>

              {/* Venues */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      Venues
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAddVenueModal(true)}
                    className="text-xs text-purple-400 hover:text-purple-300"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {venues.map(venue => (
                    <DraggableItem
                      key={venue.id}
                      id={venue.id}
                      type="venue"
                      data={{ venue }}
                    >
                      <div className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab
                        ${theme === 'dark' 
                          ? 'bg-white/5 hover:bg-white/10 border border-white/10' 
                          : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'
                        }
                      `}>
                        <GripVertical className="w-4 h-4 text-slate-500" />
                        {venue.isTeamHome ? (
                          <Home className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span className={`text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                          {venue.name}
                        </span>
                      </div>
                    </DraggableItem>
                  ))}
                  {venues.length === 0 && (
                    <div className="text-center py-4 text-sm text-slate-500">
                      No venues yet. Add one above or drag team home fields.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Canvas Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {weeks.map(week => (
              <WeekLane
                key={week.weekNumber}
                week={week}
                teams={teams}
                scheduledTeamIds={getScheduledTeamIds(week.weekNumber)}
                onAddGame={() => handleAddGame(week.weekNumber)}
                onUpdateGame={(gameId, updates) => handleUpdateGame(week.weekNumber, gameId, updates)}
                onDeleteGame={(gameId) => handleDeleteGame(week.weekNumber, gameId)}
                onToggleBye={() => handleToggleBye(week.weekNumber)}
                theme={theme}
                getGameDate={getGameDate}
              />
            ))}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId && activeType === 'team' && activeData?.team && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 text-white shadow-xl">
              <div 
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: activeData.team.color || '#ffffff' }}
              />
              <span className="text-sm font-medium">{activeData.team.name}</span>
            </div>
          )}
          {activeId && activeType === 'time' && activeData?.timeSlot && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 text-white shadow-xl">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">{activeData.timeSlot.label}</span>
            </div>
          )}
          {activeId && activeType === 'venue' && activeData?.venue && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500 text-white shadow-xl">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">{activeData.venue.name}</span>
            </div>
          )}
        </DragOverlay>

        {/* Add Venue Modal */}
        {showAddVenueModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
            <div className={`
              w-full max-w-md rounded-2xl p-6
              ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}
            `}>
              <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Add Custom Venue
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    Venue Name *
                  </label>
                  <input
                    type="text"
                    value={newVenueName}
                    onChange={(e) => setNewVenueName(e.target.value)}
                    placeholder="e.g., Central Park Field"
                    className={`
                      w-full px-4 py-2.5 rounded-lg
                      ${theme === 'dark'
                        ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                        : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                      }
                    `}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    Address (optional)
                  </label>
                  <input
                    type="text"
                    value={newVenueAddress}
                    onChange={(e) => setNewVenueAddress(e.target.value)}
                    placeholder="e.g., 123 Main St, City"
                    className={`
                      w-full px-4 py-2.5 rounded-lg
                      ${theme === 'dark'
                        ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                        : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                      }
                    `}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddVenueModal(false)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    theme === 'dark'
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddVenue}
                  className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-purple-600 to-purple-500 text-white"
                >
                  Add Venue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Week Warning Modal */}
        {showRemoveWeekWarning && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
            <div className={`
              w-full max-w-md rounded-2xl p-6
              ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}
            `}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-red-500/20">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Remove Week {showRemoveWeekWarning}?
                </h3>
              </div>
              <p className={`mb-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Week {showRemoveWeekWarning} has scheduled games or is marked as a bye week. 
                Removing it will <span className="font-semibold text-red-400">permanently delete</span> all games in that week.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowRemoveWeekWarning(null)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    theme === 'dark'
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveWeek}
                  className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400"
                >
                  Remove Week
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
