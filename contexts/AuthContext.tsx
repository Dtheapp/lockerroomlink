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
  // New: Player management for parents
  players: Player[];
  selectedPlayer: Player | null;
  setSelectedPlayer: (player: Player) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  teamData: null,
  loading: true,
  players: [],
  selectedPlayer: null,
  setSelectedPlayer: () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [teamData, setTeamData] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  
  // New: Player management for parents
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayerState] = useState<Player | null>(null);

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
                // COACH/ADMIN FLOW: Use teamId directly
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

  const value = { user, userData, teamData, loading, players, selectedPlayer, setSelectedPlayer };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};