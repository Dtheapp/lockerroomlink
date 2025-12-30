/**
 * Backfill Team History Script
 * 
 * This script finds players who have been on teams and adds teamHistory entries
 * so their historical stats are visible even when they're in a draft pool.
 * 
 * Run with: npx ts-node scripts/backfillTeamHistory.ts
 * Or use Firebase Admin SDK locally
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin (use service account or emulator)
if (!getApps().length) {
  // For production, use a service account key
  // For testing, you can use the emulator
  initializeApp({
    // If you have a service account key file:
    // credential: cert(require('./serviceAccountKey.json')),
    projectId: 'lockeroomlink-5765b',
  });
}

const db = getFirestore();

interface TeamHistoryEntry {
  teamId: string;
  teamName: string;
  programId: string;
  programName: string;
  sport: string;
  seasonId?: string;
  seasonYear?: number;
  ageGroup?: string;
  joinedAt: FirebaseFirestore.Timestamp | FieldValue;
  leftAt: FirebaseFirestore.Timestamp | null;
  status: 'active' | 'released' | 'transferred' | 'season_ended';
}

async function backfillTeamHistory() {
  console.log('🔄 Starting team history backfill...\n');

  // 1. Get all teams with their players
  const teamsSnapshot = await db.collection('teams').get();
  console.log(`📁 Found ${teamsSnapshot.size} teams\n`);

  let playersUpdated = 0;
  let playersSkipped = 0;

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
    const playersSnapshot = await db.collection('teams').doc(teamId).collection('players').get();
    
    if (playersSnapshot.empty) {
      continue;
    }

    console.log(`🏈 Processing team: ${teamName} (${playersSnapshot.size} players)`);

    for (const playerDoc of playersSnapshot.docs) {
      const playerData = playerDoc.data();
      const athleteId = playerData.athleteId;

      if (!athleteId) {
        console.log(`   ⏭️ Player "${playerData.name}" has no athleteId, skipping`);
        playersSkipped++;
        continue;
      }

      // Check if global player doc exists
      const globalPlayerRef = db.collection('players').doc(athleteId);
      const globalPlayerDoc = await globalPlayerRef.get();

      if (!globalPlayerDoc.exists) {
        console.log(`   ⚠️ Global player doc not found for athleteId: ${athleteId}`);
        playersSkipped++;
        continue;
      }

      const globalPlayerData = globalPlayerDoc.data();
      const existingHistory = globalPlayerData?.teamHistory || [];

      // Check if this team is already in history
      const alreadyInHistory = existingHistory.some(
        (entry: any) => entry.teamId === teamId && entry.programId === programId
      );

      if (alreadyInHistory) {
        console.log(`   ✓ Player "${playerData.name}" already has team history for ${teamName}`);
        playersSkipped++;
        continue;
      }

      // Create team history entry
      const historyEntry: TeamHistoryEntry = {
        teamId,
        teamName,
        programId,
        programName,
        sport,
        seasonId: seasonId || undefined,
        seasonYear: new Date().getFullYear(),
        ageGroup: ageGroup || playerData.ageGroup || undefined,
        joinedAt: playerData.draftedAt || playerData.createdAt || FieldValue.serverTimestamp(),
        leftAt: null,
        status: 'active',
      };

      // Update global player document
      await globalPlayerRef.update({
        teamHistory: FieldValue.arrayUnion(historyEntry),
      });

      console.log(`   ✅ Added team history for "${playerData.name}"`);
      playersUpdated++;
    }
  }

  console.log('\n📊 Backfill Summary:');
  console.log(`   Players updated: ${playersUpdated}`);
  console.log(`   Players skipped: ${playersSkipped}`);
  console.log('\n✅ Backfill complete!');
}

// Also backfill from draft pool history (players who were drafted previously)
async function backfillFromDraftHistory() {
  console.log('\n🔄 Checking draft pool history...\n');

  // Get all programs
  const programsSnapshot = await db.collection('programs').get();
  
  for (const programDoc of programsSnapshot.docs) {
    const programData = programDoc.data();
    const programId = programDoc.id;
    const programName = programData.name || 'Unknown Program';
    const sport = programData.sport || 'football';

    // Get all seasons for this program
    const seasonsSnapshot = await db.collection('programs').doc(programId).collection('seasons').get();
    
    for (const seasonDoc of seasonsSnapshot.docs) {
      const seasonData = seasonDoc.data();
      const seasonId = seasonDoc.id;
      const seasonYear = seasonData.year || new Date().getFullYear();

      // Get drafted players from draft pool
      const draftPoolSnapshot = await db
        .collection('programs')
        .doc(programId)
        .collection('seasons')
        .doc(seasonId)
        .collection('draftPool')
        .where('status', '==', 'drafted')
        .get();

      if (draftPoolSnapshot.empty) continue;

      console.log(`📋 Season ${seasonYear} (${programName}): ${draftPoolSnapshot.size} drafted players`);

      for (const draftDoc of draftPoolSnapshot.docs) {
        const draftData = draftDoc.data();
        const athleteId = draftData.athleteId;
        const teamId = draftData.draftedToTeamId;
        const teamName = draftData.draftedToTeamName || 'Unknown Team';

        if (!athleteId || !teamId) continue;

        // Check if global player doc exists
        const globalPlayerRef = db.collection('players').doc(athleteId);
        const globalPlayerDoc = await globalPlayerRef.get();

        if (!globalPlayerDoc.exists) continue;

        const globalPlayerData = globalPlayerDoc.data();
        const existingHistory = globalPlayerData?.teamHistory || [];

        // Check if already in history
        const alreadyInHistory = existingHistory.some(
          (entry: any) => entry.teamId === teamId && entry.seasonId === seasonId
        );

        if (alreadyInHistory) continue;

        // Get team info for ageGroup
        const teamDoc = await db.collection('teams').doc(teamId).get();
        const teamAgeGroup = teamDoc.exists ? teamDoc.data()?.ageGroup : null;

        const historyEntry: TeamHistoryEntry = {
          teamId,
          teamName,
          programId,
          programName,
          sport,
          seasonId,
          seasonYear,
          ageGroup: teamAgeGroup || draftData.ageGroup || undefined,
          joinedAt: draftData.draftedAt || FieldValue.serverTimestamp(),
          leftAt: null,
          status: seasonData.status === 'completed' ? 'season_ended' : 'active',
        };

        await globalPlayerRef.update({
          teamHistory: FieldValue.arrayUnion(historyEntry),
        });

        console.log(`   ✅ Added history for athlete ${athleteId} → ${teamName}`);
      }
    }
  }
}

// Run the backfill
async function main() {
  try {
    await backfillTeamHistory();
    await backfillFromDraftHistory();
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  }
}

main();
