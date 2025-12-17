/**
 * Script to delete test registration events
 * 
 * HOW TO RUN:
 * 1. Go to your app at localhost:3001 (or your deployed URL)
 * 2. Make sure you're logged in as an admin/coach
 * 3. Open browser DevTools (F12)
 * 4. Go to Console tab
 * 5. Paste this entire script and press Enter
 * 
 * The script will:
 * - Find events matching the test names
 * - Delete them and their subcollections (pricing tiers, promo codes)
 * - Show you what was deleted
 */

(async function deleteTestEvents() {
  // Access the Firebase modules from the app's bundle (already loaded)
  const firebaseFirestore = await import('firebase/firestore');
  const { 
    collection, 
    doc, 
    getDocs, 
    deleteDoc,
    query, 
    where,
    writeBatch,
    getFirestore
  } = firebaseFirestore;
  
  // Get the existing Firestore instance from the already-initialized app
  const firebaseApp = await import('firebase/app');
  const app = firebaseApp.getApp();
  const db = getFirestore(app);
  
  console.log('🔍 Searching for test events to delete...\n');
  
  // Event titles to delete (case-insensitive match)
  const titlesToDelete = [
    'hafl registration',
    '2025 registration',
    '2026 g registration',
    'spring registration'
  ];
  
  try {
    // Get all events
    const eventsSnapshot = await getDocs(collection(db, 'events'));
    
    console.log(`📋 Found ${eventsSnapshot.size} total events in database.\n`);
    
    const eventsToDelete = [];
    
    eventsSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const title = (data.title || '').toLowerCase().trim();
      
      // Check if this event matches any of our targets
      if (titlesToDelete.some(t => title.includes(t) || t.includes(title))) {
        eventsToDelete.push({
          id: docSnap.id,
          title: data.title,
          teamId: data.teamId,
          teamName: data.teamName,
          type: data.type
        });
      }
    });
    
    if (eventsToDelete.length === 0) {
      console.log('❌ No matching test events found!');
      console.log('\nAll events in database:');
      eventsSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        console.log(`  - "${data.title}" (ID: ${docSnap.id})`);
      });
      return;
    }
    
    console.log(`🎯 Found ${eventsToDelete.length} events to delete:\n`);
    eventsToDelete.forEach((event, i) => {
      console.log(`  ${i + 1}. "${event.title}" (ID: ${event.id})`);
      console.log(`     Team: ${event.teamName || event.teamId || 'N/A'}`);
    });
    
    console.log('\n⏳ Deleting events...\n');
    
    // Delete each event and its subcollections
    for (const event of eventsToDelete) {
      try {
        const batch = writeBatch(db);
        
        // Delete pricing tiers subcollection
        const tiersSnapshot = await getDocs(
          collection(db, 'events', event.id, 'pricingTiers')
        );
        tiersSnapshot.docs.forEach(tierDoc => batch.delete(tierDoc.ref));
        
        // Delete promo codes for this event
        const promoSnapshot = await getDocs(
          query(collection(db, 'promoCodes'), where('eventId', '==', event.id))
        );
        promoSnapshot.docs.forEach(promoDoc => batch.delete(promoDoc.ref));
        
        // Delete registrations
        const regSnapshot = await getDocs(
          collection(db, 'events', event.id, 'registrations')
        );
        regSnapshot.docs.forEach(regDoc => batch.delete(regDoc.ref));
        
        // Delete simple registrations
        const simpleRegSnapshot = await getDocs(
          query(collection(db, 'simpleRegistrations'), where('eventId', '==', event.id))
        );
        simpleRegSnapshot.docs.forEach(regDoc => batch.delete(regDoc.ref));
        
        // Delete draft pool entries
        const draftSnapshot = await getDocs(
          query(collection(db, 'draftPool'), where('eventId', '==', event.id))
        );
        draftSnapshot.docs.forEach(draftDoc => batch.delete(draftDoc.ref));
        
        // Delete the event itself
        batch.delete(doc(db, 'events', event.id));
        
        await batch.commit();
        
        console.log(`  ✅ Deleted: "${event.title}"`);
        console.log(`     - ${tiersSnapshot.size} pricing tiers`);
        console.log(`     - ${promoSnapshot.size} promo codes`);
        console.log(`     - ${regSnapshot.size} registrations`);
        console.log(`     - ${simpleRegSnapshot.size} simple registrations`);
        console.log(`     - ${draftSnapshot.size} draft pool entries`);
        
      } catch (err) {
        console.error(`  ❌ Failed to delete "${event.title}":`, err.message);
      }
    }
    
    console.log('\n🎉 Done! Refresh the page to see changes.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\nMake sure you are logged in and have admin permissions.');
  }
})();
