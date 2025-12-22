/**
 * Team Search Service
 * 
 * Searches for teams across the entire system for scheduling purposes.
 * Supports filtering by sport, age group, and excludes teams in leagues.
 */

import { db } from './firebase';
import { collection, query, where, getDocs, limit as firestoreLimit } from 'firebase/firestore';
import type { Team, SportType } from '../types';

export interface TeamSearchResult {
  id: string;
  name: string;
  ageGroup: string;
  sport?: SportType;
  programId?: string;
  programName?: string;
  logoUrl?: string;
  primaryColor?: string;
  city?: string;
  state?: string;
  record?: {
    wins: number;
    losses: number;
    ties: number;
  };
  // League status
  isInLeague: boolean;
  leagueId?: string;
  leagueName?: string;
  // Whether this team can be selected as opponent
  selectable: boolean;
  selectableReason?: string; // If not selectable, why
}

export interface TeamSearchOptions {
  sport?: SportType;
  ageGroup?: string;
  excludeTeamIds?: string[];      // Exclude specific teams (e.g., the team being scheduled)
  excludeProgramId?: string;       // Optional: exclude teams from same program
  includeProgramId?: string;       // Only include teams from this program (for internal games)
  searchQuery?: string;            // Text search on team name
  limit?: number;                  // Max results
  includeLeagueTeams?: boolean;    // Whether to include teams in leagues (default: true, but marked as non-selectable)
}

/**
 * Search for teams across the system
 */
export async function searchTeams(options: TeamSearchOptions): Promise<TeamSearchResult[]> {
  const {
    sport,
    ageGroup,
    excludeTeamIds = [],
    excludeProgramId,
    includeProgramId,
    searchQuery,
    limit = 50,
    includeLeagueTeams = true
  } = options;

  try {
    // Build query constraints
    const constraints: any[] = [];
    
    // Filter by sport if specified
    if (sport) {
      constraints.push(where('sport', '==', sport));
    }
    
    // Filter by age group if specified
    if (ageGroup) {
      constraints.push(where('ageGroup', '==', ageGroup));
    }
    
    // Filter by program if specified
    if (includeProgramId) {
      constraints.push(where('programId', '==', includeProgramId));
    }
    
    // Limit results
    constraints.push(firestoreLimit(limit * 2)); // Fetch more to account for filtering
    
    const teamsQuery = query(collection(db, 'teams'), ...constraints);
    const snapshot = await getDocs(teamsQuery);
    
    const results: TeamSearchResult[] = [];
    
    snapshot.docs.forEach(doc => {
      const team = { id: doc.id, ...doc.data() } as Team;
      
      // Skip teams without name or age group
      if (!team.name || !team.ageGroup) return;
      
      // Skip excluded teams
      if (excludeTeamIds.includes(team.id)) return;
      
      // Skip teams from excluded program (if specified)
      if (excludeProgramId && team.programId === excludeProgramId) return;
      
      // Skip league teams if not including them
      if (!includeLeagueTeams && team.leagueId) return;
      
      // Apply text search filter if provided
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const nameMatches = team.name.toLowerCase().includes(searchLower);
        const programMatches = team.programName?.toLowerCase().includes(searchLower);
        const cityMatches = team.city?.toLowerCase().includes(searchLower);
        
        if (!nameMatches && !programMatches && !cityMatches) return;
      }
      
      // Determine if team is selectable
      const isInLeague = !!team.leagueId;
      let selectable = true;
      let selectableReason: string | undefined;
      
      if (isInLeague) {
        selectable = false;
        selectableReason = `In league: ${team.leagueName || 'League'}`;
      }
      
      results.push({
        id: team.id,
        name: team.name,
        ageGroup: team.ageGroup,
        sport: team.sport,
        programId: team.programId,
        programName: team.programName,
        logoUrl: team.logo,
        primaryColor: team.primaryColor || team.color,
        city: team.city || team.location?.city,
        state: team.state || team.location?.state,
        record: team.record,
        isInLeague,
        leagueId: team.leagueId,
        leagueName: team.leagueName,
        selectable,
        selectableReason
      });
    });
    
    // Sort: selectable teams first, then by name
    results.sort((a, b) => {
      if (a.selectable && !b.selectable) return -1;
      if (!a.selectable && b.selectable) return 1;
      return a.name.localeCompare(b.name);
    });
    
    // Limit final results
    return results.slice(0, limit);
    
  } catch (error) {
    console.error('[teamSearchService] Error searching teams:', error);
    return [];
  }
}

/**
 * Search for teams within the same program (for internal matchups)
 */
export async function searchProgramTeams(
  programId: string,
  ageGroup: string,
  excludeTeamId?: string
): Promise<TeamSearchResult[]> {
  return searchTeams({
    includeProgramId: programId,
    ageGroup,
    excludeTeamIds: excludeTeamId ? [excludeTeamId] : [],
    limit: 30
  });
}

/**
 * Search for teams outside the program (for external games)
 */
export async function searchExternalTeams(
  sport: SportType,
  ageGroup: string,
  excludeProgramId: string,
  searchQuery?: string
): Promise<TeamSearchResult[]> {
  return searchTeams({
    sport,
    ageGroup,
    excludeProgramId,
    searchQuery,
    limit: 30,
    includeLeagueTeams: true // Show them but mark as non-selectable
  });
}

/**
 * Get a specific team by ID for display
 */
export async function getTeamForScheduling(teamId: string): Promise<TeamSearchResult | null> {
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const teamDoc = await getDoc(doc(db, 'teams', teamId));
    
    if (!teamDoc.exists()) return null;
    
    const team = { id: teamDoc.id, ...teamDoc.data() } as Team;
    
    const isInLeague = !!team.leagueId;
    
    return {
      id: team.id,
      name: team.name || 'Unknown Team',
      ageGroup: team.ageGroup || '',
      sport: team.sport,
      programId: team.programId,
      programName: team.programName,
      logoUrl: team.logo,
      primaryColor: team.primaryColor || team.color,
      city: team.city || team.location?.city,
      state: team.state || team.location?.state,
      record: team.record,
      isInLeague,
      leagueId: team.leagueId,
      leagueName: team.leagueName,
      selectable: !isInLeague,
      selectableReason: isInLeague ? `In league: ${team.leagueName || 'League'}` : undefined
    };
    
  } catch (error) {
    console.error('[teamSearchService] Error getting team:', error);
    return null;
  }
}
