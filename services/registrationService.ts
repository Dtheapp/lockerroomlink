/**
 * OSYS Registration Service
 * 
 * Independent registration system for programs - decoupled from seasons.
 * Supports: age_pool, camp, tryout, event, tournament, clinic
 * 
 * Collection: programs/{programId}/registrations/{registrationId}
 * Subcollection: programs/{programId}/registrations/{registrationId}/registrants/{registrantId}
 */

import { db } from './firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  increment,
  deleteDoc,
  getDocs,
  writeBatch,
  limit
} from 'firebase/firestore';
import { createNotification, createBulkNotifications } from './notificationService';
import {
  ProgramRegistration,
  Registrant,
  RegistrationType,
  RegistrationOutcome,
  RegistrationAgeGroup,
  RegistrationCustomField,
  RegistrationSummary
} from '../types';
import { toastSuccess, toastError } from './toast';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a URL-friendly slug from a string
 */
const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
};

/**
 * Check if a registration slug already exists for a program
 */
const slugExists = async (programId: string, slug: string): Promise<boolean> => {
  const docRef = doc(db, 'programs', programId, 'registrations', slug);
  const docSnap = await getDoc(docRef);
  return docSnap.exists();
};

/**
 * Check if a season already has an active (non-deleted) registration
 */
export const seasonHasRegistration = async (programId: string, seasonId: string): Promise<{ exists: boolean; registrationName?: string }> => {
  const registrationsRef = collection(db, 'programs', programId, 'registrations');
  const q = query(
    registrationsRef,
    where('linkedSeasonId', '==', seasonId),
    where('status', 'in', ['draft', 'open', 'paused', 'closed']), // Exclude deleted
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return { exists: false };
  }
  
  const registration = snapshot.docs[0].data();
  return { exists: true, registrationName: registration.name };
};

/**
 * Generate a unique slug for a registration
 */
const generateUniqueSlug = async (programId: string, baseName: string): Promise<string> => {
  let slug = generateSlug(baseName);
  
  // If empty, use a default
  if (!slug) slug = 'registration';
  
  // Check if slug exists
  let exists = await slugExists(programId, slug);
  
  if (!exists) return slug;
  
  // Try appending numbers
  let counter = 2;
  while (exists && counter <= 100) {
    const newSlug = `${slug}-${counter}`;
    exists = await slugExists(programId, newSlug);
    if (!exists) return newSlug;
    counter++;
  }
  
  // Fallback: append timestamp
  return `${slug}-${Date.now().toString(36)}`;
};

// ============================================
// REGISTRATION CRUD OPERATIONS
// ============================================

/**
 * Create a new registration with human-readable URL slug
 */
export const createRegistration = async (
  programId: string,
  registrationData: Omit<ProgramRegistration, 'id' | 'createdAt' | 'updatedAt' | 'registrationCount' | 'paidCount' | 'pendingCount' | 'waitlistCount'>
): Promise<string> => {
  try {
    // Check if season already has a registration (if this is a season registration)
    if (registrationData.linkedSeasonId) {
      const seasonCheck = await seasonHasRegistration(programId, registrationData.linkedSeasonId);
      if (seasonCheck.exists) {
        throw new Error(`This season already has an active registration: "${seasonCheck.registrationName}". Please delete or close that registration first.`);
      }
    }
    
    // Generate a human-readable slug from the registration name
    const slug = await generateUniqueSlug(programId, registrationData.name);
    
    const newRegistration: Omit<ProgramRegistration, 'id'> = {
      ...registrationData,
      registrationCount: 0,
      paidCount: 0,
      pendingCount: 0,
      waitlistCount: 0,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };

    // Use setDoc with the slug as the document ID instead of addDoc
    const docRef = doc(db, 'programs', programId, 'registrations', slug);
    await setDoc(docRef, newRegistration);
    
    console.log('✅ Created registration with slug:', slug);
    toastSuccess('Registration created successfully!');
    return slug;
  } catch (error) {
    console.error('Error creating registration:', error);
    toastError('Failed to create registration');
    throw error;
  }
};

/**
 * Get a single registration by ID
 */
export const getRegistration = async (
  programId: string,
  registrationId: string
): Promise<ProgramRegistration | null> => {
  try {
    const docRef = doc(db, 'programs', programId, 'registrations', registrationId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    return {
      id: docSnap.id,
      ...docSnap.data()
    } as ProgramRegistration;
  } catch (error) {
    console.error('Error getting registration:', error);
    return null;
  }
};

/**
 * Update a registration
 */
export const updateRegistration = async (
  programId: string,
  registrationId: string,
  updates: Partial<ProgramRegistration>
): Promise<void> => {
  try {
    const docRef = doc(db, 'programs', programId, 'registrations', registrationId);
    
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    toastSuccess('Registration updated!');
  } catch (error) {
    console.error('Error updating registration:', error);
    toastError('Failed to update registration');
    throw error;
  }
};

/**
 * Delete a registration (only if no registrants)
 */
export const deleteRegistration = async (
  programId: string,
  registrationId: string
): Promise<void> => {
  try {
    // Check for registrants first
    const registrantsRef = collection(db, 'programs', programId, 'registrations', registrationId, 'registrants');
    const registrantsSnap = await getDocs(query(registrantsRef, limit(1)));
    
    if (!registrantsSnap.empty) {
      toastError('Cannot delete registration with registrants');
      throw new Error('Cannot delete registration with registrants');
    }
    
    await deleteDoc(doc(db, 'programs', programId, 'registrations', registrationId));
    toastSuccess('Registration deleted');
  } catch (error) {
    console.error('Error deleting registration:', error);
    throw error;
  }
};

// ============================================
// REGISTRATION STATUS MANAGEMENT
// ============================================

/**
 * Open a registration for new signups
 */
export const openRegistration = async (
  programId: string,
  registrationId: string
): Promise<void> => {
  await updateRegistration(programId, registrationId, {
    status: 'open'
  });
  toastSuccess('Registration is now open!');
};

/**
 * Close a registration (no new signups)
 */
export const closeRegistration = async (
  programId: string,
  registrationId: string
): Promise<void> => {
  await updateRegistration(programId, registrationId, {
    status: 'closed'
  });
  toastSuccess('Registration closed');
};

/**
 * Complete a registration (all processing done)
 */
export const completeRegistration = async (
  programId: string,
  registrationId: string
): Promise<void> => {
  await updateRegistration(programId, registrationId, {
    status: 'completed'
  });
  toastSuccess('Registration marked as completed');
};

/**
 * Cancel a registration
 */
export const cancelRegistration = async (
  programId: string,
  registrationId: string
): Promise<void> => {
  await updateRegistration(programId, registrationId, {
    status: 'cancelled'
  });
  toastSuccess('Registration cancelled');
};

/**
 * Check if registration is open based on dates and status
 */
export const isRegistrationOpen = (registration: ProgramRegistration): boolean => {
  if (registration.status !== 'open') return false;
  
  const now = new Date();
  const openDate = new Date(registration.registrationOpenDate);
  const closeDate = new Date(registration.registrationCloseDate);
  
  return now >= openDate && now <= closeDate;
};

/**
 * Auto-update registration status based on dates
 */
export const autoUpdateRegistrationStatus = async (
  programId: string,
  registration: ProgramRegistration
): Promise<void> => {
  const now = new Date();
  const openDate = new Date(registration.registrationOpenDate);
  const closeDate = new Date(registration.registrationCloseDate);
  
  let newStatus = registration.status;
  
  if (registration.status === 'scheduled' && now >= openDate && now <= closeDate) {
    newStatus = 'open';
  } else if (registration.status === 'open' && now > closeDate) {
    newStatus = 'closed';
  }
  
  if (newStatus !== registration.status) {
    await updateRegistration(programId, registration.id, { status: newStatus });
  }
};

// ============================================
// REGISTRANT OPERATIONS
// ============================================

/**
 * Add a new registrant
 */
export const addRegistrant = async (
  programId: string,
  registrationId: string,
  registrantData: Omit<Registrant, 'id' | 'registeredAt'>
): Promise<string> => {
  try {
    const registrantsRef = collection(db, 'programs', programId, 'registrations', registrationId, 'registrants');
    
    // Check for duplicate registration (same player already registered)
    if (registrantData.existingPlayerId) {
      const duplicateQuery = query(
        registrantsRef,
        where('existingPlayerId', '==', registrantData.existingPlayerId)
      );
      const duplicateSnap = await getDocs(duplicateQuery);
      if (!duplicateSnap.empty) {
        toastError('This player is already registered');
        throw new Error('Player already registered');
      }
    }
    
    // Check capacity
    const registration = await getRegistration(programId, registrationId);
    if (registration?.hasCapacity && registration.capacity) {
      if (registration.registrationCount >= registration.capacity) {
        toastError('Registration is at capacity');
        throw new Error('Registration at capacity');
      }
    }
    
    const newRegistrant: Omit<Registrant, 'id'> = {
      ...registrantData,
      registeredAt: serverTimestamp() as any,
    };

    const docRef = await addDoc(registrantsRef, newRegistrant);
    
    // Update counts on registration
    const registrationRef = doc(db, 'programs', programId, 'registrations', registrationId);
    await updateDoc(registrationRef, {
      registrationCount: increment(1),
      pendingCount: increment(1),
      updatedAt: serverTimestamp()
    });
    
    // Update player document with registration status (for sport context detection)
    if (registrantData.existingPlayerId) {
      try {
        const playerRef = doc(db, 'players', registrantData.existingPlayerId);
        await updateDoc(playerRef, {
          draftPoolStatus: 'waiting',
          draftPoolProgramId: programId,
          draftPoolRegistrationId: registrationId,
          draftPoolAgeGroup: registrantData.ageGroupLabel || registrantData.calculatedAgeGroup || null,
          draftPoolSport: registration?.sport || 'football',
          registrationId: docRef.id,
          updatedAt: serverTimestamp()
        });
        console.log('[Registration] Updated player document with registration status:', registrantData.existingPlayerId);
      } catch (playerErr) {
        console.error('[Registration] Error updating player document:', playerErr);
        // Don't fail the registration if player update fails
      }
    }
    
    // Send notifications
    await sendRegistrationNotifications(programId, registrationId, registrantData, registration);
    
    toastSuccess('Registration submitted!');
    return docRef.id;
  } catch (error) {
    console.error('Error adding registrant:', error);
    throw error;
  }
};

/**
 * Send notifications when a new registrant signs up
 */
const sendRegistrationNotifications = async (
  programId: string,
  registrationId: string,
  registrant: Omit<Registrant, 'id' | 'registeredAt'>,
  registration: ProgramRegistration | null
) => {
  try {
    const athleteName = registrant.fullName || `${registrant.firstName} ${registrant.lastName}`;
    const regName = registration?.name || 'Registration';
    const ageGroup = registrant.ageGroupLabel || registrant.calculatedAgeGroup || '';
    
    // 1. Notify parent (confirmation)
    if (registrant.parentId) {
      await createNotification(
        registrant.parentId,
        'registration_confirmed',
        `Registration Submitted: ${athleteName}`,
        `${athleteName} has been registered for ${regName}${ageGroup ? ` (${ageGroup})` : ''}. You'll be notified when they're assigned to a team.`,
        {
          link: `/dashboard`,
          category: 'registration',
          priority: 'normal',
          metadata: { programId, registrationId, athleteName, ageGroup }
        }
      );
    }
    
    // 2. Get program to find commissioner(s)
    const programDoc = await getDoc(doc(db, 'programs', programId));
    if (programDoc.exists()) {
      const programData = programDoc.data();
      const commissionerIds: string[] = [];
      
      // Get commissioner from program
      if (programData.commissionerId) commissionerIds.push(programData.commissionerId);
      if (programData.commissionerIds) commissionerIds.push(...programData.commissionerIds);
      // Also check ownerId
      if (programData.ownerId && !commissionerIds.includes(programData.ownerId)) {
        commissionerIds.push(programData.ownerId);
      }
      
      // Notify each commissioner
      for (const commId of commissionerIds) {
        await createNotification(
          commId,
          'registration_confirmed',
          `New Registration: ${athleteName}`,
          `${athleteName} has registered for ${regName}${ageGroup ? ` (${ageGroup})` : ''}.`,
          {
            link: `/commissioner/registrations`,
            category: 'registration',
            priority: 'normal',
            metadata: { programId, registrationId, athleteName, ageGroup }
          }
        );
      }
    }
    
    console.log('[Registration] Notifications sent successfully');
  } catch (notifErr) {
    console.error('[Registration] Error sending notifications:', notifErr);
    // Don't fail the registration if notifications fail
  }
};

/**
 * Get a registrant by ID
 */
export const getRegistrant = async (
  programId: string,
  registrationId: string,
  registrantId: string
): Promise<Registrant | null> => {
  try {
    const docRef = doc(db, 'programs', programId, 'registrations', registrationId, 'registrants', registrantId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    return {
      id: docSnap.id,
      ...docSnap.data()
    } as Registrant;
  } catch (error) {
    console.error('Error getting registrant:', error);
    return null;
  }
};

/**
 * Update a registrant
 */
export const updateRegistrant = async (
  programId: string,
  registrationId: string,
  registrantId: string,
  updates: Partial<Registrant>
): Promise<void> => {
  try {
    const docRef = doc(db, 'programs', programId, 'registrations', registrationId, 'registrants', registrantId);
    await updateDoc(docRef, updates);
  } catch (error) {
    console.error('Error updating registrant:', error);
    throw error;
  }
};

/**
 * Mark registrant as paid
 */
export const markRegistrantPaid = async (
  programId: string,
  registrationId: string,
  registrantId: string,
  paymentMethod: 'paypal' | 'stripe' | 'cash' | 'check' | 'other',
  amountPaid: number
): Promise<void> => {
  try {
    await updateRegistrant(programId, registrationId, registrantId, {
      paymentStatus: 'paid',
      paymentMethod,
      amountPaid,
      remainingBalance: 0,
      paymentDate: new Date()
    });
    
    // Update paid count, decrease pending
    const registrationRef = doc(db, 'programs', programId, 'registrations', registrationId);
    await updateDoc(registrationRef, {
      paidCount: increment(1),
      pendingCount: increment(-1),
      updatedAt: serverTimestamp()
    });
    
    toastSuccess('Payment recorded');
  } catch (error) {
    console.error('Error marking paid:', error);
    toastError('Failed to record payment');
    throw error;
  }
};

/**
 * Waive registrant payment (scholarship, discount, etc.)
 */
export const waiveRegistrantPayment = async (
  programId: string,
  registrationId: string,
  registrantId: string,
  reason?: string
): Promise<void> => {
  try {
    await updateRegistrant(programId, registrationId, registrantId, {
      paymentStatus: 'waived',
      amountDue: 0,
      remainingBalance: 0,
      paymentNotes: reason || 'Fee waived by commissioner'
    });
    
    // Update paid count (waived counts as paid for reporting)
    const registrationRef = doc(db, 'programs', programId, 'registrations', registrationId);
    await updateDoc(registrationRef, {
      paidCount: increment(1),
      pendingCount: increment(-1),
      updatedAt: serverTimestamp()
    });
    
    toastSuccess('Payment waived');
  } catch (error) {
    console.error('Error waiving payment:', error);
    toastError('Failed to waive payment');
    throw error;
  }
};

/**
 * Update registrant payment status (wrapper for UI)
 */
export const updateRegistrantPayment = async (
  programId: string,
  registrationId: string,
  registrantId: string,
  action: 'mark_paid' | 'waive' | 'record_partial',
  options?: { amount?: number; method?: string; notes?: string }
): Promise<void> => {
  switch (action) {
    case 'mark_paid':
      return markRegistrantPaid(
        programId, 
        registrationId, 
        registrantId, 
        (options?.method || 'cash') as 'cash' | 'check' | 'other',
        options?.amount || 0
      );
    case 'waive':
      return waiveRegistrantPayment(programId, registrationId, registrantId, options?.notes);
    case 'record_partial':
      await updateRegistrant(programId, registrationId, registrantId, {
        paymentStatus: 'partial',
        amountPaid: options?.amount || 0,
        paymentNotes: options?.notes
      });
      toastSuccess('Partial payment recorded');
      return;
  }
};

/**
 * Confirm a registrant (update status to confirmed)
 */
export const confirmRegistrant = async (
  programId: string,
  registrationId: string,
  registrantId: string
): Promise<void> => {
  try {
    await updateRegistrant(programId, registrationId, registrantId, {
      status: 'confirmed',
      confirmedAt: new Date()
    });
    
    toastSuccess('Registrant confirmed');
  } catch (error) {
    console.error('Error confirming registrant:', error);
    throw error;
  }
};

/**
 * Assign registrant to a team/group
 */
export const assignRegistrant = async (
  programId: string,
  registrationId: string,
  registrantId: string,
  assignment: {
    teamId?: string;
    teamName?: string;
  }
): Promise<void> => {
  try {
    await updateRegistrant(programId, registrationId, registrantId, {
      assignedTeamId: assignment.teamId,
      assignedTeamName: assignment.teamName,
      status: 'assigned',
      assignedAt: new Date()
    });
    
    toastSuccess('Player assigned');
  } catch (error) {
    console.error('Error assigning registrant:', error);
    throw error;
  }
};

/**
 * Delete a registrant (cancel registration)
 */
export const deleteRegistrant = async (
  programId: string,
  registrationId: string,
  registrantId: string
): Promise<void> => {
  try {
    // Get registrant to check payment status
    const registrant = await getRegistrant(programId, registrationId, registrantId);
    
    await deleteDoc(doc(db, 'programs', programId, 'registrations', registrationId, 'registrants', registrantId));
    
    // Update counts
    const decrements: any = {
      registrationCount: increment(-1),
      updatedAt: serverTimestamp()
    };
    
    if (registrant?.paymentStatus === 'paid') {
      decrements.paidCount = increment(-1);
    } else if (registrant?.paymentStatus === 'pending') {
      decrements.pendingCount = increment(-1);
    }
    if (registrant?.status === 'waitlisted') {
      decrements.waitlistCount = increment(-1);
    }
    
    const registrationRef = doc(db, 'programs', programId, 'registrations', registrationId);
    await updateDoc(registrationRef, decrements);
    
    toastSuccess('Registration cancelled');
  } catch (error) {
    console.error('Error deleting registrant:', error);
    throw error;
  }
};

// ============================================
// REAL-TIME LISTENERS
// ============================================

/**
 * Subscribe to all registrations for a program
 */
export const subscribeToRegistrations = (
  programId: string,
  callback: (registrations: ProgramRegistration[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'programs', programId, 'registrations'),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const registrations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ProgramRegistration[];
    callback(registrations);
  });
};

/**
 * Subscribe to active registrations (open + scheduled)
 */
export const subscribeToActiveRegistrations = (
  programId: string,
  callback: (registrations: ProgramRegistration[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'programs', programId, 'registrations'),
    where('status', 'in', ['open', 'scheduled']),
    orderBy('registrationOpenDate', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const registrations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ProgramRegistration[];
    callback(registrations);
  });
};

/**
 * Subscribe to registrants for a registration
 */
export const subscribeToRegistrants = (
  programId: string,
  registrationId: string,
  callback: (registrants: Registrant[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'programs', programId, 'registrations', registrationId, 'registrants'),
    orderBy('registeredAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const registrants = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Registrant[];
    callback(registrants);
  });
};

// ============================================
// STATISTICS & ANALYTICS
// ============================================

/**
 * Get registration statistics
 */
export const getRegistrationStats = async (
  programId: string,
  registrationId: string
): Promise<{
  total: number;
  paid: number;
  unpaid: number;
  confirmed: number;
  pending: number;
  byAgeGroup: Record<string, number>;
  byPaymentStatus: Record<string, number>;
}> => {
  try {
    const registrantsRef = collection(db, 'programs', programId, 'registrations', registrationId, 'registrants');
    const snapshot = await getDocs(registrantsRef);
    
    const stats = {
      total: 0,
      paid: 0,
      unpaid: 0,
      confirmed: 0,
      pending: 0,
      byAgeGroup: {} as Record<string, number>,
      byPaymentStatus: {} as Record<string, number>
    };
    
    snapshot.docs.forEach(doc => {
      const registrant = doc.data() as Registrant;
      stats.total++;
      
      // Payment stats
      if (registrant.paymentStatus === 'paid') {
        stats.paid++;
      } else {
        stats.unpaid++;
      }
      
      // Status stats
      if (registrant.status === 'confirmed') {
        stats.confirmed++;
      } else {
        stats.pending++;
      }
      
      // Age group breakdown
      const ageGroup = registrant.calculatedAgeGroup || registrant.ageGroupLabel || 'Unknown';
      stats.byAgeGroup[ageGroup] = (stats.byAgeGroup[ageGroup] || 0) + 1;
      
      // Payment status breakdown
      const paymentStatus = registrant.paymentStatus || 'pending';
      stats.byPaymentStatus[paymentStatus] = (stats.byPaymentStatus[paymentStatus] || 0) + 1;
    });
    
    return stats;
  } catch (error) {
    console.error('Error getting stats:', error);
    throw error;
  }
};

/**
 * Get registration summaries for dashboard display
 */
export const getRegistrationSummaries = async (
  programId: string
): Promise<RegistrationSummary[]> => {
  try {
    const registrations = await getDocs(
      query(
        collection(db, 'programs', programId, 'registrations'),
        orderBy('createdAt', 'desc')
      )
    );
    
    return registrations.docs.map(doc => {
      const data = doc.data() as ProgramRegistration;
      return {
        id: doc.id,
        name: data.name,
        type: data.type,
        sport: data.sport,
        status: data.status,
        registrationCount: data.registrationCount || 0,
        capacity: data.capacity,
        registrationCloseDate: data.registrationCloseDate,
        eventDate: data.eventDate
      };
    });
  } catch (error) {
    console.error('Error getting summaries:', error);
    return [];
  }
};

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Bulk confirm all paid registrants
 */
export const bulkConfirmPaidRegistrants = async (
  programId: string,
  registrationId: string
): Promise<number> => {
  try {
    const registrantsRef = collection(db, 'programs', programId, 'registrations', registrationId, 'registrants');
    const q = query(
      registrantsRef,
      where('paymentStatus', '==', 'paid'),
      where('status', '!=', 'confirmed')
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    let count = 0;
    
    snapshot.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { status: 'confirmed', confirmedAt: new Date() });
      count++;
    });
    
    if (count > 0) {
      await batch.commit();
    }
    
    toastSuccess(`${count} registrants confirmed`);
    return count;
  } catch (error) {
    console.error('Error bulk confirming:', error);
    toastError('Failed to confirm registrants');
    throw error;
  }
};

/**
 * Export registrants to CSV data
 */
export const exportRegistrantsToCSV = async (
  programId: string,
  registrationId: string
): Promise<string> => {
  try {
    const registrantsRef = collection(db, 'programs', programId, 'registrations', registrationId, 'registrants');
    const snapshot = await getDocs(query(registrantsRef, orderBy('registeredAt', 'asc')));
    
    const headers = [
      'Full Name',
      'DOB',
      'Age Group',
      'Parent Name',
      'Parent Email',
      'Parent Phone',
      'Payment Status',
      'Amount Paid',
      'Status',
      'Assigned Team',
      'Registered At'
    ];
    
    const rows = snapshot.docs.map(doc => {
      const r = doc.data() as Registrant;
      const registeredDate = r.registeredAt instanceof Date 
        ? r.registeredAt.toISOString() 
        : (r.registeredAt as any)?.toDate?.()?.toISOString() || '';
      return [
        r.fullName,
        r.dateOfBirth,
        r.ageGroupLabel || r.calculatedAgeGroup || '',
        r.parentName || '',
        r.parentEmail,
        r.parentPhone || '',
        r.paymentStatus,
        (r.amountPaid / 100).toFixed(2), // Convert cents to dollars
        r.status,
        r.assignedTeamName || '',
        registeredDate
      ].map(val => `"${(String(val) || '').replace(/"/g, '""')}"`).join(',');
    });
    
    return [headers.join(','), ...rows].join('\n');
  } catch (error) {
    console.error('Error exporting:', error);
    throw error;
  }
};

/**
 * Calculate registration fee with early bird / late fees
 */
export const calculateRegistrationFee = (
  registration: ProgramRegistration
): { amount: number; label: string; isEarlyBird: boolean; isLateFee: boolean } => {
  const now = new Date();
  const { registrationFee, earlyBirdFee, earlyBirdDeadline, lateFee, lateAfterDate } = registration;
  
  // Check early bird
  if (earlyBirdFee && earlyBirdDeadline) {
    const earlyDeadline = new Date(earlyBirdDeadline);
    if (now <= earlyDeadline) {
      return {
        amount: earlyBirdFee,
        label: 'Early Bird',
        isEarlyBird: true,
        isLateFee: false
      };
    }
  }
  
  // Check late fee
  if (lateFee && lateAfterDate) {
    const lateStart = new Date(lateAfterDate);
    if (now >= lateStart) {
      return {
        amount: registrationFee + lateFee,
        label: 'Late Registration',
        isEarlyBird: false,
        isLateFee: true
      };
    }
  }
  
  // Regular fee
  return {
    amount: registrationFee,
    label: 'Registration Fee',
    isEarlyBird: false,
    isLateFee: false
  };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate age groups based on sport and type
 * Birth years are calculated based on current year
 */
export const generateDefaultAgeGroups = (sport: string): RegistrationAgeGroup[] => {
  const currentYear = new Date().getFullYear();
  
  // Football-style age groups
  if (sport.toLowerCase() === 'football') {
    return [
      { id: '5u', label: '5U', ageGroups: ['5U'], minBirthYear: currentYear - 5, maxBirthYear: currentYear - 4, capacity: 24, registrationCount: 0 },
      { id: '6u', label: '6U', ageGroups: ['6U'], minBirthYear: currentYear - 6, maxBirthYear: currentYear - 5, capacity: 24, registrationCount: 0 },
      { id: '7u', label: '7U', ageGroups: ['7U'], minBirthYear: currentYear - 7, maxBirthYear: currentYear - 6, capacity: 24, registrationCount: 0 },
      { id: '8u', label: '8U', ageGroups: ['8U'], minBirthYear: currentYear - 8, maxBirthYear: currentYear - 7, capacity: 26, registrationCount: 0 },
      { id: '9u', label: '9U', ageGroups: ['9U'], minBirthYear: currentYear - 9, maxBirthYear: currentYear - 8, capacity: 26, registrationCount: 0 },
      { id: '10u', label: '10U', ageGroups: ['10U'], minBirthYear: currentYear - 10, maxBirthYear: currentYear - 9, capacity: 28, registrationCount: 0 },
      { id: '11u', label: '11U', ageGroups: ['11U'], minBirthYear: currentYear - 11, maxBirthYear: currentYear - 10, capacity: 28, registrationCount: 0 },
      { id: '12u', label: '12U', ageGroups: ['12U'], minBirthYear: currentYear - 12, maxBirthYear: currentYear - 11, capacity: 30, registrationCount: 0 },
      { id: '13u', label: '13U', ageGroups: ['13U'], minBirthYear: currentYear - 13, maxBirthYear: currentYear - 12, capacity: 30, registrationCount: 0 },
      { id: '14u', label: '14U', ageGroups: ['14U'], minBirthYear: currentYear - 14, maxBirthYear: currentYear - 13, capacity: 30, registrationCount: 0 }
    ];
  }
  
  // Basketball-style age groups
  if (sport.toLowerCase() === 'basketball') {
    return [
      { id: '8u', label: '8U', ageGroups: ['7U', '8U'], minBirthYear: currentYear - 8, maxBirthYear: currentYear - 6, capacity: 12, registrationCount: 0 },
      { id: '10u', label: '10U', ageGroups: ['9U', '10U'], minBirthYear: currentYear - 10, maxBirthYear: currentYear - 9, capacity: 12, registrationCount: 0 },
      { id: '12u', label: '12U', ageGroups: ['11U', '12U'], minBirthYear: currentYear - 12, maxBirthYear: currentYear - 11, capacity: 12, registrationCount: 0 },
      { id: '14u', label: '14U', ageGroups: ['13U', '14U'], minBirthYear: currentYear - 14, maxBirthYear: currentYear - 13, capacity: 12, registrationCount: 0 },
      { id: '16u', label: '16U', ageGroups: ['15U', '16U'], minBirthYear: currentYear - 16, maxBirthYear: currentYear - 15, capacity: 12, registrationCount: 0 },
      { id: '18u', label: '18U', ageGroups: ['17U', '18U'], minBirthYear: currentYear - 18, maxBirthYear: currentYear - 17, capacity: 12, registrationCount: 0 }
    ];
  }
  
  // Generic age groups
  return [
    { id: '6u', label: '6 & Under', ageGroups: ['5U', '6U'], minBirthYear: currentYear - 6, maxBirthYear: currentYear - 4, capacity: 20, registrationCount: 0 },
    { id: '8u', label: '8 & Under', ageGroups: ['7U', '8U'], minBirthYear: currentYear - 8, maxBirthYear: currentYear - 7, capacity: 20, registrationCount: 0 },
    { id: '10u', label: '10 & Under', ageGroups: ['9U', '10U'], minBirthYear: currentYear - 10, maxBirthYear: currentYear - 9, capacity: 20, registrationCount: 0 },
    { id: '12u', label: '12 & Under', ageGroups: ['11U', '12U'], minBirthYear: currentYear - 12, maxBirthYear: currentYear - 11, capacity: 20, registrationCount: 0 },
    { id: '14u', label: '14 & Under', ageGroups: ['13U', '14U'], minBirthYear: currentYear - 14, maxBirthYear: currentYear - 13, capacity: 20, registrationCount: 0 }
  ];
};

/**
 * Get status badge info for UI
 */
export const getRegistrationStatusInfo = (status: ProgramRegistration['status']): {
  label: string;
  variant: 'default' | 'primary' | 'gold' | 'success' | 'live' | 'coming' | 'warning' | 'error';
} => {
  switch (status) {
    case 'draft':
      return { label: 'Draft', variant: 'default' };
    case 'scheduled':
      return { label: 'Scheduled', variant: 'coming' };
    case 'open':
      return { label: 'Open', variant: 'live' };
    case 'closed':
      return { label: 'Closed', variant: 'warning' };
    case 'completed':
      return { label: 'Completed', variant: 'success' };
    case 'cancelled':
      return { label: 'Cancelled', variant: 'error' };
    default:
      return { label: 'Unknown', variant: 'default' };
  }
};

/**
 * Get type label for display
 */
export const getRegistrationTypeLabel = (type: RegistrationType): string => {
  switch (type) {
    case 'age_pool': return 'Season Registration';
    case 'camp': return 'Camp';
    case 'tryout': return 'Tryout';
    case 'event': return 'Event';
    case 'tournament': return 'Tournament';
    case 'clinic': return 'Clinic';
    default: return 'Registration';
  }
};

/**
 * Get outcome label for display
 */
export const getRegistrationOutcomeLabel = (outcome: RegistrationOutcome): string => {
  switch (outcome) {
    case 'draft_pool': return 'Draft Pool';
    case 'rsvp_list': return 'RSVP List';
    case 'team_select': return 'Team Selection';
    case 'waitlist': return 'Waitlist';
    case 'auto_assign': return 'Auto-Assign';
    default: return 'Unknown';
  }
};

// ============================================
// ADMIN CLEANUP UTILITIES
// ============================================

/**
 * Clean up duplicate registrants - keeps only the most recent one per player
 * Call from browser console: window.cleanupDuplicateRegistrants('programId', 'registrationId')
 */
export const cleanupDuplicateRegistrants = async (
  programId: string,
  registrationId: string
): Promise<{ deleted: number; kept: number }> => {
  try {
    const registrantsRef = collection(db, 'programs', programId, 'registrations', registrationId, 'registrants');
    const snapshot = await getDocs(registrantsRef);
    
    console.log(`[Cleanup] Found ${snapshot.docs.length} registrants`);
    
    // Group by existingPlayerId or fullName
    const groups: Record<string, { id: string; registeredAt: any }[]> = {};
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const key = data.existingPlayerId || data.fullName || `${data.firstName}-${data.lastName}`;
      
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        id: doc.id,
        registeredAt: data.registeredAt?.toDate?.() || new Date(0)
      });
    });
    
    // Find duplicates to delete (keep most recent)
    const toDelete: string[] = [];
    
    Object.entries(groups).forEach(([key, entries]) => {
      if (entries.length > 1) {
        console.log(`[Cleanup] Found ${entries.length} duplicates for ${key}`);
        // Sort by registeredAt descending (most recent first)
        entries.sort((a, b) => b.registeredAt.getTime() - a.registeredAt.getTime());
        // Mark all except the first (most recent) for deletion
        entries.slice(1).forEach(e => toDelete.push(e.id));
      }
    });
    
    console.log(`[Cleanup] Deleting ${toDelete.length} duplicates...`);
    
    // Delete duplicates
    const batch = writeBatch(db);
    toDelete.forEach(id => {
      batch.delete(doc(db, 'programs', programId, 'registrations', registrationId, 'registrants', id));
    });
    await batch.commit();
    
    // Update registration count
    const kept = snapshot.docs.length - toDelete.length;
    const registrationRef = doc(db, 'programs', programId, 'registrations', registrationId);
    await updateDoc(registrationRef, {
      registrationCount: kept,
      pendingCount: kept,
      updatedAt: serverTimestamp()
    });
    
    console.log(`[Cleanup] Done! Deleted ${toDelete.length}, kept ${kept}`);
    toastSuccess(`Cleaned up ${toDelete.length} duplicate registrations`);
    
    return { deleted: toDelete.length, kept };
  } catch (error) {
    console.error('[Cleanup] Error:', error);
    toastError('Failed to cleanup duplicates');
    throw error;
  }
};

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).cleanupDuplicateRegistrants = cleanupDuplicateRegistrants;
}
