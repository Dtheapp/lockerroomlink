/**
 * OSYS Referee Service
 * Handles all referee-related operations
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  RefereeProfile,
  RefereeAssignment,
  RefereeNote,
  RefereeVerificationRequest,
  RefereeCertification,
  RefereeRating,
  RefereePayment,
  GameScoreSubmission,
  RefereeSearchFilters,
  RefereeStats
} from '../types/referee';
import type { SportType, UserProfile } from '../types';

// =============================================================================
// REFEREE PROFILE OPERATIONS
// =============================================================================

/**
 * Sign up as a referee - creates referee profile and updates user role
 */
export const signUpAsReferee = async (
  userId: string,
  profileData: Partial<RefereeProfile>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const batch = writeBatch(db);
    
    // Create referee profile
    const refereeRef = doc(db, 'refereeProfiles', userId);
    const defaultProfile: Omit<RefereeProfile, 'createdAt' | 'updatedAt'> = {
      certifications: profileData.certifications || [],
      yearsExperience: profileData.yearsExperience || 0,
      sports: profileData.sports || [],
      availability: profileData.availability || {
        weekdays: true,
        weekends: true,
        evenings: true
      },
      travelRadius: profileData.travelRadius || 25,
      homeLocation: profileData.homeLocation,
      bio: profileData.bio || '',
      totalGamesReffed: 0,
      gamesThisSeason: 0,
      sportBreakdown: {} as Record<SportType, number>,
      verificationStatus: 'unverified',
      isAvailable: true,
      isPremiumListed: false,
    };
    
    batch.set(refereeRef, {
      ...defaultProfile,
      ...profileData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Update user role to Referee
    const userRef = doc(db, 'users', userId);
    batch.update(userRef, {
      role: 'Referee',
      isReferee: true,
      updatedAt: serverTimestamp(),
    });
    
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error('Error signing up as referee:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get referee profile
 */
export const getRefereeProfile = async (userId: string): Promise<RefereeProfile | null> => {
  const docSnap = await getDoc(doc(db, 'refereeProfiles', userId));
  if (!docSnap.exists()) return null;
  return { ...docSnap.data() } as RefereeProfile;
};

/**
 * Update referee profile
 */
export const updateRefereeProfile = async (
  userId: string,
  data: Partial<RefereeProfile>
): Promise<void> => {
  await updateDoc(doc(db, 'refereeProfiles', userId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Search for referees
 */
export const searchReferees = async (
  filters: RefereeSearchFilters
): Promise<(RefereeProfile & { id: string; userName: string })[]> => {
  let q = query(collection(db, 'refereeProfiles'));
  
  // Build query based on filters
  const constraints: any[] = [];
  
  if (filters.sport) {
    constraints.push(where('sports', 'array-contains', filters.sport));
  }
  
  if (filters.verifiedOnly) {
    constraints.push(where('verificationStatus', '==', 'verified'));
  }
  
  if (filters.availableOnly) {
    constraints.push(where('isAvailable', '==', true));
  }
  
  if (filters.state) {
    constraints.push(where('homeLocation.state', '==', filters.state));
  }
  
  // Apply constraints
  if (constraints.length > 0) {
    q = query(collection(db, 'refereeProfiles'), ...constraints);
  }
  
  const snapshot = await getDocs(q);
  const profiles: (RefereeProfile & { id: string; userName: string })[] = [];
  
  for (const docSnap of snapshot.docs) {
    const profile = docSnap.data() as RefereeProfile;
    
    // Client-side filtering for things Firestore can't handle
    if (filters.minRating && (profile.averageRating || 0) < filters.minRating) continue;
    if (filters.minExperience && profile.yearsExperience < filters.minExperience) continue;
    
    // Get user name
    const userSnap = await getDoc(doc(db, 'users', docSnap.id));
    const userName = userSnap.exists() ? (userSnap.data() as UserProfile).name : 'Unknown';
    
    profiles.push({
      ...profile,
      id: docSnap.id,
      userName,
    });
  }
  
  return profiles;
};

// =============================================================================
// REFEREE ASSIGNMENT OPERATIONS
// =============================================================================

/**
 * Assign referee to a game
 */
export const assignRefereeToGame = async (
  assignmentData: Omit<RefereeAssignment, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'scoreSubmitted'>
): Promise<string> => {
  const docRef = await addDoc(collection(db, 'refereeAssignments'), {
    ...assignmentData,
    status: 'pending',
    scoreSubmitted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Get assignments for a referee
 */
export const getRefereeAssignments = async (
  refereeId: string,
  statusFilter?: RefereeAssignment['status'][]
): Promise<RefereeAssignment[]> => {
  let q = query(
    collection(db, 'refereeAssignments'),
    where('refereeId', '==', refereeId),
    orderBy('gameDate', 'desc')
  );
  
  const snapshot = await getDocs(q);
  let assignments = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RefereeAssignment));
  
  if (statusFilter && statusFilter.length > 0) {
    assignments = assignments.filter(a => statusFilter.includes(a.status));
  }
  
  return assignments;
};

/**
 * Get upcoming assignments (accepted, not completed)
 */
export const getUpcomingAssignments = async (refereeId: string): Promise<RefereeAssignment[]> => {
  const now = Timestamp.now();
  const q = query(
    collection(db, 'refereeAssignments'),
    where('refereeId', '==', refereeId),
    where('status', '==', 'accepted'),
    where('gameDate', '>=', now),
    orderBy('gameDate', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RefereeAssignment));
};

/**
 * Get pending assignment requests
 */
export const getPendingAssignments = async (refereeId: string): Promise<RefereeAssignment[]> => {
  const q = query(
    collection(db, 'refereeAssignments'),
    where('refereeId', '==', refereeId),
    where('status', '==', 'pending'),
    orderBy('gameDate', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RefereeAssignment));
};

/**
 * Accept or decline an assignment
 */
export const respondToAssignment = async (
  assignmentId: string,
  accept: boolean,
  declineReason?: string
): Promise<void> => {
  await updateDoc(doc(db, 'refereeAssignments', assignmentId), {
    status: accept ? 'accepted' : 'declined',
    respondedAt: serverTimestamp(),
    ...(declineReason && { declineReason }),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Get referees assigned to a game
 */
export const getGameReferees = async (
  gameType: 'league' | 'team',
  gameId: string
): Promise<RefereeAssignment[]> => {
  const field = gameType === 'league' ? 'leagueGameId' : 'teamGameId';
  const q = query(
    collection(db, 'refereeAssignments'),
    where(field, '==', gameId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RefereeAssignment));
};

/**
 * Cancel an assignment
 */
export const cancelAssignment = async (
  assignmentId: string,
  cancelledBy: string,
  reason?: string
): Promise<void> => {
  await updateDoc(doc(db, 'refereeAssignments', assignmentId), {
    status: 'cancelled',
    cancelledBy,
    cancelledAt: serverTimestamp(),
    cancelReason: reason || 'Cancelled by assigner',
    updatedAt: serverTimestamp(),
  });
};

// =============================================================================
// SCORE SUBMISSION
// =============================================================================

/**
 * Submit game score as referee
 */
export const submitGameScore = async (
  assignmentId: string,
  homeScore: number,
  awayScore: number,
  refereeId: string,
  refereeName: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const assignmentRef = doc(db, 'refereeAssignments', assignmentId);
    const assignmentSnap = await getDoc(assignmentRef);
    
    if (!assignmentSnap.exists()) {
      return { success: false, error: 'Assignment not found' };
    }
    
    const assignment = assignmentSnap.data() as RefereeAssignment;
    
    if (assignment.refereeId !== refereeId) {
      return { success: false, error: 'Not authorized to submit score for this game' };
    }
    
    const batch = writeBatch(db);
    
    // Update assignment with score
    batch.update(assignmentRef, {
      scoreSubmitted: true,
      scoreSubmittedAt: serverTimestamp(),
      finalHomeScore: homeScore,
      finalAwayScore: awayScore,
      status: 'completed',
      updatedAt: serverTimestamp(),
    });
    
    // Create score submission record
    const scoreSubmissionRef = doc(collection(db, 'gameScoreSubmissions'));
    batch.set(scoreSubmissionRef, {
      gameType: assignment.gameType,
      leagueGameId: assignment.leagueGameId,
      teamGameId: assignment.teamGameId,
      leagueId: assignment.leagueId,
      teamId: assignment.teamId,
      homeScore,
      awayScore,
      submittedBy: refereeId,
      submittedByRole: 'Referee',
      submittedByName: refereeName,
      refereeAssignmentId: assignmentId,
      isVerified: true, // Referee submissions are auto-verified
      isDisputed: false,
      createdAt: serverTimestamp(),
    });
    
    // Update the actual game record with scores
    if (assignment.gameType === 'league' && assignment.leagueScheduleId && assignment.leagueGameId) {
      // For league games, we need to update the game in the schedule
      // This would require knowing the schedule structure
      // Will be handled by a Cloud Function or separate update
    } else if (assignment.gameType === 'team' && assignment.teamId && assignment.teamGameId) {
      const gameRef = doc(db, 'teams', assignment.teamId, 'games', assignment.teamGameId);
      batch.update(gameRef, {
        homeScore,
        awayScore,
        status: 'completed',
        scoreSubmittedBy: 'referee',
        scoreSubmittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error('Error submitting score:', error);
    return { success: false, error: error.message };
  }
};

// =============================================================================
// REFEREE NOTES
// =============================================================================

/**
 * Add a private note to an assignment
 */
export const addRefereeNote = async (
  noteData: Omit<RefereeNote, 'id' | 'createdAt'>
): Promise<string> => {
  const docRef = await addDoc(collection(db, 'refereeNotes'), {
    ...noteData,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Get notes for an assignment
 */
export const getAssignmentNotes = async (
  assignmentId: string,
  refereeId: string
): Promise<RefereeNote[]> => {
  const q = query(
    collection(db, 'refereeNotes'),
    where('assignmentId', '==', assignmentId),
    where('refereeId', '==', refereeId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RefereeNote));
};

/**
 * Update a note
 */
export const updateRefereeNote = async (
  noteId: string,
  content: string
): Promise<void> => {
  await updateDoc(doc(db, 'refereeNotes', noteId), {
    content,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Delete a note
 */
export const deleteRefereeNote = async (noteId: string): Promise<void> => {
  await deleteDoc(doc(db, 'refereeNotes', noteId));
};

// =============================================================================
// VERIFICATION
// =============================================================================

/**
 * Submit verification request
 */
export const submitVerificationRequest = async (
  requestData: Omit<RefereeVerificationRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<string> => {
  // Update profile to pending
  await updateDoc(doc(db, 'refereeProfiles', requestData.refereeId), {
    verificationStatus: 'pending',
    verificationSubmittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  const docRef = await addDoc(collection(db, 'refereeVerificationRequests'), {
    ...requestData,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  return docRef.id;
};

/**
 * Get pending verification requests (admin)
 */
export const getPendingVerificationRequests = async (): Promise<RefereeVerificationRequest[]> => {
  const q = query(
    collection(db, 'refereeVerificationRequests'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RefereeVerificationRequest));
};

/**
 * Approve or reject verification (admin)
 */
export const reviewVerificationRequest = async (
  requestId: string,
  refereeId: string,
  approved: boolean,
  reviewerId: string,
  reviewerName: string,
  notes?: string,
  rejectionReason?: string
): Promise<void> => {
  const batch = writeBatch(db);
  
  // Update request
  batch.update(doc(db, 'refereeVerificationRequests', requestId), {
    status: approved ? 'approved' : 'rejected',
    reviewedBy: reviewerId,
    reviewedByName: reviewerName,
    reviewedAt: serverTimestamp(),
    reviewNotes: notes,
    ...(rejectionReason && { rejectionReason }),
    updatedAt: serverTimestamp(),
  });
  
  // Update profile
  batch.update(doc(db, 'refereeProfiles', refereeId), {
    verificationStatus: approved ? 'verified' : 'rejected',
    verificationApprovedAt: approved ? serverTimestamp() : null,
    verificationNotes: approved ? notes : rejectionReason,
    updatedAt: serverTimestamp(),
  });
  
  await batch.commit();
};

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get referee statistics
 */
export const getRefereeStats = async (refereeId: string): Promise<RefereeStats> => {
  const assignments = await getRefereeAssignments(refereeId);
  
  const completed = assignments.filter(a => a.status === 'completed');
  const accepted = assignments.filter(a => a.status === 'accepted' || a.status === 'completed');
  const pending = assignments.filter(a => a.status === 'pending');
  
  // Calculate sport breakdown
  const sportBreakdown: Record<SportType, number> = {} as Record<SportType, number>;
  completed.forEach(a => {
    sportBreakdown[a.sport] = (sportBreakdown[a.sport] || 0) + 1;
  });
  
  // This season (current year)
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), 0, 1);
  const gamesThisSeason = completed.filter(a => {
    const gameDate = a.gameDate instanceof Timestamp ? a.gameDate.toDate() : new Date(a.gameDate as any);
    return gameDate >= seasonStart;
  }).length;
  
  // This month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const gamesThisMonth = completed.filter(a => {
    const gameDate = a.gameDate instanceof Timestamp ? a.gameDate.toDate() : new Date(a.gameDate as any);
    return gameDate >= monthStart;
  }).length;
  
  // Calculate earnings if tracked
  const totalEarnings = completed.reduce((sum, a) => sum + (a.paymentAmount || 0), 0);
  const pendingPayments = completed
    .filter(a => a.paymentStatus === 'pending')
    .reduce((sum, a) => sum + (a.paymentAmount || 0), 0);
  
  return {
    totalGamesAllTime: completed.length,
    gamesThisSeason,
    gamesThisMonth,
    sportBreakdown,
    acceptanceRate: assignments.length > 0 
      ? (accepted.length / (accepted.length + assignments.filter(a => a.status === 'declined').length)) * 100 
      : 100,
    completionRate: accepted.length > 0 
      ? (completed.length / accepted.length) * 100 
      : 100,
    totalEarnings,
    pendingPayments,
  };
};

/**
 * Update referee stats after game completion
 */
export const updateRefereeStatsAfterGame = async (
  refereeId: string,
  sport: SportType
): Promise<void> => {
  const profileRef = doc(db, 'refereeProfiles', refereeId);
  const profileSnap = await getDoc(profileRef);
  
  if (!profileSnap.exists()) return;
  
  const profile = profileSnap.data() as RefereeProfile;
  const sportBreakdown = profile.sportBreakdown || {};
  sportBreakdown[sport] = (sportBreakdown[sport] || 0) + 1;
  
  await updateDoc(profileRef, {
    totalGamesReffed: (profile.totalGamesReffed || 0) + 1,
    gamesThisSeason: (profile.gamesThisSeason || 0) + 1,
    sportBreakdown,
    updatedAt: serverTimestamp(),
  });
};

// =============================================================================
// PAYMENT OPERATIONS
// =============================================================================

/**
 * Record payment to referee
 */
export const recordRefereePayment = async (
  paymentData: Omit<RefereePayment, 'id' | 'createdAt' | 'status'>
): Promise<string> => {
  const batch = writeBatch(db);
  
  // Create payment record
  const paymentRef = doc(collection(db, 'refereePayments'));
  batch.set(paymentRef, {
    ...paymentData,
    status: 'completed',
    paidAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  
  // Update all assignments as paid
  for (const assignmentId of paymentData.assignmentIds) {
    batch.update(doc(db, 'refereeAssignments', assignmentId), {
      paymentStatus: 'paid',
      paymentPaidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  
  await batch.commit();
  return paymentRef.id;
};

/**
 * Get payment history for referee
 */
export const getRefereePaymentHistory = async (refereeId: string): Promise<RefereePayment[]> => {
  const q = query(
    collection(db, 'refereePayments'),
    where('refereeId', '==', refereeId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RefereePayment));
};

// =============================================================================
// RATINGS (Future feature)
// =============================================================================

/**
 * Rate a referee after a game
 */
export const rateReferee = async (
  ratingData: Omit<RefereeRating, 'id' | 'createdAt'>
): Promise<string> => {
  const batch = writeBatch(db);
  
  // Add rating
  const ratingRef = doc(collection(db, 'refereeRatings'));
  batch.set(ratingRef, {
    ...ratingData,
    createdAt: serverTimestamp(),
  });
  
  // Update referee average rating
  const ratingsQuery = query(
    collection(db, 'refereeRatings'),
    where('refereeId', '==', ratingData.refereeId)
  );
  const ratingsSnap = await getDocs(ratingsQuery);
  const allRatings = ratingsSnap.docs.map(d => d.data().overallRating as number);
  allRatings.push(ratingData.overallRating);
  
  const averageRating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
  
  batch.update(doc(db, 'refereeProfiles', ratingData.refereeId), {
    averageRating,
    totalRatings: allRatings.length,
    updatedAt: serverTimestamp(),
  });
  
  await batch.commit();
  return ratingRef.id;
};

/**
 * Get ratings for a referee
 */
export const getRefereeRatings = async (refereeId: string): Promise<RefereeRating[]> => {
  const q = query(
    collection(db, 'refereeRatings'),
    where('refereeId', '==', refereeId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RefereeRating));
};
