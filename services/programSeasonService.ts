/**
 * Program Season Service
 * Handles program-level seasons and registration pools
 * 
 * Flow:
 * 1. Commissioner creates a ProgramSeason with sports & age group configs
 * 2. System auto-creates RegistrationPool for each sport + age group
 * 3. Players register → land in appropriate pool based on DOB
 * 4. Commissioner creates teams from pools
 * 5. If 1 team → auto-assign. If 2+ teams → draft
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import {
  ProgramSeason,
  RegistrationPool,
  PoolPlayer,
  DraftEvent,
  DraftPick,
  SportAgeGroupConfig,
  AgeGroupDivision,
  SportType,
  calculateAgeGroup,
  getBirthYearRange,
  isPlayerEligibleForDivision
} from '../types';

// =============================================================================
// PROGRAM SEASONS
// =============================================================================

/**
 * Create a new program season
 * This will also auto-create registration pools for each sport + age group
 */
export async function createProgramSeason(
  programId: string,
  programName: string,
  seasonData: Omit<ProgramSeason, 'id' | 'programId' | 'programName' | 'createdAt' | 'updatedAt' | 'totalRegistrations' | 'totalPools' | 'poolsReadyForDraft'>
): Promise<string> {
  const batch = writeBatch(db);
  
  // Create the season document
  const seasonRef = doc(collection(db, 'programs', programId, 'seasons'));
  const seasonId = seasonRef.id;
  
  const season: ProgramSeason = {
    ...seasonData,
    id: seasonId,
    programId,
    programName,
    totalRegistrations: 0,
    totalPools: 0,
    poolsReadyForDraft: 0,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp
  };
  
  batch.set(seasonRef, season);
  
  // Auto-create registration pools for each sport + age group
  let poolCount = 0;
  
  for (const sportConfig of seasonData.sportsOffered) {
    for (const division of sportConfig.ageGroups) {
      const poolId = `${sportConfig.sport}_${division.id}`;
      const poolRef = doc(db, 'programs', programId, 'seasons', seasonId, 'pools', poolId);
      
      const pool: RegistrationPool = {
        id: poolId,
        programId,
        programName,
        seasonId,
        seasonName: seasonData.name,
        sport: sportConfig.sport,
        ageGroupDivisionId: division.id,
        ageGroups: division.ageGroups,
        ageGroupLabel: division.label,
        ageGroupType: division.type,
        minBirthYear: division.minBirthYear,
        maxBirthYear: division.maxBirthYear,
        status: 'open',
        playerCount: 0,
        minPlayersPerTeam: getMinPlayersForSport(sportConfig.sport),
        maxPlayersPerTeam: getMaxPlayersForSport(sportConfig.sport),
        recommendedTeamCount: 0,
        teamCount: 0,
        teamIds: [],
        teamNames: [],
        requiresDraft: false,
        draftStatus: 'not_needed',
        registrationFee: seasonData.registrationFee, // Can be overridden
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      };
      
      batch.set(poolRef, pool);
      poolCount++;
    }
  }
  
  // Update pool count on season
  batch.update(seasonRef, { totalPools: poolCount });
  
  // Update program with current season
  const programRef = doc(db, 'programs', programId);
  batch.update(programRef, {
    currentSeasonId: seasonId,
    updatedAt: serverTimestamp()
  });
  
  await batch.commit();
  
  return seasonId;
}

/**
 * Get all seasons for a program
 */
export async function getProgramSeasons(programId: string): Promise<ProgramSeason[]> {
  const seasonsRef = collection(db, 'programs', programId, 'seasons');
  const snapshot = await getDocs(seasonsRef);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ProgramSeason[];
}

/**
 * Get a specific program season
 */
export async function getProgramSeason(programId: string, seasonId: string): Promise<ProgramSeason | null> {
  const seasonRef = doc(db, 'programs', programId, 'seasons', seasonId);
  const snapshot = await getDoc(seasonRef);
  
  if (!snapshot.exists()) return null;
  
  return {
    id: snapshot.id,
    ...snapshot.data()
  } as ProgramSeason;
}

/**
 * Update program season status
 */
export async function updateSeasonStatus(
  programId: string,
  seasonId: string,
  status: ProgramSeason['status']
): Promise<void> {
  const seasonRef = doc(db, 'programs', programId, 'seasons', seasonId);
  await updateDoc(seasonRef, {
    status,
    updatedAt: serverTimestamp()
  });
}

// =============================================================================
// REGISTRATION POOLS
// =============================================================================

/**
 * Get all pools for a season
 */
export async function getSeasonPools(programId: string, seasonId: string): Promise<RegistrationPool[]> {
  const poolsRef = collection(db, 'programs', programId, 'seasons', seasonId, 'pools');
  const snapshot = await getDocs(poolsRef);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as RegistrationPool[];
}

/**
 * Get pools for a specific sport in a season
 */
export async function getPoolsBySport(
  programId: string,
  seasonId: string,
  sport: SportType
): Promise<RegistrationPool[]> {
  const poolsRef = collection(db, 'programs', programId, 'seasons', seasonId, 'pools');
  const q = query(poolsRef, where('sport', '==', sport));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as RegistrationPool[];
}

/**
 * Get a specific pool
 */
export async function getPool(
  programId: string,
  seasonId: string,
  poolId: string
): Promise<RegistrationPool | null> {
  const poolRef = doc(db, 'programs', programId, 'seasons', seasonId, 'pools', poolId);
  const snapshot = await getDoc(poolRef);
  
  if (!snapshot.exists()) return null;
  
  return {
    id: snapshot.id,
    ...snapshot.data()
  } as RegistrationPool;
}

/**
 * Find the correct pool for a player based on their DOB and desired sport
 */
export async function findPoolForPlayer(
  programId: string,
  seasonId: string,
  sport: SportType,
  playerDob: string
): Promise<RegistrationPool | null> {
  const pools = await getPoolsBySport(programId, seasonId, sport);
  
  const birthDate = new Date(playerDob);
  const birthYear = birthDate.getFullYear();
  
  // Find pool where player's birth year falls within range
  for (const pool of pools) {
    if (birthYear >= pool.minBirthYear && birthYear <= pool.maxBirthYear) {
      return pool;
    }
  }
  
  return null;
}

// =============================================================================
// POOL PLAYERS (Registration)
// =============================================================================

/**
 * Register a player to a pool
 */
export async function registerPlayerToPool(
  programId: string,
  seasonId: string,
  poolId: string,
  playerData: Omit<PoolPlayer, 'id' | 'poolId' | 'seasonId' | 'programId' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const batch = writeBatch(db);
  
  // Create player document
  const playerRef = doc(collection(db, 'programs', programId, 'seasons', seasonId, 'pools', poolId, 'players'));
  const playerId = playerRef.id;
  
  const player: PoolPlayer = {
    ...playerData,
    id: playerId,
    poolId,
    seasonId,
    programId,
    status: 'in_pool',
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp
  };
  
  batch.set(playerRef, player);
  
  // Increment pool player count
  const poolRef = doc(db, 'programs', programId, 'seasons', seasonId, 'pools', poolId);
  batch.update(poolRef, {
    playerCount: increment(1),
    updatedAt: serverTimestamp()
  });
  
  // Increment season total registrations
  const seasonRef = doc(db, 'programs', programId, 'seasons', seasonId);
  batch.update(seasonRef, {
    totalRegistrations: increment(1),
    updatedAt: serverTimestamp()
  });
  
  await batch.commit();
  
  // Update recommended team count
  await updatePoolRecommendations(programId, seasonId, poolId);
  
  return playerId;
}

/**
 * Get all players in a pool
 */
export async function getPoolPlayers(
  programId: string,
  seasonId: string,
  poolId: string
): Promise<PoolPlayer[]> {
  const playersRef = collection(db, 'programs', programId, 'seasons', seasonId, 'pools', poolId, 'players');
  const snapshot = await getDocs(playersRef);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as PoolPlayer[];
}

/**
 * Get unassigned players in a pool (for drafting)
 */
export async function getUnassignedPlayers(
  programId: string,
  seasonId: string,
  poolId: string
): Promise<PoolPlayer[]> {
  const playersRef = collection(db, 'programs', programId, 'seasons', seasonId, 'pools', poolId, 'players');
  const q = query(playersRef, where('status', '==', 'in_pool'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as PoolPlayer[];
}

/**
 * Update pool recommendations based on player count
 */
async function updatePoolRecommendations(
  programId: string,
  seasonId: string,
  poolId: string
): Promise<void> {
  const pool = await getPool(programId, seasonId, poolId);
  if (!pool) return;
  
  const idealTeamSize = Math.floor((pool.minPlayersPerTeam + pool.maxPlayersPerTeam) / 2);
  const recommendedTeamCount = Math.max(1, Math.ceil(pool.playerCount / idealTeamSize));
  
  const poolRef = doc(db, 'programs', programId, 'seasons', seasonId, 'pools', poolId);
  await updateDoc(poolRef, {
    recommendedTeamCount,
    updatedAt: serverTimestamp()
  });
}

// =============================================================================
// TEAM CREATION FROM POOLS
// =============================================================================

/**
 * Create teams for a pool
 * If 1 team: auto-assign all players
 * If 2+ teams: mark pool as needing draft
 */
export async function createTeamsForPool(
  programId: string,
  seasonId: string,
  poolId: string,
  teams: { name: string; coachId: string; coachName: string }[]
): Promise<string[]> {
  const batch = writeBatch(db);
  const teamIds: string[] = [];
  const teamNames: string[] = [];
  
  const pool = await getPool(programId, seasonId, poolId);
  if (!pool) throw new Error('Pool not found');
  
  // Create each team
  for (const teamData of teams) {
    const teamRef = doc(collection(db, 'teams'));
    const teamId = teamRef.id;
    
    const team = {
      id: teamId,
      name: teamData.name,
      sport: pool.sport,
      ageGroup: pool.ageGroupLabel,
      ageGroups: pool.ageGroups,
      ageGroupType: pool.ageGroupType,
      coachId: teamData.coachId,
      headCoachId: teamData.coachId,
      coachIds: [teamData.coachId],
      programId,
      seasonId,
      poolId,
      // Will be filled after draft/assignment
      playerCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    batch.set(teamRef, team);
    teamIds.push(teamId);
    teamNames.push(teamData.name);
  }
  
  // Update pool with teams
  const requiresDraft = teams.length > 1;
  const poolRef = doc(db, 'programs', programId, 'seasons', seasonId, 'pools', poolId);
  
  batch.update(poolRef, {
    teamCount: teams.length,
    teamIds,
    teamNames,
    requiresDraft,
    status: requiresDraft ? 'teams_created' : 'teams_created',
    draftStatus: requiresDraft ? 'pending' : 'not_needed',
    updatedAt: serverTimestamp()
  });
  
  // Update program team count
  const programRef = doc(db, 'programs', programId);
  batch.update(programRef, {
    teamCount: increment(teams.length),
    updatedAt: serverTimestamp()
  });
  
  await batch.commit();
  
  // If only 1 team, auto-assign all players
  if (!requiresDraft) {
    await autoAssignPlayersToTeam(programId, seasonId, poolId, teamIds[0], teamNames[0]);
  }
  
  return teamIds;
}

/**
 * Auto-assign all pool players to a single team
 */
export async function autoAssignPlayersToTeam(
  programId: string,
  seasonId: string,
  poolId: string,
  teamId: string,
  teamName: string
): Promise<number> {
  const players = await getUnassignedPlayers(programId, seasonId, poolId);
  
  if (players.length === 0) return 0;
  
  const batch = writeBatch(db);
  
  for (const player of players) {
    const playerRef = doc(db, 'programs', programId, 'seasons', seasonId, 'pools', poolId, 'players', player.id);
    batch.update(playerRef, {
      status: 'auto_assigned',
      assignedTeamId: teamId,
      assignedTeamName: teamName,
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Also create player in team's roster (if needed)
    // This depends on your existing roster structure
  }
  
  // Update pool status
  const poolRef = doc(db, 'programs', programId, 'seasons', seasonId, 'pools', poolId);
  batch.update(poolRef, {
    status: 'assigned',
    updatedAt: serverTimestamp()
  });
  
  // Update team player count
  const teamRef = doc(db, 'teams', teamId);
  batch.update(teamRef, {
    playerCount: increment(players.length),
    updatedAt: serverTimestamp()
  });
  
  await batch.commit();
  
  return players.length;
}

// =============================================================================
// DRAFT EVENTS
// =============================================================================

/**
 * Schedule a draft for a pool
 */
export async function scheduleDraft(
  programId: string,
  seasonId: string,
  poolId: string,
  draftConfig: {
    scheduledDate: Date;
    location?: string;
    draftType: 'snake' | 'linear' | 'lottery';
    lotteryEnabled: boolean;
  },
  createdBy: string
): Promise<string> {
  const pool = await getPool(programId, seasonId, poolId);
  if (!pool) throw new Error('Pool not found');
  if (!pool.requiresDraft) throw new Error('Pool does not require draft');
  
  // Get team and coach info
  const teamDocs = await Promise.all(
    pool.teamIds.map(id => getDoc(doc(db, 'teams', id)))
  );
  
  const coachIds: string[] = [];
  const coachNames: string[] = [];
  
  for (const teamDoc of teamDocs) {
    if (teamDoc.exists()) {
      const team = teamDoc.data();
      coachIds.push(team.headCoachId || team.coachId);
      coachNames.push(team.coachName || 'Unknown Coach');
    }
  }
  
  const unassignedPlayers = await getUnassignedPlayers(programId, seasonId, poolId);
  const totalRounds = Math.ceil(unassignedPlayers.length / pool.teamCount);
  
  const draftRef = doc(collection(db, 'programs', programId, 'drafts'));
  const draftId = draftRef.id;
  
  const draft: DraftEvent = {
    id: draftId,
    programId,
    seasonId,
    poolId,
    sport: pool.sport,
    ageGroupLabel: pool.ageGroupLabel,
    scheduledDate: Timestamp.fromDate(draftConfig.scheduledDate),
    location: draftConfig.location,
    teamIds: pool.teamIds,
    teamNames: pool.teamNames,
    coachIds,
    coachNames,
    draftType: draftConfig.draftType,
    totalRounds,
    lotteryEnabled: draftConfig.lotteryEnabled,
    lotteryCompleted: false,
    draftOrder: draftConfig.lotteryEnabled ? [] : pool.teamIds, // Set later if lottery
    currentRound: 0,
    currentPick: 0,
    totalPlayers: unassignedPlayers.length,
    playersRemaining: unassignedPlayers.length,
    status: draftConfig.lotteryEnabled ? 'lottery_pending' : 'scheduled',
    picks: [],
    createdBy,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp
  };
  
  const batch = writeBatch(db);
  
  batch.set(draftRef, draft);
  
  // Update pool
  const poolRef = doc(db, 'programs', programId, 'seasons', seasonId, 'pools', poolId);
  batch.update(poolRef, {
    draftStatus: 'scheduled',
    draftDate: Timestamp.fromDate(draftConfig.scheduledDate),
    draftType: draftConfig.draftType,
    draftEventId: draftId,
    updatedAt: serverTimestamp()
  });
  
  await batch.commit();
  
  return draftId;
}

/**
 * Run the draft lottery to determine pick order
 */
export async function runDraftLottery(
  programId: string,
  draftId: string
): Promise<string[]> {
  const draftRef = doc(db, 'programs', programId, 'drafts', draftId);
  const draftDoc = await getDoc(draftRef);
  
  if (!draftDoc.exists()) throw new Error('Draft not found');
  
  const draft = draftDoc.data() as DraftEvent;
  if (!draft.lotteryEnabled) throw new Error('Lottery not enabled');
  if (draft.lotteryCompleted) throw new Error('Lottery already completed');
  
  // Shuffle team order randomly
  const shuffledTeams = [...draft.teamIds].sort(() => Math.random() - 0.5);
  
  // Create lottery results
  const lotteryResults = shuffledTeams.map((teamId, index) => ({
    position: index + 1,
    teamId,
    teamName: draft.teamNames[draft.teamIds.indexOf(teamId)],
    coachId: draft.coachIds[draft.teamIds.indexOf(teamId)],
    drawnAt: serverTimestamp()
  }));
  
  await updateDoc(draftRef, {
    draftOrder: shuffledTeams,
    lotteryCompleted: true,
    lotteryResults,
    status: 'scheduled',
    updatedAt: serverTimestamp()
  });
  
  return shuffledTeams;
}

/**
 * Make a draft pick
 */
export async function makeDraftPick(
  programId: string,
  seasonId: string,
  draftId: string,
  playerId: string,
  pickedBy: string
): Promise<void> {
  const draftRef = doc(db, 'programs', programId, 'drafts', draftId);
  const draftDoc = await getDoc(draftRef);
  
  if (!draftDoc.exists()) throw new Error('Draft not found');
  
  const draft = draftDoc.data() as DraftEvent;
  
  // Validate it's this coach's turn
  const currentTeamIndex = draft.currentPick % draft.teamIds.length;
  const isSnakeDraft = draft.draftType === 'snake';
  const currentRound = Math.floor(draft.currentPick / draft.teamIds.length) + 1;
  
  let pickingTeamId: string;
  if (isSnakeDraft && currentRound % 2 === 0) {
    // Reverse order on even rounds
    pickingTeamId = draft.draftOrder[draft.teamIds.length - 1 - currentTeamIndex];
  } else {
    pickingTeamId = draft.draftOrder[currentTeamIndex];
  }
  
  const pickingCoachId = draft.coachIds[draft.teamIds.indexOf(pickingTeamId)];
  if (pickedBy !== pickingCoachId) {
    throw new Error('Not your turn to pick');
  }
  
  // Get player info
  const playerRef = doc(db, 'programs', programId, 'seasons', seasonId, 'pools', draft.poolId, 'players', playerId);
  const playerDoc = await getDoc(playerRef);
  
  if (!playerDoc.exists()) throw new Error('Player not found');
  
  const player = playerDoc.data() as PoolPlayer;
  if (player.status !== 'in_pool') throw new Error('Player already assigned');
  
  const batch = writeBatch(db);
  
  // Create pick record
  const pick: DraftPick = {
    round: currentRound,
    pick: draft.currentPick + 1,
    pickInRound: currentTeamIndex + 1,
    teamId: pickingTeamId,
    teamName: draft.teamNames[draft.teamIds.indexOf(pickingTeamId)],
    coachId: pickingCoachId,
    playerId,
    playerName: player.playerName,
    pickedAt: serverTimestamp() as Timestamp
  };
  
  // Update draft
  batch.update(draftRef, {
    picks: [...draft.picks, pick],
    currentPick: draft.currentPick + 1,
    currentRound,
    playersRemaining: draft.playersRemaining - 1,
    status: draft.playersRemaining - 1 === 0 ? 'completed' : 'in_progress',
    completedAt: draft.playersRemaining - 1 === 0 ? serverTimestamp() : null,
    updatedAt: serverTimestamp()
  });
  
  // Update player
  batch.update(playerRef, {
    status: 'drafted',
    assignedTeamId: pickingTeamId,
    assignedTeamName: draft.teamNames[draft.teamIds.indexOf(pickingTeamId)],
    assignedAt: serverTimestamp(),
    draftRound: currentRound,
    draftPick: draft.currentPick + 1,
    draftedBy: pickingCoachId,
    updatedAt: serverTimestamp()
  });
  
  // Update team player count
  const teamRef = doc(db, 'teams', pickingTeamId);
  batch.update(teamRef, {
    playerCount: increment(1),
    updatedAt: serverTimestamp()
  });
  
  // If draft complete, update pool
  if (draft.playersRemaining - 1 === 0) {
    const poolRef = doc(db, 'programs', programId, 'seasons', seasonId, 'pools', draft.poolId);
    batch.update(poolRef, {
      status: 'assigned',
      draftStatus: 'complete',
      updatedAt: serverTimestamp()
    });
  }
  
  await batch.commit();
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get minimum players per team for a sport
 */
function getMinPlayersForSport(sport: SportType): number {
  switch (sport) {
    case 'football': return 11;
    case 'basketball': return 5;
    case 'soccer': return 11;
    case 'baseball': return 9;
    case 'volleyball': return 6;
    case 'cheer': return 8;
    default: return 5;
  }
}

/**
 * Get maximum players per team for a sport
 */
function getMaxPlayersForSport(sport: SportType): number {
  switch (sport) {
    case 'football': return 30;
    case 'basketball': return 15;
    case 'soccer': return 22;
    case 'baseball': return 18;
    case 'volleyball': return 14;
    case 'cheer': return 20;
    default: return 20;
  }
}

/**
 * Get open programs with registration for a sport and age
 */
export async function getOpenProgramsForRegistration(
  sport: SportType,
  playerDob: string
): Promise<Array<{
  program: { id: string; name: string; city?: string; state?: string };
  season: { id: string; name: string };
  pool: RegistrationPool;
}>> {
  // Get all programs
  const programsRef = collection(db, 'programs');
  const programsSnapshot = await getDocs(query(programsRef, where('status', '==', 'active')));
  
  const results: Array<{
    program: { id: string; name: string; city?: string; state?: string };
    season: { id: string; name: string };
    pool: RegistrationPool;
  }> = [];
  
  const birthDate = new Date(playerDob);
  const birthYear = birthDate.getFullYear();
  
  for (const programDoc of programsSnapshot.docs) {
    const program = { id: programDoc.id, ...programDoc.data() } as any;
    
    // Check if program offers this sport
    const offersThisSport = program.sports?.includes(sport) || program.sport === sport;
    if (!offersThisSport) continue;
    
    // Get current season
    if (!program.currentSeasonId) continue;
    
    const season = await getProgramSeason(program.id, program.currentSeasonId);
    if (!season || season.status !== 'registration_open') continue;
    
    // Find matching pool
    const pool = await findPoolForPlayer(program.id, season.id, sport, playerDob);
    if (!pool || pool.status !== 'open') continue;
    
    results.push({
      program: {
        id: program.id,
        name: program.name,
        city: program.city,
        state: program.state
      },
      season: {
        id: season.id,
        name: season.name
      },
      pool
    });
  }
  
  return results;
}
