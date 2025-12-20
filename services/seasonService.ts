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
  collectionGroup,
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
  
  // Use sport-specific program name if available
  const sportLower = program.sport?.toLowerCase() || '';
  const sportNames = (program as any).sportNames as { [key: string]: string } | undefined;
  const programDisplayName = sportNames?.[sportLower] || program.name || 'Unknown Program';
  
  const season: Omit<Season, 'id'> & { id: string } = {
    id: seasonRef.id,
    programId: program.id,
    programName: programDisplayName,
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

// Direct lookup when we know the programId (faster and more reliable)
export async function getSeasonByProgramId(programId: string, seasonId: string): Promise<Season | null> {
  try {
    // First try nested collection: programs/{programId}/seasons/{seasonId}
    const nestedRef = doc(db, 'programs', programId, 'seasons', seasonId);
    const nestedSnap = await getDoc(nestedRef);
    
    if (nestedSnap.exists()) {
      console.log('[getSeasonByProgramId] Found in nested collection');
      return { 
        id: nestedSnap.id, 
        programId,
        ...nestedSnap.data() 
      } as Season;
    }
    
    // Also try top-level seasons collection
    const topLevelRef = doc(db, 'seasons', seasonId);
    const topLevelSnap = await getDoc(topLevelRef);
    
    if (topLevelSnap.exists()) {
      console.log('[getSeasonByProgramId] Found in top-level collection');
      return { 
        id: topLevelSnap.id, 
        ...topLevelSnap.data() 
      } as Season;
    }
    
    console.error('[getSeasonByProgramId] Season not found in either location:', { programId, seasonId });
    return null;
  } catch (err) {
    console.error('Error getting season by program ID:', err);
    return null;
  }
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
  // Get season to validate - use programId for direct lookup if available
  const season = input.programId 
    ? await getSeasonByProgramId(input.programId, input.seasonId)
    : await getSeason(input.seasonId);
  if (!season) throw new Error('Season not found');
  
  // Check registration status - either explicit status OR within date range
  const now = new Date();
  const regOpen = season.registrationOpenDate ? 
    (typeof season.registrationOpenDate === 'string' ? new Date(season.registrationOpenDate) : (season.registrationOpenDate as any).toDate?.() || new Date(season.registrationOpenDate)) 
    : null;
  const regClose = season.registrationCloseDate ? 
    (typeof season.registrationCloseDate === 'string' ? new Date(season.registrationCloseDate) : (season.registrationCloseDate as any).toDate?.() || new Date(season.registrationCloseDate)) 
    : null;
  
  const isWithinDates = (!regOpen || regOpen <= now) && (!regClose || regClose >= now);
  const isRegistrationStatus = season.status === 'registration' || season.status === 'registration_open';
  const isNotCompleted = season.status !== 'completed' && season.status !== 'closed';
  
  if (!isRegistrationStatus && !(isWithinDates && isNotCompleted)) {
    throw new Error('Registration is not open for this season');
  }
  
  // Check age group capacity
  if (season.maxPlayersPerAgeGroup) {
    const currentCount = season.registrationCounts[input.ageGroupId] || 0;
    if (currentCount >= season.maxPlayersPerAgeGroup) {
      throw new Error('This age group is full');
    }
  }
  
  // Check for duplicate registration - prevent same athlete registering twice for same season
  if (input.athleteId) {
    // Check by athleteId in draftPool
    const existingByAthleteId = query(
      collection(db, 'programs', input.programId, 'seasons', input.seasonId, 'draftPool'),
      where('athleteId', '==', input.athleteId)
    );
    const existingSnap = await getDocs(existingByAthleteId);
    if (!existingSnap.empty) {
      throw new Error('This athlete is already registered for this season');
    }
  } else {
    // Check by name + DOB combination for unlinked athletes
    const existingByName = query(
      collection(db, 'programs', input.programId, 'seasons', input.seasonId, 'draftPool'),
      where('athleteFirstName', '==', input.athleteFirstName),
      where('athleteLastName', '==', input.athleteLastName)
    );
    const existingNameSnap = await getDocs(existingByName);
    // Filter by DOB match
    const dobMatch = existingNameSnap.docs.find(doc => {
      const data = doc.data();
      const existingDOB = data.athleteDOB?.toDate?.() || new Date(data.athleteDOB);
      return existingDOB.getTime() === input.athleteDOB.getTime();
    });
    if (dobMatch) {
      throw new Error('This athlete is already registered for this season');
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
    athleteNickname: input.athleteNickname || null,
    athleteUsername: input.athleteUsername || null,
    athleteDOB: Timestamp.fromDate(athleteDOB),
    athleteAge,
    athleteGender: input.athleteGender,
    athleteGrade: input.athleteGrade || null,
    
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
    emergencyContactName: input.emergencyContactName || '',
    emergencyContactPhone: input.emergencyContactPhone || '',
    emergencyRelationship: input.emergencyRelationship || '',
    
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
  
  // 2. Add to draft pool - use nested path under program/season
  const draftPoolRef = doc(collection(db, `programs/${input.programId}/seasons/${input.seasonId}/draftPool`));
  const draftPoolData: Omit<DraftPoolPlayer, 'id'> & { id: string } = {
    id: draftPoolRef.id,
    registrationId: registrationRef.id,
    seasonId: input.seasonId,
    programId: input.programId,
    sport: input.sport?.toLowerCase() || 'football',
    ageGroupId: input.ageGroupId,
    ageGroupName: input.ageGroupName,
    
    // Link to the global player document for status tracking
    athleteId: input.athleteId || null,
    
    athleteFirstName: input.athleteFirstName,
    athleteLastName: input.athleteLastName,
    athleteFullName: `${input.athleteFirstName} ${input.athleteLastName}`,
    athleteNickname: input.athleteNickname || null,
    athleteUsername: input.athleteUsername || null,
    athleteDOB: Timestamp.fromDate(athleteDOB),
    athleteAge,
    athleteGender: input.athleteGender,
    
    preferredJerseyNumber: input.preferredJerseyNumber || null,
    alternateJerseyNumbers: input.alternateJerseyNumbers || [],
    preferredPosition: input.preferredPosition || null,
    coachNotes: input.coachNotes || null,
    
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
  
  // 3. Increment registration counts on season (nested under program)
  const seasonRef = doc(db, 'programs', input.programId, 'seasons', input.seasonId);
  batch.update(seasonRef, {
    [`registrationCounts.${input.ageGroupId}`]: increment(1),
    totalRegistrations: increment(1),
    updatedAt: serverTimestamp()
  });
  
  await batch.commit();
  
  // 4. Update the player document with draft pool status (outside batch for error isolation)
  if (input.athleteId) {
    try {
      const playerRef = doc(db, 'players', input.athleteId);
      await updateDoc(playerRef, {
        draftPoolStatus: 'waiting',
        draftPoolProgramId: input.programId,
        draftPoolSeasonId: input.seasonId,
        draftPoolEntryId: draftPoolRef.id,
        draftPoolSport: input.sport?.toLowerCase() || 'football',
        draftPoolAgeGroup: input.ageGroupName,
        draftPoolUpdatedAt: serverTimestamp(),
      });
      console.log('✅ Updated player document with draft pool status:', input.athleteId);
    } catch (err) {
      console.error('⚠️ Failed to update player document (non-fatal):', err);
      // Don't fail the whole registration if this update fails
    }
  }
  
  // 5. Create notification for parent (using top-level notifications collection)
  try {
    console.log('[SeasonRegistration] Creating notification for parent:', input.parentUserId);
    const notifDoc = await addDoc(collection(db, 'notifications'), {
      userId: input.parentUserId,
      type: 'registration_confirmed',
      title: '🎉 Registration Confirmed!',
      message: `${input.athleteFirstName} ${input.athleteLastName} has been registered for ${input.seasonName} (${input.ageGroupName}). They are now in the draft pool waiting for team assignment.`,
      category: 'registration',
      priority: 'normal',
      read: false,
      link: '/dashboard',
      metadata: {
        athleteName: `${input.athleteFirstName} ${input.athleteLastName}`,
        seasonName: input.seasonName,
        programName: input.programName,
        ageGroup: input.ageGroupName,
      },
      createdAt: serverTimestamp()
    });
    console.log('✅ Created parent notification with ID:', notifDoc.id);
  } catch (err) {
    console.error('⚠️ Failed to create parent notification:', err);
  }
  
  // 6. Notify commissioner of new registration
  if (input.commissionerUserId) {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: input.commissionerUserId,
        type: 'roster_update',
        title: '🏈 New Registration',
        message: `${input.athleteFirstName} ${input.athleteLastName} (${input.ageGroupName}) registered for ${input.seasonName}.`,
        category: 'team',
        priority: 'high',
        read: false,
        link: '/commissioner',
        metadata: {
          athleteName: `${input.athleteFirstName} ${input.athleteLastName}`,
          seasonName: input.seasonName,
          ageGroup: input.ageGroupName,
        },
        createdAt: serverTimestamp()
      });
      console.log('✅ Created commissioner notification');
    } catch (err) {
      console.error('⚠️ Failed to create commissioner notification:', err);
    }
  }
  
  // 7. Notify all coaches whose teams match this age group
  try {
    // Find all teams in this program with matching age group
    console.log('[SeasonRegistration] Looking for teams with programId:', input.programId);
    
    const teamsQuery = query(
      collection(db, 'teams'),
      where('programId', '==', input.programId)
    );
    const teamsSnap = await getDocs(teamsQuery);
    
    console.log('[SeasonRegistration] Found teams in program:', teamsSnap.docs.length);
    
    const coachIdsNotified = new Set<string>();
    
    for (const teamDoc of teamsSnap.docs) {
      const teamData = teamDoc.data();
      
      // Check if team age group matches (could be single like "9U" or range like "9U-10U")
      const teamAgeGroup = teamData.ageGroup || '';
      const teamAgeGroups = teamData.ageGroups || [];
      
      console.log('[SeasonRegistration] Checking team:', {
        teamId: teamDoc.id,
        teamName: teamData.name,
        teamAgeGroup,
        teamAgeGroups,
        registeredAgeGroup: input.ageGroupName,
        coachId: teamData.coachId,
        coachIds: teamData.coachIds,
        ownerId: teamData.ownerId,
      });
      
      // Match if ageGroup contains the registered age group OR is in ageGroups array
      const ageGroupMatches = 
        teamAgeGroup === input.ageGroupName ||
        teamAgeGroup.includes(input.ageGroupName) ||
        teamAgeGroups.includes(input.ageGroupName);
      
      console.log('[SeasonRegistration] Age group matches:', ageGroupMatches);
      
      if (ageGroupMatches) {
        // Get all coach IDs for this team (check all possible fields)
        const coachIds: string[] = [];
        if (teamData.headCoachId) coachIds.push(teamData.headCoachId);
        if (teamData.coachId) coachIds.push(teamData.coachId);
        if (teamData.coachIds) coachIds.push(...teamData.coachIds);
        if (teamData.offensiveCoordinatorId) coachIds.push(teamData.offensiveCoordinatorId);
        if (teamData.defensiveCoordinatorId) coachIds.push(teamData.defensiveCoordinatorId);
        if (teamData.ownerId && !coachIds.includes(teamData.ownerId)) coachIds.push(teamData.ownerId);
        
        console.log('[SeasonRegistration] Coach IDs to notify:', coachIds);
        
        // Notify each coach (avoid duplicates and don't notify commissioner twice)
        for (const coachId of coachIds) {
          console.log('[SeasonRegistration] Checking coach:', coachId, {
            alreadyNotified: coachIdsNotified.has(coachId),
            isCommissioner: coachId === input.commissionerUserId,
            isParent: coachId === input.parentUserId,
          });
          
          if (coachId && 
              !coachIdsNotified.has(coachId) && 
              coachId !== input.commissionerUserId &&
              coachId !== input.parentUserId) {
            coachIdsNotified.add(coachId);
            
            console.log('[SeasonRegistration] ✅ Sending notification to coach:', coachId);
            
            await addDoc(collection(db, 'notifications'), {
              userId: coachId,
              type: 'roster_update',
              title: '📋 New Player in Draft Pool',
              message: `${input.athleteFirstName} ${input.athleteLastName} (${input.ageGroupName}) registered for ${input.seasonName} and is available for drafting.`,
              category: 'team',
              priority: 'normal',
              read: false,
              link: '/dashboard',
              metadata: {
                athleteName: `${input.athleteFirstName} ${input.athleteLastName}`,
                seasonName: input.seasonName,
                ageGroup: input.ageGroupName,
                teamId: teamDoc.id,
                teamName: teamData.name,
              },
              createdAt: serverTimestamp()
            });
          }
        }
      }
    }
    
    if (coachIdsNotified.size > 0) {
      console.log('✅ Notified coaches:', Array.from(coachIdsNotified));
    }
  } catch (err) {
    console.error('⚠️ Failed to notify coaches (non-fatal):', err);
  }
  
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
