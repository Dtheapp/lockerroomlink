/**
 * Cleanup script to delete the old "cyfl" program after migration
 * Run with: node scripts/cleanup-old-program.js
 * 
 * NOTE: If you get credential errors, just delete manually from Firebase Console:
 * 1. Go to Firestore → programs → cyfl
 * 2. Click 3-dot menu → Delete document
 * 3. Check "Also delete subcollections" 
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBEPXvFRJzXl8rRXlhdIeY1a8E1G3VvNUI",
  authDomain: "gridironhub-3131.firebaseapp.com",
  projectId: "gridironhub-3131",
  storageBucket: "gridironhub-3131.firebasestorage.app",
  messagingSenderId: "907170153377",
  appId: "1:907170153377:web:5879aff99a69b1ea1eb26a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanup() {
  const oldProgramId = 'cyfl';
  
  console.log(`🔄 Cleaning up old program: ${oldProgramId}`);
  
  try {
    // 1. Delete draftPool entries in seasons
    const seasonsSnap = await getDocs(collection(db, `programs/${oldProgramId}/seasons`));
    console.log(`Found ${seasonsSnap.size} seasons in old program`);
    
    for (const seasonDoc of seasonsSnap.docs) {
      const draftPoolSnap = await getDocs(collection(db, `programs/${oldProgramId}/seasons/${seasonDoc.id}/draftPool`));
      console.log(`  Season ${seasonDoc.id}: ${draftPoolSnap.size} draftPool entries`);
      
      for (const dpDoc of draftPoolSnap.docs) {
        await deleteDoc(dpDoc.ref);
      }
      
      await deleteDoc(seasonDoc.ref);
      console.log(`  ✅ Deleted season: ${seasonDoc.id}`);
    }
    
    // 2. Delete the old program document
    await deleteDoc(doc(db, `programs/${oldProgramId}`));
    console.log(`✅ Deleted old program: ${oldProgramId}`);
    
    console.log('\n🎉 Cleanup complete!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  
  process.exit(0);
}

cleanup();
