/**
 * CalendarView Component
 * World-class Google Calendar-style schedule view for OSYS
 * 
 * Features:
 * - Month/Week/Day/List view modes
 * - Color-coded events by type (Game=orange, Practice=green, Social=pink, etc.)
 * - Click day to see all events
 * - Quick add for coaches (Practice, Social, Fundraiser - NOT Games)
 * - Games are read-only, pushed by commissioners
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { db } from '../../services/firebase';
import { collection, query, where, orderBy, onSnapshot, Timestamp, getDocs } from 'firebase/firestore';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Calendar,
  Clock,
  MapPin,
  CalendarDays,
  List,
  LayoutGrid,
  Eye,
  Edit2,
  Trash2,
  Lock
} from 'lucide-react';
import { GlassCard, Button, Badge } from '../ui/OSYSComponents';

// Types
type ViewMode = 'month' | 'week' | 'day' | 'list';
type EventType = 'game' | 'practice' | 'social' | 'registration' | 'fundraiser';

interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  description?: string;
  eventStartDate: Timestamp;
  eventEndDate?: Timestamp;
  eventStartTime?: string; // HH:MM format
  eventEndTime?: string;
  location?: { name: string };
  teamId: string;
  status: string;
  // Game-specific
  opponent?: string;
  isHome?: boolean;
  isBye?: boolean;
  programGameId?: string; // If from commissioner schedule
  // Game results
  homeScore?: number;
  awayScore?: number;
  teamScore?: number;
  opponentScore?: number;
  result?: 'win' | 'loss' | 'tie';
  source?: string; // 'commissioner' for locked games
  importance?: 'normal' | 'important' | 'critical'; // Event importance level
}

interface CalendarViewProps {
  teamId: string;
  programId?: string; // Program ID for fetching games from commissioner schedule
  seasonId?: string; // Season ID for fetching games
  onEventClick?: (eventId: string) => void;
  onGameClick?: (game: CalendarEvent) => void; // Separate handler for program games
  onCreateEvent?: (date?: Date) => void;
  onEditEvent?: (eventId: string) => void;
  onDeleteEvent?: (eventId: string) => void;
  isCoach?: boolean;
  sport?: string; // Team sport for sport-specific icons
}

// Sport-specific icons for games
const SPORT_ICONS: Record<string, string> = {
  football: '🏈',
  basketball: '🏀',
  soccer: '⚽',
  baseball: '⚾',
  softball: '🥎',
  volleyball: '🏐',
  hockey: '🏒',
  lacrosse: '🥍',
  tennis: '🎾',
  swimming: '🏊',
  track: '🏃',
  default: '🏆',
};

// Event type colors - high contrast text for visibility
const EVENT_COLORS: Record<EventType, { bg: string; text: string; dot: string; glow: string; icon: string; label: string }> = {
  game: { bg: 'bg-orange-500', text: 'text-white', dot: 'bg-orange-500', glow: 'ring-2 ring-orange-400 ring-offset-1', icon: '🏆', label: 'Game Day' },
  practice: { bg: 'bg-emerald-600', text: 'text-white', dot: 'bg-emerald-500', glow: 'ring-2 ring-emerald-400 ring-offset-1', icon: '💪', label: 'Practice' },
  social: { bg: 'bg-pink-500', text: 'text-white', dot: 'bg-pink-500', glow: 'ring-2 ring-pink-400 ring-offset-1', icon: '🎉', label: 'Team Event' },
  registration: { bg: 'bg-purple-600', text: 'text-white', dot: 'bg-purple-500', glow: 'ring-2 ring-purple-400 ring-offset-1', icon: '📝', label: 'Registration' },
  fundraiser: { bg: 'bg-amber-500', text: 'text-white', dot: 'bg-amber-500', glow: 'ring-2 ring-amber-400 ring-offset-1', icon: '💰', label: 'Fundraiser' },
};

// Importance glow effects for day cells
const IMPORTANCE_STYLES = {
  normal: '',
  important: 'ring-2 ring-amber-400/50 ring-inset',
  critical: 'ring-2 ring-red-500 ring-inset animate-pulse',
};

// Helper: Format time string (HH:MM) to 12-hour
const formatTime12Hour = (time24: string | undefined): string => {
  if (!time24) return '';
  
  // Handle various formats
  const trimmed = time24.trim();
  
  // If it's already in 12-hour format (contains AM/PM), return as-is
  if (/[AaPp][Mm]/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  
  // Handle HH:MM format
  const parts = trimmed.split(':');
  const hours = parseInt(parts[0] || '', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  
  if (isNaN(hours)) return '';
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  if (minutes === 0 || isNaN(minutes)) return `${hour12}${period}`;
  return `${hour12}:${String(minutes).padStart(2, '0')}${period}`;
};

// Helper: Parse time string to get hour and minute (handles multiple formats)
const parseTimeString = (timeStr: string | undefined): { hour: number; minute: number } => {
  if (!timeStr) return { hour: 9, minute: 0 }; // Default 9 AM
  
  const trimmed = timeStr.trim().toLowerCase();
  
  // Check for 12-hour format with AM/PM (e.g., "8pm", "8:30pm", "8:30 PM")
  const ampmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = parseInt(ampmMatch[2] || '0', 10);
    const isPM = ampmMatch[3].toLowerCase() === 'pm';
    
    // Convert to 24-hour
    if (isPM && hour !== 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
    
    return { hour, minute: isNaN(minute) ? 0 : minute };
  }
  
  // Handle 24-hour HH:MM format (e.g., "20:00", "14:30")
  const parts = trimmed.split(':');
  const hour = parseInt(parts[0] || '9', 10);
  const minute = parseInt(parts[1] || '0', 10);
  
  return { 
    hour: isNaN(hour) ? 9 : hour, 
    minute: isNaN(minute) ? 0 : minute 
  };
};

// Helper: Get days in month
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

// Helper: Get first day of month (0 = Sunday)
const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay();
};

// Helper: Check if two dates are the same day
const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

// Helper: Get date from Timestamp
const getDateFromTimestamp = (ts: any): Date => {
  if (!ts) return new Date();
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts);
};

// Helper: Check if event is in the past
const isEventPast = (event: CalendarEvent): boolean => {
  const eventDate = getDateFromTimestamp(event.eventStartDate);
  const now = new Date();
  
  // If event has a time, check if that specific time has passed
  if (event.eventStartTime) {
    const [hours, minutes] = event.eventStartTime.split(':').map(Number);
    eventDate.setHours(hours, minutes, 0, 0);
  } else {
    // No time specified, consider end of day
    eventDate.setHours(23, 59, 59, 999);
  }
  
  return eventDate < now;
};

// Helper: Get game result display string
// Only show scores if game has started (status is 'live' or 'completed')
const getGameResultDisplay = (event: CalendarEvent): { text: string; color: string; bgColor: string } | null => {
  // Don't show scores for scheduled games that haven't started
  if (event.status === 'scheduled' || !event.status) {
    return null;
  }
  
  // Check if we have scores
  const teamScore = event.teamScore ?? event.homeScore;
  const oppScore = event.opponentScore ?? event.awayScore;
  
  if (teamScore === undefined || oppScore === undefined) return null;
  
  // Determine result
  let result = event.result;
  if (!result) {
    if (teamScore > oppScore) result = 'win';
    else if (teamScore < oppScore) result = 'loss';
    else result = 'tie';
  }
  
  // Colors that work on solid backgrounds (for pills) and as badges
  const colors = {
    win: { color: 'text-white', bgColor: 'bg-emerald-600' },
    loss: { color: 'text-white', bgColor: 'bg-red-600' },
    tie: { color: 'text-white', bgColor: 'bg-yellow-600' }
  };
  
  const prefix = result === 'win' ? 'W' : result === 'loss' ? 'L' : 'T';
  return { text: `${prefix} ${teamScore}-${oppScore}`, ...colors[result] };
};

// Helper: Calculate event duration in hours
const getEventDurationHours = (event: CalendarEvent): number => {
  if (!event.eventStartTime || !event.eventEndTime) return 1; // Default 1 hour
  
  const [startH, startM] = event.eventStartTime.split(':').map(Number);
  const [endH, endM] = event.eventEndTime.split(':').map(Number);
  
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  return Math.max(1, (endMinutes - startMinutes) / 60);
};

const CalendarView: React.FC<CalendarViewProps> = ({
  teamId,
  programId,
  seasonId,
  onEventClick,
  onGameClick,
  onCreateEvent,
  onEditEvent,
  onDeleteEvent,
  isCoach = false,
  sport = 'football'
}) => {
  const { theme } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showDayPanel, setShowDayPanel] = useState(false);
  
  // State for showing game details modal (for program games)
  const [selectedGame, setSelectedGame] = useState<CalendarEvent | null>(null);

  // Get sport-specific game icon
  const gameIcon = SPORT_ICONS[sport?.toLowerCase()] || SPORT_ICONS.default;

  // State for program games (from commissioner schedule)
  const [programGames, setProgramGames] = useState<CalendarEvent[]>([]);
  
  // State for team games (from teams/{teamId}/games - includes league-managed games)
  const [teamGames, setTeamGames] = useState<CalendarEvent[]>([]);
  
  // Handle event/game click - route to appropriate handler
  const handleEventClick = (event: CalendarEvent) => {
    // If it's a program game (from commissioner schedule), show modal instead of navigating
    if (event.source === 'commissioner' || event.programGameId) {
      if (onGameClick) {
        onGameClick(event);
      } else {
        // Default: show inline game modal
        setSelectedGame(event);
      }
    } else {
      // Regular event - use the event click handler
      onEventClick?.(event.id);
    }
  };

  // Subscribe to team events (practices, fundraisers, etc.)
  useEffect(() => {
    if (!teamId) return;

    // Events are stored in top-level 'events' collection with teamId field
    const eventsRef = collection(db, 'events');
    const q = query(
      eventsRef,
      where('teamId', '==', teamId),
      orderBy('eventStartDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs
        .filter(doc => {
          // Exclude game-type events - games come from program collection
          const data = doc.data();
          const type = (data.type || data.eventType || '').toLowerCase();
          return type !== 'game';
        })
        .map(doc => {
          const data = doc.data();
        
          // Extract time from eventStartDate Timestamp if no separate time field
          let eventStartTime = data.eventStartTime || data.time || data.startTime || '';
          let eventEndTime = data.eventEndTime || data.endTime || '';
        
          // If no separate time field, extract from Timestamp
          if (!eventStartTime && data.eventStartDate) {
            const startDate = data.eventStartDate.toDate ? data.eventStartDate.toDate() : new Date(data.eventStartDate);
            const hours = startDate.getHours();
            const minutes = startDate.getMinutes();
            // Only set time if it's not midnight (0:00 likely means no time was set)
            if (hours !== 0 || minutes !== 0) {
              eventStartTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
          }
        
          if (!eventEndTime && data.eventEndDate) {
            const endDate = data.eventEndDate.toDate ? data.eventEndDate.toDate() : new Date(data.eventEndDate);
            const hours = endDate.getHours();
            const minutes = endDate.getMinutes();
            if (hours !== 0 || minutes !== 0) {
              eventEndTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
          }
        
          return {
            id: doc.id,
            ...data,
            eventStartTime,
            eventEndTime,
          };
        }) as CalendarEvent[];
      setEvents(eventsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching team events:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamId]);

  // Fetch games from program schedule (single source of truth)
  // Note: We find the active season from the program if seasonId is not provided
  useEffect(() => {
    if (!programId || !teamId) {
      console.log('[CalendarView] Missing programId or teamId:', { programId, teamId });
      setProgramGames([]);
      return;
    }

    const fetchProgramGames = async () => {
      try {
        // If no seasonId provided, fetch seasons and find the active one
        let activeSeasonId = seasonId;
        
        if (!activeSeasonId) {
          console.log('[CalendarView] No seasonId provided, fetching seasons from program:', programId);
          const seasonsRef = collection(db, 'programs', programId, 'seasons');
          const seasonsSnap = await getDocs(seasonsRef);
          
          // Find active season (same logic as Dashboard)
          const seasons = seasonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const activeSeason = seasons.find((s: any) => s.status === 'active') ||
                               seasons.find((s: any) => s.status !== 'completed') ||
                               seasons[0];
          
          if (!activeSeason) {
            console.log('[CalendarView] No active season found in program');
            setProgramGames([]);
            return;
          }
          
          activeSeasonId = activeSeason.id;
          console.log('[CalendarView] Found active season:', activeSeasonId);
        }
        
        console.log('[CalendarView] Fetching games from:', `programs/${programId}/seasons/${activeSeasonId}/games`);
        const gamesRef = collection(db, 'programs', programId, 'seasons', activeSeasonId, 'games');
        const gamesSnap = await getDocs(gamesRef);
        
        console.log('[CalendarView] Found', gamesSnap.docs.length, 'total games in collection');
        
        const games: CalendarEvent[] = [];
        gamesSnap.docs.forEach(doc => {
          const data = doc.data();
          
          // Only include games where this team is playing (home or away)
          const isHome = data.homeTeamId === teamId;
          const isAway = data.awayTeamId === teamId;
          if (!isHome && !isAway) return;
          
          // Parse game date - handle various formats
          // Field is 'weekDate' (from commissioner schedule), fallback to 'date'
          let eventStartDate: Timestamp | null = null;
          const dateValue = data.weekDate || data.date;
          
          if (dateValue) {
            if (dateValue.toDate) {
              // It's already a Timestamp
              eventStartDate = dateValue;
            } else if (typeof dateValue === 'string') {
              // Parse YYYY-MM-DD format
              const [year, month, day] = dateValue.split('-').map(Number);
              if (year && month && day) {
                const dateObj = new Date(year, month - 1, day);
                eventStartDate = Timestamp.fromDate(dateObj);
              }
            } else if (dateValue instanceof Date) {
              eventStartDate = Timestamp.fromDate(dateValue);
            }
          }
          
          if (!eventStartDate) {
            console.log('[CalendarView] Skipping game without valid date:', doc.id, data);
            return; // Skip if no valid date
          }
          
          // Determine opponent name
          const opponent = isHome ? data.awayTeamName : data.homeTeamName;
          
          games.push({
            id: doc.id,
            type: 'game' as EventType,
            title: data.isBye ? 'BYE WEEK' : `vs ${opponent || 'TBD'}`,
            eventStartDate,
            eventStartTime: data.time || '',
            location: data.location ? { name: data.location } : undefined,
            teamId,
            status: data.status || 'scheduled',
            opponent,
            isHome,
            isBye: data.isBye || false,
            homeScore: data.homeScore,
            awayScore: data.awayScore,
            teamScore: isHome ? data.homeScore : data.awayScore,
            opponentScore: isHome ? data.awayScore : data.homeScore,
            source: 'commissioner',
            programGameId: doc.id,
          });
        });
        
        console.log('[CalendarView] Loaded', games.length, 'games for team', teamId);
        setProgramGames(games);
      } catch (error) {
        console.error('Error fetching program games:', error);
        setProgramGames([]);
      }
    };

    fetchProgramGames();
  }, [programId, seasonId, teamId]);

  // Fetch games from teams/{teamId}/games (includes league-managed games)
  useEffect(() => {
    if (!teamId) {
      setTeamGames([]);
      return;
    }

    const gamesRef = collection(db, 'teams', teamId, 'games');
    const q = query(gamesRef, orderBy('date', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const games: CalendarEvent[] = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Parse date - games have 'date' as YYYY-MM-DD string
        let eventStartDate: Timestamp | null = null;
        if (data.date) {
          if (typeof data.date === 'string') {
            // Parse YYYY-MM-DD and combine with time
            const [year, month, day] = data.date.split('-').map(Number);
            if (year && month && day) {
              // Also parse time if available
              let hours = 0, minutes = 0;
              if (data.time) {
                const timeParts = data.time.split(':');
                hours = parseInt(timeParts[0]) || 0;
                minutes = parseInt(timeParts[1]) || 0;
              }
              const dateObj = new Date(year, month - 1, day, hours, minutes);
              eventStartDate = Timestamp.fromDate(dateObj);
            }
          } else if (data.date.toDate) {
            eventStartDate = data.date;
          }
        }

        if (!eventStartDate) {
          console.log('[CalendarView] Skipping team game without valid date:', doc.id);
          return;
        }

        // Determine opponent and if home/away
        const opponent = data.opponent || 'TBD';
        const isHome = data.isHome !== false; // Default to true

        games.push({
          id: doc.id,
          type: 'game' as EventType,
          title: `vs ${opponent}`,
          eventStartDate,
          eventStartTime: data.time || '',
          location: data.location ? { name: data.location } : undefined,
          teamId,
          status: data.status || 'scheduled',
          opponent,
          isHome,
          isBye: false,
          source: data.leagueManaged ? 'league' : 'team',
          // Score data
          teamScore: data.ourScore,
          opponentScore: data.opponentScore,
          homeScore: isHome ? data.ourScore : data.opponentScore,
          awayScore: isHome ? data.opponentScore : data.ourScore,
          result: data.result,
        });
      });

      console.log('[CalendarView] Loaded', games.length, 'team games from teams/{teamId}/games');
      setTeamGames(games);
    }, (error) => {
      console.error('Error fetching team games:', error);
      setTeamGames([]);
    });

    return () => unsubscribe();
  }, [teamId]);

  // Combine events, program games, and team games
  // Deduplicate by checking for matching opponents on same date
  const allEvents = useMemo(() => {
    // Start with events (practices, etc.)
    const combined = [...events];
    
    // Add program games
    combined.push(...programGames);
    
    // Add team games, but skip duplicates (if a game appears in both program and team collections)
    teamGames.forEach(tg => {
      // Check if this game already exists in programGames (same date, same opponent)
      const isDuplicate = programGames.some(pg => {
        const tgDate = getDateFromTimestamp(tg.eventStartDate);
        const pgDate = getDateFromTimestamp(pg.eventStartDate);
        return isSameDay(tgDate, pgDate) && 
               (tg.opponent?.toLowerCase() === pg.opponent?.toLowerCase() ||
                tg.title?.toLowerCase() === pg.title?.toLowerCase());
      });
      
      if (!isDuplicate) {
        combined.push(tg);
      }
    });
    
    return combined.sort((a, b) => {
      const dateA = getDateFromTimestamp(a.eventStartDate);
      const dateB = getDateFromTimestamp(b.eventStartDate);
      return dateA.getTime() - dateB.getTime();
    });
  }, [events, programGames, teamGames]);

  // Navigation - view-mode aware
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    switch (viewMode) {
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
      case 'list':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    switch (viewMode) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'list':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get display title based on view mode
  const getDisplayTitle = (): string => {
    switch (viewMode) {
      case 'day':
        return currentDate.toLocaleDateString('en-US', { 
          weekday: 'long',
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
      case 'week': {
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        // Same month
        if (weekStart.getMonth() === weekEnd.getMonth()) {
          return `${weekStart.toLocaleDateString('en-US', { month: 'long' })} ${weekStart.getDate()}-${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
        }
        // Different months
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
      case 'month':
      case 'list':
      default:
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  // Get calendar data for current month view
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date();

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      events: CalendarEvent[];
    }> = [];

    // Previous month days
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(prevYear, prevMonth, daysInPrevMonth - i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: isSameDay(date, today),
        events: allEvents.filter(e => isSameDay(getDateFromTimestamp(e.eventStartDate), date))
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: isSameDay(date, today),
        events: allEvents.filter(e => isSameDay(getDateFromTimestamp(e.eventStartDate), date))
      });
    }

    // Next month days (fill to 42 days for 6 rows)
    const remainingDays = 42 - days.length;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(nextYear, nextMonth, day);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: isSameDay(date, today),
        events: allEvents.filter(e => isSameDay(getDateFromTimestamp(e.eventStartDate), date))
      });
    }

    return days;
  }, [currentDate, allEvents]);

  // Get events for selected day
  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return allEvents.filter(e => isSameDay(getDateFromTimestamp(e.eventStartDate), selectedDay))
      .sort((a, b) => {
        const timeA = a.eventStartTime || '00:00';
        const timeB = b.eventStartTime || '00:00';
        return timeA.localeCompare(timeB);
      });
  }, [selectedDay, allEvents]);

  // Handle day click
  const handleDayClick = (date: Date) => {
    setSelectedDay(date);
    setShowDayPanel(true);
  };

  // Close day panel
  const closeDayPanel = () => {
    setShowDayPanel(false);
    setSelectedDay(null);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Display title for header
  const displayTitle = getDisplayTitle();

  // Detect landscape orientation on mobile
  const [isLandscape, setIsLandscape] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const mobile = window.innerWidth < 768; // sm breakpoint
      const landscape = window.innerWidth > window.innerHeight;
      setIsMobile(mobile);
      setIsLandscape(mobile && landscape);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Show rotate message on mobile landscape (only for month/week views)
  if (isLandscape && (viewMode === 'month' || viewMode === 'week')) {
    return (
      <div className={`h-full flex flex-col items-center justify-center p-8 text-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50'
      }`}>
        <div className="text-6xl mb-6 animate-bounce">📱</div>
        <h2 className={`text-xl font-bold mb-3 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          Please Rotate Your Phone
        </h2>
        <p className={`text-base mb-6 ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Calendar is best viewed in portrait mode
        </p>
        <div className={`w-16 h-24 border-4 rounded-xl flex items-center justify-center ${
          theme === 'dark' ? 'border-purple-400' : 'border-purple-500'
        }`}>
          <div className={`text-2xl ${theme === 'dark' ? 'text-purple-400' : 'text-purple-500'}`}>
            ↻
          </div>
        </div>
        <p className={`text-sm mt-6 ${
          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
        }`}>
          Or switch to List view for landscape
        </p>
        <button
          onClick={() => setViewMode('list')}
          className="mt-4 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
        >
          Switch to List View
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 p-3 sm:p-4 rounded-xl ${
        theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'
      }`}>
        {/* Left: Navigation */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={goToPrevious}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
            }`}
            title={viewMode === 'day' ? 'Previous day' : viewMode === 'week' ? 'Previous week' : 'Previous month'}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToNext}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
            }`}
            title={viewMode === 'day' ? 'Next day' : viewMode === 'week' ? 'Next week' : 'Next month'}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <h2 className={`text-base sm:text-xl font-bold ml-1 sm:ml-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {displayTitle}
          </h2>
          <button
            onClick={goToToday}
            className={`ml-2 sm:ml-4 px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'bg-white/10 hover:bg-white/20 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            Today
          </button>
        </div>

        {/* Right: View Mode Toggle + Add Event */}
        <div className="flex items-center gap-2 justify-between sm:justify-end">
          {/* View Mode Toggle */}
          <div className={`flex rounded-lg overflow-hidden ${
            theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
          }`}>
            {[
              { mode: 'month' as ViewMode, icon: LayoutGrid, label: 'Month' },
              { mode: 'week' as ViewMode, icon: CalendarDays, label: 'Week' },
              { mode: 'day' as ViewMode, icon: Calendar, label: 'Day' },
              { mode: 'list' as ViewMode, icon: List, label: 'List' },
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  viewMode === mode
                    ? theme === 'dark'
                      ? 'bg-purple-500 text-white'
                      : 'bg-purple-600 text-white'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                }`}
                title={label}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Add Event Button (Coaches only) */}
          {isCoach && onCreateEvent && (
            <Button
              variant="primary"
              onClick={() => onCreateEvent()}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Event</span>
            </Button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      {viewMode === 'month' && (
        <div className={`flex-1 rounded-xl overflow-hidden ${
          theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'
        }`}>
          {/* Week day headers */}
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
            {weekDays.map(day => (
              <div
                key={day}
                className={`py-3 text-center text-sm font-medium ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days grid */}
          <div className="grid grid-cols-7 grid-rows-6 h-[calc(100%-48px)]">
            {calendarDays.map((day, index) => {
              // Check if day has a game (games are IMPORTANT)
              const hasGame = day.events.some(e => e.type === 'game');
              // Get highest importance level for the day
              const highestImportance = day.events.reduce((max, event) => {
                if (event.type === 'game') return 'critical'; // Games are always critical
                if (event.importance === 'critical') return 'critical';
                if (event.importance === 'important' && max !== 'critical') return 'important';
                return max;
              }, 'normal' as 'normal' | 'important' | 'critical');
              
              const importanceStyle = IMPORTANCE_STYLES[highestImportance] || '';
              
              return (
                <div
                  key={index}
                  onClick={() => handleDayClick(day.date)}
                  className={`
                    border-b border-r border-gray-200 dark:border-gray-700 
                    p-0.5 sm:p-1 min-h-[50px] sm:min-h-[100px] cursor-pointer transition-all overflow-hidden
                    ${!day.isCurrentMonth ? (theme === 'dark' ? 'bg-white/[0.02]' : 'bg-gray-50') : ''}
                    ${day.isToday ? (theme === 'dark' ? 'bg-purple-500/10' : 'bg-purple-50') : ''}
                    ${hasGame && day.isCurrentMonth ? (theme === 'dark' ? 'bg-orange-500/10' : 'bg-orange-50') : ''}
                    ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}
                    ${importanceStyle}
                  `}
                >
                  {/* Day number - Only TODAY gets the filled circle indicator */}
                  <div className={`
                    text-[10px] sm:text-sm font-medium mb-0.5 sm:mb-1 
                    ${!day.isCurrentMonth ? (theme === 'dark' ? 'text-gray-600' : 'text-gray-400') : ''}
                    ${day.isToday 
                      ? 'w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-purple-500 text-white flex items-center justify-center text-[9px] sm:text-sm' 
                      : theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }
                  `}>
                    {day.date.getDate()}
                  </div>

                  {/* Event indicators */}
                  <div className="overflow-hidden">
                    {/* Mobile: Just show colored dots for events */}
                    <div className="flex flex-wrap gap-0.5 sm:hidden">
                      {day.events.slice(0, 4).map(event => {
                        const colors = EVENT_COLORS[event.type] || EVENT_COLORS.practice;
                        return (
                          <div
                            key={event.id}
                            className={`w-2 h-2 rounded-full ${colors.dot}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(event);
                            }}
                          />
                        );
                      })}
                      {day.events.length > 4 && (
                        <span className={`text-[8px] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                          +{day.events.length - 4}
                        </span>
                      )}
                    </div>
                  
                  {/* Desktop: Show full pills with more info */}
                  <div className="hidden sm:block space-y-0.5">
                    {day.events.slice(0, 3).map(event => {
                      const colors = EVENT_COLORS[event.type] || EVENT_COLORS.practice;
                      const gameResult = event.type === 'game' ? getGameResultDisplay(event) : null;
                      const isPast = isEventPast(event);
                      
                      // Get icon for this event type
                      const icon = event.type === 'game' ? gameIcon : colors.icon;
                      
                      return (
                        <div
                          key={event.id}
                          className={`
                            text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1
                            ${colors.bg} ${colors.text}
                            ${isPast ? 'opacity-80' : ''}
                          `}
                          title={`${event.title}${event.eventStartTime ? ` @ ${formatTime12Hour(event.eventStartTime)}` : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEventClick(event);
                          }}
                        >
                          {/* Icon */}
                          <span className="flex-shrink-0">{icon}</span>
                          
                          {/* Time (always show first) */}
                          {event.eventStartTime && (
                            <span className="font-bold flex-shrink-0">
                              {formatTime12Hour(event.eventStartTime)}
                            </span>
                          )}
                          
                          {/* Title/Details */}
                          {event.type === 'game' && gameResult ? (
                            <span className={`font-bold px-1 rounded flex-shrink-0 ${gameResult.bgColor} ${gameResult.color}`}>
                              {gameResult.text}
                            </span>
                          ) : event.type === 'game' ? (
                            <span className="truncate">
                              {event.isBye ? 'BYE' : `vs ${event.opponent || 'TBD'}`}
                            </span>
                          ) : (
                            <span className="truncate opacity-90">{event.title}</span>
                          )}
                        </div>
                      );
                    })}
                    {day.events.length > 3 && (
                      <div className={`text-xs px-1.5 ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        +{day.events.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <WeekView 
          currentDate={currentDate} 
          events={allEvents} 
          theme={theme}
          onEventClick={handleEventClick}
          onDayClick={handleDayClick}
          gameIcon={gameIcon}
        />
      )}

      {/* Day View */}
      {viewMode === 'day' && (
        <DayView 
          currentDate={currentDate} 
          events={allEvents} 
          theme={theme}
          onEventClick={handleEventClick}
          isCoach={isCoach}
          onCreateEvent={onCreateEvent}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
        />
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <ListView 
          events={allEvents} 
          theme={theme}
          onEventClick={handleEventClick}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
          isCoach={isCoach}
        />
      )}

      {/* Day Panel Slide-out */}
      {showDayPanel && selectedDay && (
        <DayPanel
          date={selectedDay}
          events={selectedDayEvents}
          theme={theme}
          onClose={closeDayPanel}
          onEventClick={handleEventClick}
          isCoach={isCoach}
          onCreateEvent={onCreateEvent}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
        />
      )}

      {/* Legend */}
      <div className={`mt-4 p-3 rounded-xl ${
        theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'
      }`}>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            Legend:
          </span>
          {Object.entries(EVENT_COLORS)
            .filter(([type]) => type !== 'registration') // Hide registration from legend
            .map(([type, config]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="text-base">{type === 'game' ? gameIcon : config.icon}</span>
              <div className={`w-3 h-3 rounded-full ${config.dot}`} />
              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                {config.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile FAB - Quick Add for coaches */}
      {isCoach && onCreateEvent && (
        <button
          onClick={() => onCreateEvent()}
          className="sm:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/30 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Game Details Modal - For program games (view-only) */}
      {selectedGame && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedGame(null)}
        >
          <div 
            className={`w-full max-w-md rounded-2xl p-6 ${
              theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white border border-slate-200 shadow-xl'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{gameIcon}</span>
                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                  Game Details
                </h3>
              </div>
              <button 
                onClick={() => setSelectedGame(null)}
                className={`p-1 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Game Badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 rounded-lg bg-orange-500 text-white text-xs font-bold">GAME</span>
              {selectedGame.status === 'completed' && (
                <span className="px-2 py-1 rounded-lg bg-slate-500 text-white text-xs font-bold">PAST</span>
              )}
              {selectedGame.status === 'live' && (
                <span className="px-2 py-1 rounded-lg bg-red-500 text-white text-xs font-bold animate-pulse">LIVE</span>
              )}
              {getGameResultDisplay(selectedGame) && (
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getGameResultDisplay(selectedGame)?.bgColor} ${getGameResultDisplay(selectedGame)?.color}`}>
                  {getGameResultDisplay(selectedGame)?.text}
                </span>
              )}
            </div>
            
            {/* Title */}
            <h4 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
              {selectedGame.isBye ? 'BYE WEEK' : `${selectedGame.isHome ? 'vs' : '@'} ${selectedGame.opponent || 'TBD'}`}
            </h4>
            
            {/* Details */}
            <div className="space-y-3">
              {/* Date */}
              <div className="flex items-center gap-3">
                <Calendar className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                <span className={theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}>
                  {getDateFromTimestamp(selectedGame.eventStartDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
              
              {/* Time */}
              {selectedGame.eventStartTime && (
                <div className="flex items-center gap-3">
                  <Clock className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                  <span className={theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}>
                    {formatTime12Hour(selectedGame.eventStartTime)}
                  </span>
                </div>
              )}
              
              {/* Location */}
              {selectedGame.location && (
                <div className="flex items-center gap-3">
                  <MapPin className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                  <span className={theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}>
                    {typeof selectedGame.location === 'object' ? selectedGame.location.name : selectedGame.location}
                  </span>
                </div>
              )}
            </div>
            
            {/* Info Note */}
            <div className={`mt-6 p-3 rounded-lg flex items-start gap-2 ${
              theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'
            }`}>
              <Lock className={`w-4 h-4 mt-0.5 flex-shrink-0 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                This game is managed by your program commissioner and cannot be edited.
              </p>
            </div>
            
            {/* Close Button */}
            <button
              onClick={() => setSelectedGame(null)}
              className={`w-full mt-4 py-2.5 rounded-lg font-medium transition ${
                theme === 'dark' 
                  ? 'bg-white/10 text-white hover:bg-white/20' 
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// WEEK VIEW COMPONENT
// ============================================================================
interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  theme: string;
  onEventClick?: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
  gameIcon: string;
}

const WeekView: React.FC<WeekViewProps> = ({ currentDate, events, theme, onEventClick, onDayClick, gameIcon }) => {
  // Get week days starting from Sunday
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay());

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM to 11 PM
  const today = new Date();

  // Get events for each day with position info and handle overlaps
  const getEventsForDay = (date: Date) => {
    const dayEvents = events
      .filter(e => isSameDay(getDateFromTimestamp(e.eventStartDate), date))
      .map(event => {
        const { hour: startHour, minute: startMinute } = parseTimeString(event.eventStartTime);
        const duration = getEventDurationHours(event);
        
        return {
          ...event,
          startHour,
          startMinute,
          duration,
          topOffset: (startHour - 6) * 60 + startMinute, // Minutes from 6 AM
          height: duration * 60 // Height in minutes (1 hour = 60px)
        };
      })
      .sort((a, b) => a.topOffset - b.topOffset);

    // Assign columns for overlapping events
    const columns: number[] = [];
    return dayEvents.map((event, idx) => {
      // Find first available column
      let column = 0;
      for (let c = 0; c < columns.length; c++) {
        if (columns[c] <= event.topOffset) {
          column = c;
          break;
        }
        column = c + 1;
      }
      columns[column] = event.topOffset + event.height;
      
      return {
        ...event,
        column,
        totalColumns: Math.max(columns.length, 1)
      };
    });
  };

  return (
    <div className={`flex-1 rounded-xl overflow-hidden ${
      theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'
    }`}>
      {/* Day headers */}
      <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700">
        <div className="w-16" /> {/* Time column spacer */}
        {weekDays.map((date, i) => (
          <div
            key={i}
            onClick={() => onDayClick(date)}
            className={`py-3 text-center border-l border-gray-200 dark:border-gray-700 cursor-pointer ${
              theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-50'
            }`}
          >
            <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              {date.toLocaleDateString('en-US', { weekday: 'short' })}
            </div>
            <div className={`text-lg font-bold ${
              isSameDay(date, today) 
                ? 'w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center mx-auto'
                : theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {date.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid with positioned events */}
      <div className="overflow-y-auto h-[calc(100%-80px)]">
        <div className="grid grid-cols-8 relative">
          {/* Time labels column */}
          <div className="w-16">
            {hours.map(hour => (
              <div
                key={hour}
                className={`h-[60px] text-xs text-right pr-2 py-1 border-b border-gray-200 dark:border-gray-700 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {hour % 12 || 12}{hour >= 12 ? 'PM' : 'AM'}
              </div>
            ))}
          </div>

          {/* Day columns with positioned events */}
          {weekDays.map((date, dayIndex) => {
            const dayEvents = getEventsForDay(date);
            // Calculate max columns for this day
            const maxCols = dayEvents.reduce((max, e) => Math.max(max, (e.totalColumns || 1)), 1);
            
            return (
              <div
                key={dayIndex}
                className="relative border-l border-gray-200 dark:border-gray-700"
              >
                {/* Hour grid lines */}
                {hours.map(hour => (
                  <div
                    key={hour}
                    className={`h-[60px] border-b border-gray-200 dark:border-gray-700 ${
                      theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                    }`}
                  />
                ))}

                {/* Positioned events with column-based layout for overlaps */}
                {dayEvents.map(event => {
                  const colors = EVENT_COLORS[event.type] || EVENT_COLORS.practice;
                  const gameResult = event.type === 'game' ? getGameResultDisplay(event) : null;
                  const isPast = isEventPast(event);
                  const heightPx = Math.max(event.height, 40); // Minimum 40px for readability
                  const topPx = event.topOffset;
                  
                  // Column positioning for overlapping events
                  const col = event.column || 0;
                  const totalCols = maxCols;
                  const widthPercent = 100 / totalCols;
                  const leftPercent = col * widthPercent;
                  
                  // Get icon for event type
                  const icon = event.type === 'game' ? gameIcon : EVENT_COLORS[event.type]?.icon || '📅';

                  return (
                    <div
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className={`
                        absolute rounded px-1 py-0.5 cursor-pointer
                        overflow-hidden text-xs shadow-sm
                        ${colors.bg} ${colors.text}
                        ${isPast ? 'opacity-80' : ''}
                        hover:ring-2 hover:ring-purple-400 hover:z-10
                      `}
                      style={{
                        top: `${topPx}px`,
                        height: `${heightPx}px`,
                        left: `${leftPercent}%`,
                        width: `calc(${widthPercent}% - 4px)`,
                        marginLeft: '2px',
                        minHeight: '40px'
                      }}
                    >
                      {/* Time with icon */}
                      <div className="font-medium truncate flex items-center gap-1">
                        <span>{icon}</span>
                        <span>{formatTime12Hour(event.eventStartTime)}</span>
                      </div>
                      
                      {/* Event content */}
                      <div className="truncate">
                        {event.type === 'game' && gameResult ? (
                          <span className={`font-bold px-1 rounded ${gameResult.bgColor} ${gameResult.color}`}>
                            {gameResult.text}
                          </span>
                        ) : event.type === 'game' ? (
                          <span className="font-medium">vs {event.opponent || 'TBD'}</span>
                        ) : (
                          event.title
                        )}
                      </div>
                      
                      {/* Show more details if tall enough */}
                      {heightPx > 60 && event.location?.name && (
                        <div className="text-[10px] opacity-75 truncate">
                          📍 {event.location.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// DAY VIEW COMPONENT
// ============================================================================
interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  theme: string;
  onEventClick?: (event: CalendarEvent) => void;
  isCoach: boolean;
  onCreateEvent?: (date?: Date) => void;
  onEditEvent?: (eventId: string) => void;
  onDeleteEvent?: (eventId: string) => void;
}

const DayView: React.FC<DayViewProps> = ({ currentDate, events, theme, onEventClick, isCoach, onCreateEvent, onEditEvent, onDeleteEvent }) => {
  const dayEvents = events
    .filter(e => isSameDay(getDateFromTimestamp(e.eventStartDate), currentDate))
    .sort((a, b) => (a.eventStartTime || '00:00').localeCompare(b.eventStartTime || '00:00'));

  const dateString = currentDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  return (
    <div className={`flex-1 rounded-xl overflow-hidden ${
      theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'
    }`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {dateString}
        </h3>
        {isCoach && onCreateEvent && (
          <Button variant="ghost" onClick={() => onCreateEvent(currentDate)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Event
          </Button>
        )}
      </div>

      <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-60px)]">
        {dayEvents.length === 0 ? (
          <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            No events scheduled for this day
          </div>
        ) : (
          dayEvents.map(event => (
            <EventCard 
              key={event.id} 
              event={event} 
              theme={theme} 
              onClick={() => onEventClick?.(event)}
              isCoach={isCoach}
              onEdit={() => onEditEvent?.(event.id)}
              onDelete={() => onDeleteEvent?.(event.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================================
// LIST VIEW COMPONENT
// ============================================================================
interface ListViewProps {
  events: CalendarEvent[];
  theme: string;
  onEventClick?: (event: CalendarEvent) => void;
  onEditEvent?: (eventId: string) => void;
  onDeleteEvent?: (eventId: string) => void;
  isCoach: boolean;
}

const ListView: React.FC<ListViewProps> = ({ events, theme, onEventClick, onEditEvent, onDeleteEvent, isCoach }) => {
  // Sort by date and filter to upcoming events
  const now = new Date();
  const upcomingEvents = events
    .filter(e => getDateFromTimestamp(e.eventStartDate) >= now)
    .sort((a, b) => 
      getDateFromTimestamp(a.eventStartDate).getTime() - getDateFromTimestamp(b.eventStartDate).getTime()
    );

  // Group by date
  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: CalendarEvent[] } = {};
    upcomingEvents.forEach(event => {
      const date = getDateFromTimestamp(event.eventStartDate);
      const key = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return groups;
  }, [upcomingEvents]);

  return (
    <div className={`flex-1 rounded-xl overflow-hidden ${
      theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'
    }`}>
      <div className="p-4 overflow-y-auto h-full">
        {Object.entries(groupedEvents).length === 0 ? (
          <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            No upcoming events
          </div>
        ) : (
          Object.entries(groupedEvents).map(([dateLabel, dayEvents]) => (
            <div key={dateLabel} className="mb-6">
              <h3 className={`text-sm font-semibold mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {dateLabel}
              </h3>
              <div className="space-y-2">
                {dayEvents.map(event => {
                  const colors = EVENT_COLORS[event.type] || EVENT_COLORS.practice;
                  const isGame = event.type === 'game';
                  const canEdit = isCoach && !isGame;
                  const timeDisplay = event.eventStartTime ? formatTime12Hour(event.eventStartTime) : '';
                  const endTimeDisplay = event.eventEndTime ? formatTime12Hour(event.eventEndTime) : '';
                  
                  return (
                    <div
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className="p-4 rounded-lg cursor-pointer transition-colors"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#ffffff',
                        border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d1d5db',
                        boxShadow: theme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-16 rounded-full flex-shrink-0 ${colors.dot}`} />
                        <div className="flex-1 min-w-0">
                          {/* Title */}
                          <div 
                            className="text-lg truncate"
                            style={{ 
                              color: theme === 'dark' ? '#ffffff' : '#000000',
                              fontWeight: 700
                            }}
                          >
                            {isGame ? (
                              event.isBye ? 'BYE Week' : `@ ${event.opponent || 'TBD'}`
                            ) : (
                              event.title || 'Untitled Event'
                            )}
                          </div>
                          {/* Time and Location */}
                          <div 
                            className="text-sm flex items-center gap-2 mt-1"
                            style={{ 
                              color: theme === 'dark' ? '#a1a1aa' : '#000000',
                              fontWeight: 600
                            }}
                          >
                            {timeDisplay && (
                              <span style={{ 
                                color: theme === 'dark' ? '#d4d4d8' : '#000000',
                                fontWeight: 700
                              }}>
                                {timeDisplay}{endTimeDisplay && ` - ${endTimeDisplay}`}
                              </span>
                            )}
                            {timeDisplay && event.location?.name && (
                              <span style={{ color: theme === 'dark' ? '#71717a' : '#6b7280' }}>•</span>
                            )}
                            {event.location?.name && (
                              <span style={{ 
                                color: theme === 'dark' ? '#a1a1aa' : '#374151',
                                fontWeight: 500
                              }}>
                                {event.location.name}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Event Type Badge - with proper contrast */}
                        <span 
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.25rem 0.75rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            borderRadius: '9999px',
                            backgroundColor: isGame 
                              ? '#f97316' // orange for games
                              : event.type === 'practice' 
                                ? '#10b981' // green for practice
                                : event.type === 'social'
                                  ? '#ec4899' // pink for social
                                  : '#8b5cf6', // purple default
                            color: '#ffffff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                          }}
                        >
                          {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                        </span>
                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditEvent?.(event.id);
                              }}
                              className={`p-1.5 rounded transition-colors ${
                                theme === 'dark' 
                                  ? 'hover:bg-white/10 text-gray-400 hover:text-purple-400' 
                                  : 'hover:bg-gray-200 text-gray-500 hover:text-purple-600'
                              }`}
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteEvent?.(event.id);
                              }}
                              className={`p-1.5 rounded transition-colors ${
                                theme === 'dark' 
                                  ? 'hover:bg-white/10 text-gray-400 hover:text-red-400' 
                                  : 'hover:bg-gray-200 text-gray-500 hover:text-red-600'
                              }`}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================================
// DAY PANEL SLIDE-OUT COMPONENT
// ============================================================================
interface DayPanelProps {
  date: Date;
  events: CalendarEvent[];
  theme: string;
  onClose: () => void;
  onEventClick?: (event: CalendarEvent) => void;
  isCoach: boolean;
  onCreateEvent?: (date?: Date) => void;
  onEditEvent?: (eventId: string) => void;
  onDeleteEvent?: (eventId: string) => void;
}

const DayPanel: React.FC<DayPanelProps> = ({ 
  date, 
  events, 
  theme, 
  onClose, 
  onEventClick,
  isCoach,
  onCreateEvent,
  onEditEvent,
  onDeleteEvent
}) => {
  const dateString = date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  // Check if the selected day is in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDate = new Date(date);
  selectedDate.setHours(0, 0, 0, 0);
  const isDayPast = selectedDate < today;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className={`
        fixed right-0 top-0 h-full w-full max-w-md z-50
        shadow-2xl transform transition-transform duration-300
        ${theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}
      `}>
        {/* Header */}
        <div className={`p-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {dateString}
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Add Event Button - Only show if not in the past */}
        {isCoach && onCreateEvent && !isDayPast && (
          <div className={`p-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' 
                  : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
              }`}
              onClick={() => {
                onClose();
                onCreateEvent(date);
              }}
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Event</span>
            </button>
          </div>
        )}

        {/* Events List */}
        <div className="p-4 overflow-y-auto h-[calc(100%-140px)]">
          {events.length === 0 ? (
            <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              No events on this day
            </div>
          ) : (
            <div className="space-y-3">
              {events.map(event => (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  theme={theme} 
                  onClick={() => {
                    onClose();
                    onEventClick?.(event);
                  }}
                  isCoach={isCoach}
                  onEdit={() => {
                    onClose();
                    onEditEvent?.(event.id);
                  }}
                  onDelete={() => {
                    onClose();
                    onDeleteEvent?.(event.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ============================================================================
// EVENT CARD COMPONENT
// ============================================================================
interface EventCardProps {
  event: CalendarEvent;
  theme: string;
  onClick: () => void;
  isCoach: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, theme, onClick, isCoach, onEdit, onDelete }) => {
  const colors = EVENT_COLORS[event.type] || EVENT_COLORS.practice;
  const isGame = event.type === 'game';
  const isPast = isEventPast(event);
  const gameResult = isGame ? getGameResultDisplay(event) : null;
  const canEdit = isCoach && !isGame; // Coaches can edit non-game events

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl cursor-pointer transition-all ${
        theme === 'dark' 
          ? 'bg-white/5 hover:bg-white/10 border border-white/10' 
          : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
      } ${isPast ? 'opacity-80' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Color bar */}
        <div className={`w-1 h-full min-h-[60px] rounded-full ${colors.dot}`} />
        
        <div className="flex-1 min-w-0">
          {/* Type badge + Game lock indicator + Past badge */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
              {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
            </span>
            {isGame && event.source === 'commissioner' && (
              <span title="Managed by commissioner">
                <Lock className="w-3 h-3 text-gray-400" />
              </span>
            )}
            {isPast && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
              }`}>
                Past
              </span>
            )}
            {/* Game Result Badge */}
            {gameResult && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${gameResult.bgColor} ${gameResult.color}`}>
                {gameResult.text}
              </span>
            )}
          </div>

          {/* Title - For games, show opponent */}
          <h4 className={`font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {isGame ? (
              event.isBye ? '🏖️ BYE Week' : `🏈 vs ${event.opponent || 'TBD'}`
            ) : (
              event.title || 'Untitled Event'
            )}
          </h4>

          {/* Time - Always show prominently */}
          <div className={`flex items-center gap-2 text-sm font-medium mb-1 ${
            theme === 'dark' ? 'text-purple-300' : 'text-purple-600'
          }`}>
            <Clock className="w-4 h-4" />
            {event.eventStartTime ? (
              <span>
                {formatTime12Hour(event.eventStartTime)}
                {event.eventEndTime && ` - ${formatTime12Hour(event.eventEndTime)}`}
              </span>
            ) : (
              <span className="italic opacity-60">No time set</span>
            )}
          </div>

          {/* Location */}
          {event.location?.name && (
            <div className={`flex items-center gap-2 text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <MapPin className="w-4 h-4" />
              <span>{event.location.name}</span>
            </div>
          )}
        </div>

        {/* Action buttons for coaches (non-game events only) */}
        {canEdit ? (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'hover:bg-white/10 text-gray-400 hover:text-purple-400' 
                  : 'hover:bg-gray-200 text-gray-500 hover:text-purple-600'
              }`}
              title="Edit event"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'hover:bg-white/10 text-gray-400 hover:text-red-400' 
                  : 'hover:bg-gray-200 text-gray-500 hover:text-red-600'
              }`}
              title="Delete event"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Eye className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
        )}
      </div>
    </div>
  );
};

export default CalendarView;
