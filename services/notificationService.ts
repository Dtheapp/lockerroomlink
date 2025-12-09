/**
 * OSYS Notification Service
 * Comprehensive in-app notification system
 * Handles notifications for all user types: Coaches, Parents, Fans, Refs, Leagues, SuperAdmins
 */

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
  Timestamp,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

// ============================================================================
// NOTIFICATION TYPES - Comprehensive for all user types
// ============================================================================

export type NotificationType =
  // Referee-related
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
  | 'game_assignment_available'
  // General
  | 'message'
  | 'general'
  // System-wide (SuperAdmin)
  | 'system_announcement'
  | 'feature_update'
  | 'subscription_deal'
  | 'platform_maintenance'
  // League notifications
  | 'league_announcement'
  | 'league_rule_update'
  | 'league_schedule_published'
  | 'league_playoff_update'
  | 'league_standings_update'
  // Team notifications
  | 'team_announcement'
  | 'practice_reminder'
  | 'game_day'
  | 'roster_update'
  | 'playbook_update'
  // Infraction system
  | 'infraction_filed'
  | 'infraction_update'
  | 'infraction_resolved'
  | 'infraction_message'
  // Registration & Payment
  | 'registration_open'
  | 'registration_confirmed'
  | 'payment_due'
  | 'payment_reminder'
  | 'payment_received_parent'
  | 'payment_overdue'
  // Fan & Parent notifications
  | 'new_follower'
  | 'gift_received'
  | 'fundraising_donation'
  | 'fundraising_goal_reached'
  | 'nil_offer'
  | 'nil_deal_update'
  | 'player_stats_update'
  | 'highlight_ready'
  | 'kudos_received';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationCategory = 
  | 'system'
  | 'league'
  | 'team'
  | 'referee'
  | 'registration'
  | 'social'
  | 'financial'
  | 'infraction';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  actionRequired?: boolean;
  actionType?: 'accept_decline' | 'view' | 'pay' | 'respond';
  metadata?: Record<string, any>;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
}

export interface NotificationPreferences {
  userId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  // Category toggles
  systemNotifications: boolean;
  leagueNotifications: boolean;
  teamNotifications: boolean;
  socialNotifications: boolean;
  financialNotifications: boolean;
  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string;   // "07:00"
}

// ============================================================================
// CORE NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Create a notification for a user
 */
export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    link?: string;
    metadata?: Record<string, any>;
    priority?: NotificationPriority;
    category?: NotificationCategory;
    actionRequired?: boolean;
    actionType?: 'accept_decline' | 'view' | 'pay' | 'respond';
    expiresAt?: Date;
  }
): Promise<string> => {
  // Derive category from type if not provided
  const category = options?.category || getCategoryFromType(type);
  const priority = options?.priority || getPriorityFromType(type);

  const docRef = await addDoc(collection(db, 'notifications'), {
    userId,
    type,
    category,
    priority,
    title,
    message,
    read: false,
    link: options?.link || null,
    metadata: options?.metadata || null,
    actionRequired: options?.actionRequired || false,
    actionType: options?.actionType || null,
    createdAt: serverTimestamp(),
    expiresAt: options?.expiresAt ? Timestamp.fromDate(options.expiresAt) : null,
  });
  return docRef.id;
};

/**
 * Create notifications for multiple users (bulk)
 */
export const createBulkNotifications = async (
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    link?: string;
    metadata?: Record<string, any>;
    priority?: NotificationPriority;
    category?: NotificationCategory;
  }
): Promise<number> => {
  const category = options?.category || getCategoryFromType(type);
  const priority = options?.priority || getPriorityFromType(type);
  const batch = writeBatch(db);
  let count = 0;

  for (const userId of userIds) {
    const docRef = doc(collection(db, 'notifications'));
    batch.set(docRef, {
      userId,
      type,
      category,
      priority,
      title,
      message,
      read: false,
      link: options?.link || null,
      metadata: options?.metadata || null,
      actionRequired: false,
      actionType: null,
      createdAt: serverTimestamp(),
    });
    count++;

    // Firestore batch limit is 500
    if (count % 450 === 0) {
      await batch.commit();
    }
  }

  await batch.commit();
  return count;
};

/**
 * Helper: Get category from notification type
 */
const getCategoryFromType = (type: NotificationType): NotificationCategory => {
  if (['system_announcement', 'feature_update', 'subscription_deal', 'platform_maintenance'].includes(type)) return 'system';
  if (['league_announcement', 'league_rule_update', 'league_schedule_published', 'league_playoff_update', 'league_standings_update'].includes(type)) return 'league';
  if (['team_announcement', 'practice_reminder', 'game_day', 'roster_update', 'playbook_update'].includes(type)) return 'team';
  if (['assignment_request', 'assignment_confirmed', 'assignment_declined', 'assignment_cancelled', 'verification_approved', 'verification_rejected', 'rating_received', 'game_reminder', 'schedule_change', 'game_assignment_available'].includes(type)) return 'referee';
  if (['registration_open', 'registration_confirmed', 'payment_due', 'payment_reminder', 'payment_received', 'payment_received_parent', 'payment_overdue'].includes(type)) return 'registration';
  if (['new_follower', 'gift_received', 'kudos_received', 'highlight_ready', 'player_stats_update'].includes(type)) return 'social';
  if (['fundraising_donation', 'fundraising_goal_reached', 'nil_offer', 'nil_deal_update'].includes(type)) return 'financial';
  if (['infraction_filed', 'infraction_update', 'infraction_resolved', 'infraction_message'].includes(type)) return 'infraction';
  return 'system';
};

/**
 * Helper: Get default priority from type
 */
const getPriorityFromType = (type: NotificationType): NotificationPriority => {
  // Urgent: Time-sensitive actions
  if (['payment_overdue', 'assignment_request', 'infraction_filed', 'platform_maintenance'].includes(type)) return 'urgent';
  // High: Important but not critical
  if (['payment_due', 'game_reminder', 'game_day', 'nil_offer', 'registration_open'].includes(type)) return 'high';
  // Low: Nice to know
  if (['new_follower', 'kudos_received', 'feature_update', 'player_stats_update'].includes(type)) return 'low';
  return 'normal';
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
    {
      link: `/referee/game/${assignmentId}`,
      metadata: { assignmentId, leagueName, gameDate },
      actionRequired: true,
      actionType: 'accept_decline',
    }
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
    {
      link: `/league/assignments`,
      metadata: { assignmentId, refereeName, accepted },
    }
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
    {
      link: '/referee/schedule',
      metadata: { gameDate, reason },
    }
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
    {
      link: '/referee',
      metadata: { approved, reason },
    }
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
    {
      link: '/referee',
      metadata: { rating, reviewerName },
    }
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
    {
      link: '/referee/payments',
      metadata: { amount, leagueName },
    }
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
    {
      link: '/referee/schedule',
      metadata: { gameTime, location, teams },
      priority: 'high',
    }
  );
};

// ============================================
// System-Wide Notifications (SuperAdmin)
// ============================================

/**
 * Send system-wide announcement to all users or specific roles
 */
export const sendSystemAnnouncement = async (
  title: string,
  message: string,
  targetUserIds: string[],
  options?: {
    link?: string;
    priority?: NotificationPriority;
    expiresAt?: Date;
  }
): Promise<number> => {
  return createBulkNotifications(
    targetUserIds,
    'system_announcement',
    title,
    message,
    {
      link: options?.link,
      priority: options?.priority || 'high',
      category: 'system',
    }
  );
};

/**
 * Notify users of new feature
 */
export const notifyFeatureUpdate = async (
  targetUserIds: string[],
  featureName: string,
  description: string,
  learnMoreLink?: string
): Promise<number> => {
  return createBulkNotifications(
    targetUserIds,
    'feature_update',
    `New Feature: ${featureName}`,
    description,
    {
      link: learnMoreLink,
      priority: 'normal',
      category: 'system',
    }
  );
};

/**
 * Notify of subscription deal
 */
export const notifySubscriptionDeal = async (
  targetUserIds: string[],
  dealTitle: string,
  dealMessage: string,
  expiresAt?: Date
): Promise<number> => {
  return createBulkNotifications(
    targetUserIds,
    'subscription_deal',
    dealTitle,
    dealMessage,
    {
      link: '/settings/subscription',
      priority: 'normal',
      category: 'system',
    }
  );
};

// ============================================
// League Notifications
// ============================================

/**
 * Send announcement to all users in a league (teams, coaches, parents)
 */
export const sendLeagueAnnouncement = async (
  leagueId: string,
  title: string,
  message: string,
  targetUserIds: string[],
  link?: string
): Promise<number> => {
  return createBulkNotifications(
    targetUserIds,
    'league_announcement',
    title,
    message,
    {
      link: link || `/league/${leagueId}`,
      category: 'league',
      metadata: { leagueId },
    }
  );
};

/**
 * Notify of league rule update
 */
export const notifyLeagueRuleUpdate = async (
  leagueId: string,
  leagueName: string,
  targetUserIds: string[]
): Promise<number> => {
  return createBulkNotifications(
    targetUserIds,
    'league_rule_update',
    'League Rules Updated',
    `${leagueName} has updated their rules and code of conduct. Please review.`,
    {
      link: `/league/${leagueId}/rules`,
      category: 'league',
      priority: 'high',
      metadata: { leagueId, leagueName },
    }
  );
};

/**
 * Notify of schedule being published
 */
export const notifySchedulePublished = async (
  leagueId: string,
  leagueName: string,
  seasonName: string,
  targetUserIds: string[]
): Promise<number> => {
  return createBulkNotifications(
    targetUserIds,
    'league_schedule_published',
    'New Schedule Published!',
    `${leagueName} has published the ${seasonName} schedule. Check your game dates!`,
    {
      link: `/league/${leagueId}/schedule`,
      category: 'league',
      priority: 'high',
      metadata: { leagueId, leagueName, seasonName },
    }
  );
};

// ============================================
// Team Notifications
// ============================================

/**
 * Send announcement to all team members (coaches, parents)
 */
export const sendTeamAnnouncement = async (
  teamId: string,
  teamName: string,
  title: string,
  message: string,
  targetUserIds: string[]
): Promise<number> => {
  return createBulkNotifications(
    targetUserIds,
    'team_announcement',
    title,
    message,
    {
      link: `/team/${teamId}`,
      category: 'team',
      metadata: { teamId, teamName },
    }
  );
};

/**
 * Send practice reminder
 */
export const sendPracticeReminder = async (
  teamId: string,
  teamName: string,
  date: string,
  time: string,
  location: string,
  targetUserIds: string[]
): Promise<number> => {
  return createBulkNotifications(
    targetUserIds,
    'practice_reminder',
    'Practice Reminder',
    `${teamName} practice on ${date} at ${time} - ${location}`,
    {
      link: `/team/${teamId}/schedule`,
      category: 'team',
      priority: 'high',
      metadata: { teamId, teamName, date, time, location },
    }
  );
};

/**
 * Send game day notification
 */
export const sendGameDayNotification = async (
  teamId: string,
  teamName: string,
  opponent: string,
  time: string,
  location: string,
  targetUserIds: string[]
): Promise<number> => {
  return createBulkNotifications(
    targetUserIds,
    'game_day',
    '🏈 Game Day!',
    `${teamName} vs ${opponent} at ${time} - ${location}`,
    {
      link: `/team/${teamId}/schedule`,
      category: 'team',
      priority: 'urgent',
      metadata: { teamId, teamName, opponent, time, location },
    }
  );
};

// ============================================
// Infraction Notifications
// ============================================

/**
 * Notify team director/head coach of new infraction
 */
export const notifyInfractionFiled = async (
  targetUserIds: string[],
  teamName: string,
  infractionTitle: string,
  severity: string,
  infractionId: string
): Promise<number> => {
  return createBulkNotifications(
    targetUserIds,
    'infraction_filed',
    'New Infraction Filed',
    `An infraction has been filed against ${teamName}: ${infractionTitle} (${severity})`,
    {
      link: `/infractions/${infractionId}`,
      category: 'infraction',
      priority: severity === 'severe' ? 'urgent' : 'high',
      metadata: { infractionId, teamName, severity },
    }
  );
};

/**
 * Notify of infraction update (status change, message)
 */
export const notifyInfractionUpdate = async (
  targetUserIds: string[],
  infractionTitle: string,
  updateMessage: string,
  infractionId: string
): Promise<number> => {
  return createBulkNotifications(
    targetUserIds,
    'infraction_update',
    'Infraction Updated',
    updateMessage,
    {
      link: `/infractions/${infractionId}`,
      category: 'infraction',
      metadata: { infractionId, infractionTitle },
    }
  );
};

/**
 * Notify of new message in infraction thread
 */
export const notifyInfractionMessage = async (
  userId: string,
  senderName: string,
  infractionTitle: string,
  infractionId: string
): Promise<string> => {
  return createNotification(
    userId,
    'infraction_message',
    'New Infraction Message',
    `${senderName} sent a message regarding: ${infractionTitle}`,
    {
      link: `/infractions/${infractionId}`,
      category: 'infraction',
      metadata: { infractionId, senderName },
    }
  );
};

// ============================================
// Registration & Payment Notifications
// ============================================

/**
 * Notify of registration opening
 */
export const notifyRegistrationOpen = async (
  targetUserIds: string[],
  eventName: string,
  deadline: string,
  eventId: string
): Promise<number> => {
  return createBulkNotifications(
    targetUserIds,
    'registration_open',
    'Registration Open!',
    `Registration for ${eventName} is now open! Deadline: ${deadline}`,
    {
      link: `/events/${eventId}`,
      category: 'registration',
      priority: 'high',
      metadata: { eventId, eventName, deadline },
    }
  );
};

/**
 * Notify of payment due
 */
export const notifyPaymentDue = async (
  userId: string,
  amount: number,
  dueDate: string,
  description: string,
  paymentLink?: string
): Promise<string> => {
  return createNotification(
    userId,
    'payment_due',
    'Payment Due',
    `$${amount.toFixed(2)} due by ${dueDate} for ${description}`,
    {
      link: paymentLink || '/payments',
      category: 'registration',
      priority: 'high',
      actionRequired: true,
      actionType: 'pay',
      metadata: { amount, dueDate, description },
    }
  );
};

/**
 * Send payment reminder
 */
export const sendPaymentReminder = async (
  userId: string,
  amount: number,
  dueDate: string,
  description: string
): Promise<string> => {
  return createNotification(
    userId,
    'payment_reminder',
    'Payment Reminder',
    `Reminder: $${amount.toFixed(2)} due by ${dueDate} for ${description}`,
    {
      link: '/payments',
      category: 'registration',
      priority: 'high',
      metadata: { amount, dueDate, description },
    }
  );
};

// ============================================
// Social Notifications (Parents/Fans)
// ============================================

/**
 * Notify of new follower
 */
export const notifyNewFollower = async (
  userId: string,
  followerName: string,
  followerProfileLink: string
): Promise<string> => {
  return createNotification(
    userId,
    'new_follower',
    'New Follower!',
    `${followerName} is now following you`,
    {
      link: followerProfileLink,
      category: 'social',
      priority: 'low',
      metadata: { followerName },
    }
  );
};

/**
 * Notify of gift received
 */
export const notifyGiftReceived = async (
  userId: string,
  senderName: string,
  giftAmount: number
): Promise<string> => {
  return createNotification(
    userId,
    'gift_received',
    'Gift Received! 🎁',
    `${senderName} sent you ${giftAmount} credits`,
    {
      link: '/credits',
      category: 'social',
      priority: 'normal',
      metadata: { senderName, giftAmount },
    }
  );
};

/**
 * Notify of fundraising donation
 */
export const notifyFundraisingDonation = async (
  userId: string,
  donorName: string,
  amount: number,
  campaignName: string
): Promise<string> => {
  return createNotification(
    userId,
    'fundraising_donation',
    'New Donation! 💰',
    `${donorName} donated $${amount.toFixed(2)} to ${campaignName}`,
    {
      link: '/fundraising',
      category: 'financial',
      priority: 'normal',
      metadata: { donorName, amount, campaignName },
    }
  );
};

/**
 * Notify of NIL offer
 */
export const notifyNILOffer = async (
  userId: string,
  companyName: string,
  offerAmount: number,
  dealId: string
): Promise<string> => {
  return createNotification(
    userId,
    'nil_offer',
    'New NIL Offer! 🤝',
    `${companyName} wants to offer you a deal worth $${offerAmount.toFixed(2)}`,
    {
      link: `/nil/${dealId}`,
      category: 'financial',
      priority: 'high',
      actionRequired: true,
      actionType: 'respond',
      metadata: { companyName, offerAmount, dealId },
    }
  );
};

/**
 * Notify of kudos received
 */
export const notifyKudosReceived = async (
  userId: string,
  senderName: string,
  kudosType: string
): Promise<string> => {
  return createNotification(
    userId,
    'kudos_received',
    'You Got Kudos! ⭐',
    `${senderName} gave you ${kudosType}`,
    {
      link: '/profile',
      category: 'social',
      priority: 'low',
      metadata: { senderName, kudosType },
    }
  );
};

// ============================================
// Delete Functions
// ============================================

/**
 * Delete a single notification
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  await deleteDoc(doc(db, 'notifications', notificationId));
};

/**
 * Delete all notifications for a user
 */
export const deleteAllNotifications = async (userId: string): Promise<number> => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return 0;

  const batch = writeBatch(db);
  let count = 0;
  
  snapshot.docs.forEach((d) => {
    batch.delete(d.ref);
    count++;
  });

  await batch.commit();
  return count;
};

/**
 * Delete read notifications older than X days
 */
export const deleteOldReadNotifications = async (userId: string, daysOld: number = 30): Promise<number> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', true),
    where('createdAt', '<', Timestamp.fromDate(cutoffDate))
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return 0;

  const batch = writeBatch(db);
  let count = 0;
  
  snapshot.docs.forEach((d) => {
    batch.delete(d.ref);
    count++;
  });

  await batch.commit();
  return count;
};

export default {
  // Core functions
  createNotification,
  createBulkNotifications,
  getUserNotifications,
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
  
  // Delete functions
  deleteNotification,
  deleteAllNotifications,
  deleteOldReadNotifications,
  
  // System notifications
  sendSystemAnnouncement,
  notifyFeatureUpdate,
  notifySubscriptionDeal,
  
  // Referee notifications
  notifyRefereeAssignmentRequest,
  notifyLeagueOwnerAssignmentResponse,
  notifyRefereeCancelledAssignment,
  notifyVerificationResult,
  notifyRefereeRating,
  notifyRefereePayment,
  sendGameReminder,
  
  // Infraction notifications
  notifyInfractionFiled,
  notifyInfractionUpdate,
  notifyInfractionMessage,
  
  // Registration & Payment notifications
  notifyRegistrationOpen,
  notifyPaymentDue,
  
  // Fan Hub notifications
  notifyNewFollower,
  notifyGiftReceived,
  notifyFundraisingDonation,
  notifyNILOffer,
  
  // League & Team notifications
  sendLeagueAnnouncement,
  notifyLeagueRuleUpdate,
  notifySchedulePublished,
  sendTeamAnnouncement,
  sendPracticeReminder,
  sendGameDayNotification,
};
