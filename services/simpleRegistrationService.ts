/**
 * Simple Registration Service
 * Clean registration flow with pilot features:
 * - Jersey number selection with sport-specific validation
 * - Position preferences
 * - Medical info
 * - Waiver acknowledgment
 * - Draft pool integration
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  updateDoc,
  increment,
  addDoc
} from 'firebase/firestore';
import { db } from './firebase';

// =============================================================================
// JERSEY NUMBER RULES BY SPORT
// =============================================================================

export const JERSEY_NUMBER_RULES: Record<string, { min: number; max: number; description: string }> = {
  football: { min: 1, max: 99, description: 'Football: 1-99' },
  basketball: { min: 0, max: 99, description: 'Basketball: 0-99' },
  cheer: { min: 1, max: 99, description: 'Cheer: 1-99' },
  soccer: { min: 1, max: 99, description: 'Soccer: 1-99' },
  baseball: { min: 0, max: 99, description: 'Baseball: 0-99' },
  volleyball: { min: 1, max: 99, description: 'Volleyball: 1-99' },
  hockey: { min: 1, max: 99, description: 'Hockey: 1-99' },
  lacrosse: { min: 1, max: 99, description: 'Lacrosse: 1-99' },
  softball: { min: 0, max: 99, description: 'Softball: 0-99' },
  wrestling: { min: 1, max: 99, description: 'Wrestling: 1-99' },
  track: { min: 1, max: 9999, description: 'Track: 1-9999' },
  swimming: { min: 1, max: 999, description: 'Swimming: 1-999' },
  tennis: { min: 1, max: 99, description: 'Tennis: 1-99' },
  golf: { min: 1, max: 99, description: 'Golf: 1-99' },
  other: { min: 1, max: 99, description: 'Other: 1-99' },
};

export function validateJerseyNumber(number: number, sport: string): { valid: boolean; error?: string } {
  const rules = JERSEY_NUMBER_RULES[sport] || JERSEY_NUMBER_RULES.other;
  
  if (isNaN(number) || !Number.isInteger(number)) {
    return { valid: false, error: 'Jersey number must be a whole number' };
  }
  
  if (number < rules.min || number > rules.max) {
    return { valid: false, error: `Jersey number must be between ${rules.min} and ${rules.max} for ${sport}` };
  }
  
  return { valid: true };
}

// =============================================================================
// TYPES
// =============================================================================

export interface SimpleRegistration {
  id: string;
  
  // Event Info
  eventId: string;
  teamId: string;
  eventName: string;
  sport: string;
  
  // Who registered
  parentUserId: string;
  
  // Athlete Info
  athleteFirstName: string;
  athleteLastName: string;
  athleteDOB: Timestamp;
  athleteGender: 'male' | 'female' | 'other';
  
  // Jersey & Position (pilot features)
  preferredJerseyNumber?: number;
  alternateJerseyNumbers?: number[];
  preferredPosition?: string;
  
  // Parent/Guardian Info
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  
  // Emergency Contact
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyRelationship: string;
  
  // Medical Info (pilot features)
  medicalAllergies?: string;
  medicalConditions?: string;
  medicalMedications?: string;
  medicalNotes?: string;
  
  // Waiver (pilot feature)
  waiverAccepted: boolean;
  waiverAcceptedAt?: Timestamp;
  waiverAcceptedBy: string;
  
  // Payment
  amountDue: number;
  amountPaid: number;
  paymentMethod: 'online' | 'cash' | 'check' | 'free';
  
  // Status
  status: 'registered' | 'cancelled' | 'waitlisted';
  
  // Draft Pool tracking (pilot feature)
  addedToDraftPool: boolean;
  draftPoolId?: string;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SimpleRegistrationInput {
  eventId: string;
  teamId: string;
  eventName: string;
  sport: string;
  parentUserId: string;
  
  athleteFirstName: string;
  athleteLastName: string;
  athleteDOB: Date;
  athleteGender: 'male' | 'female' | 'other';
  
  // Jersey & Position
  preferredJerseyNumber?: number;
  alternateJerseyNumbers?: number[];
  preferredPosition?: string;
  
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyRelationship: string;
  
  // Medical Info
  medicalAllergies?: string;
  medicalConditions?: string;
  medicalMedications?: string;
  medicalNotes?: string;
  
  // Waiver
  waiverAccepted: boolean;
  
  amountDue: number;
  amountPaid: number;
  paymentMethod: 'online' | 'cash' | 'check' | 'free';
}

// =============================================================================
// COLLECTION NAME
// =============================================================================

const SIMPLE_REGISTRATIONS = 'simpleRegistrations';

// =============================================================================
// CHECK JERSEY AVAILABILITY
// =============================================================================

export async function checkJerseyAvailability(
  teamId: string,
  jerseyNumber: number
): Promise<{ available: boolean; takenBy?: string }> {
  try {
    // Check existing roster
    const playersRef = collection(db, 'teams', teamId, 'players');
    const playersSnap = await getDocs(playersRef);
    
    for (const playerDoc of playersSnap.docs) {
      const player = playerDoc.data();
      if (player.number === jerseyNumber || player.jerseyNumber === jerseyNumber) {
        return { available: false, takenBy: `${player.firstName} ${player.lastName}` };
      }
    }
    
    // Check pending registrations for this team
    const regsQuery = query(
      collection(db, SIMPLE_REGISTRATIONS),
      where('teamId', '==', teamId),
      where('status', '==', 'registered'),
      where('preferredJerseyNumber', '==', jerseyNumber)
    );
    const regsSnap = await getDocs(regsQuery);
    
    if (!regsSnap.empty) {
      const existingReg = regsSnap.docs[0].data();
      return { 
        available: false, 
        takenBy: `${existingReg.athleteFirstName} ${existingReg.athleteLastName} (pending)` 
      };
    }
    
    return { available: true };
  } catch (error) {
    console.error('[SimpleReg] Error checking jersey:', error);
    // Default to available if we can't check (don't block registration)
    return { available: true };
  }
}

// =============================================================================
// CREATE REGISTRATION
// =============================================================================

export async function createSimpleRegistration(
  input: SimpleRegistrationInput
): Promise<{ success: boolean; registrationId?: string; draftPoolId?: string; error?: string }> {
  try {
    console.log('[SimpleReg] Creating registration for:', input.athleteFirstName, input.athleteLastName);
    
    // Validate jersey number if provided
    if (input.preferredJerseyNumber !== undefined) {
      const validation = validateJerseyNumber(input.preferredJerseyNumber, input.sport);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
    }
    
    // Generate ID
    const regRef = doc(collection(db, SIMPLE_REGISTRATIONS));
    
    // Build the registration document
    const registration: SimpleRegistration = {
      id: regRef.id,
      eventId: input.eventId,
      teamId: input.teamId,
      eventName: input.eventName,
      sport: input.sport || 'other',
      parentUserId: input.parentUserId,
      athleteFirstName: input.athleteFirstName.trim(),
      athleteLastName: input.athleteLastName.trim(),
      athleteDOB: Timestamp.fromDate(input.athleteDOB),
      athleteGender: input.athleteGender,
      parentName: input.parentName.trim(),
      parentEmail: input.parentEmail.trim().toLowerCase(),
      parentPhone: input.parentPhone.trim(),
      emergencyContactName: input.emergencyContactName.trim(),
      emergencyContactPhone: input.emergencyContactPhone.trim(),
      emergencyRelationship: input.emergencyRelationship.trim() || 'Not specified',
      amountDue: input.amountDue,
      amountPaid: input.amountPaid,
      paymentMethod: input.paymentMethod,
      status: 'registered',
      waiverAccepted: input.waiverAccepted,
      waiverAcceptedBy: input.parentUserId,
      addedToDraftPool: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    // Add optional fields only if they have values
    if (input.preferredJerseyNumber !== undefined) {
      registration.preferredJerseyNumber = input.preferredJerseyNumber;
    }
    if (input.alternateJerseyNumbers?.length) {
      registration.alternateJerseyNumbers = input.alternateJerseyNumbers;
    }
    if (input.preferredPosition) {
      registration.preferredPosition = input.preferredPosition;
    }
    if (input.medicalAllergies?.trim()) {
      registration.medicalAllergies = input.medicalAllergies.trim();
    }
    if (input.medicalConditions?.trim()) {
      registration.medicalConditions = input.medicalConditions.trim();
    }
    if (input.medicalMedications?.trim()) {
      registration.medicalMedications = input.medicalMedications.trim();
    }
    if (input.medicalNotes?.trim()) {
      registration.medicalNotes = input.medicalNotes.trim();
    }
    if (input.waiverAccepted) {
      registration.waiverAcceptedAt = Timestamp.now();
    }
    
    // Write registration
    await setDoc(regRef, registration);
    console.log('[SimpleReg] ✅ Registration created:', regRef.id);
    
    // Update event count (non-critical)
    try {
      const eventRef = doc(db, 'events', input.eventId);
      await updateDoc(eventRef, { 
        currentCount: increment(1),
        updatedAt: Timestamp.now()
      });
      console.log('[SimpleReg] ✅ Event count updated');
    } catch (e) {
      console.warn('[SimpleReg] ⚠️ Could not update event count:', e);
    }
    
    // Add to draft pool (non-critical)
    let draftPoolId: string | undefined;
    try {
      draftPoolId = await addToDraftPool(registration);
      if (draftPoolId) {
        await updateDoc(regRef, { 
          addedToDraftPool: true, 
          draftPoolId 
        });
        console.log('[SimpleReg] ✅ Added to draft pool:', draftPoolId);
      }
    } catch (e) {
      console.warn('[SimpleReg] ⚠️ Could not add to draft pool:', e);
    }
    
    return { success: true, registrationId: regRef.id, draftPoolId };
    
  } catch (error: any) {
    console.error('[SimpleReg] ❌ Registration failed:', error);
    return { success: false, error: error.message || 'Registration failed' };
  }
}

// =============================================================================
// ADD TO DRAFT POOL
// =============================================================================

async function addToDraftPool(reg: SimpleRegistration): Promise<string | undefined> {
  try {
    // Calculate age from DOB
    const dob = reg.athleteDOB.toDate();
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    // Determine age group (common youth sports groupings)
    let ageGroup = 'Unknown';
    if (age <= 6) ageGroup = '6U';
    else if (age <= 8) ageGroup = '8U';
    else if (age <= 10) ageGroup = '10U';
    else if (age <= 12) ageGroup = '12U';
    else if (age <= 14) ageGroup = '14U';
    else if (age <= 16) ageGroup = '16U';
    else if (age <= 18) ageGroup = '18U';
    else ageGroup = 'Adult';
    
    // Build draft pool entry matching DraftPoolEntry type
    const draftPoolEntry = {
      // Link to registration
      registrationId: reg.id,
      
      // Player info - using correct field names from DraftPoolEntry type
      playerName: `${reg.athleteFirstName} ${reg.athleteLastName}`,
      playerAge: age,
      playerDob: reg.athleteDOB.toDate().toISOString().split('T')[0],
      
      // Age group targeting
      ageGroup: ageGroup,
      sport: reg.sport || 'other',
      
      // Contact info (parent info)
      contactName: reg.parentName,
      contactEmail: reg.parentEmail,
      contactPhone: reg.parentPhone,
      
      // Registration source
      registeredByUserId: reg.parentUserId,
      registeredByName: reg.parentName,
      isIndependentAthlete: false,
      
      // Team targeting
      teamId: reg.teamId,
      ownerId: '', // Will be filled by team lookup if needed
      
      // Preferences
      preferredPositions: reg.preferredPosition ? [reg.preferredPosition] : [],
      
      // Emergency contact
      emergencyContact: {
        name: reg.emergencyContactName,
        phone: reg.emergencyContactPhone,
        relationship: reg.emergencyRelationship,
      },
      
      // Medical info
      medicalInfo: {
        allergies: reg.medicalAllergies || '',
        conditions: reg.medicalConditions || '',
        medications: reg.medicalMedications || '',
      },
      
      // Waiver
      waiverSigned: reg.waiverAccepted,
      waiverSignedAt: reg.waiverAcceptedAt || null,
      waiverSignedBy: reg.waiverAcceptedBy,
      
      // Payment status - map to DraftPoolPaymentStatus type
      paymentStatus: reg.amountPaid >= reg.amountDue ? 'paid_full' : 'pending',
      amountPaid: reg.amountPaid,
      totalAmount: reg.amountDue,
      remainingBalance: Math.max(0, reg.amountDue - reg.amountPaid),
      
      // Draft status - MUST be 'waiting' to show in draft pool UI
      status: 'waiting',
      
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    const draftRef = await addDoc(collection(db, 'teams', reg.teamId, 'draftPool'), draftPoolEntry);
    return draftRef.id;
    
  } catch (error) {
    console.error('[SimpleReg] Draft pool error:', error);
    return undefined;
  }
}

// =============================================================================
// READ REGISTRATIONS
// =============================================================================

export async function getRegistrationsByEvent(eventId: string): Promise<SimpleRegistration[]> {
  try {
    const q = query(
      collection(db, SIMPLE_REGISTRATIONS),
      where('eventId', '==', eventId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as SimpleRegistration);
  } catch (error) {
    console.error('[SimpleReg] Error fetching registrations:', error);
    return [];
  }
}

export async function getRegistrationsByUser(userId: string): Promise<SimpleRegistration[]> {
  try {
    const q = query(
      collection(db, SIMPLE_REGISTRATIONS),
      where('parentUserId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as SimpleRegistration);
  } catch (error) {
    console.error('[SimpleReg] Error fetching user registrations:', error);
    return [];
  }
}

export async function getRegistration(registrationId: string): Promise<SimpleRegistration | null> {
  try {
    const docRef = doc(db, SIMPLE_REGISTRATIONS, registrationId);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return snapshot.data() as SimpleRegistration;
    }
    return null;
  } catch (error) {
    console.error('[SimpleReg] Error fetching registration:', error);
    return null;
  }
}

// =============================================================================
// GET TAKEN JERSEY NUMBERS
// =============================================================================

export async function getTakenJerseyNumbers(teamId: string): Promise<number[]> {
  const taken: number[] = [];
  
  try {
    // Check roster
    const playersRef = collection(db, 'teams', teamId, 'players');
    const playersSnap = await getDocs(playersRef);
    playersSnap.docs.forEach(doc => {
      const player = doc.data();
      if (player.number) taken.push(player.number);
      if (player.jerseyNumber) taken.push(player.jerseyNumber);
    });
    
    // Check pending registrations
    const regsQuery = query(
      collection(db, SIMPLE_REGISTRATIONS),
      where('teamId', '==', teamId),
      where('status', '==', 'registered')
    );
    const regsSnap = await getDocs(regsQuery);
    regsSnap.docs.forEach(doc => {
      const reg = doc.data();
      if (reg.preferredJerseyNumber) taken.push(reg.preferredJerseyNumber);
    });
  } catch (error) {
    console.error('[SimpleReg] Error fetching taken numbers:', error);
  }
  
  return [...new Set(taken)]; // Remove duplicates
}

// =============================================================================
// CANCEL REGISTRATION
// =============================================================================

export async function cancelRegistration(
  registrationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const regRef = doc(db, SIMPLE_REGISTRATIONS, registrationId);
    const regSnap = await getDoc(regRef);
    
    if (!regSnap.exists()) {
      return { success: false, error: 'Registration not found' };
    }
    
    const reg = regSnap.data() as SimpleRegistration;
    
    await updateDoc(regRef, {
      status: 'cancelled',
      updatedAt: Timestamp.now()
    });
    
    // Decrement event count
    try {
      const eventRef = doc(db, 'events', reg.eventId);
      await updateDoc(eventRef, { 
        currentCount: increment(-1),
        updatedAt: Timestamp.now()
      });
    } catch (e) {
      console.warn('[SimpleReg] Could not decrement event count:', e);
    }
    
    // Update draft pool status if added
    if (reg.draftPoolId) {
      try {
        const draftRef = doc(db, 'teams', reg.teamId, 'draftPool', reg.draftPoolId);
        await updateDoc(draftRef, {
          status: 'cancelled',
          updatedAt: Timestamp.now()
        });
      } catch (e) {
        console.warn('[SimpleReg] Could not update draft pool:', e);
      }
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('[SimpleReg] Cancel failed:', error);
    return { success: false, error: error.message };
  }
}
