import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useSportConfig } from '../hooks/useSportConfig';
import { useCredits } from '../hooks/useCredits';
import TeamSelector from '../components/TeamSelector';
import PlayerSelector from '../components/PlayerSelector';
import { AnimatedBackground, Avatar } from '../components/ui/OSYSComponents';
import { Menu, X, LogOut, Sun, Moon, ChevronDown, ChevronLeft, ChevronRight, Coins, ShoppingBag } from 'lucide-react';
import WelcomeModal from '../components/WelcomeModal';
import FeedbackButton from '../components/ui/FeedbackButton';

const NewOSYSLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { teamData, userData } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { config } = useAppConfig();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const { unread, markAsRead } = useUnreadMessages();
  const { hasPlaybook } = useSportConfig();
  const { balance: creditBalance, loading: creditsLoading } = useCredits();
  const [showBuyCreditsModal, setShowBuyCreditsModal] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    // Load collapsed state from localStorage
    const saved = localStorage.getItem('osys_sidebar_collapsed');
    return saved === 'true';
  });
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showComingSoonToast, setShowComingSoonToast] = useState(false);
  
  // Ref for scrolling main content
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Save collapsed state to localStorage
  const toggleSidebarCollapse = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('osys_sidebar_collapsed', String(newState));
  };

  // Check if user has seen welcome modal
  useEffect(() => {
    if (userData?.uid) {
      const hasSeenWelcome = localStorage.getItem(`osys_welcome_seen_${userData.uid}`);
      if (!hasSeenWelcome) {
        // Small delay to let the app settle
        const timer = setTimeout(() => setShowWelcomeModal(true), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [userData?.uid]);

  // Mark chats as read when visiting those pages
  useEffect(() => {
    if (location.pathname === '/chat') {
      markAsRead('teamChat');
    } else if (location.pathname === '/strategies') {
      markAsRead('strategy');
    }
  }, [location.pathname, markAsRead]);

  // Handle navigation click with unsaved changes check
  const handleNavClick = (e: React.MouseEvent, path: string) => {
    if (location.pathname === path) {
      setIsSidebarOpen(false);
      return;
    }
    
    if (hasUnsavedChanges) {
      e.preventDefault();
      setPendingNavPath(path);
      setShowUnsavedModal(true);
    } else {
      setIsSidebarOpen(false);
    }
  };

  // Handle confirm leave (discard changes)
  const handleConfirmLeave = () => {
    setHasUnsavedChanges(false);
    setShowUnsavedModal(false);
    setIsSidebarOpen(false);
    if (pendingNavPath) {
      navigate(pendingNavPath);
      setPendingNavPath(null);
    }
  };

  // Handle cancel (stay on page)
  const handleCancelLeave = () => {
    setShowUnsavedModal(false);
    setPendingNavPath(null);
  };

  // Handle logo click - navigate to dashboard AND scroll to top
  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (hasUnsavedChanges && location.pathname !== '/dashboard') {
      setPendingNavPath('/dashboard');
      setShowUnsavedModal(true);
      return;
    }
    
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard');
    }
    
    setIsSidebarOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Navigation items based on role and config
  const getNavItems = () => {
    const items = [
      { icon: '📊', label: 'Dashboard', path: '/dashboard', section: 'Main' },
      { icon: '📋', label: 'Playbook', path: '/playbook', section: 'Main', configKey: 'playbookEnabled', hideForParent: true },
      { icon: '👥', label: 'Roster', path: '/roster', section: 'Main' },
      { icon: '📅', label: 'Schedule', path: '/events', section: 'Main' },
      { icon: '🎨', label: 'Design Studio', path: '/design', section: 'Create', coachOnly: true },
      { icon: '📢', label: 'Marketing', path: '/marketing', section: 'Create' },
      { icon: '💬', label: 'Messages', path: '/messenger', section: 'Engage', configKey: 'messengerEnabled', unreadKey: 'messenger' },
      { icon: '🗨️', label: 'Team Chat', path: '/chat', section: 'Engage', configKey: 'chatEnabled', unreadKey: 'teamChat' },
      { icon: '🛡️', label: 'Strategy', path: '/strategies', section: 'Engage', configKey: 'chatEnabled', coachOnly: true, unreadKey: 'strategy' },
      { icon: '📺', label: 'Film Room', path: '/videos', section: 'Engage', configKey: 'videoLibraryEnabled' },
      { icon: '📈', label: 'Stats', path: '/stats', section: 'Analyze', configKey: 'statsEnabled' },
      { icon: '📓', label: 'My Plays', path: '/coaching', section: 'Analyze', configKey: 'playbookEnabled', coachOnly: true },
      { icon: '🛒', label: 'Marketplace', path: '#marketplace', section: 'Shop', comingSoon: true },
    ];

    // Filter by config and role
    return items.filter(item => {
      if (item.configKey && !config[item.configKey as keyof typeof config]) return false;
      // Check sport-specific playbook feature
      if (item.configKey === 'playbookEnabled' && !hasPlaybook) return false;
      if (item.coachOnly && userData?.role !== 'Coach') return false;
      if (item.hideForParent && userData?.role === 'Parent') return false;
      return true;
    });
  };

  const navItems = getNavItems();
  const sections = ['Main', 'Create', 'Engage', 'Analyze', 'Shop'];

  const hasUnread = (key?: string): boolean => {
    if (!key) return false;
    return !!unread[key as keyof typeof unread];
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-slate-950 text-white' 
        : 'bg-slate-100 text-slate-900'
    }`}>
      {theme === 'dark' && <AnimatedBackground />}

      {/* Mobile Header */}
      <div className={`lg:hidden fixed top-0 left-0 right-0 h-16 backdrop-blur-xl border-b flex items-center justify-between px-4 z-50 ${
        theme === 'dark'
          ? 'bg-slate-900/80 border-white/10'
          : 'bg-white/80 border-slate-200'
      }`}>
        <button onClick={handleLogoClick} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg text-white">
            ⚡
          </div>
          <span className="font-bold text-lg">OSYS</span>
        </button>
        <button 
          onClick={() => setIsSidebarOpen(true)} 
          className={`p-2 rounded-lg transition ${
            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-200'
          }`}
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 z-50"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Collapse Toggle Button - Desktop only - positioned OUTSIDE sidebar on right edge */}
      <button
        onClick={toggleSidebarCollapse}
        className={`hidden lg:flex fixed top-20 w-8 h-8 rounded-full border-2 items-center justify-center transition-all z-[60] shadow-lg ${
          theme === 'dark' 
            ? 'bg-slate-800 border-orange-500/50 hover:bg-slate-700 hover:border-orange-400 text-orange-400' 
            : 'bg-white border-purple-400 hover:bg-purple-50 hover:border-purple-500 text-purple-600 shadow-purple-200'
        }`}
        style={{ left: isSidebarCollapsed ? '48px' : '248px' }}
        title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 backdrop-blur-xl border-r
        transform transition-all duration-300 ease-in-out
        lg:translate-x-0 overflow-y-auto
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isSidebarCollapsed ? 'lg:w-16' : 'lg:w-64'} w-64
        ${theme === 'dark' 
          ? 'bg-slate-900/95 border-white/10' 
          : 'bg-white/95 border-slate-200'
        }
      `}>
        {/* Logo */}
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-white/10' : 'border-slate-200'
        }`}>
          <button onClick={handleLogoClick} className={`flex items-center gap-3 hover:opacity-80 transition-opacity ${isSidebarCollapsed ? 'lg:justify-center lg:w-full' : ''}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl shadow-lg shadow-purple-500/30 text-white">
              ⚡
            </div>
            {!isSidebarCollapsed && <span className="font-bold text-xl tracking-tight lg:block">OSYS</span>}
            {isSidebarCollapsed && <span className="font-bold text-xl tracking-tight lg:hidden">OSYS</span>}
          </button>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className={`lg:hidden p-2 rounded-lg ${
              theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Team Selector (for Coaches) or Player Selector (for Parents) */}
        <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'} ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>
          {userData?.role === 'Parent' ? (
            // Player Selector for Parents
            <PlayerSelector />
          ) : (
            // Team Selector for Coaches
            <>
              <button 
                onClick={() => setShowTeamSelector(!showTeamSelector)}
                className={`w-full p-3 rounded-xl border transition flex items-center gap-3 ${
                  theme === 'dark'
                    ? 'bg-white/5 hover:bg-white/10 border-white/10'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200'
                }`}
              >
                <Avatar name={teamData?.name || 'Team'} size="sm" />
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium truncate">{teamData?.name || 'Select Team'}</div>
                  <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{userData?.role || 'Coach'}</div>
                </div>
                <ChevronDown className={`w-4 h-4 transition ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                } ${showTeamSelector ? 'rotate-180' : ''}`} />
              </button>
              
              {showTeamSelector && (
                <div className="mt-2">
                  <TeamSelector />
                </div>
              )}
            </>
          )}
        </div>

        {/* Credits Display - Top Priority */}
        <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'} ${isSidebarCollapsed ? 'lg:p-2' : ''}`}>
          <button
            onClick={() => navigate('/profile', { state: { openTab: 'credits' } })}
            title={isSidebarCollapsed ? `${creditBalance ?? 0} Credits` : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              isSidebarCollapsed ? 'lg:justify-center lg:px-2' : ''
            } ${
              theme === 'dark'
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 hover:border-amber-500/50 text-amber-400'
                : 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 hover:border-amber-300 text-amber-700'
            }`}
          >
            <Coins className="w-5 h-5" />
            {!isSidebarCollapsed && (
              <div className="flex-1 flex items-center justify-between lg:flex">
                <span className="text-sm font-medium">Credits</span>
                <span className={`text-sm font-bold ${
                  (creditBalance ?? 0) < 10 
                    ? 'text-red-400 animate-pulse' 
                    : theme === 'dark' ? 'text-amber-300' : 'text-amber-600'
                }`}>
                  {creditsLoading ? '...' : (creditBalance ?? 0)}
                </span>
              </div>
            )}
            {isSidebarCollapsed && (
              <div className="flex-1 flex items-center justify-between lg:hidden">
                <span className="text-sm font-medium">Credits</span>
                <span className={`text-sm font-bold ${
                  (creditBalance ?? 0) < 10 
                    ? 'text-red-400 animate-pulse' 
                    : theme === 'dark' ? 'text-amber-300' : 'text-amber-600'
                }`}>
                  {creditsLoading ? '...' : (creditBalance ?? 0)}
                </span>
              </div>
            )}
          </button>
          {!isSidebarCollapsed && (creditBalance ?? 0) < 10 && (
            <p className={`text-xs mt-1.5 px-1 ${theme === 'dark' ? 'text-amber-400/70' : 'text-amber-600/70'}`}>
              ⚠️ Low credits! Buy more to continue using premium features.
            </p>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${isSidebarCollapsed ? 'lg:p-2' : 'p-4'}`}>
          {sections.map(section => {
            const sectionItems = navItems.filter(item => item.section === section);
            if (sectionItems.length === 0) return null;
            
            return (
              <div key={section} className="mb-6">
                {!isSidebarCollapsed && (
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-3 lg:block">{section}</div>
                )}
                {isSidebarCollapsed && (
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-3 lg:hidden">{section}</div>
                )}
                {sectionItems.map(item => {
                  const isActive = location.pathname === item.path;
                  const showUnread = hasUnread(item.unreadKey);
                  
                  // Handle "Coming Soon" items differently
                  if (item.comingSoon) {
                    return (
                      <button
                        key={item.path + item.label}
                        onClick={() => {
                          setShowComingSoonToast(true);
                          setTimeout(() => setShowComingSoonToast(false), 3000);
                        }}
                        title={isSidebarCollapsed ? item.label : undefined}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all
                          ${isSidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}
                          ${theme === 'dark'
                            ? 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                          }
                        `}
                      >
                        <span className="text-lg opacity-60">{item.icon}</span>
                        {!isSidebarCollapsed && (
                          <span className="flex-1 lg:block flex items-center gap-2">
                            {item.label}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                            }`}>Soon</span>
                          </span>
                        )}
                        {isSidebarCollapsed && <span className="flex-1 lg:hidden">{item.label}</span>}
                      </button>
                    );
                  }
                  
                  return (
                    <NavLink
                      key={item.path + item.label}
                      to={item.path}
                      onClick={(e) => handleNavClick(e, item.path)}
                      title={isSidebarCollapsed ? item.label : undefined}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all
                        ${isSidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}
                        ${isActive 
                          ? theme === 'dark'
                            ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-white border border-purple-500/30 shadow-lg shadow-purple-500/10' 
                            : 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border border-purple-300'
                          : theme === 'dark'
                            ? 'text-slate-400 hover:text-white hover:bg-white/5'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }
                      `}
                    >
                      <span className="text-lg">{item.icon}</span>
                      {!isSidebarCollapsed && <span className="flex-1 lg:block">{item.label}</span>}
                      {isSidebarCollapsed && <span className="flex-1 lg:hidden">{item.label}</span>}
                      {showUnread && (
                        <span className={`w-2 h-2 rounded-full bg-purple-500 animate-pulse ${isSidebarCollapsed ? 'lg:absolute lg:top-1 lg:right-1' : ''}`} />
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className={`p-4 border-t space-y-2 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'} ${isSidebarCollapsed ? 'lg:p-2' : ''}`}>
          <NavLink
            to="/profile"
            onClick={(e) => handleNavClick(e, '/profile')}
            title={isSidebarCollapsed ? 'Settings' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
              ${isSidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}
              ${location.pathname === '/profile' 
                ? theme === 'dark' ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-900'
                : theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }
            `}
          >
            <span className="text-lg">⚙️</span>
            {!isSidebarCollapsed && <span className="lg:block">Settings</span>}
            {isSidebarCollapsed && <span className="lg:hidden">Settings</span>}
          </NavLink>
          
          <button
            onClick={toggleTheme}
            title={isSidebarCollapsed ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              isSidebarCollapsed ? 'lg:justify-center lg:px-2' : ''
            } ${
              theme === 'dark' 
                ? 'text-slate-400 hover:text-white hover:bg-white/5' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {!isSidebarCollapsed && <span className="lg:block">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
            {isSidebarCollapsed && <span className="lg:hidden">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          
          <button
            onClick={handleSignOut}
            title={isSidebarCollapsed ? 'Sign Out' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              isSidebarCollapsed ? 'lg:justify-center lg:px-2' : ''
            } ${
              theme === 'dark'
                ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                : 'text-slate-600 hover:text-red-600 hover:bg-red-50'
            }`}
          >
            <LogOut className="w-5 h-5" />
            {!isSidebarCollapsed && <span className="lg:block">Sign Out</span>}
            {isSidebarCollapsed && <span className="lg:hidden">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main ref={mainContentRef} className={`${isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} min-h-screen pt-16 lg:pt-0 overflow-y-auto transition-all`}>
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Unsaved Changes Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className={`p-6 rounded-2xl max-w-sm mx-4 ${
            theme === 'dark' 
              ? 'bg-slate-900 border border-white/10' 
              : 'bg-white border border-slate-200 shadow-xl'
          }`}>
            <div className="text-2xl mb-2">⚠️</div>
            <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Unsaved Changes
            </h3>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelLeave}
                className={`flex-1 px-4 py-2 rounded-lg transition ${
                  theme === 'dark' 
                    ? 'bg-white/10 hover:bg-white/20 text-white' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                }`}
              >
                Stay
              </button>
              <button
                onClick={handleConfirmLeave}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Modal for new users */}
      {showWelcomeModal && (
        <WelcomeModal onClose={() => setShowWelcomeModal(false)} />
      )}

      {/* Coming Soon Toast */}
      {showComingSoonToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-bounce-in">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 ${
            theme === 'dark' 
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' 
              : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
          }`}>
            <span className="text-2xl">🚀</span>
            <div>
              <p className="font-semibold">Marketplace Coming Soon!</p>
              <p className="text-sm opacity-90">We're building something awesome for you.</p>
            </div>
          </div>
        </div>
      )}

      {/* Floating Feedback Button */}
      <FeedbackButton />
    </div>
  );
};

export default NewOSYSLayout;
