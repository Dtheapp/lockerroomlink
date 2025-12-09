// =============================================================================
// GAME TYPES - Season game schedule and playoff management
// =============================================================================

import { Timestamp } from 'firebase/firestore';

// =============================================================================
// GAME STATUS & TYPES
// =============================================================================

export type GameStatus = 
  | 'scheduled'     // Game is on the calendar
  | 'in-progress'   // Game is currently happening
  | 'completed'     // Game finished
  | 'cancelled'     // Game was cancelled
  | 'postponed';    // Game rescheduled

export type GameResult = 'win' | 'loss' | 'tie';

export type PlayoffRound = 
  | 'wild-card'
  | 'quarterfinal' 
  | 'semifinal' 
  | 'championship'
  | 'bowl-game';

export type GameTag = 
  | 'homecoming'
  | 'rivalry'
  | 'senior-night'
  | 'pink-out'
  | 'military-appreciation'
  | 'youth-night'
  | 'alumni-game'
  | 'season-opener'
  | 'season-finale';

// =============================================================================
// MAIN GAME INTERFACE
// =============================================================================

export interface Game {
  id: string;
  seasonId: string;
  teamId: string;
  
  // Basic Info
  gameNumber: number;
  opponent: string;
  opponentLogoUrl?: string;
  
  // When & Where
  date: string;              // ISO date string "2025-12-15"
  time: string;              // 24hr format "14:00"
  location: string;
  address?: string;
  fieldName?: string;        // "Field A", "Main Stadium"
  
  // Game Type
  isHome: boolean;
  isPlayoff: boolean;
  playoffRound?: PlayoffRound;
  
  // Special Tags
  tags: GameTag[];
  notes?: string;            // Internal notes for coaches
  
  // Status & Results
  status: GameStatus;
  ourScore?: number;
  opponentScore?: number;
  result?: GameResult;
  
  // Ticketing Integration
  ticketDesignId?: string;
  ticketsEnabled: boolean;
  ticketPrice?: number;
  ticketUrl?: string;        // Link to purchase tickets
  
  // Stats Integration
  statsEntered: boolean;
  statsId?: string;
  
  // Event Integration (links to events collection for full event features)
  eventId?: string;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// =============================================================================
// SEASON SCHEDULE SUMMARY
// =============================================================================

export interface SeasonScheduleSummary {
  totalGames: number;
  gamesPlayed: number;
  gamesRemaining: number;
  wins: number;
  losses: number;
  ties: number;
  winPercentage: number;
  pointsFor: number;
  pointsAgainst: number;
  currentStreak: {
    type: 'W' | 'L' | 'T';
    count: number;
  };
  nextGame?: Game;
  lastGame?: Game;
  isInPlayoffs: boolean;
  playoffGames: number;
}

// =============================================================================
// OPPONENT (for autocomplete/history)
// =============================================================================

export interface Opponent {
  name: string;
  logoUrl?: string;
  lastPlayed?: string;
  allTimeRecord?: {
    wins: number;
    losses: number;
    ties: number;
  };
}

// =============================================================================
// GAME FORM DATA (for creating/editing)
// =============================================================================

export interface GameFormData {
  opponent: string;
  opponentLogoUrl?: string;
  date: string;
  time: string;
  location: string;
  address?: string;
  isHome: boolean;
  isPlayoff: boolean;
  playoffRound?: PlayoffRound;
  tags: GameTag[];
  notes?: string;
  ticketsEnabled: boolean;
  ticketPrice?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const GAME_TAGS: { id: GameTag; label: string; icon: string }[] = [
  { id: 'homecoming', label: 'Homecoming', icon: '🏠' },
  { id: 'rivalry', label: 'Rivalry Game', icon: '🔥' },
  { id: 'senior-night', label: 'Senior Night', icon: '🎓' },
  { id: 'pink-out', label: 'Pink Out', icon: '💗' },
  { id: 'military-appreciation', label: 'Military Appreciation', icon: '🎖️' },
  { id: 'youth-night', label: 'Youth Night', icon: '👶' },
  { id: 'alumni-game', label: 'Alumni Game', icon: '🎉' },
  { id: 'season-opener', label: 'Season Opener', icon: '🚀' },
  { id: 'season-finale', label: 'Season Finale', icon: '🏁' },
];

export const PLAYOFF_ROUNDS: { id: PlayoffRound; label: string; order: number }[] = [
  { id: 'wild-card', label: 'Wild Card', order: 1 },
  { id: 'quarterfinal', label: 'Quarterfinal', order: 2 },
  { id: 'semifinal', label: 'Semifinal', order: 3 },
  { id: 'championship', label: 'Championship', order: 4 },
  { id: 'bowl-game', label: 'Bowl Game', order: 5 },
];

export const GAME_STATUS_CONFIG: { 
  [key in GameStatus]: { label: string; color: string; bgColor: string } 
} = {
  'scheduled': { label: 'Scheduled', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  'in-progress': { label: 'In Progress', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  'completed': { label: 'Final', color: 'text-slate-400', bgColor: 'bg-slate-500/20' },
  'cancelled': { label: 'Cancelled', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  'postponed': { label: 'Postponed', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
};
