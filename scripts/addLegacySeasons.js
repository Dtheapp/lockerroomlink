/**
 * One-time script to create legacy seasons for existing teams
 * 
 * Run in browser console while logged in as a coach/admin:
 * 1. Go to your app at localhost:3000
 * 2. Open browser DevTools (F12)
 * 3. Go to Console tab
 * 4. Paste this entire script and press Enter
 */

// This script should be run in the browser console
// It uses the Firebase instance already initialized in the app

(async function createLegacySeasons() {
  // Get Firebase from window (already initialized by the app)
  const { collection, doc, setDoc, updateDoc, getDocs, getDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
  
  // Get the db instance from the app's global state
  // You'll need to expose this or use the app's existing connection
  
  console.log('=== Legacy Season Creator ===');
  console.log('This script will create legacy seasons for teams without active seasons.');
  console.log('');
  
  // Teams to create legacy seasons for (add your team IDs here)
  const teams = [
    // { id: 'YOUR_TEAM_ID_1', name: 'Tigers 1/2', sport: 'football' },
    // { id: 'YOUR_TEAM_ID_2', name: 'Tigers 3/4', sport: 'football' },
    // { id: 'YOUR_TEAM_ID_3', name: 'Tigers 5/6', sport: 'football' },
  ];
  
  if (teams.length === 0) {
    console.log('❌ No teams configured!');
    console.log('');
    console.log('Edit this script and add your team IDs to the "teams" array above.');
    console.log('You can find your team ID on the Dashboard (click the clipboard icon next to "ID:")');
    return;
  }
  
  console.log(`Found ${teams.length} teams to process...`);
  
  for (const team of teams) {
    console.log(`\nProcessing: ${team.name} (${team.id})`);
    
    const seasonId = `legacy_${team.id}_2025`;
    const now = new Date();
    const year = now.getFullYear();
    
    const seasonData = {
      teamId: team.id,
      name: `Fall ${year} Season`,
      sport: team.sport,
      year: year,
      status: 'active',
      startDate: `${year}-08-01`,
      registrationOpenDate: `${year}-07-01`,
      registrationCloseDate: `${year}-08-31`,
      registrationFee: 0,
      description: 'Current season (created from existing roster)',
      includedItems: [],
      requireMedicalInfo: false,
      requireEmergencyContact: true,
      requireUniformSizes: false,
      requireWaiver: false,
      playerCount: 0,
      gamesPlayed: 0,
      createdAt: serverTimestamp(),
      createdBy: 'system_migration',
    };
    
    console.log('  Season data:', seasonData);
    console.log('  ✓ Ready to create');
  }
  
  console.log('\n=== Instructions ===');
  console.log('Since we cannot directly access Firestore from this script,');
  console.log('please use the Firebase Console to add these documents manually:');
  console.log('');
  console.log('1. Go to: https://console.firebase.google.com');
  console.log('2. Select your project');
  console.log('3. Go to Firestore Database');
  console.log('4. For each team:');
  console.log('   a. Navigate to: teams/{teamId}/seasons');
  console.log('   b. Add a new document with the data shown above');
  console.log('   c. Update the team document to set currentSeasonId');
})();
