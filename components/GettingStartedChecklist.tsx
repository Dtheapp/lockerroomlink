import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSportConfig } from '../hooks/useSportConfig';
import { trackOnboarding } from '../services/analytics';
import { 
  CheckCircle2, 
  Circle, 
  Users, 
  Calendar, 
  MessageCircle, 
  Video,
  ClipboardList,
  ChevronRight,
  Sparkles,
  X
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  completed: boolean;
  coachOnly?: boolean;
  requiresPlaybook?: boolean;
}

interface GettingStartedChecklistProps {
  onDismiss?: () => void;
  compact?: boolean;
}

const GettingStartedChecklist: React.FC<GettingStartedChecklistProps> = ({ onDismiss, compact = false }) => {
  const navigate = useNavigate();
  const { teamData, userData } = useAuth();
  const { theme } = useTheme();
  const { hasPlaybook, getLabel } = useSportConfig();

  const [loading, setLoading] = useState(true);
  const [completionStatus, setCompletionStatus] = useState({
    hasPlayers: false,
    hasEvents: false,
    hasChats: false,
    hasVideos: false,
    hasPlays: false,
  });

  const isCoach = userData?.role === 'Coach';

  // Check completion status
  useEffect(() => {
    const checkCompletion = async () => {
      if (!teamData?.id) {
        setLoading(false);
        return;
      }

      try {
        const teamId = teamData.id;

        // Check for players
        const playersQuery = query(
          collection(db, 'teams', teamId, 'roster'),
          limit(1)
        );
        const playersSnap = await getDocs(playersQuery);
        const hasPlayers = !playersSnap.empty;

        // Check for events
        const eventsQuery = query(
          collection(db, 'events'),
          where('teamId', '==', teamId),
          limit(1)
        );
        const eventsSnap = await getDocs(eventsQuery);
        const hasEvents = !eventsSnap.empty;

        // Check for chat messages
        const chatsQuery = query(
          collection(db, 'teams', teamId, 'chats'),
          limit(1)
        );
        const chatsSnap = await getDocs(chatsQuery);
        const hasChats = !chatsSnap.empty;

        // Check for videos
        const videosQuery = query(
          collection(db, 'teams', teamId, 'videos'),
          limit(1)
        );
        const videosSnap = await getDocs(videosQuery);
        const hasVideos = !videosSnap.empty;

        // Check for plays (if playbook enabled)
        let hasPlays = false;
        if (hasPlaybook) {
          const playsQuery = query(
            collection(db, 'teams', teamId, 'plays'),
            limit(1)
          );
          const playsSnap = await getDocs(playsQuery);
          hasPlays = !playsSnap.empty;
        }

        setCompletionStatus({
          hasPlayers,
          hasEvents,
          hasChats,
          hasVideos,
          hasPlays,
        });
      } catch (error) {
        console.error('Error checking checklist completion:', error);
      } finally {
        setLoading(false);
      }
    };

    checkCompletion();
  }, [teamData?.id, hasPlaybook]);

  // Build checklist items
  const checklistItems: ChecklistItem[] = useMemo(() => {
    const items: ChecklistItem[] = [
      {
        id: 'roster',
        label: 'Add a player',
        description: 'Build your roster with player info and photos',
        icon: <Users className="w-5 h-5" />,
        path: '/roster',
        completed: completionStatus.hasPlayers,
        coachOnly: true,
      },
      {
        id: 'event',
        label: 'Create an event',
        description: `Schedule a ${getLabel('practice').toLowerCase()} or ${getLabel('game').toLowerCase()}`,
        icon: <Calendar className="w-5 h-5" />,
        path: '/events/create',
        completed: completionStatus.hasEvents,
        coachOnly: true,
      },
      {
        id: 'chat',
        label: 'Send a team message',
        description: 'Welcome your team in the team chat',
        icon: <MessageCircle className="w-5 h-5" />,
        path: '/chat',
        completed: completionStatus.hasChats,
      },
      {
        id: 'video',
        label: 'Add a video',
        description: 'Upload game film or highlight videos',
        icon: <Video className="w-5 h-5" />,
        path: '/videos',
        completed: completionStatus.hasVideos,
        coachOnly: true,
      },
    ];

    // Add playbook item if sport supports it
    if (hasPlaybook) {
      items.push({
        id: 'playbook',
        label: `Create a ${getLabel('play').toLowerCase()}`,
        description: `Design your first ${getLabel('play').toLowerCase()} in the ${getLabel('playbook').toLowerCase()}`,
        icon: <ClipboardList className="w-5 h-5" />,
        path: '/playbook',
        completed: completionStatus.hasPlays,
        coachOnly: true,
        requiresPlaybook: true,
      });
    }

    // Filter based on role
    return items.filter(item => {
      if (item.coachOnly && !isCoach) return false;
      return true;
    });
  }, [completionStatus, hasPlaybook, getLabel, isCoach]);

  const completedCount = checklistItems.filter(item => item.completed).length;
  const totalCount = checklistItems.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allComplete = completedCount === totalCount;

  // Track completion status changes
  const prevCompletedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    checklistItems.forEach(item => {
      if (item.completed && !prevCompletedRef.current.has(item.id)) {
        trackOnboarding.taskCompleted(item.id);
        prevCompletedRef.current.add(item.id);
      }
    });
    
    // Track all tasks completed
    if (allComplete && totalCount > 0 && prevCompletedRef.current.size === totalCount) {
      trackOnboarding.allTasksCompleted(0);
    }
  }, [checklistItems, allComplete, totalCount]);

  // Track checklist viewed
  useEffect(() => {
    trackOnboarding.checklistViewed();
  }, []);

  // Don't show if all complete or dismissed
  const isDismissed = localStorage.getItem(`osys_checklist_dismissed_${userData?.uid}`) === 'true';

  const handleDismiss = () => {
    localStorage.setItem(`osys_checklist_dismissed_${userData?.uid}`, 'true');
    onDismiss?.();
  };

  const handleItemClick = (path: string) => {
    navigate(path);
  };

  if (loading) {
    return null;
  }

  // If dismissed and all complete, don't show
  if (isDismissed && allComplete) {
    return null;
  }

  // Compact version for dashboard widget
  if (compact) {
    return (
      <div className={`rounded-xl border p-4 ${
        theme === 'dark' 
          ? 'bg-zinc-900 border-zinc-800' 
          : 'bg-white border-zinc-200'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-zinc-900 dark:text-white">Getting Started</h3>
          </div>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {completedCount}/{totalCount}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full mb-4 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Next incomplete item */}
        {!allComplete && (
          <div className="space-y-2">
            {checklistItems
              .filter(item => !item.completed)
              .slice(0, 2)
              .map(item => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.path)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                    theme === 'dark'
                      ? 'bg-zinc-800 hover:bg-zinc-700'
                      : 'bg-zinc-50 hover:bg-zinc-100'
                  }`}
                >
                  <div className="text-orange-500">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                      {item.label}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>
              ))}
          </div>
        )}

        {allComplete && (
          <div className="text-center py-2">
            <p className="text-green-600 dark:text-green-400 font-medium flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              All set! You're ready to go.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Full version
  return (
    <div className={`rounded-2xl border overflow-hidden ${
      theme === 'dark' 
        ? 'bg-zinc-900 border-zinc-800' 
        : 'bg-white border-zinc-200 shadow-lg'
    }`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8 text-white" />
          <div>
            <h2 className="text-xl font-bold text-white">Getting Started</h2>
            <p className="text-white/80 text-sm">Complete these steps to set up your team</p>
          </div>
        </div>
        
        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-white/90 text-sm mb-2">
            <span>{completedCount} of {totalCount} complete</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-2 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="p-4 space-y-2">
        {checklistItems.map(item => (
          <button
            key={item.id}
            onClick={() => !item.completed && handleItemClick(item.path)}
            disabled={item.completed}
            className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left ${
              item.completed
                ? theme === 'dark'
                  ? 'bg-green-900/20 border border-green-800/50'
                  : 'bg-green-50 border border-green-200'
                : theme === 'dark'
                  ? 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-orange-500/50'
                  : 'bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 hover:border-orange-500/50'
            }`}
          >
            {/* Checkbox */}
            <div className={`flex-shrink-0 ${
              item.completed ? 'text-green-500' : 'text-zinc-400'
            }`}>
              {item.completed ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <Circle className="w-6 h-6" />
              )}
            </div>

            {/* Icon */}
            <div className={`flex-shrink-0 p-2 rounded-lg ${
              item.completed
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
            }`}>
              {item.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`font-medium ${
                item.completed
                  ? 'text-green-700 dark:text-green-300 line-through'
                  : 'text-zinc-900 dark:text-white'
              }`}>
                {item.label}
              </p>
              <p className={`text-sm ${
                item.completed
                  ? 'text-green-600/70 dark:text-green-400/70'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}>
                {item.description}
              </p>
            </div>

            {/* Arrow for incomplete items */}
            {!item.completed && (
              <ChevronRight className="w-5 h-5 text-zinc-400 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Complete message */}
      {allComplete && (
        <div className="px-4 pb-4">
          <div className={`p-4 rounded-xl text-center ${
            theme === 'dark' 
              ? 'bg-green-900/20 border border-green-800/50' 
              : 'bg-green-50 border border-green-200'
          }`}>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-green-700 dark:text-green-300">
              🎉 You're all set!
            </p>
            <p className="text-sm text-green-600/80 dark:text-green-400/80">
              Your team is ready to go. Keep exploring OSYS!
            </p>
            <button
              onClick={handleDismiss}
              className="mt-3 text-sm text-green-600 dark:text-green-400 hover:underline"
            >
              Dismiss this checklist
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GettingStartedChecklist;
