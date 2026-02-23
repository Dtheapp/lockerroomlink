import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc, getDoc, collectionGroup } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { setSentryUser, clearSentryUser } from '../services/sentry';
import type { UserProfile, Team, Player, League, Program, TeamManager, SportType } from '../types';

// Sport context for multi-sport support
export interface SportContext {
  sport: SportType;
  status: 'active' | 'draft_pool' | 'none';
  teamId?: string;
  teamName?: string;
  // Team-based draft pool (legacy)
  draftPoolTeamId?: string;
  draftPoolTeamName?: string;
  // Program-based draft pool (season system)
  draftPoolProgramId?: string;
  draftPoolSeasonId?: string;
  // Independent registration (new system)
  draftPoolRegistrationId?: string;
  draftPoolAgeGroup?: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserProfile | null;
  teamData: Team | null;
  loading: boolean;
  // Player management for parents
  players: Player[];
  selectedPlayer: Player | null;
  setSelectedPlayer: (player: Player) => void;
  // Multi-sport context
  sportContexts: SportContext[];
  selectedSportContext: SportContext | null;
  setSelectedSportContext: (context: SportContext | null) => void;
  // Team management for coaches with multiple teams
  coachTeams: Team[];
  setSelectedTeam: (team: Team | null) => void;
  // Coach sport context (for viewing sport-specific content without a team)
  selectedCoachSport: SportType | null;
  setSelectedCoachSport: (sport: SportType | null) => void;
  // League management for league owners
  leagueData: League | null;
  // Program management for commissioners
  programData: Program | null;
  // Helper functions for role checks
  isLeagueOwner: boolean;
  isProgramCommissioner: boolean;
  isCommissioner: boolean;
  // Team Manager sub-account support
  isTeamManager: boolean;
  teamManagerData: TeamManager | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  teamData: null,
  loading: true,
  players: [],
  selectedPlayer: null,
  setSelectedPlayer: () => {},
  sportContexts: [],
  selectedSportContext: null,
  setSelectedSportContext: () => {},
  coachTeams: [],
  setSelectedTeam: () => {},
  selectedCoachSport: null,
  setSelectedCoachSport: () => {},
  leagueData: null,
  programData: null,
  isLeagueOwner: false,
  isProgramCommissioner: false,
  isCommissioner: false,
  isTeamManager: false,
  teamManagerData: null,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [teamData, setTeamData] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Track initial load to avoid resetting user selections on doc updates
  const isInitialLoad = React.useRef(true);
  
  // Player management for parents
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayerState] = useState<Player | null>(null);
  
  // Multi-sport context - restore from localStorage, default to football
  // NOTE: We only restore the SPORT preference, not team data, to prevent cross-user contamination
  const [sportContexts, setSportContexts] = useState<SportContext[]>([]);
  const [selectedSportContext, setSelectedSportContextState] = useState<SportContext | null>(() => {
    // Restore from localStorage on mount - but only the sport, NOT the team data
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('osys_sport_context');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Only use the sport preference, reset status to 'none' to avoid cross-user team loading
          // The actual team/draft status will be computed fresh after user data loads
          return { 
            sport: (parsed.sport || 'football') as SportType, 
            status: 'none' as const 
          };
        } catch {
          // Invalid JSON, fall through to default
        }
      }
      // Default to football if nothing saved
      return { sport: 'football' as SportType, status: 'none' };
    }
    return { sport: 'football' as SportType, status: 'none' };
  });
  
  // Team management for coaches with multiple teams
  const [coachTeams, setCoachTeams] = useState<Team[]>([]);
  
  // Coach sport context (for viewing sport-specific content without a team)
  const [selectedCoachSport, setSelectedCoachSportState] = useState<SportType | null>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('osys_coach_sport');
    return saved as SportType | null;
  });
  
  const setSelectedCoachSport = (sport: SportType | null) => {
    setSelectedCoachSportState(sport);
    if (sport) {
      localStorage.setItem('osys_coach_sport', sport);
    } else {
      localStorage.removeItem('osys_coach_sport');
    }
  };
  
  // League management for league owners
  const [leagueData, setLeagueData] = useState<League | null>(null);
  
  // Listen for sport changes and reload league data for LeagueOwners
  useEffect(() => {
    const handleSportChange = async (event: CustomEvent) => {
      const newSport = (event.detail as string)?.toLowerCase();
      if (!user || !userData || (userData.role !== 'LeagueOwner' && userData.role !== 'LeagueCommissioner')) {
        return;
      }
      
      try {
        const leaguesQuery = query(
          collection(db, 'leagues'),
          where('ownerId', '==', user.uid)
        );
        const leaguesSnap = await getDocs(leaguesQuery);
        
        const matchingLeague = leaguesSnap.docs.find(doc => {
          const data = doc.data();
          return data.sport?.toLowerCase() === newSport;
        });
        
        if (matchingLeague) {
          setLeagueData({ id: matchingLeague.id, ...matchingLeague.data() } as League);
        } else {
          setLeagueData(null);
        }
      } catch (error) {
        console.error('Error loading league for sport:', error);
        setLeagueData(null);
      }
    };
    
    window.addEventListener('commissioner-sport-changed', handleSportChange as EventListener);
    return () => {
      window.removeEventListener('commissioner-sport-changed', handleSportChange as EventListener);
    };
  }, [user, userData]);
  
  // Program management for commissioners
  const [programData, setProgramData] = useState<Program | null>(null);
  
  // Team Manager sub-account support
  const [isTeamManager, setIsTeamManager] = useState(false);
  const [teamManagerData, setTeamManagerData] = useState<TeamManager | null>(null);
  
  // Track if coach teams have been loaded to prevent re-fetching on every profile update
  const coachTeamsLoadedRef = useRef<string | null>(null);
  
  // Computed role checks
  const isLeagueOwner = userData?.role === 'LeagueOwner' || userData?.role === 'LeagueCommissioner';
  const isProgramCommissioner = userData?.role === 'ProgramCommissioner';
  const isCommissioner = isLeagueOwner || isProgramCommissioner;

  // Function to compute sport contexts for a player
  const computeSportContexts = async (player: Player): Promise<SportContext[]> => {
    const contexts: SportContext[] = [];
    const sportsFound = new Set<string>();
    
    console.log('[SportContexts] Computing for player:', player.id, 'teamId:', player.teamId);
    
    // Fetch team doc and player doc in PARALLEL for speed
    const [teamDocResult, playerDocResult] = await Promise.allSettled([
      player.teamId ? getDoc(doc(db, 'teams', player.teamId)) : Promise.resolve(null),
      getDoc(doc(db, 'players', player.id))
    ]);
    
    // Process team document result (active team context)
    if (player.teamId && teamDocResult.status === 'fulfilled' && teamDocResult.value?.exists()) {
      const teamData = teamDocResult.value.data();
      const sport = (teamData.sport || 'football') as SportType;
      sportsFound.add(sport);
      console.log('[SportContexts] Player is on team:', player.teamId, 'sport:', sport);
      contexts.push({
        sport,
        status: 'active',
        teamId: player.teamId,
        teamName: teamData.name || 'Unknown Team',
      });
    }
    
    // Process player document result (draft pool status)
    if (playerDocResult.status === 'fulfilled' && playerDocResult.value?.exists()) {
      const playerData = playerDocResult.value.data();
      console.log('[SportContexts] Player draft pool data:', playerData.draftPoolStatus, playerData.draftPoolProgramId);
      
      // Check for INDEPENDENT REGISTRATION (newest system) - uses programId/registrationId
      if (playerData.draftPoolStatus === 'waiting' && playerData.draftPoolProgramId && playerData.draftPoolRegistrationId) {
        let sport: SportType = (playerData.draftPoolSport || 'football') as SportType;
        let programName = 'Unknown Program';
        let registrationName = '';
        
        // Only fetch program/registration if we need them (sport not yet found)
        if (!sportsFound.has(sport)) {
          try {
            const programDoc = await getDoc(doc(db, 'programs', playerData.draftPoolProgramId));
            if (programDoc.exists()) {
              const programData = programDoc.data();
              if (!playerData.draftPoolSport) {
                sport = (programData.sport || 'football') as SportType;
              }
              const sportLower = sport.toLowerCase();
              const sportNames = programData.sportNames as { [key: string]: string } | undefined;
              programName = sportNames?.[sportLower] || programData.name || 'Unknown Program';
            }
          } catch (e) {
            console.log('⚠️ Error fetching program for registration:', e);
          }
          
          sportsFound.add(sport);
          contexts.push({
            sport,
            status: 'draft_pool',
            draftPoolProgramId: playerData.draftPoolProgramId,
            draftPoolRegistrationId: playerData.draftPoolRegistrationId,
            draftPoolTeamName: registrationName || programName,
            draftPoolAgeGroup: playerData.draftPoolAgeGroup,
          });
          console.log('✅ Found independent registration context:', sport, programName);
        }
      }
      // Check for PROGRAM-based draft pool (season system) - uses programId/seasonId
      else if (playerData.draftPoolStatus === 'waiting' && playerData.draftPoolProgramId && playerData.draftPoolSeasonId) {
        let sport: SportType = (playerData.draftPoolSport || 'football') as SportType;
        let programName = 'Unknown Program';
          let seasonName = '';
          
          // Try to get the program - but don't fail if it doesn't exist
          try {
            const programDoc = await getDoc(doc(db, 'programs', playerData.draftPoolProgramId));
            if (programDoc.exists()) {
              const programData = programDoc.data();
              // Use player's sport if available, otherwise use program's sport
              if (!playerData.draftPoolSport) {
                sport = (programData.sport || 'football') as SportType;
              }
              
              // Use sport-specific name if available, otherwise fall back to org name
              const sportLower = sport.toLowerCase();
              const sportNames = programData.sportNames as { [key: string]: string } | undefined;
              programName = sportNames?.[sportLower] || programData.name || 'Unknown Program';
              
              // Get season name for display
              try {
                const seasonDoc = await getDoc(doc(db, 'programs', playerData.draftPoolProgramId, 'seasons', playerData.draftPoolSeasonId));
                if (seasonDoc.exists()) {
                  seasonName = seasonDoc.data().name || '';
                }
              } catch (e) {
                console.log('Could not fetch season name');
              }
            } else {
              console.log('⚠️ Program not found for draftPoolProgramId:', playerData.draftPoolProgramId);
              // Program doesn't exist - still add context with Unknown Program
            }
          } catch (e) {
            console.log('⚠️ Error fetching program:', e);
          }
          
          // Only add if not already in this sport
          if (!sportsFound.has(sport)) {
            sportsFound.add(sport);
            contexts.push({
              sport,
              status: 'draft_pool',
              draftPoolProgramId: playerData.draftPoolProgramId,
              draftPoolSeasonId: playerData.draftPoolSeasonId,
              draftPoolTeamName: seasonName ? `${programName} - ${seasonName}` : programName,
              draftPoolAgeGroup: playerData.draftPoolAgeGroup,
            });
            console.log('✅ Found program-based draft pool context:', sport, programName);
          }
        }
        
        // Check for TEAM-based draft pool (legacy system) - uses teamId
        if (playerData.draftPoolStatus === 'waiting' && playerData.draftPoolTeamId) {
          // Get the team to find out what sport
          try {
            const teamDoc = await getDoc(doc(db, 'teams', playerData.draftPoolTeamId));
            if (teamDoc.exists()) {
              const teamData = teamDoc.data();
              const sport = (teamData.sport || 'football') as SportType;
              // Only add if not already in this sport
              if (!sportsFound.has(sport)) {
                sportsFound.add(sport);
                contexts.push({
                  sport,
                  status: 'draft_pool',
                  draftPoolTeamId: playerData.draftPoolTeamId,
                  draftPoolTeamName: teamData.name || 'Unknown Team',
                });
              }
            }
          } catch (err) {
            console.error('Error loading draft pool team:', err);
          }
        }
    }
    
    // REMOVED: Slow fallback that queries ALL teams to search draft pools
    // The primary paths above should handle all current use cases
    // Legacy team-based draft pool data should be migrated to player document fields
    
    console.log('[SportContexts] Final contexts:', contexts);
    return contexts;
  };

  // Function to set selected player and persist to Firestore
  const setSelectedPlayer = async (player: Player) => {
    setSelectedPlayerState(player);
    
    // Compute sport contexts for this player
    const contexts = await computeSportContexts(player);
    setSportContexts(contexts);
    
    // Get what we found
    const activeContext = contexts.find(c => c.status === 'active');
    const draftContext = contexts.find(c => c.status === 'draft_pool');
    
    // Check if we should update the selected context
    // Update if: no context saved, current context is 'none', or current context doesn't match any found context
    const currentContext = selectedSportContext;
    const hasValidActiveContext = currentContext && currentContext.status === 'active' && currentContext.teamId;
    const hasValidDraftContext = currentContext && currentContext.status === 'draft_pool';
    
    // If current context is 'none' or empty, but we found an active or draft context, update it
    // ALSO update if current is draft_pool but we now have an active context (prefer active!)
    const shouldUpdate = !currentContext || 
                         !currentContext.sport || 
                         currentContext.status === 'none' ||
                         // Update if current says 'none' but we now have draft/active
                         (currentContext.status === 'none' && (activeContext || draftContext)) ||
                         // IMPORTANT: Update if current is draft_pool but we now have an ACTIVE team
                         (currentContext.status === 'draft_pool' && activeContext);
    
    if (shouldUpdate) {
      // Auto-select a sport context (prefer active team over draft pool)
      const newContext = activeContext || draftContext || { sport: 'football' as SportType, status: 'none' };
      console.log('[AuthContext] Auto-selecting sport context:', newContext);
      setSelectedSportContextState(newContext);
      localStorage.setItem('osys_sport_context', JSON.stringify(newContext));
    } else {
      console.log('[AuthContext] Keeping existing sport context:', currentContext);
    }
    
    // If player has an active team, load that team's data
    if (activeContext?.teamId) {
      const teamDoc = await getDoc(doc(db, 'teams', activeContext.teamId));
      if (teamDoc.exists()) {
        setTeamData({ id: teamDoc.id, ...teamDoc.data() } as Team);
      }
    } else {
      setTeamData(null);
    }
    
    if (userData && userData.role === 'Parent') {
      try {
        await updateDoc(doc(db, 'users', userData.uid), {
          selectedPlayerId: player.id
        });
      } catch (error) {
        console.error('Error saving selected player:', error);
      }
    }
  };
  
  // Function to set selected sport context
  const setSelectedSportContext = async (context: SportContext | null) => {
    setSelectedSportContextState(context);
    
    // Persist to localStorage for immediate restoration on page refresh
    if (context) {
      localStorage.setItem('osys_sport_context', JSON.stringify(context));
    } else {
      localStorage.removeItem('osys_sport_context');
    }
    
    // Also persist selected sport to user profile (for cross-device sync)
    if (userData?.uid && context) {
      try {
        await updateDoc(doc(db, 'users', userData.uid), {
          selectedSport: context.sport
        });
      } catch (error) {
        console.error('Error saving selected sport:', error);
      }
    }
    
    // Load team data if switching to an active sport context
    if (context?.status === 'active' && context.teamId) {
      try {
        const teamDoc = await getDoc(doc(db, 'teams', context.teamId));
        if (teamDoc.exists()) {
          setTeamData({ id: teamDoc.id, ...teamDoc.data() } as Team);
        }
      } catch (err) {
        console.error('Error loading team for sport context:', err);
      }
    } else if (context?.status === 'draft_pool') {
      // In draft pool - no active team
      setTeamData(null);
    } else {
      setTeamData(null);
    }
  };
  
  // Function to set selected team for coaches and persist to Firestore
  const setSelectedTeam = async (team: Team | null) => {
    setTeamData(team);
    if (userData && userData.role === 'Coach') {
      try {
        // Only update selectedTeamId, NOT teamId (to preserve multi-team assignment)
        await updateDoc(doc(db, 'users', userData.uid), {
          selectedTeamId: team?.id || null
        });
      } catch (error) {
        console.error('Error saving selected team:', error);
      }
    }
  };

  useEffect(() => {
    let unsubscribeUserDoc: () => void;
    let unsubscribeTeamDoc: () => void;
    let unsubscribeProgramDoc: () => void;
    let unsubscribePlayersDoc: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // 1. LISTEN TO USER PROFILE (Real-time)
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const profile = docSnap.data() as UserProfile;
                setUserData(profile);

                // Set Sentry user context for error tracking
                setSentryUser({
                  id: firebaseUser.uid,
                  email: firebaseUser.email || undefined,
                  name: profile.name,
                  role: profile.role,
                  teamId: profile.teamId,
                });

                // PARENT FLOW: Load their players from all teams AND top-level players collection
                if (profile.role === 'Parent') {
                    try {
                        // Set up real-time listener for top-level players collection
                        const topLevelPlayersQuery = query(
                            collection(db, 'players'),
                            where('parentId', '==', firebaseUser.uid)
                        );
                        
                        // Unsubscribe from previous players listener if exists
                        if (unsubscribePlayersDoc) unsubscribePlayersDoc();
                        
                        unsubscribePlayersDoc = onSnapshot(topLevelPlayersQuery, async (topLevelSnapshot) => {
                            const allPlayers: Player[] = [];
                            
                            // 1. Get players from top-level collection
                            topLevelSnapshot.docs.forEach(playerDoc => {
                                allPlayers.push({ 
                                    id: playerDoc.id, 
                                    teamId: playerDoc.data().teamId || null,
                                    ...playerDoc.data() 
                                } as Player);
                            });
                            
                            // 2. Use collection group query to find players across ALL team rosters
                            // This is MUCH faster than querying each team individually
                            try {
                                const rosterPlayersQuery = query(
                                    collectionGroup(db, 'players'),
                                    where('parentId', '==', firebaseUser.uid)
                                );
                                const rosterSnapshot = await getDocs(rosterPlayersQuery);
                                
                                rosterSnapshot.docs.forEach(playerDoc => {
                                    const rosterData = playerDoc.data();
                                    // Extract teamId from the document path: teams/{teamId}/players/{playerId}
                                    const pathParts = playerDoc.ref.path.split('/');
                                    const teamId = pathParts.length >= 2 ? pathParts[1] : null;
                                    
                                    // Avoid duplicates
                                    const isDuplicate = allPlayers.find(p => 
                                        p.id === playerDoc.id || 
                                        (rosterData.athleteId && p.id === rosterData.athleteId) || 
                                        (p.athleteId && p.athleteId === playerDoc.id) || 
                                        (p.name === rosterData.name && p.teamId === teamId)
                                    );
                                    if (!isDuplicate && teamId) {
                                        allPlayers.push({ 
                                            id: playerDoc.id, 
                                            teamId: teamId,
                                            ...rosterData 
                                        } as Player);
                                    }
                                });
                            } catch (teamErr) {
                                console.error('Error loading roster players:', teamErr);
                            }
                            
                            setPlayers(allPlayers);
                            console.log('📋 [AuthContext] Players updated in real-time:', allPlayers.length);
                        
                            // Auto-select player (prefer assigned players over unassigned)
                            if (allPlayers.length > 0) {
                                // Sort: assigned players first, then unassigned
                                const sortedPlayers = [...allPlayers].sort((a, b) => {
                                    if (a.teamId && !b.teamId) return -1;
                                    if (!a.teamId && b.teamId) return 1;
                                    return 0;
                                });
                                
                                let playerToSelect = sortedPlayers[0];
                                
                                // If user has a saved selectedPlayerId, try to find it
                                if (profile.selectedPlayerId) {
                                    const saved = allPlayers.find(p => p.id === profile.selectedPlayerId);
                                    if (saved) playerToSelect = saved;
                                }
                                
                                setSelectedPlayerState(playerToSelect);
                                
                                // Compute sport contexts for the selected player
                                // AND auto-select the active context for the current sport
                                // IMPORTANT: We await this to ensure context is set BEFORE loading=false
                                const updateSportContexts = async () => {
                                    const contexts = await computeSportContexts(playerToSelect);
                                    console.log('[AuthContext] Computed sport contexts:', contexts);
                                    setSportContexts(contexts);
                                    
                                    // Find contexts
                                    const activeContext = contexts.find(c => c.status === 'active');
                                    const draftContext = contexts.find(c => c.status === 'draft_pool');
                                    
                                    // Get the sport preference from localStorage (sport only, not status)
                                    const savedContextStr = localStorage.getItem('osys_sport_context');
                                    let preferredSport: SportType = 'football';
                                    try {
                                      const parsed = savedContextStr ? JSON.parse(savedContextStr) : null;
                                      preferredSport = parsed?.sport || 'football';
                                    } catch {}
                                    
                                    // Find the best context for the preferred sport
                                    const activeForSport = contexts.find(c => c.status === 'active' && c.sport === preferredSport);
                                    const draftForSport = contexts.find(c => c.status === 'draft_pool' && c.sport === preferredSport);
                                    
                                    // ALWAYS update selectedSportContext on load
                                    // Priority: active for preferred sport > draft for preferred sport > any active > any draft
                                    const newContext = activeForSport || draftForSport || activeContext || draftContext || 
                                                       { sport: preferredSport, status: 'none' as const };
                                    
                                    console.log('[AuthContext] Auto-selecting sport context on initial load:', newContext);
                                    setSelectedSportContextState(newContext);
                                    localStorage.setItem('osys_sport_context', JSON.stringify(newContext));
                                    
                                    return newContext;
                                };
                                
                                // Run sport context update, then load team data
                                updateSportContexts().then(async (newContext) => {
                                    // Load team data based on the computed context (not player.teamId which may be stale)
                                    const teamIdToLoad = newContext.status === 'active' ? newContext.teamId : playerToSelect.teamId;
                                    
                                    if (teamIdToLoad) {
                                        if (unsubscribeTeamDoc) unsubscribeTeamDoc();
                                        const teamDocRef = doc(db, 'teams', teamIdToLoad);
                                        unsubscribeTeamDoc = onSnapshot(teamDocRef, (teamSnap) => {
                                            if (teamSnap.exists()) {
                                                setTeamData({ id: teamSnap.id, ...teamSnap.data() } as Team);
                                            } else {
                                                setTeamData(null);
                                            }
                                            setLoading(false);
                                        });
                                    } else {
                                        // Player has no team yet
                                        setTeamData(null);
                                        setLoading(false);
                                    }
                                }).catch(err => {
                                    console.error('Error in sport context update:', err);
                                    setLoading(false);
                                });
                            } else {
                                // No players yet
                                setTeamData(null);
                                setLoading(false);
                            }
                        }); // End of onSnapshot callback
                    } catch (error) {
                        console.error('Error setting up players listener:', error);
                        setLoading(false);
                    }
                }
                // COACH FLOW: Load all teams they are assigned to
                else if (profile.role === 'Coach') {
                    // Build the teamIds list
                    let teamIdsList: string[] = [];
                    
                    // Prioritize teamIds array
                    if (profile.teamIds && profile.teamIds.length > 0) {
                        teamIdsList = [...profile.teamIds];
                    }
                    
                    // Also include legacy teamId if not already in array
                    if (profile.teamId && !teamIdsList.includes(profile.teamId)) {
                        teamIdsList.push(profile.teamId);
                    }
                    
                    // Create a key to track if we need to reload teams
                    const teamIdsKey = teamIdsList.sort().join(',');
                    
                    // Only reload teams if the teamIds have changed (not just selectedTeamId)
                    if (coachTeamsLoadedRef.current !== teamIdsKey) {
                        coachTeamsLoadedRef.current = teamIdsKey;
                        
                        try {
                            if (teamIdsList.length > 0) {
                                // Fetch only the specific teams this coach owns (not ALL teams)
                                const teamPromises = teamIdsList.map(tid => getDoc(doc(db, 'teams', tid)));
                                const teamSnapshots = await Promise.all(teamPromises);
                                const allTeams: Team[] = [];
                                teamSnapshots.forEach(teamSnap => {
                                    if (teamSnap.exists()) {
                                        allTeams.push({ id: teamSnap.id, ...teamSnap.data() } as Team);
                                    }
                                });
                                
                                // Set coach teams
                                setCoachTeams(allTeams);
                                
                                // Auto-select team
                                if (allTeams.length > 0) {
                                    let teamToSelect = allTeams[0];
                                    
                                    // If user has a saved selectedTeamId, try to find it
                                    const savedTeamId = profile.selectedTeamId || profile.teamId;
                                    if (savedTeamId) {
                                        const saved = allTeams.find(t => t.id === savedTeamId);
                                        if (saved) teamToSelect = saved;
                                    }
                                    
                                    // Set up listener for selected team
                                    if (unsubscribeTeamDoc) unsubscribeTeamDoc();
                                    const teamDocRef = doc(db, 'teams', teamToSelect.id);
                                    unsubscribeTeamDoc = onSnapshot(teamDocRef, (teamSnap) => {
                                        if (teamSnap.exists()) {
                                            setTeamData({ id: teamSnap.id, ...teamSnap.data() } as Team);
                                        } else {
                                            setTeamData(null);
                                        }
                                        setLoading(false);
                                    });
                                } else {
                                    setTeamData(null);
                                    setLoading(false);
                                }
                            } else {
                                setCoachTeams([]);
                                setTeamData(null);
                                setLoading(false);
                            }
                        } catch (error) {
                            console.error('Error loading coach teams:', error);
                            setLoading(false);
                        }
                    } else {
                        // Teams already loaded, just update selectedTeamId if changed
                        const savedTeamId = profile.selectedTeamId || profile.teamId;
                        if (savedTeamId && coachTeams.length > 0) {
                            const selectedTeam = coachTeams.find(t => t.id === savedTeamId);
                            if (selectedTeam && teamData?.id !== savedTeamId) {
                                // Switch team listener
                                if (unsubscribeTeamDoc) unsubscribeTeamDoc();
                                const teamDocRef = doc(db, 'teams', savedTeamId);
                                unsubscribeTeamDoc = onSnapshot(teamDocRef, (teamSnap) => {
                                    if (teamSnap.exists()) {
                                        setTeamData({ id: teamSnap.id, ...teamSnap.data() } as Team);
                                    } else {
                                        setTeamData(null);
                                    }
                                });
                            }
                        }
                        setLoading(false);
                    }
                }
                // SUPERADMIN FLOW: Use teamId directly (or no team)
                else if (profile.role === 'SuperAdmin') {
                    if (profile.teamId) {
                        if (unsubscribeTeamDoc) unsubscribeTeamDoc();
                        
                        const teamDocRef = doc(db, 'teams', profile.teamId);
                        unsubscribeTeamDoc = onSnapshot(teamDocRef, (teamSnap) => {
                            if (teamSnap.exists()) {
                                 setTeamData({ id: teamSnap.id, ...teamSnap.data() } as Team);
                            } else {
                                 setTeamData(null);
                            }
                            setLoading(false);
                        });
                    } else {
                        setTeamData(null);
                        setLoading(false);
                    }
                }
                // LEAGUE OWNER/COMMISSIONER FLOW: Load their league based on selected sport
                else if (profile.role === 'LeagueOwner' || profile.role === 'LeagueCommissioner') {
                    try {
                        let foundLeague = false;
                        
                        // Method 1: Direct lookup via profile.leagueId (fastest, most reliable)
                        if (profile.leagueId) {
                            const leagueDocRef = doc(db, 'leagues', profile.leagueId);
                            const leagueSnap = await getDoc(leagueDocRef);
                            if (leagueSnap.exists()) {
                                setLeagueData({ id: leagueSnap.id, ...leagueSnap.data() } as League);
                                foundLeague = true;
                            }
                        }
                        
                        // Method 2: Multi-sport leagueIds map
                        if (!foundLeague && profile.leagueIds) {
                            const selectedSport = localStorage.getItem('commissioner_selected_sport')?.toLowerCase() || 'football';
                            const sportLeagueId = (profile.leagueIds as Record<string, string>)[selectedSport];
                            if (sportLeagueId) {
                                const leagueDocRef = doc(db, 'leagues', sportLeagueId);
                                const leagueSnap = await getDoc(leagueDocRef);
                                if (leagueSnap.exists()) {
                                    setLeagueData({ id: leagueSnap.id, ...leagueSnap.data() } as League);
                                    foundLeague = true;
                                }
                            }
                        }
                        
                        // Method 3: Fallback - query leagues where this user is owner
                        if (!foundLeague) {
                            const leaguesQuery = query(
                                collection(db, 'leagues'),
                                where('ownerId', '==', firebaseUser.uid)
                            );
                            const leaguesSnap = await getDocs(leaguesQuery);
                            
                            const selectedSport = localStorage.getItem('commissioner_selected_sport')?.toLowerCase() || 'football';
                            
                            // Find league matching selected sport, or just take the first one
                            const matchingLeague = leaguesSnap.docs.find(d => {
                                const data = d.data();
                                return data.sport?.toLowerCase() === selectedSport;
                            }) || leaguesSnap.docs[0];
                            
                            if (matchingLeague) {
                                setLeagueData({ id: matchingLeague.id, ...matchingLeague.data() } as League);
                                foundLeague = true;
                            }
                        }
                        
                        if (!foundLeague) {
                            console.warn('[AuthContext] No league found for user:', firebaseUser.uid, 'role:', profile.role, 'leagueId:', profile.leagueId);
                            setLeagueData(null);
                        }
                    } catch (error) {
                        console.error('Error loading leagues:', error);
                        setLeagueData(null);
                    }
                    setTeamData(null);
                    setLoading(false);
                }
                // PROGRAM COMMISSIONER FLOW: Load their program with real-time updates
                else if (profile.role === 'ProgramCommissioner') {
                    if (profile.programId) {
                        // Unsubscribe from previous listener if exists
                        if (unsubscribeProgramDoc) unsubscribeProgramDoc();
                        
                        const programDocRef = doc(db, 'programs', profile.programId);
                        unsubscribeProgramDoc = onSnapshot(programDocRef, async (programSnap) => {
                            if (programSnap.exists()) {
                                setProgramData({ id: programSnap.id, ...programSnap.data() } as Program);
                                
                                // If program has a leagueId, also load league info
                                const programInfo = programSnap.data() as Program;
                                if (programInfo.leagueId) {
                                    try {
                                        const leagueDocRef = doc(db, 'leagues', programInfo.leagueId);
                                        const leagueSnap = await getDoc(leagueDocRef);
                                        if (leagueSnap.exists()) {
                                            setLeagueData({ id: leagueSnap.id, ...leagueSnap.data() } as League);
                                        }
                                    } catch (error) {
                                        console.error('Error loading league data:', error);
                                    }
                                }
                            } else {
                                setProgramData(null);
                            }
                            setLoading(false);
                        }, (error) => {
                            console.error('Error listening to program data:', error);
                            setProgramData(null);
                            setLoading(false);
                        });
                    } else {
                        setProgramData(null);
                        setLoading(false);
                    }
                    setTeamData(null);
                }
                // FAN FLOW: No team data needed
                else if (profile.role === 'Fan') {
                    setTeamData(null);
                    setLoading(false);
                }
                // Default/fallback: Use teamId if present
                else if (profile.teamId) {
                    if (unsubscribeTeamDoc) unsubscribeTeamDoc();
                    
                    const teamDocRef = doc(db, 'teams', profile.teamId);
                    unsubscribeTeamDoc = onSnapshot(teamDocRef, (teamSnap) => {
                        if (teamSnap.exists()) {
                             setTeamData({ id: teamSnap.id, ...teamSnap.data() } as Team);
                        } else {
                             setTeamData(null);
                        }
                        setLoading(false);
                    });
                } else {
                    setTeamData(null);
                    setLoading(false);
                }
            } else {
                // User logged in but no profile doc exists yet
                // Check if this is a team manager instead
                try {
                    const managerDocRef = doc(db, 'teamManagers', firebaseUser.uid);
                    const managerSnap = await getDoc(managerDocRef);
                    
                    if (managerSnap.exists()) {
                        // This is a team manager - they login AS the commissioner
                        const managerData = { id: managerSnap.id, ...managerSnap.data() } as TeamManager;
                        
                        // Check if manager is active (block deleted, suspended, paused)
                        if (managerData.status !== 'active') {
                            console.warn('Team manager account is not active:', managerData.status);
                            await auth.signOut();
                            setUserData(null);
                            setTeamData(null);
                            setIsTeamManager(false);
                            setTeamManagerData(null);
                            setLoading(false);
                            return;
                        }
                        
                        console.log('🔑 [Manager Login] Logging in as commissioner:', managerData.commissionerId);
                        
                        // Load the FULL commissioner profile - manager becomes the commissioner
                        try {
                            const commissionerDocRef = doc(db, 'users', managerData.commissionerId);
                            const commissionerSnap = await getDoc(commissionerDocRef);
                            
                            if (commissionerSnap.exists()) {
                                // Use commissioner's FULL profile with one extra flag
                                const commissionerProfile = { 
                                    uid: commissionerSnap.id, // USE COMMISSIONER'S UID for all queries!
                                    ...commissionerSnap.data(),
                                    isActingAsManager: true, // Only flag to hide Managers tab
                                    managerName: managerData.name, // Track who's logged in for display
                                    managerEmail: managerData.email,
                                } as UserProfile;
                                
                                console.log('🔑 [Manager Login] Acting as:', commissionerProfile.name);
                                
                                setIsTeamManager(true);
                                setTeamManagerData(managerData);
                                setUserData(commissionerProfile);
                                
                                // Now trigger the NORMAL commissioner loading flows
                                // The profile.role check below will handle loading teams/programs/leagues
                                // We need to re-trigger by setting user with commissioner's UID context
                                
                                // Load teams by ownerId (commissioner's UID)
                                if (commissionerProfile.role === 'TeamCommissioner' || commissionerProfile.role === 'Coach') {
                                    const teamsQuery = query(
                                        collection(db, 'teams'),
                                        where('ownerId', '==', commissionerProfile.uid)
                                    );
                                    const teamsSnap = await getDocs(teamsQuery);
                                    const teams = teamsSnap.docs.map(teamDoc => ({
                                        id: teamDoc.id,
                                        ...teamDoc.data()
                                    } as Team));
                                    
                                    console.log('🔑 [Manager] Loaded teams:', teams.map(t => t.name));
                                    setCoachTeams(teams);
                                    
                                    if (teams.length > 0) {
                                        setTeamData(teams[0]);
                                    }
                                }
                                
                                // Load program if commissioner has one
                                if (commissionerProfile.programId) {
                                    const programDocRef = doc(db, 'programs', commissionerProfile.programId);
                                    const programSnap = await getDoc(programDocRef);
                                    if (programSnap.exists()) {
                                        setProgramData({ id: programSnap.id, ...programSnap.data() } as Program);
                                        
                                        // If program has leagueId, load league too
                                        const programInfo = programSnap.data() as Program;
                                        if (programInfo.leagueId) {
                                            const leagueDocRef = doc(db, 'leagues', programInfo.leagueId);
                                            const leagueSnap = await getDoc(leagueDocRef);
                                            if (leagueSnap.exists()) {
                                                setLeagueData({ id: leagueSnap.id, ...leagueSnap.data() } as League);
                                            }
                                        }
                                    }
                                }
                                
                                // Update manager's last login
                                await updateDoc(managerDocRef, {
                                    lastLogin: new Date(),
                                    loginCount: (managerData.loginCount || 0) + 1,
                                });
                                
                                // Set Sentry context
                                setSentryUser({
                                    id: commissionerProfile.uid, // Use commissioner's UID
                                    email: managerData.email,
                                    name: `${managerData.name} (Manager for ${commissionerProfile.name})`,
                                    role: commissionerProfile.role || 'TeamCommissioner',
                                    teamId: commissionerProfile.teamId,
                                });
                                
                                setLoading(false);
                            } else {
                                console.error('Commissioner profile not found:', managerData.commissionerId);
                                await auth.signOut();
                                setUserData(null);
                                setTeamData(null);
                                setIsTeamManager(false);
                                setTeamManagerData(null);
                                setLoading(false);
                            }
                        } catch (err) {
                            console.error('Error loading commissioner profile for manager:', err);
                            await auth.signOut();
                            setUserData(null);
                            setTeamData(null);
                            setLoading(false);
                        }
                    } else {
                        // No user profile and not a manager
                        setUserData(null);
                        setTeamData(null);
                        setIsTeamManager(false);
                        setTeamManagerData(null);
                        setLoading(false);
                    }
                } catch (error) {
                    console.error('Error checking team manager:', error);
                    setUserData(null);
                    setTeamData(null);
                    setIsTeamManager(false);
                    setTeamManagerData(null);
                    setLoading(false);
                }
            }
        }, (error) => {
            console.error("User Listener Error:", error);
            setLoading(false);
        });

      } else {
        // Logged Out
        setUser(null);
        setUserData(null);
        setTeamData(null);
        setPlayers([]);
        setSelectedPlayerState(null);
        setCoachTeams([]);
        setLeagueData(null);
        setProgramData(null);
        setIsTeamManager(false);
        setTeamManagerData(null);
        coachTeamsLoadedRef.current = null; // Reset coach teams loaded tracker
        
        // Clear sport context state AND localStorage to prevent cross-user contamination
        setSelectedSportContextState({ sport: 'football' as SportType, status: 'none' });
        setSportContexts([]);
        localStorage.removeItem('osys_sport_context');
        localStorage.removeItem('osys_coach_sport');
        
        // Clear Sentry user context
        clearSentryUser();
        setLoading(false);
        
        // Clean up listeners
        if (unsubscribeUserDoc) unsubscribeUserDoc();
        if (unsubscribeTeamDoc) unsubscribeTeamDoc();
        if (unsubscribeProgramDoc) unsubscribeProgramDoc();
        if (unsubscribePlayersDoc) unsubscribePlayersDoc();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      if (unsubscribeTeamDoc) unsubscribeTeamDoc();
      if (unsubscribeProgramDoc) unsubscribeProgramDoc();
      if (unsubscribePlayersDoc) unsubscribePlayersDoc();
    };
  }, []);

  // Watch for selectedPlayer changes and update team data
  useEffect(() => {
    let unsubscribeTeamDoc: () => void;
    
    // Only subscribe to team doc if player has a teamId
    if (selectedPlayer && selectedPlayer.teamId && userData?.role === 'Parent') {
      const teamDocRef = doc(db, 'teams', selectedPlayer.teamId);
      unsubscribeTeamDoc = onSnapshot(teamDocRef, (teamSnap) => {
        if (teamSnap.exists()) {
          setTeamData({ id: teamSnap.id, ...teamSnap.data() } as Team);
        } else {
          setTeamData(null);
        }
      });
    } else if (selectedPlayer && !selectedPlayer.teamId) {
      // Player has no team yet - clear team data
      setTeamData(null);
    }
    
    return () => {
      if (unsubscribeTeamDoc) unsubscribeTeamDoc();
    };
  }, [selectedPlayer, userData?.role]);

  const value = { 
    user, 
    userData, 
    teamData, 
    loading, 
    players, 
    selectedPlayer, 
    setSelectedPlayer,
    sportContexts,
    selectedSportContext,
    setSelectedSportContext,
    coachTeams, 
    setSelectedTeam,
    selectedCoachSport,
    setSelectedCoachSport,
    leagueData,
    programData,
    isLeagueOwner,
    isProgramCommissioner,
    isCommissioner,
    isTeamManager,
    teamManagerData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};