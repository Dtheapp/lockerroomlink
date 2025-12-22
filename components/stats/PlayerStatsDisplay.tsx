/**
 * Stats Engine v2.0 - Player Stats Display (Self-Fetching)
 * 
 * A wrapper component that fetches player stats and displays them.
 * Use this when you just have a player ID and want to show their stats.
 * 
 * Created: December 21, 2025
 */

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import PlayerQuickStats from './PlayerQuickStats';
import type { SportType, SeasonStatV2 } from '../../types';

interface PlayerStatsDisplayProps {
  // Player identification - use athleteId (global) if available, else teamPlayerId
  playerId?: string;        // Team player ID (teams/{teamId}/players/{playerId})
  athleteId?: string;       // Global athlete ID (players/{athleteId})
  // Context
  programId?: string;       // Program context
  seasonId?: string;        // Season context (optional - will find latest if not provided)
  sport: SportType;
  // Display options
  size?: 'sm' | 'md' | 'lg';
  maxStats?: number;
  className?: string;
  showLoading?: boolean;
}

const PlayerStatsDisplay: React.FC<PlayerStatsDisplayProps> = ({
  playerId,
  athleteId,
  programId,
  seasonId,
  sport,
  size = 'sm',
  maxStats = 4,
  className = '',
  showLoading = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchStats = async () => {
      // Need at least one identifier
      const effectivePlayerId = athleteId || playerId;
      if (!effectivePlayerId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      
      try {
        // Strategy 1: If we have program/season context, fetch from there
        if (programId && seasonId) {
          // Check if there's aggregated season stats for this player
          // Path: programs/{programId}/seasons/{seasonId}/playerStats/{playerId}
          // But this requires Cloud Functions to aggregate - may not exist yet
          
          // For now, aggregate from game stats directly
          const gamesRef = collection(db, 'programs', programId, 'seasons', seasonId, 'games');
          const gamesSnap = await getDocs(gamesRef);
          
          let aggregated: Record<string, number> = {};
          
          for (const gameDoc of gamesSnap.docs) {
            // Check for player stats in this game
            const statsRef = collection(db, 'programs', programId, 'seasons', seasonId, 'games', gameDoc.id, 'stats');
            const statsQuery = query(statsRef, where('playerId', '==', effectivePlayerId));
            const statsSnap = await getDocs(statsQuery);
            
            for (const statDoc of statsSnap.docs) {
              const data = statDoc.data();
              if (data.stats && typeof data.stats === 'object') {
                for (const [key, value] of Object.entries(data.stats)) {
                  if (typeof value === 'number') {
                    aggregated[key] = (aggregated[key] || 0) + value;
                  }
                }
              }
            }
          }
          
          if (Object.keys(aggregated).length > 0) {
            setStats(aggregated);
            setLoading(false);
            return;
          }
        }
        
        // Strategy 2: Check global career stats
        if (athleteId) {
          // Path: players/{athleteId}/careerStats/{sport}
          // This requires Cloud Functions to aggregate - may not exist yet
        }
        
        // No stats found
        setStats({});
      } catch (err) {
        console.error('Error fetching player stats:', err);
        setStats({});
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, [playerId, athleteId, programId, seasonId, sport]);
  
  // Show loading spinner if requested
  if (loading && showLoading) {
    return (
      <div className={`flex justify-center items-center ${className}`}>
        <div className={`w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin`} />
      </div>
    );
  }
  
  return (
    <PlayerQuickStats
      stats={stats}
      sport={sport}
      size={size}
      maxStats={maxStats}
      className={className}
    />
  );
};

export default PlayerStatsDisplay;
