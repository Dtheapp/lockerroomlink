import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { UserProfile, Team, Player } from '../types';

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

                // PARENT FLOW: Load their players from all teams
                if (profile.role === 'Parent') {
                    try {
                        // Query all teams' player collections for this parent
                        const teamsSnapshot = await getDocs(collection(db, 'teams'));
                        const allPlayers: Player[] = [];
                        
                        for (const teamDoc of teamsSnapshot.docs) {
                            const playersQuery = query(
                                collection(db, 'teams', teamDoc.id, 'players'),
                                where('parentId', '==', firebaseUser.uid)
                            );
                            const playersSnapshot = await getDocs(playersQuery);
                            playersSnapshot.docs.forEach(playerDoc => {
                                allPlayers.push({ 
                                    id: playerDoc.id, 
                                    teamId: teamDoc.id,
                                    ...playerDoc.data() 
                                } as Player);
                            });
                        }
                        
                        setPlayers(allPlayers);
                        
                        // Auto-select player
                        if (allPlayers.length > 0) {
                            let playerToSelect = allPlayers[0];
                            
                            // If user has a saved selectedPlayerId, try to find it
                            if (profile.selectedPlayerId) {
                                const saved = allPlayers.find(p => p.id === profile.selectedPlayerId);
                                if (saved) playerToSelect = saved;
                            }
                            
                            setSelectedPlayerState(playerToSelect);
                            
                            // Load team data for selected player
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
                    try {
                        // Get teams from teamIds array (for coaches on multiple teams)
                        let teamIdsList: string[] = [];
                        
                        // Prioritize teamIds array
                        if (profile.teamIds && profile.teamIds.length > 0) {
                            teamIdsList = [...profile.teamIds];
                        }
                        
                        // Also include legacy teamId if not already in array
                        if (profile.teamId && !teamIdsList.includes(profile.teamId)) {
                            teamIdsList.push(profile.teamId);
                        }
                        
                        console.log('Coach teamIds:', teamIdsList); // Debug log
                        
                        if (teamIdsList.length > 0) {
                            // Fetch all teams at once
                            const teamsSnapshot = await getDocs(collection(db, 'teams'));
                            const allTeams: Team[] = [];
                            teamsSnapshot.docs.forEach(teamDoc => {
                                if (teamIdsList.includes(teamDoc.id)) {
                                    allTeams.push({ id: teamDoc.id, ...teamDoc.data() } as Team);
                                }
                            });
                            
                            console.log('Loaded coach teams:', allTeams.length); // Debug log
                            
                            // Always set coach teams - this is the key fix
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
                }
                // SUPERADMIN FLOW: Use teamId directly (or no team)
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
                setUserData(null);
                setTeamData(null);
                setLoading(false);
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
    
    if (selectedPlayer && userData?.role === 'Parent') {
      const teamDocRef = doc(db, 'teams', selectedPlayer.teamId);
      unsubscribeTeamDoc = onSnapshot(teamDocRef, (teamSnap) => {
        if (teamSnap.exists()) {
          setTeamData({ id: teamSnap.id, ...teamSnap.data() } as Team);
        } else {
          setTeamData(null);
        }
      });
    }
    
    return () => {
      if (unsubscribeTeamDoc) unsubscribeTeamDoc();
    };
  }, [selectedPlayer, userData?.role]);

  const value = { user, userData, teamData, loading, players, selectedPlayer, setSelectedPlayer, coachTeams, setSelectedTeam };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};