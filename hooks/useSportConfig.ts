/**
 * useSportConfig Hook
 * 
 * React hook for accessing sport configuration throughout the app.
 * Automatically gets sport from team context when available.
 */

import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getSportConfig, 
  getPositions, 
  getStats, 
  hasFeature, 
  getLabel,
  getSportOptions,
  getPositionLabel,
  type SportConfig,
  type PositionConfig,
  type StatConfig,
} from '../config/sportConfig';
import type { SportType } from '../types';

interface UseSportConfigReturn {
  sport: SportType;
  config: SportConfig;
  positions: PositionConfig[];
  stats: StatConfig[];
  hasPlaybook: boolean;
  hasStatsTracking: boolean;
  hasLivestream: boolean;
  getLabel: (concept: 'game' | 'practice' | 'season' | 'play' | 'playbook') => string;
  getPositionLabel: (positionValue: string) => string;
  sportOptions: { value: SportType; label: string; emoji: string }[];
}

/**
 * Hook to get sport configuration for the current team or a specific sport
 */
export function useSportConfig(overrideSport?: SportType): UseSportConfigReturn {
  const { teamData } = useAuth();
  
  // Determine which sport to use
  const sport: SportType = overrideSport || teamData?.sport || 'football';
  
  // Memoize the config to avoid unnecessary recalculations
  const config = useMemo(() => getSportConfig(sport), [sport]);
  const positions = useMemo(() => getPositions(sport), [sport]);
  const stats = useMemo(() => getStats(sport), [sport]);
  const sportOptions = useMemo(() => getSportOptions(), []);
  
  return {
    sport,
    config,
    positions,
    stats,
    hasPlaybook: hasFeature(sport, 'playbook'),
    hasStatsTracking: hasFeature(sport, 'statsTracking'),
    hasLivestream: hasFeature(sport, 'livestream'),
    getLabel: (concept) => getLabel(sport, concept),
    getPositionLabel: (positionValue) => getPositionLabel(sport, positionValue),
    sportOptions,
  };
}

export default useSportConfig;
