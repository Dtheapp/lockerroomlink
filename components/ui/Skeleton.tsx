import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// =============================================================================
// SKELETON COMPONENTS
// Reusable loading skeletons that match content layout
// =============================================================================

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Base skeleton with pulse animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', style }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <div 
      className={`animate-pulse rounded ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'} ${className}`}
      style={style}
    />
  );
};

/**
 * Text line skeleton
 */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 1, 
  className = '' 
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i}
          className={`h-4 rounded animate-pulse ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}
          style={{ width: i === lines - 1 && lines > 1 ? '70%' : '100%' }}
        />
      ))}
    </div>
  );
};

/**
 * Avatar/circle skeleton
 */
export const SkeletonAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }> = ({ 
  size = 'md',
  className = '' 
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };
  
  return (
    <div 
      className={`rounded-full animate-pulse ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'} ${sizeClasses[size]} ${className}`}
    />
  );
};

/**
 * Button skeleton
 */
export const SkeletonButton: React.FC<{ width?: string; className?: string }> = ({ 
  width = '100px',
  className = '' 
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <div 
      className={`h-10 rounded-lg animate-pulse ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'} ${className}`}
      style={{ width }}
    />
  );
};

/**
 * Card skeleton - for events, videos, posts
 */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-zinc-900' : 'bg-white';
  const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200';
  const skeletonBg = isDark ? 'bg-zinc-800' : 'bg-zinc-200';
  
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} overflow-hidden ${className}`}>
      {/* Image placeholder */}
      <div className={`h-40 animate-pulse ${skeletonBg}`} />
      
      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className={`h-5 w-3/4 rounded animate-pulse ${skeletonBg}`} />
        
        {/* Description */}
        <div className="space-y-2">
          <div className={`h-3 w-full rounded animate-pulse ${skeletonBg}`} />
          <div className={`h-3 w-5/6 rounded animate-pulse ${skeletonBg}`} />
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <div className={`h-4 w-20 rounded animate-pulse ${skeletonBg}`} />
          <div className={`h-8 w-24 rounded-lg animate-pulse ${skeletonBg}`} />
        </div>
      </div>
    </div>
  );
};

/**
 * List item skeleton - for roster, chat messages
 */
export const SkeletonListItem: React.FC<{ className?: string; showAvatar?: boolean }> = ({ 
  className = '',
  showAvatar = true 
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-zinc-900' : 'bg-white';
  const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200';
  const skeletonBg = isDark ? 'bg-zinc-800' : 'bg-zinc-200';
  
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${borderColor} ${bgColor} ${className}`}>
      {showAvatar && (
        <div className={`w-10 h-10 rounded-full animate-pulse ${skeletonBg}`} />
      )}
      <div className="flex-1 space-y-2">
        <div className={`h-4 w-1/3 rounded animate-pulse ${skeletonBg}`} />
        <div className={`h-3 w-2/3 rounded animate-pulse ${skeletonBg}`} />
      </div>
      <div className={`h-4 w-12 rounded animate-pulse ${skeletonBg}`} />
    </div>
  );
};

/**
 * Table row skeleton - for stats
 */
export const SkeletonTableRow: React.FC<{ columns?: number; className?: string }> = ({ 
  columns = 5,
  className = '' 
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200';
  const skeletonBg = isDark ? 'bg-zinc-800' : 'bg-zinc-200';
  
  return (
    <tr className={`border-b ${borderColor} ${className}`}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-3">
          <div 
            className={`h-4 rounded animate-pulse ${skeletonBg}`}
            style={{ width: i === 0 ? '120px' : '60px' }}
          />
        </td>
      ))}
    </tr>
  );
};

/**
 * Stats card skeleton
 */
export const SkeletonStatsCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-zinc-900' : 'bg-white';
  const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200';
  const skeletonBg = isDark ? 'bg-zinc-800' : 'bg-zinc-200';
  
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4 ${className}`}>
      <div className={`h-3 w-20 mb-2 rounded animate-pulse ${skeletonBg}`} />
      <div className={`h-8 w-16 rounded animate-pulse ${skeletonBg}`} />
    </div>
  );
};

/**
 * Profile header skeleton
 */
export const SkeletonProfile: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-zinc-900' : 'bg-white';
  const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200';
  const skeletonBg = isDark ? 'bg-zinc-800' : 'bg-zinc-200';
  
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-6 ${className}`}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className={`w-20 h-20 rounded-full animate-pulse ${skeletonBg}`} />
        
        {/* Info */}
        <div className="flex-1 space-y-3">
          <div className={`h-6 w-40 rounded animate-pulse ${skeletonBg}`} />
          <div className={`h-4 w-32 rounded animate-pulse ${skeletonBg}`} />
          <div className="flex gap-4 pt-2">
            <div className={`h-4 w-20 rounded animate-pulse ${skeletonBg}`} />
            <div className={`h-4 w-20 rounded animate-pulse ${skeletonBg}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Dashboard card skeleton (for quick stats)
 */
export const SkeletonDashboardCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-zinc-900' : 'bg-white';
  const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200';
  const skeletonBg = isDark ? 'bg-zinc-800' : 'bg-zinc-200';
  
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`h-4 w-24 rounded animate-pulse ${skeletonBg}`} />
        <div className={`w-8 h-8 rounded-lg animate-pulse ${skeletonBg}`} />
      </div>
      <div className={`h-8 w-20 mb-2 rounded animate-pulse ${skeletonBg}`} />
      <div className={`h-3 w-32 rounded animate-pulse ${skeletonBg}`} />
    </div>
  );
};

/**
 * Grid of skeleton cards
 */
export const SkeletonCardGrid: React.FC<{ count?: number; columns?: number; className?: string }> = ({
  count = 6,
  columns = 3,
  className = ''
}) => {
  const colClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }[columns] || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  
  return (
    <div className={`grid ${colClass} gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};

/**
 * List of skeleton items
 */
export const SkeletonList: React.FC<{ count?: number; showAvatar?: boolean; className?: string }> = ({
  count = 5,
  showAvatar = true,
  className = ''
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListItem key={i} showAvatar={showAvatar} />
      ))}
    </div>
  );
};

export default Skeleton;
