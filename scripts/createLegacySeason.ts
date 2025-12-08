/**
 * One-time script to create a legacy season for existing teams
 * Run this to bootstrap teams that existed before Season Management was added
 * 
 * Usage: npx ts-node scripts/createLegacySeason.ts
 * Or just copy/paste the Firebase Console version below
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, updateDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';

// Your Firebase config - replace with actual values from firebase.ts
const firebaseConfig = {
  // Copy from your services/firebase.ts
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createLegacySeasonForTeam(teamId: string, teamName: string, sport: string) {
  const seasonId = `legacy_${teamId}_2025`;
  const now = new Date();
  const year = now.getFullYear();
  
  // Create the season document
  const seasonData = {
    teamId,
    name: `Fall ${year} (Legacy)`,
    sport,
    year,
    status: 'active',
    startDate: `${year}-08-01`, // Assume season started in August
    registrationOpenDate: `${year}-07-01`,
    registrationCloseDate: `${year}-08-31`,
    registrationFee: 0, // No fee for legacy
    description: 'Legacy season created for existing team members',
    includedItems: [],
    requireMedicalInfo: false,
    requireEmergencyContact: true,
    requireUniformSizes: false,
    requireWaiver: false,
    playerCount: 0, // Will be updated when we count
    gamesPlayed: 0,
    createdAt: serverTimestamp(),
    createdBy: 'system',
  };

  // Add to teams/{teamId}/seasons/{seasonId}
  await setDoc(doc(db, 'teams', teamId, 'seasons', seasonId), seasonData);
  console.log(`Created season: ${seasonId}`);

  // Update team with currentSeasonId
  await updateDoc(doc(db, 'teams', teamId), {
    currentSeasonId: seasonId,
  });
  console.log(`Updated team ${teamId} with currentSeasonId: ${seasonId}`);

  return seasonId;
}

// Run for your team
// Replace with your actual team ID
const TEAM_ID = 'YOUR_TEAM_ID_HERE';
const TEAM_NAME = 'Tigers 3/4';
const SPORT = 'football';

createLegacySeasonForTeam(TEAM_ID, TEAM_NAME, SPORT)
  .then(() => console.log('Done!'))
  .catch(console.error);
