/**
 * Sport Configuration
 * 
 * Multi-sport support for OSYS platform.
 * Each sport has its own positions, stats, and feature flags.
 */

import type { SportType } from '../types';

// =============================================================================
// POSITION DEFINITIONS
// =============================================================================

export interface PositionConfig {
  value: string;
  label: string;
  category?: string; // For grouping positions (e.g., 'Offense', 'Defense')
}

// Football Positions
export const FOOTBALL_POSITIONS: PositionConfig[] = [
  // Offense
  { value: 'QB', label: 'Quarterback', category: 'Offense' },
  { value: 'RB', label: 'Running Back', category: 'Offense' },
  { value: 'FB', label: 'Fullback', category: 'Offense' },
  { value: 'WR', label: 'Wide Receiver', category: 'Offense' },
  { value: 'TE', label: 'Tight End', category: 'Offense' },
  { value: 'OL', label: 'Offensive Line', category: 'Offense' },
  { value: 'C', label: 'Center', category: 'Offense' },
  { value: 'OG', label: 'Offensive Guard', category: 'Offense' },
  { value: 'OT', label: 'Offensive Tackle', category: 'Offense' },
  // Defense
  { value: 'DL', label: 'Defensive Line', category: 'Defense' },
  { value: 'DE', label: 'Defensive End', category: 'Defense' },
  { value: 'DT', label: 'Defensive Tackle', category: 'Defense' },
  { value: 'LB', label: 'Linebacker', category: 'Defense' },
  { value: 'MLB', label: 'Middle Linebacker', category: 'Defense' },
  { value: 'OLB', label: 'Outside Linebacker', category: 'Defense' },
  { value: 'DB', label: 'Defensive Back', category: 'Defense' },
  { value: 'CB', label: 'Cornerback', category: 'Defense' },
  { value: 'S', label: 'Safety', category: 'Defense' },
  { value: 'FS', label: 'Free Safety', category: 'Defense' },
  { value: 'SS', label: 'Strong Safety', category: 'Defense' },
  // Special Teams
  { value: 'K', label: 'Kicker', category: 'Special Teams' },
  { value: 'P', label: 'Punter', category: 'Special Teams' },
  { value: 'LS', label: 'Long Snapper', category: 'Special Teams' },
  { value: 'KR', label: 'Kick Returner', category: 'Special Teams' },
  { value: 'PR', label: 'Punt Returner', category: 'Special Teams' },
];

// Basketball Positions
export const BASKETBALL_POSITIONS: PositionConfig[] = [
  { value: 'PG', label: 'Point Guard' },
  { value: 'SG', label: 'Shooting Guard' },
  { value: 'SF', label: 'Small Forward' },
  { value: 'PF', label: 'Power Forward' },
  { value: 'C', label: 'Center' },
  { value: 'G', label: 'Guard' },
  { value: 'F', label: 'Forward' },
];

// Cheer Positions
export const CHEER_POSITIONS: PositionConfig[] = [
  { value: 'FLYER', label: 'Flyer' },
  { value: 'BASE', label: 'Base' },
  { value: 'BACK_SPOT', label: 'Back Spot' },
  { value: 'FRONT_SPOT', label: 'Front Spot' },
  { value: 'TUMBLER', label: 'Tumbler' },
  { value: 'JUMPER', label: 'Jumper' },
  { value: 'CAPTAIN', label: 'Captain' },
  { value: 'CO_CAPTAIN', label: 'Co-Captain' },
  { value: 'MASCOT', label: 'Mascot' },
];

// Soccer Positions
export const SOCCER_POSITIONS: PositionConfig[] = [
  { value: 'GK', label: 'Goalkeeper' },
  { value: 'CB', label: 'Center Back' },
  { value: 'LB', label: 'Left Back' },
  { value: 'RB', label: 'Right Back' },
  { value: 'CDM', label: 'Defensive Midfielder' },
  { value: 'CM', label: 'Central Midfielder' },
  { value: 'CAM', label: 'Attacking Midfielder' },
  { value: 'LM', label: 'Left Midfielder' },
  { value: 'RM', label: 'Right Midfielder' },
  { value: 'LW', label: 'Left Wing' },
  { value: 'RW', label: 'Right Wing' },
  { value: 'ST', label: 'Striker' },
  { value: 'CF', label: 'Center Forward' },
];

// Baseball Positions
export const BASEBALL_POSITIONS: PositionConfig[] = [
  { value: 'P', label: 'Pitcher' },
  { value: 'C', label: 'Catcher' },
  { value: '1B', label: 'First Base' },
  { value: '2B', label: 'Second Base' },
  { value: '3B', label: 'Third Base' },
  { value: 'SS', label: 'Shortstop' },
  { value: 'LF', label: 'Left Field' },
  { value: 'CF', label: 'Center Field' },
  { value: 'RF', label: 'Right Field' },
  { value: 'DH', label: 'Designated Hitter' },
  { value: 'UTIL', label: 'Utility' },
];

// Volleyball Positions
export const VOLLEYBALL_POSITIONS: PositionConfig[] = [
  { value: 'S', label: 'Setter' },
  { value: 'OH', label: 'Outside Hitter' },
  { value: 'OPP', label: 'Opposite' },
  { value: 'MB', label: 'Middle Blocker' },
  { value: 'L', label: 'Libero' },
  { value: 'DS', label: 'Defensive Specialist' },
];

// =============================================================================
// STAT DEFINITIONS
// =============================================================================

export interface StatConfig {
  key: string;
  label: string;
  shortLabel: string;
  type: 'number' | 'percentage' | 'time' | 'text';
  category?: string;
}

// Football Stats
export const FOOTBALL_STATS: StatConfig[] = [
  // General
  { key: 'gamesPlayed', label: 'Games Played', shortLabel: 'GP', type: 'number' },
  // Offense
  { key: 'td', label: 'Touchdowns', shortLabel: 'TD', type: 'number', category: 'Offense' },
  { key: 'passYards', label: 'Passing Yards', shortLabel: 'PASS', type: 'number', category: 'Offense' },
  { key: 'rushYards', label: 'Rushing Yards', shortLabel: 'RUSH', type: 'number', category: 'Offense' },
  { key: 'recYards', label: 'Receiving Yards', shortLabel: 'REC', type: 'number', category: 'Offense' },
  { key: 'completions', label: 'Completions', shortLabel: 'CMP', type: 'number', category: 'Offense' },
  { key: 'attempts', label: 'Attempts', shortLabel: 'ATT', type: 'number', category: 'Offense' },
  { key: 'int', label: 'Interceptions Thrown', shortLabel: 'INT', type: 'number', category: 'Offense' },
  // Defense
  { key: 'tkl', label: 'Tackles', shortLabel: 'TKL', type: 'number', category: 'Defense' },
  { key: 'sacks', label: 'Sacks', shortLabel: 'SCK', type: 'number', category: 'Defense' },
  { key: 'intDef', label: 'Interceptions', shortLabel: 'INT', type: 'number', category: 'Defense' },
  { key: 'ff', label: 'Forced Fumbles', shortLabel: 'FF', type: 'number', category: 'Defense' },
  { key: 'fr', label: 'Fumble Recoveries', shortLabel: 'FR', type: 'number', category: 'Defense' },
];

// Basketball Stats
export const BASKETBALL_STATS: StatConfig[] = [
  { key: 'gamesPlayed', label: 'Games Played', shortLabel: 'GP', type: 'number' },
  { key: 'points', label: 'Points', shortLabel: 'PTS', type: 'number' },
  { key: 'rebounds', label: 'Rebounds', shortLabel: 'REB', type: 'number' },
  { key: 'assists', label: 'Assists', shortLabel: 'AST', type: 'number' },
  { key: 'steals', label: 'Steals', shortLabel: 'STL', type: 'number' },
  { key: 'blocks', label: 'Blocks', shortLabel: 'BLK', type: 'number' },
  { key: 'turnovers', label: 'Turnovers', shortLabel: 'TO', type: 'number' },
  { key: 'fgm', label: 'Field Goals Made', shortLabel: 'FGM', type: 'number' },
  { key: 'fga', label: 'Field Goals Attempted', shortLabel: 'FGA', type: 'number' },
  { key: 'fgPct', label: 'FG%', shortLabel: 'FG%', type: 'percentage' },
  { key: 'threePm', label: '3-Pointers Made', shortLabel: '3PM', type: 'number' },
  { key: 'threePa', label: '3-Pointers Attempted', shortLabel: '3PA', type: 'number' },
  { key: 'ftm', label: 'Free Throws Made', shortLabel: 'FTM', type: 'number' },
  { key: 'fta', label: 'Free Throws Attempted', shortLabel: 'FTA', type: 'number' },
  { key: 'minutesPlayed', label: 'Minutes Played', shortLabel: 'MIN', type: 'number' },
];

// Cheer Stats (Competition-based)
export const CHEER_STATS: StatConfig[] = [
  { key: 'competitionsAttended', label: 'Competitions', shortLabel: 'COMP', type: 'number' },
  { key: 'firstPlace', label: '1st Place', shortLabel: '1ST', type: 'number' },
  { key: 'secondPlace', label: '2nd Place', shortLabel: '2ND', type: 'number' },
  { key: 'thirdPlace', label: '3rd Place', shortLabel: '3RD', type: 'number' },
  { key: 'grandChampion', label: 'Grand Champion', shortLabel: 'GC', type: 'number' },
  { key: 'highScore', label: 'Highest Score', shortLabel: 'HIGH', type: 'number' },
  { key: 'avgScore', label: 'Average Score', shortLabel: 'AVG', type: 'number' },
  // Skills
  { key: 'skillsTumbling', label: 'Tumbling Level', shortLabel: 'TUM', type: 'number' },
  { key: 'skillsStunts', label: 'Stunts Level', shortLabel: 'STNT', type: 'number' },
  { key: 'skillsJumps', label: 'Jumps Level', shortLabel: 'JMP', type: 'number' },
  { key: 'skillsDance', label: 'Dance Level', shortLabel: 'DNC', type: 'number' },
];

// Soccer Stats
export const SOCCER_STATS: StatConfig[] = [
  { key: 'gamesPlayed', label: 'Games Played', shortLabel: 'GP', type: 'number' },
  { key: 'goals', label: 'Goals', shortLabel: 'G', type: 'number' },
  { key: 'assists', label: 'Assists', shortLabel: 'A', type: 'number' },
  { key: 'shots', label: 'Shots', shortLabel: 'SH', type: 'number' },
  { key: 'shotsOnGoal', label: 'Shots on Goal', shortLabel: 'SOG', type: 'number' },
  { key: 'saves', label: 'Saves', shortLabel: 'SV', type: 'number' },
  { key: 'cleanSheets', label: 'Clean Sheets', shortLabel: 'CS', type: 'number' },
  { key: 'yellowCards', label: 'Yellow Cards', shortLabel: 'YC', type: 'number' },
  { key: 'redCards', label: 'Red Cards', shortLabel: 'RC', type: 'number' },
  { key: 'minutesPlayed', label: 'Minutes Played', shortLabel: 'MIN', type: 'number' },
];

// Baseball Stats
export const BASEBALL_STATS: StatConfig[] = [
  { key: 'gamesPlayed', label: 'Games Played', shortLabel: 'GP', type: 'number' },
  // Batting
  { key: 'atBats', label: 'At Bats', shortLabel: 'AB', type: 'number', category: 'Batting' },
  { key: 'hits', label: 'Hits', shortLabel: 'H', type: 'number', category: 'Batting' },
  { key: 'runs', label: 'Runs', shortLabel: 'R', type: 'number', category: 'Batting' },
  { key: 'rbi', label: 'RBI', shortLabel: 'RBI', type: 'number', category: 'Batting' },
  { key: 'hr', label: 'Home Runs', shortLabel: 'HR', type: 'number', category: 'Batting' },
  { key: 'doubles', label: 'Doubles', shortLabel: '2B', type: 'number', category: 'Batting' },
  { key: 'triples', label: 'Triples', shortLabel: '3B', type: 'number', category: 'Batting' },
  { key: 'sb', label: 'Stolen Bases', shortLabel: 'SB', type: 'number', category: 'Batting' },
  { key: 'avg', label: 'Batting Avg', shortLabel: 'AVG', type: 'percentage', category: 'Batting' },
  // Pitching
  { key: 'wins', label: 'Wins', shortLabel: 'W', type: 'number', category: 'Pitching' },
  { key: 'losses', label: 'Losses', shortLabel: 'L', type: 'number', category: 'Pitching' },
  { key: 'era', label: 'ERA', shortLabel: 'ERA', type: 'number', category: 'Pitching' },
  { key: 'strikeouts', label: 'Strikeouts', shortLabel: 'K', type: 'number', category: 'Pitching' },
  { key: 'walks', label: 'Walks', shortLabel: 'BB', type: 'number', category: 'Pitching' },
  { key: 'inningsPitched', label: 'Innings Pitched', shortLabel: 'IP', type: 'number', category: 'Pitching' },
];

// =============================================================================
// SPORT CONFIGURATION
// =============================================================================

export interface SportConfig {
  id: SportType;
  name: string;
  emoji: string;
  color: string; // Primary color for UI theming
  positions: PositionConfig[];
  stats: StatConfig[];
  features: {
    playbook: boolean; // Has playbook/formation designer
    statsTracking: boolean; // Has detailed stats
    livestream: boolean; // Supports game livestreaming
    videoLibrary: boolean; // Has video library
    fundraising: boolean; // Has fundraising
    events: boolean; // Has events/schedule
    messaging: boolean; // Has team messaging
    roster: boolean; // Has roster management
  };
  labels: {
    game: string; // What to call a game (game, match, competition, meet)
    practice: string; // What to call practice
    season: string; // What to call the season
    play: string; // What to call a play (play, set, routine)
    playbook: string; // What to call the playbook
  };
}

export const SPORT_CONFIGS: Record<SportType, SportConfig> = {
  football: {
    id: 'football',
    name: 'Football',
    emoji: '🏈',
    color: '#f97316', // Orange
    positions: FOOTBALL_POSITIONS,
    stats: FOOTBALL_STATS,
    features: {
      playbook: true,
      statsTracking: true,
      livestream: true,
      videoLibrary: true,
      fundraising: true,
      events: true,
      messaging: true,
      roster: true,
    },
    labels: {
      game: 'Game',
      practice: 'Practice',
      season: 'Season',
      play: 'Play',
      playbook: 'Playbook',
    },
  },
  basketball: {
    id: 'basketball',
    name: 'Basketball',
    emoji: '🏀',
    color: '#ef4444', // Red
    positions: BASKETBALL_POSITIONS,
    stats: BASKETBALL_STATS,
    features: {
      playbook: true, // Could add court diagram later
      statsTracking: true,
      livestream: true,
      videoLibrary: true,
      fundraising: true,
      events: true,
      messaging: true,
      roster: true,
    },
    labels: {
      game: 'Game',
      practice: 'Practice',
      season: 'Season',
      play: 'Play',
      playbook: 'Playbook',
    },
  },
  cheer: {
    id: 'cheer',
    name: 'Cheer',
    emoji: '📣',
    color: '#ec4899', // Pink
    positions: CHEER_POSITIONS,
    stats: CHEER_STATS,
    features: {
      playbook: false, // Cheer doesn't use playbook - uses routines/videos instead
      statsTracking: true, // Competition scores
      livestream: true,
      videoLibrary: true, // Routine videos
      fundraising: true,
      events: true, // Competitions
      messaging: true,
      roster: true,
    },
    labels: {
      game: 'Competition',
      practice: 'Practice',
      season: 'Season',
      play: 'Routine',
      playbook: 'Routines',
    },
  },
  soccer: {
    id: 'soccer',
    name: 'Soccer',
    emoji: '⚽',
    color: '#22c55e', // Green
    positions: SOCCER_POSITIONS,
    stats: SOCCER_STATS,
    features: {
      playbook: true, // Could add pitch diagram later
      statsTracking: true,
      livestream: true,
      videoLibrary: true,
      fundraising: true,
      events: true,
      messaging: true,
      roster: true,
    },
    labels: {
      game: 'Match',
      practice: 'Training',
      season: 'Season',
      play: 'Set Piece',
      playbook: 'Tactics',
    },
  },
  baseball: {
    id: 'baseball',
    name: 'Baseball',
    emoji: '⚾',
    color: '#3b82f6', // Blue
    positions: BASEBALL_POSITIONS,
    stats: BASEBALL_STATS,
    features: {
      playbook: true, // Could add diamond diagram later
      statsTracking: true,
      livestream: true,
      videoLibrary: true,
      fundraising: true,
      events: true,
      messaging: true,
      roster: true,
    },
    labels: {
      game: 'Game',
      practice: 'Practice',
      season: 'Season',
      play: 'Play',
      playbook: 'Playbook',
    },
  },
  volleyball: {
    id: 'volleyball',
    name: 'Volleyball',
    emoji: '🏐',
    color: '#8b5cf6', // Purple
    positions: VOLLEYBALL_POSITIONS,
    stats: [], // Add later
    features: {
      playbook: true,
      statsTracking: true,
      livestream: true,
      videoLibrary: true,
      fundraising: true,
      events: true,
      messaging: true,
      roster: true,
    },
    labels: {
      game: 'Match',
      practice: 'Practice',
      season: 'Season',
      play: 'Play',
      playbook: 'Playbook',
    },
  },
  other: {
    id: 'other',
    name: 'Other Sport',
    emoji: '🏆',
    color: '#6b7280', // Gray
    positions: [],
    stats: [],
    features: {
      playbook: false,
      statsTracking: false,
      livestream: true,
      videoLibrary: true,
      fundraising: true,
      events: true,
      messaging: true,
      roster: true,
    },
    labels: {
      game: 'Event',
      practice: 'Practice',
      season: 'Season',
      play: 'Play',
      playbook: 'Playbook',
    },
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get sport configuration by type
 */
export function getSportConfig(sport: SportType | undefined): SportConfig {
  const config = SPORT_CONFIGS[sport || 'football'];
  // Fallback to football if sport not found
  return config || SPORT_CONFIGS['football'];
}

/**
 * Get positions for a sport
 */
export function getPositions(sport: SportType | undefined): PositionConfig[] {
  return getSportConfig(sport).positions;
}

/**
 * Get stats for a sport
 */
export function getStats(sport: SportType | undefined): StatConfig[] {
  return getSportConfig(sport).stats;
}

/**
 * Check if a feature is enabled for a sport
 */
export function hasFeature(sport: SportType | undefined, feature: keyof SportConfig['features']): boolean {
  return getSportConfig(sport).features[feature];
}

/**
 * Get label for a concept in a sport
 */
export function getLabel(sport: SportType | undefined, concept: keyof SportConfig['labels']): string {
  return getSportConfig(sport).labels[concept];
}

/**
 * Get all sports as options for a dropdown
 */
export function getSportOptions(): { value: SportType; label: string; emoji: string }[] {
  return Object.values(SPORT_CONFIGS).map(config => ({
    value: config.id,
    label: config.name,
    emoji: config.emoji,
  }));
}

/**
 * Get position label by value
 */
export function getPositionLabel(sport: SportType | undefined, positionValue: string): string {
  const positions = getPositions(sport);
  const position = positions.find(p => p.value === positionValue);
  return position?.label || positionValue;
}

/**
 * Get list of position names for a sport (for dropdowns)
 */
export function getPositionsForSport(sport: string): string[] {
  const config = SPORT_CONFIGS[sport as SportType] || SPORT_CONFIGS.football;
  return config.positions.map(p => p.label);
}

/**
 * Get jersey number rules for a sport
 */
export interface JerseyRules {
  min: number;
  max: number;
  restricted?: number[];
  message?: string;
}

export function getJerseyNumberRules(sport: string): JerseyRules | null {
  const config = SPORT_CONFIGS[sport as SportType];
  if (!config) return null;
  
  // Sport-specific jersey rules
  switch (sport) {
    case 'football':
      return { min: 1, max: 99, message: 'Jersey numbers 1-99' };
    case 'basketball':
      return { min: 0, max: 99, message: 'Jersey numbers 0-99' };
    case 'baseball':
    case 'softball':
      return { min: 0, max: 99, message: 'Jersey numbers 0-99' };
    case 'soccer':
      return { min: 1, max: 99, message: 'Jersey numbers 1-99' };
    case 'hockey':
      return { min: 1, max: 99, message: 'Jersey numbers 1-99' };
    case 'volleyball':
      return { min: 1, max: 99, message: 'Jersey numbers 1-99' };
    case 'lacrosse':
      return { min: 1, max: 99, message: 'Jersey numbers 1-99' };
    default:
      return { min: 1, max: 99, message: 'Jersey numbers 1-99' };
  }
}

/**
 * Validate a jersey number for a sport
 */
export function validateJerseyNumber(number: number, sport: string): { valid: boolean; error?: string } {
  const rules = getJerseyNumberRules(sport);
  if (!rules) {
    return { valid: true };
  }
  
  if (number < rules.min || number > rules.max) {
    return { 
      valid: false, 
      error: `Jersey number must be between ${rules.min} and ${rules.max}` 
    };
  }
  
  if (rules.restricted && rules.restricted.includes(number)) {
    return { 
      valid: false, 
      error: `Jersey number ${number} is not allowed` 
    };
  }
  
  return { valid: true };
}
