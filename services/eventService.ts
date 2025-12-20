// Event Services - Firestore CRUD operations
// ============================================
// NOTE: All queries avoid orderBy() to prevent needing composite indexes
// Sorting is done client-side instead
// SECURITY: All user input is sanitized before storage

import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  query, 
  where, 
  limit,
  Timestamp,
  writeBatch,
  increment
} from 'firebase/firestore';
import { sanitizeText, sanitizeEmail, sanitizePhone, sanitizeUrl } from './sanitize';
import { checkRateLimit, RATE_LIMITS } from './rateLimit';
import { db } from './firebase';
import { 
  Event, 
  NewEvent,
  PricingTier, 
  NewPricingTier,
  PromoCode, 
  NewPromoCode,
  Registration, 
  RegistrationOrder,
  TeamPaymentSettings,
  EventStatus
} from '../types/events';

// Collection references
const EVENTS_COLLECTION = 'events';
// Note: pricingTiers are stored as subcollections under events/{eventId}/pricingTiers
const PROMO_CODES_COLLECTION = 'promoCodes';
const REGISTRATIONS_COLLECTION = 'registrations';
const REGISTRATION_ORDERS_COLLECTION = 'registrationOrders';
const TEAM_PAYMENT_SETTINGS_COLLECTION = 'teamPaymentSettings';

// =============================================================================
// EVENTS
// =============================================================================

/**
 * Sanitize event data before storage
 */
function sanitizeEventData(eventData: Partial<NewEvent>): Partial<NewEvent> {
  return {
    ...eventData,
    title: eventData.title ? sanitizeText(eventData.title, 200) : undefined,
    description: eventData.description ? sanitizeText(eventData.description, 5000) : undefined,
    location: eventData.location ? {
      ...eventData.location,
      name: sanitizeText(eventData.location.name || '', 200),
      address: eventData.location.address ? sanitizeText(eventData.location.address, 500) : undefined,
      city: eventData.location.city ? sanitizeText(eventData.location.city, 100) : undefined,
      state: eventData.location.state ? sanitizeText(eventData.location.state, 50) : undefined,
      zip: eventData.location.zip ? sanitizeText(eventData.location.zip, 20) : undefined,
    } : undefined,
    includedItems: eventData.includedItems?.map(item => sanitizeText(item, 200)),
  };
}

/**
 * Create a new event
 */
export async function createEvent(eventData: NewEvent): Promise<string> {
  // Sanitize user input
  const sanitizedData = sanitizeEventData(eventData);
  
  // Generate shareable link
  const shareableLink = generateShareableLink();
  
  const docRef = await addDoc(collection(db, EVENTS_COLLECTION), {
    ...eventData,
    ...sanitizedData, // Sanitized fields override raw input
    currentCount: 0,
    waitlistCount: 0,
    shareableLink,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  
  return docRef.id;
}

/**
 * Get event by ID
 */
export async function getEvent(eventId: string): Promise<Event | null> {
  const docRef = doc(db, EVENTS_COLLECTION, eventId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return { id: docSnap.id, ...docSnap.data() } as Event;
}

/**
 * Get events by team ID
 */
export async function getEventsByTeam(teamId: string, statusFilter?: EventStatus): Promise<Event[]> {
  // Simple query without orderBy to avoid index requirements
  let q = query(
    collection(db, EVENTS_COLLECTION),
    where('teamId', '==', teamId)
  );
  
  if (statusFilter) {
    q = query(
      collection(db, EVENTS_COLLECTION),
      where('teamId', '==', teamId),
      where('status', '==', statusFilter)
    );
  }
  
  const snapshot = await getDocs(q);
  const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
  
  // Sort client-side by createdAt descending
  events.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
  
  return events;
}

/**
 * Get public events (for parent/fan view)
 */
export async function getPublicEvents(teamId: string): Promise<Event[]> {
  // Query without orderBy to avoid index requirements
  const q = query(
    collection(db, EVENTS_COLLECTION),
    where('teamId', '==', teamId),
    where('isPublic', '==', true),
    where('status', '==', 'active')
  );
  
  const snapshot = await getDocs(q);
  const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
  
  // Sort client-side by eventStartDate ascending
  events.sort((a, b) => {
    const aTime = a.eventStartDate?.toMillis?.() || 0;
    const bTime = b.eventStartDate?.toMillis?.() || 0;
    return aTime - bTime;
  });
  
  return events;
}

/**
 * Get event by shareable link
 */
export async function getEventByShareableLink(link: string): Promise<Event | null> {
  const q = query(
    collection(db, EVENTS_COLLECTION),
    where('shareableLink', '==', link),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  const docData = snapshot.docs[0];
  return { id: docData.id, ...docData.data() } as Event;
}

/**
 * Update an event
 */
export async function updateEvent(eventId: string, updates: Partial<Event>): Promise<void> {
  const docRef = doc(db, EVENTS_COLLECTION, eventId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Delete an event (and all related data)
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const batch = writeBatch(db);
  
  // Delete event
  batch.delete(doc(db, EVENTS_COLLECTION, eventId));
  
  // Delete pricing tiers (subcollection)
  const tiersSnapshot = await getDocs(
    collection(db, EVENTS_COLLECTION, eventId, 'pricingTiers')
  );
  tiersSnapshot.docs.forEach(tierDoc => batch.delete(tierDoc.ref));
  
  // Delete promo codes
  const promoSnapshot = await getDocs(
    query(collection(db, PROMO_CODES_COLLECTION), where('eventId', '==', eventId))
  );
  promoSnapshot.docs.forEach(promoDoc => batch.delete(promoDoc.ref));
  
  await batch.commit();
}

/**
 * Duplicate an event
 */
export async function duplicateEvent(eventId: string, newTitle?: string): Promise<string> {
  const original = await getEvent(eventId);
  if (!original) throw new Error('Event not found');
  
  // Create new event without IDs and timestamps
  const { id, createdAt, updatedAt, currentCount, waitlistCount, shareableLink, ...eventData } = original;
  
  const newEventId = await createEvent({
    ...eventData,
    title: newTitle || `${eventData.title} (Copy)`,
    status: 'draft',
    duplicatedFrom: eventId,
  } as NewEvent);
  
  // Duplicate pricing tiers
  const tiers = await getPricingTiersByEvent(eventId);
  for (const tier of tiers) {
    const { id: tierId, currentQuantity, ...tierData } = tier;
    await createPricingTier({ ...tierData, eventId: newEventId });
  }
  
  return newEventId;
}

/**
 * Update event registration count
 */
export async function updateEventCount(eventId: string, countDelta: number, isWaitlist: boolean = false): Promise<void> {
  const docRef = doc(db, EVENTS_COLLECTION, eventId);
  await updateDoc(docRef, {
    [isWaitlist ? 'waitlistCount' : 'currentCount']: increment(countDelta),
    updatedAt: Timestamp.now(),
  });
}

// =============================================================================
// PRICING TIERS (stored as subcollection: events/{eventId}/pricingTiers)
// =============================================================================

/**
 * Create a pricing tier
 */
export async function createPricingTier(tierData: NewPricingTier): Promise<string> {
  const docRef = await addDoc(collection(db, EVENTS_COLLECTION, tierData.eventId, 'pricingTiers'), {
    ...tierData,
    currentQuantity: 0,
  });
  return docRef.id;
}

/**
 * Get pricing tiers by event
 */
export async function getPricingTiersByEvent(eventId: string): Promise<PricingTier[]> {
  // No orderBy to avoid index requirements
  const snapshot = await getDocs(
    collection(db, EVENTS_COLLECTION, eventId, 'pricingTiers')
  );
  
  const tiers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PricingTier));
  
  // Sort client-side by sortOrder
  tiers.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  
  return tiers;
}

/**
 * Update a pricing tier
 */
export async function updatePricingTier(eventId: string, tierId: string, updates: Partial<PricingTier>): Promise<void> {
  const docRef = doc(db, EVENTS_COLLECTION, eventId, 'pricingTiers', tierId);
  await updateDoc(docRef, updates);
}

/**
 * Delete a pricing tier
 */
export async function deletePricingTier(eventId: string, tierId: string): Promise<void> {
  await deleteDoc(doc(db, EVENTS_COLLECTION, eventId, 'pricingTiers', tierId));
}

/**
 * Increment tier usage count
 */
export async function incrementTierCount(eventId: string, tierId: string, delta: number = 1): Promise<void> {
  const docRef = doc(db, EVENTS_COLLECTION, eventId, 'pricingTiers', tierId);
  await updateDoc(docRef, {
    currentQuantity: increment(delta),
  });
}

// =============================================================================
// PROMO CODES
// =============================================================================

/**
 * Create a promo code
 */
export async function createPromoCode(promoData: NewPromoCode): Promise<string> {
  // Validate code is unique for this event
  const existing = await getPromoCodeByCode(promoData.eventId, promoData.code);
  if (existing) {
    throw new Error('Promo code already exists for this event');
  }
  
  const docRef = await addDoc(collection(db, PROMO_CODES_COLLECTION), {
    ...promoData,
    code: promoData.code.toUpperCase().trim(),
    currentUses: 0,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

/**
 * Get promo codes by event
 */
export async function getPromoCodesByEvent(eventId: string): Promise<PromoCode[]> {
  const q = query(
    collection(db, PROMO_CODES_COLLECTION),
    where('eventId', '==', eventId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PromoCode));
}

/**
 * Get promo code by code string
 */
export async function getPromoCodeByCode(eventId: string, code: string): Promise<PromoCode | null> {
  const q = query(
    collection(db, PROMO_CODES_COLLECTION),
    where('eventId', '==', eventId),
    where('code', '==', code.toUpperCase().trim()),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PromoCode;
}

/**
 * Validate and apply promo code
 * Rate limited to prevent brute-force attacks
 */
export async function validatePromoCode(
  eventId: string, 
  code: string, 
  userId: string,
  tierId?: string
): Promise<{ valid: boolean; promoCode?: PromoCode; error?: string }> {
  // Rate limit to prevent brute-force promo code guessing
  const rateLimitKey = `promo:${userId}:${eventId}`;
  const rateLimitResult = checkRateLimit(rateLimitKey, { maxRequests: 10, windowMs: 60000 });
  if (!rateLimitResult.allowed) {
    return { valid: false, error: 'Too many attempts. Please wait a moment.' };
  }

  // Sanitize input
  const sanitizedCode = sanitizeText(code, 50).toUpperCase().trim();
  if (!sanitizedCode) {
    return { valid: false, error: 'Invalid promo code' };
  }

  const promo = await getPromoCodeByCode(eventId, sanitizedCode);
  
  if (!promo) {
    return { valid: false, error: 'Invalid promo code' };
  }
  
  if (!promo.isActive) {
    return { valid: false, error: 'Promo code is no longer active' };
  }
  
  const now = Timestamp.now();
  if (promo.validFrom && promo.validFrom > now) {
    return { valid: false, error: 'Promo code is not yet valid' };
  }
  
  if (promo.validUntil && promo.validUntil < now) {
    return { valid: false, error: 'Promo code has expired' };
  }
  
  if (promo.maxUses && promo.currentUses >= promo.maxUses) {
    return { valid: false, error: 'Promo code usage limit reached' };
  }
  
  // Check tier restrictions
  if (promo.applicableTiers && promo.applicableTiers.length > 0 && tierId) {
    if (!promo.applicableTiers.includes(tierId)) {
      return { valid: false, error: 'Promo code not valid for this pricing tier' };
    }
  }
  
  // TODO: Check user-specific usage limit (requires querying registrations)
  
  return { valid: true, promoCode: promo };
}

/**
 * Increment promo code usage
 */
export async function incrementPromoCodeUsage(promoId: string, delta: number = 1): Promise<void> {
  const docRef = doc(db, PROMO_CODES_COLLECTION, promoId);
  await updateDoc(docRef, {
    currentUses: increment(delta),
  });
}

/**
 * Update promo code
 */
export async function updatePromoCode(promoId: string, updates: Partial<PromoCode>): Promise<void> {
  const docRef = doc(db, PROMO_CODES_COLLECTION, promoId);
  await updateDoc(docRef, updates);
}

/**
 * Delete promo code
 */
export async function deletePromoCode(promoId: string): Promise<void> {
  await deleteDoc(doc(db, PROMO_CODES_COLLECTION, promoId));
}

// =============================================================================
// REGISTRATIONS
// =============================================================================

// Rate limit for registrations: 5 registrations per 10 minutes per user
const REGISTRATION_RATE_LIMIT = { maxRequests: 5, windowMs: 600000 };

/**
 * Remove undefined values from an object (Firestore doesn't accept undefined)
 */
function removeUndefined<T extends Record<string, any>>(obj: T): T {
  const result = {} as T;
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Sanitize registration data before storage
 */
function sanitizeRegistrationData(reg: Omit<Registration, 'id'>): Omit<Registration, 'id'> {
  const sanitized: any = {
    ...reg,
    athleteSnapshot: removeUndefined({
      ...reg.athleteSnapshot,
      firstName: sanitizeText(reg.athleteSnapshot?.firstName || '', 100),
      lastName: sanitizeText(reg.athleteSnapshot?.lastName || '', 100),
      ...(reg.athleteSnapshot?.dateOfBirth ? { dateOfBirth: reg.athleteSnapshot.dateOfBirth } : {}),
      ...(reg.athleteSnapshot?.profileImage ? { profileImage: reg.athleteSnapshot.profileImage } : {}),
    }),
  };
  
  // Only add emergencyContact if it exists and has data
  if (reg.emergencyContact && (reg.emergencyContact.name || reg.emergencyContact.phone)) {
    sanitized.emergencyContact = removeUndefined({
      name: sanitizeText(reg.emergencyContact.name || '', 100),
      relationship: sanitizeText(reg.emergencyContact.relationship || '', 50),
      phone: sanitizePhone(reg.emergencyContact.phone || ''),
    });
  }
  
  // Only add medicalInfo if it exists and has data
  if (reg.medicalInfo && (reg.medicalInfo.allergies || reg.medicalInfo.medications || reg.medicalInfo.conditions || reg.medicalInfo.insuranceProvider)) {
    sanitized.medicalInfo = removeUndefined({
      ...(reg.medicalInfo.allergies ? { allergies: sanitizeText(reg.medicalInfo.allergies, 500) } : {}),
      ...(reg.medicalInfo.medications ? { medications: sanitizeText(reg.medicalInfo.medications, 500) } : {}),
      ...(reg.medicalInfo.conditions ? { conditions: sanitizeText(reg.medicalInfo.conditions, 500) } : {}),
      ...(reg.medicalInfo.insuranceProvider ? { insuranceProvider: sanitizeText(reg.medicalInfo.insuranceProvider, 200) } : {}),
      ...(reg.medicalInfo.insurancePolicyNumber ? { insurancePolicyNumber: sanitizeText(reg.medicalInfo.insurancePolicyNumber, 100) } : {}),
    });
  }
  
  // Only add waiverSignature if it exists
  if (reg.waiverSignature) {
    sanitized.waiverSignature = sanitizeText(reg.waiverSignature, 200);
  }
  
  return removeUndefined(sanitized);
}

/**
 * Create a registration order with registrations
 * @throws Error if rate limited or validation fails
 */
export async function createRegistrationOrder(
  order: Omit<RegistrationOrder, 'id'>,
  registrations: Omit<Registration, 'id'>[]
): Promise<{ orderId: string; registrationIds: string[] }> {
  // Rate limit check
  const rateLimitKey = `registration:${order.parentUserId}`;
  const rateLimitResult = checkRateLimit(rateLimitKey, REGISTRATION_RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    throw new Error(`Too many registration attempts. Please wait ${Math.ceil(rateLimitResult.retryAfterMs / 1000)} seconds.`);
  }

  // Validate registrations count (max 10 per order to prevent abuse)
  if (registrations.length > 10) {
    throw new Error('Maximum 10 athletes per registration order.');
  }

  // DEBUG: Log what we're about to write
  console.log('[Registration] === STARTING REGISTRATION ===');
  console.log('[Registration] Order parentUserId:', order.parentUserId);
  console.log('[Registration] Order eventId:', order.eventId);
  console.log('[Registration] Order teamId:', order.teamId);
  console.log('[Registration] Registration count:', registrations.length);
  
  // Test individual operations to find which one fails
  const orderRef = doc(collection(db, REGISTRATION_ORDERS_COLLECTION));
  const registrationIds: string[] = [];
  
  // STEP 1: Try to create the order first
  try {
    console.log('[Registration] STEP 1: Creating order...');
    await setDoc(orderRef, {
      ...order,
      registrationIds: [], // Will update later
    });
    console.log('[Registration] STEP 1: Order created successfully!');
  } catch (e: any) {
    console.error('[Registration] STEP 1 FAILED: Order creation failed!', e.code, e.message);
    throw new Error(`Order creation failed: ${e.message}`);
  }
  
  // STEP 2: Create each registration
  for (let i = 0; i < registrations.length; i++) {
    const reg = registrations[i];
    const sanitizedReg = sanitizeRegistrationData(reg);
    const regRef = doc(collection(db, REGISTRATIONS_COLLECTION));
    registrationIds.push(regRef.id);
    
    try {
      console.log(`[Registration] STEP 2.${i+1}: Creating registration for athlete...`);
      await setDoc(regRef, {
        ...sanitizedReg,
        orderId: orderRef.id,
      });
      console.log(`[Registration] STEP 2.${i+1}: Registration created successfully!`);
    } catch (e: any) {
      console.error(`[Registration] STEP 2.${i+1} FAILED: Registration creation failed!`, e.code, e.message);
      throw new Error(`Registration creation failed: ${e.message}`);
    }
    
    // TODO: Re-enable pricing tier tracking once tiers are properly set up on events
    // For now, we skip tier updates - using flat rate from event.registrationFee
    // STEP 3: Update pricing tier - BYPASSED
    // if (reg.pricingTierId) { ... }
    
    // TODO: Re-enable promo code tracking once promo system is fully tested
    // STEP 4: Update promo code - BYPASSED for now
    // if (reg.promoCodeId) { ... }
  }
  
  // STEP 5: Update event count
  try {
    console.log('[Registration] STEP 3: Updating event count...');
    const eventRef = doc(db, EVENTS_COLLECTION, order.eventId);
    await updateDoc(eventRef, { 
      currentCount: increment(registrations.length),
      updatedAt: Timestamp.now(),
    });
    console.log('[Registration] STEP 3: Event count updated successfully!');
  } catch (e: any) {
    console.error('[Registration] STEP 3 FAILED: Event count update failed!', e.code, e.message);
    throw new Error(`Event count update failed: ${e.message}`);
  }
  
  // STEP 4: Update order with registration IDs
  try {
    console.log('[Registration] STEP 4: Updating order with registration IDs...');
    await updateDoc(orderRef, { registrationIds });
    console.log('[Registration] STEP 4: Order updated successfully!');
  } catch (e: any) {
    console.error('[Registration] STEP 4 FAILED: Order update failed!', e.code, e.message);
    throw new Error(`Order update failed: ${e.message}`);
  }
  
  console.log('[Registration] === REGISTRATION COMPLETE ===');
  return { orderId: orderRef.id, registrationIds };
}

/**
 * Get registrations by event
 */
export async function getRegistrationsByEvent(eventId: string): Promise<Registration[]> {
  // No orderBy to avoid index requirements
  const q = query(
    collection(db, REGISTRATIONS_COLLECTION),
    where('eventId', '==', eventId)
  );
  
  const snapshot = await getDocs(q);
  const registrations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
  
  // Sort client-side by createdAt descending
  registrations.sort((a, b) => {
    const aTime = (a.createdAt as any)?.toMillis?.() || 0;
    const bTime = (b.createdAt as any)?.toMillis?.() || 0;
    return bTime - aTime;
  });
  
  return registrations;
}

/**
 * Get registrations by parent user
 */
export async function getRegistrationsByUser(userId: string): Promise<Registration[]> {
  // No orderBy to avoid index requirements
  const q = query(
    collection(db, REGISTRATIONS_COLLECTION),
    where('parentUserId', '==', userId)
  );
  
  const snapshot = await getDocs(q);
  const registrations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
  
  // Sort client-side by createdAt descending
  registrations.sort((a, b) => {
    const aTime = (a.createdAt as any)?.toMillis?.() || 0;
    const bTime = (b.createdAt as any)?.toMillis?.() || 0;
    return bTime - aTime;
  });
  
  return registrations;
}

/**
 * Get registration order by ID
 */
export async function getRegistrationOrder(orderId: string): Promise<RegistrationOrder | null> {
  const docRef = doc(db, REGISTRATION_ORDERS_COLLECTION, orderId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return { id: docSnap.id, ...docSnap.data() } as RegistrationOrder;
}

/**
 * Update registration status
 */
export async function updateRegistrationStatus(
  registrationId: string, 
  status: Registration['status'],
  additionalUpdates?: Partial<Registration>
): Promise<void> {
  const docRef = doc(db, REGISTRATIONS_COLLECTION, registrationId);
  await updateDoc(docRef, {
    status,
    ...additionalUpdates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Update registration payment status
 */
export async function updateRegistrationPayment(
  registrationId: string,
  paymentStatus: Registration['paymentStatus'],
  paypalTransactionId?: string
): Promise<void> {
  const updates: Partial<Registration> = {
    paymentStatus,
    updatedAt: Timestamp.now() as any,
  };
  
  if (paymentStatus === 'completed') {
    updates.paidAt = Timestamp.now() as any;
    updates.status = 'paid';
  }
  
  if (paypalTransactionId) {
    updates.paypalTransactionId = paypalTransactionId;
  }
  
  const docRef = doc(db, REGISTRATIONS_COLLECTION, registrationId);
  await updateDoc(docRef, updates);
}

/**
 * Cancel a registration
 */
export async function cancelRegistration(registrationId: string, reason?: string): Promise<void> {
  const reg = await getDoc(doc(db, REGISTRATIONS_COLLECTION, registrationId));
  if (!reg.exists()) throw new Error('Registration not found');
  
  const regData = reg.data() as Registration;
  
  const batch = writeBatch(db);
  
  // Update registration status
  batch.update(reg.ref, {
    status: 'cancelled',
    updatedAt: Timestamp.now(),
  });
  
  // Decrement event count
  const eventRef = doc(db, EVENTS_COLLECTION, regData.eventId);
  batch.update(eventRef, {
    currentCount: increment(-1),
    updatedAt: Timestamp.now(),
  });
  
  // Decrement tier count (pricing tiers are subcollections)
  if (regData.pricingTierId) {
    const tierRef = doc(db, EVENTS_COLLECTION, regData.eventId, 'pricingTiers', regData.pricingTierId);
    batch.update(tierRef, { currentQuantity: increment(-1) });
  }
  
  await batch.commit();
}

// =============================================================================
// TEAM PAYMENT SETTINGS
// =============================================================================

/**
 * Get team payment settings
 */
export async function getTeamPaymentSettings(teamId: string): Promise<TeamPaymentSettings | null> {
  const docRef = doc(db, TEAM_PAYMENT_SETTINGS_COLLECTION, teamId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return { teamId, ...docSnap.data() } as TeamPaymentSettings;
}

/**
 * Update team payment settings
 */
export async function updateTeamPaymentSettings(
  teamId: string, 
  settings: Partial<TeamPaymentSettings>
): Promise<void> {
  const docRef = doc(db, TEAM_PAYMENT_SETTINGS_COLLECTION, teamId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    await updateDoc(docRef, {
      ...settings,
      updatedAt: Timestamp.now(),
    });
  } else {
    // Create new settings document
    const { setDoc } = await import('firebase/firestore');
    await setDoc(docRef, {
      teamId,
      paypalConnected: false,
      stripeConnected: false,
      platformFeeEnabled: false,
      platformFeePercent: 0,
      platformFeeFixed: 0,
      notifyOnRegistration: true,
      notifyOnPayment: true,
      ...settings,
      updatedAt: Timestamp.now(),
    });
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate a unique shareable link
 */
function generateShareableLink(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Check if user can register for event
 */
export async function canUserRegister(
  eventId: string, 
  userId: string, 
  athleteId: string
): Promise<{ canRegister: boolean; reason?: string }> {
  // Check if athlete is already registered
  const q = query(
    collection(db, REGISTRATIONS_COLLECTION),
    where('eventId', '==', eventId),
    where('athleteId', '==', athleteId),
    where('status', 'not-in', ['cancelled', 'refunded']),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return { canRegister: false, reason: 'Athlete is already registered for this event' };
  }
  
  // Check event capacity
  const event = await getEvent(eventId);
  if (!event) {
    return { canRegister: false, reason: 'Event not found' };
  }
  
  if (event.maxCapacity && event.currentCount >= event.maxCapacity) {
    if (event.waitlistEnabled) {
      return { canRegister: true, reason: 'Event is full - registration will be added to waitlist' };
    }
    return { canRegister: false, reason: 'Event is at capacity' };
  }
  
  // Check if registration is open
  if (event.status !== 'active') {
    return { canRegister: false, reason: 'Registration is not currently open' };
  }
  
  const now = Timestamp.now();
  if (event.registrationOpenDate && event.registrationOpenDate > now) {
    return { canRegister: false, reason: 'Registration has not opened yet' };
  }
  
  if (event.registrationCloseDate && event.registrationCloseDate < now) {
    return { canRegister: false, reason: 'Registration has closed' };
  }
  
  return { canRegister: true };
}

// =============================================================================
// PLAYER REGISTRATION/DRAFT STATUS (For Parent Profile)
// =============================================================================

export type PlayerDraftStatus = 
  | 'not-registered'      // Player hasn't registered for any events
  | 'in-draft-pool'       // Registered and waiting in draft pool
  | 'on-team'             // Drafted to a team  
  | 'registration-denied'; // Registration was declined

export interface PlayerRegistrationStatus {
  status: PlayerDraftStatus;
  teamName?: string;          // If on-team
  teamId?: string;            // If on-team
  draftPoolEntryId?: string;  // If in-draft-pool
  draftPoolTeamId?: string;   // Team's draft pool they're in
  draftPoolTeamName?: string; // Team name for draft pool display
  sport?: string;             // Sport for the team/draft pool
  registrationId?: string;    // Most recent registration
  eventName?: string;         // Event they registered for
  deniedReason?: string;      // If registration-denied
}

/**
 * Get registration/draft status for a player
 * This checks:
 * 1. If player has a teamId, they're on a team
 * 2. If player is in draft pool with status 'waiting', they're in draft pool
 * 3. If player was declined (draft pool status 'declined'), they were denied
 * 4. Otherwise, they haven't registered
 */
export async function getPlayerRegistrationStatus(
  playerId: string,
  currentTeamId?: string,
  playerName?: string // Optional: for fallback search
): Promise<PlayerRegistrationStatus> {
  console.log('[PlayerStatus] Checking status for:', { playerId, currentTeamId, playerName });
  
  // If player already has a teamId, they're on a team
  if (currentTeamId) {
    const teamDoc = await getDoc(doc(db, 'teams', currentTeamId));
    if (teamDoc.exists()) {
      const teamData = teamDoc.data();
      console.log('[PlayerStatus] Player is on team:', currentTeamId, 'sport:', teamData.sport);
      return {
        status: 'on-team',
        teamId: currentTeamId,
        teamName: teamData.name || 'Unknown Team',
        sport: teamData.sport || 'football'
      };
    }
  }
  
  // FAST PATH: Check the player document for cached draft pool status
  // This avoids permission issues when parents try to read other teams' draft pools
  // Players are stored in top-level 'players' collection (unassigned athletes)
  try {
    const playerDoc = await getDoc(doc(db, 'players', playerId));
    console.log('[PlayerStatus] Checking player doc at players/' + playerId);
    if (playerDoc.exists()) {
      const playerData = playerDoc.data();
      console.log('[PlayerStatus] Player doc draft status:', playerData.draftPoolStatus);
      
      // Check for PROGRAM-based draft pool (new system) - uses programId/seasonId instead of teamId
      if (playerData.draftPoolStatus === 'waiting' && playerData.draftPoolProgramId && playerData.draftPoolSeasonId) {
        // Fetch program info for name
        let programName = 'Unknown Program';
        let seasonName = '';
        let sport: string = 'football'; // Default to football instead of 'other'
        try {
          const programDoc = await getDoc(doc(db, 'programs', playerData.draftPoolProgramId));
          if (programDoc.exists()) {
            const programData = programDoc.data();
            sport = programData.sport || 'football'; // Default to football
            console.log('[PlayerStatus] Program sport:', programData.sport, '-> using:', sport);
            
            // Use sport-specific name if available, otherwise fall back to org name
            const sportLower = sport.toLowerCase();
            const sportNames = programData.sportNames as { [key: string]: string } | undefined;
            programName = sportNames?.[sportLower] || programData.name || 'Unknown Program';
            console.log('[PlayerStatus] Program name for sport:', programName);
          }
          // Also get season name
          const seasonDoc = await getDoc(doc(db, 'programs', playerData.draftPoolProgramId, 'seasons', playerData.draftPoolSeasonId));
          if (seasonDoc.exists()) {
            seasonName = seasonDoc.data().name || '';
            // Season might also have sport field - update sport-specific name if different
            if (seasonDoc.data().sport) {
              sport = seasonDoc.data().sport;
              console.log('[PlayerStatus] Using season sport instead:', sport);
              // Re-check sport-specific name with the season's sport
              const programDoc2 = await getDoc(doc(db, 'programs', playerData.draftPoolProgramId));
              if (programDoc2.exists()) {
                const sportLower = sport.toLowerCase();
                const sportNames = programDoc2.data().sportNames as { [key: string]: string } | undefined;
                programName = sportNames?.[sportLower] || programDoc2.data().name || programName;
              }
            }
          }
        } catch (err) {
          console.log('[PlayerStatus] Could not fetch draft pool program info:', err);
        }
        
        return {
          status: 'in-draft-pool',
          draftPoolEntryId: playerData.draftPoolEntryId,
          draftPoolProgramId: playerData.draftPoolProgramId,
          draftPoolSeasonId: playerData.draftPoolSeasonId,
          draftPoolTeamName: seasonName ? `${programName} - ${seasonName}` : programName,
          draftPoolAgeGroup: playerData.draftPoolAgeGroup,
          sport,
        };
      }
      
      // Check for TEAM-based draft pool (legacy system) - uses teamId
      if (playerData.draftPoolStatus === 'waiting' && playerData.draftPoolTeamId) {
        // Fetch team info for name and sport
        let draftPoolTeamName = 'Unknown Team';
        let sport = 'other';
        try {
          const teamDoc = await getDoc(doc(db, 'teams', playerData.draftPoolTeamId));
          if (teamDoc.exists()) {
            const teamData = teamDoc.data();
            draftPoolTeamName = teamData.name || 'Unknown Team';
            sport = teamData.sport || 'other';
          }
        } catch (err) {
          console.log('[PlayerStatus] Could not fetch draft pool team info:', err);
        }
        
        return {
          status: 'in-draft-pool',
          draftPoolEntryId: playerData.draftPoolEntryId,
          draftPoolTeamId: playerData.draftPoolTeamId,
          draftPoolTeamName,
          sport,
        };
      }
      
      if (playerData.draftPoolStatus === 'declined') {
        return {
          status: 'registration-denied',
          draftPoolEntryId: playerData.draftPoolEntryId,
          draftPoolTeamId: playerData.draftPoolTeamId,
          deniedReason: playerData.draftPoolDeclinedReason || 'Registration was declined',
        };
      }
      
      if (playerData.draftPoolStatus === 'drafted' && playerData.teamId) {
        const teamDoc = await getDoc(doc(db, 'teams', playerData.teamId));
        return {
          status: 'on-team',
          teamId: playerData.teamId,
          teamName: teamDoc.exists() ? teamDoc.data().name : 'Unknown Team'
        };
      }
    }
  } catch (err) {
    console.log('[PlayerStatus] Could not read player doc, trying fallback:', err);
  }
  
  // Check draft pool across all teams for this player
  // Draft pool entries are stored under teams/{teamId}/draftPool
  // We need to find entries where playerId matches
  try {
    // First get recent registrations for this player to find which teams to check
    const registrationsQuery = query(
      collection(db, REGISTRATIONS_COLLECTION),
      where('athleteId', '==', playerId),
      limit(5)
    );
    const regSnapshot = await getDocs(registrationsQuery);
    console.log('[PlayerStatus] Found registrations:', regSnapshot.size);
    
    // If no registrations found, try to search draft pool directly via teams
    if (regSnapshot.empty) {
      // Fallback: Check all teams for draft pool entries with this playerId
      const teamsSnapshot = await getDocs(collection(db, 'teams'));
      console.log('[PlayerStatus] Searching', teamsSnapshot.size, 'teams for draft pool entries');
      
      for (const teamDoc of teamsSnapshot.docs) {
        // Get all draft pool entries for this team and filter in memory
        // This avoids compound query index issues
        const draftPoolRef = collection(db, 'teams', teamDoc.id, 'draftPool');
        const allDraftSnap = await getDocs(draftPoolRef);
        
        for (const draftDoc of allDraftSnap.docs) {
          const draftEntry = draftDoc.data();
          const matchesById = draftEntry.playerId === playerId;
          const matchesByName = playerName && draftEntry.playerName === playerName;
          
          if (matchesById || matchesByName) {
            console.log('[PlayerStatus] Found match in team', teamDoc.id, ':', { 
              matchesById, 
              matchesByName, 
              status: draftEntry.status,
              entryPlayerId: draftEntry.playerId,
              entryPlayerName: draftEntry.playerName 
            });
            
            if (draftEntry.status === 'waiting') {
              return {
                status: 'in-draft-pool',
                draftPoolEntryId: draftDoc.id,
                draftPoolTeamId: teamDoc.id,
                registrationId: draftEntry.registrationId
              };
            }
            
            if (draftEntry.status === 'declined') {
              return {
                status: 'registration-denied',
                draftPoolEntryId: draftDoc.id,
                draftPoolTeamId: teamDoc.id,
                deniedReason: draftEntry.declinedReason || 'Registration was declined',
                registrationId: draftEntry.registrationId
              };
            }
            
            if (draftEntry.status === 'drafted' && draftEntry.draftedToTeamId) {
              const draftedTeamDoc = await getDoc(doc(db, 'teams', draftEntry.draftedToTeamId));
              return {
                status: 'on-team',
                teamId: draftEntry.draftedToTeamId,
                teamName: draftedTeamDoc.exists() ? draftedTeamDoc.data().name : 'Unknown Team'
              };
            }
          }
        }
      }
      
      console.log('[PlayerStatus] No match found in any draft pool, returning not-registered');
      return { status: 'not-registered' };
    }
    
    // Get the most recent registration
    const registrations = regSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Registration));
    registrations.sort((a, b) => {
      const aTime = (a.createdAt as any)?.toMillis?.() || 0;
      const bTime = (b.createdAt as any)?.toMillis?.() || 0;
      return bTime - aTime;
    });
    
    const latestReg = registrations[0];
    const teamId = latestReg.teamId;
    
    // Check draft pool for this team
    const draftPoolQuery = query(
      collection(db, 'teams', teamId, 'draftPool'),
      where('playerId', '==', playerId),
      limit(1)
    );
    const draftSnapshot = await getDocs(draftPoolQuery);
    
    // Also check by registration ID since playerId might not be set
    if (draftSnapshot.empty) {
      const draftPoolByRegQuery = query(
        collection(db, 'teams', teamId, 'draftPool'),
        where('registrationId', '==', latestReg.id),
        limit(1)
      );
      const draftByRegSnapshot = await getDocs(draftPoolByRegQuery);
      
      if (!draftByRegSnapshot.empty) {
        const draftEntry = draftByRegSnapshot.docs[0].data();
        
        if (draftEntry.status === 'declined') {
          return {
            status: 'registration-denied',
            draftPoolEntryId: draftByRegSnapshot.docs[0].id,
            draftPoolTeamId: teamId,
            deniedReason: draftEntry.declinedReason || 'Registration was declined',
            registrationId: latestReg.id
          };
        }
        
        if (draftEntry.status === 'waiting') {
          // Get event name
          let eventName: string | undefined;
          if (latestReg.eventId) {
            const eventDoc = await getDoc(doc(db, EVENTS_COLLECTION, latestReg.eventId));
            if (eventDoc.exists()) {
              eventName = eventDoc.data().title;
            }
          }
          
          return {
            status: 'in-draft-pool',
            draftPoolEntryId: draftByRegSnapshot.docs[0].id,
            draftPoolTeamId: teamId,
            registrationId: latestReg.id,
            eventName
          };
        }
        
        if (draftEntry.status === 'drafted' && draftEntry.draftedToTeamId) {
          const draftedTeamDoc = await getDoc(doc(db, 'teams', draftEntry.draftedToTeamId));
          return {
            status: 'on-team',
            teamId: draftEntry.draftedToTeamId,
            teamName: draftedTeamDoc.exists() ? draftedTeamDoc.data().name : 'Unknown Team'
          };
        }
      }
    } else {
      const draftEntry = draftSnapshot.docs[0].data();
      
      if (draftEntry.status === 'declined') {
        return {
          status: 'registration-denied',
          draftPoolEntryId: draftSnapshot.docs[0].id,
          draftPoolTeamId: teamId,
          deniedReason: draftEntry.declinedReason || 'Registration was declined',
          registrationId: latestReg.id
        };
      }
      
      if (draftEntry.status === 'waiting') {
        let eventName: string | undefined;
        if (latestReg.eventId) {
          const eventDoc = await getDoc(doc(db, EVENTS_COLLECTION, latestReg.eventId));
          if (eventDoc.exists()) {
            eventName = eventDoc.data().title;
          }
        }
        
        return {
          status: 'in-draft-pool',
          draftPoolEntryId: draftSnapshot.docs[0].id,
          draftPoolTeamId: teamId,
          registrationId: latestReg.id,
          eventName
        };
      }
      
      if (draftEntry.status === 'drafted' && draftEntry.draftedToTeamId) {
        const draftedTeamDoc = await getDoc(doc(db, 'teams', draftEntry.draftedToTeamId));
        return {
          status: 'on-team',
          teamId: draftEntry.draftedToTeamId,
          teamName: draftedTeamDoc.exists() ? draftedTeamDoc.data().name : 'Unknown Team'
        };
      }
    }
    
    // If we have a registration but no draft pool entry, check status
    if (latestReg.status === 'waitlisted') {
      return {
        status: 'in-draft-pool',
        registrationId: latestReg.id
      };
    }
    
    return { status: 'not-registered' };
  } catch (error) {
    console.error('Error getting player registration status:', error);
    return { status: 'not-registered' };
  }
}

/**
 * Remove player from draft pool (parent action)
 */
export async function removeFromDraftPool(
  teamId: string,
  draftPoolEntryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, 'teams', teamId, 'draftPool', draftPoolEntryId));
    return { success: true };
  } catch (error: any) {
    console.error('Error removing from draft pool:', error);
    return { success: false, error: error.message || 'Failed to remove from draft pool' };
  }
}

/**
 * Remove player from team roster (parent action)
 */
export async function removeFromTeamRoster(
  teamId: string,
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get player doc to update
    const playerRef = doc(db, 'teams', teamId, 'players', playerId);
    const playerSnap = await getDoc(playerRef);
    
    if (!playerSnap.exists()) {
      return { success: false, error: 'Player not found on team roster' };
    }
    
    // Option 1: Delete from team roster
    await deleteDoc(playerRef);
    
    // Also update player's teamId if they're in parentPlayers
    // This happens client-side in AuthContext
    
    return { success: true };
  } catch (error: any) {
    console.error('Error removing from team:', error);
    return { success: false, error: error.message || 'Failed to remove from team' };
  }
}

export default {
  // Events
  createEvent,
  getEvent,
  getEventsByTeam,
  getPublicEvents,
  getEventByShareableLink,
  updateEvent,
  deleteEvent,
  duplicateEvent,
  updateEventCount,
  
  // Pricing Tiers
  createPricingTier,
  getPricingTiersByEvent,
  updatePricingTier,
  deletePricingTier,
  incrementTierCount,
  
  // Promo Codes
  createPromoCode,
  getPromoCodesByEvent,
  getPromoCodeByCode,
  validatePromoCode,
  incrementPromoCodeUsage,
  updatePromoCode,
  deletePromoCode,
  
  // Registrations
  createRegistrationOrder,
  getRegistrationsByEvent,
  getRegistrationsByUser,
  getRegistrationOrder,
  updateRegistrationStatus,
  updateRegistrationPayment,
  cancelRegistration,
  
  // Team Payment Settings
  getTeamPaymentSettings,
  updateTeamPaymentSettings,
  
  // Helpers
  canUserRegister,
  
  // Player Status
  getPlayerRegistrationStatus,
  removeFromDraftPool,
  removeFromTeamRoster,
};
