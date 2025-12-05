import { Timestamp } from 'firebase/firestore';

export type UserRole = 'Coach' | 'Parent' | 'SuperAdmin';

// --- HELPER INTERFACES ---
export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface MedicalInfo {
  allergies: string;
  conditions: string;
  medications: string;
  bloodType: string;
}

// --- EVENTS (Dashboard Calendar) ---
export interface CalendarEvent {
    id: string;
    title: string;
    date: string;
    time: string;
    type: 'game' | 'practice' | 'event';
    location?: string;
}

// --- EVENTS (Schedule Management) ---
export interface TeamEvent {
  id: string;
  teamId?: string;
  date: string;
  time: string;
  title: string;
  type: 'Practice' | 'Game' | 'Other';
  location: string;
  description: string;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
}



// --- MAIN INTERFACES ---

export interface UserProfile {
  uid: string;
  name: string;
  role: UserRole;
  teamId: string | null; // Primary team (legacy) - still used for single team assignment
  teamIds?: string[]; // Array of team IDs coach belongs to (supports multiple teams)
  email?: string;
  username?: string;
  isRootAdmin?: boolean; // God Mode - only Root Admin can manage other SuperAdmins
  mustChangePassword?: boolean; // Force password change on first login
  
  // Contact Details
  phone?: string;          
  secondaryPhone?: string; 
  address?: string;        
  
  // Emergency
  emergencyContact?: EmergencyContact;
  
  photoUrl?: string;
  photoPath?: string;
  bio?: string; // About me / bio section for coaches and parents
  
  // For Parents: Track currently selected player
  selectedPlayerId?: string;
  
  // For Coaches: Track currently selected team (when coaching multiple teams)
  selectedTeamId?: string;
  
  // Clone Play Credits System
  cloneCredits?: number; // Number of remaining clone credits (default: 10 for new coaches)
  totalClonesUsed?: number; // Total clones ever used (for analytics)
  purchasedCredits?: number; // Credits purchased (for future monetization)
}

export interface Team {
  id: string;
  name: string;
  coachId: string | null;
  headCoachId?: string | null; // Designated head coach who can manage other coaches
  coachIds?: string[]; // All coaches assigned to this team (head + assistants)
  // Coordinator positions (can be same person as head coach or each other)
  offensiveCoordinatorId?: string | null; // OC - runs the offense
  defensiveCoordinatorId?: string | null; // DC - runs the defense
  specialTeamsCoordinatorId?: string | null; // STC - runs special teams
  record?: {
      wins: number;
      losses: number;
      ties: number;
  };
}

// In types.ts

// --- LIVE STREAMING ---
export type CameraAngle = 'Sideline' | 'End Zone' | 'Press Box' | 'Drone' | 'Other';

export interface LiveStream {
  id: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  teamId: string;
  coachId: string;
  coachName: string;
  title: string;
  cameraAngle: CameraAngle | string; // Allow preset or custom
  visibility: 'public' | 'team';
  isLive: boolean;
  startedAt: any; // Timestamp
  endedAt?: any; // Timestamp | null
  // For saving to video library after stream ends
  savedToLibrary?: boolean;
  videoId?: string; // Reference to saved video if applicable
}

export interface Player {
  id: string;
  name: string;
  username?: string; // Unique athlete username for tracking (e.g., @johnny_smith)
  teamId: string; // REQUIRED: Team the player belongs to
  // REMOVED NUMBER/POSITION FROM CORE PARENT INPUT FLOW:
  number?: number; 
  position?: string;
  
  // Bio - parent can add a description about their athlete
  bio?: string;
  
  // NEW: Uniform Sizes
  shirtSize?: string; // e.g. "Youth Large", "Adult M"
  pantSize?: string; // e.g. "Youth Small", "Adult L"
  
  // NEW: Starter & Captain status (Coach-set)
  isStarter?: boolean; // Shows glowing border on roster
  isCaptain?: boolean; // Shows captain crown badge
  height?: string; // Player height (e.g., "4'6"")
  weight?: string; // Player weight (e.g., "85 lbs")
  photoUrl?: string; // Player headshot photo
  photoPath?: string;
  
  // Link to Parent
  parentId?: string; 
  
  // Personal & Medical
  dob?: string;
  medical?: MedicalInfo; 

  // Game Stats
  stats: {
    td: number;
    tkl: number;
  };
}
// Keep all other interfaces intact.

// --- TEAM CHAT ---
export interface Message {
  id: string;
  text: string;
  sender: {
    uid: string;
    name: string;
  };
  timestamp: Timestamp;
}

export interface BulletinPost {
  id: string;
  text: string;
  author: string;
  authorId?: string;
  timestamp: Timestamp;
}

// --- PLAYBOOK ENGINE ---
export interface PlayElement {
  id: string;
  type: 'X' | 'O';
  label: string; 
  x: number; 
  y: number; 
  color: string;
}

// Line types for play designer
// zigzag: zigzag pattern with arrow (motion route)
// curved: smooth curved line with arrow (passing route)
// route: solid line with arrow end
// block: solid line with perpendicular block end (blocking assignment)
// solid: plain solid line, no end marker
// dashed: dashed line, no end marker
export type LineType = 'zigzag' | 'curved' | 'route' | 'block' | 'solid' | 'dashed';

// Standalone drawing line (not attached to a player)
export interface DrawingLine {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  lineType: LineType;
}

// Shape types for play designer annotations
export type ShapeType = 'triangle' | 'circle' | 'square' | 'x' | 'diamond' | 'oval' | 'rectangle' | 'smallCircle';

// Shape for zone/coverage annotations
export interface PlayShape {
  id: string;
  shapeType: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  filled: boolean;
}

export interface PlayRoute {
  id: string;
  startElementId: string;
  points: { x: number; y: number }[];
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  arrow: boolean;
  lineType?: LineType; // Optional: for new line type support
}

// Offensive play type - Run or Pass
export type OffensePlayType = 'Run' | 'Pass';

// Defensive play type - Normal or Blitz
export type DefensePlayType = 'Normal' | 'Blitz';

// Formation - base player positions that plays are built from
// Stored in users/{coachId}/formations
export interface Formation {
  id: string;
  name: string;
  category: 'Offense' | 'Defense' | 'Special Teams';
  elements: PlayElement[]; // Base player positions for this formation
  notes?: string;
  coachId: string;
  coachName?: string;
  systemFormationId?: string; // If imported from system playbook
  isSystemFormation?: boolean; // True if imported from system
  createdAt: any;
  updatedAt?: any;
}

// Coach's personal play (stored in users/{coachId}/plays)
export interface CoachPlay {
  id: string;
  name: string;
  category: 'Offense' | 'Defense' | 'Special Teams';
  offenseType?: OffensePlayType; // Only for Offense plays - Run or Pass
  defenseType?: DefensePlayType; // Only for Defense plays - Normal or Blitz
  formationId: string; // Reference to formation this play is built from
  formationName?: string; // Denormalized for display
  elements: PlayElement[]; // Final player positions (may be moved from formation)
  routes: PlayRoute[]; 
  lines?: DrawingLine[]; // Standalone drawing lines
  shapes?: PlayShape[]; // Zone/coverage shapes
  notes?: string;
  thumbnailUrl?: string;
  systemPlayId?: string; // If imported from system playbook (for auto-sync)
  isSystemPlay?: boolean; // True if imported from system (read-only)
  createdAt: any;
  updatedAt?: any;
  coachId: string; // Owner coach ID
  coachName?: string; // For display
}

// Team play assignment (stored in teams/{teamId}/assignedPlays)
// References a coach's play - auto-syncs when coach updates their play
export interface TeamPlayAssignment {
  id: string; // Assignment ID
  playId: string; // Reference to coach's play ID
  coachId: string; // Which coach's play this references
  category: 'Offense' | 'Defense' | 'Special Teams';
  assignedAt: any;
  assignedBy: string; // Coach UID who assigned it
  assignedByName?: string;
}

// Position player assignment - assigns roster players to play positions
// Stored in teams/{teamId}/assignedPlays/{assignmentId}/positionAssignments/{elementId}
export interface PositionAssignment {
  id: string; // Same as the element ID from the play
  elementLabel: string; // The position label (e.g., "QB", "RB", "WR1")
  primaryPlayerId?: string; // First string player
  primaryPlayerName?: string;
  primaryPlayerNumber?: number;
  secondaryPlayerId?: string; // Second string player (backup)
  secondaryPlayerName?: string;
  secondaryPlayerNumber?: number;
  updatedAt?: any;
  updatedBy?: string;
}

// Legacy interface - still used for backward compatibility
export interface Play {
  id: string;
  name: string;
  category: 'Offense' | 'Defense' | 'Special Teams';
  elements: PlayElement[];
  routes: PlayRoute[]; 
  notes?: string;
  thumbnailUrl?: string;
  createdAt: any;
}

// ============================================
// SYSTEM PLAYBOOKS (Admin-created, shareable)
// ============================================

// System Formation - admin-created formation template
// Stored in systemFormations/{formationId}
export interface SystemFormation {
  id: string;
  name: string;
  category: 'Offense' | 'Defense' | 'Special Teams';
  elements: PlayElement[]; // Base player positions
  notes?: string;
  createdBy: string; // Admin UID
  createdByName?: string;
  createdAt: any;
  updatedAt?: any;
}

// System Play - admin-created play template
// Stored in systemPlays/{playId}
export interface SystemPlay {
  id: string;
  name: string;
  category: 'Offense' | 'Defense' | 'Special Teams';
  offenseType?: OffensePlayType; // Only for Offense plays
  defenseType?: DefensePlayType; // Only for Defense plays
  formationId: string; // Reference to SystemFormation
  formationName?: string; // Denormalized for display
  elements: PlayElement[]; // Final player positions
  routes: PlayRoute[];
  lines?: DrawingLine[]; // Standalone drawing lines
  shapes?: PlayShape[]; // Zone/coverage shapes
  notes?: string;
  createdBy: string; // Admin UID
  createdByName?: string;
  createdAt: any;
  updatedAt?: any;
}

// System Playbook - collection of plays that coaches can import
// Stored in systemPlaybooks/{playbookId}
export interface SystemPlaybook {
  id: string;
  name: string;
  description?: string;
  category: 'Offense' | 'Defense' | 'Special Teams'; // Each playbook is single-category
  playIds: string[]; // References to SystemPlay IDs
  formationIds: string[]; // References to SystemFormation IDs (auto-collected from plays)
  coverImage?: string; // Optional cover image URL
  playCount: number; // Denormalized count
  createdBy: string; // Admin UID
  createdByName?: string;
  createdAt: any;
  updatedAt?: any;
  isPublished: boolean; // Only published playbooks are visible to coaches
}

// Coach's imported playbook reference
// Stored in users/{coachId}/importedPlaybooks/{playbookId}
export interface ImportedPlaybook {
  id: string; // Same as SystemPlaybook ID
  playbookId: string; // Reference to SystemPlaybook
  playbookName: string; // Denormalized
  category: 'Offense' | 'Defense' | 'Special Teams';
  importedAt: any;
  // Track which plays from this playbook the coach has removed from their view
  removedPlayIds?: string[];
}

export interface Marker {
  id: string;
  x: number;
  y: number;
  type: 'X' | 'O';
}

// --- VIDEO ---
export type VideoCategory = 'Game Film' | 'Training' | 'Highlights' | 'Other';

export interface Video {
  id: string;
  title: string;
  url: string;
  youtubeId: string;
  category: VideoCategory;
  // For private player-specific videos
  playerId?: string | null;  // If set, only visible to that player's parent
  playerName?: string | null; // Store name for display
  // For tagging players in Game Film & Highlights (shows on their public profile)
  taggedPlayerIds?: string[]; // Array of player IDs tagged in this video
  // For public visibility on team's public page
  isPublic?: boolean; // If true, show on team's public page (only for team videos, not private player videos)
  // Metadata
  createdAt?: any;
  createdBy?: string;
  description?: string;
}

// Player Film Room entry - stored in player profile for persistence
export interface PlayerFilmEntry {
  id: string; // Unique ID for this entry
  videoId: string; // Original video ID in team's videos collection
  teamId: string; // Team ID where video originated
  title: string;
  youtubeId: string;
  category: VideoCategory;
  description?: string;
  taggedAt: any; // When the player was tagged in this video
  teamName?: string; // Store team name for display
}

// --- PRIVATE MESSAGING ---
export interface PrivateChat {
  id: string;
  participants: string[]; 
  participantData: {      
    [uid: string]: {
      username: string;
      role: string;
    }
  };
  lastMessage: string;
  lastMessageTime: Timestamp;
  updatedAt: any; 
}

export interface PrivateMessage {
  id: string;
  text: string;
  senderId: string;
  timestamp: Timestamp;
  // Read receipts - WhatsApp/Telegram style
  readBy?: string[];    // Array of user IDs who have read this message
  readAt?: { [uid: string]: Timestamp };  // When each user read it
}

export interface Attachment {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  path?: string; // optional storage path for deletion
}

// Allow messages to include optional attachments (images, pdfs, etc.)
export interface PrivateMessageWithAttachments extends PrivateMessage {
  attachments?: Attachment[];
}

// --- GAME STATS ENGINE ---
// Individual game record
export interface Game {
  id: string;
  teamId: string;
  season: number;        // Year (e.g., 2025)
  gameNumber: number;    // Game 1, 2, 3... of the season
  date: string;          // YYYY-MM-DD format
  opponent: string;      // Opponent team name
  isHome: boolean;       // Home or Away game
  teamScore: number;     // Our team's score
  opponentScore: number; // Opponent's score
  result: 'W' | 'L' | 'T'; // Win, Loss, Tie (auto-calculated)
  location?: string;     // Stadium/field name
  notes?: string;        // Game notes
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

// Player stats for a specific game
export interface GamePlayerStats {
  id: string;
  gameId: string;
  playerId: string;
  playerName: string;
  playerNumber: number;
  teamId: string;
  season: number;
  
  // Participation - did the player play in this game?
  played: boolean;
  
  // Offensive Stats
  tds: number;
  rushYards: number;
  rushAttempts: number;
  passYards: number;
  passAttempts: number;
  passCompletions: number;
  rec: number;
  recYards: number;
  
  // Defensive Stats
  tackles: number;
  soloTackles: number;
  assistTackles: number;
  sacks: number;
  int: number;
  intYards: number;
  ff: number;
  fr: number;
  passDefended: number;
  
  // Special Teams
  kickReturnYards: number;
  puntReturnYards: number;
  kickReturnTds: number;
  puntReturnTds: number;
  
  // Sportsmanship
  spts: number;
  
  // Metadata
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
}

// --- ADVANCED STATS ENGINE ---
// Current year stats for a player on a team
export interface PlayerSeasonStats {
  id: string;
  playerId: string;
  playerName: string;
  playerNumber: number;
  teamId: string;
  teamName?: string;
  season: number; // Year (e.g., 2025)
  
  // Offensive Stats
  gp: number;        // Games Played
  tds: number;       // Touchdowns
  rushYards: number; // Rushing Yards
  rushAttempts: number; // Rushing Attempts
  passYards: number; // Passing Yards (for QBs)
  passAttempts: number; // Pass Attempts
  passCompletions: number; // Completions
  rec: number;       // Receptions
  recYards: number;  // Receiving Yards
  
  // Defensive Stats
  tackles: number;   // Total Tackles
  soloTackles: number; // Solo Tackles
  assistTackles: number; // Assisted Tackles
  sacks: number;     // Sacks
  int: number;       // Interceptions
  intYards: number;  // Interception Return Yards
  ff: number;        // Forced Fumbles
  fr: number;        // Fumble Recoveries
  passDefended: number; // Passes Defended/Broken Up
  
  // Special Teams
  kickReturnYards: number;
  puntReturnYards: number;
  kickReturnTds: number;
  puntReturnTds: number;
  
  // Sportsmanship
  spts: number;      // Sportsmanship Points
  
  // Metadata
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
}

// Historical stats stored per player (across all seasons)
export interface PlayerCareerStats {
  id: string;
  playerId: string;
  playerName: string;
  seasons: PlayerSeasonSummary[];
  totalGp: number;
  totalTds: number;
  totalYards: number;
  totalTackles: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface PlayerSeasonSummary {
  season: number;
  teamId: string;
  teamName: string;
  gp: number;
  tds: number;
  rushYards: number;
  passYards: number;
  recYards: number;
  tackles: number;
  sacks: number;
  int: number;
}

// --- COACH FEEDBACK SYSTEM ---
// Public kudos (positive recognition only)
export interface CoachKudos {
  id: string;
  coachId: string;
  parentId: string;
  parentName: string;
  teamId: string;
  teamName: string;
  message?: string; // Optional short thank you message
  createdAt: any;
}

// Private feedback to admins (concerns)
export interface CoachFeedback {
  id: string;
  grievanceNumber: number; // Unique sequential number for tracking
  chatId?: string; // Dedicated chat for this grievance
  coachId: string;
  coachName: string;
  parentId: string;
  parentName: string;
  teamId: string;
  teamName: string;
  category: 'communication' | 'conduct' | 'fairness' | 'safety' | 'other';
  message: string;
  status: 'new' | 'reviewed' | 'resolved';
  adminNotes?: string;
  createdAt: any;
  reviewedAt?: any;
  reviewedBy?: string;
}

// Legacy interface for backward compatibility
export interface PlayerStats {
  id: string;
  playerId: string;
  playerName: string;
  playerNumber: number;
  teamId: string;
  gp: number;
  tds: number;
  yards: number;
  rec: number;
  tackles: number;
  sacks: number;
  int: number;
  ff: number;
  spts: number;
  updatedAt: any;
  updatedBy?: string;
}

// ============================================
// CLONE PLAY FEATURE TYPES
// ============================================

// Response from OpenAI Vision API analysis
export interface ClonePlayAnalysis {
  players: ClonedPlayer[];
  routes: ClonedRoute[];
  shapes: ClonedShape[];
  suggestedCategory: 'Offense' | 'Defense' | 'Special Teams';
  confidence: number; // 0-100 confidence score
  detectedPlayerCount?: number; // Total players detected by AI (before any filtering)
}

// A detected player element from the image
export interface ClonedPlayer {
  id: string;
  x: number; // 0-100 coordinate
  y: number; // 0-100 coordinate
  shape: 'circle' | 'triangle' | 'square' | 'x'; // Detected shape type
  detectedColor?: string; // Color detected in image
  suggestedType?: 'O' | 'X'; // O = offense (circle), X = defense (triangle/x)
  assignedPosition?: string; // User-assigned position (QB, RB, WR, etc.)
  isAssigned: boolean; // Has user assigned a position?
}

// A detected route/arrow from the image
export interface ClonedRoute {
  id: string;
  points: { x: number; y: number }[];
  lineType: 'solid' | 'dashed' | 'curved' | 'zigzag';
  color: string;
  hasArrow: boolean;
}

// A detected shape/zone from the image
export interface ClonedShape {
  id: string;
  shapeType: 'circle' | 'oval' | 'rectangle' | 'square';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

// Clone operation request
export interface ClonePlayRequest {
  imageBase64: string; // Base64 encoded image
  userId: string;
}

// Clone operation response
export interface ClonePlayResponse {
  success: boolean;
  analysis?: ClonePlayAnalysis;
  error?: string;
  creditsRemaining?: number;
}