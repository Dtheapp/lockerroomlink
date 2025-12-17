/**
 * OSYS Notifications Page
 * Full page view for all notifications with delete functionality
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  type Notification,
  type NotificationType,
} from '../../services/notificationService';
import {
  doc,
  updateDoc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Shield,
  Star,
  DollarSign,
  Calendar,
  MessageCircle,
  AlertCircle,
  Filter,
  Trash2,
  Megaphone,
  Gift,
  Users,
  Gavel,
  FileText,
  CreditCard,
  Trophy,
  Video,
  ChartBar,
  Heart,
  Sparkles,
  AlertTriangle,
  X,
  UserPlus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    // System notifications
    case 'system_announcement':
      return Megaphone;
    case 'feature_update':
      return Sparkles;
    case 'subscription_deal':
      return Gift;
    
    // League notifications
    case 'league_announcement':
      return Megaphone;
    case 'league_rule_update':
      return FileText;
    case 'league_schedule_published':
      return Calendar;
    
    // Team notifications
    case 'team_announcement':
      return Users;
    case 'practice_reminder':
      return Clock;
    case 'game_day':
      return Trophy;
    case 'team_invite':
    case 'team_invite_accepted':
    case 'team_invite_declined':
      return UserPlus;
    
    // Infraction notifications
    case 'infraction_filed':
    case 'infraction_update':
    case 'infraction_resolved':
    case 'infraction_message':
      return Gavel;
    
    // Registration & Payment
    case 'registration_open':
      return FileText;
    case 'registration_confirmed':
      return Check;
    case 'player_drafted':
      return Trophy;
    case 'player_declined':
      return AlertCircle;
    case 'payment_due':
    case 'payment_reminder':
    case 'payment_received':
    case 'payment_received_parent':
      return CreditCard;
    
    // Fan Hub
    case 'new_follower':
      return Heart;
    case 'gift_received':
      return Gift;
    case 'fundraising_donation':
      return DollarSign;
    case 'nil_offer':
      return Star;
    case 'player_stats_update':
      return ChartBar;
    case 'highlight_ready':
      return Video;
    
    // Referee assignments (legacy)
    case 'assignment_request':
    case 'assignment_confirmed':
    case 'assignment_declined':
    case 'assignment_cancelled':
    case 'game_assignment_available':
      return Calendar;
    case 'verification_approved':
    case 'verification_rejected':
      return Shield;
    case 'rating_received':
      return Star;
    case 'game_reminder':
      return Clock;
    case 'message':
      return MessageCircle;
    default:
      return AlertCircle;
  }
};

const getNotificationColor = (type: NotificationType): string => {
  switch (type) {
    // Success states
    case 'assignment_confirmed':
    case 'verification_approved':
    case 'payment_received':
    case 'payment_received_parent':
    case 'infraction_resolved':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    
    // Error/Warning states
    case 'assignment_declined':
    case 'verification_rejected':
    case 'assignment_cancelled':
    case 'infraction_filed':
    case 'payment_due':
    case 'payment_reminder':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    
    // Action required
    case 'assignment_request':
    case 'game_reminder':
    case 'practice_reminder':
    case 'game_day':
    case 'infraction_update':
    case 'infraction_message':
    case 'registration_open':
    case 'team_invite':
      return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
    
    // Team invite responses
    case 'team_invite_accepted':
      return 'bg-green-500/20 text-green-600 border-green-500/30';
    case 'team_invite_declined':
      return 'bg-red-500/20 text-red-600 border-red-500/30';
    
    // Registration success
    case 'registration_confirmed':
    case 'player_drafted':
      return 'bg-green-500/20 text-green-600 border-green-500/30';
    
    // Registration declined
    case 'player_declined':
      return 'bg-red-500/20 text-red-600 border-red-500/30';
    
    // Special/Premium
    case 'rating_received':
    case 'nil_offer':
    case 'subscription_deal':
    case 'feature_update':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    
    // Fan engagement
    case 'new_follower':
    case 'gift_received':
    case 'fundraising_donation':
      return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
    
    // Announcements
    case 'system_announcement':
    case 'league_announcement':
    case 'team_announcement':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

const formatDate = (timestamp: any): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const NotificationsPage: React.FC = () => {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [respondingToInvite, setRespondingToInvite] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid) {
      loadNotifications();
    }
  }, [user?.uid]);

  const loadNotifications = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const data = await getUserNotifications(user.uid, false, 100);
      setNotifications(data);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    if (user?.uid) {
      await markAllNotificationsRead(user.uid);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  // Handle team invitation response (accept or decline)
  const handleTeamInviteResponse = async (notification: Notification, accept: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.uid || !notification.metadata?.invitationId) return;
    
    setRespondingToInvite(notification.id);
    
    try {
      const invitationId = notification.metadata.invitationId;
      const teamId = notification.metadata.teamId;
      const teamName = notification.metadata.teamName;
      const invitedByUserId = notification.metadata.invitedByUserId;
      const invitedByName = notification.metadata.invitedByName;
      
      // Update invitation status
      await updateDoc(doc(db, 'teamInvitations', invitationId), {
        status: accept ? 'accepted' : 'declined',
        respondedAt: serverTimestamp()
      });
      
      if (accept) {
        // Add coach to the team
        await updateDoc(doc(db, 'users', user.uid), {
          teamIds: arrayUnion(teamId),
          updatedAt: serverTimestamp()
        });
        
        // Add to team's coachIds
        await updateDoc(doc(db, 'teams', teamId), {
          coachIds: arrayUnion(user.uid),
          updatedAt: serverTimestamp()
        });
        
        // Notify the head coach that invitation was accepted
        await addDoc(collection(db, 'notifications'), {
          userId: invitedByUserId,
          type: 'team_invite_accepted',
          category: 'team',
          priority: 'normal',
          title: 'Invitation Accepted',
          message: `${userData?.name || 'A coach'} has accepted your invitation to join "${teamName}".`,
          read: false,
          createdAt: serverTimestamp()
        });
      } else {
        // Notify the head coach that invitation was declined
        await addDoc(collection(db, 'notifications'), {
          userId: invitedByUserId,
          type: 'team_invite_declined',
          category: 'team',
          priority: 'normal',
          title: 'Invitation Declined',
          message: `${userData?.name || 'A coach'} has declined your invitation to join "${teamName}".`,
          read: false,
          createdAt: serverTimestamp()
        });
      }
      
      // Mark original notification as read and update it to show response
      await markNotificationRead(notification.id);
      
      // Update local state to remove the action buttons
      setNotifications((prev) =>
        prev.map((n) => 
          n.id === notification.id 
            ? { 
                ...n, 
                read: true, 
                actionRequired: false,
                message: accept 
                  ? `You accepted the invitation to join "${teamName}".`
                  : `You declined the invitation to join "${teamName}".`
              } 
            : n
        )
      );
      
    } catch (error) {
      console.error('Error responding to team invite:', error);
      alert('Failed to respond to invitation. Please try again.');
    } finally {
      setRespondingToInvite(null);
    }
  };

  const handleDeleteNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(notificationId);
    try {
      await deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!user?.uid) return;
    setIsDeleting(true);
    try {
      await deleteAllNotifications(user.uid);
      setNotifications([]);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting all notifications:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredNotifications = filter === 'unread'
    ? notifications.filter((n) => !n.read)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        {/* Title Row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <p className="text-sm text-slate-600 dark:text-slate-400">{unreadCount} unread</p>
            )}
          </div>
        </div>

        {/* Actions Row - Stack on mobile */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Toggle */}
          <div className="flex bg-slate-200 dark:bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'unread'
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Unread
            </button>
          </div>

          {/* Mark All Read */}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-1.5 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 border border-purple-300 dark:border-purple-500/30 rounded-lg flex items-center gap-1.5 bg-purple-50 dark:bg-transparent"
            >
              <CheckCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Mark all</span> read
            </button>
          )}

          {/* Delete All */}
          {notifications.length > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-300 dark:border-red-500/30 rounded-lg flex items-center gap-1.5 bg-red-50 dark:bg-transparent"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete</span> all
            </button>
          )}
        </div>
      </div>

      {/* Delete All Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete All Notifications?</h3>
                <p className="text-sm text-slate-400">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-slate-300 mb-6">
              Are you sure you want to permanently delete all {notifications.length} notification{notifications.length !== 1 ? 's' : ''}? 
              This will remove both read and unread notifications.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete All
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="text-center py-16 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
          <Bell className="w-16 h-16 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            {filter === 'unread'
              ? 'You have no unread notifications'
              : "You'll see notifications here when you receive them"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => {
            const Icon = getNotificationIcon(notification.type);
            const colorClass = getNotificationColor(notification.type);

            return (
              <div
                key={notification.id}
                className={`relative group w-full p-3 md:p-4 rounded-xl border transition-all ${
                  notification.read
                    ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                    : 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30 hover:border-purple-300 dark:hover:border-purple-500/50'
                }`}
              >
                <button
                  onClick={() => handleNotificationClick(notification)}
                  className="w-full text-left"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg border flex-shrink-0 ${colorClass}`}>
                      <Icon className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-start gap-2">
                        <p className="font-semibold text-slate-900 dark:text-white text-sm md:text-base leading-tight">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-purple-500 rounded-full shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-slate-700 dark:text-slate-200 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
                
                {/* Team Invite Action Buttons */}
                {notification.type === 'team_invite' && notification.actionRequired && (
                  <div className="flex gap-2 mt-3 ml-12">
                    <button
                      onClick={(e) => handleTeamInviteResponse(notification, true, e)}
                      disabled={respondingToInvite === notification.id}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      {respondingToInvite === notification.id ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Accept
                    </button>
                    <button
                      onClick={(e) => handleTeamInviteResponse(notification, false, e)}
                      disabled={respondingToInvite === notification.id}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      {respondingToInvite === notification.id ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      Decline
                    </button>
                  </div>
                )}
                
                {/* Delete button - always visible on mobile */}
                <button
                  onClick={(e) => handleDeleteNotification(notification.id, e)}
                  disabled={deletingId === notification.id}
                  className="absolute top-2 right-2 p-1.5 rounded-lg md:opacity-0 md:group-hover:opacity-100 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                  title="Delete notification"
                >
                  {deletingId === notification.id ? (
                    <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
