import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  Users, 
  ClipboardList, 
  Video, 
  Calendar, 
  MessageCircle, 
  BarChart3, 
  Heart,
  Trophy,
  Ticket,
  Mail,
  Bell,
  Folder,
  Search,
  Plus,
  type LucideIcon
} from 'lucide-react';

// =============================================================================
// EMPTY STATE ILLUSTRATIONS (SVG-based for crisp rendering)
// =============================================================================

const illustrations = {
  roster: (color: string) => (
    <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Team silhouettes */}
      <circle cx="100" cy="50" r="25" fill={color} opacity="0.2" />
      <circle cx="60" cy="70" r="18" fill={color} opacity="0.15" />
      <circle cx="140" cy="70" r="18" fill={color} opacity="0.15" />
      <circle cx="40" cy="95" r="12" fill={color} opacity="0.1" />
      <circle cx="160" cy="95" r="12" fill={color} opacity="0.1" />
      {/* Jersey */}
      <path d="M85 80 L100 70 L115 80 L115 120 L85 120 Z" fill={color} opacity="0.3" />
      <text x="100" y="105" textAnchor="middle" fill={color} fontSize="20" fontWeight="bold">?</text>
      {/* Plus sign */}
      <circle cx="160" cy="120" r="15" fill={color} opacity="0.8" />
      <path d="M160 112 V128 M152 120 H168" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  
  playbook: (color: string) => (
    <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Clipboard */}
      <rect x="50" y="20" width="100" height="120" rx="8" fill={color} opacity="0.15" />
      <rect x="60" y="10" width="80" height="15" rx="4" fill={color} opacity="0.3" />
      {/* Play diagram */}
      <circle cx="80" cy="60" r="8" fill={color} opacity="0.5" />
      <circle cx="120" cy="60" r="8" fill={color} opacity="0.5" />
      <circle cx="100" cy="90" r="8" fill={color} opacity="0.5" />
      {/* Routes */}
      <path d="M80 60 Q90 75 100 90" stroke={color} strokeWidth="2" strokeDasharray="4" opacity="0.4" />
      <path d="M120 60 Q110 75 100 90" stroke={color} strokeWidth="2" strokeDasharray="4" opacity="0.4" />
      {/* Arrow */}
      <path d="M100 90 L100 120" stroke={color} strokeWidth="2" opacity="0.4" markerEnd="url(#arrow)" />
      <polygon points="100,125 95,115 105,115" fill={color} opacity="0.4" />
    </svg>
  ),
  
  videos: (color: string) => (
    <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Video frame */}
      <rect x="30" y="30" width="140" height="90" rx="8" fill={color} opacity="0.15" />
      {/* Play button */}
      <circle cx="100" cy="75" r="25" fill={color} opacity="0.3" />
      <polygon points="92,62 92,88 115,75" fill={color} opacity="0.6" />
      {/* Film reel */}
      <circle cx="50" cy="45" r="8" fill={color} opacity="0.2" />
      <circle cx="150" cy="45" r="8" fill={color} opacity="0.2" />
      <circle cx="50" cy="105" r="8" fill={color} opacity="0.2" />
      <circle cx="150" cy="105" r="8" fill={color} opacity="0.2" />
    </svg>
  ),
  
  events: (color: string) => (
    <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Calendar */}
      <rect x="40" y="30" width="120" height="100" rx="8" fill={color} opacity="0.15" />
      <rect x="40" y="30" width="120" height="25" rx="8" fill={color} opacity="0.3" />
      {/* Calendar holes */}
      <circle cx="65" cy="30" r="5" fill="white" />
      <circle cx="135" cy="30" r="5" fill="white" />
      {/* Date grid */}
      <rect x="55" y="65" width="18" height="18" rx="4" fill={color} opacity="0.1" />
      <rect x="80" y="65" width="18" height="18" rx="4" fill={color} opacity="0.1" />
      <rect x="105" y="65" width="18" height="18" rx="4" fill={color} opacity="0.1" />
      <rect x="130" y="65" width="18" height="18" rx="4" fill={color} opacity="0.1" />
      <rect x="55" y="90" width="18" height="18" rx="4" fill={color} opacity="0.1" />
      <rect x="80" y="90" width="18" height="18" rx="4" fill={color} opacity="0.5" />
      <text x="89" y="104" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">+</text>
    </svg>
  ),
  
  chat: (color: string) => (
    <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Chat bubbles */}
      <rect x="30" y="30" width="100" height="40" rx="20" fill={color} opacity="0.2" />
      <polygon points="50,70 60,85 70,70" fill={color} opacity="0.2" />
      <rect x="70" y="80" width="100" height="40" rx="20" fill={color} opacity="0.3" />
      <polygon points="150,120 140,135 130,120" fill={color} opacity="0.3" />
      {/* Dots */}
      <circle cx="60" cy="50" r="4" fill={color} opacity="0.4" />
      <circle cx="80" cy="50" r="4" fill={color} opacity="0.4" />
      <circle cx="100" cy="50" r="4" fill={color} opacity="0.4" />
    </svg>
  ),
  
  stats: (color: string) => (
    <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Bar chart */}
      <rect x="40" y="90" width="25" height="40" rx="4" fill={color} opacity="0.2" />
      <rect x="75" y="60" width="25" height="70" rx="4" fill={color} opacity="0.3" />
      <rect x="110" y="40" width="25" height="90" rx="4" fill={color} opacity="0.4" />
      <rect x="145" y="70" width="25" height="60" rx="4" fill={color} opacity="0.25" />
      {/* Trend line */}
      <path d="M52 85 L87 55 L122 35 L157 65" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      {/* Baseline */}
      <line x1="30" y1="130" x2="180" y2="130" stroke={color} opacity="0.2" strokeWidth="2" />
    </svg>
  ),
  
  fans: (color: string) => (
    <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Heart */}
      <path d="M100 120 C60 90 40 60 70 40 C90 30 100 50 100 50 C100 50 110 30 130 40 C160 60 140 90 100 120" fill={color} opacity="0.3" />
      {/* Stars around */}
      <polygon points="50,30 53,40 63,40 55,47 58,57 50,50 42,57 45,47 37,40 47,40" fill={color} opacity="0.2" />
      <polygon points="150,30 153,40 163,40 155,47 158,57 150,50 142,57 145,47 137,40 147,40" fill={color} opacity="0.2" />
      <polygon points="170,80 172,86 178,86 173,90 175,96 170,92 165,96 167,90 162,86 168,86" fill={color} opacity="0.15" />
      <polygon points="30,80 32,86 38,86 33,90 35,96 30,92 25,96 27,90 22,86 28,86" fill={color} opacity="0.15" />
    </svg>
  ),
  
  tickets: (color: string) => (
    <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Ticket shape */}
      <path d="M30 50 L30 45 C30 40 35 35 40 35 L160 35 C165 35 170 40 170 45 L170 50 C160 50 155 60 155 70 C155 80 160 90 170 90 L170 105 C170 110 165 115 160 115 L40 115 C35 115 30 110 30 105 L30 90 C40 90 45 80 45 70 C45 60 40 50 30 50" fill={color} opacity="0.2" />
      {/* Perforated line */}
      <line x1="120" y1="40" x2="120" y2="110" stroke={color} strokeWidth="2" strokeDasharray="5,5" opacity="0.3" />
      {/* QR code placeholder */}
      <rect x="130" y="55" width="30" height="30" rx="4" fill={color} opacity="0.3" />
      {/* Text lines */}
      <rect x="45" y="50" width="60" height="8" rx="2" fill={color} opacity="0.3" />
      <rect x="45" y="65" width="45" height="6" rx="2" fill={color} opacity="0.2" />
      <rect x="45" y="80" width="55" height="6" rx="2" fill={color} opacity="0.2" />
    </svg>
  ),
  
  search: (color: string) => (
    <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Magnifying glass */}
      <circle cx="85" cy="65" r="35" stroke={color} strokeWidth="6" opacity="0.3" fill="none" />
      <line x1="110" y1="90" x2="150" y2="130" stroke={color} strokeWidth="8" strokeLinecap="round" opacity="0.3" />
      {/* Question mark inside */}
      <text x="85" y="75" textAnchor="middle" fill={color} fontSize="30" fontWeight="bold" opacity="0.4">?</text>
    </svg>
  ),
  
  generic: (color: string) => (
    <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Folder */}
      <path d="M30 50 L30 120 C30 125 35 130 40 130 L160 130 C165 130 170 125 170 120 L170 50 C170 45 165 40 160 40 L100 40 L90 25 L40 25 C35 25 30 30 30 35 L30 50" fill={color} opacity="0.2" />
      {/* Plus sign */}
      <circle cx="100" cy="85" r="20" fill={color} opacity="0.3" />
      <path d="M100 75 V95 M90 85 H110" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
};

// =============================================================================
// TYPES
// =============================================================================

export type EmptyStateType = 
  | 'roster' 
  | 'playbook' 
  | 'videos' 
  | 'events' 
  | 'chat' 
  | 'stats' 
  | 'fans' 
  | 'tickets' 
  | 'search' 
  | 'generic';

interface EmptyStateProps {
  type: EmptyStateType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  icon?: LucideIcon;
  compact?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  icon: CustomIcon,
  compact = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Theme-aware colors
  const primaryColor = '#f97316'; // Orange-500
  const bgColor = isDark ? 'bg-zinc-900/50' : 'bg-zinc-50';
  const textColor = isDark ? 'text-zinc-100' : 'text-zinc-900';
  const subtextColor = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200';
  
  const IllustrationComponent = illustrations[type] || illustrations.generic;
  
  if (compact) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 px-4 ${bgColor} rounded-xl border ${borderColor}`}>
        <div className="w-24 h-24 mb-4">
          {IllustrationComponent(primaryColor)}
        </div>
        <h3 className={`text-lg font-semibold ${textColor} mb-1`}>{title}</h3>
        <p className={`text-sm ${subtextColor} text-center mb-4 max-w-xs`}>{description}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {actionLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 ${bgColor} rounded-2xl border ${borderColor}`}>
      {/* Illustration */}
      <div className="w-48 h-36 mb-6">
        {IllustrationComponent(primaryColor)}
      </div>
      
      {/* Title */}
      <h2 className={`text-2xl font-bold ${textColor} mb-2 text-center`}>
        {title}
      </h2>
      
      {/* Description */}
      <p className={`text-base ${subtextColor} text-center mb-6 max-w-md leading-relaxed`}>
        {description}
      </p>
      
      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-all hover:scale-105 shadow-lg shadow-orange-500/25"
          >
            <Plus className="w-5 h-5" />
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
              isDark 
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' 
                : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
            }`}
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
