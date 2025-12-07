import { useTheme } from '../contexts/ThemeContext';

/**
 * Theme-aware color classes for OSYS design system
 * 
 * Light mode: Purple/Indigo tones
 * Dark mode: Orange/Amber tones
 * 
 * Usage:
 * const colors = useThemeColors();
 * <button className={colors.primaryButton}>Click me</button>
 */
export const useThemeColors = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return {
    // Primary Button
    primaryButton: isDark
      ? 'bg-orange-600 hover:bg-orange-500 text-white'
      : 'bg-purple-600 hover:bg-purple-700 text-white',
    
    // Primary Button with shadow
    primaryButtonShadow: isDark
      ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/30'
      : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/30',

    // Secondary/Ghost Button
    secondaryButton: isDark
      ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
      : 'bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-300',

    // Primary Text
    primaryText: isDark ? 'text-orange-500' : 'text-purple-600',
    primaryTextHover: isDark ? 'hover:text-orange-400' : 'hover:text-purple-500',

    // Primary Background (subtle)
    primaryBg: isDark ? 'bg-orange-500/10' : 'bg-purple-500/10',
    primaryBgHover: isDark ? 'hover:bg-orange-500/20' : 'hover:bg-purple-500/20',

    // Primary Border
    primaryBorder: isDark ? 'border-orange-500' : 'border-purple-600',
    primaryBorderLight: isDark ? 'border-orange-500/30' : 'border-purple-500/30',

    // Ring/Focus
    primaryRing: isDark ? 'ring-orange-500' : 'ring-purple-500',
    primaryFocusRing: isDark ? 'focus:ring-orange-500' : 'focus:ring-purple-500',

    // Gradient (for badges, special elements)
    primaryGradient: isDark
      ? 'bg-gradient-to-r from-orange-600 to-amber-500'
      : 'bg-gradient-to-r from-purple-600 to-indigo-500',

    // Tab Active
    tabActive: isDark
      ? 'bg-orange-600 text-white shadow-lg'
      : 'bg-purple-600 text-white shadow-lg',
    tabInactive: isDark
      ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',

    // Card Highlight Border
    cardHighlight: isDark
      ? 'border-orange-500/30 ring-1 ring-orange-500/10'
      : 'border-purple-500/30 ring-1 ring-purple-500/10',

    // Icon color
    iconPrimary: isDark ? 'text-orange-500' : 'text-purple-600',
    iconSecondary: isDark ? 'text-orange-400' : 'text-purple-500',

    // Badge
    badge: isDark
      ? 'bg-orange-500/10 text-orange-500 border border-orange-500/30'
      : 'bg-purple-500/10 text-purple-600 border border-purple-500/30',

    // Spinner/Loader
    spinner: isDark ? 'border-orange-500' : 'border-purple-600',

    // Selected State (pills, options)
    selected: isDark
      ? 'bg-orange-600 text-white'
      : 'bg-purple-600 text-white',
    unselected: isDark
      ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
      : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300',

    // Input Focus
    inputFocus: isDark
      ? 'focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
      : 'focus:ring-2 focus:ring-purple-500 focus:border-purple-500',

    // Link
    link: isDark 
      ? 'text-orange-500 hover:text-orange-400' 
      : 'text-purple-600 hover:text-purple-500',

    // Progress Bar
    progressBar: isDark ? 'bg-orange-500' : 'bg-purple-600',
    progressBg: isDark ? 'bg-orange-500/20' : 'bg-purple-500/20',

    // Stat Highlight
    statHighlight: isDark ? 'text-orange-500' : 'text-purple-600',
    statBg: isDark ? 'bg-orange-500/10' : 'bg-purple-500/10',

    // Helper for conditional classes
    isDark,
    isLight: !isDark,
  };
};

/**
 * Simple helper to get theme-aware classes without hook
 * Usage in components that already have theme from context
 */
export const getThemeColor = (isDark: boolean, darkClass: string, lightClass: string): string => {
  return isDark ? darkClass : lightClass;
};

/**
 * Theme-aware Tailwind class mappings
 * Maps generic class names to theme-specific ones
 */
export const themeClasses = {
  'primary-btn': {
    dark: 'bg-orange-600 hover:bg-orange-500',
    light: 'bg-purple-600 hover:bg-purple-700',
  },
  'primary-text': {
    dark: 'text-orange-500',
    light: 'text-purple-600',
  },
  'primary-border': {
    dark: 'border-orange-500',
    light: 'border-purple-600',
  },
} as const;
