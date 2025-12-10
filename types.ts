import { Timestamp } from 'firebase/firestore';

export type UserRole = 'Coach' | 'Parent' | 'Fan' | 'SuperAdmin' | 'LeagueOwner' | 'ProgramCommissioner' | 'Referee' | 'Commissioner' | 'Ref' | 'TeamCommissioner' | 'LeagueCommissioner';

// --- RULES & CODE OF CONDUCT ---

export interface RulesDocument {
  content: string;           // The actual rules text (can be markdown)
  title: string;             // e.g., "League Rules", "Team Code of Conduct"
  updatedAt?: Timestamp | Date;
  updatedBy?: string;        // User ID who last edited
  updatedByName?: string;    // Display name of editor
  source?: 'team' | 'league'; // Where the rules originated
  leagueOverride?: boolean;  // True if league overwrote team's own rules
}

// --- LEAGUE & COMMISSIONER SYSTEM ---

export interface League {
  id?: string;
  name: string;
  ownerId: string;           // League Owner user ID
  ownerName?: string;
  sport?: SportType;
  city?: string;
  state?: string;
  region?: string;           // e.g., "North Texas"
  teamIds?: string[];        // Teams currently in league
  pendingRequests?: string[]; // Team IDs requesting to join
  programIds?: string[];     // Programs in this league
  settings?: {
    allowStandingsPublic?: boolean;
    allowStatsPublic?: boolean;
    requireApproval?: boolean; // If false, auto-accept
  };
  // Rules & Code of Conduct
  rules?: RulesDocument;
  codeOfConduct?: RulesDocument;
  status?: 'active' | 'inactive';
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface LeagueSeason {
  id: string;
  leagueId: string;
  name: string;              // e.g., "Fall 2025"
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'upcoming' | 'active' | 'playoffs' | 'completed';
  divisions?: LeagueDivision[];
  createdAt: Timestamp;
}

export interface LeagueDivision {
  id: string;
  name: string;              // e.g., "Division A", "8U", "Varsity"
  teamIds: string[];
}

export interface LeagueSchedule {
  id: string;
  leagueId: string;
  leagueSeasonId: string;
  name: string;              // e.g., "Fall 2025 Regular Season"
  games: LeagueGame[];
  status: 'draft' | 'published';
  createdAt: Timestamp;
  publishedAt?: Timestamp;
}

export interface LeagueGame {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  week?: number;
  scheduledDate: Timestamp;
  scheduledTime: string;
  dateTime?: Timestamp;  // Alternative date field used in some components
  location: string;
  fieldNumber?: string;
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'postponed' | 'cancelled';
  acceptedByHome?: boolean;
  acceptedByAway?: boolean;
  homeAcceptedAt?: Timestamp;
  awayAcceptedAt?: Timestamp;
}

export interface TeamScheduleAcceptance {
  id: string;
  teamId: string;
  leagueScheduleId: string;
  leagueId: string;
  accepted: boolean;
  acceptedAt?: Timestamp;
  acceptedBy?: string;
  autoSyncEnabled: boolean;
}

export interface PlayoffBracket {
  id: string;
  leagueId: string;
  leagueSeasonId: string;
  name: string;
  type: 'single-elimination' | 'double-elimination' | 'round-robin';
  rounds: PlayoffRound[];
  matches?: PlayoffGame[]; // Flat list of all matches (alternative to rounds structure)
  status: 'draft' | 'published' | 'in-progress' | 'completed';
  createdAt: Timestamp;
  publishedAt?: Timestamp;
}

export interface PlayoffRound {
  roundNumber: number;
  name: string;
  games: PlayoffGame[];
}

export interface PlayoffGame {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamSeed?: number;
  awayTeamSeed?: number;
  homeTeamName?: string;
  awayTeamName?: string;
  scheduledDate?: Timestamp;
  scheduledTime?: string;
  location?: string;
  homeScore?: number;
  awayScore?: number;
  winnerId?: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'postponed' | 'forfeit';
  feedsIntoGameId?: string;
  previousGameIds?: string[];
  bracketPosition?: 'winners' | 'losers' | 'finals';
}

export interface Program {
  id?: string;
  name: string;              // e.g., "City of Arlington Youth Sports"
  sport?: SportType;         // Primary sport of the program
  commissionerId: string;
  commissionerName?: string;
  assistantCommissionerIds?: string[];
  city?: string;
  state?: string;
  region?: string;
  teamIds?: string[];
  teamCount?: number;
  status?: 'active' | 'inactive';
  leagueId?: string | null;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface LeagueRequest {
  id: string;
  teamId: string;
  teamName: string;
  leagueId: string;
  programId: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface Grievance {
  id?: string;
  teamId?: string;
  programId: string;
  submittedBy: string;
  submittedByName?: string;
  title: string;
  subject?: string;
  description: string;
  type: 'player_eligibility' | 'coach_conduct' | 'parent_conduct' | 'rule_violation' | 'safety_concern' | 'schedule_dispute' | 'other';
  status: 'submitted' | 'under_review' | 'resolved' | 'dismissed' | 'pending' | 'reviewed' | 'escalated';
  assignedTo?: string;
  escalatedToAdmin?: boolean;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  resolvedAt?: Timestamp | Date;
  resolvedBy?: string;
  resolution?: string;
}

// --- REFEREE INFRACTION SYSTEM ---

export type InfractionSeverity = 'minor' | 'moderate' | 'major' | 'severe';
export type InfractionCategory = 'unsportsmanlike' | 'rule_violation' | 'safety' | 'eligibility' | 'equipment' | 'administrative' | 'other';
export type InfractionStatus = 'submitted' | 'under_review' | 'resolved' | 'dismissed' | 'appealed';

// Infraction - rule violations reported by referees
export interface Infraction {
  id: string;
  teamId: string;
  teamName?: string;
  leagueId: string;
  leagueName?: string;
  playerName?: string;  // For quick search/display (denormalized)
  
  // Reporter (Referee)
  reportedBy: string;           // Referee user ID
  reportedByName?: string;
  
  // Game context
  gameId?: string;              // If associated with a specific game
  gameDate?: Timestamp | Date;
  opponent?: string;            // Opponent team name if applicable
  
  // Infraction details
  severity: InfractionSeverity;
  category: InfractionCategory;
  title: string;
  description: string;
  
  // People involved
  involvedPlayers?: {
    playerId: string;
    playerName: string;
    number?: number;
  }[];
  involvedCoaches?: {
    coachId: string;
    coachName: string;
  }[];
  involvedParents?: string[];   // Parent names (may not have IDs)
  
  // Status & resolution
  status: InfractionStatus;
  assignedTo?: string;          // Commissioner handling the case
  
  // Consequences (set by league commissioner)
  consequence?: {
    type: 'warning' | 'suspension' | 'fine' | 'probation' | 'expulsion';
    details: string;
    duration?: string;          // e.g., "2 games", "remainder of season"
    fineAmount?: number;
  };
  
  // Appeal info
  appealedAt?: Timestamp | Date;
  appealReason?: string;
  appealDecision?: 'upheld' | 'overturned' | 'modified';
  appealDecisionDetails?: string;
  
  // Chat thread for 3-way communication
  chatThreadId?: string;
  
  // Timestamps
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  resolvedAt?: Timestamp | Date;
  resolvedBy?: string;
  resolution?: string;  // Resolution summary/notes
}

export interface InfractionThread {
  id: string;
  infractionId: string;
  
  // Participants (4-way: League, Referee, Team Director/Commissioner, Head Coach)
  participants: {
    leagueId: string;
    leagueRepId?: string;       // Commissioner handling it
    leagueRepName?: string;
    refereeId: string;
    refereeName?: string;
    teamDirectorId?: string;    // Program commissioner (if team is in a program)
    teamDirectorName?: string;
    headCoachId?: string;       // Team head coach
    headCoachName?: string;
    teamId: string;
  };
  
  // Thread metadata
  status: 'active' | 'closed';
  createdAt: Timestamp | Date;
  lastMessageAt?: Timestamp | Date;
  unreadByLeague?: number;
  unreadByReferee?: number;
  unreadByTeam?: number;
  unreadByHeadCoach?: number;
}

export interface InfractionMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: 'league' | 'referee' | 'team' | 'headcoach';
  content: string;
  attachments?: {
    url: string;
    name: string;
    type: string;
  }[];
  createdAt: Timestamp | Date;
  readBy?: string[];            // User IDs who have read this
}

export interface TeamGame {
  id: string;
  teamId: string;
  source: 'league' | 'commissioner' | 'coach';
  leagueGameId?: string;
  leagueScheduleId?: string;
  opponent: string;
  opponentTeamId?: string;
  isHome: boolean;
  scheduledDate: Timestamp;
  scheduledTime: string;
  dateTime?: Timestamp;  // Alternative date field used in some components
  location: string;
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'completed' | 'cancelled' | 'postponed';
  createdAt: Timestamp;
  createdBy: string;
}

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
  
  // --- UNIFIED CREDITS SYSTEM ---
  credits?: number;                    // Current credit balance
  lifetimeCreditsEarned?: number;      // Total credits ever earned
  lifetimeCreditsSpent?: number;       // Total credits ever spent  
  lifetimeCreditsGifted?: number;      // Total credits gifted to others
  lifetimeCreditsReceived?: number;    // Total credits received as gifts
  featureUsage?: Record<string, {      // Track usage per feature
    totalUses: number;
    freeUsesRemaining: number;
    lastUsedAt?: Timestamp;
    lastFreeResetAt?: Timestamp;
  }>;
  pilotProgramId?: string;             // Active pilot program
  pilotExpiresAt?: Timestamp;          // When pilot access expires
  lastCreditTransactionAt?: Timestamp; // Last credit activity
  
  // --- FAN-SPECIFIC FIELDS ---
  followedAthletes?: string[]; // Array of athlete usernames the fan follows
  followedCoaches?: string[]; // Array of coach user IDs the user follows
  kudosGiven?: { [athleteUsername: string]: number }; // Kudos given to each athlete
  isBanned?: boolean; // If fan is banned from all interactions
  banReason?: string;
  bannedAt?: Timestamp;
  favoriteTeams?: string[]; // Team IDs the fan follows
  followerCount?: number; // Number of followers (for coaches/athletes)
  
  // --- COMMISSIONER & LEAGUE OWNER FIELDS ---
  commissionerType?: 'league' | 'team'; // Type of commissioner - league manages leagues, team manages teams
  programId?: string;                  // If ProgramCommissioner - which program they manage
  leagueId?: string;                   // If LeagueOwner - which league they own
  commissionerSince?: Timestamp;       // When they became commissioner/league owner
  isAssistantCommissioner?: boolean;   // For assistant commissioner role
  assistantForProgramId?: string;      // Which program they assist
}

// --- SEASON MANAGEMENT ---
export type SeasonStatus = 'draft' | 'registration' | 'active' | 'completed';

export interface Season {
  id: string;
  teamId: string;
  name: string; // e.g., "Fall 2025", "Spring League 2026"
  sport: SportType;
  year: number; // e.g., 2025
  status: SeasonStatus;
  
  // Season dates (no end date - coach ends manually when playoffs done)
  startDate: string; // Season start date (YYYY-MM-DD)
  
  // Registration settings
  registrationOpenDate: string; // When parents can start registering
  registrationCloseDate: string; // Registration deadline
  registrationFee: number; // Fee in cents (0 = free)
  maxRosterSize?: number; // Optional roster limit
  
  // What's included description (uniform, equipment, etc.)
  description: string; // What comes with registration
  includedItems?: string[]; // List of included items (e.g., ["Jersey", "Helmet", "Practice shorts"])
  
  // Registration form customization
  requireMedicalInfo?: boolean;
  requireEmergencyContact?: boolean;
  requireUniformSizes?: boolean;
  customFields?: SeasonCustomField[];
  
  // Waiver/consent
  waiverText?: string; // Custom waiver text
  requireWaiver?: boolean;
  
  // Payment method options - which payment methods are enabled
  allowPayInFull?: boolean; // Pay full amount upfront (default true)
  allowPaymentPlan?: boolean; // Pay over time / installments
  allowInPersonPayment?: boolean; // Pay in person (cash/check at practice)
  
  // Flyer - created later in Design Studio
  flyerId?: string; // Reference to designed flyer
  flyerUrl?: string; // URL to flyer image
  
  // Registration event link
  registrationEventId?: string; // Link to events collection for the registration event
  
  // Stats
  playerCount: number; // Current registered players
  gamesPlayed: number; // Games played this season
  
  // Metadata
  createdAt: any;
  createdBy: string;
  updatedAt?: any;
  endedAt?: any; // When season was ended (manual)
  endedBy?: string;
}

export interface SeasonCustomField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'checkbox';
  required: boolean;
  options?: string[]; // For select type
}

// Player registration for a season
export interface SeasonRegistration {
  id: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  parentId: string;
  parentName: string;
  parentEmail?: string;
  
  // Registration status
  status: 'pending' | 'approved' | 'waitlist' | 'rejected';
  
  // Payment
  feePaid: boolean;
  feeAmount: number;
  paymentId?: string; // Reference to payment transaction
  paidAt?: any;
  
  // Payment Plan fields
  isPaymentPlan?: boolean;             // True if using payment plan
  totalPaid?: number;                  // Amount paid so far (cents)
  remainingBalance?: number;           // Amount still owed (cents)
  paymentHistory?: {                   // History of all payments
    id: string;
    amount: number;
    paidAt: any;
    method: string;
    note?: string;
    recordedBy: string;
  }[];
  lastPaymentAt?: any;                 // When last payment was made
  lastPaymentReminderAt?: any;         // When last reminder was sent
  
  // Waiver
  waiverSigned: boolean;
  waiverSignedAt?: any;
  waiverSignedBy?: string; // Parent name who signed
  
  // Custom field responses
  customFieldResponses?: { [fieldId: string]: string | boolean };
  
  // Metadata
  registeredAt: any;
  approvedAt?: any;
  approvedBy?: string;
}

// Sport Types - expandable for future sports
export type SportType = 'football' | 'basketball' | 'soccer' | 'baseball' | 'cheer' | 'volleyball' | 'other';

// Standard age groups for youth sports
export const AGE_GROUPS = [
  // Youth (age-based)
  '5U', '6U', '7U', '8U', '9U', '10U', '11U', '12U',
  // Middle/High School (grade-based)
  '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade',
  // College (year-based)
  'Freshman', 'Sophomore', 'Junior', 'Senior',
  // Adult Leagues
  'Open', 'Adult', 'Masters', 'Seniors', 'Golden'
] as const;

export type AgeGroup = typeof AGE_GROUPS[number];

export interface Team {
  id: string;
  name: string;
  sport?: SportType; // Sport type for multi-sport support (default: 'football')
  ageGroup?: string; // Primary age group for the team (e.g., "8U", "10U", "12U")
  ageGroups?: string[]; // For multi-grade teams (e.g., ["8U", "9U"])
  ageGroupType?: 'single' | 'multi'; // Whether team spans multiple age groups
  seasonYear?: number; // Season year (e.g., 2025)
  color?: string; // Team color for display (backward compatible - same as primaryColor)
  primaryColor?: string; // Primary team color (hex, e.g., "#f97316")
  secondaryColor?: string; // Secondary team color (hex, e.g., "#1e293b")
  isCheerTeam?: boolean; // Whether this is a cheer team
  coachId: string | null;
  headCoachId?: string | null; // Designated head coach who can manage other coaches
  coachIds?: string[]; // All coaches assigned to this team (head + assistants)
  // Coordinator positions (can be same person as head coach or each other)
  offensiveCoordinatorId?: string | null; // OC - runs the offense
  defensiveCoordinatorId?: string | null; // DC - runs the defense
  specialTeamsCoordinatorId?: string | null; // STC - runs special teams
  
  // Season management
  currentSeasonId?: string | null; // Currently active season
  
  record?: {
      wins: number;
      losses: number;
      ties: number;
  };
  
  // Team Location (required for state-specific waivers)
  location?: {
    address?: string;
    city?: string;
    state?: string;             // Required for waiver generation (e.g., "CA", "TX")
    zip?: string;
    country?: string;           // Default: "USA"
  };
  // Legacy/fallback location fields (prefer location.city/location.state)
  city?: string;
  state?: string;
  
  // --- LEAGUE & PROGRAM FIELDS ---
  programId?: string;                   // Which program owns this team
  leagueId?: string;                    // Which league (if any)
  linkedCheerTeamId?: string;           // For sports teams - linked cheer team
  linkedToTeamId?: string;              // For cheer teams - which team they cheer for
  linkedToTeamName?: string;            // Display name "Cheerleader for Tigers34"
  leagueStatus?: 'none' | 'pending' | 'active' | 'left' | 'kicked';
  leagueJoinedAt?: Timestamp;
  leagueLeftAt?: Timestamp;
  leagueLeftReason?: string;
  divisionId?: string;                  // Which division in the league
  maxRosterSize?: number;               // Commissioner can set max players
  
  // --- RULES & CODE OF CONDUCT ---
  rules?: RulesDocument;                // Team rules (or league rules if in league)
  codeOfConduct?: RulesDocument;        // Team code of conduct (or league's if in league)
  teamOnlyRules?: RulesDocument;        // Supplemental team-only rules (never overridden by league)
  teamOnlyCodeOfConduct?: RulesDocument; // Supplemental team-only code of conduct (never overridden)
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
  jerseyNumber?: number; // Alias for number
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
  
  // --- FAN ENGAGEMENT (stored on player document) ---
  followerCount?: number; // Denormalized count for quick display
  kudosCount?: number; // Total kudos received
}

// --- ATHLETE FOLLOWER (stored in subcollection: teams/{teamId}/players/{playerId}/followers/{fanId}) ---
export interface AthleteFollower {
  oddsId: string; // Fan's user ID
  fanName: string;
  fanUsername: string;
  fanPhotoUrl?: string;
  followedAt: Timestamp;
  isVerified?: boolean; // Verified fan (attended games, etc.)
}

// --- ATHLETE KUDOS (stored in subcollection: teams/{teamId}/players/{playerId}/kudos/{kudosId}) ---
export type KudosCategory = 'great_play' | 'teamwork' | 'sportsmanship' | 'improvement' | 'leadership' | 'hustle';

export interface AthleteKudos {
  id: string;
  fanId: string;
  fanName: string;
  fanUsername?: string;
  category: KudosCategory;
  amount: number; // Kudos points given (1-5)
  message?: string; // Optional message with kudos
  createdAt: any;
}

export interface KudosCategoryInfo {
  id: KudosCategory;
  label: string;
  emoji: string;
  description: string;
}

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
export type VideoCategory = 'Game Film' | 'Practice' | 'Training' | 'Highlights' | 'Other';

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
  // For live stream videos
  isLive?: boolean;
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
  taggedBy?: string; // User ID who tagged this player
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

// --- PUBLIC CHAT (Fan Feature) ---
export interface PublicChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderRole: 'Fan' | 'Parent' | 'Athlete'; // Who sent the message
  senderPhotoUrl?: string;
  timestamp: any; // Timestamp
  // For "Chat As Athlete" feature - parent chatting as their child
  isAthletePost?: boolean;
  athleteId?: string;
  athleteName?: string;
  // Moderation
  isDeleted?: boolean;
  deletedBy?: string;
  deletedAt?: any;
  // Reply support
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
  // Reactions/likes
  likes?: string[]; // array of userIds who liked
  likeCount?: number;
}

export interface PublicChatSettings {
  chatEnabled: boolean;
  allowFanChat: boolean;
  requireApproval: boolean; // If true, fan messages need approval (we're NOT using this per user request)
  slowModeSeconds: number; // 0 = no slow mode, >0 = seconds between messages
  bannedWords?: string[];
}

export interface PublicChatMutedUser {
  oduserId: string;
  odusername: string;
  mutedBy: string;
  mutedByName: string;
  mutedAt: any; // Timestamp
  reason?: string;
  expiresAt?: any; // Timestamp, null = permanent
}

// --- ATHLETE POSTS (Fan Feature Phase 3) ---
export interface AthletePost {
  id: string;
  // Content
  text: string;
  imageUrl?: string;
  imagePath?: string; // For deletion
  videoUrl?: string;
  // Author info
  authorId: string; // Parent's user ID
  authorName: string;
  athleteId: string; // The athlete this post is for
  athleteName: string;
  athletePhotoUrl?: string;
  // Metadata
  createdAt: any; // Timestamp
  updatedAt?: any;
  // Engagement
  likes: string[]; // Array of user IDs who liked
  likeCount: number;
  commentCount: number;
  // Visibility
  isPinned?: boolean;
  isHidden?: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  text: string;
  // Author
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorRole: 'Fan' | 'Parent' | 'Athlete';
  authorPhotoUrl?: string;
  // For athlete comments
  isAthleteComment?: boolean;
  athleteId?: string;
  athleteName?: string;
  // Metadata
  createdAt: any; // Timestamp
  // Engagement
  likes: string[];
  likeCount: number;
  // Moderation
  isDeleted?: boolean;
  deletedBy?: string;
}

// --- FAN CLIPS (stored in: teams/{teamId}/players/{playerId}/fanClips/{clipId}) ---
export interface FanClip {
  id: string;
  // Source video info
  sourceVideoId: string;
  sourceVideoTitle: string;
  sourceTeamId: string;
  sourceTeamName: string;
  youtubeId: string;
  // Clip timing (in seconds)
  startTime: number;
  endTime: number;
  // Clip details
  title: string;
  description?: string;
  // Creator info
  creatorId: string;
  creatorName: string;
  creatorUsername?: string;
  // Target athlete
  athleteId: string;
  athleteName: string;
  // Metadata
  createdAt: any;
  // Engagement
  likes: string[];
  likeCount: number;
  viewCount: number;
  // Moderation
  isApproved?: boolean; // Parent can approve/reject
  isHidden?: boolean;
  rejectionReason?: string;
}

// --- COACH PUBLIC PROFILE TYPES ---

// Coach follower (stored in users/{coachId}/followers/{followerId})
export interface CoachFollower {
  oddsId: string; // Follower's user ID
  followerName: string;
  followerUsername: string;
  followerPhotoUrl?: string;
  followerRole: 'Fan' | 'Parent' | 'Coach';
  followedAt: Timestamp;
}

// Coach public chat message (stored in users/{coachId}/publicChatMessages/{messageId})
export interface CoachChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderUsername?: string;
  senderRole: string;
  senderPhotoUrl?: string;
  timestamp: any;
  // Moderation
  isDeleted?: boolean;
  // Reply
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
  // Engagement
  likes?: string[];
  likeCount?: number;
  // Coach's own post
  isCoachPost?: boolean;
}

// Coach public chat settings (stored in users/{coachId}/config/chatSettings)
export interface CoachChatSettings {
  chatEnabled: boolean;
  allowPublicChat: boolean;
  slowModeSeconds: number;
  welcomeMessage?: string;
}

// Coach announcement (stored in users/{coachId}/announcements/{announcementId})
export interface CoachAnnouncement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: any;
  updatedAt?: any;
  isPinned?: boolean;
  // Engagement
  likes: string[];
  likeCount: number;
  commentCount: number;
  // Visibility
  isPublic: boolean; // Show on public profile
  targetAudience?: 'all' | 'parents' | 'coaches' | 'fans';
}

// Coach muted user (stored in users/{coachId}/mutedUsers/{oduserId})
export interface CoachMutedUser {
  oduserId: string;
  odusername: string;
  mutedBy: string;
  mutedByName: string;
  mutedAt: any;
  reason?: string;
  expiresAt?: any;
}