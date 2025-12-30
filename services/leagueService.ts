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
import { notifyInfractionFiled } from './notificationService';
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

/**
 * Release all players from a team's roster
 * - Deletes all docs from teams/{teamId}/players subcollection
 * - Clears team-related fields from top-level players/{athleteId} documents
 * - Updates teamHistory to mark season as ended (for stat history tracking)
 * - Returns count of players released
 */
export const releaseAllPlayersFromTeam = async (teamId: string): Promise<number> => {
  // First get team info for history tracking
  const teamDoc = await getDoc(doc(db, 'teams', teamId));
  const teamData = teamDoc.exists() ? teamDoc.data() : null;
  const teamName = teamData?.name || 'Unknown Team';
  const programId = teamData?.programId || '';
  
  const playersSnapshot = await getDocs(collection(db, 'teams', teamId, 'players'));
  
  if (playersSnapshot.empty) {
    return 0;
  }
  
  const batch = writeBatch(db);
  let count = 0;
  
  for (const playerDoc of playersSnapshot.docs) {
    const playerData = playerDoc.data();
    
    // 1. Delete from team roster subcollection
    batch.delete(playerDoc.ref);
    
    // 2. Clear team fields AND update teamHistory on top-level athlete profile
    const athleteId = playerData.athleteId;
    if (athleteId) {
      const athleteRef = doc(db, 'players', athleteId);
      
      // Get current athlete data to update teamHistory
      const athleteSnap = await getDoc(athleteRef);
      if (athleteSnap.exists()) {
        const athleteData = athleteSnap.data();
        const teamHistory = athleteData.teamHistory || [];
        
        // Find and update the matching history entry
        const updatedHistory = teamHistory.map((entry: any) => {
          if (entry.teamId === teamId && entry.status === 'active') {
            return {
              ...entry,
              leftAt: new Date(),
              status: 'season_ended'
            };
          }
          return entry;
        });
        
        // If no history entry exists for this team, add one (backfill)
        const hasEntry = teamHistory.some((e: any) => e.teamId === teamId);
        if (!hasEntry && programId) {
          updatedHistory.push({
            teamId,
            teamName,
            programId,
            programName: teamData?.programName || '',
            sport: teamData?.sport || 'football',
            seasonId: teamData?.currentSeasonId || null,
            seasonYear: new Date().getFullYear(),
            ageGroup: playerData.ageGroup || teamData?.ageGroup || null,
            joinedAt: playerData.draftedAt || playerData.createdAt || new Date(),
            leftAt: new Date(),
            status: 'season_ended'
          });
        }
        
        batch.update(athleteRef, {
          teamId: null,
          teamName: null,
          isStarter: false,
          isCaptain: false,
          number: null,
          position: null,
          removedFromTeamAt: serverTimestamp(),
          teamHistory: updatedHistory
        });
      }
    } else if (playerData.parentId) {
      // Fallback: Find athlete by parentId + teamId match
      const athleteQuery = query(
        collection(db, 'players'),
        where('parentId', '==', playerData.parentId),
        where('teamId', '==', teamId)
      );
      const athleteSnap = await getDocs(athleteQuery);
      for (const athleteDoc of athleteSnap.docs) {
        const athleteData = athleteDoc.data();
        // Match by name to be safe
        const playerName = playerData.name || `${playerData.firstName} ${playerData.lastName}`;
        if (athleteData.name === playerName || `${athleteData.firstName} ${athleteData.lastName}` === playerName) {
          const teamHistory = athleteData.teamHistory || [];
          
          // Find and update the matching history entry
          const updatedHistory = teamHistory.map((entry: any) => {
            if (entry.teamId === teamId && entry.status === 'active') {
              return {
                ...entry,
                leftAt: new Date(),
                status: 'season_ended'
              };
            }
            return entry;
          });
          
          // If no history entry exists, add one (backfill)
          const hasEntry = teamHistory.some((e: any) => e.teamId === teamId);
          if (!hasEntry && programId) {
            updatedHistory.push({
              teamId,
              teamName,
              programId,
              programName: teamData?.programName || '',
              sport: teamData?.sport || 'football',
              seasonId: teamData?.currentSeasonId || null,
              seasonYear: new Date().getFullYear(),
              ageGroup: playerData.ageGroup || teamData?.ageGroup || null,
              joinedAt: playerData.draftedAt || playerData.createdAt || new Date(),
              leftAt: new Date(),
              status: 'season_ended'
            });
          }
          
          batch.update(doc(db, 'players', athleteDoc.id), {
            teamId: null,
            teamName: null,
            isStarter: false,
            isCaptain: false,
            number: null,
            position: null,
            removedFromTeamAt: serverTimestamp(),
            teamHistory: updatedHistory
          });
          break;
        }
      }
    }
    
    count++;
  }
  
  await batch.commit();
  console.log(`[leagueService] Released ${count} players from team ${teamId} (teamHistory updated)`);
  return count;
};

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
  // Query from top-level leagueSeasons collection (not subcollection)
  const snapshot = await getDocs(
    query(
      collection(db, 'leagueSeasons'), 
      where('leagueId', '==', leagueId),
      orderBy('startDate', 'desc')
    )
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeagueSeason));
};

export const getActiveLeagueSeason = async (leagueId: string): Promise<LeagueSeason | null> => {
  const snapshot = await getDocs(
    query(
      collection(db, 'leagueSeasons'), 
      where('leagueId', '==', leagueId),
      where('status', '==', 'active')
    )
  );
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as LeagueSeason;
};

export const updateLeagueSeason = async (leagueId: string, seasonId: string, data: Partial<LeagueSeason>): Promise<void> => {
  // Seasons are stored in top-level leagueSeasons collection
  await updateDoc(doc(db, 'leagueSeasons', seasonId), {
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
      
      // Get players from subcollection for archiving
      const playersSnap = await getDocs(collection(db, 'teams', teamDoc.id, 'players'));
      const rosterToArchive = playersSnap.docs.map(p => ({ id: p.id, ...p.data() }));
      
      if (rosterToArchive.length > 0) {
        // Archive roster to season history
        await addDoc(collection(db, 'seasonRosterHistory'), {
          teamId: teamDoc.id,
          teamName: teamData.name,
          programId: programDoc.id,
          leagueId,
          seasonId,
          roster: rosterToArchive,
          archivedAt: serverTimestamp(),
        });
        
        // Release all players properly (clears subcollection AND top-level athlete profiles)
        const releasedCount = await releaseAllPlayersFromTeam(teamDoc.id);
        playersRemoved += releasedCount;
        
        // Also clear legacy roster array if it exists
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
  
  // Send notifications to all relevant parties
  const usersToNotify: string[] = [];
  
  // Get league owner
  const leagueDoc = await getDoc(doc(db, 'leagues', infractionData.leagueId));
  const leagueData = leagueDoc.data();
  if (leagueData?.ownerId) {
    usersToNotify.push(leagueData.ownerId);
  }
  
  // Add team director
  if (teamDirectorId) {
    usersToNotify.push(teamDirectorId);
  }
  
  // Add head coach
  if (headCoachId) {
    usersToNotify.push(headCoachId);
  }
  
  // Send infraction filed notifications
  if (usersToNotify.length > 0) {
    try {
      await notifyInfractionFiled(
        usersToNotify,
        teamData?.name || 'Unknown Team',
        infractionData.title,
        infractionData.severity,
        infractionRef.id
      );
    } catch (notifErr) {
      console.error('Error sending infraction notifications:', notifErr);
      // Don't fail the operation if notifications fail
    }
  }
  
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

// =============================================================================
// TEAM FINALIZATION FOR LEAGUE SEASONS
// =============================================================================

/**
 * Finalize a program's teams for a league season
 * This locks in the teams so the league can create schedules
 */
export const finalizeTeamsForSeason = async (
  leagueId: string,
  seasonId: string,
  programId: string,
  programName: string,
  teamIds: string[],
  userId: string,
  userName: string
): Promise<void> => {
  // Seasons are stored in top-level leagueSeasons collection
  const seasonRef = doc(db, 'leagueSeasons', seasonId);
  const seasonSnap = await getDoc(seasonRef);
  
  if (!seasonSnap.exists()) {
    throw new Error('Season not found');
  }
  
  const seasonData = seasonSnap.data();
  const currentFinalizations = seasonData.programFinalizations || {};
  
  // Update this program's finalization
  currentFinalizations[programId] = {
    finalized: true,
    finalizedAt: serverTimestamp(),
    finalizedBy: userId,
    finalizedByName: userName,
    teamCount: teamIds.length,
    teamIds,
    programName
  };
  
  // Check if all programs in the league are now finalized
  // Get member programs by querying programs with this leagueId
  const programsSnap = await getDocs(
    query(collection(db, 'programs'), where('leagueId', '==', leagueId))
  );
  const memberProgramIds = programsSnap.docs.map(d => d.id);
  
  const allFinalized = memberProgramIds.length > 0 && memberProgramIds.every((pid: string) => 
    currentFinalizations[pid]?.finalized === true
  );
  
  await updateDoc(seasonRef, {
    programFinalizations: currentFinalizations,
    allProgramsFinalized: allFinalized,
    updatedAt: serverTimestamp()
  });
};

/**
 * Unfinalize a program's teams (unlock for editing)
 * Only league owner can do this
 */
export const unfinalizeTeamsForSeason = async (
  leagueId: string,
  seasonId: string,
  programId: string
): Promise<void> => {
  // Seasons are stored in top-level leagueSeasons collection
  const seasonRef = doc(db, 'leagueSeasons', seasonId);
  const seasonSnap = await getDoc(seasonRef);
  
  if (!seasonSnap.exists()) {
    throw new Error('Season not found');
  }
  
  const seasonData = seasonSnap.data();
  const currentFinalizations = seasonData.programFinalizations || {};
  
  if (currentFinalizations[programId]) {
    currentFinalizations[programId] = {
      ...currentFinalizations[programId],
      finalized: false
    };
  }
  
  await updateDoc(seasonRef, {
    programFinalizations: currentFinalizations,
    allProgramsFinalized: false, // If we're unlocking one, not all are finalized
    updatedAt: serverTimestamp()
  });
};

/**
 * Get finalization status for a season
 */
export const getSeasonFinalizationStatus = async (
  leagueId: string,
  seasonId: string
): Promise<{
  programFinalizations: { [programId: string]: any };
  allProgramsFinalized: boolean;
  totalPrograms: number;
  finalizedCount: number;
}> => {
  // Seasons are stored in top-level leagueSeasons collection
  const seasonSnap = await getDoc(doc(db, 'leagueSeasons', seasonId));
  
  if (!seasonSnap.exists()) {
    return { 
      programFinalizations: {}, 
      allProgramsFinalized: false, 
      totalPrograms: 0, 
      finalizedCount: 0 
    };
  }
  
  // Get member programs by querying programs with this leagueId
  const programsSnap = await getDocs(
    query(collection(db, 'programs'), where('leagueId', '==', leagueId))
  );
  const memberProgramIds = programsSnap.docs.map(d => d.id);
  
  const seasonData = seasonSnap.data();
  const programFinalizations = seasonData.programFinalizations || {};
  
  const finalizedCount = memberProgramIds.filter((pid: string) => 
    programFinalizations[pid]?.finalized === true
  ).length;
  
  const allFinalized = memberProgramIds.length > 0 && 
    memberProgramIds.every((pid: string) => programFinalizations[pid]?.finalized === true);
  
  return {
    programFinalizations,
    allProgramsFinalized: allFinalized,
    totalPrograms: memberProgramIds.length,
    finalizedCount
  };
};

/**
 * Get teams for a program that are part of a league season
 */
export const getTeamsForProgramSeason = async (
  programId: string,
  leagueId: string,
  seasonId: string,
  ageGroups?: string[]
): Promise<Team[]> => {
  // Get teams that belong to this program and are linked to this league
  let q = query(
    collection(db, 'teams'),
    where('programId', '==', programId),
    where('leagueId', '==', leagueId)
  );
  
  const snapshot = await getDocs(q);
  let teams = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Team));
  
  // Filter by age groups if specified
  if (ageGroups && ageGroups.length > 0) {
    teams = teams.filter(t => {
      if (!t.ageGroup) return true; // Include teams without age group
      return ageGroups.some(ag => t.ageGroup?.includes(ag) || ag.includes(t.ageGroup || ''));
    });
  }
  
  return teams;
};