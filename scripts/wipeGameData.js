/**
 * Wipe Game Data Script
 * Cleans up game-related data to prepare for single-source architecture
 * 
 * Run with: node scripts/wipeGameData.js
 */

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize with Application Default Credentials (from firebase login)
admin.initializeApp({
  projectId: 'gridiron-hub'
});

const db = getFirestore();

async function wipeGameData() {
  console.log('🧹 Starting game data wipe...\n');
  
  // 1. Delete game events from events collection
  console.log('Step 1: Cleaning events collection...');
  const eventsSnap = await db.collection('events').get();
  let deletedEvents = 0;
  
  const eventBatch = db.batch();
  eventsSnap.docs.forEach(docSnap => {
    const d = docSnap.data();
    const type = (d.type || d.eventType || '').toLowerCase();
    // Delete game events and bye events
    if (type === 'game' || d.isBye || d.seasonId) {
      eventBatch.delete(docSnap.ref);
      deletedEvents++;
    }
  });
  
  if (deletedEvents > 0) {
    await eventBatch.commit();
    console.log(`   ✓ Deleted ${deletedEvents} game/bye events`);
  } else {
    console.log('   ✓ No game events to delete');
  }
  
  // 2. Delete games and byes from program seasons
  console.log('\nStep 2: Cleaning program season games...');
  const programsSnap = await db.collection('programs').get();
  
  for (const programDoc of programsSnap.docs) {
    const programId = programDoc.id;
    const seasonsSnap = await db.collection('programs').doc(programId).collection('seasons').get();
    
    for (const seasonDoc of seasonsSnap.docs) {
      const seasonId = seasonDoc.id;
      
      // Get games and byes
      const gamesSnap = await db.collection('programs').doc(programId).collection('seasons').doc(seasonId).collection('games').get();
      const byesSnap = await db.collection('programs').doc(programId).collection('seasons').doc(seasonId).collection('byes').get();
      
      if (gamesSnap.size > 0 || byesSnap.size > 0) {
        const batch = db.batch();
        gamesSnap.docs.forEach(d => batch.delete(d.ref));
        byesSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        console.log(`   ✓ Deleted ${gamesSnap.size} games, ${byesSnap.size} byes from ${programId}/${seasonId}`);
      }
      
      // Reset scheduleBuilt flag
      await db.collection('programs').doc(programId).collection('seasons').doc(seasonId).update({
        scheduleBuilt: false
      });
      console.log(`   ✓ Reset scheduleBuilt for ${programId}/${seasonId}`);
    }
  }
  
  console.log('\n✅ DONE! All game data wiped. Ready for single-source architecture.');
  process.exit(0);
}

wipeGameData().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
