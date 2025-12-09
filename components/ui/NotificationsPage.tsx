/**
 * OSYS Notifications Page
 * Full page view for all notifications
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'assignment_request':
    case 'assignment_confirmed':
    case 'assignment_declined':
    case 'assignment_cancelled':
      return Calendar;
    case 'verification_approved':
    case 'verification_rejected':
      return Shield;
    case 'rating_received':
      return Star;
    case 'payment_received':
      return DollarSign;
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
    case 'assignment_confirmed':
    case 'verification_approved':
    case 'payment_received':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'assignment_declined':
    case 'verification_rejected':
    case 'assignment_cancelled':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'assignment_request':
    case 'game_reminder':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'rating_received':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
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
        </div>
      </div>

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
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full p-4 rounded-xl border transition-all text-left ${
                  notification.read
                    ? 'bg-white/5 border-white/10 hover:border-white/20'
                    : 'bg-purple-500/10 border-purple-500/30 hover:border-purple-500/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg border ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
