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
  UserProfile,
  Infraction, 
  InfractionThread, 
  InfractionMessage
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
  
  // If joining a league, sync the league's rules to the team
  if (leagueId) {
    try {
      await syncLeagueRulesToTeam(teamId, leagueId);
    } catch (error) {
      console.error('Failed to sync league rules to team:', error);
      // Don't fail the join if rules sync fails
    }
  }
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

// =============================================================================
// RULES SYNC (League -> Team)
// =============================================================================

/**
 * Syncs league rules and code of conduct to a team when they join the league.
 * Preserves the team's teamOnlyRules and teamOnlyCodeOfConduct.
 */
export const syncLeagueRulesToTeam = async (teamId: string, leagueId: string): Promise<void> => {
  const league = await getLeague(leagueId);
  if (!league) {
    throw new Error('League not found');
  }
  
  const updateData: any = {
    updatedAt: serverTimestamp(),
  };
  
  // Sync league rules to team (overwrite team's main rules with league source)
  if (league.rules) {
    updateData.rules = {
      ...league.rules,
      source: 'league',
      leagueOverride: true,
    };
  }
  
  // Sync league code of conduct to team
  if (league.codeOfConduct) {
    updateData.codeOfConduct = {
      ...league.codeOfConduct,
      source: 'league',
      leagueOverride: true,
    };
  }
  
  await updateDoc(doc(db, 'teams', teamId), updateData);
};

/**
 * Updates a team's league rules when the league rules are updated.
 * Call this when a league owner updates the league's rules.
 */
export const syncLeagueRulesToAllTeams = async (leagueId: string): Promise<number> => {
  const league = await getLeague(leagueId);
  if (!league) {
    throw new Error('League not found');
  }
  
  const teams = await getTeamsByLeague(leagueId);
  const batch = writeBatch(db);
  let count = 0;
  
  for (const team of teams) {
    if (team.leagueStatus === 'active') {
      const updateData: any = {
        updatedAt: serverTimestamp(),
      };
      
      if (league.rules) {
        updateData.rules = {
          ...league.rules,
          source: 'league',
          leagueOverride: true,
        };
      }
      
      if (league.codeOfConduct) {
        updateData.codeOfConduct = {
          ...league.codeOfConduct,
          source: 'league',
          leagueOverride: true,
        };
      }
      
      batch.update(doc(db, 'teams', team.id), updateData);
      count++;
    }
  }
  
  if (count > 0) {
    await batch.commit();
  }
  
  return count;
};

// =============================================================================
// INFRACTION OPERATIONS (Referee System)
// =============================================================================

/**
 * Creates a new infraction report from a referee.
 * Automatically creates an infraction chat thread.
 */
export const createInfraction = async (
  infractionData: Omit<Infraction, 'id' | 'createdAt' | 'updatedAt' | 'chatThreadId'>
): Promise<{ infractionId: string; threadId: string }> => {
  const batch = writeBatch(db);
  
  // Create the infraction document
  const infractionRef = doc(collection(db, 'infractions'));
  const threadRef = doc(collection(db, 'infractionThreads'));
  
  // Get team director and head coach info
  const teamDoc = await getDoc(doc(db, 'teams', infractionData.teamId));
  const teamData = teamDoc.data();
  const teamDirectorId = teamData?.coachId; // Team director is the owner/manager
  const headCoachId = teamData?.headCoachId; // Head coach is separate from director
  const headCoachName = teamData?.headCoachName;
  
  // Create thread for 4-way communication: League, Referee, Team Director, Head Coach
  const threadData: Omit<InfractionThread, 'id'> = {
    infractionId: infractionRef.id,
    participants: {
      leagueId: infractionData.leagueId,
      refereeId: infractionData.reportedBy,
      refereeName: infractionData.reportedByName,
      teamDirectorId: teamDirectorId || undefined,
      teamId: infractionData.teamId,
      headCoachId: headCoachId || undefined,
      headCoachName: headCoachName || undefined,
    },
    status: 'active',
    createdAt: serverTimestamp() as any,
    unreadByLeague: 1,
    unreadByReferee: 0,
    unreadByTeam: 1,
    unreadByHeadCoach: headCoachId ? 1 : 0, // Only count if head coach exists
  };
  
  batch.set(threadRef, threadData);
  
  // Create infraction with thread reference
  batch.set(infractionRef, {
    ...infractionData,
    chatThreadId: threadRef.id,
    status: 'submitted',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  // Create initial system message in thread
  const messageRef = doc(collection(db, 'infractionThreads', threadRef.id, 'messages'));
  batch.set(messageRef, {
    threadId: threadRef.id,
    senderId: 'system',
    senderName: 'System',
    senderRole: 'referee',
    content: `Infraction reported: ${infractionData.title}\n\nSeverity: ${infractionData.severity}\nCategory: ${infractionData.category}\n\n${infractionData.description}`,
    createdAt: serverTimestamp(),
  });
  
  await batch.commit();
  
  return { 
    infractionId: infractionRef.id, 
    threadId: threadRef.id 
  };
};

/**
 * Get all infractions for a league
 */
export const getInfractionsByLeague = async (leagueId: string): Promise<Infraction[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'infractions'), where('leagueId', '==', leagueId), orderBy('createdAt', 'desc'))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Infraction));
};

/**
 * Get all infractions for a team
 */
export const getInfractionsByTeam = async (teamId: string): Promise<Infraction[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'infractions'), where('teamId', '==', teamId), orderBy('createdAt', 'desc'))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Infraction));
};

/**
 * Get all infractions reported by a referee
 */
export const getInfractionsByReferee = async (refereeId: string): Promise<Infraction[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'infractions'), where('reportedBy', '==', refereeId), orderBy('createdAt', 'desc'))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Infraction));
};

/**
 * Get a single infraction
 */
export const getInfraction = async (infractionId: string): Promise<Infraction | null> => {
  const docSnap = await getDoc(doc(db, 'infractions', infractionId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Infraction;
};

/**
 * Update infraction (for commissioners/league owners)
 */
export const updateInfraction = async (infractionId: string, data: Partial<Infraction>): Promise<void> => {
  await updateDoc(doc(db, 'infractions', infractionId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Resolve an infraction with consequence
 */
export const resolveInfraction = async (
  infractionId: string, 
  resolvedBy: string, 
  consequence?: Infraction['consequence']
): Promise<void> => {
  await updateDoc(doc(db, 'infractions', infractionId), {
    status: 'resolved',
    resolvedBy,
    resolvedAt: serverTimestamp(),
    consequence: consequence || null,
    updatedAt: serverTimestamp(),
  });
  
  // Close the chat thread
  const infraction = await getInfraction(infractionId);
  if (infraction?.chatThreadId) {
    await updateDoc(doc(db, 'infractionThreads', infraction.chatThreadId), {
      status: 'closed',
    });
  }
};

/**
 * Dismiss an infraction
 */
export const dismissInfraction = async (infractionId: string, dismissedBy: string): Promise<void> => {
  await updateDoc(doc(db, 'infractions', infractionId), {
    status: 'dismissed',
    resolvedBy: dismissedBy,
    resolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  // Close the chat thread
  const infraction = await getInfraction(infractionId);
  if (infraction?.chatThreadId) {
    await updateDoc(doc(db, 'infractionThreads', infraction.chatThreadId), {
      status: 'closed',
    });
  }
};

/**
 * Appeal an infraction (team director)
 */
export const appealInfraction = async (infractionId: string, appealReason: string): Promise<void> => {
  await updateDoc(doc(db, 'infractions', infractionId), {
    status: 'appealed',
    appealedAt: serverTimestamp(),
    appealReason,
    updatedAt: serverTimestamp(),
  });
};

// =============================================================================
// INFRACTION THREAD MESSAGING
// =============================================================================

/**
 * Send a message in an infraction thread
 */
export const sendInfractionMessage = async (
  threadId: string,
  senderId: string,
  senderName: string,
  senderRole: 'league' | 'referee' | 'team' | 'headcoach',
  content: string,
  attachments?: InfractionMessage['attachments']
): Promise<string> => {
  const batch = writeBatch(db);
  
  // Add message
  const messageRef = doc(collection(db, 'infractionThreads', threadId, 'messages'));
  batch.set(messageRef, {
    threadId,
    senderId,
    senderName,
    senderRole,
    content,
    attachments: attachments || null,
    createdAt: serverTimestamp(),
    readBy: [senderId],
  });
  
  // Update thread with last message time and increment unread for others
  const unreadUpdates: any = {
    lastMessageAt: serverTimestamp(),
  };
  
  if (senderRole !== 'league') unreadUpdates['unreadByLeague'] = (await getDoc(doc(db, 'infractionThreads', threadId))).data()?.unreadByLeague + 1 || 1;
  if (senderRole !== 'referee') unreadUpdates['unreadByReferee'] = (await getDoc(doc(db, 'infractionThreads', threadId))).data()?.unreadByReferee + 1 || 1;
  if (senderRole !== 'team') unreadUpdates['unreadByTeam'] = (await getDoc(doc(db, 'infractionThreads', threadId))).data()?.unreadByTeam + 1 || 1;
  if (senderRole !== 'headcoach') unreadUpdates['unreadByHeadCoach'] = (await getDoc(doc(db, 'infractionThreads', threadId))).data()?.unreadByHeadCoach + 1 || 1;
  
  batch.update(doc(db, 'infractionThreads', threadId), unreadUpdates);
  
  await batch.commit();
  
  return messageRef.id;
};

/**
 * Get messages for an infraction thread
 */
export const getInfractionMessages = async (threadId: string): Promise<InfractionMessage[]> => {
  const snapshot = await getDocs(
    query(
      collection(db, 'infractionThreads', threadId, 'messages'),
      orderBy('createdAt', 'asc')
    )
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InfractionMessage));
};

/**
 * Mark messages as read for a user
 */
export const markInfractionMessagesRead = async (threadId: string, userId: string, role: 'league' | 'referee' | 'team' | 'headcoach'): Promise<void> => {
  const resetField = role === 'league' ? 'unreadByLeague' 
    : role === 'referee' ? 'unreadByReferee' 
    : role === 'headcoach' ? 'unreadByHeadCoach'
    : 'unreadByTeam';
  
  await updateDoc(doc(db, 'infractionThreads', threadId), {
    [resetField]: 0,
  });
};

/**
 * Get infraction thread
 */
export const getInfractionThread = async (threadId: string): Promise<InfractionThread | null> => {
  const docSnap = await getDoc(doc(db, 'infractionThreads', threadId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as InfractionThread;
};

/**
 * Get infraction threads for a user
 */
export const getInfractionThreadsForUser = async (userId: string, role: 'league' | 'referee' | 'team' | 'headcoach'): Promise<InfractionThread[]> => {
  let fieldPath: string;
  if (role === 'league') fieldPath = 'participants.leagueRepId';
  else if (role === 'referee') fieldPath = 'participants.refereeId';
  else if (role === 'headcoach') fieldPath = 'participants.headCoachId';
  else fieldPath = 'participants.teamDirectorId';
  
  const snapshot = await getDocs(
    query(collection(db, 'infractionThreads'), where(fieldPath, '==', userId))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InfractionThread));
};
