/**
 * Stats Engine v2.0 - Stats Service
 * 
 * Handles all read/write operations for the new stats system.
 * Single source of truth: programs/{programId}/seasons/{seasonId}/games/{gameId}/stats/{playerId}
 * 
 * Created: December 21, 2025
 */

import { 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { calculateDerivedStats, getStatSchema, getEmptyStats } from '../config/statSchemas';
import type { 
  GameStatV2, 
  SeasonStatV2, 
  CareerStatV2, 
  GameLogEntryV2,
  StatLeaderV2,
  SportType 
} from '../types';

// =============================================================================
// GAME STATS OPERATIONS (Single Source of Truth)
// =============================================================================

/**
 * Get the path for game stats
 */
export function getGameStatsPath(programId: string, seasonId: string, gameId: string): string {
  return `programs/${programId}/seasons/${seasonId}/games/${gameId}/stats`;
}

/**
 * Save or update a player's game stats
 */
export async function saveGameStats(
  stats: GameStatV2,
  userId: string,
  userName?: string
): Promise<void> {
  const { programId, seasonId, gameId, playerId, sport } = stats;
  
  if (!programId || !seasonId || !gameId || !playerId) {
    throw new Error('Missing required fields: programId, seasonId, gameId, playerId');
  }
  
  const path = getGameStatsPath(programId, seasonId, gameId);
  const docRef = doc(db, path, playerId);
  
  // Calculate derived stats
  const derivedStats = calculateDerivedStats(sport, stats.stats);
  
  const docData: GameStatV2 = {
    ...stats,
    derivedStats,
    enteredBy: userId,
    enteredByName: userName,
    updatedAt: serverTimestamp() as unknown as Timestamp,
  };
  
  // Check if doc exists
  const existing = await getDoc(docRef);
  if (existing.exists()) {
    await updateDoc(docRef, docData as any);
  } else {
    docData.createdAt = serverTimestamp() as unknown as Timestamp;
    await setDoc(docRef, docData);
  }
}

/**
 * Save stats for multiple players in a single batch
 */
export async function saveGameStatsBatch(
  statsArray: GameStatV2[],
  userId: string,
  userName?: string
): Promise<void> {
  if (statsArray.length === 0) return;
  
  const batch = writeBatch(db);
  const timestamp = serverTimestamp();
  
  for (const stats of statsArray) {
    const { programId, seasonId, gameId, playerId, sport } = stats;
    const path = getGameStatsPath(programId, seasonId, gameId);
    const docRef = doc(db, path, playerId);
    
    // Calculate derived stats
    const derivedStats = calculateDerivedStats(sport, stats.stats);
    
    const docData: any = {
      ...stats,
      derivedStats,
      enteredBy: userId,
      enteredByName: userName,
      updatedAt: timestamp,
      createdAt: timestamp, // Will be overwritten if exists, but batch doesn't support conditional
    };
    
    batch.set(docRef, docData, { merge: true });
  }
  
  await batch.commit();
}

/**
 * Get a player's stats for a specific game
 */
export async function getPlayerGameStats(
  programId: string,
  seasonId: string,
  gameId: string,
  playerId: string
): Promise<GameStatV2 | null> {
  const path = getGameStatsPath(programId, seasonId, gameId);
  const docRef = doc(db, path, playerId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  
  return { id: snapshot.id, ...snapshot.data() } as GameStatV2;
}

/**
 * Get all player stats for a game (box score)
 */
export async function getGameStats(
  programId: string,
  seasonId: string,
  gameId: string
): Promise<GameStatV2[]> {
  const path = getGameStatsPath(programId, seasonId, gameId);
  const q = query(collection(db, path));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GameStatV2));
}

/**
 * Get all player stats for a game, filtered by team
 */
export async function getGameStatsByTeam(
  programId: string,
  seasonId: string,
  gameId: string,
  teamId: string
): Promise<GameStatV2[]> {
  const path = getGameStatsPath(programId, seasonId, gameId);
  const q = query(collection(db, path), where('teamId', '==', teamId));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GameStatV2));
}

/**
 * Delete a player's game stats
 */
export async function deletePlayerGameStats(
  programId: string,
  seasonId: string,
  gameId: string,
  playerId: string
): Promise<void> {
  const path = getGameStatsPath(programId, seasonId, gameId);
  const docRef = doc(db, path, playerId);
  await deleteDoc(docRef);
}

// =============================================================================
// SEASON STATS (Aggregated - usually read from Cloud Function writes)
// =============================================================================

/**
 * Get season stats for a player
 * Note: These are auto-generated by Cloud Functions, but can be read here
 */
export async function getPlayerSeasonStats(
  programId: string,
  seasonId: string,
  playerId: string
): Promise<SeasonStatV2 | null> {
  const path = `programs/${programId}/seasons/${seasonId}/playerStats`;
  const docRef = doc(db, path, playerId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  
  return { id: snapshot.id, ...snapshot.data() } as SeasonStatV2;
}

/**
 * Get all player season stats for a team
 */
export async function getTeamSeasonStats(
  programId: string,
  seasonId: string,
  teamId: string
): Promise<SeasonStatV2[]> {
  const path = `programs/${programId}/seasons/${seasonId}/playerStats`;
  const q = query(collection(db, path), where('teamId', '==', teamId));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SeasonStatV2));
}

/**
 * Get stat leaders for a season
 */
export async function getSeasonStatLeaders(
  programId: string,
  seasonId: string,
  statKey: string,
  limitCount: number = 10
): Promise<StatLeaderV2[]> {
  const path = `programs/${programId}/seasons/${seasonId}/playerStats`;
  const q = query(
    collection(db, path),
    orderBy(`totals.${statKey}`, 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((d, index) => {
    const data = d.data() as SeasonStatV2;
    return {
      playerId: data.playerId,
      globalPlayerId: data.globalPlayerId,
      playerName: data.playerName,
      playerNumber: data.playerNumber,
      teamId: data.teamId,
      teamName: data.teamName,
      position: data.position,
      statKey,
      statValue: data.totals[statKey] || 0,
      rank: index + 1,
    };
  });
}

// =============================================================================
// GLOBAL PLAYER STATS (Career)
// =============================================================================

/**
 * Get career stats for a global player
 */
export async function getPlayerCareerStats(
  globalPlayerId: string,
  sport: SportType
): Promise<CareerStatV2 | null> {
  const path = `players/${globalPlayerId}/careerStats`;
  const docRef = doc(db, path, sport);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  
  return { id: snapshot.id, ...snapshot.data() } as CareerStatV2;
}

/**
 * Get game log for a global player
 */
export async function getPlayerGameLog(
  globalPlayerId: string,
  sport?: SportType,
  limitCount: number = 50
): Promise<GameLogEntryV2[]> {
  const path = `players/${globalPlayerId}/gameLog`;
  let q = query(collection(db, path), orderBy('date', 'desc'), limit(limitCount));
  
  if (sport) {
    q = query(
      collection(db, path),
      where('sport', '==', sport),
      orderBy('date', 'desc'),
      limit(limitCount)
    );
  }
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GameLogEntryV2));
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create an empty GameStatV2 object for a player
 */
export function createEmptyGameStat(
  playerId: string,
  playerName: string,
  playerNumber: number,
  teamId: string,
  teamName: string,
  gameId: string,
  programId: string,
  seasonId: string,
  sport: SportType,
  gameDate: string,
  opponent: string,
  isHome: boolean
): GameStatV2 {
  return {
    playerId,
    playerName,
    playerNumber,
    teamId,
    teamName,
    gameId,
    programId,
    seasonId,
    sport,
    gameDate,
    opponent,
    isHome,
    played: false,
    stats: getEmptyStats(sport),
    source: 'manual',
  };
}

/**
 * Aggregate game stats into season totals (client-side fallback)
 * Note: Normally done by Cloud Functions, but useful for preview
 */
export function aggregateGameStats(gameStats: GameStatV2[]): {
  totals: Record<string, number>;
  averages: Record<string, number>;
  highs: Record<string, number>;
  gamesPlayed: number;
} {
  const gamesPlayed = gameStats.filter(g => g.played).length;
  const totals: Record<string, number> = {};
  const highs: Record<string, number> = {};
  
  // Sum all stats
  gameStats.forEach(game => {
    if (!game.played) return;
    
    Object.entries(game.stats).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + (value || 0);
      highs[key] = Math.max(highs[key] || 0, value || 0);
    });
  });
  
  // Calculate averages
  const averages: Record<string, number> = {};
  Object.entries(totals).forEach(([key, value]) => {
    averages[key] = gamesPlayed > 0 ? Math.round((value / gamesPlayed) * 10) / 10 : 0;
  });
  
  return { totals, averages, highs, gamesPlayed };
}

/**
 * Get all games for a player in a season with their stats
 */
export async function getPlayerSeasonGameStats(
  programId: string,
  seasonId: string,
  playerId: string
): Promise<GameStatV2[]> {
  // Query all games in the season
  const gamesPath = `programs/${programId}/seasons/${seasonId}/games`;
  const gamesSnapshot = await getDocs(collection(db, gamesPath));
  
  const playerStats: GameStatV2[] = [];
  
  // For each game, try to get this player's stats
  for (const gameDoc of gamesSnapshot.docs) {
    const statsPath = `${gamesPath}/${gameDoc.id}/stats/${playerId}`;
    const statsDoc = await getDoc(doc(db, statsPath));
    
    if (statsDoc.exists()) {
      playerStats.push({ id: statsDoc.id, ...statsDoc.data() } as GameStatV2);
    }
  }
  
  // Sort by date
  playerStats.sort((a, b) => a.gameDate.localeCompare(b.gameDate));
  
  return playerStats;
}
