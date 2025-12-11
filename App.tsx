import React, { Suspense, lazy, useState, useEffect, ComponentType } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { UnsavedChangesProvider } from './contexts/UnsavedChangesContext';
import { AppConfigProvider, useAppConfig } from './contexts/AppConfigContext';
import { useSportConfig } from './hooks/useSportConfig';
import ErrorBoundary from './components/ErrorBoundary';
import InstallPrompt from './components/InstallPrompt';
import ForcePasswordChange from './components/ForcePasswordChange';
import ReleasedPlayerSetup from './components/ReleasedPlayerSetup';

// Layouts (loaded immediately as they're structural)
import Layout from './layout/Layout';
import AdminLayout from './layout/AdminLayout';
import NewOSYSLayout from './layout/NewOSYSLayout';

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
const PublicAthleteProfile = lazyWithRetry(() => import('./components/public/PublicAthleteProfileV2'));
const PublicTeamProfile = lazyWithRetry(() => import('./components/public/PublicTeamProfile'));
const PublicCoachProfile = lazyWithRetry(() => import('./components/public/PublicCoachProfile'));
const LandingPage = lazyWithRetry(() => import('./components/LandingPage'));
const FundraisingPage = lazyWithRetry(() => import('./components/FundraisingPage'));
const CampaignDetail = lazyWithRetry(() => import('./components/CampaignDetail'));
const NILWalletDashboard = lazyWithRetry(() => import('./components/NILWalletDashboard'));
const NILMarketplace = lazyWithRetry(() => import('./components/NILMarketplace'));

// New OSYS Dashboard with real data
const NewOSYSDashboard = lazyWithRetry(() => import('./components/NewOSYSDashboard'));

// Event System Pages
const EventsPage = lazyWithRetry(() => import('./components/events/EventsPage'));
const EventDetailsPage = lazyWithRetry(() => import('./components/events/EventDetailsPage'));
const EventCreatorPage = lazyWithRetry(() => import('./components/events/EventCreatorPage'));
const EventManagement = lazyWithRetry(() => import('./components/events/EventManagement'));
const RegistrationFlow = lazyWithRetry(() => import('./components/events/registration/RegistrationFlow'));
const SimpleRegistrationPage = lazyWithRetry(() => import('./components/events/SimpleRegistrationPage'));
const SeasonRegistrationPage = lazyWithRetry(() => import('./components/events/SeasonRegistrationPage'));
const PublicEventPage = lazyWithRetry(() => import('./components/events/PublicEventPage'));

// Design Studio
const DesignStudio = lazyWithRetry(() => import('./components/DesignStudio'));

// Marketing Hub
const MarketingHub = lazyWithRetry(() => import('./components/MarketingHub'));

// Progress Tracking Page
const ProgressPage = lazyWithRetry(() => import('./components/ProgressPage'));

// Draft Day Showcase
const DraftDayShowcase = lazyWithRetry(() => import('./components/DraftDayShowcase'));

// Competitor Comparison Page
const ComparisonPage = lazyWithRetry(() => import('./components/ComparisonPage'));

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
const Coaching = lazyWithRetry(() => import('./components/Coaching'));

// Fan Pages
const FanDashboard = lazyWithRetry(() => import('./components/FanDashboard'));
const FanProfile = lazyWithRetry(() => import('./components/FanProfile'));

// Lazy-loaded Admin Pages
const AdminDashboard = lazyWithRetry(() => import('./components/admin/AdminDashboard'));
const AdminMessenger = lazyWithRetry(() => import('./components/admin/AdminMessenger'));
const ManageUsers = lazyWithRetry(() => import('./components/admin/ManageUsers'));
const ManageTeams = lazyWithRetry(() => import('./components/admin/ManageTeams'));
const UserReport = lazyWithRetry(() => import('./components/admin/UserReport'));
const Announcements = lazyWithRetry(() => import('./components/admin/Announcements'));
const AppSettings = lazyWithRetry(() => import('./components/admin/AppSettings'));
const MonetizationSettings = lazyWithRetry(() => import('./components/admin/MonetizationSettings'));
const TeamReports = lazyWithRetry(() => import('./components/admin/TeamReports'));
const ContentModeration = lazyWithRetry(() => import('./components/admin/ContentModeration'));
const DataManagement = lazyWithRetry(() => import('./components/admin/DataManagement'));
const EmailCommunication = lazyWithRetry(() => import('./components/admin/EmailCommunication'));
const ActivityLog = lazyWithRetry(() => import('./components/admin/ActivityLog'));
const CoachFeedback = lazyWithRetry(() => import('./components/admin/CoachFeedback'));
const AdminPlaybook = lazyWithRetry(() => import('./components/admin/AdminPlaybook'));

// Commissioner Pages
const CommissionerSignup = lazyWithRetry(() => import('./components/commissioner/CommissionerSignup'));
const CommissionerDashboard = lazyWithRetry(() => import('./components/commissioner/CommissionerDashboard'));
const CommissionerTeamList = lazyWithRetry(() => import('./components/commissioner/CommissionerTeamList'));
const CommissionerCreateTeam = lazyWithRetry(() => import('./components/commissioner/CommissionerCreateTeam'));
const CommissionerTeamDetail = lazyWithRetry(() => import('./components/commissioner/CommissionerTeamDetail'));
const CommissionerAssignCoach = lazyWithRetry(() => import('./components/commissioner/CommissionerAssignCoach'));
const CommissionerGrievances = lazyWithRetry(() => import('./components/commissioner/CommissionerGrievances'));
const CommissionerInfractions = lazyWithRetry(() => import('./components/commissioner/CommissionerInfractions'));
const TeamScheduleView = lazyWithRetry(() => import('./components/commissioner/TeamScheduleView'));
const CommissionerRoster = lazyWithRetry(() => import('./components/commissioner/CommissionerRoster'));
const CommissionerTeamChat = lazyWithRetry(() => import('./components/commissioner/CommissionerTeamChat'));
const CommissionerAnnouncements = lazyWithRetry(() => import('./components/commissioner/CommissionerAnnouncements'));
const ProgramManager = lazyWithRetry(() => import('./components/commissioner/ProgramManager'));

// League Owner Pages
const LeagueDashboard = lazyWithRetry(() => import('./components/league/LeagueDashboard'));
const LeagueSettings = lazyWithRetry(() => import('./components/league/LeagueSettings'));
const LeaguePrograms = lazyWithRetry(() => import('./components/league/LeaguePrograms'));
const LeagueRequests = lazyWithRetry(() => import('./components/league/LeagueRequests'));
const LeagueSeasons = lazyWithRetry(() => import('./components/league/LeagueSeasons'));
const SeasonSchedule = lazyWithRetry(() => import('./components/league/SeasonSchedule'));
const LeaguePlayoffs = lazyWithRetry(() => import('./components/league/LeaguePlayoffs'));
const LeagueStandings = lazyWithRetry(() => import('./components/league/LeagueStandings'));
const LeagueSignup = lazyWithRetry(() => import('./components/league/LeagueSignup'));
const LeagueInfractions = lazyWithRetry(() => import('./components/league/LeagueInfractions'));

// Public Pages
const PublicLeaguePage = lazyWithRetry(() => import('./components/public/PublicLeaguePage'));
const PublicRefereePage = lazyWithRetry(() => import('./components/referee/PublicRefereePage'));

// Referee Pages
const RefereeSignup = lazyWithRetry(() => import('./components/referee/RefereeSignup'));
const RefereeDashboard = lazyWithRetry(() => import('./components/referee/RefereeDashboard'));
const RefereeSchedule = lazyWithRetry(() => import('./components/referee/RefereeSchedule'));
const RefereeGameView = lazyWithRetry(() => import('./components/referee/RefereeGameViewWrapper'));
const RefereeVerificationSubmit = lazyWithRetry(() => import('./components/referee/RefereeVerificationSubmit'));
const RefereePayments = lazyWithRetry(() => import('./components/referee/RefereePayments'));

// Admin Referee Pages
const AdminRefereeVerification = lazyWithRetry(() => import('./components/admin/AdminRefereeVerification'));

// Shared UI Pages
const NotificationsPage = lazyWithRetry(() => import('./components/ui/NotificationsPage'));

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
          <AppConfigProvider>
            <AppContent />
            <InstallPrompt />
          </AppConfigProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

const AppContent: React.FC = () => {
  const { user, userData, loading } = useAuth();
  const { config } = useAppConfig();
  const { hasPlaybook } = useSportConfig();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showAccountSetup, setShowAccountSetup] = useState(false);
  const [passwordChangeComplete, setPasswordChangeComplete] = useState(false);

  // Check if user needs to change password or complete account setup (released players)
  useEffect(() => {
    if (userData) {
      if ((userData as any).forceAccountSetup === true && !passwordChangeComplete) {
        setShowAccountSetup(true);
        setShowPasswordChange(false);
      } else if ((userData as any).mustChangePassword === true && !passwordChangeComplete) {
        setShowPasswordChange(true);
        setShowAccountSetup(false);
      } else {
        setShowPasswordChange(false);
        setShowAccountSetup(false);
      }
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

  // Show released player account setup if needed
  if (showAccountSetup && user && userData) {
    return (
      <ReleasedPlayerSetup 
        playerName={userData.name || 'Athlete'}
        onComplete={() => {
          setPasswordChangeComplete(true);
          setShowAccountSetup(false);
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
          <Route path="/coach/:username" element={<PublicCoachProfile />} />
          <Route path="/league/:leagueId" element={<PublicLeaguePage />} />
          <Route path="/referee/:refereeId" element={<PublicRefereePage />} />
          <Route path="/event/:eventId" element={<PublicEventPage />} />
          <Route path="/e/:shareableLink" element={<PublicEventPage />} />
          <Route path="/register/:seasonId" element={<SeasonRegistrationPage />} />
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/fundraising" element={<FundraisingPage />} />
          <Route path="/fundraising/:campaignId" element={<CampaignDetail />} />
          <Route path="/nil-wallet" element={<NILWalletDashboard />} />
          <Route path="/nil-marketplace" element={<NILMarketplace />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/draft" element={<DraftDayShowcase />} />
          <Route path="/compare" element={<ComparisonPage />} />
          
          {!user ? (
            <>
              <Route path="/auth" element={<AuthScreen />} />
              <Route path="/" element={<LandingPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
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
                <Route path="playbook" element={<AdminPlaybook />} />
                <Route path="monetization" element={<MonetizationSettings />} />
                <Route path="referee-verification" element={<AdminRefereeVerification />} />
                <Route path="settings" element={<AppSettings />} />
              </Route>
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </>
          ) : userData?.role === 'Fan' ? (
            // Fan-specific routes - simplified navigation
            <>
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<FanDashboard />} />
                <Route path="profile" element={<FanProfile />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="events/:eventId/register" element={<SimpleRegistrationPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </>
          ) : (userData?.role === 'LeagueCommissioner' || userData?.role === 'TeamCommissioner' || userData?.role === 'ProgramCommissioner' || userData?.role === 'Commissioner') ? (
            // Commissioner routes (Team or League)
            <>
              <Route path="/" element={<NewOSYSLayout />}>
                <Route index element={<Navigate to="/commissioner" replace />} />
                <Route path="commissioner" element={<CommissionerDashboard />} />
                <Route path="commissioner/programs" element={<ProgramManager />} />
                <Route path="commissioner/teams" element={<CommissionerTeamList />} />
                <Route path="commissioner/teams/create" element={<CommissionerCreateTeam />} />
                <Route path="commissioner/teams/:teamId" element={<CommissionerTeamDetail />} />
                <Route path="commissioner/teams/:teamId/assign-coach" element={<CommissionerAssignCoach />} />
                <Route path="commissioner/roster" element={<CommissionerRoster />} />
                <Route path="commissioner/announcements" element={<CommissionerAnnouncements />} />
                <Route path="commissioner/chat" element={<CommissionerTeamChat />} />
                <Route path="commissioner/grievances" element={<CommissionerGrievances />} />
                <Route path="commissioner/infractions" element={<CommissionerInfractions />} />
                <Route path="team/:teamId" element={<CommissionerTeamDetail />} />
                <Route path="profile" element={<Profile />} />
                <Route path="notifications" element={<NotificationsPage />} />
                {config.messengerEnabled && <Route path="messenger" element={<Messenger />} />}
              </Route>
              <Route path="*" element={<Navigate to="/commissioner" replace />} />
            </>
          ) : userData?.role === 'LeagueOwner' ? (
            // League Owner routes - manages entire league with programs and schedules
            <>
              <Route path="/" element={<NewOSYSLayout />}>
                <Route index element={<Navigate to="/league" replace />} />
                <Route path="league" element={<LeagueDashboard />} />
                <Route path="league/settings" element={<LeagueSettings />} />
                <Route path="league/programs" element={<LeaguePrograms />} />
                <Route path="league/requests" element={<LeagueRequests />} />
                <Route path="league/seasons" element={<LeagueSeasons />} />
                <Route path="league/seasons/:seasonId" element={<SeasonSchedule />} />
                <Route path="league/playoffs" element={<LeaguePlayoffs />} />
                <Route path="league/infractions" element={<LeagueInfractions />} />
                <Route path="league/standings" element={<LeagueStandings />} />
                <Route path="profile" element={<Profile />} />
                <Route path="notifications" element={<NotificationsPage />} />
                {config.messengerEnabled && <Route path="messenger" element={<Messenger />} />}
              </Route>
              <Route path="*" element={<Navigate to="/league" replace />} />
            </>
          ) : userData?.role === 'Referee' ? (
            // Referee routes - officiating games
            <>
              <Route path="/" element={<NewOSYSLayout />}>
                <Route index element={<Navigate to="/referee" replace />} />
                <Route path="referee" element={<RefereeDashboard />} />
                <Route path="referee/schedule" element={<RefereeSchedule />} />
                <Route path="referee/game/:assignmentId" element={<RefereeGameView />} />
                <Route path="referee/verification" element={<RefereeVerificationSubmit />} />
                <Route path="referee/payments" element={<RefereePayments />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="profile" element={<Profile />} />
                {config.messengerEnabled && <Route path="messenger" element={<Messenger />} />}
              </Route>
              <Route path="*" element={<Navigate to="/referee" replace />} />
            </>
          ) : (
            // Coach/Parent routes - NEW OSYS Layout
            <>
              <Route path="/" element={<NewOSYSLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<NewOSYSDashboard />} />
                <Route path="roster" element={<Roster />} />
                {config.playbookEnabled && hasPlaybook && <Route path="playbook" element={<Playbook />} />}
                {config.chatEnabled && <Route path="chat" element={<Chat />} />}
                {config.chatEnabled && <Route path="strategies" element={<Strategies />} />}
                {config.messengerEnabled && <Route path="messenger" element={<Messenger />} />}
                {config.videoLibraryEnabled && <Route path="videos" element={<VideoLibrary />} />}
                <Route path="profile" element={<Profile />} />
                <Route path="notifications" element={<NotificationsPage />} />
                {config.statsEnabled && <Route path="stats" element={<Stats />} />}
                {config.playbookEnabled && hasPlaybook && <Route path="coaching" element={<Coaching />} />}
                {/* Events System Routes */}
                <Route path="events" element={<EventsPage />} />
                <Route path="events/create" element={<EventCreatorPage />} />
                <Route path="events/:eventId" element={<EventDetailsPage />} />
                <Route path="events/:eventId/edit" element={<EventCreatorPage />} />
                <Route path="events/:eventId/manage" element={<EventManagement />} />
                <Route path="events/:eventId/register" element={<SimpleRegistrationPage />} />
                {/* Design Studio */}
                <Route path="design" element={<DesignStudio />} />
                {/* Marketing Hub */}
                <Route path="marketing" element={<MarketingHub />} />
                {/* Commissioner Signup for users who want to become commissioners */}
                <Route path="commissioner/signup" element={<CommissionerSignup />} />
                {/* League Signup for users who want to create a league */}
                <Route path="league/signup" element={<LeagueSignup />} />
                {/* Referee Signup for users who want to become referees */}
                <Route path="referee/signup" element={<RefereeSignup />} />
              </Route>
              {/* Keep old demo route for reference */}
              <Route path="/old-dashboard" element={<Layout />}>
                <Route index element={<Dashboard />} />
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