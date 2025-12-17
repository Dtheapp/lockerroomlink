/**
 * OSYS Notification Bell Component
 * Simple bell icon that links to notifications page with unread badge
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToNotifications } from '../../services/notificationService';
import { Bell, BellRing } from 'lucide-react';

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToNotifications(user.uid, (notifs) => {
      setUnreadCount(notifs.filter((n) => !n.read).length);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  return (
    <Link
      to="/notifications"
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
      aria-label="Notifications"
    >
      {unreadCount > 0 ? (
        <BellRing className="w-6 h-6 text-purple-600 dark:text-orange-400" />
      ) : (
        <Bell className="w-6 h-6 text-slate-500 dark:text-slate-400" />
      )}
      
      {/* Unread Badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
};

export default NotificationBell;
