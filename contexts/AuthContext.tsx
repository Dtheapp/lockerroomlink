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
  const [sportContexts, setSportContexts] = useState<SportContext[]>([]);
  const [selectedSportContext, setSelectedSportContextState] = useState<SportContext | null>(() => {
    // Restore from localStorage on mount
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('osys_sport_context');
      if (saved) {
        try {
          return JSON.parse(saved);
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
    
    // Check if player is on any teams (active)
    if (player.teamId) {
      try {
        const teamDoc = await getDoc(doc(db, 'teams', player.teamId));
        if (teamDoc.exists()) {
          const teamData = teamDoc.data();
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
      } catch (err) {
        console.error('Error loading team for sport context:', err);
      }
    }
    
    // Check player document for draft pool status
    try {
      console.log('[SportContexts] Checking players/' + player.id + ' for draft pool status');
      const playerDoc = await getDoc(doc(db, 'players', player.id));
      console.log('[SportContexts] playerDoc.exists():', playerDoc.exists());
      if (playerDoc.exists()) {
        const playerData = playerDoc.data();
        console.log('[SportContexts] Player draft pool data:', playerData.draftPoolStatus, playerData.draftPoolProgramId, playerData.draftPoolSeasonId, playerData.draftPoolRegistrationId, playerData.draftPoolSport);
        
        // Check for INDEPENDENT REGISTRATION (newest system) - uses programId/registrationId
        if (playerData.draftPoolStatus === 'waiting' && playerData.draftPoolProgramId && playerData.draftPoolRegistrationId) {
          let sport: SportType = (playerData.draftPoolSport || 'football') as SportType;
          let programName = 'Unknown Program';
          let registrationName = '';
          
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
              
              // Get registration name
              try {
                const regDoc = await getDoc(doc(db, 'programs', playerData.draftPoolProgramId, 'registrations', playerData.draftPoolRegistrationId));
                if (regDoc.exists()) {
                  registrationName = regDoc.data().name || '';
                }
              } catch (e) {
                console.log('Could not fetch registration name');
              }
            }
          } catch (e) {
            console.log('⚠️ Error fetching program for registration:', e);
          }
          
          if (!sportsFound.has(sport)) {
            sportsFound.add(sport);
            contexts.push({
              sport,
              status: 'draft_pool',
              draftPoolProgramId: playerData.draftPoolProgramId,
              draftPoolRegistrationId: playerData.draftPoolRegistrationId,
              draftPoolTeamName: registrationName || programName,
              draftPoolAgeGroup: playerData.draftPoolAgeGroup,
            });
            console.log('✅ Found independent registration context:', sport, programName, registrationName);
          }
        }
        // Check for PROGRAM-based draft pool (season system) - uses programId/seasonId
        else if (playerData.draftPoolStatus === 'waiting' && playerData.draftPoolProgramId && playerData.draftPoolSeasonId) {
          // First, try to get sport from player's draftPoolSport (new field)
          // If not available, fall back to program's sport field
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
        }
      }
    } catch (err) {
      console.error('Error checking draft pool for sport context:', err);
    }
    
    // Also search draft pool entries directly (fallback)
    try {
      const teamsSnap = await getDocs(collection(db, 'teams'));
      for (const teamDoc of teamsSnap.docs) {
        const teamData = teamDoc.data();
        const sport = (teamData.sport || 'football') as SportType;
        
        // Skip if we already have this sport
        if (sportsFound.has(sport)) continue;
        
        // Check draft pool for this player
        const draftPoolQuery = query(
          collection(db, 'teams', teamDoc.id, 'draftPool'),
          where('playerId', '==', player.id),
          where('status', '==', 'waiting')
        );
        const draftSnap = await getDocs(draftPoolQuery);
        
        if (!draftSnap.empty) {
          sportsFound.add(sport);
          contexts.push({
            sport,
            status: 'draft_pool',
            draftPoolTeamId: teamDoc.id,
            draftPoolTeamName: teamData.name || 'Unknown Team',
          });
        }
      }
    } catch (err) {
      console.error('Error searching draft pools for sport context:', err);
    }
    
    // FALLBACK: Check registrants collection for registrations made by this user (parent)
    // This catches registrations that weren't properly linked to player document
    // Uses parentId since that's what Firestore rules allow
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        console.log('[SportContexts] Checking registrants collection for parentId:', currentUser.uid, 'and player:', player.id);
        const registrantsQuery = query(
          collectionGroup(db, 'registrants'),
          where('parentId', '==', currentUser.uid)
        );
        const registrantsSnap = await getDocs(registrantsQuery);
        console.log('[SportContexts] Found registrations by parent:', registrantsSnap.size);
        
        for (const regDoc of registrantsSnap.docs) {
          const regData = regDoc.data();
          
          // Only process registrations that match THIS player
          if (regData.existingPlayerId !== player.id) {
            continue;
          }
          
          const pathParts = regDoc.ref.path.split('/');
          // Path: programs/{programId}/registrations/{regId}/registrants/{registrantId}
          const programId = pathParts[1];
          const registrationId = pathParts[3];
          
          // Only consider "pending" confirmations (not yet drafted to team)
          if (regData.confirmationStatus !== 'confirmed' && regData.assignedTeamId === undefined) {
            try {
              const programDoc = await getDoc(doc(db, 'programs', programId));
              if (programDoc.exists()) {
                const programData = programDoc.data();
                const sport = (programData.sport || regData.sport || 'football') as SportType;
                
                if (!sportsFound.has(sport)) {
                  sportsFound.add(sport);
                  
                  // Use sport-specific name if available, otherwise fall back to org name
                  const sportLower = sport.toLowerCase();
                  const sportNames = programData.sportNames as { [key: string]: string } | undefined;
                  const programName = sportNames?.[sportLower] || programData.name || 'Unknown Program';
                  
                  // Get registration name
                  let registrationName = '';
                  try {
                    const regDoc2 = await getDoc(doc(db, 'programs', programId, 'registrations', registrationId));
                    if (regDoc2.exists()) {
                      registrationName = regDoc2.data().name || regDoc2.data().title || '';
                    }
                  } catch (e) {}
                  
                  contexts.push({
                    sport,
                    status: 'draft_pool',
                    draftPoolProgramId: programId,
                    draftPoolRegistrationId: registrationId,
                    draftPoolTeamName: registrationName || programName,
                    draftPoolAgeGroup: regData.ageGroupLabel || regData.calculatedAgeGroup,
                  });
                  console.log('✅ Found registration via fallback:', sport, programName, registrationName);
                }
              }
            } catch (e) {
              console.warn('Error fetching program for registration fallback:', e);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error in registrant fallback search:', err);
    }
    
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
    const shouldUpdate = !currentContext || 
                         !currentContext.sport || 
                         currentContext.status === 'none' ||
                         // Also update if current says 'none' but we now have draft/active
                         (currentContext.status === 'none' && (activeContext || draftContext));
    
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
                            
                            // 2. Query all teams' player collections for this parent (still one-time, less critical)
                            try {
                                const teamsSnapshot = await getDocs(collection(db, 'teams'));
                                
                                for (const teamDoc of teamsSnapshot.docs) {
                                    const playersQuery = query(
                                        collection(db, 'teams', teamDoc.id, 'players'),
                                        where('parentId', '==', firebaseUser.uid)
                                    );
                                    const playersSnapshot = await getDocs(playersQuery);
                                    playersSnapshot.docs.forEach(playerDoc => {
                                        const rosterData = playerDoc.data();
                                        // Avoid duplicates - check by athleteId OR by name match with same parent
                                        // This handles both linked players (athleteId set) and legacy players
                                        const isDuplicate = allPlayers.find(p => 
                                            p.id === playerDoc.id || // Same doc ID
                                            (rosterData.athleteId && p.id === rosterData.athleteId) || // Roster points to this athlete
                                            (p.athleteId && p.athleteId === playerDoc.id) || // Athlete points to this roster doc
                                            (p.name === rosterData.name && p.teamId === teamDoc.id) // Same name on same team
                                        );
                                        if (!isDuplicate) {
                                            allPlayers.push({ 
                                                id: playerDoc.id, 
                                                teamId: teamDoc.id,
                                                ...rosterData 
                                            } as Player);
                                        }
                                    });
                                }
                            } catch (teamErr) {
                                console.error('Error loading team players:', teamErr);
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
                                // AND auto-select draft_pool context if current is 'none'
                                computeSportContexts(playerToSelect).then(contexts => {
                                    console.log('[AuthContext] Computed sport contexts:', contexts);
                                    setSportContexts(contexts);
                                    
                                    // Check if we should update selectedSportContext
                                    const activeContext = contexts.find(c => c.status === 'active');
                                    const draftContext = contexts.find(c => c.status === 'draft_pool');
                                    
                                    // Get current saved context
                                    const savedContextStr = localStorage.getItem('osys_sport_context');
                                    let currentContext: SportContext | null = null;
                                    try {
                                      currentContext = savedContextStr ? JSON.parse(savedContextStr) : null;
                                    } catch {}
                                    
                                    // Update if: no context, status is 'none', or we found better context
                                    const shouldUpdate = !currentContext || 
                                                         currentContext.status === 'none' ||
                                                         (currentContext.status === 'none' && (activeContext || draftContext));
                                    
                                    if (shouldUpdate && (activeContext || draftContext)) {
                                      const newContext = activeContext || draftContext!;
                                      console.log('[AuthContext] Auto-selecting sport context on initial load:', newContext);
                                      setSelectedSportContextState(newContext);
                                      localStorage.setItem('osys_sport_context', JSON.stringify(newContext));
                                    }
                                });
                                
                                // Load team data for selected player (only if they have a team)
                                if (playerToSelect.teamId) {
                                    if (unsubscribeTeamDoc) unsubscribeTeamDoc();
                                    const teamDocRef = doc(db, 'teams', playerToSelect.teamId);
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
                                // Fetch all teams at once
                                const teamsSnapshot = await getDocs(collection(db, 'teams'));
                                const allTeams: Team[] = [];
                                teamsSnapshot.docs.forEach(teamDoc => {
                                    if (teamIdsList.includes(teamDoc.id)) {
                                        allTeams.push({ id: teamDoc.id, ...teamDoc.data() } as Team);
                                    }
                                });
                                
                                console.log('Loaded coach teams:', allTeams.map(t => t.name)); // Debug log
                                
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
                    // Query all leagues owned by this user
                    try {
                        const leaguesQuery = query(
                            collection(db, 'leagues'),
                            where('ownerId', '==', user.uid)
                        );
                        const leaguesSnap = await getDocs(leaguesQuery);
                        
                        // Get selected sport from localStorage
                        const selectedSport = localStorage.getItem('commissioner_selected_sport')?.toLowerCase() || 'football';
                        
                        // Find league matching selected sport
                        const matchingLeague = leaguesSnap.docs.find(doc => {
                            const data = doc.data();
                            return data.sport?.toLowerCase() === selectedSport;
                        });
                        
                        if (matchingLeague) {
                            setLeagueData({ id: matchingLeague.id, ...matchingLeague.data() } as League);
                        } else {
                            // No league for this sport
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
                        // This is a team manager!
                        const managerData = { id: managerSnap.id, ...managerSnap.data() } as TeamManager;
                        
                        // Check if manager is active
                        if (managerData.status !== 'active') {
                            console.warn('Team manager account is not active:', managerData.status);
                            setUserData(null);
                            setTeamData(null);
                            setIsTeamManager(false);
                            setTeamManagerData(null);
                            setLoading(false);
                            return;
                        }
                        
                        setIsTeamManager(true);
                        setTeamManagerData(managerData);
                        
                        // Create a pseudo UserProfile for the manager to work with existing components
                        const pseudoProfile: UserProfile = {
                            uid: firebaseUser.uid,
                            email: managerData.email,
                            name: managerData.name,
                            role: 'Coach', // Managers act as coaches
                            teamId: managerData.teamId,
                            teamIds: [managerData.teamId],
                            isTeamManager: true, // Custom flag
                            managerId: managerData.id,
                            commissionerId: managerData.commissionerId,
                        } as UserProfile;
                        
                        setUserData(pseudoProfile);
                        
                        // Set Sentry context
                        setSentryUser({
                            id: firebaseUser.uid,
                            email: managerData.email,
                            name: managerData.name,
                            role: 'TeamManager',
                            teamId: managerData.teamId,
                        });
                        
                        // Update last login
                        await updateDoc(managerDocRef, {
                            lastLogin: new Date(),
                            loginCount: (managerData.loginCount || 0) + 1,
                        });
                        
                        // Load the team data
                        if (managerData.teamId) {
                            const teamDocRef = doc(db, 'teams', managerData.teamId);
                            const teamSnap = await getDoc(teamDocRef);
                            if (teamSnap.exists()) {
                                setTeamData({ id: teamSnap.id, ...teamSnap.data() } as Team);
                            }
                        }
                        
                        setLoading(false);
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