import React, { Suspense, lazy, useState, useEffect, ComponentType } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { UnsavedChangesProvider } from './contexts/UnsavedChangesContext';
import ErrorBoundary from './components/ErrorBoundary';
import InstallPrompt from './components/InstallPrompt';
import ForcePasswordChange from './components/ForcePasswordChange';

// Layouts (loaded immediately as they're structural)
import Layout from './layout/Layout';
import AdminLayout from './layout/AdminLayout';

// Auth Screen (loaded immediately as it's the entry point)
import AuthScreen from './components/AuthScreen';

// Helper to handle chunk load errors (stale cache after deployments)
// Automatically retries once with cache-busting, then prompts for refresh
function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error: any) {
      // Check if it's a chunk load error
      const isChunkError = 
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('Loading CSS chunk') ||
        error?.name === 'ChunkLoadError';
      
      if (isChunkError) {
        console.warn('Chunk load error detected, reloading...', error);
        // Store flag to prevent infinite reload loop
        const lastReload = sessionStorage.getItem('lastChunkReload');
        const now = Date.now();
        
        if (!lastReload || now - parseInt(lastReload) > 10000) {
          // Only reload if we haven't reloaded in the last 10 seconds
          sessionStorage.setItem('lastChunkReload', now.toString());
          window.location.reload();
        }
      }
      
      throw error;
    }
  });
}

// Public Pages (accessible without auth)
const PublicAthleteProfile = lazyWithRetry(() => import('./components/public/PublicAthleteProfile'));
const PublicTeamProfile = lazyWithRetry(() => import('./components/public/PublicTeamProfile'));
const PublicCoachProfile = lazyWithRetry(() => import('./components/public/PublicCoachProfile'));

// Lazy-loaded pages for code splitting (reduces initial bundle size)
const Dashboard = lazyWithRetry(() => import('./components/Dashboard'));
const Roster = lazyWithRetry(() => import('./components/Roster'));
const Playbook = lazyWithRetry(() => import('./components/Playbook'));
const Chat = lazyWithRetry(() => import('./components/Chat'));
const Strategies = lazyWithRetry(() => import('./components/Strategies'));
const VideoLibrary = lazyWithRetry(() => import('./components/VideoLibrary'));
const Profile = lazyWithRetry(() => import('./components/Profile'));
const Messenger = lazyWithRetry(() => import('./components/Messenger'));
const Stats = lazyWithRetry(() => import('./components/Stats'));

// Lazy-loaded Admin Pages
const AdminDashboard = lazyWithRetry(() => import('./components/admin/AdminDashboard'));
const AdminMessenger = lazyWithRetry(() => import('./components/admin/AdminMessenger'));
const ManageUsers = lazyWithRetry(() => import('./components/admin/ManageUsers'));
const ManageTeams = lazyWithRetry(() => import('./components/admin/ManageTeams'));
const UserReport = lazyWithRetry(() => import('./components/admin/UserReport'));
const Announcements = lazyWithRetry(() => import('./components/admin/Announcements'));
const AppSettings = lazyWithRetry(() => import('./components/admin/AppSettings'));
const TeamReports = lazyWithRetry(() => import('./components/admin/TeamReports'));
const ContentModeration = lazyWithRetry(() => import('./components/admin/ContentModeration'));
const DataManagement = lazyWithRetry(() => import('./components/admin/DataManagement'));
const EmailCommunication = lazyWithRetry(() => import('./components/admin/EmailCommunication'));
const ActivityLog = lazyWithRetry(() => import('./components/admin/ActivityLog'));
const CoachFeedback = lazyWithRetry(() => import('./components/admin/CoachFeedback'));

// Loading fallback for lazy-loaded components
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
  </div>
);

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
          <InstallPrompt />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

const AppContent: React.FC = () => {
  const { user, userData, loading } = useAuth();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordChangeComplete, setPasswordChangeComplete] = useState(false);

  // Check if user needs to change password
  useEffect(() => {
    if (userData && (userData as any).mustChangePassword === true && !passwordChangeComplete) {
      setShowPasswordChange(true);
    } else {
      setShowPasswordChange(false);
    }
  }, [userData, passwordChangeComplete]);

  // Debug logging for SuperAdmin issues
  console.log('AppContent Debug:', { 
    user: user?.email, 
    userData: userData ? { role: userData.role, name: userData.name, uid: userData.uid, mustChangePassword: (userData as any).mustChangePassword } : null, 
    loading 
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-black">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
      </div>
    );
  }

  // Show forced password change modal if needed
  if (showPasswordChange && user) {
    return (
      <ForcePasswordChange 
        onComplete={() => {
          setPasswordChangeComplete(true);
          setShowPasswordChange(false);
        }} 
      />
    );
  }

  return (
    <HashRouter>
      <UnsavedChangesProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes - Always accessible */}
          <Route path="/athlete/:username" element={<PublicAthleteProfile />} />
          <Route path="/team/:teamId" element={<PublicTeamProfile />} />
          <Route path="/coach/:coachId" element={<PublicCoachProfile />} />
          
          {!user ? (
            <>
              <Route path="/auth" element={<AuthScreen />} />
              <Route path="*" element={<Navigate to="/auth" replace />} />
            </>
          ) : userData?.role === 'SuperAdmin' ? (
            <>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="messenger" element={<AdminMessenger />} />
                <Route path="users" element={<ManageUsers />} />
                <Route path="teams" element={<ManageTeams />} />
                <Route path="announcements" element={<Announcements />} />
                <Route path="email" element={<EmailCommunication />} />
                <Route path="moderation" element={<ContentModeration />} />
                <Route path="coach-feedback" element={<CoachFeedback />} />
                <Route path="team-reports" element={<TeamReports />} />
                <Route path="reports" element={<UserReport />} />
                <Route path="activity" element={<ActivityLog />} />
                <Route path="data" element={<DataManagement />} />
                <Route path="stats" element={<Stats />} />
                <Route path="settings" element={<AppSettings />} />
              </Route>
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="roster" element={<Roster />} />
                <Route path="playbook" element={<Playbook />} />
                <Route path="chat" element={<Chat />} />
                <Route path="strategies" element={<Strategies />} />
                <Route path="messenger" element={<Messenger />} />
                <Route path="videos" element={<VideoLibrary />} />
                <Route path="profile" element={<Profile />} />
                <Route path="stats" element={<Stats />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </Suspense>
      </UnsavedChangesProvider>
    </HashRouter>
  );
};

export default App;