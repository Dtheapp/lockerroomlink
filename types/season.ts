/**
 * Season & Program Types
 * Clean data model for: Program → Season → Registration → Draft → Teams
 */

import { Timestamp } from 'firebase/firestore';
import type { SportType } from '../types';

// =============================================================================
// AGE GROUP
// =============================================================================

export interface AgeGroup {
  id: string;
  name: string;                    // "1st/2nd Grade"
  shortName: string;               // "1/2"
  minAge?: number;                 // Optional: minimum age
  maxAge?: number;                 // Optional: maximum age  
  minGrade?: number;               // Optional: minimum grade (1)
  maxGrade?: number;               // Optional: maximum grade (2)
  sortOrder: number;               // For display ordering
}

// Common age group presets
export const AGE_GROUP_PRESETS: AgeGroup[] = [
  { id: 'k', name: 'Kindergarten', shortName: 'K', minGrade: 0, maxGrade: 0, sortOrder: 0 },
  { id: '1-2', name: '1st/2nd Grade', shortName: '1/2', minGrade: 1, maxGrade: 2, sortOrder: 1 },
  { id: '3-4', name: '3rd/4th Grade', shortName: '3/4', minGrade: 3, maxGrade: 4, sortOrder: 2 },
  { id: '5-6', name: '5th/6th Grade', shortName: '5/6', minGrade: 5, maxGrade: 6, sortOrder: 3 },
  { id: '7-8', name: '7th/8th Grade', shortName: '7/8', minGrade: 7, maxGrade: 8, sortOrder: 4 },
  { id: '9-12', name: 'High School', shortName: 'HS', minGrade: 9, maxGrade: 12, sortOrder: 5 },
  { id: '6u', name: '6 & Under', shortName: '6U', minAge: 0, maxAge: 6, sortOrder: 0 },
  { id: '8u', name: '8 & Under', shortName: '8U', minAge: 0, maxAge: 8, sortOrder: 1 },
  { id: '10u', name: '10 & Under', shortName: '10U', minAge: 0, maxAge: 10, sortOrder: 2 },
  { id: '12u', name: '12 & Under', shortName: '12U', minAge: 0, maxAge: 12, sortOrder: 3 },
  { id: '14u', name: '14 & Under', shortName: '14U', minAge: 0, maxAge: 14, sortOrder: 4 },
  { id: '16u', name: '16 & Under', shortName: '16U', minAge: 0, maxAge: 16, sortOrder: 5 },
  { id: '18u', name: '18 & Under', shortName: '18U', minAge: 0, maxAge: 18, sortOrder: 6 },
];

// =============================================================================
// PROGRAM (e.g., CYFL, Little League, etc.)
// =============================================================================

export interface Program {
  id: string;
  name: string;                    // "CYFL" or "Cedar Youth Football League"
  shortName?: string;              // "CYFL"
  sport: SportType;                // "football"
  description?: string;
  logoUrl?: string;
  
  // Who owns this program
  ownerId: string;                 // Commissioner/League Owner userId
  ownerName?: string;
  
  // Age groups this program supports
  ageGroups: AgeGroup[];
  
  // Settings
  defaultRosterSize: number;       // Default max players per team (e.g., 15)
  defaultRegistrationFee: number;  // Default fee in cents
  
  // Status
  isActive: boolean;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// =============================================================================
// SEASON (e.g., Spring 2025, Fall 2025)
// =============================================================================

export type SeasonStatus = 
  | 'setup'           // Commissioner setting up
  | 'registration'    // Registration is open
  | 'closed'          // Registration closed, preparing for draft
  | 'drafting'        // Draft in progress
  | 'active'          // Season is live, games happening
  | 'completed';      // Season ended

export interface Season {
  id: string;
  programId: string;               // Links to Program
  programName: string;             // Denormalized for display
  name: string;                    // "Spring 2025"
  sport: SportType;
  
  // Status
  status: SeasonStatus;
  
  // Which age groups are active this season
  activeAgeGroups: AgeGroup[];     // Subset of program's age groups
  
  // Registration settings
  registrationFee: number;         // In cents
  registrationOpenDate?: Timestamp;
  registrationCloseDate?: Timestamp;
  maxPlayersPerAgeGroup?: number;  // Optional cap per age group
  
  // Registration counts (denormalized for quick display)
  registrationCounts: Record<string, number>; // { "1-2": 45, "3-4": 38, "5-6": 52 }
  totalRegistrations: number;
  
  // Season dates
  seasonStartDate?: Timestamp;
  seasonEndDate?: Timestamp;
  
  // Draft settings
  draftDate?: Timestamp;
  draftType: 'live' | 'offline' | 'commissioner';  // How draft will happen
  
  // Owner
  ownerId: string;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// =============================================================================
// DRAFT POOL PLAYER
// Stored in: seasons/{seasonId}/draftPool/{playerId}
// =============================================================================

export type DraftStatus = 'available' | 'drafted' | 'waitlisted' | 'cancelled';

export interface DraftPoolPlayer {
  id: string;
  
  // Links
  registrationId: string;          // Link back to simpleRegistration
  seasonId: string;
  programId: string;
  ageGroupId: string;              // Which age group they registered for
  ageGroupName: string;            // Denormalized
  
  // Link to global player document for status tracking
  athleteId?: string | null;       // ID in /players collection
  
  // Athlete info (denormalized for draft board display)
  athleteFirstName: string;
  athleteLastName: string;
  athleteFullName: string;
  athleteNickname?: string;
  athleteUsername?: string;        // For linking to user profile
  athleteDOB: Timestamp;
  athleteAge: number;              // Calculated at registration
  athleteGender: 'male' | 'female' | 'other';
  
  // Preferences (from registration)
  preferredJerseyNumber?: number;
  alternateJerseyNumbers?: number[];
  preferredPosition?: string;
  coachNotes?: string;              // Schedule conflicts, coach preferences, notes from parent
  
  // Medical flags (just flags, not full info - that stays on registration)
  hasMedicalInfo: boolean;
  
  // Parent info (for contact during draft)
  parentUserId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  
  // Payment status
  paymentStatus: 'paid' | 'pending' | 'partial';
  amountDue: number;
  amountPaid: number;
  
  // Draft status
  status: DraftStatus;
  draftedToTeamId?: string;
  draftedToTeamName?: string;
  draftedAt?: Timestamp;
  draftedBy?: string;              // Coach/Commissioner who drafted
  draftRound?: number;
  draftPick?: number;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// =============================================================================
// TEAM (Generated after registration closes)
// =============================================================================

export interface GeneratedTeam {
  id: string;
  programId: string;
  programName: string;
  seasonId: string;
  seasonName: string;
  ageGroupId: string;
  ageGroupName: string;
  
  name: string;                    // "CYFL 1/2 Tigers A"
  shortName?: string;              // "Tigers A"
  teamLetter?: string;             // "A", "B", "C"
  
  sport: SportType;
  color?: string;                  // Team color
  logoUrl?: string;
  
  // Roster settings
  maxRosterSize: number;
  currentRosterSize: number;
  
  // Coach assignment
  coachId?: string;
  coachName?: string;
  coachEmail?: string;
  assistantCoaches?: { id: string; name: string }[];
  
  // Status
  isActive: boolean;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// =============================================================================
// REGISTRATION INPUT (Updated for Season-based flow)
// =============================================================================

export interface SeasonRegistrationInput {
  // Season info (not team!)
  seasonId: string;
  programId: string;
  programName: string;
  seasonName: string;
  ageGroupId: string;
  ageGroupName: string;
  sport: string;
  
  // Who's registering
  parentUserId: string;
  commissionerUserId?: string;      // For notification to commissioner
  
  // Athlete info
  athleteId?: string;               // Player document ID (if linked)
  athleteFirstName: string;
  athleteLastName: string;
  athleteNickname?: string;
  athleteUsername?: string;        // Linked player's username for profile
  athleteDOB: Date;
  athleteGender: 'male' | 'female' | 'other';
  athleteGrade?: number;           // Optional grade for validation
  
  // Preferences
  preferredJerseyNumber?: number;
  alternateJerseyNumbers?: number[];
  preferredPosition?: string;
  coachNotes?: string;              // Schedule conflicts, coach preferences, notes
  
  // Parent info
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  
  // Emergency contact
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyRelationship: string;
  
  // Medical info
  medicalAllergies?: string;
  medicalConditions?: string;
  medicalMedications?: string;
  medicalNotes?: string;
  
  // Waiver
  waiverAccepted: boolean;
  
  // Payment
  amountDue: number;
  amountPaid: number;
  paymentMethod: 'online' | 'cash' | 'check' | 'free';
}

// =============================================================================
// HELPER TYPES
// =============================================================================

export interface AgeGroupRegistrationCount {
  ageGroupId: string;
  ageGroupName: string;
  count: number;
  maxCapacity?: number;
  isFull: boolean;
}

export interface TeamGenerationConfig {
  seasonId: string;
  ageGroupId: string;
  numberOfTeams: number;
  rosterSize: number;
  namingPattern: 'letter' | 'number' | 'custom';
  teamNames?: string[];            // For custom naming
  baseTeamName: string;            // "CYFL 1/2 Tigers"
}
