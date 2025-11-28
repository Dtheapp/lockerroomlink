import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layouts
import Layout from './layout/Layout';
import AdminLayout from './layout/AdminLayout';

// Pages
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import Roster from './components/Roster';
import Playbook from './components/Playbook';
import Chat from './components/Chat';
import VideoLibrary from './components/VideoLibrary';
import Profile from './components/Profile';
import Messenger from './components/Messenger'; 

// Admin Pages
import AdminDashboard from './components/admin/AdminDashboard';
import ManageUsers from './components/admin/ManageUsers';
import ManageTeams from './components/admin/ManageTeams';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

const AppContent: React.FC = () => {
  const { user, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-sky-500"></div>
      </div>
    );
  }

  return (
    <HashRouter>
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
              <Route path="messenger" element={<Messenger />} /> {/* <--- ROUTE ADDED */}
              <Route path="videos" element={<VideoLibrary />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </HashRouter>
  );
};

export default App;