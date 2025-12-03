import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';

// Layouts (loaded immediately as they're structural)
import Layout from './layout/Layout';
import AdminLayout from './layout/AdminLayout';

// Auth Screen (loaded immediately as it's the entry point)
import AuthScreen from './components/AuthScreen';

// Lazy-loaded pages for code splitting (reduces initial bundle size)
const Dashboard = lazy(() => import('./components/Dashboard'));
const Roster = lazy(() => import('./components/Roster'));
const Playbook = lazy(() => import('./components/Playbook'));
const Chat = lazy(() => import('./components/Chat'));
const VideoLibrary = lazy(() => import('./components/VideoLibrary'));
const Profile = lazy(() => import('./components/Profile'));
const Messenger = lazy(() => import('./components/Messenger'));
const Stats = lazy(() => import('./components/Stats'));

// Lazy-loaded Admin Pages
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const ManageUsers = lazy(() => import('./components/admin/ManageUsers'));
const ManageTeams = lazy(() => import('./components/admin/ManageTeams'));
const UserReport = lazy(() => import('./components/admin/UserReport'));
const Announcements = lazy(() => import('./components/admin/Announcements'));
const AppSettings = lazy(() => import('./components/admin/AppSettings'));
const TeamReports = lazy(() => import('./components/admin/TeamReports'));
const ContentModeration = lazy(() => import('./components/admin/ContentModeration'));
const DataManagement = lazy(() => import('./components/admin/DataManagement'));
const EmailCommunication = lazy(() => import('./components/admin/EmailCommunication'));

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
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

const AppContent: React.FC = () => {
  const { user, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-black">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
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
                <Route path="users" element={<ManageUsers />} />
                <Route path="teams" element={<ManageTeams />} />
                <Route path="announcements" element={<Announcements />} />
                <Route path="email" element={<EmailCommunication />} />
                <Route path="moderation" element={<ContentModeration />} />
                <Route path="team-reports" element={<TeamReports />} />
                <Route path="reports" element={<UserReport />} />
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
    </HashRouter>
  );
};

export default App;