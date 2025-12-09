/**
 * OSYS Notification Service
 * Handles in-app notifications for various events
 */

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  writeBatch,
  Timestamp,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export type NotificationType =
  | 'assignment_request'
  | 'assignment_confirmed'
  | 'assignment_declined'
  | 'assignment_cancelled'
  | 'verification_approved'
  | 'verification_rejected'
  | 'rating_received'
  | 'payment_received'
  | 'game_reminder'
  | 'schedule_change'
  | 'message'
  | 'general';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
}

/**
 * Create a notification for a user
 */
export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string,
  metadata?: Record<string, any>
): Promise<string> => {
  const docRef = await addDoc(collection(db, 'notifications'), {
    userId,
    type,
    title,
    message,
    read: false,
    link,
    metadata,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Get notifications for a user
 */
export const getUserNotifications = async (
  userId: string,
  unreadOnly = false,
  maxCount = 50
): Promise<Notification[]> => {
  let q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(maxCount)
  );

  if (unreadOnly) {
    q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Notification[];
};

/**
 * Subscribe to real-time notifications
 */
export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(20)
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Notification[];
    callback(notifications);
  });
};

/**
 * Mark a notification as read
 */
export const markNotificationRead = async (notificationId: string): Promise<void> => {
  await updateDoc(doc(db, 'notifications', notificationId), {
    read: true,
  });
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    batch.update(d.ref, { read: true });
  });

  await batch.commit();
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
};

// ============================================
// Referee-Specific Notification Helpers
// ============================================

/**
 * Notify referee of new assignment request
 */
export const notifyRefereeAssignmentRequest = async (
  refereeId: string,
  gameDate: string,
  leagueName: string,
  assignmentId: string
): Promise<string> => {
  return createNotification(
    refereeId,
    'assignment_request',
    'New Game Assignment',
    `You've been requested to officiate a game on ${gameDate} for ${leagueName}`,
    `/referee/game/${assignmentId}`,
    { assignmentId, leagueName, gameDate }
  );
};

/**
 * Notify league owner that referee accepted/declined
 */
export const notifyLeagueOwnerAssignmentResponse = async (
  leagueOwnerId: string,
  refereeName: string,
  accepted: boolean,
  gameDate: string,
  assignmentId: string
): Promise<string> => {
  return createNotification(
    leagueOwnerId,
    accepted ? 'assignment_confirmed' : 'assignment_declined',
    accepted ? 'Assignment Accepted' : 'Assignment Declined',
    `${refereeName} has ${accepted ? 'accepted' : 'declined'} the game assignment on ${gameDate}`,
    `/league/assignments`,
    { assignmentId, refereeName, accepted }
  );
};

/**
 * Notify referee that assignment was cancelled
 */
export const notifyRefereeCancelledAssignment = async (
  refereeId: string,
  gameDate: string,
  reason?: string
): Promise<string> => {
  return createNotification(
    refereeId,
    'assignment_cancelled',
    'Assignment Cancelled',
    `Your game assignment on ${gameDate} has been cancelled${reason ? `: ${reason}` : ''}`,
    '/referee/schedule',
    { gameDate, reason }
  );
};

/**
 * Notify referee of verification result
 */
export const notifyVerificationResult = async (
  refereeId: string,
  approved: boolean,
  reason?: string
): Promise<string> => {
  return createNotification(
    refereeId,
    approved ? 'verification_approved' : 'verification_rejected',
    approved ? 'Verification Approved!' : 'Verification Rejected',
    approved
      ? 'Congratulations! Your referee profile has been verified.'
      : `Your verification request was not approved${reason ? `: ${reason}` : ''}`,
    '/referee',
    { approved, reason }
  );
};

/**
 * Notify referee of new rating
 */
export const notifyRefereeRating = async (
  refereeId: string,
  rating: number,
  reviewerName: string
): Promise<string> => {
  return createNotification(
    refereeId,
    'rating_received',
    'New Rating Received',
    `${reviewerName} rated your officiating ${rating}/5 stars`,
    '/referee',
    { rating, reviewerName }
  );
};

/**
 * Notify referee of payment
 */
export const notifyRefereePayment = async (
  refereeId: string,
  amount: number,
  leagueName: string
): Promise<string> => {
  return createNotification(
    refereeId,
    'payment_received',
    'Payment Recorded',
    `$${amount.toFixed(2)} payment recorded from ${leagueName}`,
    '/referee/payments',
    { amount, leagueName }
  );
};

/**
 * Send game reminder to referee
 */
export const sendGameReminder = async (
  refereeId: string,
  gameTime: string,
  location: string,
  teams: string
): Promise<string> => {
  return createNotification(
    refereeId,
    'game_reminder',
    'Upcoming Game Reminder',
    `You have a game at ${gameTime} - ${teams} at ${location}`,
    '/referee/schedule',
    { gameTime, location, teams }
  );
};

export default {
  createNotification,
  getUserNotifications,
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
  notifyRefereeAssignmentRequest,
  notifyLeagueOwnerAssignmentResponse,
  notifyRefereeCancelledAssignment,
  notifyVerificationResult,
  notifyRefereeRating,
  notifyRefereePayment,
  sendGameReminder,
};
