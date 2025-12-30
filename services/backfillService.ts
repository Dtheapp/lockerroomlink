/**
 * Team History Backfill Utility
 * 
 * This module provides functions to backfill teamHistory for existing players
 * so they can see their historical stats.
 * 
 * To use from browser console (while logged in as admin):
 * 1. Open your app at localhost:3001
 * 2. Open browser DevTools (F12)
 * 3. Go to Console tab
 * 4. Run: await window.backfillTeamHistory()
 */

import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion,
  query,
  where 
} from 'firebase/firestore';
import { db } from './firebase';

interface BackfillStats {
  teamsProcessed: number;
  playersUpdated: number;
  playersSkipped: number;
  errors: string[];
}

/**
 * Backfill team history for all players currently on team rosters
 */
export async function backfillTeamHistory(): Promise<BackfillStats> {
  const stats: BackfillStats = {
    teamsProcessed: 0,
    playersUpdated: 0,
    playersSkipped: 0,
    errors: []
  };

  console.log('🔄 Starting team history backfill...\n');

  try {
    // Get all teams
    const teamsSnapshot = await getDocs(collection(db, 'teams'));
    console.log(`📁 Found ${teamsSnapshot.size} teams\n`);

    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const teamId = teamDoc.id;
      const teamName = teamData.name || 'Unknown Team';
      const programId = teamData.programId;
      const programName = teamData.programName || '';
      const sport = teamData.sport || 'football';
      const ageGroup = teamData.ageGroup || null;
      const seasonId = teamData.currentSeasonId || null;

      if (!programId) {
        console.log(`⚠️ Team "${teamName}" has no programId, skipping...`);
        continue;
      }

      // Get players on this team's roster
      const playersSnapshot = await getDocs(collection(db, 'teams', teamId, 'players'));
      
      if (playersSnapshot.empty) {
        continue;
      }

      console.log(`🏈 Processing team: ${teamName} (${playersSnapshot.size} players)`);
      stats.teamsProcessed++;

      for (const playerDoc of playersSnapshot.docs) {
        const playerData = playerDoc.data();
        const athleteId = playerData.athleteId;

        if (!athleteId) {
          console.log(`   ⏭️ Player "${playerData.name}" has no athleteId, skipping`);
          stats.playersSkipped++;
          continue;
        }

        try {
          // Check if global player doc exists
          const globalPlayerRef = doc(db, 'players', athleteId);
          const globalPlayerDoc = await getDoc(globalPlayerRef);

          if (!globalPlayerDoc.exists()) {
            console.log(`   ⚠️ Global player doc not found for: ${athleteId}`);
            stats.playersSkipped++;
            continue;
          }

          const globalPlayerData = globalPlayerDoc.data();
          const existingHistory = globalPlayerData?.teamHistory || [];

          // Check if this team is already in history
          const alreadyInHistory = existingHistory.some(
            (entry: any) => entry.teamId === teamId && entry.programId === programId
          );

          if (alreadyInHistory) {
            console.log(`   ✓ "${playerData.name}" already has history for ${teamName}`);
            stats.playersSkipped++;
            continue;
          }

          // Create team history entry
          const historyEntry = {
            teamId,
            teamName,
            programId,
            programName,
            sport,
            seasonId: seasonId || null,
            seasonYear: new Date().getFullYear(),
            ageGroup: ageGroup || playerData.ageGroup || null,
            joinedAt: playerData.draftedAt || playerData.createdAt || new Date(),
            leftAt: null,
            status: 'active'
          };

          // Update global player document
          await updateDoc(globalPlayerRef, {
            teamHistory: arrayUnion(historyEntry)
          });

          console.log(`   ✅ Added team history for "${playerData.name}"`);
          stats.playersUpdated++;
        } catch (err: any) {
          console.error(`   ❌ Error updating ${playerData.name}:`, err.message);
          stats.errors.push(`${playerData.name}: ${err.message}`);
        }
      }
    }

    console.log('\n📊 Backfill Summary:');
    console.log(`   Teams processed: ${stats.teamsProcessed}`);
    console.log(`   Players updated: ${stats.playersUpdated}`);
    console.log(`   Players skipped: ${stats.playersSkipped}`);
    if (stats.errors.length > 0) {
      console.log(`   Errors: ${stats.errors.length}`);
    }
    console.log('\n✅ Backfill complete!');

  } catch (error: any) {
    console.error('❌ Fatal error during backfill:', error);
    stats.errors.push(error.message);
  }

  return stats;
}

/**
 * Backfill team history for a specific player by athlete ID
 */
export async function backfillPlayerHistory(
  athleteId: string,
  teamId: string,
  teamName: string,
  programId: string,
  programName: string,
  sport: string = 'football',
  seasonId?: string,
  seasonYear?: number,
  ageGroup?: string
): Promise<boolean> {
  try {
    const playerRef = doc(db, 'players', athleteId);
    const playerDoc = await getDoc(playerRef);

    if (!playerDoc.exists()) {
      console.error(`❌ Player not found: ${athleteId}`);
      return false;
    }

    const historyEntry = {
      teamId,
      teamName,
      programId,
      programName,
      sport,
      seasonId: seasonId || null,
      seasonYear: seasonYear || new Date().getFullYear(),
      ageGroup: ageGroup || null,
      joinedAt: new Date(),
      leftAt: null,
      status: 'active'
    };

    await updateDoc(playerRef, {
      teamHistory: arrayUnion(historyEntry)
    });

    console.log(`✅ Added team history for player ${athleteId}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Find a player by name (partial match)
 */
export async function findPlayerByName(name: string): Promise<Array<{id: string, name: string, teamId?: string}>> {
  const results: Array<{id: string, name: string, teamId?: string}> = [];
  const searchLower = name.toLowerCase();

  const playersSnapshot = await getDocs(collection(db, 'players'));
  
  for (const doc of playersSnapshot.docs) {
    const data = doc.data();
    const playerName = data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim();
    
    if (playerName.toLowerCase().includes(searchLower)) {
      results.push({
        id: doc.id,
        name: playerName,
        teamId: data.teamId
      });
    }
  }

  console.table(results);
  return results;
}

/**
 * Find teams by name (partial match)
 */
export async function findTeamByName(name: string): Promise<Array<{id: string, name: string, programId?: string}>> {
  const results: Array<{id: string, name: string, programId?: string}> = [];
  const searchLower = name.toLowerCase();

  const teamsSnapshot = await getDocs(collection(db, 'teams'));
  
  for (const doc of teamsSnapshot.docs) {
    const data = doc.data();
    
    if ((data.name || '').toLowerCase().includes(searchLower)) {
      results.push({
        id: doc.id,
        name: data.name,
        programId: data.programId
      });
    }
  }

  console.table(results);
  return results;
}

// Make functions available globally in browser console
if (typeof window !== 'undefined') {
  (window as any).backfillTeamHistory = backfillTeamHistory;
  (window as any).backfillPlayerHistory = backfillPlayerHistory;
  (window as any).findPlayerByName = findPlayerByName;
  (window as any).findTeamByName = findTeamByName;
  
  console.log('🔧 Backfill utilities loaded! Available commands:');
  console.log('   await window.backfillTeamHistory() - Backfill all players on rosters');
  console.log('   await window.findPlayerByName("kat") - Find player by name');
  console.log('   await window.findTeamByName("TIGERS") - Find team by name');
  console.log('   await window.backfillPlayerHistory(athleteId, teamId, teamName, programId, programName) - Manual backfill');
}
