/**
 * League & Commissioner Service
 * Handles all league, program, and commissioner-related operations
 */

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import type { 
  League, 
  Program, 
  LeagueSeason, 
  LeagueSchedule, 
  LeagueGame, 
  PlayoffBracket, 
  Grievance,
  LeagueRequest,
  TeamScheduleAcceptance,
  Team,
  UserProfile
} from '../types';

// =============================================================================
// LEAGUE OPERATIONS
// =============================================================================

export const createLeague = async (leagueData: Omit<League, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'leagues'), {
    ...leagueData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getLeague = async (leagueId: string): Promise<League | null> => {
  const docSnap = await getDoc(doc(db, 'leagues', leagueId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as League;
};

export const updateLeague = async (leagueId: string, data: Partial<League>): Promise<void> => {
  await updateDoc(doc(db, 'leagues', leagueId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const getAllLeagues = async (): Promise<League[]> => {
  const snapshot = await getDocs(query(collection(db, 'leagues'), orderBy('name')));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as League));
};

export const getLeaguesByOwner = async (ownerId: string): Promise<League[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'leagues'), where('ownerId', '==', ownerId))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as League));
};

// =============================================================================
// PROGRAM OPERATIONS
// =============================================================================

export const createProgram = async (programData: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'programs'), {
    ...programData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getProgram = async (programId: string): Promise<Program | null> => {
  const docSnap = await getDoc(doc(db, 'programs', programId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Program;
};

export const updateProgram = async (programId: string, data: Partial<Program>): Promise<void> => {
  await updateDoc(doc(db, 'programs', programId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const getProgramsByLeague = async (leagueId: string): Promise<Program[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'programs'), where('leagueId', '==', leagueId), orderBy('name'))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Program));
};

export const getProgramsByCommissioner = async (commissionerId: string): Promise<Program[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'programs'), where('commissionerId', '==', commissionerId))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Program));
};

export const getUnaffiliatedPrograms = async (): Promise<Program[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'programs'), where('leagueId', '==', null))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Program));
};

// =============================================================================
// TEAM OPERATIONS (League-related)
// =============================================================================

export const getTeamsByProgram = async (programId: string): Promise<Team[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'teams'), where('programId', '==', programId))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
};

export const getTeamsByLeague = async (leagueId: string): Promise<Team[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'teams'), where('leagueId', '==', leagueId))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
};

export const assignTeamToProgram = async (teamId: string, programId: string, leagueId?: string): Promise<void> => {
  await updateDoc(doc(db, 'teams', teamId), {
    programId,
    leagueId: leagueId || null,
    leagueStatus: 'active',
    leagueJoinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const removeTeamFromProgram = async (teamId: string, reason: string): Promise<void> => {
  await updateDoc(doc(db, 'teams', teamId), {
    leagueStatus: 'removed',
    leagueLeftAt: serverTimestamp(),
    leagueLeftReason: reason,
    updatedAt: serverTimestamp(),
  });
};

export const linkCheerTeam = async (teamId: string, cheerTeamId: string): Promise<void> => {
  const batch = writeBatch(db);
  
  // Update the main team with linked cheer team
  batch.update(doc(db, 'teams', teamId), {
    linkedCheerTeamId: cheerTeamId,
    updatedAt: serverTimestamp(),
  });
  
  // Update the cheer team with the linked team reference
  batch.update(doc(db, 'teams', cheerTeamId), {
    linkedToTeamId: teamId,
    updatedAt: serverTimestamp(),
  });
  
  await batch.commit();
};

// =============================================================================
// LEAGUE REQUEST OPERATIONS
// =============================================================================

export const createLeagueRequest = async (requestData: Omit<LeagueRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'leagueRequests'), {
    ...requestData,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getLeagueRequestsByLeague = async (leagueId: string): Promise<LeagueRequest[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'leagueRequests'), where('leagueId', '==', leagueId), orderBy('createdAt', 'desc'))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeagueRequest));
};

export const getLeagueRequestsByProgram = async (programId: string): Promise<LeagueRequest[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'leagueRequests'), where('programId', '==', programId), orderBy('createdAt', 'desc'))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeagueRequest));
};

export const updateLeagueRequest = async (requestId: string, status: 'approved' | 'denied', reviewedBy: string, notes?: string): Promise<void> => {
  await updateDoc(doc(db, 'leagueRequests', requestId), {
    status,
    reviewedBy,
    reviewedAt: serverTimestamp(),
    reviewNotes: notes || null,
    updatedAt: serverTimestamp(),
  });
};

// =============================================================================
// GRIEVANCE OPERATIONS
// =============================================================================

export const createGrievance = async (grievanceData: Omit<Grievance, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'grievances'), {
    ...grievanceData,
    status: 'submitted',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getGrievancesByProgram = async (programId: string): Promise<Grievance[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'grievances'), where('programId', '==', programId), orderBy('createdAt', 'desc'))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grievance));
};

export const getGrievancesBySubmitter = async (userId: string): Promise<Grievance[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'grievances'), where('submittedBy', '==', userId), orderBy('createdAt', 'desc'))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grievance));
};

export const updateGrievance = async (grievanceId: string, data: Partial<Grievance>): Promise<void> => {
  await updateDoc(doc(db, 'grievances', grievanceId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const resolveGrievance = async (grievanceId: string, resolvedBy: string, resolution: string): Promise<void> => {
  await updateDoc(doc(db, 'grievances', grievanceId), {
    status: 'resolved',
    resolvedBy,
    resolvedAt: serverTimestamp(),
    resolution,
    updatedAt: serverTimestamp(),
  });
};

// =============================================================================
// SEASON OPERATIONS
// =============================================================================

export const createLeagueSeason = async (leagueId: string, seasonData: Omit<LeagueSeason, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'leagues', leagueId, 'seasons'), {
    ...seasonData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getLeagueSeasons = async (leagueId: string): Promise<LeagueSeason[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'leagues', leagueId, 'seasons'), orderBy('startDate', 'desc'))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeagueSeason));
};

export const getActiveLeagueSeason = async (leagueId: string): Promise<LeagueSeason | null> => {
  const snapshot = await getDocs(
    query(collection(db, 'leagues', leagueId, 'seasons'), where('status', '==', 'active'))
  );
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as LeagueSeason;
};

export const updateLeagueSeason = async (leagueId: string, seasonId: string, data: Partial<LeagueSeason>): Promise<void> => {
  await updateDoc(doc(db, 'leagues', leagueId, 'seasons', seasonId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

// =============================================================================
// SCHEDULE OPERATIONS
// =============================================================================

export const createLeagueSchedule = async (leagueId: string, scheduleData: Omit<LeagueSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'leagues', leagueId, 'schedules'), {
    ...scheduleData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getLeagueSchedules = async (leagueId: string): Promise<LeagueSchedule[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'leagues', leagueId, 'schedules'), orderBy('createdAt', 'desc'))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeagueSchedule));
};

export const getSchedulesBySeason = async (leagueId: string, seasonId: string): Promise<LeagueSchedule[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'leagues', leagueId, 'schedules'), where('seasonId', '==', seasonId))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeagueSchedule));
};

export const updateLeagueSchedule = async (leagueId: string, scheduleId: string, data: Partial<LeagueSchedule>): Promise<void> => {
  await updateDoc(doc(db, 'leagues', leagueId, 'schedules', scheduleId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const publishSchedule = async (leagueId: string, scheduleId: string): Promise<void> => {
  await updateDoc(doc(db, 'leagues', leagueId, 'schedules', scheduleId), {
    status: 'published',
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

// =============================================================================
// TEAM SCHEDULE ACCEPTANCE
// =============================================================================

export const createTeamScheduleAcceptance = async (acceptanceData: Omit<TeamScheduleAcceptance, 'id' | 'respondedAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'teamScheduleAcceptance'), {
    ...acceptanceData,
    status: 'pending',
  });
  return docRef.id;
};

export const getScheduleAcceptanceBySchedule = async (scheduleId: string): Promise<TeamScheduleAcceptance[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'teamScheduleAcceptance'), where('scheduleId', '==', scheduleId))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamScheduleAcceptance));
};

export const getScheduleAcceptanceByTeam = async (teamId: string): Promise<TeamScheduleAcceptance[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'teamScheduleAcceptance'), where('teamId', '==', teamId))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamScheduleAcceptance));
};

export const respondToSchedule = async (
  acceptanceId: string, 
  status: 'accepted' | 'declined', 
  respondedBy: string, 
  notes?: string
): Promise<void> => {
  await updateDoc(doc(db, 'teamScheduleAcceptance', acceptanceId), {
    status,
    respondedBy,
    respondedAt: serverTimestamp(),
    notes: notes || null,
  });
};

// =============================================================================
// PLAYOFF BRACKET OPERATIONS
// =============================================================================

export const createPlayoffBracket = async (leagueId: string, bracketData: Omit<PlayoffBracket, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'leagues', leagueId, 'brackets'), {
    ...bracketData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getPlayoffBrackets = async (leagueId: string): Promise<PlayoffBracket[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'leagues', leagueId, 'brackets'), orderBy('createdAt', 'desc'))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayoffBracket));
};

export const updatePlayoffBracket = async (leagueId: string, bracketId: string, data: Partial<PlayoffBracket>): Promise<void> => {
  await updateDoc(doc(db, 'leagues', leagueId, 'brackets', bracketId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

// =============================================================================
// COMMISSIONER SIGNUP/MANAGEMENT
// =============================================================================

export const signUpAsCommissioner = async (
  userId: string, 
  programName: string,
  sport: string,
  city: string,
  state: string,
  leagueId?: string
): Promise<{ programId: string }> => {
  const batch = writeBatch(db);
  
  // Create the program
  const programRef = doc(collection(db, 'programs'));
  batch.set(programRef, {
    name: programName,
    sport,
    city,
    state,
    commissionerId: userId,
    leagueId: leagueId || null,
    status: 'active',
    teamCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  // Update the user to be a ProgramCommissioner
  batch.update(doc(db, 'users', userId), {
    role: 'ProgramCommissioner',
    programId: programRef.id,
    leagueId: leagueId || null,
    commissionerSince: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  await batch.commit();
  
  return { programId: programRef.id };
};

export const assignLeagueOwner = async (userId: string, leagueId: string): Promise<void> => {
  const batch = writeBatch(db);
  
  // Update the user to be a LeagueOwner
  batch.update(doc(db, 'users', userId), {
    role: 'LeagueOwner',
    leagueId,
    updatedAt: serverTimestamp(),
  });
  
  // Update the league with the owner
  batch.update(doc(db, 'leagues', leagueId), {
    ownerId: userId,
    updatedAt: serverTimestamp(),
  });
  
  await batch.commit();
};

export const addAssistantCommissioner = async (
  userId: string, 
  programId: string
): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), {
    isAssistantCommissioner: true,
    assistantForProgramId: programId,
    updatedAt: serverTimestamp(),
  });
};

export const removeAssistantCommissioner = async (userId: string): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), {
    isAssistantCommissioner: false,
    assistantForProgramId: null,
    updatedAt: serverTimestamp(),
  });
};

// =============================================================================
// SEASON LIFECYCLE (Start/End with Registration & Roster Clearing)
// =============================================================================

/**
 * Start a league season
 * - Sets status to 'active'
 * - Opens registration for teams
 */
export const startLeagueSeason = async (leagueId: string, seasonId: string): Promise<void> => {
  const batch = writeBatch(db);
  
  // Update season status to active
  batch.update(doc(db, 'leagues', leagueId, 'seasons', seasonId), {
    status: 'active',
    registrationOpen: true,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  await batch.commit();
};

/**
 * Close registration for a season
 */
export const closeSeasonRegistration = async (leagueId: string, seasonId: string): Promise<void> => {
  await updateDoc(doc(db, 'leagues', leagueId, 'seasons', seasonId), {
    registrationOpen: false,
    updatedAt: serverTimestamp(),
  });
};

/**
 * End a league season
 * - Sets status to 'completed'
 * - Archives player stats for history
 * - Clears all rosters from all teams in the league
 */
export const endLeagueSeason = async (leagueId: string, seasonId: string): Promise<{
  teamsCleared: number;
  playersRemoved: number;
}> => {
  // Get all programs in the league
  const programsSnap = await getDocs(
    query(collection(db, 'programs'), where('leagueId', '==', leagueId))
  );
  
  let teamsCleared = 0;
  let playersRemoved = 0;
  
  // For each program, get teams and clear rosters
  for (const programDoc of programsSnap.docs) {
    const teamsSnap = await getDocs(
      query(collection(db, 'teams'), where('programId', '==', programDoc.id))
    );
    
    for (const teamDoc of teamsSnap.docs) {
      const teamData = teamDoc.data();
      const currentRoster = teamData.roster || [];
      
      if (currentRoster.length > 0) {
        // Archive roster to season history
        await addDoc(collection(db, 'seasonRosterHistory'), {
          teamId: teamDoc.id,
          teamName: teamData.name,
          programId: programDoc.id,
          leagueId,
          seasonId,
          roster: currentRoster,
          archivedAt: serverTimestamp(),
        });
        
        playersRemoved += currentRoster.length;
        
        // Clear the roster
        await updateDoc(doc(db, 'teams', teamDoc.id), {
          roster: [],
          rosterCount: 0,
          updatedAt: serverTimestamp(),
        });
        
        teamsCleared++;
      }
    }
  }
  
  // Archive season stats (team standings)
  const schedulesSnap = await getDocs(
    query(collection(db, 'leagues', leagueId, 'schedules'), where('seasonId', '==', seasonId))
  );
  
  // Calculate final standings
  const teamStats: Record<string, { wins: number; losses: number; ties: number; pf: number; pa: number }> = {};
  
  schedulesSnap.docs.forEach(schedDoc => {
    const schedule = schedDoc.data();
    (schedule.games || []).forEach((game: any) => {
      if (game.status !== 'completed') return;
      
      if (!teamStats[game.homeTeamId]) teamStats[game.homeTeamId] = { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 };
      if (!teamStats[game.awayTeamId]) teamStats[game.awayTeamId] = { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 };
      
      teamStats[game.homeTeamId].pf += game.homeScore || 0;
      teamStats[game.homeTeamId].pa += game.awayScore || 0;
      teamStats[game.awayTeamId].pf += game.awayScore || 0;
      teamStats[game.awayTeamId].pa += game.homeScore || 0;
      
      if ((game.homeScore || 0) > (game.awayScore || 0)) {
        teamStats[game.homeTeamId].wins++;
        teamStats[game.awayTeamId].losses++;
      } else if ((game.awayScore || 0) > (game.homeScore || 0)) {
        teamStats[game.awayTeamId].wins++;
        teamStats[game.homeTeamId].losses++;
      } else {
        teamStats[game.homeTeamId].ties++;
        teamStats[game.awayTeamId].ties++;
      }
    });
  });
  
  // Save final standings to history
  await addDoc(collection(db, 'seasonStandingsHistory'), {
    leagueId,
    seasonId,
    standings: teamStats,
    archivedAt: serverTimestamp(),
  });
  
  // Update season status to completed
  await updateDoc(doc(db, 'leagues', leagueId, 'seasons', seasonId), {
    status: 'completed',
    registrationOpen: false,
    endedAt: serverTimestamp(),
    teamsCleared,
    playersRemoved,
    updatedAt: serverTimestamp(),
  });
  
  return { teamsCleared, playersRemoved };
};

/**
 * Move season to playoffs
 */
export const moveSeasonToPlayoffs = async (leagueId: string, seasonId: string): Promise<void> => {
  await updateDoc(doc(db, 'leagues', leagueId, 'seasons', seasonId), {
    status: 'playoffs',
    registrationOpen: false,
    playoffsStartedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

