/**
 * Season & Program Service
 * Handles: Programs, Seasons, Registration, Draft Pool, Team Generation
 * 
 * Flow:
 * 1. Commissioner creates Program (sport + age groups)
 * 2. Commissioner creates Season under Program
 * 3. Opens registration for Season
 * 4. Parents register athletes → go into Draft Pool by age group
 * 5. Registration closes
 * 6. Commissioner generates teams for each age group
 * 7. Draft happens (live, offline, or commissioner assigns)
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  addDoc, 
  updateDoc,
  deleteDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
  increment,
  onSnapshot,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from './firebase';
import type { 
  Program, 
  Season, 
  SeasonStatus,
  AgeGroup,
  DraftPoolPlayer,
  DraftStatus,
  GeneratedTeam,
  SeasonRegistrationInput,
  TeamGenerationConfig,
  AgeGroupRegistrationCount
} from '../types/season';
import type { SportType } from '../types';

// =============================================================================
// PROGRAMS
// =============================================================================

export interface CreateProgramInput {
  name: string;
  shortName?: string;
  sport: SportType;
  description?: string;
  logoUrl?: string;
  ownerId: string;
  ownerName?: string;
  ageGroups: AgeGroup[];
  defaultRosterSize?: number;
  defaultRegistrationFee?: number;
}

export async function createProgram(input: CreateProgramInput): Promise<string> {
  const programRef = doc(collection(db, 'programs'));
  
  const program: Omit<Program, 'id'> & { id: string } = {
    id: programRef.id,
    name: input.name,
    shortName: input.shortName || input.name,
    sport: input.sport,
    description: input.description || '',
    logoUrl: input.logoUrl || '',
    ownerId: input.ownerId,
    ownerName: input.ownerName || '',
    ageGroups: input.ageGroups.map((ag, idx) => ({
      ...ag,
      sortOrder: ag.sortOrder ?? idx
    })),
    defaultRosterSize: input.defaultRosterSize ?? 15,
    defaultRegistrationFee: input.defaultRegistrationFee ?? 0,
    isActive: true,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };
  
  await setDoc(programRef, program);
  console.log('✅ Program created:', programRef.id);
  return programRef.id;
}

export async function getProgram(programId: string): Promise<Program | null> {
  const docRef = doc(db, 'programs', programId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Program;
}

export async function updateProgram(programId: string, updates: Partial<Program>): Promise<void> {
  const docRef = doc(db, 'programs', programId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
  console.log('✅ Program updated:', programId);
}

export async function getProgramsByOwner(ownerId: string): Promise<Program[]> {
  const q = query(
    collection(db, 'programs'),
    where('ownerId', '==', ownerId),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Program);
}

export async function getAllActivePrograms(): Promise<Program[]> {
  const q = query(
    collection(db, 'programs'),
    where('isActive', '==', true),
    orderBy('name')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Program);
}

// =============================================================================
// SEASONS
// =============================================================================

export interface CreateSeasonInput {
  programId: string;
  name: string;
  activeAgeGroups: AgeGroup[];
  registrationFee?: number;
  registrationOpenDate?: Date;
  registrationCloseDate?: Date;
  maxPlayersPerAgeGroup?: number;
  seasonStartDate?: Date;
  seasonEndDate?: Date;
  draftDate?: Date;
  draftType?: 'live' | 'offline' | 'commissioner';
}

export async function createSeason(input: CreateSeasonInput): Promise<string> {
  // Get program to copy data
  const program = await getProgram(input.programId);
  if (!program) throw new Error('Program not found');
  
  const seasonRef = doc(collection(db, 'seasons'));
  
  // Initialize registration counts
  const registrationCounts: Record<string, number> = {};
  input.activeAgeGroups.forEach(ag => {
    registrationCounts[ag.id] = 0;
  });
  
  const season: Omit<Season, 'id'> & { id: string } = {
    id: seasonRef.id,
    programId: program.id,
    programName: program.name,
    name: input.name,
    sport: program.sport,
    status: 'setup',
    activeAgeGroups: input.activeAgeGroups,
    registrationFee: input.registrationFee ?? program.defaultRegistrationFee,
    registrationOpenDate: input.registrationOpenDate 
      ? Timestamp.fromDate(input.registrationOpenDate) 
      : undefined,
    registrationCloseDate: input.registrationCloseDate
      ? Timestamp.fromDate(input.registrationCloseDate)
      : undefined,
    maxPlayersPerAgeGroup: input.maxPlayersPerAgeGroup,
    registrationCounts,
    totalRegistrations: 0,
    seasonStartDate: input.seasonStartDate
      ? Timestamp.fromDate(input.seasonStartDate)
      : undefined,
    seasonEndDate: input.seasonEndDate
      ? Timestamp.fromDate(input.seasonEndDate)
      : undefined,
    draftDate: input.draftDate
      ? Timestamp.fromDate(input.draftDate)
      : undefined,
    draftType: input.draftType || 'commissioner',
    ownerId: program.ownerId,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };
  
  await setDoc(seasonRef, season);
  console.log('✅ Season created:', seasonRef.id);
  return seasonRef.id;
}

export async function getSeason(seasonId: string): Promise<Season | null> {
  // First try the top-level seasons collection
  const docRef = doc(db, 'seasons', seasonId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Season;
  }
  
  // If not found, try searching in programs/{programId}/seasons using collectionGroup
  try {
    const seasonsQuery = query(
      collectionGroup(db, 'seasons'),
      where('__name__', '==', seasonId)
    );
    
    // Note: collectionGroup query by document ID doesn't work directly,
    // so we need to iterate all programs and check each one
    // For now, let's try a different approach - get all programs and check their seasons
    const programsSnap = await getDocs(collection(db, 'programs'));
    
    for (const programDoc of programsSnap.docs) {
      const seasonDocRef = doc(db, 'programs', programDoc.id, 'seasons', seasonId);
      const seasonDocSnap = await getDoc(seasonDocRef);
      
      if (seasonDocSnap.exists()) {
        return { 
          id: seasonDocSnap.id, 
          programId: programDoc.id,
          ...seasonDocSnap.data() 
        } as Season;
      }
    }
  } catch (err) {
    console.error('Error searching for season in programs:', err);
  }
  
  return null;
}

// Direct lookup when we know the programId (faster)
export async function getSeasonByProgramId(programId: string, seasonId: string): Promise<Season | null> {
  try {
    const docRef = doc(db, 'programs', programId, 'seasons', seasonId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { 
        id: docSnap.id, 
        programId,
        ...docSnap.data() 
      } as Season;
    }
  } catch (err) {
    console.error('Error getting season by program ID:', err);
  }
  
  // Fall back to general search
  return getSeason(seasonId);
}

export async function updateSeason(seasonId: string, updates: Partial<Season>): Promise<void> {
  const docRef = doc(db, 'seasons', seasonId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
  console.log('✅ Season updated:', seasonId);
}

export async function getSeasonsByProgram(programId: string): Promise<Season[]> {
  const q = query(
    collection(db, 'seasons'),
    where('programId', '==', programId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Season);
}

export async function getSeasonsByOwner(ownerId: string): Promise<Season[]> {
  const q = query(
    collection(db, 'seasons'),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Season);
}

export async function getOpenSeasons(): Promise<Season[]> {
  const q = query(
    collection(db, 'seasons'),
    where('status', '==', 'registration'),
    orderBy('registrationCloseDate', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Season);
}

// =============================================================================
// SEASON STATUS MANAGEMENT
// =============================================================================

export async function openRegistration(seasonId: string): Promise<void> {
  await updateSeason(seasonId, {
    status: 'registration',
    registrationOpenDate: serverTimestamp() as Timestamp
  });
  console.log('✅ Registration opened for season:', seasonId);
}

export async function closeRegistration(seasonId: string): Promise<void> {
  await updateSeason(seasonId, {
    status: 'closed',
    registrationCloseDate: serverTimestamp() as Timestamp
  });
  console.log('✅ Registration closed for season:', seasonId);
}

export async function startDraft(seasonId: string): Promise<void> {
  await updateSeason(seasonId, { status: 'drafting' });
  console.log('✅ Draft started for season:', seasonId);
}

export async function activateSeason(seasonId: string): Promise<void> {
  await updateSeason(seasonId, { status: 'active' });
  console.log('✅ Season activated:', seasonId);
}

export async function completeSeason(seasonId: string): Promise<void> {
  await updateSeason(seasonId, { status: 'completed' });
  console.log('✅ Season completed:', seasonId);
}

// =============================================================================
// SEASON REGISTRATION (Creates entry in simpleRegistrations + Draft Pool)
// =============================================================================

export async function registerForSeason(input: SeasonRegistrationInput): Promise<{
  registrationId: string;
  draftPoolId: string;
}> {
  // Get season to validate
  const season = await getSeason(input.seasonId);
  if (!season) throw new Error('Season not found');
  if (season.status !== 'registration') {
    throw new Error('Registration is not open for this season');
  }
  
  // Check age group capacity
  if (season.maxPlayersPerAgeGroup) {
    const currentCount = season.registrationCounts[input.ageGroupId] || 0;
    if (currentCount >= season.maxPlayersPerAgeGroup) {
      throw new Error('This age group is full');
    }
  }
  
  // Calculate athlete age
  const athleteDOB = input.athleteDOB;
  const today = new Date();
  let athleteAge = today.getFullYear() - athleteDOB.getFullYear();
  const monthDiff = today.getMonth() - athleteDOB.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < athleteDOB.getDate())) {
    athleteAge--;
  }
  
  const batch = writeBatch(db);
  
  // 1. Create registration in simpleRegistrations
  const registrationRef = doc(collection(db, 'simpleRegistrations'));
  const registrationData = {
    id: registrationRef.id,
    
    // Season-based (not event-based)
    seasonId: input.seasonId,
    programId: input.programId,
    programName: input.programName,
    seasonName: input.seasonName,
    ageGroupId: input.ageGroupId,
    ageGroupName: input.ageGroupName,
    sport: input.sport,
    
    // For backwards compatibility, set eventId to seasonId
    eventId: input.seasonId,
    eventName: `${input.programName} - ${input.seasonName}`,
    
    // Athlete info
    athleteFirstName: input.athleteFirstName,
    athleteLastName: input.athleteLastName,
    athleteFullName: `${input.athleteFirstName} ${input.athleteLastName}`,
    athleteDOB: Timestamp.fromDate(athleteDOB),
    athleteAge,
    athleteGender: input.athleteGender,
    athleteGrade: input.athleteGrade,
    
    // Preferences
    preferredJerseyNumber: input.preferredJerseyNumber || null,
    alternateJerseyNumbers: input.alternateJerseyNumbers || [],
    preferredPosition: input.preferredPosition || null,
    coachNotes: input.coachNotes || null,
    
    // Parent info
    parentUserId: input.parentUserId,
    parentName: input.parentName,
    parentEmail: input.parentEmail,
    parentPhone: input.parentPhone,
    
    // Emergency contact
    emergencyContactName: input.emergencyContactName,
    emergencyContactPhone: input.emergencyContactPhone,
    emergencyRelationship: input.emergencyRelationship,
    
    // Medical info
    medicalAllergies: input.medicalAllergies || '',
    medicalConditions: input.medicalConditions || '',
    medicalMedications: input.medicalMedications || '',
    medicalNotes: input.medicalNotes || '',
    
    // Waiver
    waiverAccepted: input.waiverAccepted,
    waiverAcceptedAt: serverTimestamp(),
    
    // Payment
    amountDue: input.amountDue,
    amountPaid: input.amountPaid,
    paymentStatus: input.amountPaid >= input.amountDue 
      ? 'paid' 
      : input.amountPaid > 0 
        ? 'partial' 
        : 'pending',
    paymentMethod: input.paymentMethod,
    
    // Status
    status: 'active',
    
    // Timestamps
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  batch.set(registrationRef, registrationData);
  
  // 2. Add to draft pool
  const draftPoolRef = doc(collection(db, `seasons/${input.seasonId}/draftPool`));
  const draftPoolData: Omit<DraftPoolPlayer, 'id'> & { id: string } = {
    id: draftPoolRef.id,
    registrationId: registrationRef.id,
    seasonId: input.seasonId,
    programId: input.programId,
    ageGroupId: input.ageGroupId,
    ageGroupName: input.ageGroupName,
    
    athleteFirstName: input.athleteFirstName,
    athleteLastName: input.athleteLastName,
    athleteFullName: `${input.athleteFirstName} ${input.athleteLastName}`,
    athleteDOB: Timestamp.fromDate(athleteDOB),
    athleteAge,
    athleteGender: input.athleteGender,
    
    preferredJerseyNumber: input.preferredJerseyNumber,
    alternateJerseyNumbers: input.alternateJerseyNumbers || [],
    preferredPosition: input.preferredPosition,
    
    hasMedicalInfo: !!(input.medicalAllergies || input.medicalConditions || input.medicalMedications),
    
    parentUserId: input.parentUserId,
    parentName: input.parentName,
    parentEmail: input.parentEmail,
    parentPhone: input.parentPhone,
    
    paymentStatus: input.amountPaid >= input.amountDue 
      ? 'paid' 
      : input.amountPaid > 0 
        ? 'partial' 
        : 'pending',
    amountDue: input.amountDue,
    amountPaid: input.amountPaid,
    
    status: 'available',
    
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };
  batch.set(draftPoolRef, draftPoolData);
  
  // 3. Increment registration counts on season
  const seasonRef = doc(db, 'seasons', input.seasonId);
  batch.update(seasonRef, {
    [`registrationCounts.${input.ageGroupId}`]: increment(1),
    totalRegistrations: increment(1),
    updatedAt: serverTimestamp()
  });
  
  await batch.commit();
  
  console.log('✅ Season registration created:', registrationRef.id);
  console.log('✅ Added to draft pool:', draftPoolRef.id);
  
  return {
    registrationId: registrationRef.id,
    draftPoolId: draftPoolRef.id
  };
}

// =============================================================================
// DRAFT POOL
// =============================================================================

export async function getSeasonDraftPool(seasonId: string): Promise<DraftPoolPlayer[]> {
  const q = query(
    collection(db, `seasons/${seasonId}/draftPool`),
    orderBy('athleteLastName'),
    orderBy('athleteFirstName')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as DraftPoolPlayer);
}

export async function getDraftPoolByAgeGroup(
  seasonId: string, 
  ageGroupId: string
): Promise<DraftPoolPlayer[]> {
  const q = query(
    collection(db, `seasons/${seasonId}/draftPool`),
    where('ageGroupId', '==', ageGroupId),
    where('status', '==', 'available'),
    orderBy('athleteLastName'),
    orderBy('athleteFirstName')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as DraftPoolPlayer);
}

export async function getAvailablePlayers(seasonId: string): Promise<DraftPoolPlayer[]> {
  const q = query(
    collection(db, `seasons/${seasonId}/draftPool`),
    where('status', '==', 'available'),
    orderBy('ageGroupId'),
    orderBy('athleteLastName')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as DraftPoolPlayer);
}

// Real-time listener for draft pool
export function subscribeToDraftPool(
  seasonId: string,
  callback: (players: DraftPoolPlayer[]) => void
): () => void {
  const q = query(
    collection(db, `seasons/${seasonId}/draftPool`),
    orderBy('ageGroupId'),
    orderBy('athleteLastName')
  );
  
  const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as DraftPoolPlayer);
    callback(players);
  });
  
  return unsubscribe;
}

// =============================================================================
// DRAFT OPERATIONS
// =============================================================================

export async function draftPlayer(
  seasonId: string,
  playerId: string,
  teamId: string,
  teamName: string,
  draftedBy: string,
  draftRound?: number,
  draftPick?: number
): Promise<void> {
  const playerRef = doc(db, `seasons/${seasonId}/draftPool`, playerId);
  
  await updateDoc(playerRef, {
    status: 'drafted',
    draftedToTeamId: teamId,
    draftedToTeamName: teamName,
    draftedAt: serverTimestamp(),
    draftedBy,
    draftRound: draftRound || null,
    draftPick: draftPick || null,
    updatedAt: serverTimestamp()
  });
  
  // Also increment team roster count
  const teamRef = doc(db, 'teams', teamId);
  await updateDoc(teamRef, {
    currentRosterSize: increment(1),
    updatedAt: serverTimestamp()
  });
  
  console.log('✅ Player drafted:', playerId, 'to team:', teamName);
}

export async function undraftPlayer(
  seasonId: string,
  playerId: string,
  teamId: string
): Promise<void> {
  const playerRef = doc(db, `seasons/${seasonId}/draftPool`, playerId);
  
  await updateDoc(playerRef, {
    status: 'available',
    draftedToTeamId: null,
    draftedToTeamName: null,
    draftedAt: null,
    draftedBy: null,
    draftRound: null,
    draftPick: null,
    updatedAt: serverTimestamp()
  });
  
  // Decrement team roster count
  const teamRef = doc(db, 'teams', teamId);
  await updateDoc(teamRef, {
    currentRosterSize: increment(-1),
    updatedAt: serverTimestamp()
  });
  
  console.log('✅ Player undrafted:', playerId);
}

// =============================================================================
// TEAM GENERATION
// =============================================================================

export async function generateTeamsForAgeGroup(config: TeamGenerationConfig): Promise<string[]> {
  const season = await getSeason(config.seasonId);
  if (!season) throw new Error('Season not found');
  
  const program = await getProgram(season.programId);
  if (!program) throw new Error('Program not found');
  
  // Find the age group
  const ageGroup = season.activeAgeGroups.find(ag => ag.id === config.ageGroupId);
  if (!ageGroup) throw new Error('Age group not found in this season');
  
  const batch = writeBatch(db);
  const teamIds: string[] = [];
  
  for (let i = 0; i < config.numberOfTeams; i++) {
    const teamRef = doc(collection(db, 'teams'));
    
    // Generate team name
    let teamName: string;
    let teamLetter: string | undefined;
    
    if (config.namingPattern === 'letter') {
      teamLetter = String.fromCharCode(65 + i); // A, B, C...
      teamName = `${config.baseTeamName} ${teamLetter}`;
    } else if (config.namingPattern === 'number') {
      teamName = `${config.baseTeamName} ${i + 1}`;
    } else if (config.teamNames && config.teamNames[i]) {
      teamName = config.teamNames[i];
    } else {
      teamName = `${config.baseTeamName} Team ${i + 1}`;
    }
    
    const teamData: Omit<GeneratedTeam, 'id'> & { id: string } = {
      id: teamRef.id,
      programId: season.programId,
      programName: season.programName,
      seasonId: config.seasonId,
      seasonName: season.name,
      ageGroupId: config.ageGroupId,
      ageGroupName: ageGroup.name,
      
      name: teamName,
      shortName: teamLetter ? `${ageGroup.shortName} ${teamLetter}` : undefined,
      teamLetter,
      
      sport: season.sport,
      
      maxRosterSize: config.rosterSize,
      currentRosterSize: 0,
      
      isActive: true,
      
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };
    
    batch.set(teamRef, teamData);
    teamIds.push(teamRef.id);
  }
  
  await batch.commit();
  
  console.log(`✅ Generated ${config.numberOfTeams} teams for age group:`, ageGroup.name);
  return teamIds;
}

export async function getSeasonTeams(seasonId: string): Promise<GeneratedTeam[]> {
  const q = query(
    collection(db, 'teams'),
    where('seasonId', '==', seasonId),
    where('isActive', '==', true),
    orderBy('ageGroupId'),
    orderBy('name')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GeneratedTeam);
}

export async function getTeamsByAgeGroup(seasonId: string, ageGroupId: string): Promise<GeneratedTeam[]> {
  const q = query(
    collection(db, 'teams'),
    where('seasonId', '==', seasonId),
    where('ageGroupId', '==', ageGroupId),
    where('isActive', '==', true),
    orderBy('name')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GeneratedTeam);
}

// =============================================================================
// REGISTRATION COUNTS & STATS
// =============================================================================

export async function getRegistrationCounts(seasonId: string): Promise<AgeGroupRegistrationCount[]> {
  const season = await getSeason(seasonId);
  if (!season) throw new Error('Season not found');
  
  return season.activeAgeGroups.map(ag => ({
    ageGroupId: ag.id,
    ageGroupName: ag.name,
    count: season.registrationCounts[ag.id] || 0,
    maxCapacity: season.maxPlayersPerAgeGroup,
    isFull: season.maxPlayersPerAgeGroup 
      ? (season.registrationCounts[ag.id] || 0) >= season.maxPlayersPerAgeGroup
      : false
  }));
}

// =============================================================================
// CANCEL REGISTRATION
// =============================================================================

export async function cancelSeasonRegistration(
  registrationId: string,
  draftPoolId: string,
  seasonId: string,
  ageGroupId: string
): Promise<void> {
  const batch = writeBatch(db);
  
  // Update registration status
  const regRef = doc(db, 'simpleRegistrations', registrationId);
  batch.update(regRef, {
    status: 'cancelled',
    updatedAt: serverTimestamp()
  });
  
  // Update draft pool status
  const draftRef = doc(db, `seasons/${seasonId}/draftPool`, draftPoolId);
  batch.update(draftRef, {
    status: 'cancelled',
    updatedAt: serverTimestamp()
  });
  
  // Decrement counts
  const seasonRef = doc(db, 'seasons', seasonId);
  batch.update(seasonRef, {
    [`registrationCounts.${ageGroupId}`]: increment(-1),
    totalRegistrations: increment(-1),
    updatedAt: serverTimestamp()
  });
  
  await batch.commit();
  console.log('✅ Registration cancelled:', registrationId);
}
