/**
 * Stats Engine v2.0 - Sport-Specific Stat Schemas
 * 
 * This is the single source of truth for all stat definitions.
 * Each sport has its own stat categories, individual stats, and auto-calculated metrics.
 * 
 * Created: December 21, 2025
 */

import type { SportType } from '../types';

// =============================================================================
// STAT DEFINITION TYPES
// =============================================================================

export interface StatDefinition {
  key: string;                    // Unique key for the stat (e.g., 'passYards')
  label: string;                  // Display label (e.g., 'Passing Yards')
  shortLabel: string;             // Short label for tables (e.g., 'Pass Yds')
  abbrev: string;                 // Abbreviation (e.g., 'PYD')
  category: StatCategory;         // Which category this belongs to
  type: 'count' | 'yards' | 'percentage' | 'rating' | 'time' | 'score';
  calculated?: boolean;           // Is this auto-calculated from other stats?
  calculateFrom?: string[];       // Keys of stats used in calculation
  higherIsBetter?: boolean;       // For leaderboards (default true)
  icon?: string;                  // Lucide icon name
  position?: string[];            // Positions this stat applies to (empty = all)
}

export interface StatCategory {
  key: string;
  label: string;
  order: number;
  icon?: string;
}

export interface SportStatSchema {
  sport: SportType;
  categories: StatCategory[];
  stats: StatDefinition[];
  quickStats: string[];           // Keys of stats to show in compact views
  leaderboardStats: string[];     // Keys of stats for leaderboards
  gameLogStats: string[];         // Keys of stats to show in game logs
}

// =============================================================================
// STAT CATEGORIES
// =============================================================================

const FOOTBALL_CATEGORIES: StatCategory[] = [
  { key: 'participation', label: 'Participation', order: 0, icon: 'Users' },
  { key: 'passing', label: 'Passing', order: 1, icon: 'Target' },
  { key: 'rushing', label: 'Rushing', order: 2, icon: 'Zap' },
  { key: 'receiving', label: 'Receiving', order: 3, icon: 'Radio' },
  { key: 'defense', label: 'Defense', order: 4, icon: 'Shield' },
  { key: 'specialTeams', label: 'Special Teams', order: 5, icon: 'Star' },
  { key: 'sportsmanship', label: 'Sportsmanship', order: 6, icon: 'Heart' },
];

const BASKETBALL_CATEGORIES: StatCategory[] = [
  { key: 'participation', label: 'Participation', order: 0, icon: 'Users' },
  { key: 'scoring', label: 'Scoring', order: 1, icon: 'Target' },
  { key: 'rebounds', label: 'Rebounds', order: 2, icon: 'ArrowDown' },
  { key: 'playmaking', label: 'Playmaking', order: 3, icon: 'GitBranch' },
  { key: 'defense', label: 'Defense', order: 4, icon: 'Shield' },
  { key: 'advanced', label: 'Advanced', order: 5, icon: 'TrendingUp' },
];

const SOCCER_CATEGORIES: StatCategory[] = [
  { key: 'participation', label: 'Participation', order: 0, icon: 'Users' },
  { key: 'attacking', label: 'Attacking', order: 1, icon: 'Target' },
  { key: 'passing', label: 'Passing', order: 2, icon: 'Send' },
  { key: 'defense', label: 'Defense', order: 3, icon: 'Shield' },
  { key: 'goalkeeper', label: 'Goalkeeper', order: 4, icon: 'Hand' },
  { key: 'discipline', label: 'Discipline', order: 5, icon: 'AlertTriangle' },
];

const BASEBALL_CATEGORIES: StatCategory[] = [
  { key: 'participation', label: 'Participation', order: 0, icon: 'Users' },
  { key: 'batting', label: 'Batting', order: 1, icon: 'Target' },
  { key: 'pitching', label: 'Pitching', order: 2, icon: 'Zap' },
  { key: 'fielding', label: 'Fielding', order: 3, icon: 'Shield' },
  { key: 'baserunning', label: 'Baserunning', order: 4, icon: 'FastForward' },
];

const VOLLEYBALL_CATEGORIES: StatCategory[] = [
  { key: 'participation', label: 'Participation', order: 0, icon: 'Users' },
  { key: 'attack', label: 'Attack', order: 1, icon: 'Target' },
  { key: 'serving', label: 'Serving', order: 2, icon: 'Send' },
  { key: 'blocking', label: 'Blocking', order: 3, icon: 'Shield' },
  { key: 'defense', label: 'Defense', order: 4, icon: 'ArrowDown' },
];

const CHEER_CATEGORIES: StatCategory[] = [
  { key: 'participation', label: 'Participation', order: 0, icon: 'Users' },
  { key: 'stunts', label: 'Stunts', order: 1, icon: 'Star' },
  { key: 'tumbling', label: 'Tumbling', order: 2, icon: 'RotateCcw' },
  { key: 'jumps', label: 'Jumps', order: 3, icon: 'ArrowUp' },
  { key: 'spirit', label: 'Spirit', order: 4, icon: 'Heart' },
];

// =============================================================================
// FOOTBALL STATS
// =============================================================================

const FOOTBALL_STATS: StatDefinition[] = [
  // Participation
  { key: 'played', label: 'Played', shortLabel: 'Played', abbrev: 'GP', category: FOOTBALL_CATEGORIES[0], type: 'count' },
  { key: 'snapsOffense', label: 'Offensive Snaps', shortLabel: 'Off Snaps', abbrev: 'OSN', category: FOOTBALL_CATEGORIES[0], type: 'count' },
  { key: 'snapsDefense', label: 'Defensive Snaps', shortLabel: 'Def Snaps', abbrev: 'DSN', category: FOOTBALL_CATEGORIES[0], type: 'count' },
  { key: 'snapsSpecialTeams', label: 'Special Teams Snaps', shortLabel: 'ST Snaps', abbrev: 'STN', category: FOOTBALL_CATEGORIES[0], type: 'count' },
  
  // Passing
  { key: 'passAttempts', label: 'Pass Attempts', shortLabel: 'Att', abbrev: 'ATT', category: FOOTBALL_CATEGORIES[1], type: 'count', position: ['QB'] },
  { key: 'passCompletions', label: 'Completions', shortLabel: 'Cmp', abbrev: 'CMP', category: FOOTBALL_CATEGORIES[1], type: 'count', position: ['QB'] },
  { key: 'passYards', label: 'Passing Yards', shortLabel: 'Pass Yds', abbrev: 'PYD', category: FOOTBALL_CATEGORIES[1], type: 'yards', position: ['QB'] },
  { key: 'passTouchdowns', label: 'Passing TDs', shortLabel: 'Pass TD', abbrev: 'PTD', category: FOOTBALL_CATEGORIES[1], type: 'count', position: ['QB'] },
  { key: 'interceptions', label: 'Interceptions Thrown', shortLabel: 'INT', abbrev: 'INT', category: FOOTBALL_CATEGORIES[1], type: 'count', higherIsBetter: false, position: ['QB'] },
  { key: 'completionPct', label: 'Completion %', shortLabel: 'Cmp%', abbrev: 'CMP%', category: FOOTBALL_CATEGORIES[1], type: 'percentage', calculated: true, calculateFrom: ['passCompletions', 'passAttempts'], position: ['QB'] },
  { key: 'passerRating', label: 'Passer Rating', shortLabel: 'Rating', abbrev: 'RTG', category: FOOTBALL_CATEGORIES[1], type: 'rating', calculated: true, position: ['QB'] },
  { key: 'longestPass', label: 'Longest Pass', shortLabel: 'Long', abbrev: 'LNG', category: FOOTBALL_CATEGORIES[1], type: 'yards', position: ['QB'] },
  
  // Rushing
  { key: 'rushAttempts', label: 'Rush Attempts', shortLabel: 'Att', abbrev: 'ATT', category: FOOTBALL_CATEGORIES[2], type: 'count' },
  { key: 'rushYards', label: 'Rushing Yards', shortLabel: 'Rush Yds', abbrev: 'RYD', category: FOOTBALL_CATEGORIES[2], type: 'yards' },
  { key: 'rushTouchdowns', label: 'Rushing TDs', shortLabel: 'Rush TD', abbrev: 'RTD', category: FOOTBALL_CATEGORIES[2], type: 'count' },
  { key: 'yardsPerCarry', label: 'Yards Per Carry', shortLabel: 'YPC', abbrev: 'YPC', category: FOOTBALL_CATEGORIES[2], type: 'yards', calculated: true, calculateFrom: ['rushYards', 'rushAttempts'] },
  { key: 'longestRush', label: 'Longest Rush', shortLabel: 'Long', abbrev: 'LNG', category: FOOTBALL_CATEGORIES[2], type: 'yards' },
  { key: 'fumbles', label: 'Fumbles', shortLabel: 'FUM', abbrev: 'FUM', category: FOOTBALL_CATEGORIES[2], type: 'count', higherIsBetter: false },
  { key: 'fumblesLost', label: 'Fumbles Lost', shortLabel: 'Lost', abbrev: 'LOST', category: FOOTBALL_CATEGORIES[2], type: 'count', higherIsBetter: false },
  
  // Receiving
  { key: 'targets', label: 'Targets', shortLabel: 'Tgt', abbrev: 'TGT', category: FOOTBALL_CATEGORIES[3], type: 'count' },
  { key: 'receptions', label: 'Receptions', shortLabel: 'Rec', abbrev: 'REC', category: FOOTBALL_CATEGORIES[3], type: 'count' },
  { key: 'receivingYards', label: 'Receiving Yards', shortLabel: 'Rec Yds', abbrev: 'YDS', category: FOOTBALL_CATEGORIES[3], type: 'yards' },
  { key: 'receivingTouchdowns', label: 'Receiving TDs', shortLabel: 'Rec TD', abbrev: 'TD', category: FOOTBALL_CATEGORIES[3], type: 'count' },
  { key: 'yardsPerReception', label: 'Yards Per Catch', shortLabel: 'YPC', abbrev: 'YPC', category: FOOTBALL_CATEGORIES[3], type: 'yards', calculated: true, calculateFrom: ['receivingYards', 'receptions'] },
  { key: 'longestReception', label: 'Longest Reception', shortLabel: 'Long', abbrev: 'LNG', category: FOOTBALL_CATEGORIES[3], type: 'yards' },
  { key: 'drops', label: 'Drops', shortLabel: 'Drop', abbrev: 'DRP', category: FOOTBALL_CATEGORIES[3], type: 'count', higherIsBetter: false },
  
  // Defense
  { key: 'tackles', label: 'Total Tackles', shortLabel: 'Tkl', abbrev: 'TKL', category: FOOTBALL_CATEGORIES[4], type: 'count', calculated: true, calculateFrom: ['soloTackles', 'assistedTackles'] },
  { key: 'soloTackles', label: 'Solo Tackles', shortLabel: 'Solo', abbrev: 'SOLO', category: FOOTBALL_CATEGORIES[4], type: 'count' },
  { key: 'assistedTackles', label: 'Assisted Tackles', shortLabel: 'Ast', abbrev: 'AST', category: FOOTBALL_CATEGORIES[4], type: 'count' },
  { key: 'tacklesForLoss', label: 'Tackles For Loss', shortLabel: 'TFL', abbrev: 'TFL', category: FOOTBALL_CATEGORIES[4], type: 'count' },
  { key: 'sacks', label: 'Sacks', shortLabel: 'Sack', abbrev: 'SCK', category: FOOTBALL_CATEGORIES[4], type: 'count' },
  { key: 'qbHits', label: 'QB Hits', shortLabel: 'QBH', abbrev: 'QBH', category: FOOTBALL_CATEGORIES[4], type: 'count' },
  { key: 'defensiveInterceptions', label: 'Interceptions', shortLabel: 'INT', abbrev: 'INT', category: FOOTBALL_CATEGORIES[4], type: 'count' },
  { key: 'intReturnYards', label: 'INT Return Yards', shortLabel: 'Int Yds', abbrev: 'IYD', category: FOOTBALL_CATEGORIES[4], type: 'yards' },
  { key: 'intReturnTouchdowns', label: 'INT Return TDs', shortLabel: 'Int TD', abbrev: 'ITD', category: FOOTBALL_CATEGORIES[4], type: 'count' },
  { key: 'forcedFumbles', label: 'Forced Fumbles', shortLabel: 'FF', abbrev: 'FF', category: FOOTBALL_CATEGORIES[4], type: 'count' },
  { key: 'fumbleRecoveries', label: 'Fumble Recoveries', shortLabel: 'FR', abbrev: 'FR', category: FOOTBALL_CATEGORIES[4], type: 'count' },
  { key: 'fumbleReturnYards', label: 'Fumble Return Yards', shortLabel: 'FR Yds', abbrev: 'FYD', category: FOOTBALL_CATEGORIES[4], type: 'yards' },
  { key: 'fumbleReturnTouchdowns', label: 'Fumble Return TDs', shortLabel: 'FR TD', abbrev: 'FTD', category: FOOTBALL_CATEGORIES[4], type: 'count' },
  { key: 'passesDefended', label: 'Passes Defended', shortLabel: 'PD', abbrev: 'PD', category: FOOTBALL_CATEGORIES[4], type: 'count' },
  { key: 'safeties', label: 'Safeties', shortLabel: 'Saf', abbrev: 'SAF', category: FOOTBALL_CATEGORIES[4], type: 'count' },
  { key: 'blockedKicks', label: 'Blocked Kicks', shortLabel: 'BLK', abbrev: 'BLK', category: FOOTBALL_CATEGORIES[4], type: 'count' },
  
  // Special Teams
  { key: 'fgAttempts', label: 'FG Attempts', shortLabel: 'FGA', abbrev: 'FGA', category: FOOTBALL_CATEGORIES[5], type: 'count', position: ['K'] },
  { key: 'fgMade', label: 'FG Made', shortLabel: 'FGM', abbrev: 'FGM', category: FOOTBALL_CATEGORIES[5], type: 'count', position: ['K'] },
  { key: 'fgLong', label: 'FG Long', shortLabel: 'Long', abbrev: 'LNG', category: FOOTBALL_CATEGORIES[5], type: 'yards', position: ['K'] },
  { key: 'xpAttempts', label: 'XP Attempts', shortLabel: 'XPA', abbrev: 'XPA', category: FOOTBALL_CATEGORIES[5], type: 'count', position: ['K'] },
  { key: 'xpMade', label: 'XP Made', shortLabel: 'XPM', abbrev: 'XPM', category: FOOTBALL_CATEGORIES[5], type: 'count', position: ['K'] },
  { key: 'punts', label: 'Punts', shortLabel: 'Punts', abbrev: 'PNT', category: FOOTBALL_CATEGORIES[5], type: 'count', position: ['P'] },
  { key: 'puntYards', label: 'Punt Yards', shortLabel: 'Yds', abbrev: 'YDS', category: FOOTBALL_CATEGORIES[5], type: 'yards', position: ['P'] },
  { key: 'puntAvg', label: 'Punt Average', shortLabel: 'Avg', abbrev: 'AVG', category: FOOTBALL_CATEGORIES[5], type: 'yards', calculated: true, calculateFrom: ['puntYards', 'punts'], position: ['P'] },
  { key: 'kickReturns', label: 'Kick Returns', shortLabel: 'KR', abbrev: 'KR', category: FOOTBALL_CATEGORIES[5], type: 'count' },
  { key: 'kickReturnYards', label: 'Kick Return Yards', shortLabel: 'KR Yds', abbrev: 'KYD', category: FOOTBALL_CATEGORIES[5], type: 'yards' },
  { key: 'kickReturnTouchdowns', label: 'Kick Return TDs', shortLabel: 'KR TD', abbrev: 'KTD', category: FOOTBALL_CATEGORIES[5], type: 'count' },
  { key: 'puntReturns', label: 'Punt Returns', shortLabel: 'PR', abbrev: 'PR', category: FOOTBALL_CATEGORIES[5], type: 'count' },
  { key: 'puntReturnYards', label: 'Punt Return Yards', shortLabel: 'PR Yds', abbrev: 'PYD', category: FOOTBALL_CATEGORIES[5], type: 'yards' },
  { key: 'puntReturnTouchdowns', label: 'Punt Return TDs', shortLabel: 'PR TD', abbrev: 'PTD', category: FOOTBALL_CATEGORIES[5], type: 'count' },
  
  // Sportsmanship
  { key: 'sportsmanshipPoints', label: 'Sportsmanship Points', shortLabel: 'Spts', abbrev: 'SPT', category: FOOTBALL_CATEGORIES[6], type: 'count' },
  { key: 'penaltiesCommitted', label: 'Penalties', shortLabel: 'Pen', abbrev: 'PEN', category: FOOTBALL_CATEGORIES[6], type: 'count', higherIsBetter: false },
];

// =============================================================================
// BASKETBALL STATS
// =============================================================================

const BASKETBALL_STATS: StatDefinition[] = [
  // Participation
  { key: 'played', label: 'Played', shortLabel: 'GP', abbrev: 'GP', category: BASKETBALL_CATEGORIES[0], type: 'count' },
  { key: 'gamesStarted', label: 'Games Started', shortLabel: 'GS', abbrev: 'GS', category: BASKETBALL_CATEGORIES[0], type: 'count' },
  { key: 'minutesPlayed', label: 'Minutes Played', shortLabel: 'MIN', abbrev: 'MIN', category: BASKETBALL_CATEGORIES[0], type: 'time' },
  
  // Scoring
  { key: 'points', label: 'Points', shortLabel: 'PTS', abbrev: 'PTS', category: BASKETBALL_CATEGORIES[1], type: 'count' },
  { key: 'fgAttempts', label: 'FG Attempts', shortLabel: 'FGA', abbrev: 'FGA', category: BASKETBALL_CATEGORIES[1], type: 'count' },
  { key: 'fgMade', label: 'FG Made', shortLabel: 'FGM', abbrev: 'FGM', category: BASKETBALL_CATEGORIES[1], type: 'count' },
  { key: 'fgPercentage', label: 'FG %', shortLabel: 'FG%', abbrev: 'FG%', category: BASKETBALL_CATEGORIES[1], type: 'percentage', calculated: true, calculateFrom: ['fgMade', 'fgAttempts'] },
  { key: 'threePointAttempts', label: '3PT Attempts', shortLabel: '3PA', abbrev: '3PA', category: BASKETBALL_CATEGORIES[1], type: 'count' },
  { key: 'threePointMade', label: '3PT Made', shortLabel: '3PM', abbrev: '3PM', category: BASKETBALL_CATEGORIES[1], type: 'count' },
  { key: 'threePointPercentage', label: '3PT %', shortLabel: '3P%', abbrev: '3P%', category: BASKETBALL_CATEGORIES[1], type: 'percentage', calculated: true, calculateFrom: ['threePointMade', 'threePointAttempts'] },
  { key: 'ftAttempts', label: 'FT Attempts', shortLabel: 'FTA', abbrev: 'FTA', category: BASKETBALL_CATEGORIES[1], type: 'count' },
  { key: 'ftMade', label: 'FT Made', shortLabel: 'FTM', abbrev: 'FTM', category: BASKETBALL_CATEGORIES[1], type: 'count' },
  { key: 'ftPercentage', label: 'FT %', shortLabel: 'FT%', abbrev: 'FT%', category: BASKETBALL_CATEGORIES[1], type: 'percentage', calculated: true, calculateFrom: ['ftMade', 'ftAttempts'] },
  
  // Rebounds
  { key: 'offensiveRebounds', label: 'Offensive Rebounds', shortLabel: 'OREB', abbrev: 'ORB', category: BASKETBALL_CATEGORIES[2], type: 'count' },
  { key: 'defensiveRebounds', label: 'Defensive Rebounds', shortLabel: 'DREB', abbrev: 'DRB', category: BASKETBALL_CATEGORIES[2], type: 'count' },
  { key: 'totalRebounds', label: 'Total Rebounds', shortLabel: 'REB', abbrev: 'REB', category: BASKETBALL_CATEGORIES[2], type: 'count', calculated: true, calculateFrom: ['offensiveRebounds', 'defensiveRebounds'] },
  
  // Playmaking
  { key: 'assists', label: 'Assists', shortLabel: 'AST', abbrev: 'AST', category: BASKETBALL_CATEGORIES[3], type: 'count' },
  { key: 'turnovers', label: 'Turnovers', shortLabel: 'TO', abbrev: 'TO', category: BASKETBALL_CATEGORIES[3], type: 'count', higherIsBetter: false },
  { key: 'assistToTurnoverRatio', label: 'AST/TO Ratio', shortLabel: 'A/TO', abbrev: 'A/TO', category: BASKETBALL_CATEGORIES[3], type: 'rating', calculated: true, calculateFrom: ['assists', 'turnovers'] },
  
  // Defense
  { key: 'steals', label: 'Steals', shortLabel: 'STL', abbrev: 'STL', category: BASKETBALL_CATEGORIES[4], type: 'count' },
  { key: 'blocks', label: 'Blocks', shortLabel: 'BLK', abbrev: 'BLK', category: BASKETBALL_CATEGORIES[4], type: 'count' },
  { key: 'personalFouls', label: 'Personal Fouls', shortLabel: 'PF', abbrev: 'PF', category: BASKETBALL_CATEGORIES[4], type: 'count', higherIsBetter: false },
  { key: 'technicalFouls', label: 'Technical Fouls', shortLabel: 'TF', abbrev: 'TF', category: BASKETBALL_CATEGORIES[4], type: 'count', higherIsBetter: false },
  
  // Advanced
  { key: 'plusMinus', label: 'Plus/Minus', shortLabel: '+/-', abbrev: '+/-', category: BASKETBALL_CATEGORIES[5], type: 'count' },
  { key: 'gameScore', label: 'Game Score', shortLabel: 'GmSc', abbrev: 'GS', category: BASKETBALL_CATEGORIES[5], type: 'score', calculated: true },
  { key: 'efficiency', label: 'Efficiency', shortLabel: 'EFF', abbrev: 'EFF', category: BASKETBALL_CATEGORIES[5], type: 'score', calculated: true },
];

// =============================================================================
// SOCCER STATS
// =============================================================================

const SOCCER_STATS: StatDefinition[] = [
  // Participation
  { key: 'played', label: 'Played', shortLabel: 'GP', abbrev: 'GP', category: SOCCER_CATEGORIES[0], type: 'count' },
  { key: 'gamesStarted', label: 'Games Started', shortLabel: 'GS', abbrev: 'GS', category: SOCCER_CATEGORIES[0], type: 'count' },
  { key: 'minutesPlayed', label: 'Minutes Played', shortLabel: 'MIN', abbrev: 'MIN', category: SOCCER_CATEGORIES[0], type: 'time' },
  
  // Attacking
  { key: 'goals', label: 'Goals', shortLabel: 'G', abbrev: 'G', category: SOCCER_CATEGORIES[1], type: 'count' },
  { key: 'assists', label: 'Assists', shortLabel: 'A', abbrev: 'A', category: SOCCER_CATEGORIES[1], type: 'count' },
  { key: 'shots', label: 'Shots', shortLabel: 'SH', abbrev: 'SH', category: SOCCER_CATEGORIES[1], type: 'count' },
  { key: 'shotsOnTarget', label: 'Shots on Target', shortLabel: 'SOT', abbrev: 'SOT', category: SOCCER_CATEGORIES[1], type: 'count' },
  { key: 'shotAccuracy', label: 'Shot Accuracy', shortLabel: 'SH%', abbrev: 'SH%', category: SOCCER_CATEGORIES[1], type: 'percentage', calculated: true, calculateFrom: ['shotsOnTarget', 'shots'] },
  
  // Passing
  { key: 'passesAttempted', label: 'Passes Attempted', shortLabel: 'PA', abbrev: 'PA', category: SOCCER_CATEGORIES[2], type: 'count' },
  { key: 'passesCompleted', label: 'Passes Completed', shortLabel: 'PC', abbrev: 'PC', category: SOCCER_CATEGORIES[2], type: 'count' },
  { key: 'passAccuracy', label: 'Pass Accuracy', shortLabel: 'P%', abbrev: 'P%', category: SOCCER_CATEGORIES[2], type: 'percentage', calculated: true, calculateFrom: ['passesCompleted', 'passesAttempted'] },
  { key: 'keyPasses', label: 'Key Passes', shortLabel: 'KP', abbrev: 'KP', category: SOCCER_CATEGORIES[2], type: 'count' },
  { key: 'crosses', label: 'Crosses', shortLabel: 'CRS', abbrev: 'CRS', category: SOCCER_CATEGORIES[2], type: 'count' },
  
  // Defense
  { key: 'tackles', label: 'Tackles', shortLabel: 'TKL', abbrev: 'TKL', category: SOCCER_CATEGORIES[3], type: 'count' },
  { key: 'interceptions', label: 'Interceptions', shortLabel: 'INT', abbrev: 'INT', category: SOCCER_CATEGORIES[3], type: 'count' },
  { key: 'clearances', label: 'Clearances', shortLabel: 'CLR', abbrev: 'CLR', category: SOCCER_CATEGORIES[3], type: 'count' },
  { key: 'blocks', label: 'Blocks', shortLabel: 'BLK', abbrev: 'BLK', category: SOCCER_CATEGORIES[3], type: 'count' },
  
  // Goalkeeper
  { key: 'saves', label: 'Saves', shortLabel: 'SV', abbrev: 'SV', category: SOCCER_CATEGORIES[4], type: 'count', position: ['GK'] },
  { key: 'goalsConceded', label: 'Goals Conceded', shortLabel: 'GA', abbrev: 'GA', category: SOCCER_CATEGORIES[4], type: 'count', higherIsBetter: false, position: ['GK'] },
  { key: 'savePercentage', label: 'Save %', shortLabel: 'SV%', abbrev: 'SV%', category: SOCCER_CATEGORIES[4], type: 'percentage', calculated: true, position: ['GK'] },
  { key: 'cleanSheets', label: 'Clean Sheets', shortLabel: 'CS', abbrev: 'CS', category: SOCCER_CATEGORIES[4], type: 'count', position: ['GK'] },
  
  // Discipline
  { key: 'yellowCards', label: 'Yellow Cards', shortLabel: 'YC', abbrev: 'YC', category: SOCCER_CATEGORIES[5], type: 'count', higherIsBetter: false },
  { key: 'redCards', label: 'Red Cards', shortLabel: 'RC', abbrev: 'RC', category: SOCCER_CATEGORIES[5], type: 'count', higherIsBetter: false },
  { key: 'foulsCommitted', label: 'Fouls Committed', shortLabel: 'FC', abbrev: 'FC', category: SOCCER_CATEGORIES[5], type: 'count', higherIsBetter: false },
  { key: 'foulsDrawn', label: 'Fouls Drawn', shortLabel: 'FD', abbrev: 'FD', category: SOCCER_CATEGORIES[5], type: 'count' },
];

// =============================================================================
// BASEBALL STATS
// =============================================================================

const BASEBALL_STATS: StatDefinition[] = [
  // Participation
  { key: 'played', label: 'Games Played', shortLabel: 'G', abbrev: 'G', category: BASEBALL_CATEGORIES[0], type: 'count' },
  { key: 'gamesStarted', label: 'Games Started', shortLabel: 'GS', abbrev: 'GS', category: BASEBALL_CATEGORIES[0], type: 'count' },
  
  // Batting
  { key: 'atBats', label: 'At Bats', shortLabel: 'AB', abbrev: 'AB', category: BASEBALL_CATEGORIES[1], type: 'count' },
  { key: 'runs', label: 'Runs', shortLabel: 'R', abbrev: 'R', category: BASEBALL_CATEGORIES[1], type: 'count' },
  { key: 'hits', label: 'Hits', shortLabel: 'H', abbrev: 'H', category: BASEBALL_CATEGORIES[1], type: 'count' },
  { key: 'doubles', label: 'Doubles', shortLabel: '2B', abbrev: '2B', category: BASEBALL_CATEGORIES[1], type: 'count' },
  { key: 'triples', label: 'Triples', shortLabel: '3B', abbrev: '3B', category: BASEBALL_CATEGORIES[1], type: 'count' },
  { key: 'homeRuns', label: 'Home Runs', shortLabel: 'HR', abbrev: 'HR', category: BASEBALL_CATEGORIES[1], type: 'count' },
  { key: 'rbi', label: 'RBI', shortLabel: 'RBI', abbrev: 'RBI', category: BASEBALL_CATEGORIES[1], type: 'count' },
  { key: 'walks', label: 'Walks', shortLabel: 'BB', abbrev: 'BB', category: BASEBALL_CATEGORIES[1], type: 'count' },
  { key: 'strikeouts', label: 'Strikeouts', shortLabel: 'K', abbrev: 'K', category: BASEBALL_CATEGORIES[1], type: 'count', higherIsBetter: false },
  { key: 'battingAverage', label: 'Batting Average', shortLabel: 'AVG', abbrev: 'AVG', category: BASEBALL_CATEGORIES[1], type: 'percentage', calculated: true, calculateFrom: ['hits', 'atBats'] },
  { key: 'onBasePercentage', label: 'On Base %', shortLabel: 'OBP', abbrev: 'OBP', category: BASEBALL_CATEGORIES[1], type: 'percentage', calculated: true },
  { key: 'sluggingPercentage', label: 'Slugging %', shortLabel: 'SLG', abbrev: 'SLG', category: BASEBALL_CATEGORIES[1], type: 'percentage', calculated: true },
  { key: 'ops', label: 'OPS', shortLabel: 'OPS', abbrev: 'OPS', category: BASEBALL_CATEGORIES[1], type: 'percentage', calculated: true, calculateFrom: ['onBasePercentage', 'sluggingPercentage'] },
  
  // Pitching
  { key: 'inningsPitched', label: 'Innings Pitched', shortLabel: 'IP', abbrev: 'IP', category: BASEBALL_CATEGORIES[2], type: 'count', position: ['P'] },
  { key: 'wins', label: 'Wins', shortLabel: 'W', abbrev: 'W', category: BASEBALL_CATEGORIES[2], type: 'count', position: ['P'] },
  { key: 'losses', label: 'Losses', shortLabel: 'L', abbrev: 'L', category: BASEBALL_CATEGORIES[2], type: 'count', higherIsBetter: false, position: ['P'] },
  { key: 'saves', label: 'Saves', shortLabel: 'SV', abbrev: 'SV', category: BASEBALL_CATEGORIES[2], type: 'count', position: ['P'] },
  { key: 'strikeoutsThrown', label: 'Strikeouts', shortLabel: 'K', abbrev: 'K', category: BASEBALL_CATEGORIES[2], type: 'count', position: ['P'] },
  { key: 'walksAllowed', label: 'Walks Allowed', shortLabel: 'BB', abbrev: 'BB', category: BASEBALL_CATEGORIES[2], type: 'count', higherIsBetter: false, position: ['P'] },
  { key: 'hitsAllowed', label: 'Hits Allowed', shortLabel: 'H', abbrev: 'H', category: BASEBALL_CATEGORIES[2], type: 'count', higherIsBetter: false, position: ['P'] },
  { key: 'earnedRuns', label: 'Earned Runs', shortLabel: 'ER', abbrev: 'ER', category: BASEBALL_CATEGORIES[2], type: 'count', higherIsBetter: false, position: ['P'] },
  { key: 'era', label: 'ERA', shortLabel: 'ERA', abbrev: 'ERA', category: BASEBALL_CATEGORIES[2], type: 'rating', calculated: true, higherIsBetter: false, position: ['P'] },
  { key: 'whip', label: 'WHIP', shortLabel: 'WHIP', abbrev: 'WHIP', category: BASEBALL_CATEGORIES[2], type: 'rating', calculated: true, higherIsBetter: false, position: ['P'] },
  
  // Fielding
  { key: 'putouts', label: 'Putouts', shortLabel: 'PO', abbrev: 'PO', category: BASEBALL_CATEGORIES[3], type: 'count' },
  { key: 'fieldingAssists', label: 'Assists', shortLabel: 'A', abbrev: 'A', category: BASEBALL_CATEGORIES[3], type: 'count' },
  { key: 'errors', label: 'Errors', shortLabel: 'E', abbrev: 'E', category: BASEBALL_CATEGORIES[3], type: 'count', higherIsBetter: false },
  { key: 'fieldingPercentage', label: 'Fielding %', shortLabel: 'FPCT', abbrev: 'FPCT', category: BASEBALL_CATEGORIES[3], type: 'percentage', calculated: true },
  
  // Baserunning
  { key: 'stolenBases', label: 'Stolen Bases', shortLabel: 'SB', abbrev: 'SB', category: BASEBALL_CATEGORIES[4], type: 'count' },
  { key: 'caughtStealing', label: 'Caught Stealing', shortLabel: 'CS', abbrev: 'CS', category: BASEBALL_CATEGORIES[4], type: 'count', higherIsBetter: false },
];

// =============================================================================
// VOLLEYBALL STATS
// =============================================================================

const VOLLEYBALL_STATS: StatDefinition[] = [
  // Participation
  { key: 'played', label: 'Matches Played', shortLabel: 'MP', abbrev: 'MP', category: VOLLEYBALL_CATEGORIES[0], type: 'count' },
  { key: 'setsPlayed', label: 'Sets Played', shortLabel: 'SP', abbrev: 'SP', category: VOLLEYBALL_CATEGORIES[0], type: 'count' },
  
  // Attack
  { key: 'kills', label: 'Kills', shortLabel: 'K', abbrev: 'K', category: VOLLEYBALL_CATEGORIES[1], type: 'count' },
  { key: 'attackAttempts', label: 'Attack Attempts', shortLabel: 'ATT', abbrev: 'ATT', category: VOLLEYBALL_CATEGORIES[1], type: 'count' },
  { key: 'attackErrors', label: 'Attack Errors', shortLabel: 'AE', abbrev: 'AE', category: VOLLEYBALL_CATEGORIES[1], type: 'count', higherIsBetter: false },
  { key: 'hittingPercentage', label: 'Hitting %', shortLabel: 'HIT%', abbrev: 'HIT%', category: VOLLEYBALL_CATEGORIES[1], type: 'percentage', calculated: true },
  
  // Serving
  { key: 'serviceAces', label: 'Service Aces', shortLabel: 'SA', abbrev: 'SA', category: VOLLEYBALL_CATEGORIES[2], type: 'count' },
  { key: 'serviceAttempts', label: 'Service Attempts', shortLabel: 'SAT', abbrev: 'SAT', category: VOLLEYBALL_CATEGORIES[2], type: 'count' },
  { key: 'serviceErrors', label: 'Service Errors', shortLabel: 'SE', abbrev: 'SE', category: VOLLEYBALL_CATEGORIES[2], type: 'count', higherIsBetter: false },
  
  // Blocking
  { key: 'blockSolos', label: 'Solo Blocks', shortLabel: 'BS', abbrev: 'BS', category: VOLLEYBALL_CATEGORIES[3], type: 'count' },
  { key: 'blockAssists', label: 'Block Assists', shortLabel: 'BA', abbrev: 'BA', category: VOLLEYBALL_CATEGORIES[3], type: 'count' },
  { key: 'totalBlocks', label: 'Total Blocks', shortLabel: 'TB', abbrev: 'TB', category: VOLLEYBALL_CATEGORIES[3], type: 'count', calculated: true, calculateFrom: ['blockSolos', 'blockAssists'] },
  { key: 'blockErrors', label: 'Block Errors', shortLabel: 'BE', abbrev: 'BE', category: VOLLEYBALL_CATEGORIES[3], type: 'count', higherIsBetter: false },
  
  // Defense
  { key: 'digs', label: 'Digs', shortLabel: 'D', abbrev: 'D', category: VOLLEYBALL_CATEGORIES[4], type: 'count' },
  { key: 'assists', label: 'Assists', shortLabel: 'A', abbrev: 'A', category: VOLLEYBALL_CATEGORIES[4], type: 'count' },
  { key: 'receptionErrors', label: 'Reception Errors', shortLabel: 'RE', abbrev: 'RE', category: VOLLEYBALL_CATEGORIES[4], type: 'count', higherIsBetter: false },
];

// =============================================================================
// CHEER STATS
// =============================================================================

const CHEER_STATS: StatDefinition[] = [
  // Participation
  { key: 'performed', label: 'Performances', shortLabel: 'PERF', abbrev: 'PERF', category: CHEER_CATEGORIES[0], type: 'count' },
  { key: 'competitionsEntered', label: 'Competitions', shortLabel: 'COMP', abbrev: 'COMP', category: CHEER_CATEGORIES[0], type: 'count' },
  
  // Stunts
  { key: 'stuntsAttempted', label: 'Stunts Attempted', shortLabel: 'SA', abbrev: 'SA', category: CHEER_CATEGORIES[1], type: 'count' },
  { key: 'stuntsHit', label: 'Stunts Hit', shortLabel: 'SH', abbrev: 'SH', category: CHEER_CATEGORIES[1], type: 'count' },
  { key: 'stuntsFallen', label: 'Stunts Fallen', shortLabel: 'SF', abbrev: 'SF', category: CHEER_CATEGORIES[1], type: 'count', higherIsBetter: false },
  { key: 'stuntSuccessRate', label: 'Stunt Success %', shortLabel: 'SS%', abbrev: 'SS%', category: CHEER_CATEGORIES[1], type: 'percentage', calculated: true, calculateFrom: ['stuntsHit', 'stuntsAttempted'] },
  
  // Tumbling
  { key: 'tumblingPasses', label: 'Tumbling Passes', shortLabel: 'TP', abbrev: 'TP', category: CHEER_CATEGORIES[2], type: 'count' },
  { key: 'standingTumbling', label: 'Standing Tumbling', shortLabel: 'ST', abbrev: 'ST', category: CHEER_CATEGORIES[2], type: 'count' },
  { key: 'runningTumbling', label: 'Running Tumbling', shortLabel: 'RT', abbrev: 'RT', category: CHEER_CATEGORIES[2], type: 'count' },
  { key: 'tumblingScore', label: 'Tumbling Score', shortLabel: 'TS', abbrev: 'TS', category: CHEER_CATEGORIES[2], type: 'score' },
  
  // Jumps
  { key: 'jumpsAttempted', label: 'Jumps Attempted', shortLabel: 'JA', abbrev: 'JA', category: CHEER_CATEGORIES[3], type: 'count' },
  { key: 'jumpsHit', label: 'Jumps Hit', shortLabel: 'JH', abbrev: 'JH', category: CHEER_CATEGORIES[3], type: 'count' },
  { key: 'jumpScore', label: 'Jump Score', shortLabel: 'JS', abbrev: 'JS', category: CHEER_CATEGORIES[3], type: 'score' },
  
  // Spirit
  { key: 'crowdEngagement', label: 'Crowd Engagement', shortLabel: 'CE', abbrev: 'CE', category: CHEER_CATEGORIES[4], type: 'score' },
  { key: 'spiritPoints', label: 'Spirit Points', shortLabel: 'SP', abbrev: 'SP', category: CHEER_CATEGORIES[4], type: 'count' },
  { key: 'competitionScore', label: 'Competition Score', shortLabel: 'CS', abbrev: 'CS', category: CHEER_CATEGORIES[4], type: 'score' },
  { key: 'placement', label: 'Placement', shortLabel: 'PL', abbrev: 'PL', category: CHEER_CATEGORIES[4], type: 'count' },
];

// =============================================================================
// SPORT SCHEMAS
// =============================================================================

export const FOOTBALL_SCHEMA: SportStatSchema = {
  sport: 'football',
  categories: FOOTBALL_CATEGORIES,
  stats: FOOTBALL_STATS,
  quickStats: ['rushYards', 'rushTouchdowns', 'receivingYards', 'receivingTouchdowns', 'tackles', 'sacks'],
  leaderboardStats: ['rushYards', 'passYards', 'receivingYards', 'tackles', 'sacks', 'defensiveInterceptions'],
  gameLogStats: ['rushYards', 'rushTouchdowns', 'passYards', 'passTouchdowns', 'receivingYards', 'receivingTouchdowns', 'tackles', 'sacks'],
};

export const BASKETBALL_SCHEMA: SportStatSchema = {
  sport: 'basketball',
  categories: BASKETBALL_CATEGORIES,
  stats: BASKETBALL_STATS,
  quickStats: ['points', 'totalRebounds', 'assists', 'steals', 'blocks'],
  leaderboardStats: ['points', 'totalRebounds', 'assists', 'steals', 'blocks', 'threePointMade'],
  gameLogStats: ['points', 'totalRebounds', 'assists', 'steals', 'blocks', 'fgPercentage'],
};

export const SOCCER_SCHEMA: SportStatSchema = {
  sport: 'soccer',
  categories: SOCCER_CATEGORIES,
  stats: SOCCER_STATS,
  quickStats: ['goals', 'assists', 'shots', 'tackles', 'saves'],
  leaderboardStats: ['goals', 'assists', 'shots', 'tackles', 'cleanSheets'],
  gameLogStats: ['goals', 'assists', 'shots', 'shotsOnTarget', 'tackles', 'saves'],
};

export const BASEBALL_SCHEMA: SportStatSchema = {
  sport: 'baseball',
  categories: BASEBALL_CATEGORIES,
  stats: BASEBALL_STATS,
  quickStats: ['hits', 'homeRuns', 'rbi', 'battingAverage', 'strikeoutsThrown', 'era'],
  leaderboardStats: ['battingAverage', 'homeRuns', 'rbi', 'stolenBases', 'era', 'strikeoutsThrown'],
  gameLogStats: ['hits', 'runs', 'rbi', 'homeRuns', 'inningsPitched', 'strikeoutsThrown'],
};

export const VOLLEYBALL_SCHEMA: SportStatSchema = {
  sport: 'volleyball',
  categories: VOLLEYBALL_CATEGORIES,
  stats: VOLLEYBALL_STATS,
  quickStats: ['kills', 'digs', 'assists', 'serviceAces', 'totalBlocks'],
  leaderboardStats: ['kills', 'digs', 'assists', 'serviceAces', 'totalBlocks'],
  gameLogStats: ['kills', 'digs', 'assists', 'serviceAces', 'blockSolos', 'blockAssists'],
};

export const CHEER_SCHEMA: SportStatSchema = {
  sport: 'cheer',
  categories: CHEER_CATEGORIES,
  stats: CHEER_STATS,
  quickStats: ['stuntsHit', 'tumblingPasses', 'jumpsHit', 'spiritPoints'],
  leaderboardStats: ['stuntsHit', 'stuntSuccessRate', 'tumblingScore', 'competitionScore'],
  gameLogStats: ['stuntsHit', 'stuntsFallen', 'tumblingPasses', 'jumpsHit', 'spiritPoints'],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the stat schema for a specific sport
 */
export function getStatSchema(sport: SportType | undefined): SportStatSchema {
  switch (sport) {
    case 'basketball':
      return BASKETBALL_SCHEMA;
    case 'soccer':
      return SOCCER_SCHEMA;
    case 'baseball':
      return BASEBALL_SCHEMA;
    case 'volleyball':
      return VOLLEYBALL_SCHEMA;
    case 'cheer':
      return CHEER_SCHEMA;
    case 'football':
    default:
      return FOOTBALL_SCHEMA;
  }
}

/**
 * Get all stat definitions for a sport
 */
export function getStatDefinitions(sport: SportType | undefined): StatDefinition[] {
  return getStatSchema(sport).stats;
}

/**
 * Get a specific stat definition by key
 */
export function getStatDefinition(sport: SportType | undefined, key: string): StatDefinition | undefined {
  return getStatDefinitions(sport).find(s => s.key === key);
}

/**
 * Get stats for a specific category
 */
export function getStatsByCategory(sport: SportType | undefined, categoryKey: string): StatDefinition[] {
  return getStatDefinitions(sport).filter(s => s.category.key === categoryKey);
}

/**
 * Get quick stats for display in compact views
 */
export function getQuickStatKeys(sport: SportType | undefined): string[] {
  return getStatSchema(sport).quickStats;
}

/**
 * Get leaderboard stat keys
 */
export function getLeaderboardStatKeys(sport: SportType | undefined): string[] {
  return getStatSchema(sport).leaderboardStats;
}

/**
 * Get game log stat keys
 */
export function getGameLogStatKeys(sport: SportType | undefined): string[] {
  return getStatSchema(sport).gameLogStats;
}

/**
 * Get all categories for a sport
 */
export function getStatCategories(sport: SportType | undefined): StatCategory[] {
  return getStatSchema(sport).categories;
}

/**
 * Calculate derived/auto-calculated stats
 */
export function calculateDerivedStats(sport: SportType, rawStats: Record<string, number>): Record<string, number> {
  const schema = getStatSchema(sport);
  const derived: Record<string, number> = { ...rawStats };
  
  schema.stats.filter(s => s.calculated).forEach(stat => {
    switch (stat.key) {
      // Football
      case 'completionPct':
        derived[stat.key] = rawStats.passAttempts > 0 
          ? Math.round((rawStats.passCompletions / rawStats.passAttempts) * 1000) / 10 
          : 0;
        break;
      case 'yardsPerCarry':
        derived[stat.key] = rawStats.rushAttempts > 0 
          ? Math.round((rawStats.rushYards / rawStats.rushAttempts) * 10) / 10 
          : 0;
        break;
      case 'yardsPerReception':
        derived[stat.key] = rawStats.receptions > 0 
          ? Math.round((rawStats.receivingYards / rawStats.receptions) * 10) / 10 
          : 0;
        break;
      case 'tackles':
        derived[stat.key] = (rawStats.soloTackles || 0) + (rawStats.assistedTackles || 0);
        break;
      case 'puntAvg':
        derived[stat.key] = rawStats.punts > 0 
          ? Math.round((rawStats.puntYards / rawStats.punts) * 10) / 10 
          : 0;
        break;
        
      // Basketball
      case 'fgPercentage':
        derived[stat.key] = rawStats.fgAttempts > 0 
          ? Math.round((rawStats.fgMade / rawStats.fgAttempts) * 1000) / 10 
          : 0;
        break;
      case 'threePointPercentage':
        derived[stat.key] = rawStats.threePointAttempts > 0 
          ? Math.round((rawStats.threePointMade / rawStats.threePointAttempts) * 1000) / 10 
          : 0;
        break;
      case 'ftPercentage':
        derived[stat.key] = rawStats.ftAttempts > 0 
          ? Math.round((rawStats.ftMade / rawStats.ftAttempts) * 1000) / 10 
          : 0;
        break;
      case 'totalRebounds':
        derived[stat.key] = (rawStats.offensiveRebounds || 0) + (rawStats.defensiveRebounds || 0);
        break;
      case 'assistToTurnoverRatio':
        derived[stat.key] = rawStats.turnovers > 0 
          ? Math.round((rawStats.assists / rawStats.turnovers) * 100) / 100 
          : rawStats.assists;
        break;
        
      // Soccer
      case 'shotAccuracy':
        derived[stat.key] = rawStats.shots > 0 
          ? Math.round((rawStats.shotsOnTarget / rawStats.shots) * 1000) / 10 
          : 0;
        break;
      case 'passAccuracy':
        derived[stat.key] = rawStats.passesAttempted > 0 
          ? Math.round((rawStats.passesCompleted / rawStats.passesAttempted) * 1000) / 10 
          : 0;
        break;
        
      // Baseball
      case 'battingAverage':
        derived[stat.key] = rawStats.atBats > 0 
          ? Math.round((rawStats.hits / rawStats.atBats) * 1000) / 1000 
          : 0;
        break;
      case 'era':
        derived[stat.key] = rawStats.inningsPitched > 0 
          ? Math.round((rawStats.earnedRuns / rawStats.inningsPitched) * 9 * 100) / 100 
          : 0;
        break;
      case 'whip':
        derived[stat.key] = rawStats.inningsPitched > 0 
          ? Math.round(((rawStats.walksAllowed + rawStats.hitsAllowed) / rawStats.inningsPitched) * 100) / 100 
          : 0;
        break;
        
      // Volleyball
      case 'hittingPercentage':
        derived[stat.key] = rawStats.attackAttempts > 0 
          ? Math.round(((rawStats.kills - rawStats.attackErrors) / rawStats.attackAttempts) * 1000) / 10 
          : 0;
        break;
      case 'totalBlocks':
        derived[stat.key] = (rawStats.blockSolos || 0) + (rawStats.blockAssists || 0);
        break;
        
      // Cheer
      case 'stuntSuccessRate':
        derived[stat.key] = rawStats.stuntsAttempted > 0 
          ? Math.round((rawStats.stuntsHit / rawStats.stuntsAttempted) * 1000) / 10 
          : 0;
        break;
    }
  });
  
  return derived;
}

/**
 * Get empty stats object for a sport (all zeros)
 */
export function getEmptyStats(sport: SportType): Record<string, number> {
  const stats: Record<string, number> = {};
  getStatDefinitions(sport).forEach(stat => {
    if (!stat.calculated) {
      stats[stat.key] = 0;
    }
  });
  return stats;
}

/**
 * Format a stat value for display
 */
export function formatStatValue(stat: StatDefinition, value: number): string {
  if (value === undefined || value === null) return '-';
  
  switch (stat.type) {
    case 'percentage':
      return `${value}%`;
    case 'rating':
      return value.toFixed(1);
    case 'time':
      return `${value}`;
    default:
      return value.toString();
  }
}
