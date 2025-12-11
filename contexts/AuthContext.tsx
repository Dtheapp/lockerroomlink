import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { setSentryUser, clearSentryUser } from '../services/sentry';
import type { UserProfile, Team, Player, League, Program, TeamManager } from '../types';

interface AuthContextType {
  user: User | null;
  userData: UserProfile | null;
  teamData: Team | null;
  loading: boolean;
  // Player management for parents
  players: Player[];
  selectedPlayer: Player | null;
  setSelectedPlayer: (player: Player) => void;
  // Team management for coaches with multiple teams
  coachTeams: Team[];
  setSelectedTeam: (team: Team) => void;
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
  coachTeams: [],
  setSelectedTeam: () => {},
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
  
  // Player management for parents
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayerState] = useState<Player | null>(null);
  
  // Team management for coaches with multiple teams
  const [coachTeams, setCoachTeams] = useState<Team[]>([]);
  
  // League management for league owners
  const [leagueData, setLeagueData] = useState<League | null>(null);
  
  // Program management for commissioners
  const [programData, setProgramData] = useState<Program | null>(null);
  
  // Team Manager sub-account support
  const [isTeamManager, setIsTeamManager] = useState(false);
  const [teamManagerData, setTeamManagerData] = useState<TeamManager | null>(null);
  
  // Track if coach teams have been loaded to prevent re-fetching on every profile update
  const coachTeamsLoadedRef = useRef<string | null>(null);
  
  // Computed role checks
  const isLeagueOwner = userData?.role === 'LeagueOwner';
  const isProgramCommissioner = userData?.role === 'ProgramCommissioner';
  const isCommissioner = isLeagueOwner || isProgramCommissioner;

  // Function to set selected player and persist to Firestore
  const setSelectedPlayer = async (player: Player) => {
    setSelectedPlayerState(player);
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
  
  // Function to set selected team for coaches and persist to Firestore
  const setSelectedTeam = async (team: Team) => {
    setTeamData(team);
    if (userData && userData.role === 'Coach') {
      try {
        // Only update selectedTeamId, NOT teamId (to preserve multi-team assignment)
        await updateDoc(doc(db, 'users', userData.uid), {
          selectedTeamId: team.id
        });
      } catch (error) {
        console.error('Error saving selected team:', error);
      }
    }
  };

  useEffect(() => {
    let unsubscribeUserDoc: () => void;
    let unsubscribeTeamDoc: () => void;

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
                        const allPlayers: Player[] = [];
                        
                        // 1. Query top-level 'players' collection for unassigned players
                        const topLevelPlayersQuery = query(
                            collection(db, 'players'),
                            where('parentId', '==', firebaseUser.uid)
                        );
                        const topLevelSnapshot = await getDocs(topLevelPlayersQuery);
                        topLevelSnapshot.docs.forEach(playerDoc => {
                            allPlayers.push({ 
                                id: playerDoc.id, 
                                teamId: playerDoc.data().teamId || null, // May be null for unassigned players
                                ...playerDoc.data() 
                            } as Player);
                        });
                        
                        // 2. Query all teams' player collections for this parent
                        const teamsSnapshot = await getDocs(collection(db, 'teams'));
                        
                        for (const teamDoc of teamsSnapshot.docs) {
                            const playersQuery = query(
                                collection(db, 'teams', teamDoc.id, 'players'),
                                where('parentId', '==', firebaseUser.uid)
                            );
                            const playersSnapshot = await getDocs(playersQuery);
                            playersSnapshot.docs.forEach(playerDoc => {
                                // Avoid duplicates (in case player exists in both places)
                                if (!allPlayers.find(p => p.id === playerDoc.id)) {
                                    allPlayers.push({ 
                                        id: playerDoc.id, 
                                        teamId: teamDoc.id,
                                        ...playerDoc.data() 
                                    } as Player);
                                }
                            });
                        }
                        
                        setPlayers(allPlayers);
                        
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
                    } catch (error) {
                        console.error('Error loading parent players:', error);
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
                // LEAGUE OWNER FLOW: Load their league
                else if (profile.role === 'LeagueOwner') {
                    if (profile.leagueId) {
                        try {
                            const leagueDocRef = doc(db, 'leagues', profile.leagueId);
                            const leagueSnap = await getDoc(leagueDocRef);
                            if (leagueSnap.exists()) {
                                setLeagueData({ id: leagueSnap.id, ...leagueSnap.data() } as League);
                            } else {
                                setLeagueData(null);
                            }
                        } catch (error) {
                            console.error('Error loading league data:', error);
                            setLeagueData(null);
                        }
                    }
                    setTeamData(null);
                    setLoading(false);
                }
                // PROGRAM COMMISSIONER FLOW: Load their program
                else if (profile.role === 'ProgramCommissioner') {
                    if (profile.programId) {
                        try {
                            const programDocRef = doc(db, 'programs', profile.programId);
                            const programSnap = await getDoc(programDocRef);
                            if (programSnap.exists()) {
                                setProgramData({ id: programSnap.id, ...programSnap.data() } as Program);
                                
                                // If program has a leagueId, also load league info
                                const programData = programSnap.data() as Program;
                                if (programData.leagueId) {
                                    const leagueDocRef = doc(db, 'leagues', programData.leagueId);
                                    const leagueSnap = await getDoc(leagueDocRef);
                                    if (leagueSnap.exists()) {
                                        setLeagueData({ id: leagueSnap.id, ...leagueSnap.data() } as League);
                                    }
                                }
                            } else {
                                setProgramData(null);
                            }
                        } catch (error) {
                            console.error('Error loading program data:', error);
                            setProgramData(null);
                        }
                    }
                    setTeamData(null);
                    setLoading(false);
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
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      if (unsubscribeTeamDoc) unsubscribeTeamDoc();
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
    coachTeams, 
    setSelectedTeam,
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