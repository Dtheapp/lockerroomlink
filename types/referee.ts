/**
 * OSYS Referee System Types
 * Complete type definitions for referee management
 */

import { Timestamp } from 'firebase/firestore';
import type { SportType } from '../types';

// =============================================================================
// REFEREE AVAILABILITY
// =============================================================================

export interface RefereeAvailability {
  weekdays: boolean;
  weekends: boolean;
  evenings: boolean;
  notes?: string; // "Available Saturdays 8am-6pm"
}

// =============================================================================
// REFEREE PROFILE (extends UserProfile)
// =============================================================================

export interface RefereeProfile {
  // Certifications & Experience
  certifications: RefereeCertification[];
  yearsExperience: number;
  sports: SportType[];
  
  // Availability
  availability: RefereeAvailability;
  travelRadius: number; // Miles willing to travel
  homeLocation?: {
    city: string;
    state: string;
    zipCode?: string;
  };
  
  // Payment
  ratePerGame?: number; // Optional hourly/game rate
  acceptsPaymentThroughApp?: boolean;
  paymentInfo?: {
    paypalEmail?: string;
    venmoHandle?: string;
    preferredMethod?: 'paypal' | 'venmo' | 'cash' | 'check';
  };
  
  // Profile
  bio?: string;
  profilePhotoUrl?: string;
  
  // Stats (auto-calculated)
  totalGamesReffed: number;
  gamesThisSeason: number;
  sportBreakdown: Record<SportType, number>; // { football: 25, basketball: 10 }
  
  // Verification
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  verificationSubmittedAt?: Timestamp;
  verificationApprovedAt?: Timestamp;
  verificationDocuments?: string[]; // URLs to uploaded docs
  verificationNotes?: string; // Admin notes
  
  // Ratings (future feature)
  averageRating?: number;
  totalRatings?: number;
  
  // Status
  isAvailable: boolean; // Master toggle
  isPremiumListed: boolean; // Paid for premium listing
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RefereeCertification {
  id?: string; // Optional for new certs
  name: string; // "USSF Grade 8", "NFHS Certified", "USAV Official"
  organization: string; // "US Soccer Federation", "National Federation of State High School Associations"
  issuingBody?: string; // Alias for organization
  sport: SportType;
  level?: string; // "Grade 8", "Level 2", "Regional"
  issueDate?: string; // YYYY-MM-DD
  expirationDate?: string; // YYYY-MM-DD
  certificateNumber?: string;
  verified: boolean; // Admin verified
  isVerified?: boolean; // Alias for verified
  documentUrl?: string; // Uploaded certificate
}

// =============================================================================
// REFEREE ASSIGNMENTS
// =============================================================================

export interface RefereeAssignment {
  id: string;
  
  // Referee info
  refereeId: string;
  refereeName: string;
  refereeEmail?: string;
  refereePhone?: string;
  
  // Game reference (one of these patterns)
  gameType: 'league' | 'team';
  
  // For league games
  leagueId?: string;
  leagueName?: string;
  seasonId?: string;
  seasonName?: string;
  leagueScheduleId?: string;
  leagueGameId?: string;
  
  // For team games (non-league)
  teamId?: string;
  teamName?: string;
  teamGameId?: string;
  
  // Assignment details
  role: RefereeRole;
  position?: string; // "Center Referee", "Line Judge", etc.
  notes?: string; // Notes from the assigner
  
  // Who assigned
  assignedBy: string;
  assignedByName: string;
  assignedByRole: 'LeagueOwner' | 'ProgramCommissioner' | 'Coach';
  assignedAt: Timestamp;
  
  // Approval flow
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled' | 'no_show';
  respondedAt?: Timestamp;
  declineReason?: string;
  
  // Game details (denormalized for easy display in referee schedule)
  gameDate: Timestamp;
  gameTime: string;
  location: string;
  fieldNumber?: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  sport: SportType;
  ageGroup?: string;
  
  // Payment
  paymentAmount?: number;
  paymentStatus?: 'pending' | 'paid' | 'cancelled';
  paymentMethod?: 'app' | 'cash' | 'check' | 'external';
  paymentPaidAt?: Timestamp;
  paymentNotes?: string;
  
  // Post-game actions
  scoreSubmitted: boolean;
  scoreSubmittedAt?: Timestamp;
  finalHomeScore?: number;
  finalAwayScore?: number;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type RefereeRole = 
  | 'official'  // Generic official
  | 'head'      // Head/Center referee
  | 'assistant' // Assistant/Line referee
  | 'line'      // Line judge
  | 'line_judge' // Line judge (alternate naming)
  | 'field'     // Field judge
  | 'umpire'    // Umpire (baseball)
  | 'sideline'  // Sideline official
  | 'clock'     // Clock/Timer operator
  | 'timekeeper' // Timekeeper
  | 'scorer';   // Official scorer

// =============================================================================
// REFEREE NOTES (Private to referee)
// =============================================================================

export interface RefereeNote {
  id: string;
  assignmentId: string;
  refereeId: string;
  
  content: string;
  category: 'general' | 'pre-game' | 'in-game' | 'post-game' | 'improvement' | 'incident';
  
  // For incident reports
  isIncident?: boolean;
  incidentDetails?: {
    type: 'ejection' | 'injury' | 'misconduct' | 'weather' | 'other';
    playersInvolved?: string[];
    actionTaken?: string;
  };
  
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// =============================================================================
// REFEREE VERIFICATION REQUEST
// =============================================================================

export interface RefereeVerificationRequest {
  id: string;
  refereeId: string;
  refereeName: string;
  refereeEmail: string;
  
  // Submitted documents
  documents: {
    type: 'certification' | 'id' | 'background_check' | 'other';
    name: string;
    url: string;
    uploadedAt: Timestamp;
  }[];
  
  certificationsClaimed: RefereeCertification[];
  
  status: 'pending' | 'approved' | 'rejected' | 'needs_info';
  
  // Admin review
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: Timestamp;
  reviewNotes?: string;
  rejectionReason?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// =============================================================================
// REFEREE RATING (Future feature)
// =============================================================================

export interface RefereeRating {
  id: string;
  refereeId: string;
  assignmentId: string;
  
  // Who rated
  ratedBy: string;
  raterId?: string; // Alias
  ratedByRole: 'LeagueOwner' | 'ProgramCommissioner' | 'Coach';
  raterRole?: 'LeagueOwner' | 'ProgramCommissioner' | 'Coach'; // Alias
  ratedByName: string;
  raterName?: string; // Alias
  
  // Ratings (1-5)
  overallRating: number;
  fairnessRating?: number;
  communicationRating?: number;
  punctualityRating?: number;
  
  // Comments
  publicComment?: string; // Visible to referee
  comment?: string; // Alias for publicComment
  privateComment?: string; // Only visible to league owners
  
  createdAt: Timestamp;
}

// =============================================================================
// REFEREE PAYMENT (If tracking through app)
// =============================================================================

export interface RefereePayment {
  id: string;
  refereeId: string;
  refereeName: string;
  
  // What this payment is for
  assignmentIds: string[]; // Can batch pay multiple games
  
  // Payment details
  amount: number;
  method: 'paypal' | 'venmo' | 'check' | 'cash' | 'other';
  
  // Who paid
  paidBy: string;
  paidByRole: 'LeagueOwner' | 'ProgramCommissioner';
  paidByName: string;
  
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  
  // External reference
  externalTransactionId?: string;
  notes?: string;
  
  paidAt?: Timestamp;
  createdAt: Timestamp;
}

// =============================================================================
// GAME SCORE SUBMISSION
// =============================================================================

export interface GameScoreSubmission {
  id: string;
  
  // Game reference
  gameType: 'league' | 'team';
  leagueGameId?: string;
  teamGameId?: string;
  leagueId?: string;
  teamId?: string;
  
  // Scores
  homeScore: number;
  awayScore: number;
  
  // Who submitted
  submittedBy: string;
  submittedByRole: 'Referee' | 'LeagueOwner' | 'Coach';
  submittedByName: string;
  refereeAssignmentId?: string; // If submitted by referee
  
  // Verification
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: Timestamp;
  
  // If disputed
  isDisputed: boolean;
  disputeReason?: string;
  disputeResolution?: string;
  
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// =============================================================================
// HELPER TYPES
// =============================================================================

export interface RefereeSearchFilters {
  sport?: SportType;
  city?: string;
  state?: string;
  maxDistance?: number;
  minRating?: number;
  verifiedOnly?: boolean;
  availableOnly?: boolean;
  availableDate?: Date;
  minExperience?: number;
  certificationRequired?: string;
}

export interface RefereeScheduleView {
  date: Date;
  assignments: RefereeAssignment[];
  totalGames: number;
  totalEarnings?: number;
}

export interface RefereeStats {
  totalGamesAllTime: number;
  gamesThisSeason: number;
  gamesThisMonth: number;
  sportBreakdown: Record<SportType, number>;
  acceptanceRate: number; // % of assignments accepted
  completionRate: number; // % of accepted games completed
  averageRating?: number;
  totalEarnings?: number;
  pendingPayments?: number;
}
