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
    
    // Infraction notifications
    case 'infraction_filed':
    case 'infraction_update':
    case 'infraction_resolved':
    case 'infraction_message':
      return Gavel;
    
    // Registration & Payment
    case 'registration_open':
      return FileText;
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
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-500 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-slate-400 mt-1">{unreadCount} unread</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Filter Toggle */}
          <div className="flex bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'unread'
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Unread
            </button>
          </div>

          {/* Mark All Read */}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 text-sm text-purple-400 hover:text-purple-300 border border-purple-500/30 rounded-lg flex items-center gap-2"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}

          {/* Delete All */}
          {notifications.length > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete all
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
        <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
          <Bell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
          </h2>
          <p className="text-slate-400">
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
                className={`relative group w-full p-4 rounded-xl border transition-all ${
                  notification.read
                    ? 'bg-white/5 border-white/10 hover:border-white/20'
                    : 'bg-purple-500/10 border-purple-500/30 hover:border-purple-500/50'
                }`}
              >
                <button
                  onClick={() => handleNotificationClick(notification)}
                  className="w-full text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg border ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="pr-8">
                          <p className={`font-medium ${notification.read ? 'text-slate-300' : 'text-white'}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-slate-400 mt-1">
                            {notification.message}
                          </p>
                        </div>
                        
                        {!notification.read && (
                          <div className="w-3 h-3 bg-purple-500 rounded-full shrink-0 mt-1.5" />
                        )}
                      </div>
                      
                      <p className="text-xs text-slate-500 mt-2">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
                
                {/* Delete button */}
                <button
                  onClick={(e) => handleDeleteNotification(notification.id, e)}
                  disabled={deletingId === notification.id}
                  className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
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
