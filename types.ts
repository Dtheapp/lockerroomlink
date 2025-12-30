import { Timestamp } from 'firebase/firestore';

export type UserRole = 'Coach' | 'Parent' | 'Fan' | 'SuperAdmin' | 'LeagueOwner' | 'ProgramCommissioner' | 'Referee' | 'Commissioner' | 'Ref' | 'TeamCommissioner' | 'LeagueCommissioner' | 'Athlete';

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

// League-owned field for scheduling
export interface LeagueField {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  notes?: string;
  timeSlots?: string[];      // e.g., ["9:00 AM", "11:00 AM", "1:00 PM"]
  maxGamesPerDay?: number;
}

// Schedule settings for a league
export interface LeagueScheduleSettings {
  fieldMode: 'team-home' | 'league-central' | 'mixed';
  defaultGameDays: string[];   // ['Saturday', 'Sunday']
  defaultTimeSlots: string[];  // ['9:00 AM', '11:00 AM']
  gameDuration?: number;       // Minutes per game
}

export interface League {
  id?: string;
  name: string;
  ownerId: string;           // League Owner user ID
  ownerName?: string;
  sport?: SportType;
  city?: string;
  state?: string;
  region?: string;           // e.g., "North Texas"
  zipcode?: string;          // ZIP code for location
  username?: string;         // Unique username for pretty URLs (e.g., "united-legacy")
  logoUrl?: string;          // League logo image URL
  description?: string;      // League description
  contactName?: string;      // Contact person name
  contactEmail?: string;     // Contact email
  contactPhone?: string;     // Contact phone
  website?: string;          // League website
  teamIds?: string[];        // Teams currently in league
  pendingRequests?: string[]; // Team IDs requesting to join
  programIds?: string[];     // Programs in this league
  ageGroups?: string[];      // Configured age groups (e.g., "6U", "8U", "10U-12U")
  // League-managed fields for scheduling
  fields?: LeagueField[];
  scheduleSettings?: LeagueScheduleSettings;
  settings?: {
    allowStandingsPublic?: boolean;
    allowStatsPublic?: boolean;
    requireApproval?: boolean; // If false, auto-accept
  };
  // Rules & Code of Conduct
  rules?: RulesDocument;
  codeOfConduct?: RulesDocument;
  status?: 'active' | 'inactive';
  publicProfile?: boolean;   // Whether league page is publicly viewable
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

// Program finalization status for league seasons
export interface ProgramFinalization {
  finalized: boolean;
  finalizedAt?: Timestamp | Date;
  finalizedBy?: string;
  finalizedByName?: string;
  teamCount: number;
  teamIds: string[];
  programName?: string;
}

export interface LeagueSeason {
  id: string;
  leagueId: string;
  name: string;              // e.g., "Fall 2025"
  startDate: Timestamp;
  endDate: Timestamp;
  registrationDeadline?: Timestamp;  // Optional team registration deadline
  ageGroups?: string[];      // Age groups included in this season
  status: 'upcoming' | 'active' | 'playoffs' | 'completed';
  divisions?: LeagueDivision[];
  // Program finalization tracking
  programFinalizations?: { [programId: string]: ProgramFinalization };
  allProgramsFinalized?: boolean;  // Quick check flag
  createdAt: Timestamp;
  updatedAt?: Timestamp;
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
  homeProgramId?: string;
  awayProgramId?: string;
  ageGroup?: string;
  week?: number;
  scheduledDate: Timestamp;
  scheduledTime: string;
  dateTime?: Timestamp;  // Alternative date field used in some components
  location: string;
  locationSource?: 'team-home' | 'league-field' | 'manual';
  originalLocation?: string;  // Before any edits
  locationEdited?: boolean;   // True if manually changed
  fieldId?: string;           // If using a league field
  fieldNumber?: string;
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'postponed' | 'cancelled';
  acceptedByHome?: boolean;
  acceptedByAway?: boolean;
  homeAcceptedAt?: Timestamp;
  awayAcceptedAt?: Timestamp;
  isBye?: boolean;            // True if this is a bye week placeholder
  byeTeamId?: string;         // Team that has the bye
  byeTeamName?: string;
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
  name: string;              // e.g., "CYFL Tigers", "Arlington Youth Sports"
  
  // Per-sport program names (e.g., CYFA for football, CYBA for basketball)
  sportNames?: { [sport: string]: string };  // { football: 'CYFA', basketball: 'CYBA' }
  
  // Sports offered by this program (multi-sport support)
  sports?: SportType[];              // ["football", "basketball", "cheer"]
  sport?: SportType;                 // Legacy: Primary sport (for backward compat)
  
  // Age group configurations per sport
  sportConfigs?: SportAgeGroupConfig[];  // Detailed config per sport
  
  // Organization
  commissionerId: string;
  commissionerName?: string;
  assistantCommissionerIds?: string[];
  
  // Location
  city?: string;
  state?: string;
  region?: string;
  
  // Teams (dynamically created from pools)
  teamIds?: string[];
  teamCount?: number;
  
  // Seasons
  currentSeasonId?: string;          // Active season
  seasonIds?: string[];              // All seasons
  
  // Status
  status?: 'active' | 'inactive';
  leagueId?: string | null;
  
  // Branding
  primaryColor?: string;             // Hex color
  secondaryColor?: string;
  logoUrl?: string;
  
  // Metadata
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

// --- GAME REQUEST SYSTEM ---
// Used when scheduling games with teams from other programs
export type GameRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

export interface GameRequest {
  id?: string;
  status: GameRequestStatus;
  
  // Reference to the game in the program's schedule
  programId: string;              // Program that created the game
  seasonId: string;               // Season this game belongs to
  gameId: string;                 // Reference to programs/{programId}/seasons/{seasonId}/games/{gameId}
  
  // Game details (denormalized for notifications)
  week: number;
  gameDate: string;               // YYYY-MM-DD
  time: string;                   // HH:mm
  location?: string;
  
  // Requesting team (typically home team)
  homeTeamId: string;
  homeTeamName: string;
  homeProgramId: string;
  homeProgramName?: string;
  
  // Requested team (away team)
  awayTeamId: string;
  awayTeamName: string;
  awayProgramId: string;
  awayProgramName?: string;
  
  // Request sender
  requestedBy: string;            // User ID
  requestedByName?: string;
  
  // Response
  respondedBy?: string;           // User ID who accepted/declined
  respondedByName?: string;
  respondedAt?: Timestamp | Date;
  declineReason?: string;
  
  // Metadata
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  expiresAt?: Timestamp | Date;   // Optional auto-expire
}

// --- VENUE SYSTEM (PREP) ---
export interface Venue {
  id?: string;
  name: string;                   // "Central Park Fields"
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  
  // Fields/Courts at this venue
  fields?: VenueField[];
  
  // Ownership
  programId?: string;             // If owned by a program
  createdBy?: string;             // User who created it
  isPublic?: boolean;             // Can other programs use this venue?
  
  // Metadata
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface VenueField {
  id: string;
  name: string;                   // "Field 1", "Main Field", "Court A"
  type?: 'football' | 'soccer' | 'baseball' | 'basketball' | 'multipurpose';
  capacity?: number;
  hasLights?: boolean;
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
  source: 'league' | 'commissioner' | 'coach' | 'program';
  
  // Program game reference (single source of truth)
  programId?: string;
  seasonId?: string;
  programGameId?: string;
  
  // Legacy league references
  leagueGameId?: string;
  leagueScheduleId?: string;
  
  // Game details
  opponent: string;
  opponentTeamId?: string;
  opponentProgramId?: string;       // If opponent is a system team
  opponentIsExternal?: boolean;     // True if opponent is not in system
  isHome: boolean;
  week?: number;
  scheduledDate: Timestamp | Date | string;
  scheduledTime: string;
  dateTime?: Timestamp;  // Alternative date field used in some components
  location: string;
  
  // Venue reference (for future venue system)
  venueId?: string;
  venueName?: string;
  fieldNumber?: string;
  
  // Game Request (for cross-program games)
  gameRequestId?: string;
  gameRequestStatus?: GameRequestStatus;
  confirmedAt?: Timestamp | Date;
  
  // Scores
  homeScore?: number;
  awayScore?: number;
  
  // Quarter Scores (for detailed box scores)
  homeQ1?: number;
  homeQ2?: number;
  homeQ3?: number;
  homeQ4?: number;
  homeOT?: number;
  awayQ1?: number;
  awayQ2?: number;
  awayQ3?: number;
  awayQ4?: number;
  awayOT?: number;
  currentQuarter?: 1 | 2 | 3 | 4 | 5; // 5 = OT
  
  // Team info (for program games)
  homeTeamId?: string;
  homeTeamName?: string;
  awayTeamId?: string;
  awayTeamName?: string;
  
  // Status
  status: 'scheduled' | 'live' | 'completed' | 'cancelled' | 'postponed';
  
  // Stats (for program games)
  stats?: {
    homeTeam?: any;
    awayTeam?: any;
    players?: Record<string, any>;
  };
  
  // Timestamps
  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
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
  
  // --- ATHLETE-SPECIFIC FIELDS ---
  isIndependentAthlete?: boolean;      // True if signed up directly (18+) or released from parent
  dob?: string;                        // Date of birth for athletes
  
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
  teamsCreated?: number;               // Lifetime teams created (for first-team-free tracking)
  
  // --- TEAM MANAGER SUB-ACCOUNT FIELDS ---
  isTeamManager?: boolean;             // True if this is a pseudo-profile for a team manager
  managerId?: string;                  // The team manager document ID
  commissionerId?: string;             // The commissioner who created this manager
  
  // --- ORGANIZATION INFO (for commissioners) ---
  orgName?: string;                    // Organization/Program name (saved to profile)
  orgZipcode?: string;                 // Organization zipcode
  orgCity?: string;                    // Organization city
  orgState?: string;                   // Organization state
  primaryColor?: string;               // Organization primary color
  secondaryColor?: string;             // Organization secondary color
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
  publicEventId?: string; // Link to top-level events collection for public discovery
  
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

// =============================================================================
// DRAFT POOL SYSTEM - Waitlist for team registration
// =============================================================================

export type DraftPoolPaymentStatus = 'paid_full' | 'paid_partial' | 'pay_in_person' | 'pending';

export interface DraftPoolEntry {
  id: string;
  
  // Player info
  playerId?: string;              // If existing player in system
  playerName: string;
  playerUsername?: string;        // Athlete username for public profile link
  playerAge?: number;
  playerDob?: string;             // Date of birth (YYYY-MM-DD)
  
  // Contact info (for independent athletes OR parent info)
  contactName: string;            // Parent name or athlete's own name if 18+
  contactEmail: string;
  contactPhone?: string;
  
  // Registration source
  registeredByUserId: string;     // Who registered (parent or athlete themselves)
  registeredByName: string;
  isIndependentAthlete: boolean;  // True if athlete registered themselves (18+)
  
  // Team/Program targeting
  teamId?: string;                // Specific team if known
  programId?: string;             // Commissioner's program
  ownerId: string;                // Team/Program owner (commissioner) who manages this pool
  sport: SportType;
  ageGroup: string;               // Target age group
  
  // Payment status (visible to coach/commissioner only)
  paymentStatus: DraftPoolPaymentStatus;
  amountPaid: number;             // Amount paid in cents
  totalAmount: number;            // Total registration fee in cents
  remainingBalance: number;       // What's left to pay (cents)
  paymentMethod?: 'paypal' | 'cash' | 'check' | 'other';
  paymentNotes?: string;          // Notes about payment (e.g., "Will pay at first practice")
  
  // Registration details
  seasonId?: string;              // If registering for a specific season
  registrationId?: string;        // Link to full registration record
  
  // Waiver
  waiverSigned: boolean;
  waiverSignedAt?: any;
  waiverSignedBy?: string;
  
  // Emergency contact (required for youth)
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  
  // Medical info (optional)
  medicalInfo?: {
    allergies?: string;
    medications?: string;
    conditions?: string;
    insuranceProvider?: string;
    insurancePolicyNumber?: string;
  };
  
  // Uniform sizes (if collected during registration)
  uniformSizes?: {
    jersey?: string;
    shorts?: string;
    helmet?: string;
  };
  
  // Draft status
  status: 'waiting' | 'drafted' | 'declined' | 'expired';
  draftedAt?: any;
  draftedBy?: string;             // Coach/Commissioner who drafted
  draftedToTeamId?: string;       // Team they were drafted to
  draftedToTeamName?: string;
  declinedReason?: string;
  
  // Auto-draft eligibility (for single-team age groups)
  eligibleForAutoDraft: boolean;  // True if only 1 team in this sport/age group
  
  // Position/preferences
  preferredPositions?: string[];
  notes?: string;                 // Parent/athlete notes
  
  // Timestamps
  createdAt: any;
  updatedAt?: any;
  expiresAt?: any;                // Optional expiration
}

// Summary view for draft pool display
export interface DraftPoolSummary {
  total: number;
  paidFull: number;
  paidPartial: number;
  payInPerson: number;
  pending: number;
}

// Sport Types - expandable for future sports
export type SportType = 'football' | 'basketball' | 'soccer' | 'baseball' | 'cheer' | 'volleyball' | 'other';

// =============================================================================
// PROGRAM SEASON & REGISTRATION POOL SYSTEM
// =============================================================================

/**
 * Age Group Configuration for a Sport within a Program
 * Defines how players are grouped for team formation
 */
export interface SportAgeGroupConfig {
  sport: SportType;
  ageGroups: AgeGroupDivision[];       // List of age divisions for this sport
}

/**
 * An age division within a sport
 * Can be single (10U) or combined (8U-9U)
 */
export interface AgeGroupDivision {
  id: string;                          // Unique ID: "8u-9u" or "10u"
  label: string;                       // Display: "8U-9U" or "10U"
  ageGroups: string[];                 // ["8U", "9U"] or ["10U"]
  type: 'single' | 'combined';         // Whether this is a combined division
  minBirthYear: number;                // e.g., 2016 (for 9U in 2025)
  maxBirthYear: number;                // e.g., 2018 (for 8U in 2025)
}

/**
 * Program Season - Created by Commissioner
 * This is the master season that contains registration pools for all sports/age groups
 */
export interface ProgramSeason {
  id: string;
  programId: string;
  programName: string;
  
  // Season info
  name: string;                        // "2025 Spring", "Fall 2025"
  year: number;                        // 2025
  status: 'setup' | 'registration_open' | 'registration_closed' | 'teams_forming' | 'active' | 'completed';
  
  // Registration dates
  registrationOpenDate: string;        // YYYY-MM-DD
  registrationCloseDate: string;       // YYYY-MM-DD
  
  // Season dates
  seasonStartDate?: string;            // YYYY-MM-DD - When the season actually starts
  seasonEndDate?: string;              // YYYY-MM-DD - When the season ends
  
  // Sports & Age Groups offered this season
  sportsOffered: SportAgeGroupConfig[];
  
  // Registration settings (apply to all pools in this season)
  registrationFee: number;             // Default fee in cents (can be overridden per sport/age)
  requireMedicalInfo: boolean;
  requireEmergencyContact: boolean;
  requireUniformSizes: boolean;
  requireWaiver: boolean;
  waiverText?: string;
  
  // Payment options
  allowPayInFull: boolean;
  allowPaymentPlan: boolean;
  allowInPersonPayment: boolean;
  
  // Counts (aggregated from all pools)
  totalRegistrations: number;
  totalPools: number;
  poolsReadyForDraft: number;
  
  // Schedule status
  scheduleBuilt?: boolean;             // True after first schedule save
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

/**
 * Registration Pool - Auto-created per Sport + Age Group Division
 * Collection: programs/{programId}/seasons/{seasonId}/pools/{poolId}
 * poolId format: "football_8u-9u" or "basketball_10u"
 */
export interface RegistrationPool {
  id: string;
  programId: string;
  programName: string;
  seasonId: string;
  seasonName: string;
  
  // Sport & Age Configuration
  sport: SportType;
  ageGroupDivisionId: string;          // Reference to AgeGroupDivision.id
  ageGroups: string[];                 // ["8U", "9U"] for combined, ["10U"] for single
  ageGroupLabel: string;               // Display: "8U-9U" or "10U"
  ageGroupType: 'single' | 'combined';
  minBirthYear: number;
  maxBirthYear: number;
  
  // Pool Status
  status: 'open' | 'closed' | 'teams_created' | 'draft_scheduled' | 'draft_complete' | 'assigned';
  
  // Player counts
  playerCount: number;
  
  // Team sizing recommendations
  minPlayersPerTeam: number;           // Based on sport (11 for football, 5 for basketball)
  maxPlayersPerTeam: number;           // Max roster size
  recommendedTeamCount: number;        // Calculated: Math.ceil(playerCount / idealTeamSize)
  
  // Teams (filled after commissioner creates them)
  teamCount: number;
  teamIds: string[];
  teamNames: string[];                 // For display without fetching teams
  
  // Draft configuration
  requiresDraft: boolean;              // True if teamCount > 1
  draftStatus: 'not_needed' | 'pending' | 'scheduled' | 'in_progress' | 'complete';
  draftDate?: Timestamp | Date;
  draftType?: 'snake' | 'linear' | 'lottery';
  draftEventId?: string;               // Link to DraftEvent document
  
  // Fees (can override season default)
  registrationFee?: number;            // Override fee for this pool (cents)
  
  // Timestamps
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

/**
 * Player in a Registration Pool
 * Collection: programs/{programId}/seasons/{seasonId}/pools/{poolId}/players/{playerId}
 */
export interface PoolPlayer {
  id: string;
  
  // Pool reference
  poolId: string;
  seasonId: string;
  programId: string;
  
  // Player Info
  playerName: string;
  playerFirstName: string;
  playerLastName: string;
  playerDob: string;                   // YYYY-MM-DD
  calculatedAge: number;               // Age as of season start
  calculatedAgeGroup: string;          // System calculated: "8U", "9U", etc.
  gender?: 'male' | 'female' | 'other';
  
  // Link to existing player (if they have an account)
  existingPlayerId?: string;           // players/{playerId} if they exist
  playerUsername?: string;             // For public profile link
  
  // Parent/Guardian Info
  parentId: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  isIndependentAthlete: boolean;       // True if athlete 18+ registered themselves
  
  // Registration source
  registrationEventId?: string;        // Link to event used for registration
  registeredAt: Timestamp | Date;
  
  // Payment
  paymentStatus: 'paid' | 'partial' | 'pending' | 'pay_in_person';
  amountPaid: number;                  // Cents
  totalAmount: number;                 // Cents
  remainingBalance: number;            // Cents
  paymentMethod?: 'paypal' | 'cash' | 'check' | 'other';
  paymentNotes?: string;
  
  // Emergency Contact (required for youth)
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  
  // Medical Info (optional)
  medicalInfo?: {
    allergies?: string;
    medications?: string;
    conditions?: string;
    insuranceProvider?: string;
    insurancePolicyNumber?: string;
  };
  
  // Uniform (if collected during registration)
  uniformSizes?: {
    jersey?: string;
    shorts?: string;
    helmet?: string;
  };
  jerseyNumber?: string;               // Preferred or assigned
  preferredPositions?: string[];
  
  // Waiver
  waiverSigned: boolean;
  waiverSignedAt?: Timestamp | Date;
  waiverSignedBy?: string;             // Name of person who signed
  
  // Assignment Status
  status: 'in_pool' | 'drafted' | 'auto_assigned' | 'declined' | 'removed';
  assignedTeamId?: string;
  assignedTeamName?: string;
  assignedAt?: Timestamp | Date;
  
  // Draft tracking (if drafted)
  draftRound?: number;
  draftPick?: number;
  draftedBy?: string;                  // Coach ID who picked them
  
  // Notes
  parentNotes?: string;                // Notes from parent during registration
  commissionerNotes?: string;          // Notes from commissioner (private)
  
  // Timestamps
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

/**
 * Draft Event - Scheduled draft for a pool
 * Collection: programs/{programId}/drafts/{draftId}
 */
export interface DraftEvent {
  id: string;
  programId: string;
  seasonId: string;
  poolId: string;
  
  // Pool info (denormalized for easy display)
  sport: SportType;
  ageGroupLabel: string;
  
  // Schedule
  scheduledDate: Timestamp | Date;
  location?: string;                   // "Zoom" or physical address
  
  // Teams & Coaches
  teamIds: string[];
  teamNames: string[];
  coachIds: string[];
  coachNames: string[];
  
  // Draft Config
  draftType: 'snake' | 'linear' | 'lottery';
  totalRounds: number;                 // Calculated from playerCount / teamCount
  
  // Lottery (if enabled)
  lotteryEnabled: boolean;
  lotteryCompleted: boolean;
  lotteryResults?: {
    position: number;
    teamId: string;
    teamName: string;
    coachId: string;
    drawnAt: Timestamp | Date;
  }[];
  
  // Draft order (set by lottery or commissioner)
  draftOrder: string[];                // Team IDs in pick order
  
  // Draft progress
  currentRound: number;
  currentPick: number;
  currentTeamId?: string;
  
  // Pool info
  totalPlayers: number;
  playersRemaining: number;
  
  // Status
  status: 'scheduled' | 'lottery_pending' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
  startedAt?: Timestamp | Date;
  completedAt?: Timestamp | Date;
  
  // Pick history
  picks: DraftPick[];
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface DraftPick {
  round: number;
  pick: number;                        // Overall pick number
  pickInRound: number;                 // Pick number within round
  teamId: string;
  teamName: string;
  coachId: string;
  playerId: string;
  playerName: string;
  pickedAt: Timestamp | Date;
}

// =============================================================================
// PROGRAM REGISTRATION SYSTEM (Independent from Seasons)
// =============================================================================

/**
 * Registration Type - Determines the purpose and outcome flow
 */
export type RegistrationType = 'age_pool' | 'camp' | 'tryout' | 'event' | 'tournament' | 'clinic';

/**
 * Registration Outcome - What happens after registration closes
 */
export type RegistrationOutcome = 'draft_pool' | 'rsvp_list' | 'team_select' | 'waitlist' | 'auto_assign';

/**
 * Program Registration - Independent registration for any purpose
 * Collection: programs/{programId}/registrations/{registrationId}
 * 
 * This replaces the season-tied registration approach.
 * Registrations can be for: age pools, camps, tryouts, events, tournaments, clinics
 */
export interface ProgramRegistration {
  id: string;
  programId: string;
  programName: string;
  
  // Basic Info
  name: string;                        // "Spring 2025 Player Registration", "Summer Skills Camp"
  description?: string;                // Optional description/details
  sport: SportType;
  
  // Registration Type & Outcome
  type: RegistrationType;
  outcome: RegistrationOutcome;
  
  // Dates
  registrationOpenDate: string;        // YYYY-MM-DD - When registration opens
  registrationCloseDate: string;       // YYYY-MM-DD - When registration closes
  eventDate?: string;                  // YYYY-MM-DD - For camps/events (the actual event date)
  eventEndDate?: string;               // YYYY-MM-DD - For multi-day events
  eventTime?: string;                  // HH:MM - Start time
  eventLocation?: string;              // Address or location name
  
  // Age Groups (for age_pool type)
  ageGroups?: string[];                // ["6U", "7U-8U", "9U-10U", "11U-12U"]
  ageGroupConfigs?: RegistrationAgeGroup[]; // Detailed config per age group
  
  // Capacity (for camps/events)
  hasCapacity: boolean;                // True if limited spots
  capacity?: number;                   // Max registrations allowed
  waitlistEnabled: boolean;            // Allow waitlist when full
  
  // Fee Structure
  registrationFee: number;             // Amount in cents
  earlyBirdFee?: number;               // Discounted early bird fee (cents)
  earlyBirdDeadline?: string;          // YYYY-MM-DD - Early bird cutoff
  lateFee?: number;                    // Additional late fee (cents)
  lateAfterDate?: string;              // YYYY-MM-DD - When late fee applies
  
  // Payment Options
  paymentOptions: {
    payInFull: boolean;
    paymentPlan: boolean;
    payInPerson: boolean;
    depositAmount?: number;            // If payment plan, initial deposit (cents)
    installmentCount?: number;         // Number of installments
  };
  
  // Registration Requirements
  requirements: {
    requireMedicalInfo: boolean;
    requireEmergencyContact: boolean;
    requireUniformSizes: boolean;
    requireWaiver: boolean;
    waiverText?: string;
    customFields?: RegistrationCustomField[];
  };
  
  // Eligibility
  eligibility?: {
    minAge?: number;                   // Minimum age
    maxAge?: number;                   // Maximum age
    genderRestriction?: 'male' | 'female' | 'all';
    requiresTeamMembership?: boolean;  // Must be on a team in the program
    customRequirements?: string;       // Free text for other requirements
  };
  
  // Counts
  registrationCount: number;           // Total registrations
  paidCount: number;                   // Fully paid
  pendingCount: number;                // Payment pending
  waitlistCount: number;               // On waitlist
  
  // Status
  status: 'draft' | 'scheduled' | 'open' | 'closed' | 'completed' | 'cancelled';
  
  // Optional: Link to a season (for age pools that feed into a season)
  linkedSeasonId?: string;
  linkedSeasonName?: string;
  
  // League context (if program is in a league)
  leagueId?: string;
  leagueName?: string;
  
  // Visibility
  isPublic: boolean;                   // Show on public program page
  allowOnlineRegistration: boolean;    // Allow online sign-ups
  
  // Metadata
  createdBy: string;
  createdByName?: string;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  openedAt?: Timestamp | Date;         // When status changed to 'open'
  closedAt?: Timestamp | Date;         // When status changed to 'closed'
}

/**
 * Age Group Configuration for a Registration
 */
export interface RegistrationAgeGroup {
  id: string;                          // e.g., "6u", "7u-8u"
  label: string;                       // e.g., "6U", "7U-8U"
  ageGroups: string[];                 // ["7U", "8U"] for combined
  minBirthYear: number;
  maxBirthYear: number;
  fee?: number;                        // Override fee for this group (cents)
  capacity?: number;                   // Capacity for this specific group
  registrationCount: number;           // Current count for this group
  teamIds?: string[];                  // Teams for this age group (for team_select)
}

/**
 * Custom Field for Registration Forms
 */
export interface RegistrationCustomField {
  id: string;
  label: string;                       // "T-Shirt Size", "Allergies"
  type: 'text' | 'select' | 'checkbox' | 'textarea' | 'number';
  required: boolean;
  options?: string[];                  // For select type
  placeholder?: string;
}

/**
 * Registrant - A person registered for a ProgramRegistration
 * Collection: programs/{programId}/registrations/{registrationId}/registrants/{registrantId}
 */
export interface Registrant {
  id: string;
  registrationId: string;
  programId: string;
  
  // Registrant Type
  registrantType: 'player' | 'family' | 'team' | 'individual';
  
  // Player/Participant Info
  firstName: string;
  lastName: string;
  fullName: string;                    // Computed: firstName + lastName
  dateOfBirth: string;                 // YYYY-MM-DD
  calculatedAge: number;
  calculatedAgeGroup?: string;         // For age_pool type
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  
  // Existing player link
  existingPlayerId?: string;
  existingPlayerUsername?: string;
  
  // Age Group Assignment (for age_pool)
  ageGroupId?: string;                 // Which age group pool they're in
  ageGroupLabel?: string;
  
  // Parent/Guardian (for minors)
  isMinor: boolean;
  parentId?: string;
  parentName?: string;
  parentEmail: string;
  parentPhone?: string;
  
  // Contact (for adults registering themselves)
  email: string;
  phone?: string;
  
  // Emergency Contact
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  
  // Medical Info
  medicalInfo?: {
    allergies?: string;
    medications?: string;
    conditions?: string;
    insuranceProvider?: string;
    insurancePolicyNumber?: string;
    physicianName?: string;
    physicianPhone?: string;
  };
  
  // Uniform Sizes
  uniformSizes?: {
    jersey?: string;
    shorts?: string;
    pants?: string;
    helmet?: string;
    shoes?: string;
  };
  
  // Preferences
  preferences?: {
    jerseyNumber?: string;
    positions?: string[];
    coachRequest?: string;             // Requested coach name
    friendRequest?: string;            // Friend to be on same team
    notes?: string;                    // Additional notes
  };
  
  // Custom Field Responses
  customFieldResponses?: Record<string, any>;
  
  // Payment
  paymentStatus: 'paid' | 'partial' | 'pending' | 'waived' | 'refunded';
  amountDue: number;                   // Total due (cents)
  amountPaid: number;                  // Amount paid (cents)
  remainingBalance: number;            // Remaining (cents)
  paymentMethod?: 'paypal' | 'stripe' | 'cash' | 'check' | 'other';
  paymentDate?: Timestamp | Date;
  paymentNotes?: string;
  
  // Waiver
  waiverSigned: boolean;
  waiverSignedAt?: Timestamp | Date;
  waiverSignedBy?: string;
  
  // Status
  status: 'registered' | 'waitlisted' | 'confirmed' | 'assigned' | 'declined' | 'cancelled' | 'no_show';
  
  // Assignment (for draft_pool or team_select outcomes)
  assignedTeamId?: string;
  assignedTeamName?: string;
  assignedAt?: Timestamp | Date;
  
  // Draft info (if drafted)
  draftRound?: number;
  draftPick?: number;
  draftedBy?: string;
  
  // Timestamps
  registeredAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  confirmedAt?: Timestamp | Date;
  cancelledAt?: Timestamp | Date;
  
  // Notes
  parentNotes?: string;                // Notes from parent
  adminNotes?: string;                 // Private admin notes
}

/**
 * Registration Summary for Quick Display
 * Denormalized data for dashboard cards
 */
export interface RegistrationSummary {
  id: string;
  name: string;
  type: RegistrationType;
  sport: SportType;
  status: ProgramRegistration['status'];
  registrationCount: number;
  capacity?: number;
  registrationCloseDate: string;
  eventDate?: string;
}

// =============================================================================
// AGE GROUP UTILITIES
// =============================================================================

/**
 * Calculate age group from date of birth
 * @param dob Date of birth (YYYY-MM-DD string or Date)
 * @param referenceDate Date to calculate age from (defaults to Aug 1 of current year)
 * @returns Age group string (e.g., "8U", "9U")
 */
export function calculateAgeGroup(dob: string | Date, referenceDate?: Date): string {
  const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
  const refDate = referenceDate || new Date(new Date().getFullYear(), 7, 1); // Aug 1
  
  let age = refDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = refDate.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < birthDate.getDate())) {
    age--;
  }
  
  // Map age to age group
  if (age <= 5) return '5U';
  if (age <= 6) return '6U';
  if (age <= 7) return '7U';
  if (age <= 8) return '8U';
  if (age <= 9) return '9U';
  if (age <= 10) return '10U';
  if (age <= 11) return '11U';
  if (age <= 12) return '12U';
  if (age <= 13) return '13U';
  if (age <= 14) return '14U';
  return 'Open';
}

/**
 * Get birth year range for an age group
 * @param ageGroup Age group string (e.g., "8U")
 * @param seasonYear The year of the season
 * @returns { minYear, maxYear }
 */
export function getBirthYearRange(ageGroup: string, seasonYear: number): { minYear: number; maxYear: number } {
  const ageMatch = ageGroup.match(/(\d+)U/);
  if (!ageMatch) return { minYear: 1900, maxYear: seasonYear };
  
  const maxAge = parseInt(ageMatch[1], 10);
  const minYear = seasonYear - maxAge;
  const maxYear = seasonYear - maxAge + 1;
  
  return { minYear, maxYear };
}

/**
 * Check if a player's DOB falls within an age group division
 */
export function isPlayerEligibleForDivision(dob: string | Date, division: AgeGroupDivision): boolean {
  const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
  const birthYear = birthDate.getFullYear();
  return birthYear >= division.minBirthYear && birthYear <= division.maxBirthYear;
}

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

// Home Field for teams - used in league scheduling
export interface HomeField {
  name: string;                     // e.g., "Commerce ISD Stadium"
  address?: string;                 // Full street address
  city?: string;
  state?: string;
  zipcode?: string;
  fieldNumber?: string;             // e.g., "Field 1", "North Field"
  logo?: string;                    // Field/venue logo URL
  googleMapsUrl?: string;           // Direct link to Google Maps
  coordinates?: {
    lat: number;
    lng: number;
  };
  notes?: string;                   // e.g., "Enter through south gate"
  parkingInfo?: string;             // Parking instructions
  capacity?: number;                // Seating capacity
}

export interface Team {
  id: string;
  name: string;
  logo?: string; // Team logo URL
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
  
  // Team Owner (Commissioner who created the team)
  ownerId?: string;               // User ID of team owner/commissioner
  ownerName?: string;             // Name of team owner
  
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
  programName?: string;                 // Name of the program (denormalized for display, sport-specific)
  leagueId?: string;                    // Which league (if any)
  leagueName?: string;                  // Name of the league (denormalized for display)
  linkedCheerTeamId?: string;           // For sports teams - linked cheer team
  linkedToTeamId?: string;              // For cheer teams - which team they cheer for
  linkedToTeamName?: string;            // Display name "Cheerleader for Tigers34"
  leagueStatus?: 'none' | 'pending' | 'active' | 'left' | 'kicked';
  leagueJoinedAt?: Timestamp;
  leagueLeftAt?: Timestamp;
  leagueLeftReason?: string;
  divisionId?: string;                  // Which division in the league
  maxRosterSize?: number;               // Commissioner can set max players
  
  // --- HOME FIELD ---
  homeField?: HomeField;                // Team's home field for league scheduling
  
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

// --- TEAM HISTORY TRACKING ---
// Tracks which teams/programs a player has been on for historical stats
export interface TeamHistoryEntry {
  teamId: string;
  teamName: string;
  programId: string;
  programName: string;
  sport: SportType;
  seasonId?: string;
  seasonYear?: number;
  ageGroup?: string;
  joinedAt: any; // Timestamp
  leftAt?: any; // Timestamp (null if still active)
  status: 'active' | 'released' | 'transferred' | 'season_ended';
}

export interface Player {
  id: string;
  name: string; // Full display name (computed from firstName + lastName or legacy)
  firstName?: string; // First name
  lastName?: string; // Last name  
  nickname?: string; // Optional nickname (shown on player card if set)
  gender?: 'male' | 'female' | 'other'; // Player gender
  ageGroup?: string; // Calculated age group (e.g., "9U", "10U") - auto-calculated from DOB using Sept 10 cutoff
  username?: string; // Unique athlete username for tracking (e.g., @johnny_smith)
  teamId: string | null; // Team the player belongs to (null if unassigned)
  
  // Team History - for tracking all teams/programs player has been on
  teamHistory?: TeamHistoryEntry[];
  // REMOVED NUMBER/POSITION FROM CORE PARENT INPUT FLOW:
  number?: number; 
  jerseyNumber?: number; // Alias for number
  position?: string;
  
  // Bio - parent can add a description about their athlete
  bio?: string;
  
  // NEW: Uniform Sizes
  helmetSize?: string; // e.g. "Youth S", "Youth M", "Adult L"
  shirtSize?: string; // e.g. "Youth Large", "Adult M"
  pantSize?: string; // e.g. "Youth Small", "Adult L"
  
  // NEW: Starter & Captain status (Coach-set)
  isStarter?: boolean; // Shows glowing border on roster
  isCaptain?: boolean; // Shows captain crown badge
  height?: string; // Player height (e.g., "4'6"")
  weight?: string; // Player weight (e.g., "85 lbs")
  photoUrl?: string; // Player headshot photo
  photoPath?: string;
  
  // Coach Notes - shared with all coaching staff and commissioners (private from parents)
  coachNotes?: string;
  
  // Released Player (independent account)
  released?: boolean; // True when parent releases player to their own account
  releasedAt?: any; // Timestamp when released
  releasedUid?: string; // Firebase Auth UID for the released player's account
  forceAccountSetup?: boolean; // True until player sets their own email/password
  
  // Personal & Medical
  dob?: string;
  dateOfBirth?: string; // Alias for dob (used by draft system)
  medical?: MedicalInfo; 
  
  // Link to Parent (multiple alias fields for compatibility)
  parentId?: string | null; // null when released
  parentUserId?: string | null; // Alias for parentId (used by registration/draft)
  parentName?: string; // Parent's display name
  parentEmail?: string; // Parent's email
  parentPhone?: string; // Parent's phone
  athleteId?: string; // Reference to top-level players/{id} document

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
  sport?: SportType; // Sport this film is for (football, basketball, etc.)
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
  gameNumber?: number;    // Game 1, 2, 3... of the season (optional for program games)
  date: string;          // YYYY-MM-DD format
  opponent: string;      // Opponent team name
  isHome: boolean;       // Home or Away game
  teamScore: number;     // Our team's score
  opponentScore: number; // Opponent's score
  result?: 'W' | 'L' | 'T'; // Win, Loss, Tie (auto-calculated) - optional for scheduled games
  status?: 'scheduled' | 'live' | 'completed'; // Game status
  location?: string;     // Stadium/field name
  notes?: string;        // Game notes
  // Quarter scores
  homeQ1?: number;
  homeQ2?: number;
  homeQ3?: number;
  homeQ4?: number;
  homeOT?: number;
  awayQ1?: number;
  awayQ2?: number;
  awayQ3?: number;
  awayQ4?: number;
  awayOT?: number;
  currentQuarter?: 1 | 2 | 3 | 4 | 5;
  // Program game reference (when loaded from commissioner schedule)
  programGameId?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeScore?: number;
  awayScore?: number;
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

// ============================================
// TEAM MANAGER SUB-ACCOUNTS
// ============================================
// Sub-accounts created by commissioners to help manage teams
// Stored in: /teamManagers/{managerId}

export type TeamManagerStatus = 'active' | 'paused' | 'invited' | 'suspended';

export interface TeamManagerPermissions {
  roster: boolean;           // Add/edit/remove players
  schedule: boolean;         // Create/edit events
  chat: boolean;             // Send messages in team chat
  announcements: boolean;    // Post bulletins
  notifications: boolean;    // Send push notifications
  registrations: boolean;    // View/approve registrations
  stats: boolean;            // View stats (read-only)
  designStudio: boolean;     // Access design studio
  filmRoom: boolean;         // Upload to film room
}

export interface TeamManager {
  id: string;
  
  // Basic Info
  name: string;
  email: string;
  
  // Relationship
  teamId: string;
  teamName?: string;         // Denormalized for display
  commissionerId: string;    // Who created this manager
  commissionerName?: string; // Denormalized for display
  
  // Status
  status: TeamManagerStatus;
  
  // Permissions (Phase 2 - for now all managers get full access)
  permissions: TeamManagerPermissions;
  
  // Tracking
  lastLogin?: Timestamp;
  lastActivity?: Timestamp;
  loginCount: number;
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
}

// For creating a new manager (without id and timestamps)
export interface NewTeamManager {
  name: string;
  email: string;
  password: string;          // Only used during creation, not stored in Firestore
  teamId: string;
  teamName?: string;
  commissionerId: string;
  commissionerName?: string;
  permissions?: Partial<TeamManagerPermissions>;
}

// =============================================================================
// STATS ENGINE v2.0 - NEW INTERFACES
// =============================================================================

/**
 * Game stats for a player in the v2.0 system
 * Lives at: programs/{programId}/seasons/{seasonId}/games/{gameId}/stats/{playerId}
 * This is the SINGLE SOURCE OF TRUTH for all stats.
 */
export interface GameStatV2 {
  id?: string;
  
  // Player identification
  playerId: string;               // Team roster player ID
  globalPlayerId?: string;        // Global player ID (for career tracking)
  playerName: string;
  playerNumber: number;
  position?: string;
  
  // Team/Game context
  teamId: string;
  teamName?: string;
  gameId: string;
  programId: string;
  seasonId: string;
  sport: SportType;
  
  // Game info (denormalized for easy queries)
  gameDate: string;               // YYYY-MM-DD format
  opponent: string;
  isHome: boolean;
  
  // Participation
  played: boolean;
  
  // Sport-specific stats - stored as dynamic key-value pairs
  // Keys come from config/statSchemas.ts
  stats: Record<string, number>;
  
  // Derived stats (auto-calculated by Cloud Functions)
  derivedStats?: Record<string, number>;
  
  // Metadata
  enteredBy?: string;             // Coach/manager who entered stats
  enteredByName?: string;
  source?: 'manual' | 'import' | 'live';  // How stats were entered
  importSource?: string;          // e.g., 'hudl', 'gamechanger'
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  
  // Draft/published status
  isDraft?: boolean;              // True = not yet finalized
}

/**
 * Team-Level Game Stats (NFL-style)
 * Stats tracked at the team level per game (not individual players)
 * Lives at: programs/{programId}/seasons/{seasonId}/games/{gameId}
 * These are fields on the game document itself
 */
export interface TeamGameStats {
  // Quarter-by-quarter scoring
  q1Score?: number;
  q2Score?: number;
  q3Score?: number;
  q4Score?: number;
  otScore?: number;
  
  // Opponent quarter scores
  oppQ1Score?: number;
  oppQ2Score?: number;
  oppQ3Score?: number;
  oppQ4Score?: number;
  oppOtScore?: number;
  
  // Team efficiency stats
  firstDowns?: number;
  thirdDownAttempts?: number;
  thirdDownConversions?: number;
  fourthDownAttempts?: number;
  fourthDownConversions?: number;
  redZoneAttempts?: number;
  redZoneScores?: number;
  
  // Time & plays
  totalPlays?: number;
  timeOfPossession?: string;  // "MM:SS" format
  
  // Penalties
  penalties?: number;
  penaltyYards?: number;
  
  // Turnovers
  turnoversLost?: number;
  turnoversGained?: number;
}

/**
 * Season stats aggregation for a player
 * Auto-generated by Cloud Functions from GameStatV2 entries
 */
export interface SeasonStatV2 {
  id?: string;
  
  // Player identification
  playerId: string;
  globalPlayerId?: string;
  playerName: string;
  playerNumber: number;
  position?: string;
  
  // Context
  teamId: string;
  teamName?: string;
  programId: string;
  seasonId: string;
  seasonYear: number;             // e.g., 2025
  sport: SportType;
  
  // Aggregated stats
  gamesPlayed: number;
  gamesStarted?: number;
  
  // Totals - same keys as GameStatV2.stats
  totals: Record<string, number>;
  
  // Averages per game
  averages: Record<string, number>;
  
  // Personal bests
  highs: Record<string, number>;
  
  // Metadata
  lastGameDate?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Career stats for a global player
 * Lives at: players/{globalPlayerId}/careerStats/{sport}
 * Auto-generated by Cloud Functions
 */
export interface CareerStatV2 {
  id?: string;
  
  // Player identification
  globalPlayerId: string;
  playerName: string;
  sport: SportType;
  
  // Career totals
  totalGamesPlayed: number;
  seasonsPlayed: number;
  teamsPlayed: string[];          // List of team IDs
  
  // Aggregated career stats
  totals: Record<string, number>;
  
  // Career averages
  averages: Record<string, number>;
  
  // Career highs
  highs: Record<string, { value: number; gameId: string; date: string; opponent: string }>;
  
  // Season breakdown summary
  seasons: CareerSeasonSummaryV2[];
  
  // Metadata
  firstGameDate?: string;
  lastGameDate?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Summary of a single season in career stats
 */
export interface CareerSeasonSummaryV2 {
  seasonId: string;
  seasonYear: number;
  programId: string;
  programName?: string;
  teamId: string;
  teamName?: string;
  gamesPlayed: number;
  
  // Key stats for this season (sport-specific subset)
  keyStats: Record<string, number>;
}

/**
 * Game log entry for a global player
 * Lives at: players/{globalPlayerId}/gameLog/{gameId}
 */
export interface GameLogEntryV2 {
  id?: string;
  gameId: string;
  programId: string;
  seasonId: string;
  teamId: string;
  teamName?: string;
  
  // Game info
  date: string;                   // YYYY-MM-DD
  opponent: string;
  isHome: boolean;
  result?: 'W' | 'L' | 'T';
  score?: string;                 // e.g., "28-14"
  
  // Stats for this game
  stats: Record<string, number>;
  
  // Context
  sport: SportType;
  
  // Metadata
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Stat import record for tracking CSV imports
 */
export interface StatImportV2 {
  id?: string;
  programId: string;
  seasonId: string;
  teamId?: string;
  
  // Import source
  source: 'hudl' | 'gamechanger' | 'maxpreps' | 'teamsnap' | 'csv';
  fileName?: string;
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  
  // Results
  gamesImported: number;
  playersMatched: number;
  playersUnmatched: string[];
  errors: string[];
  
  // Column mappings used
  columnMappings?: Record<string, string>;
  
  // Metadata
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: Timestamp;
  processedAt?: Timestamp;
}

/**
 * Stat leader entry for leaderboards
 */
export interface StatLeaderV2 {
  playerId: string;
  globalPlayerId?: string;
  playerName: string;
  playerNumber: number;
  teamId: string;
  teamName?: string;
  position?: string;
  photoUrl?: string;
  
  // The stat value
  statKey: string;
  statValue: number;
  
  // Rank
  rank: number;
}

/**
 * ============================================
 * PROMO CODES
 * ============================================
 * Program-wide discount/promo codes for registrations
 * Can be used across all events/registrations in a program
 */
export interface PromoCode {
  id: string;
  programId: string;
  
  // Code details
  code: string;                        // The actual code users enter (e.g., "SPRING25", "FREEKIDS")
  name: string;                        // Display name (e.g., "Spring 25% Off", "Free Registration - Board Members")
  description?: string;                // Internal notes about the code
  
  // Discount configuration
  discountType: 'percentage' | 'fixed' | 'free';  // Type of discount
  discountValue: number;               // For percentage: 10 = 10%, for fixed: dollar amount, for free: ignored
  
  // Usage limits
  usageType: 'unlimited' | 'limited' | 'single';  // unlimited = no limit, limited = max uses, single = one-time
  maxUses?: number;                    // Only for 'limited' type
  usedCount: number;                   // How many times it's been used
  
  // Validity
  isActive: boolean;                   // Can be toggled on/off
  startDate?: string;                  // When code becomes valid (YYYY-MM-DD)
  expirationDate?: string;             // When code expires (YYYY-MM-DD)
  
  // Restrictions (future expansion)
  minPurchaseAmount?: number;          // Minimum registration fee to apply
  applicableSports?: string[];         // Limit to specific sports (empty = all)
  applicableRegistrationTypes?: string[]; // Limit to specific reg types (empty = all)
  
  // Tracking
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Usage history (stored separately in subcollection for large volume)
  lastUsedAt?: Timestamp;
}

/**
 * Individual promo code usage record
 * Stored at: programs/{programId}/promoCodes/{codeId}/usages/{usageId}
 */
export interface PromoCodeUsage {
  id: string;
  codeId: string;
  code: string;
  
  // Who used it
  userId: string;
  userEmail?: string;
  userName?: string;
  
  // What it was used on
  registrationId: string;
  registrationName: string;
  registrantId?: string;
  
  // Discount applied
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  
  // When
  usedAt: Timestamp;
}
