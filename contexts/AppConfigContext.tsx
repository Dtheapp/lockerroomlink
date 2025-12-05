import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

interface AppConfig {
  // Registration Settings
  allowNewRegistrations: boolean;
  requireEmailVerification: boolean;
  defaultUserRole: 'Parent' | 'Coach';
  
  // Team Settings
  maxPlayersPerTeam: number;
  maxUsersPerTeam: number;
  allowCoachSelfRegistration: boolean;
  
  // Feature Toggles
  chatEnabled: boolean;
  videoLibraryEnabled: boolean;
  playbookEnabled: boolean;
  statsEnabled: boolean;
  messengerEnabled: boolean;
  clonePlayEnabled: boolean;
  
  // Content Settings
  maxBulletinPosts: number;
  maxChatMessages: number;
  
  // Maintenance Mode
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

const defaultConfig: AppConfig = {
  allowNewRegistrations: true,
  requireEmailVerification: false,
  defaultUserRole: 'Parent',
  maxPlayersPerTeam: 30,
  maxUsersPerTeam: 50,
  allowCoachSelfRegistration: true,
  chatEnabled: true,
  videoLibraryEnabled: true,
  playbookEnabled: true,
  statsEnabled: true,
  messengerEnabled: true,
  clonePlayEnabled: true,
  maxBulletinPosts: 100,
  maxChatMessages: 500,
  maintenanceMode: false,
  maintenanceMessage: 'The app is currently undergoing maintenance. Please check back soon.'
};

interface AppConfigContextType {
  config: AppConfig;
  loading: boolean;
}

const AppConfigContext = createContext<AppConfigContextType>({
  config: defaultConfig,
  loading: true
});

export const useAppConfig = () => useContext(AppConfigContext);

interface AppConfigProviderProps {
  children: ReactNode;
}

export const AppConfigProvider: React.FC<AppConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time listener for config changes
    const docRef = doc(db, 'appConfig', 'settings');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<AppConfig>;
        setConfig({ ...defaultConfig, ...data });
      } else {
        setConfig(defaultConfig);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading app config:', error);
      setConfig(defaultConfig);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AppConfigContext.Provider value={{ config, loading }}>
      {children}
    </AppConfigContext.Provider>
  );
};

export default AppConfigContext;
