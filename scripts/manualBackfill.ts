/**
 * Quick Firebase Console Script for Manual Backfill
 * 
 * HOW TO USE:
 * 1. Go to Firebase Console → lockeroomlink project
 * 2. Go to Firestore Database
 * 3. Find the player document at /players/{athleteId}
 * 4. Click "Edit" or the three dots menu
 * 5. Add a new field called "teamHistory" as an Array
 * 6. Add objects with this structure:
 * 
 * EXAMPLE for kat ly who was on TIGERS 3/4:
 * 
 * In Firebase Console, find /players/{katLyAthleteId} and add:
 * 
 * teamHistory: [
 *   {
 *     teamId: "YOUR_TIGERS_TEAM_ID",          // Get from /teams collection
 *     teamName: "TIGERS 3/4",
 *     programId: "YOUR_PROGRAM_ID",           // Get from /programs collection  
 *     programName: "CYFA EOY 2002",
 *     sport: "football",
 *     seasonId: "YOUR_SEASON_ID",             // Get from /programs/{id}/seasons
 *     seasonYear: 2026,
 *     ageGroup: "3/4",
 *     joinedAt: Timestamp,                    // Use "Add timestamp" in Firebase Console
 *     leftAt: null,
 *     status: "season_ended"                  // or "active" if still on team
 *   }
 * ]
 * 
 * ========================================
 * QUICK LOOKUP QUERIES (run in browser console when on Firebase Console):
 * ========================================
 * 
 * To find player IDs - search in Firestore:
 * /players where firstName == "kat" or name contains "kat"
 * 
 * To find team IDs:
 * /teams where name contains "TIGERS"
 * 
 * To find program IDs:
 * /programs where name contains "CYFA"
 * 
 * ========================================
 * ALTERNATIVE: Use this Node.js snippet
 * ========================================
 */

// If you want to run this locally with firebase-admin:
// 1. Download your service account key from Firebase Console → Project Settings → Service accounts
// 2. Save as serviceAccountKey.json in this folder
// 3. Uncomment and run: npx ts-node scripts/manualBackfill.ts

/*
import admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
});

const db = admin.firestore();

async function backfillKatLy() {
  // REPLACE THESE VALUES with actual IDs from your database
  const ATHLETE_ID = 'PUT_KAT_LY_ATHLETE_ID_HERE';
  const TEAM_ID = 'PUT_TIGERS_TEAM_ID_HERE';
  const PROGRAM_ID = 'PUT_CYFA_PROGRAM_ID_HERE';
  const SEASON_ID = 'PUT_2026_SEASON_ID_HERE';
  
  const historyEntry = {
    teamId: TEAM_ID,
    teamName: 'TIGERS 3/4',
    programId: PROGRAM_ID,
    programName: 'CYFA EOY 2002',
    sport: 'football',
    seasonId: SEASON_ID,
    seasonYear: 2026,
    ageGroup: '3/4',
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    leftAt: null,
    status: 'season_ended'
  };
  
  await db.collection('players').doc(ATHLETE_ID).update({
    teamHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
  });
  
  console.log('✅ Backfilled team history for kat ly!');
}

backfillKatLy();
*/
