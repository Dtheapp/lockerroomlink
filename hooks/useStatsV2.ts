/**
 * Stats Engine v2.0 - React Hooks
 * 
 * Custom hooks for accessing and managing stats data in components.
 * 
 * Created: December 21, 2025
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  getGameStats,
  getGameStatsByTeam,
  getPlayerGameStats,
  getPlayerSeasonStats,
  getTeamSeasonStats,
  getPlayerCareerStats,
  getPlayerGameLog,
  getSeasonStatLeaders,
  aggregateGameStats,
  getPlayerSeasonGameStats,
} from '../services/statsServiceV2';
import {
  getStatSchema,
  getQuickStatKeys,
  getLeaderboardStatKeys,
  getStatDefinition,
  calculateDerivedStats,
} from '../config/statSchemas';
import type {
  GameStatV2,
  SeasonStatV2,
  CareerStatV2,
  GameLogEntryV2,
  StatLeaderV2,
  SportType,
} from '../types';

// =============================================================================
// useGameStats - Get all stats for a specific game
// =============================================================================

interface UseGameStatsResult {
  stats: GameStatV2[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useGameStats(
  programId: string | undefined,
  seasonId: string | undefined,
  gameId: string | undefined
): UseGameStatsResult {
  const [stats, setStats] = useState<GameStatV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (!programId || !seasonId || !gameId) {
      setStats([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getGameStats(programId, seasonId, gameId);
      setStats(data);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching game stats:', err);
    } finally {
      setLoading(false);
    }
  }, [programId, seasonId, gameId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

// =============================================================================
// useTeamGameStats - Get stats for a specific team in a game
// =============================================================================

export function useTeamGameStats(
  programId: string | undefined,
  seasonId: string | undefined,
  gameId: string | undefined,
  teamId: string | undefined
): UseGameStatsResult {
  const [stats, setStats] = useState<GameStatV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (!programId || !seasonId || !gameId || !teamId) {
      setStats([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getGameStatsByTeam(programId, seasonId, gameId, teamId);
      setStats(data);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching team game stats:', err);
    } finally {
      setLoading(false);
    }
  }, [programId, seasonId, gameId, teamId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

// =============================================================================
// usePlayerStats - Get all stats data for a single player
// =============================================================================

interface UsePlayerStatsResult {
  seasonStats: SeasonStatV2 | null;
  careerStats: CareerStatV2 | null;
  gameLog: GameLogEntryV2[];
  loading: boolean;
  error: Error | null;
}

export function usePlayerStats(
  playerId: string | undefined,
  globalPlayerId: string | undefined,
  programId: string | undefined,
  seasonId: string | undefined,
  sport: SportType | undefined
): UsePlayerStatsResult {
  const [seasonStats, setSeasonStats] = useState<SeasonStatV2 | null>(null);
  const [careerStats, setCareerStats] = useState<CareerStatV2 | null>(null);
  const [gameLog, setGameLog] = useState<GameLogEntryV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!playerId || !sport) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch season stats if we have program/season context
        if (programId && seasonId) {
          const season = await getPlayerSeasonStats(programId, seasonId, playerId);
          setSeasonStats(season);
        }

        // Fetch career stats and game log if we have global player ID
        if (globalPlayerId) {
          const [career, log] = await Promise.all([
            getPlayerCareerStats(globalPlayerId, sport),
            getPlayerGameLog(globalPlayerId, sport, 50),
          ]);
          setCareerStats(career);
          setGameLog(log);
        }
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching player stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [playerId, globalPlayerId, programId, seasonId, sport]);

  return { seasonStats, careerStats, gameLog, loading, error };
}

// =============================================================================
// useTeamStats - Get season stats for an entire team
// =============================================================================

interface UseTeamStatsResult {
  playerStats: SeasonStatV2[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useTeamStats(
  programId: string | undefined,
  seasonId: string | undefined,
  teamId: string | undefined
): UseTeamStatsResult {
  const [playerStats, setPlayerStats] = useState<SeasonStatV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (!programId || !seasonId || !teamId) {
      setPlayerStats([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const stats = await getTeamSeasonStats(programId, seasonId, teamId);
      setPlayerStats(stats);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching team stats:', err);
    } finally {
      setLoading(false);
    }
  }, [programId, seasonId, teamId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { playerStats, loading, error, refetch: fetchStats };
}

// =============================================================================
// useStatLeaders - Get stat leaders for a program/season
// =============================================================================

interface UseStatLeadersResult {
  leaders: StatLeaderV2[];
  loading: boolean;
  error: Error | null;
}

export function useStatLeaders(
  programId: string | undefined,
  seasonId: string | undefined,
  statKey: string,
  limitCount: number = 10
): UseStatLeadersResult {
  const [leaders, setLeaders] = useState<StatLeaderV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchLeaders = async () => {
      if (!programId || !seasonId || !statKey) {
        setLeaders([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getSeasonStatLeaders(programId, seasonId, statKey, limitCount);
        setLeaders(data);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching stat leaders:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaders();
  }, [programId, seasonId, statKey, limitCount]);

  return { leaders, loading, error };
}

// =============================================================================
// useQuickStats - Get formatted quick stats for display
// =============================================================================

interface QuickStat {
  key: string;
  label: string;
  shortLabel: string;
  value: number;
  formattedValue: string;
}

export function useQuickStats(
  stats: Record<string, number> | undefined,
  sport: SportType | undefined
): QuickStat[] {
  return useMemo(() => {
    if (!stats || !sport) return [];

    const quickStatKeys = getQuickStatKeys(sport);
    
    return quickStatKeys.map(key => {
      const def = getStatDefinition(sport, key);
      const value = stats[key] || 0;
      
      return {
        key,
        label: def?.label || key,
        shortLabel: def?.shortLabel || key,
        value,
        formattedValue: def?.type === 'percentage' ? `${value}%` : value.toString(),
      };
    }).filter(s => s.value > 0); // Only show stats with values
  }, [stats, sport]);
}

// =============================================================================
// useStatSchema - Get stat configuration for a sport
// =============================================================================

export function useStatSchema(sport: SportType | undefined) {
  return useMemo(() => {
    if (!sport) return null;
    return getStatSchema(sport);
  }, [sport]);
}

// =============================================================================
// useLiveGameStats - Real-time stats subscription (for live games)
// =============================================================================

interface UseLiveGameStatsResult {
  stats: GameStatV2[];
  loading: boolean;
  error: Error | null;
}

export function useLiveGameStats(
  programId: string | undefined,
  seasonId: string | undefined,
  gameId: string | undefined
): UseLiveGameStatsResult {
  const [stats, setStats] = useState<GameStatV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!programId || !seasonId || !gameId) {
      setStats([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const path = `programs/${programId}/seasons/${seasonId}/games/${gameId}/stats`;
    const q = query(collection(db, path));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GameStatV2));
        setStats(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
        console.error('Error in live stats subscription:', err);
      }
    );

    return () => unsubscribe();
  }, [programId, seasonId, gameId]);

  return { stats, loading, error };
}

// =============================================================================
// usePlayerGameHistory - Get all games and stats for a player in a season
// =============================================================================

interface UsePlayerGameHistoryResult {
  games: GameStatV2[];
  aggregated: {
    totals: Record<string, number>;
    averages: Record<string, number>;
    highs: Record<string, number>;
    gamesPlayed: number;
  } | null;
  loading: boolean;
  error: Error | null;
}

export function usePlayerGameHistory(
  programId: string | undefined,
  seasonId: string | undefined,
  playerId: string | undefined
): UsePlayerGameHistoryResult {
  const [games, setGames] = useState<GameStatV2[]>([]);
  const [aggregated, setAggregated] = useState<UsePlayerGameHistoryResult['aggregated']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!programId || !seasonId || !playerId) {
        setGames([]);
        setAggregated(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const gameStats = await getPlayerSeasonGameStats(programId, seasonId, playerId);
        setGames(gameStats);
        
        // Calculate aggregated stats
        if (gameStats.length > 0) {
          setAggregated(aggregateGameStats(gameStats));
        } else {
          setAggregated(null);
        }
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching player game history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [programId, seasonId, playerId]);

  return { games, aggregated, loading, error };
}
