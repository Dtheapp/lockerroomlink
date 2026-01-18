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
import { useUnsavedChanges } from '../../contexts/UnsavedChangesContext';
import { 
  ChevronLeft, ChevronRight, Save, RotateCcw, Wand2, Plus, Trash2, Clock,
  MapPin, Users, AlertTriangle, CheckCircle, XCircle, GripVertical, Calendar,
  Home, Building2, X, Loader2, Info, Eye, EyeOff, HelpCircle
} from 'lucide-react';
import { toastSuccess, toastError, toastInfo, toastWarning } from '../../services/toast';
import { Team, Program } from '../../types';
import ScheduleStudioOnboarding, { shouldShowOnboarding, markOnboardingComplete } from './ScheduleStudioOnboarding';

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
  logoUrl?: string;
}

interface Venue {
  id: string;
  name: string;           // Field name (e.g., "Field 1", "Main Field")
  location?: string;       // Location/Complex name (e.g., "Commerce Middle School")
  address?: string;        // Physical address
  isTeamHome?: boolean;
  teamId?: string;
}

interface TimeSlot {
  id: string;
  time: string;
  label: string;
}

// Existing booking from other schedules (for cross-age-group conflict detection)
export interface ExistingBooking {
  date: Date;
  time: string;          // 24hr format "14:00"
  venueId: string;
  venueName: string;
  ageGroup: string;
  homeTeam: string;
  awayTeam: string;
}

interface ScheduledGame {
  id: string;
  homeTeam: TeamWithProgram | null;
  awayTeam: TeamWithProgram | null;
  time: TimeSlot | null;
  venue: Venue | null;
  status: 'incomplete' | 'complete' | 'conflict';
  conflictReason?: string;
  weekNumber?: number;      // For loading existing games
  date?: string | Date;     // For loading existing games
}

interface WeekData {
  weekNumber: number;
  games: ScheduledGame[];
  isByeWeek: boolean;
  customDate?: Date;  // Allow override of calculated date
}

interface StudioProps {
  seasonId: string;
  leagueId: string;
  ageGroup: string;
  teams: TeamWithProgram[];
  existingBookings?: ExistingBooking[]; // Bookings from other age groups
  existingGames?: ScheduledGame[];
  existingWeeksCount?: number; // Number of weeks from saved schedule
  seasonStartDate: Date;
  onSave: (games: ScheduledGame[], weeks: WeekData[]) => Promise<void>;
  onClose: () => void;
}

// ============================================================================
// DRAGGABLE COMPONENTS - Enhanced with Glow Effects
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
    opacity: isDragging ? 0.8 : 1,
    cursor: disabled ? 'not-allowed' : 'grab',
  };

  // Get glow color based on type
  const glowColor = type === 'team' ? 'purple' : type === 'time' ? 'purple' : 'amber';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        transition-all duration-200 
        ${isDragging 
          ? `z-50 scale-110 shadow-xl shadow-${glowColor}-500/30 ring-2 ring-${glowColor}-400/50 rounded-xl` 
          : 'hover:scale-[1.02]'
        }
      `}
    >
      {children}
    </div>
  );
}

// ============================================================================
// DROP ZONES - Enhanced with Magnetic Glow Effects
// ============================================================================

interface DropZoneProps {
  id: string;
  accepts: ('team' | 'time' | 'venue')[];
  children: React.ReactNode;
  className?: string;
  isOver?: boolean;
  style?: React.CSSProperties;
}

function DropZone({ id, accepts, children, className, isOver, style }: DropZoneProps) {
  const { setNodeRef, isOver: dropping, active } = useDroppable({
    id,
    data: { accepts },
  });
  
  // Determine if the active item type is accepted
  const activeType = active?.data?.current?.type;
  const canAccept = activeType && accepts.includes(activeType);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        ${className}
        transition-all duration-200
        ${dropping && canAccept 
          ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-900 scale-[1.02] bg-purple-500/10' 
          : ''
        }
        ${active && canAccept && !dropping 
          ? 'ring-1 ring-purple-500/30 animate-pulse' 
          : ''
        }
      `}
    >
      {children}
    </div>
  );
}

// ============================================================================
// GAME CARD COMPONENT - World-Class Design
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
  
  // Get team colors for accent effects
  const homeColor = game.homeTeam?.color || '#8b5cf6';
  const awayColor = game.awayTeam?.color || '#ec4899';

  return (
    <div className={`
      relative rounded-2xl overflow-hidden transition-all duration-300 group
      ${hasConflict 
        ? 'ring-2 ring-red-500/70 animate-pulse' 
        : isComplete 
          ? 'ring-2 ring-emerald-500/30 hover:ring-emerald-500/50' 
          : 'ring-1 ring-white/10 hover:ring-purple-500/30'
      }
      ${hasConflict 
        ? theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50' 
        : theme === 'dark' ? 'bg-white/[0.03]' : 'bg-white shadow-lg'
      }
      hover:scale-[1.02] hover:shadow-xl
    `}
    style={{
      boxShadow: hasConflict 
        ? '0 0 40px -5px rgba(239, 68, 68, 0.35), inset 0 0 20px -10px rgba(239, 68, 68, 0.2)' 
        : isComplete 
          ? '0 0 30px -5px rgba(16, 185, 129, 0.15)' 
          : undefined,
      animation: hasConflict ? 'conflict-pulse 2s ease-in-out infinite' : undefined
    }}
    >
      {/* Team color accent bar at top */}
      <div className="h-1 flex">
        <div className="flex-1 transition-all duration-300" style={{ backgroundColor: homeColor, opacity: game.homeTeam ? 1 : 0.2 }} />
        <div className="flex-1 transition-all duration-300" style={{ backgroundColor: awayColor, opacity: game.awayTeam ? 1 : 0.2 }} />
      </div>
      
      {/* Gradient overlay based on completion status */}
      <div className={`
        absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none
        ${isComplete 
          ? 'bg-gradient-to-br from-emerald-500/5 to-transparent' 
          : 'bg-gradient-to-br from-purple-500/5 to-transparent'
        }
      `} />
      
      <div className="relative p-4">
        {/* Header row - Status & Delete */}
        <div className="flex items-center justify-between mb-3">
          <div className={`
            flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider
            ${hasConflict 
              ? 'bg-red-500/20 text-red-400' 
              : isComplete 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-amber-500/20 text-amber-400'
            }
          `}>
            {hasConflict ? (
              <>
                <AlertTriangle className="w-3 h-3" />
                <span>Conflict</span>
              </>
            ) : isComplete ? (
              <>
                <CheckCircle className="w-3 h-3" />
                <span>Ready</span>
              </>
            ) : (
              <>
                <Clock className="w-3 h-3" />
                <span>Draft</span>
              </>
            )}
          </div>
          <button
            onClick={onDeleteGame}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all hover:scale-110"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Teams Matchup - Premium Design */}
        <div className="flex items-stretch gap-2">
          {/* Home Team */}
          <DropZone
            id={`${game.id}-home`}
            accepts={['team']}
            className={`
              flex-1 rounded-xl border-2 border-dashed p-3 flex flex-col items-center justify-center min-h-[80px] transition-all duration-200
              ${game.homeTeam 
                ? 'border-solid border-transparent bg-gradient-to-br from-white/[0.08] to-white/[0.02]' 
                : `border-white/10 hover:border-purple-500/50 hover:bg-purple-500/5`
              }
            `}
            style={game.homeTeam ? { borderColor: `${homeColor}30` } : undefined}
          >
            {game.homeTeam ? (
              <div className="flex flex-col items-center gap-1 group/team w-full">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg transition-transform group-hover/team:scale-110"
                  style={{ 
                    background: `linear-gradient(135deg, ${homeColor}, ${homeColor}99)`,
                    boxShadow: `0 4px 20px -5px ${homeColor}50`
                  }}
                >
                  {game.homeTeam.name.charAt(0)}
                </div>
                <div className="text-center">
                  <div className={`text-sm font-semibold leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {game.homeTeam.name}
                  </div>
                  <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 mt-0.5">
                    <Home className="w-3 h-3" /> 
                    <span className="uppercase tracking-wider font-medium">Home</span>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveTeam('home')}
                  className="absolute top-1 right-1 opacity-0 group-hover/team:opacity-100 p-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <div className="w-10 h-10 rounded-xl border-2 border-dashed border-current flex items-center justify-center opacity-30">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider">Drop Home</span>
              </div>
            )}
          </DropZone>

          {/* VS Badge */}
          <div className="flex items-center">
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center font-black text-sm
              ${theme === 'dark' 
                ? 'bg-white/10 text-white/70' 
                : 'bg-slate-100 text-slate-400'
              }
            `}>
              VS
            </div>
          </div>

          {/* Away Team */}
          <DropZone
            id={`${game.id}-away`}
            accepts={['team']}
            className={`
              flex-1 rounded-xl border-2 border-dashed p-3 flex flex-col items-center justify-center min-h-[80px] transition-all duration-200
              ${game.awayTeam 
                ? 'border-solid border-transparent bg-gradient-to-br from-white/[0.08] to-white/[0.02]' 
                : `border-white/10 hover:border-purple-500/50 hover:bg-purple-500/5`
              }
            `}
            style={game.awayTeam ? { borderColor: `${awayColor}30` } : undefined}
          >
            {game.awayTeam ? (
              <div className="flex flex-col items-center gap-1 group/team w-full relative">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg transition-transform group-hover/team:scale-110"
                  style={{ 
                    background: `linear-gradient(135deg, ${awayColor}, ${awayColor}99)`,
                    boxShadow: `0 4px 20px -5px ${awayColor}50`
                  }}
                >
                  {game.awayTeam.name.charAt(0)}
                </div>
                <div className="text-center">
                  <div className={`text-sm font-semibold leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {game.awayTeam.name}
                  </div>
                  <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 mt-0.5">
                    <span className="uppercase tracking-wider font-medium">Away</span>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveTeam('away')}
                  className="absolute top-1 right-1 opacity-0 group-hover/team:opacity-100 p-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <div className="w-10 h-10 rounded-xl border-2 border-dashed border-current flex items-center justify-center opacity-30">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider">Drop Away</span>
              </div>
            )}
          </DropZone>
        </div>

        {/* Time & Venue Row - Sleek Pills */}
        <div className="flex gap-2 mt-3">
          {/* Time */}
          <DropZone
            id={`${game.id}-time`}
            accepts={['time']}
            className={`
              flex-1 rounded-xl border-2 border-dashed px-3 py-2 flex items-center justify-center transition-all duration-200
              ${game.time 
                ? 'border-solid border-purple-500/30 bg-purple-500/10' 
                : 'border-white/10 hover:border-purple-500/50 hover:bg-purple-500/5'
              }
            `}
          >
            {game.time ? (
              <div className="flex items-center gap-2 group/time w-full">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-purple-400" />
                </div>
                <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {game.time.label}
                </span>
                <button
                  onClick={onRemoveTime}
                  className="ml-auto opacity-0 group-hover/time:opacity-100 p-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500">
                <Clock className="w-4 h-4 opacity-50" />
                <span className="text-xs font-medium">Time</span>
              </div>
            )}
          </DropZone>

          {/* Venue */}
          <DropZone
            id={`${game.id}-venue`}
            accepts={['venue']}
            className={`
              flex-1 rounded-xl border-2 border-dashed px-3 py-2 flex items-center justify-center overflow-hidden transition-all duration-200
              ${game.venue 
                ? 'border-solid border-amber-500/30 bg-amber-500/10' 
                : 'border-white/10 hover:border-amber-500/50 hover:bg-amber-500/5'
              }
            `}
          >
            {game.venue ? (
              <div className="flex items-center gap-2 group/venue w-full min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0 truncate">
                  <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`} title={game.venue.location ? `${game.venue.name} @ ${game.venue.location}` : game.venue.name}>
                    {game.venue.name}
                  </span>
                  {game.venue.location && (
                    <span className={`text-xs ml-1 ${theme === 'dark' ? 'text-amber-400/80' : 'text-amber-600'}`}>
                      @ {game.venue.location}
                    </span>
                  )}
                </div>
                <button
                  onClick={onRemoveVenue}
                  className="opacity-0 group-hover/venue:opacity-100 p-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500">
                <MapPin className="w-4 h-4 opacity-50" />
                <span className="text-xs font-medium">Venue</span>
              </div>
            )}
          </DropZone>
        </div>

        {/* Conflict warning */}
        {hasConflict && game.conflictReason && (
          <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{game.conflictReason}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// WEEK LANE COMPONENT - Stadium-Inspired Design
// ============================================================================

interface WeekLaneProps {
  week: WeekData;
  teams: TeamWithProgram[];
  scheduledTeamIds: Set<string>;
  onAddGame: () => void;
  onUpdateGame: (gameId: string, updates: Partial<ScheduledGame>) => void;
  onDeleteGame: (gameId: string) => void;
  onToggleBye: () => void;
  onEditDate: () => void;
  theme: string;
  getGameDate: (weekNumber: number, customDate?: Date) => Date;
}

function WeekLane({ 
  week, 
  teams, 
  scheduledTeamIds, 
  onAddGame, 
  onUpdateGame, 
  onDeleteGame, 
  onToggleBye,
  onEditDate,
  theme,
  getGameDate 
}: WeekLaneProps) {
  const gameDate = getGameDate(week.weekNumber, week.customDate);
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
  
  // Calculate completion percentage
  const completedGames = week.games.filter(g => g.homeTeam && g.awayTeam && g.time && g.venue).length;
  const completionPercent = week.games.length > 0 ? Math.round((completedGames / week.games.length) * 100) : 0;

  return (
    <div className={`
      relative rounded-2xl overflow-hidden transition-all duration-300
      ${week.isByeWeek 
        ? theme === 'dark' 
          ? 'bg-gradient-to-br from-slate-800/80 to-slate-900/80 ring-1 ring-slate-600/30' 
          : 'bg-gradient-to-br from-slate-200 to-slate-100 ring-1 ring-slate-300'
        : theme === 'dark' 
          ? 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] ring-1 ring-white/10 hover:ring-purple-500/20' 
          : 'bg-white ring-1 ring-slate-200 hover:ring-purple-300 shadow-sm'
      }
    `}>
      {/* Stadium Field Lines Pattern (subtle) */}
      {!week.isByeWeek && (
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none overflow-hidden">
          {/* Horizontal "yard" lines */}
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i} 
              className="absolute left-0 right-0 h-px bg-white"
              style={{ top: `${25 + i * 25}%` }}
            />
          ))}
          {/* Center circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-white opacity-50" />
        </div>
      )}
      
      {/* Week Header - Scoreboard Style */}
      <div className={`
        relative px-5 py-4 flex items-center justify-between overflow-hidden
        ${week.isByeWeek
          ? theme === 'dark'
            ? 'bg-slate-700/50'
            : 'bg-slate-300/50'
          : theme === 'dark' 
            ? 'bg-gradient-to-r from-purple-900/20 via-transparent to-purple-900/20' 
            : 'bg-gradient-to-r from-purple-50 via-white to-purple-50'
        }
      `}>
        {/* Decorative corner accents */}
        {!week.isByeWeek && (
          <>
            <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-purple-500/20 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-purple-500/20 rounded-tr-xl" />
          </>
        )}
        
        <div className="flex items-center gap-4">
          {/* Week Number Badge */}
          <div className={`
            relative flex items-center justify-center w-14 h-14 rounded-2xl font-black text-xl
            ${week.isByeWeek
              ? 'bg-slate-600/50 text-slate-400'
              : allTeamsScheduled 
                ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 text-emerald-400 ring-2 ring-emerald-500/20' 
                : 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-400 ring-2 ring-purple-500/20'
            }
          `}>
            {week.weekNumber}
            {allTeamsScheduled && !week.isByeWeek && (
              <div className="absolute -top-1 -right-1">
                <CheckCircle className="w-5 h-5 text-emerald-400 drop-shadow-lg" />
              </div>
            )}
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Week {week.weekNumber}
              </span>
              {week.isByeWeek && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
                  BYE WEEK
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <button
                onClick={onEditDate}
                className={`text-sm flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all hover:bg-white/10 group ${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                title="Click to change date"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{dateStr}</span>
                <span className="text-[10px] opacity-0 group-hover:opacity-100 text-purple-400 transition-opacity">✏️</span>
                {week.customDate && (
                  <span className="text-[10px] text-purple-400">(custom)</span>
                )}
              </button>
              {!week.isByeWeek && week.games.length > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  completionPercent === 100 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {completedGames}/{week.games.length} Games Ready
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleBye}
            className={`
              flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-medium transition-all duration-200
              ${week.isByeWeek
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 ring-1 ring-amber-500/30'
                : theme === 'dark'
                  ? 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }
            `}
          >
            {week.isByeWeek ? (
              <>
                <span>🔓</span>
                <span>Remove Bye</span>
              </>
            ) : (
              <>
                <span>💤</span>
                <span>Bye Week</span>
              </>
            )}
          </button>
          {!week.isByeWeek && (
            <button
              onClick={onAddGame}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-medium bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 hover:from-purple-500/30 hover:to-pink-500/30 ring-1 ring-purple-500/20 transition-all duration-200"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Game</span>
            </button>
          )}
        </div>
      </div>

      {/* Week Content */}
      <div className="p-5">
        {week.isByeWeek ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 animate-pulse">😴</div>
            <div className={`text-xl font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              League Bye Week
            </div>
            <div className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
              All teams rest and recharge this week
            </div>
          </div>
        ) : week.games.length === 0 ? (
          <DropZone
            id={`week-${week.weekNumber}-empty`}
            accepts={['team']}
            className={`
              min-h-[160px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300
              ${theme === 'dark' 
                ? 'border-white/10 hover:border-purple-500/40 hover:bg-purple-500/5' 
                : 'border-slate-200 hover:border-purple-400 hover:bg-purple-50'
              }
            `}
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
              theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'
            }`}>
              <Users className={`w-8 h-8 ${theme === 'dark' ? 'text-purple-400/50' : 'text-purple-300'}`} />
            </div>
            <span className={`text-base font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Drop teams to create matchups
            </span>
            <span className={`text-sm ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
              or click "Add Game" to start
            </span>
          </DropZone>
        ) : (
          <div className="grid gap-3 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
            
            {/* Smart drop zone - Drop team here to auto-create new game */}
            <DropZone
              id={`week-${week.weekNumber}-addgame`}
              accepts={['team']}
              className={`
                min-h-[100px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300
                ${theme === 'dark' 
                  ? 'border-white/10 hover:border-purple-500/40 hover:bg-purple-500/5' 
                  : 'border-slate-200 hover:border-purple-400 hover:bg-purple-50'
                }
              `}
            >
              <Plus className={`w-6 h-6 mb-1 ${theme === 'dark' ? 'text-purple-400/50' : 'text-purple-300'}`} />
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Drop team to add game
              </span>
            </DropZone>
          </div>
        )}

        {/* Unscheduled teams indicator - Enhanced */}
        {!week.isByeWeek && unscheduledTeams.length > 0 && (
          <div className={`
            mt-5 p-4 rounded-xl border backdrop-blur-sm
            ${theme === 'dark' 
              ? 'bg-amber-500/5 border-amber-500/20' 
              : 'bg-amber-50 border-amber-200'
            }
          `}>
            <div className="flex items-center gap-2 text-sm text-amber-500 mb-3">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold">Teams need scheduling:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {unscheduledTeams.map(team => (
                <span
                  key={team.id}
                  className={`
                    text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5
                    ${theme === 'dark' 
                      ? 'bg-white/10 text-slate-200 ring-1 ring-white/10' 
                      : 'bg-white text-slate-700 ring-1 ring-slate-200'
                    }
                  `}
                >
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: team.color || '#8b5cf6' }}
                  />
                  {team.name}
                </span>
              ))}
              {unscheduledTeams.length === 1 && teams.length % 2 === 1 && (
                <span className="text-xs text-amber-500 italic ml-2 flex items-center gap-1">
                  <span>💤</span>
                  <span>Bye this week (odd teams)</span>
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
  existingBookings = [],
  existingGames,
  existingWeeksCount,
  seasonStartDate,
  onSave,
  onClose,
}: StudioProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { setIsFullscreenOpen, setHasUnsavedChanges } = useUnsavedChanges();
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [totalWeeks, setTotalWeeks] = useState(existingWeeksCount || 10);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'team' | 'time' | 'venue' | null>(null);
  const [activeData, setActiveData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showPalette, setShowPalette] = useState(true);
  const [showAddVenueModal, setShowAddVenueModal] = useState(false);
  const [showRemoveWeekWarning, setShowRemoveWeekWarning] = useState<number | null>(null);
  const [customVenues, setCustomVenues] = useState<Venue[]>([]);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueLocation, setNewVenueLocation] = useState('');
  const [newVenueAddress, setNewVenueAddress] = useState('');
  const [customTimeSlots, setCustomTimeSlots] = useState<TimeSlot[]>([]);
  const [showAddTimeModal, setShowAddTimeModal] = useState(false);
  const [newTimeHour, setNewTimeHour] = useState('12');
  const [newTimeMinute, setNewTimeMinute] = useState('00');
  const [newTimeAmPm, setNewTimeAmPm] = useState<'AM' | 'PM'>('PM');
  const [hasChanges, setHasChanges] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Date editing state
  const [showEditDateModal, setShowEditDateModal] = useState(false);
  const [editingWeekNumber, setEditingWeekNumber] = useState<number | null>(null);
  const [editingDate, setEditingDate] = useState<string>('');
  
  // Google Places search state for venues (using any types for flexibility)
  const [venueSearchQuery, setVenueSearchQuery] = useState('');
  const [venueSearchResults, setVenueSearchResults] = useState<any[]>([]);
  const [isSearchingVenues, setIsSearchingVenues] = useState(false);
  const autocompleteServiceRef = React.useRef<any>(null);
  const placesServiceRef = React.useRef<any>(null);
  
  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Mark fullscreen as open when component mounts, hide sidebar collapse button
  useEffect(() => {
    setIsFullscreenOpen(true);
    return () => setIsFullscreenOpen(false);
  }, [setIsFullscreenOpen]);
  
  // Track unsaved changes for global navigation blocking
  useEffect(() => {
    setHasUnsavedChanges(hasChanges);
    return () => setHasUnsavedChanges(false);
  }, [hasChanges, setHasUnsavedChanges]);
  
  // Warn before browser refresh/close if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);
  
  // Handle close with unsaved changes check
  const handleClose = useCallback(() => {
    if (hasChanges) {
      setShowExitWarning(true);
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);
  
  // Check if should show onboarding on mount
  useEffect(() => {
    if (user?.uid && shouldShowOnboarding(user.uid)) {
      // Small delay to let the UI render first
      const timer = setTimeout(() => setShowOnboarding(true), 500);
      return () => clearTimeout(timer);
    }
  }, [user?.uid]);

  // Generate time slots (only :00 times - users can add custom times for specific minutes)
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
    }
    // Add custom time slots (for specific times like 1:30, 2:15, etc.)
    return [...slots, ...customTimeSlots];
  }, [customTimeSlots]);

  // Generate venues from team home fields + custom venues (deduplicated)
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
    
    // Deduplicate by venue name (case-insensitive)
    const allVenues = [...teamVenues, ...customVenues];
    const seen = new Set<string>();
    const deduped: Venue[] = [];
    
    for (const venue of allVenues) {
      const key = venue.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(venue);
      }
    }
    
    return deduped;
  }, [teams, customVenues]);

  // Calculate team stats (games and byes per team)
  const teamStats = useMemo(() => {
    const stats: Record<string, { games: number; byes: number }> = {};
    
    // Initialize all teams
    teams.forEach(team => {
      stats[team.id] = { games: 0, byes: 0 };
    });
    
    // Count games and byes per team
    weeks.forEach(week => {
      if (week.isByeWeek) {
        // All teams have a bye this week
        teams.forEach(team => {
          stats[team.id].byes++;
        });
      } else {
        // Count teams scheduled this week
        const scheduledTeams = new Set<string>();
        week.games.forEach(game => {
          if (game.homeTeam) {
            scheduledTeams.add(game.homeTeam.id);
            stats[game.homeTeam.id].games++;
          }
          if (game.awayTeam) {
            scheduledTeams.add(game.awayTeam.id);
            stats[game.awayTeam.id].games++;
          }
        });
        
        // Unscheduled teams have a bye
        teams.forEach(team => {
          if (!scheduledTeams.has(team.id)) {
            stats[team.id].byes++;
          }
        });
      }
    });
    
    return stats;
  }, [weeks, teams]);

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

  // Initialize weeks on first render - use existingGames if available
  useEffect(() => {
    if (weeks.length === 0) {
      const initialWeeks: WeekData[] = [];
      
      // Group existing games by week
      const gamesByWeek: Record<number, any[]> = {};
      if (existingGames && existingGames.length > 0) {
        existingGames.forEach(game => {
          const weekNum = game.weekNumber || 1;
          if (!gamesByWeek[weekNum]) gamesByWeek[weekNum] = [];
          gamesByWeek[weekNum].push(game);
        });
        console.log(`Loading ${existingGames.length} existing games into studio`);
      }
      
      // Determine how many weeks we need
      const maxWeekFromGames = existingGames && existingGames.length > 0 
        ? Math.max(...existingGames.map(g => g.weekNumber || 1), totalWeeks)
        : totalWeeks;
      
      for (let i = 1; i <= maxWeekFromGames; i++) {
        const weekGames = gamesByWeek[i] || [];
        // Convert existing games to proper ScheduledGame format
        const games: ScheduledGame[] = weekGames.map((g, idx) => ({
          id: g.id || `game-${i}-${idx}`,
          homeTeam: g.homeTeam || null,
          awayTeam: g.awayTeam || null,
          time: g.time || null,
          venue: g.venue || null,
          status: (g.homeTeam && g.awayTeam && g.time && g.venue) ? 'complete' : 'incomplete',
          date: g.date,
        }));
        
        // Parse custom date from first game in week if exists
        let customDate: Date | undefined;
        if (weekGames.length > 0 && weekGames[0].date) {
          customDate = new Date(weekGames[0].date);
        }
        
        initialWeeks.push({
          weekNumber: i,
          games: games.length > 0 ? games : [],
          isByeWeek: false,
          customDate,
        });
      }
      setWeeks(initialWeeks);
      setTotalWeeks(maxWeekFromGames);
      
      // If we loaded existing games, mark as no changes initially
      if (existingGames && existingGames.length > 0) {
        // Small delay to let state settle
        setTimeout(() => setHasChanges(false), 100);
      }
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
    setHasChanges(true);
  };

  // Get game date for a week (uses custom date if set, otherwise calculates from season start)
  const getGameDate = useCallback((weekNumber: number, customDate?: Date): Date => {
    // If custom date is provided, use it
    if (customDate) {
      return new Date(customDate);
    }
    // Otherwise calculate from season start date
    const date = new Date(seasonStartDate);
    date.setDate(date.getDate() + ((weekNumber - 1) * 7));
    // Default to Saturday
    while (date.getDay() !== 6) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }, [seasonStartDate]);

  // ============================================================================
  // CONFLICT DETECTION SYSTEM - Prevents double-booking
  // ============================================================================
  
  // Helper to create a unique venue key (uses ONLY venue name for matching)
  // We use just the name because address formats vary between entries
  const getVenueKey = useCallback((venue: Venue): string => {
    // Normalize: lowercase, trim whitespace, remove common suffixes
    return venue.name.toLowerCase().trim();
  }, []);
  
  // Check for venue+time conflicts across all games
  const detectConflicts = useCallback((currentWeeks: WeekData[]): WeekData[] => {
    // Build a map of all bookings: key = "date|time|venueKey" -> game info
    const bookingMap = new Map<string, { gameId: string; weekNumber: number; homeTeam: string; awayTeam: string; ageGroup: string; venueName: string }>();
    
    // Add existing bookings from other age groups
    existingBookings.forEach(booking => {
      const dateStr = booking.date.toDateString();
      // Create normalized venue key for external bookings (just venue name for consistency)
      const venueKey = booking.venueName.toLowerCase().trim();
      const key = `${dateStr}|${booking.time}|${venueKey}`;
      bookingMap.set(key, {
        gameId: 'external',
        weekNumber: -1,
        homeTeam: booking.homeTeam,
        awayTeam: booking.awayTeam,
        ageGroup: booking.ageGroup,
        venueName: booking.venueName,
      });
    });
    
    // First pass: Collect all complete bookings from current schedule
    const currentBookings: { key: string; gameId: string; weekNumber: number; homeTeam: string; awayTeam: string; venueName: string }[] = [];
    
    currentWeeks.forEach(week => {
      if (week.isByeWeek) return;
      
      const weekDate = getGameDate(week.weekNumber, week.customDate);
      const dateStr = weekDate.toDateString();
      
      week.games.forEach(game => {
        if (game.time && game.venue) {
          const venueKey = getVenueKey(game.venue);
          const key = `${dateStr}|${game.time.time}|${venueKey}`;
          currentBookings.push({
            key,
            gameId: game.id,
            weekNumber: week.weekNumber,
            homeTeam: game.homeTeam?.name || 'TBD',
            awayTeam: game.awayTeam?.name || 'TBD',
            venueName: game.venue.location ? `${game.venue.name} @ ${game.venue.location}` : game.venue.name,
          });
        }
      });
    });
    
    // Second pass: Check for conflicts and update game statuses
    return currentWeeks.map(week => {
      if (week.isByeWeek) return week;
      
      const weekDate = getGameDate(week.weekNumber, week.customDate);
      const dateStr = weekDate.toDateString();
      
      return {
        ...week,
        games: week.games.map(game => {
          // Reset conflict status
          let status: 'incomplete' | 'complete' | 'conflict' = 'incomplete';
          let conflictReason: string | undefined;
          
          // Check if game is complete
          const isComplete = game.homeTeam && game.awayTeam && game.time && game.venue;
          
          if (isComplete && game.time && game.venue) {
            status = 'complete';
            const venueKey = getVenueKey(game.venue);
            const key = `${dateStr}|${game.time.time}|${venueKey}`;
            const venueName = game.venue.location ? `${game.venue.name} @ ${game.venue.location}` : game.venue.name;
            
            // Check against external bookings (other age groups)
            const externalBooking = bookingMap.get(key);
            if (externalBooking) {
              status = 'conflict';
              conflictReason = `⚠️ Conflict with ${externalBooking.ageGroup}: ${externalBooking.homeTeam} vs ${externalBooking.awayTeam} at ${venueName}`;
            }
            
            // Check against other games in current schedule
            const conflictingGames = currentBookings.filter(b => 
              b.key === key && b.gameId !== game.id
            );
            
            if (conflictingGames.length > 0) {
              status = 'conflict';
              const conflicting = conflictingGames[0];
              if (conflicting.weekNumber === week.weekNumber) {
                conflictReason = `⚠️ Double-booked! ${conflicting.homeTeam} vs ${conflicting.awayTeam} also at ${venueName} this time`;
              } else {
                conflictReason = `⚠️ Week ${conflicting.weekNumber} already booked: ${conflicting.homeTeam} vs ${conflicting.awayTeam} at ${venueName}`;
              }
            }
          } else if (game.homeTeam || game.awayTeam || game.time || game.venue) {
            status = 'incomplete';
          }
          
          return {
            ...game,
            status,
            conflictReason,
          };
        }),
      };
    });
  }, [existingBookings, getGameDate, getVenueKey]);
  
  // Re-run conflict detection whenever weeks change
  useEffect(() => {
    if (weeks.length > 0) {
      const checkedWeeks = detectConflicts(weeks);
      // Only update if conflicts changed to avoid infinite loop
      const hasConflictChanges = JSON.stringify(checkedWeeks.map(w => w.games.map(g => ({ id: g.id, status: g.status, reason: g.conflictReason })))) !==
        JSON.stringify(weeks.map(w => w.games.map(g => ({ id: g.id, status: g.status, reason: g.conflictReason }))));
      
      if (hasConflictChanges) {
        setWeeks(checkedWeeks);
      }
    }
  }, [weeks, detectConflicts]);

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
    setHasChanges(true);
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
    setHasChanges(true);
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
    setHasChanges(true);
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
    setHasChanges(true);
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
      } else if (overId.startsWith('week-') && (overId.endsWith('-empty') || overId.endsWith('-addgame'))) {
        // Dropped on week area - create new game with this team
        // Format: "week-1-empty", "week-2-addgame", etc.
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
            toastSuccess(`New game created for ${active.data.current?.team?.name}`);
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
    setHasChanges(true);
    toastSuccess(`Generated ${rounds} rounds of games for ${teams.length} teams`);
  };

  // Save schedule with celebration
  const handleSave = async () => {
    setSaving(true);
    try {
      // Flatten games from all weeks
      const allGames = weeks.flatMap(week => 
        week.games.map(game => ({
          ...game,
          weekNumber: week.weekNumber,
          date: getGameDate(week.weekNumber, week.customDate),
        }))
      );
      
      await onSave(allGames, weeks);
      setHasChanges(false); // Clear unsaved changes flag
      
      // 🎉 Trigger celebration!
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
      
      toastSuccess('🎉 Schedule saved successfully!');
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
      toastWarning('Please enter a field name');
      return;
    }
    
    // Create display name: "Field Name @ Location" or just "Field Name"
    const displayName = newVenueLocation.trim() 
      ? `${newVenueName.trim()} @ ${newVenueLocation.trim()}`
      : newVenueName.trim();
    
    const newVenue: Venue = {
      id: `venue-custom-${Date.now()}`,
      name: newVenueName.trim(),
      location: newVenueLocation.trim() || undefined,
      address: newVenueAddress.trim() || undefined,
      isTeamHome: false,
    };
    setCustomVenues(prev => [...prev, newVenue]);
    setNewVenueName('');
    setNewVenueLocation('');
    setNewVenueAddress('');
    setShowAddVenueModal(false);
    toastSuccess(`${displayName} added!`);
  };

  // Add custom time slot
  const handleAddTime = () => {
    let hour24 = parseInt(newTimeHour);
    if (newTimeAmPm === 'PM' && hour24 !== 12) hour24 += 12;
    if (newTimeAmPm === 'AM' && hour24 === 12) hour24 = 0;
    
    const time24 = `${hour24.toString().padStart(2, '0')}:${newTimeMinute}`;
    const label = `${newTimeHour}:${newTimeMinute} ${newTimeAmPm}`;
    
    // Check if already exists
    const exists = timeSlots.some(t => t.time === time24);
    if (exists) {
      toastWarning('This time slot already exists');
      return;
    }
    
    const newSlot: TimeSlot = {
      id: `time-custom-${time24}`,
      time: time24,
      label: label,
    };
    
    setCustomTimeSlots(prev => [...prev, newSlot]);
    setShowAddTimeModal(false);
    toastSuccess(`Added ${label}`);
  };

  // Handle editing week date
  const handleEditDate = (weekNumber: number) => {
    const week = weeks.find(w => w.weekNumber === weekNumber);
    const currentDate = getGameDate(weekNumber, week?.customDate);
    setEditingWeekNumber(weekNumber);
    setEditingDate(currentDate.toISOString().split('T')[0]); // Format as YYYY-MM-DD
    setShowEditDateModal(true);
  };

  const handleSaveDate = () => {
    if (!editingWeekNumber || !editingDate) return;
    
    const newDate = new Date(editingDate);
    setWeeks(prev => prev.map(week => 
      week.weekNumber === editingWeekNumber
        ? { ...week, customDate: newDate }
        : week
    ));
    setHasChanges(true);
    setShowEditDateModal(false);
    setEditingWeekNumber(null);
    toastSuccess(`Week ${editingWeekNumber} date updated!`);
  };

  const handleResetDate = () => {
    if (!editingWeekNumber) return;
    
    setWeeks(prev => prev.map(week => 
      week.weekNumber === editingWeekNumber
        ? { ...week, customDate: undefined }
        : week
    ));
    setHasChanges(true);
    setShowEditDateModal(false);
    setEditingWeekNumber(null);
    toastSuccess('Date reset to default');
  };

  // Initialize Google Places API
  useEffect(() => {
    const win = window as any;
    if (typeof win.google !== 'undefined' && win.google.maps && win.google.maps.places) {
      autocompleteServiceRef.current = new win.google.maps.places.AutocompleteService();
      // Create a dummy div for PlacesService (required but not rendered)
      const dummyDiv = document.createElement('div');
      placesServiceRef.current = new win.google.maps.places.PlacesService(dummyDiv);
    }
  }, []);

  // Search venues using Google Places
  const searchVenues = useCallback((query: string) => {
    const win = window as any;
    if (!query.trim() || !autocompleteServiceRef.current) {
      setVenueSearchResults([]);
      return;
    }

    setIsSearchingVenues(true);
    autocompleteServiceRef.current.getPlacePredictions(
      {
        input: query,
        types: ['establishment', 'park', 'stadium'],
      },
      (predictions: any[], status: string) => {
        setIsSearchingVenues(false);
        if (status === win.google?.maps?.places?.PlacesServiceStatus?.OK && predictions) {
          setVenueSearchResults(predictions);
        } else if (predictions) {
          // Fallback: use predictions if available
          setVenueSearchResults(predictions);
        } else {
          setVenueSearchResults([]);
        }
      }
    );
  }, []);

  // Debounced venue search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchVenues(venueSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [venueSearchQuery, searchVenues]);

  // Select a venue from Google Places results
  const handleSelectVenueFromGoogle = (prediction: any) => {
    const win = window as any;
    if (!placesServiceRef.current) return;

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['name', 'formatted_address', 'address_components'],
      },
      (place: any, status: string) => {
        if ((status === win.google?.maps?.places?.PlacesServiceStatus?.OK || status === 'OK') && place) {
          // Parse the structured address
          const name = place.name || prediction.structured_formatting?.main_text || '';
          const address = place.formatted_address || '';
          
          // Try to extract city/location from address components
          let location = '';
          if (place.address_components) {
            const cityComponent = place.address_components.find(
              (c: any) => c.types.includes('locality') || c.types.includes('sublocality')
            );
            location = cityComponent?.long_name || '';
          }
          
          setNewVenueName(name);
          setNewVenueLocation(location);
          setNewVenueAddress(address);
          setVenueSearchQuery('');
          setVenueSearchResults([]);
          toastSuccess('Venue details loaded from Google!');
        }
      }
    );
  };

  // Calculate stats
  const stats = useMemo(() => {
    let totalGames = 0;
    let completeGames = 0;
    let incompleteGames = 0;
    let conflictGames = 0;
    let byeWeeks = 0;

    weeks.forEach(week => {
      if (week.isByeWeek) {
        byeWeeks++;
      } else {
        week.games.forEach(game => {
          totalGames++;
          if (game.status === 'conflict') {
            conflictGames++;
          } else if (game.status === 'complete') {
            completeGames++;
          } else {
            incompleteGames++;
          }
        });
      }
    });

    return { totalGames, completeGames, incompleteGames, conflictGames, byeWeeks };
  }, [weeks]);

  // Check if portrait mode on mobile
  const [isPortrait, setIsPortrait] = useState(false);
  
  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth < 768;
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(isMobile && portrait);
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Portrait mode warning for mobile
  if (isPortrait) {
    return (
      <div className={`
        fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center
        ${theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'}
      `}>
        <div className="text-6xl mb-6 animate-pulse">📱</div>
        <h2 className={`text-2xl font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          Rotate Your Device
        </h2>
        <p className={`text-lg mb-6 max-w-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
          Schedule Studio works best in <span className="font-bold text-purple-400">landscape mode</span>. 
          Please rotate your phone for the best experience.
        </p>
        <div className="flex items-center gap-2 text-purple-400">
          <div className="w-12 h-8 border-2 border-purple-400 rounded-lg flex items-center justify-center">
            <div className="w-6 h-4 bg-purple-400/30 rounded" />
          </div>
          <span className="text-2xl">→</span>
          <div className="w-16 h-10 border-2 border-purple-400 rounded-lg flex items-center justify-center rotate-90">
            <div className="w-8 h-5 bg-purple-400/30 rounded" />
          </div>
        </div>
        <button
          onClick={handleClose}
          className={`mt-8 px-6 py-3 rounded-xl font-medium transition-colors ${
            theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          ← Go Back
        </button>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={`
        fixed inset-0 z-50 flex flex-col overflow-hidden
        ${theme === 'dark' 
          ? 'bg-gradient-to-br from-zinc-950 via-zinc-900 to-purple-950/30' 
          : 'bg-gradient-to-br from-slate-100 via-slate-50 to-purple-50'}
      `}>
        {/* 🎉 CONFETTI CELEBRATION OVERLAY */}
        {showConfetti && (
          <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
            {/* Multiple confetti particles with different animations */}
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: '-20px',
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                }}
              >
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'][Math.floor(Math.random() * 6)],
                    transform: `rotate(${Math.random() * 360}deg)`,
                  }}
                />
              </div>
            ))}
            {/* Success burst in center */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-scale-in">
              <div className="text-8xl">🎉</div>
            </div>
          </div>
        )}

        {/* Inline styles for confetti and conflict animations */}
        <style>{`
          @keyframes confetti-fall {
            0% {
              transform: translateY(0) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translateY(100vh) rotate(720deg);
              opacity: 0;
            }
          }
          @keyframes scale-in {
            0% {
              transform: translate(-50%, -50%) scale(0);
              opacity: 0;
            }
            50% {
              transform: translate(-50%, -50%) scale(1.2);
              opacity: 1;
            }
            100% {
              transform: translate(-50%, -50%) scale(0);
              opacity: 0;
            }
          }
          @keyframes conflict-pulse {
            0%, 100% {
              box-shadow: 0 0 40px -5px rgba(239, 68, 68, 0.35), inset 0 0 20px -10px rgba(239, 68, 68, 0.2);
            }
            50% {
              box-shadow: 0 0 60px -5px rgba(239, 68, 68, 0.5), inset 0 0 30px -10px rgba(239, 68, 68, 0.3);
            }
          }
          .animate-confetti {
            animation: confetti-fall linear forwards;
          }
          .animate-scale-in {
            animation: scale-in 1.5s ease-out forwards;
          }
        `}</style>

        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* 🏟️ STADIUM-INSPIRED HEADER - Compact on mobile landscape */}
        <div className={`
          relative shrink-0 px-2 py-2 sm:px-4 sm:py-4 overflow-hidden
          ${theme === 'dark' 
            ? 'bg-gradient-to-r from-zinc-900 via-purple-900/20 to-zinc-900 border-b border-purple-500/20' 
            : 'bg-gradient-to-r from-white via-purple-50 to-white border-b border-purple-200'}
        `}>
          {/* Animated glow line at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />
          
          {/* Stadium lights effect - subtle dots */}
          <div className="absolute top-0 left-1/4 w-2 h-2 rounded-full bg-purple-400/30 blur-sm" />
          <div className="absolute top-0 right-1/4 w-2 h-2 rounded-full bg-purple-400/30 blur-sm" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-purple-400/20 blur-md" />
          
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={handleClose}
                className={`p-1.5 sm:p-2.5 rounded-xl transition-all duration-200 shrink-0 ${
                  theme === 'dark' 
                    ? 'bg-white/5 hover:bg-white/10 hover:scale-105' 
                    : 'bg-slate-100 hover:bg-slate-200 hover:scale-105'
                }`}
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-lg sm:text-2xl">🎨</span>
                  <h1 className={`text-base sm:text-2xl font-black tracking-tight truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Schedule Studio
                  </h1>
                  <span className={`
                    hidden sm:inline ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider
                    ${theme === 'dark' 
                      ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-purple-300 border border-purple-500/30' 
                      : 'bg-purple-100 text-purple-700'}
                  `}>
                    Pro
                  </span>
                </div>
                <p className={`hidden sm:block text-sm mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  <span className="font-medium text-purple-400">{ageGroup}</span> • {teams.length} Teams
                </p>
              </div>
            </div>

            {/* 📊 SCOREBOARD-STYLE STATS - Hidden on mobile, show on lg+ */}
            <div className="hidden lg:flex items-center gap-2">
              {/* Total Games */}
              <div className={`
                relative px-3 py-2 rounded-xl overflow-hidden min-w-[72px]
                ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}
              `}>
                <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent" />
                <div className="relative text-center">
                  <div className={`text-2xl font-black tabular-nums ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {stats.totalGames}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Games</div>
                </div>
              </div>
              
              {/* Complete Games - with green glow */}
              <div className={`
                relative px-3 py-2 rounded-xl overflow-hidden group min-w-[72px]
                ${theme === 'dark' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}
              `}>
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 to-transparent" />
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 bg-emerald-400/20 rounded-full blur-lg group-hover:bg-emerald-400/30 transition-colors" />
                <div className="relative text-center">
                  <div className="text-2xl font-black tabular-nums text-emerald-400">
                    {stats.completeGames}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-emerald-500/80 font-medium flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Complete
                  </div>
                </div>
              </div>
              
              {/* Incomplete Games - with amber glow */}
              <div className={`
                relative px-3 py-2 rounded-xl overflow-hidden min-w-[72px]
                ${theme === 'dark' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}
              `}>
                <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent" />
                <div className="relative text-center">
                  <div className="text-2xl font-black tabular-nums text-amber-400">
                    {stats.incompleteGames}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-amber-500/80 font-medium">Incomplete</div>
                </div>
              </div>
              
              {/* Conflict Games - with red glow (only show if conflicts exist) */}
              {stats.conflictGames > 0 && (
                <div className={`
                  relative px-4 py-2 rounded-xl overflow-hidden group animate-pulse
                  ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-300'}
                `}>
                  <div className="absolute inset-0 bg-gradient-to-t from-red-500/15 to-transparent" />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 bg-red-400/30 rounded-full blur-lg group-hover:bg-red-400/40 transition-colors" />
                  <div className="relative text-center">
                    <div className="text-2xl font-black tabular-nums text-red-400">
                      {stats.conflictGames}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-red-400/80 font-medium flex items-center justify-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                      Conflicts
                    </div>
                  </div>
                </div>
              )}
              
              {/* Bye Weeks - with purple glow */}
              <div className={`
                relative px-3 py-2 rounded-xl overflow-hidden min-w-[72px]
                ${theme === 'dark' ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-200'}
              `}>
                <div className="absolute inset-0 bg-gradient-to-t from-purple-500/10 to-transparent" />
                <div className="relative text-center">
                  <div className="text-2xl font-black tabular-nums text-purple-400">
                    {stats.byeWeeks}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-purple-500/80 font-medium">Bye Weeks</div>
                </div>
              </div>

              {/* Progress Ring */}
              <div className={`
                relative px-4 py-2 rounded-xl flex items-center gap-3
                ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}
              `}>
                <div className="relative w-10 h-10">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} strokeWidth="3" />
                    <circle 
                      cx="18" cy="18" r="15" fill="none" 
                      stroke="url(#progressGradient)" 
                      strokeWidth="3" 
                      strokeLinecap="round"
                      strokeDasharray={`${(stats.totalGames > 0 ? (stats.completeGames / stats.totalGames) * 94 : 0)} 94`}
                      className="transition-all duration-500 ease-out"
                    />
                    <defs>
                      <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#d946ef" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {stats.totalGames > 0 ? Math.round((stats.completeGames / stats.totalGames) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium leading-tight">
                  Schedule<br/>Progress
                </div>
              </div>
              
              {/* Cross-Age-Group Conflict Detection Badge */}
              {existingBookings.length > 0 && (
                <div className={`
                  px-3 py-2 rounded-xl text-xs
                  ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}
                `}>
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <span className="font-medium">{existingBookings.length} bookings</span>
                  </div>
                  <div className={`text-[10px] mt-0.5 ${theme === 'dark' ? 'text-blue-400/60' : 'text-blue-600'}`}>
                    from other age groups
                  </div>
                </div>
              )}
            </div>

            {/* Actions - Compact on mobile */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0" data-onboarding="header">
              <button
                onClick={() => setShowOnboarding(true)}
                className={`p-1.5 sm:p-2.5 rounded-xl transition-all duration-200 ${
                  theme === 'dark' 
                    ? 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white hover:scale-105' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:scale-105'
                }`}
                title="Show Tutorial"
              >
                <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={handleAutoFill}
                data-onboarding="autofill"
                className={`
                  relative flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-xl font-semibold transition-all duration-200 overflow-hidden group text-sm sm:text-base
                  ${theme === 'dark'
                    ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-300 border border-purple-500/30 hover:border-purple-500/50 hover:scale-105'
                    : 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border border-purple-200 hover:scale-105'
                  }
                `}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/10 to-purple-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <Wand2 className="w-4 h-4" />
                <span className="relative hidden sm:inline">Auto-Fill</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                data-onboarding="save"
                className="relative flex items-center gap-1 sm:gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 overflow-hidden group text-sm sm:text-base"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="relative hidden sm:inline">Save Schedule</span>
                <span className="relative sm:hidden">Save</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Palette Sidebar - Narrower on landscape mobile */}
          <div 
            data-onboarding="palette"
            className={`
              shrink-0 overflow-y-auto transition-all duration-300 relative
              ${showPalette ? 'w-48 sm:w-56 lg:w-72' : 'w-0 overflow-hidden'}
              ${theme === 'dark' 
                ? 'bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 border-r border-white/10' 
                : 'bg-gradient-to-b from-white to-slate-50 border-r border-slate-200'}
          `}>
            {/* Palette Header */}
            <div className={`
              sticky top-0 z-10 px-4 py-3 backdrop-blur-xl
              ${theme === 'dark' 
                ? 'bg-zinc-900/80 border-b border-white/10' 
                : 'bg-white/80 border-b border-slate-200'}
            `}>
              <h3 className={`text-sm font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
                🎨 Palette
              </h3>
              <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Drag items to schedule
              </p>
            </div>

            {/* Weeks Config - Premium */}
            <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                  <Calendar className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Season Length
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                <button
                  onClick={handleRemoveWeek}
                  disabled={weeks.length <= 1}
                  className={`p-2.5 rounded-lg transition-all ${
                    weeks.length <= 1 
                      ? 'opacity-30 cursor-not-allowed' 
                      : theme === 'dark' 
                        ? 'bg-white/5 hover:bg-white/10 hover:scale-105' 
                        : 'bg-slate-100 hover:bg-slate-200 hover:scale-105'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex-1 text-center">
                  <span className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {weeks.length}
                  </span>
                  <span className={`text-xs block ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>weeks</span>
                </div>
                <button
                  onClick={handleAddWeek}
                  className={`p-2.5 rounded-lg transition-all ${
                    theme === 'dark' 
                      ? 'bg-white/5 hover:bg-white/10 hover:scale-105' 
                      : 'bg-slate-100 hover:bg-slate-200 hover:scale-105'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Teams - Premium */}
            <div data-onboarding="teams" className={`p-4 border-b ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                    <Users className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      Teams
                    </span>
                    <span className="text-xs text-slate-500 ml-1.5">({teams.length})</span>
                  </div>
                </div>
              </div>
                
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {teams.map(team => {
                  const stats = teamStats[team.id] || { games: 0, byes: 0 };
                  return (
                    <DraggableItem
                      key={team.id}
                      id={`team-${team.id}`}
                      type="team"
                      data={{ team }}
                    >
                      <div 
                        className={`
                          relative px-3 py-2.5 rounded-xl cursor-grab transition-all duration-200 overflow-hidden group
                          ${theme === 'dark' 
                            ? 'bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10' 
                            : 'bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200 shadow-sm'
                          }
                        `}
                      >
                        {/* Team color accent bar */}
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-all group-hover:w-1.5"
                          style={{ backgroundColor: team.color || '#8b5cf6' }}
                        />
                        
                        {/* Team name row */}
                        <div className="flex items-center gap-2 pl-2">
                          <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0 opacity-50 group-hover:opacity-100" />
                          {/* Team logo or initial */}
                          {team.logoUrl ? (
                            <img 
                              src={team.logoUrl} 
                              alt={team.name}
                              className="w-8 h-8 rounded-lg object-cover shadow-md"
                              onError={(e) => {
                                // Fallback to initial if logo fails
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md ${team.logoUrl ? 'hidden' : ''}`}
                            style={{ 
                              background: `linear-gradient(135deg, ${team.color || '#8b5cf6'}, ${team.color || '#8b5cf6'}99)`,
                            }}
                          >
                            {team.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium truncate block ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                              {team.name}
                            </span>
                            {/* Stats row - more visible */}
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className={`text-xs font-semibold flex items-center gap-1 ${stats.games > 0 ? 'text-emerald-400' : theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {stats.games}g
                              </span>
                              <span className={`text-xs font-semibold flex items-center gap-1 ${stats.byes > 0 ? 'text-amber-400' : theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {stats.byes}b
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </DraggableItem>
                  );
                })}
              </div>
            </div>

            {/* Time Slots - Premium */}
            <div data-onboarding="times" className={`p-4 border-b ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                    <Clock className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Game Times
                  </span>
                </div>
                <button
                  onClick={() => {
                    setNewTimeHour('12');
                    setNewTimeMinute('00');
                    setNewTimeAmPm('PM');
                    setShowAddTimeModal(true);
                  }}
                  className={`
                    flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all
                    ${theme === 'dark' 
                      ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' 
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}
                  `}
                >
                  <Plus className="w-3 h-3" />
                  Custom
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                {/* Standard time slots (on the hour) */}
                {timeSlots.filter(t => t.time.endsWith(':00') && !t.id.startsWith('time-custom')).map(slot => (
                  <DraggableItem
                    key={slot.id}
                    id={slot.id}
                    type="time"
                    data={{ timeSlot: slot }}
                  >
                    <div className={`
                      text-center px-2 py-2 rounded-lg cursor-grab text-xs font-medium transition-all
                      ${theme === 'dark' 
                        ? 'bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-slate-300 hover:text-white' 
                        : 'bg-white hover:bg-slate-50 border border-slate-100 text-slate-700 shadow-sm'
                      }
                    `}>
                      {slot.label}
                    </div>
                  </DraggableItem>
                ))}
              </div>
              
              {/* Custom time slots */}
              {customTimeSlots.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1.5 text-[10px] text-purple-400 font-medium uppercase tracking-wider mb-2">
                    <span className="w-1 h-1 rounded-full bg-purple-400" />
                    Custom Times
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {customTimeSlots.map(slot => (
                      <DraggableItem
                        key={slot.id}
                        id={slot.id}
                        type="time"
                        data={{ timeSlot: slot }}
                      >
                        <div className={`
                          text-center px-2 py-2 rounded-lg cursor-grab text-xs font-medium transition-all
                          ${theme === 'dark' 
                            ? 'bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300' 
                            : 'bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700'
                          }
                        `}>
                          {slot.label}
                        </div>
                      </DraggableItem>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Venues - Premium */}
            <div data-onboarding="venues" className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                    <MapPin className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Venues
                  </span>
                </div>
                <button
                  onClick={() => setShowAddVenueModal(true)}
                  className={`
                    flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all
                    ${theme === 'dark' 
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' 
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}
                  `}
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {venues.map(venue => (
                  <DraggableItem
                    key={venue.id}
                    id={venue.id}
                    type="venue"
                    data={{ venue }}
                  >
                    <div className={`
                      relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-grab transition-all duration-200 group overflow-hidden
                      ${theme === 'dark' 
                        ? 'bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-amber-500/20' 
                        : 'bg-white hover:bg-slate-50 border border-slate-100 hover:border-amber-300 shadow-sm'
                      }
                    `}>
                      {/* Venue type accent */}
                      <div className={`
                        absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-all group-hover:w-1.5
                        ${venue.isTeamHome ? 'bg-amber-400' : 'bg-slate-500'}
                      `} />
                      
                      <GripVertical className="w-3.5 h-3.5 text-slate-500 opacity-50 group-hover:opacity-100 ml-1" />
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                        ${venue.isTeamHome 
                          ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/20' 
                          : theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'}
                      `}>
                        {venue.isTeamHome ? (
                          <Home className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Building2 className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium truncate block ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                          {venue.name}
                          {venue.location && (
                            <span className={`font-normal ${theme === 'dark' ? 'text-amber-400/80' : 'text-amber-600'}`}>
                              {' '}@ {venue.location}
                            </span>
                          )}
                        </span>
                        {venue.isTeamHome && (
                          <span className="text-[10px] text-amber-400">Home Field</span>
                        )}
                        {!venue.isTeamHome && venue.address && (
                          <span className={`text-[10px] truncate block ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                            {venue.address}
                          </span>
                        )}
                      </div>
                    </div>
                  </DraggableItem>
                ))}
                {venues.length === 0 && (
                  <div className={`text-center py-8 rounded-xl border-2 border-dashed ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                    <MapPin className={`w-8 h-8 mx-auto mb-2 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                    <div className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>No venues yet</div>
                    <div className={`text-xs ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>Click "Add" to create one</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Palette Collapse Toggle Button - Premium Style */}
          <button
            onClick={() => setShowPalette(!showPalette)}
            className={`absolute top-1/2 -translate-y-1/2 z-10 w-6 h-14 flex items-center justify-center rounded-r-xl transition-all duration-300 shadow-lg ${
              theme === 'dark' 
                ? 'bg-gradient-to-r from-zinc-800 to-zinc-700 hover:from-zinc-700 hover:to-zinc-600 text-purple-400 hover:text-purple-300 border border-l-0 border-zinc-600' 
                : 'bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-purple-600 hover:text-purple-500 border border-l-0 border-slate-300'
            }`}
            style={{ left: showPalette ? '288px' : '0px' }}
            title={showPalette ? 'Collapse palette' : 'Expand palette'}
          >
            {showPalette ? '‹' : '›'}
          </button>

          {/* Canvas Area */}
          <div data-onboarding="canvas" className="flex-1 overflow-y-auto p-4 space-y-4">
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
                onEditDate={() => handleEditDate(week.weekNumber)}
                theme={theme}
                getGameDate={getGameDate}
              />
            ))}
          </div>
        </div>

        {/* Drag Overlay - disappears instantly on drop (no animation back to origin) */}
        <DragOverlay dropAnimation={null}>
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

        {/* Add Venue Modal - Enhanced with Field/Location/Address */}
        {showAddVenueModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
            <div className={`
              w-full max-w-md rounded-2xl p-6
              ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}
            `}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Add Venue / Field
                  </h3>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    Search Google or enter manually
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Google Places Search */}
                <div className="relative">
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    <span className="flex items-center gap-1.5">
                      🔍 Search Google Maps
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={venueSearchQuery}
                      onChange={(e) => setVenueSearchQuery(e.target.value)}
                      placeholder="Search for parks, schools, stadiums..."
                      className={`
                        w-full px-4 py-2.5 rounded-lg transition-all pr-10
                        ${theme === 'dark'
                          ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20'
                          : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                        }
                      `}
                    />
                    {isSearchingVenues && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  
                  {/* Search Results Dropdown */}
                  {venueSearchResults.length > 0 && (
                    <div className={`
                      absolute top-full left-0 right-0 mt-1 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto
                      ${theme === 'dark' ? 'bg-zinc-800 border border-white/10' : 'bg-white border border-slate-200'}
                    `}>
                      {venueSearchResults.map((result) => (
                        <button
                          key={result.place_id}
                          onClick={() => handleSelectVenueFromGoogle(result)}
                          className={`
                            w-full px-3 py-2 text-left text-sm transition-colors flex items-start gap-2
                            ${theme === 'dark' 
                              ? 'hover:bg-white/10 text-white' 
                              : 'hover:bg-slate-50 text-slate-900'
                            }
                          `}
                        >
                          <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-medium">{result.structured_formatting?.main_text}</div>
                            <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                              {result.structured_formatting?.secondary_text}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  <div className="flex-1 h-px bg-current opacity-20" />
                  <span className="text-xs">or enter manually</span>
                  <div className="flex-1 h-px bg-current opacity-20" />
                </div>
                
                {/* Field Name - Required */}
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    <span className="flex items-center gap-1.5">
                      🏟️ Field Name <span className="text-red-400">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={newVenueName}
                    onChange={(e) => setNewVenueName(e.target.value)}
                    placeholder="e.g., Field 1, Turf A, Main Field"
                    className={`
                      w-full px-4 py-2.5 rounded-lg transition-all
                      ${theme === 'dark'
                        ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20'
                        : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                      }
                    `}
                  />
                </div>
                
                {/* Location/Complex - Optional but helps with conflict detection */}
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    <span className="flex items-center gap-1.5">
                      📍 Location / Complex
                      <span className={`text-xs font-normal ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        (recommended)
                      </span>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={newVenueLocation}
                    onChange={(e) => setNewVenueLocation(e.target.value)}
                    placeholder="e.g., Commerce Middle School, City Sports Complex"
                    className={`
                      w-full px-4 py-2.5 rounded-lg transition-all
                      ${theme === 'dark'
                        ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20'
                        : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                      }
                    `}
                  />
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Helps identify "Field 1 @ Commerce" vs "Field 1 @ Lincoln Park"
                  </p>
                </div>
                
                {/* Address - Optional */}
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    <span className="flex items-center gap-1.5">
                      🗺️ Address
                      <span className={`text-xs font-normal ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        (optional)
                      </span>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={newVenueAddress}
                    onChange={(e) => setNewVenueAddress(e.target.value)}
                    placeholder="e.g., 123 Main St, Commerce, TX 75428"
                    className={`
                      w-full px-4 py-2.5 rounded-lg transition-all
                      ${theme === 'dark'
                        ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-white/20 focus:ring-2 focus:ring-white/10'
                        : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200'
                      }
                    `}
                  />
                </div>
                
                {/* Preview */}
                {(newVenueName.trim() || newVenueLocation.trim()) && (
                  <div className={`
                    p-3 rounded-lg border border-dashed
                    ${theme === 'dark' ? 'bg-white/5 border-white/20' : 'bg-slate-50 border-slate-300'}
                  `}>
                    <p className={`text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      Preview:
                    </p>
                    <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {newVenueName.trim() || 'Field Name'}
                      {newVenueLocation.trim() && (
                        <span className={theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}>
                          {' '}@ {newVenueLocation.trim()}
                        </span>
                      )}
                    </p>
                  </div>
                )}
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
                  disabled={!newVenueName.trim()}
                  className={`
                    px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2
                    ${newVenueName.trim()
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40'
                      : 'bg-white/5 text-slate-500 cursor-not-allowed'
                    }
                  `}
                >
                  <MapPin className="w-4 h-4" />
                  Add Venue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Time Modal */}
        {showAddTimeModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
            <div className={`
              w-full max-w-sm rounded-2xl p-6
              ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}
            `}>
              <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Add Custom Time
              </h3>
              <div className="flex items-center gap-2 mb-6">
                {/* Hour */}
                <select
                  value={newTimeHour}
                  onChange={(e) => setNewTimeHour(e.target.value)}
                  className={`
                    flex-1 px-3 py-2.5 rounded-lg text-center font-medium
                    ${theme === 'dark'
                      ? 'bg-zinc-800 border border-white/20 text-white'
                      : 'bg-slate-50 border border-slate-200 text-slate-900'
                    }
                  `}
                >
                  {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(h => (
                    <option key={h} value={h} className="bg-zinc-800 text-white">{h}</option>
                  ))}
                </select>
                
                <span className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>:</span>
                
                {/* Minute */}
                <select
                  value={newTimeMinute}
                  onChange={(e) => setNewTimeMinute(e.target.value)}
                  className={`
                    flex-1 px-3 py-2.5 rounded-lg text-center font-medium
                    ${theme === 'dark'
                      ? 'bg-zinc-800 border border-white/20 text-white'
                      : 'bg-slate-50 border border-slate-200 text-slate-900'
                    }
                  `}
                >
                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                    <option key={m} value={m} className="bg-zinc-800 text-white">{m}</option>
                  ))}
                </select>
                
                {/* AM/PM */}
                <select
                  value={newTimeAmPm}
                  onChange={(e) => setNewTimeAmPm(e.target.value as 'AM' | 'PM')}
                  className={`
                    flex-1 px-3 py-2.5 rounded-lg text-center font-medium
                    ${theme === 'dark'
                      ? 'bg-zinc-800 border border-white/20 text-white'
                      : 'bg-slate-50 border border-slate-200 text-slate-900'
                    }
                  `}
                >
                  <option value="AM" className="bg-zinc-800 text-white">AM</option>
                  <option value="PM" className="bg-zinc-800 text-white">PM</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowAddTimeModal(false)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    theme === 'dark'
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTime}
                  className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-purple-600 to-purple-500 text-white"
                >
                  Add Time
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Date Modal */}
        {showEditDateModal && editingWeekNumber && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
            <div className={`
              w-full max-w-sm rounded-2xl p-6
              ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}
            `}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Edit Week {editingWeekNumber} Date
                  </h3>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    Change when this week's games are played
                  </p>
                </div>
              </div>
              
              <div className="mb-6">
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  Game Date
                </label>
                <input
                  type="date"
                  value={editingDate}
                  onChange={(e) => setEditingDate(e.target.value)}
                  className={`
                    w-full px-4 py-3 rounded-xl text-lg font-medium transition-all
                    ${theme === 'dark'
                      ? 'bg-white/5 border border-white/10 text-white focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                    }
                  `}
                />
                <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  Default: {getGameDate(editingWeekNumber).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
              
              <div className="flex justify-between gap-3">
                <button
                  onClick={handleResetDate}
                  className={`px-4 py-2 rounded-lg font-medium text-sm ${
                    theme === 'dark'
                      ? 'text-slate-400 hover:text-white hover:bg-white/5'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Reset to Default
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowEditDateModal(false);
                      setEditingWeekNumber(null);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      theme === 'dark'
                        ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDate}
                    className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-purple-600 to-purple-500 text-white"
                  >
                    Save Date
                  </button>
                </div>
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

        {/* Onboarding Tour */}
        {showOnboarding && (
          <ScheduleStudioOnboarding
            theme={theme}
            onComplete={() => {
              setShowOnboarding(false);
              if (user?.uid) markOnboardingComplete(user.uid);
              toastSuccess('You\'re all set! Start building your schedule 🎨');
            }}
            onSkip={() => {
              setShowOnboarding(false);
              if (user?.uid) markOnboardingComplete(user.uid);
            }}
          />
        )}

        {/* Exit Warning Modal */}
        {showExitWarning && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60">
            <div className={`
              w-full max-w-md rounded-2xl p-6
              ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}
            `}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-amber-500/20">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Unsaved Changes
                </h3>
              </div>
              <p className={`mb-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                You have unsaved changes to your schedule. Are you sure you want to leave? 
                Your changes will be <span className="font-semibold text-amber-400">lost</span>.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowExitWarning(false)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    theme === 'dark'
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Keep Editing
                </button>
                <button
                  onClick={() => {
                    setShowExitWarning(false);
                    setHasChanges(false);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400"
                >
                  Leave Without Saving
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
