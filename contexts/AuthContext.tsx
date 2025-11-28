import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore'; // <--- CHANGED: Removed getDoc, added onSnapshot
import { auth, db } from '../services/firebase';
import type { UserProfile, Team } from '../types';

interface AuthContextType {
  user: User | null;
  userData: UserProfile | null;
  teamData: Team | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  teamData: null,
  loading: true,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [teamData, setTeamData] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUserDoc: () => void;
    let unsubscribeTeamDoc: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // 1. LISTEN TO USER PROFILE (Real-time)
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const profile = docSnap.data() as UserProfile;
                setUserData(profile);

                // 2. LISTEN TO TEAM DATA (Real-time)
                // If teamId changes (or on first load), subscribe to team
                if (profile.teamId) {
                    // Only subscribe if we haven't already or if ID changed
                    // For simplicity in this structure, we just reset the listener
                    if (unsubscribeTeamDoc) unsubscribeTeamDoc();
                    
                    const teamDocRef = doc(db, 'teams', profile.teamId);
                    unsubscribeTeamDoc = onSnapshot(teamDocRef, (teamSnap) => {
                        if (teamSnap.exists()) {
                             setTeamData({ id: teamSnap.id, ...teamSnap.data() } as Team);
                        } else {
                             setTeamData(null);
                        }
                        setLoading(false); // Data is ready
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

  const value = { user, userData, teamData, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};