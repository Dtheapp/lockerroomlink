/**
 * OSYS Notification Bell Component
 * Displays notification bell with unread count and dropdown
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type Notification,
  type NotificationType,
} from '../../services/notificationService';
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Clock,
  Shield,
  Star,
  DollarSign,
  Calendar,
  MessageCircle,
  AlertCircle,
  X,
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
  Trash2,
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
      return 'text-green-400';
    
    // Error/Warning states
    case 'assignment_declined':
    case 'verification_rejected':
    case 'assignment_cancelled':
    case 'infraction_filed':
    case 'payment_due':
    case 'payment_reminder':
      return 'text-red-400';
    
    // Action required
    case 'assignment_request':
    case 'game_reminder':
    case 'practice_reminder':
    case 'game_day':
    case 'infraction_update':
    case 'infraction_message':
    case 'registration_open':
      return 'text-yellow-400';
    
    // Special/Premium
    case 'rating_received':
    case 'nil_offer':
    case 'subscription_deal':
    case 'feature_update':
      return 'text-purple-400';
    
    // Fan engagement
    case 'new_follower':
    case 'gift_received':
    case 'fundraising_donation':
      return 'text-pink-400';
    
    // Announcements
    case 'system_announcement':
    case 'league_announcement':
    case 'team_announcement':
      return 'text-blue-400';
    
    default:
      return 'text-slate-400';
  }
};

const formatTimeAgo = (timestamp: any): string => {
  if (!timestamp) return '';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markNotificationRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
    setIsOpen(false);
  };

  const handleMarkAllRead = async () => {
    if (user?.uid) {
      await markAllNotificationsRead(user.uid);
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 text-white animate-wiggle" />
        ) : (
          <Bell className="w-5 h-5 text-slate-400" />
        )}
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                const colorClass = getNotificationColor(notification.type);
                
                return (
                  <div
                    key={notification.id}
                    className={`relative group w-full px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0 ${
                      !notification.read ? 'bg-purple-500/10' : ''
                    }`}
                  >
                    <button
                      onClick={() => handleNotificationClick(notification)}
                      className="flex items-start gap-3 flex-1 min-w-0"
                    >
                      <div className={`mt-0.5 ${colorClass}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <p className={`text-sm font-medium ${notification.read ? 'text-slate-300' : 'text-white'}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          {formatTimeAgo(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-purple-500 rounded-full mt-2" />
                      )}
                    </button>
                    
                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDeleteNotification(notification.id, e)}
                      disabled={deletingId === notification.id}
                      className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                      title="Delete"
                    >
                      {deletingId === notification.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-white/10">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/notifications');
                }}
                className="text-sm text-purple-400 hover:text-purple-300 w-full text-center"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}

      {/* Wiggle animation style */}
      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          50% { transform: rotate(10deg); }
          75% { transform: rotate(-5deg); }
        }
        .animate-wiggle {
          animation: wiggle 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default NotificationBell;
