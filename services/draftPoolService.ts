/**
 * Draft Pool Service
 * Manages the waitlist/draft pool for team registrations
 * 
 * Players register for a team → Added to draft pool → Coach/Commissioner drafts to roster
 * 
 * Structure: /teams/{teamId}/draftPool/{entryId}
 * Also indexed by owner (commissioner) for multi-team drafting
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
  onSnapshot,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import type { DraftPoolEntry, DraftPoolSummary, DraftPoolPaymentStatus, SportType, Player } from '../types';

// =============================================================================
// ADD TO DRAFT POOL
// =============================================================================

export interface AddToDraftPoolParams {
  // Player info
  playerId?: string;
  playerName: string;
  playerUsername?: string;
  playerAge?: number;
  playerDob?: string;
  
  // Contact info
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  
  // Who registered
  registeredByUserId: string;
  registeredByName: string;
  isIndependentAthlete: boolean;
  
  // Team targeting
  teamId: string;
  ownerId: string;
  sport: SportType;
  ageGroup: string;
  
  // Payment
  paymentStatus: DraftPoolPaymentStatus;
  amountPaid: number;
  totalAmount: number;
  paymentMethod?: 'paypal' | 'cash' | 'check' | 'other';
  paymentNotes?: string;
  
  // Registration links
  seasonId?: string;
  registrationId?: string;
  
  // Waiver
  waiverSigned: boolean;
  waiverSignedAt?: any;
  waiverSignedBy?: string;
  
  // Emergency contact
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  
  // Medical info
  medicalInfo?: {
    allergies?: string;
    medications?: string;
    conditions?: string;
    insuranceProvider?: string;
    insurancePolicyNumber?: string;
  };
  
  // Uniform sizes
  uniformSizes?: {
    jersey?: string;
    shorts?: string;
    helmet?: string;
  };
  
  // Preferences
  preferredPositions?: string[];
  notes?: string;
}

/**
 * Add a player to the draft pool (waitlist) for a team
 */
export async function addToDraftPool(params: AddToDraftPoolParams): Promise<string> {
  const {
    teamId,
    ownerId,
    sport,
    ageGroup,
    paymentStatus,
    amountPaid,
    totalAmount,
    ...rest
  } = params;
  
  // Check if this team is the only one for this sport/age group under this owner
  // If so, mark as eligible for auto-draft
  const eligibleForAutoDraft = await checkAutoDraftEligibility(ownerId, sport, ageGroup, teamId);
  
  const entryData: Omit<DraftPoolEntry, 'id'> = {
    ...rest,
    teamId,
    ownerId,
    sport,
    ageGroup,
    paymentStatus,
    amountPaid,
    totalAmount,
    remainingBalance: totalAmount - amountPaid,
    status: 'waiting',
    eligibleForAutoDraft,
    createdAt: serverTimestamp(),
  };
  
  const draftPoolRef = collection(db, 'teams', teamId, 'draftPool');
  const docRef = await addDoc(draftPoolRef, entryData);
  
  // If eligible for auto-draft and paid in full, auto-draft immediately
  if (eligibleForAutoDraft && paymentStatus === 'paid_full') {
    await autoDraftToRoster(teamId, docRef.id);
  }
  
  return docRef.id;
}

// =============================================================================
// GET DRAFT POOL
// =============================================================================

/**
 * Get all draft pool entries for a team
 */
export async function getTeamDraftPool(teamId: string): Promise<DraftPoolEntry[]> {
  const draftPoolRef = collection(db, 'teams', teamId, 'draftPool');
  const q = query(
    draftPoolRef,
    where('status', '==', 'waiting'),
    orderBy('createdAt', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as DraftPoolEntry));
}

/**
 * Get draft pool entries across multiple teams for a commissioner
 * Useful when commissioner manages multiple teams of same sport/age
 */
export async function getCommissionerDraftPool(
  ownerId: string,
  sport?: SportType,
  ageGroup?: string
): Promise<DraftPoolEntry[]> {
  // First get all teams owned by this commissioner
  const teamsQuery = query(
    collection(db, 'teams'),
    where('ownerId', '==', ownerId)
  );
  const teamsSnapshot = await getDocs(teamsQuery);
  
  const entries: DraftPoolEntry[] = [];
  
  for (const teamDoc of teamsSnapshot.docs) {
    const teamData = teamDoc.data();
    
    // Filter by sport/age if specified
    if (sport && teamData.sport !== sport) continue;
    if (ageGroup && teamData.ageGroup !== ageGroup) continue;
    
    const teamEntries = await getTeamDraftPool(teamDoc.id);
    entries.push(...teamEntries);
  }
  
  // Sort by creation date
  return entries.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return aTime - bTime;
  });
}

/**
 * Subscribe to draft pool updates for real-time UI
 */
export function subscribeToDraftPool(
  teamId: string,
  callback: (entries: DraftPoolEntry[]) => void
): () => void {
  const draftPoolRef = collection(db, 'teams', teamId, 'draftPool');
  const q = query(
    draftPoolRef,
    where('status', '==', 'waiting'),
    orderBy('createdAt', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as DraftPoolEntry));
    callback(entries);
  }, (error) => {
    console.error('Error subscribing to draft pool:', error);
    // Return empty array on error so component doesn't hang
    callback([]);
  });
}

/**
 * Get draft pool summary stats
 */
export async function getDraftPoolSummary(teamId: string): Promise<DraftPoolSummary> {
  const entries = await getTeamDraftPool(teamId);
  
  return {
    total: entries.length,
    paidFull: entries.filter(e => e.paymentStatus === 'paid_full').length,
    paidPartial: entries.filter(e => e.paymentStatus === 'paid_partial').length,
    payInPerson: entries.filter(e => e.paymentStatus === 'pay_in_person').length,
    pending: entries.filter(e => e.paymentStatus === 'pending').length,
  };
}

// =============================================================================
// DRAFT ACTIONS (Commissioner/Coach Only)
// =============================================================================

/**
 * Draft a player from the pool to a team's roster
 */
export async function draftToRoster(
  teamId: string,
  entryId: string,
  draftedBy: string,
  targetTeamId?: string // Optional: draft to a different team (same commissioner)
): Promise<{ success: boolean; error?: string; playerId?: string }> {
  try {
    const entryRef = doc(db, 'teams', teamId, 'draftPool', entryId);
    const entrySnap = await getDoc(entryRef);
    
    if (!entrySnap.exists()) {
      return { success: false, error: 'Draft pool entry not found' };
    }
    
    const entry = { id: entrySnap.id, ...entrySnap.data() } as DraftPoolEntry;
    
    if (entry.status !== 'waiting') {
      return { success: false, error: 'Player is no longer in the draft pool' };
    }
    
    const finalTeamId = targetTeamId || teamId;
    
    // Get target team data
    const teamRef = doc(db, 'teams', finalTeamId);
    const teamSnap = await getDoc(teamRef);
    
    if (!teamSnap.exists()) {
      return { success: false, error: 'Target team not found' };
    }
    
    const teamData = teamSnap.data();
    
    // Create player in roster - using fields that exist on Player type
    const playerData: Record<string, any> = {
      name: entry.playerName,
      teamId: finalTeamId,
      dob: entry.playerDob,
      position: entry.preferredPositions?.[0],
      isActive: true,
      parentId: entry.isIndependentAthlete ? null : entry.registeredByUserId,
      stats: { td: 0, tkl: 0 },
      // Link to user if independent athlete
      ...(entry.isIndependentAthlete && entry.registeredByUserId ? { 
        released: true,
        releasedUid: entry.registeredByUserId 
      } : {}),
      // Medical info stored on player
      medical: entry.medicalInfo ? {
        allergies: entry.medicalInfo.allergies,
        medications: entry.medicalInfo.medications,
        conditions: entry.medicalInfo.conditions,
        emergencyContact: entry.emergencyContact ? {
          name: entry.emergencyContact.name,
          phone: entry.emergencyContact.phone,
          relationship: entry.emergencyContact.relationship,
        } : undefined,
      } : undefined,
      // Uniform sizes
      shirtSize: entry.uniformSizes?.jersey,
      // Timestamps
      createdAt: serverTimestamp(),
      // Tracking fields
      addedFromDraftPool: true,
      draftPoolEntryId: entry.id,
    };
    
    const playersRef = collection(db, 'teams', finalTeamId, 'players');
    const playerDocRef = await addDoc(playersRef, playerData);
    
    // Update draft pool entry as drafted
    await updateDoc(entryRef, {
      status: 'drafted',
      draftedAt: serverTimestamp(),
      draftedBy,
      draftedToTeamId: finalTeamId,
      draftedToTeamName: teamData.name,
      updatedAt: serverTimestamp(),
    });
    
    // If independent athlete, update their user profile with teamId
    if (entry.isIndependentAthlete && entry.registeredByUserId) {
      const userRef = doc(db, 'users', entry.registeredByUserId);
      await updateDoc(userRef, {
        selectedTeamId: finalTeamId,
        updatedAt: serverTimestamp(),
      });
    }
    
    return { success: true, playerId: playerDocRef.id };
  } catch (error: any) {
    console.error('Error drafting player:', error);
    return { success: false, error: error.message || 'Failed to draft player' };
  }
}

/**
 * Auto-draft a player to roster (for single-team age groups)
 */
async function autoDraftToRoster(teamId: string, entryId: string): Promise<void> {
  // Get team owner to use as "draftedBy"
  const teamRef = doc(db, 'teams', teamId);
  const teamSnap = await getDoc(teamRef);
  
  if (!teamSnap.exists()) return;
  
  const teamData = teamSnap.data();
  const draftedBy = teamData.ownerId || teamData.coachId || 'system';
  
  await draftToRoster(teamId, entryId, draftedBy);
}

/**
 * Decline a player from the draft pool
 */
export async function declineDraftEntry(
  teamId: string,
  entryId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const entryRef = doc(db, 'teams', teamId, 'draftPool', entryId);
    
    await updateDoc(entryRef, {
      status: 'declined',
      declinedReason: reason || 'Declined by team',
      updatedAt: serverTimestamp(),
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error declining draft entry:', error);
    return { success: false, error: error.message || 'Failed to decline entry' };
  }
}

// =============================================================================
// PAYMENT UPDATES (Coach/Commissioner only)
// =============================================================================

/**
 * Update payment status for a draft pool entry
 */
export async function updateDraftPoolPayment(
  teamId: string,
  entryId: string,
  update: {
    paymentStatus?: DraftPoolPaymentStatus;
    amountPaid?: number;
    paymentMethod?: 'paypal' | 'cash' | 'check' | 'other';
    paymentNotes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const entryRef = doc(db, 'teams', teamId, 'draftPool', entryId);
    const entrySnap = await getDoc(entryRef);
    
    if (!entrySnap.exists()) {
      return { success: false, error: 'Entry not found' };
    }
    
    const currentData = entrySnap.data();
    const newAmountPaid = update.amountPaid ?? currentData.amountPaid;
    const newRemainingBalance = currentData.totalAmount - newAmountPaid;
    
    // Determine payment status based on amount
    let newPaymentStatus = update.paymentStatus;
    if (!newPaymentStatus) {
      if (newRemainingBalance <= 0) {
        newPaymentStatus = 'paid_full';
      } else if (newAmountPaid > 0) {
        newPaymentStatus = 'paid_partial';
      }
    }
    
    await updateDoc(entryRef, {
      ...update,
      ...(newPaymentStatus && { paymentStatus: newPaymentStatus }),
      ...(update.amountPaid !== undefined && { 
        amountPaid: newAmountPaid,
        remainingBalance: newRemainingBalance,
      }),
      updatedAt: serverTimestamp(),
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error updating draft pool payment:', error);
    return { success: false, error: error.message || 'Failed to update payment' };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a team is the only one for its sport/age group under this owner
 * If true, players registering can be auto-drafted
 */
async function checkAutoDraftEligibility(
  ownerId: string,
  sport: SportType,
  ageGroup: string,
  currentTeamId: string
): Promise<boolean> {
  const teamsQuery = query(
    collection(db, 'teams'),
    where('ownerId', '==', ownerId),
    where('sport', '==', sport),
    where('ageGroup', '==', ageGroup)
  );
  
  const snapshot = await getDocs(teamsQuery);
  
  // If only 1 team (the current one), eligible for auto-draft
  return snapshot.docs.length === 1 && snapshot.docs[0].id === currentTeamId;
}

/**
 * Get count of teams by sport/age group for a commissioner
 * Useful for showing if multi-team drafting is available
 */
export async function getTeamCountBySportAge(
  ownerId: string,
  sport: SportType,
  ageGroup: string
): Promise<number> {
  const teamsQuery = query(
    collection(db, 'teams'),
    where('ownerId', '==', ownerId),
    where('sport', '==', sport),
    where('ageGroup', '==', ageGroup)
  );
  
  const snapshot = await getDocs(teamsQuery);
  return snapshot.docs.length;
}

/**
 * Get all teams for a sport/age group (for cross-team drafting UI)
 */
export async function getTeamsForDrafting(
  ownerId: string,
  sport: SportType,
  ageGroup: string
): Promise<Array<{ id: string; name: string; playerCount: number }>> {
  const teamsQuery = query(
    collection(db, 'teams'),
    where('ownerId', '==', ownerId),
    where('sport', '==', sport),
    where('ageGroup', '==', ageGroup)
  );
  
  const snapshot = await getDocs(teamsQuery);
  const teams: Array<{ id: string; name: string; playerCount: number }> = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    // Get player count
    const playersSnap = await getDocs(collection(db, 'teams', doc.id, 'players'));
    teams.push({
      id: doc.id,
      name: data.name,
      playerCount: playersSnap.size,
    });
  }
  
  return teams;
}
