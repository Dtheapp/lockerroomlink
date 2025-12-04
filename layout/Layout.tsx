import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Home, Users, ClipboardList, MessageCircle, Video, LogOut, User, Send, Menu, X, ChevronLeft, Sun, Moon, BarChart3, Shield, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import PlayerSelector from '../components/PlayerSelector';
import TeamSelector from '../components/TeamSelector';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { teamData, userData } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const { unread, markAsRead } = useUnreadMessages();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
  
  // Ref for main content scrolling
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Mark chats as read when visiting those pages
  useEffect(() => {
    if (location.pathname === '/chat') {
      markAsRead('teamChat');
    } else if (location.pathname === '/strategies') {
      markAsRead('strategy');
    }
    // Messenger handles its own read status per conversation
  }, [location.pathname]);

  // Handle navigation click with unsaved changes check
  const handleNavClick = (e: React.MouseEvent, path: string) => {
    // If navigating to the same page, no need to check
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
    
    // Check for unsaved changes
    if (hasUnsavedChanges && location.pathname !== '/dashboard') {
      setPendingNavPath('/dashboard');
      setShowUnsavedModal(true);
      return;
    }
    
    // Always scroll to top
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // Navigate to dashboard if not already there
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard');
    }
    
    // Close mobile sidebar if open
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

  const allNavItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Roster', path: '/roster', icon: Users },
    { name: 'Playbook', path: '/playbook', icon: ClipboardList },
    { name: 'Team Chat', path: '/chat', icon: MessageCircle, unreadKey: 'teamChat' as const },
    { name: 'Strategy', path: '/strategies', icon: Shield, coachOnly: true, unreadKey: 'strategy' as const },
    { name: 'Messenger', path: '/messenger', icon: Send, unreadKey: 'messenger' as const },
    { name: 'Film Room', path: '/videos', icon: Video },
    { name: 'Stats', path: '/stats', icon: BarChart3 },
    { name: 'Profile', path: '/profile', icon: User }, 
  ];

  const navItems = allNavItems.filter(item => {
      if (item.name === 'Playbook' && userData?.role === 'Parent') return false;
      if ((item as any).coachOnly && userData?.role !== 'Coach') return false;
      return true;
  });

  const navLinkClasses = 'flex items-center p-3 my-1 rounded-lg transition-all duration-200 whitespace-nowrap overflow-hidden';
  const activeClasses = 'bg-orange-600 text-white shadow-[0_0_15px_rgba(234,88,12,0.5)] border border-orange-500/50';
  const inactiveClasses = 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900 hover:text-orange-500 dark:hover:text-orange-400';

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black overflow-hidden transition-colors duration-200 font-sans">
      
      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between px-4 z-40 shadow-sm">
          <button onClick={handleLogoClick} className="text-xl font-black tracking-tighter hover:opacity-80 transition-opacity">
            <span className="text-orange-500">LOCKER</span><span className="text-zinc-900 dark:text-white">ROOM</span>
          </button>
          <button onClick={() => setIsSidebarOpen(true)} className="text-zinc-600 dark:text-zinc-300">
              <Menu className="w-8 h-8" />
          </button>
      </div>

      {/* SIDEBAR */}
      <aside className={`
          fixed inset-y-0 left-0 z-50 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-900 
          transition-all duration-300 ease-in-out flex flex-col p-4 shadow-2xl
          md:relative md:translate-x-0 md:shadow-none
          ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'} 
          ${isDesktopCollapsed ? 'md:w-20' : 'md:w-64'}
      `}>
        
        <div className="flex items-center justify-between mb-8 h-10">
            {!isDesktopCollapsed && (
                <button onClick={handleLogoClick} className="min-w-0 hover:opacity-80 transition-opacity text-left">
                    {/* FIX: Split Logo Color Logic */}
                    <div className="text-2xl font-black tracking-tighter truncate leading-none">
                        <span className="text-orange-500">LOCKER</span>
                        <span className="text-zinc-900 dark:text-white">ROOM</span>
                    </div>
                </button>
            )}
            {isDesktopCollapsed && (
                <button onClick={handleLogoClick} className="mx-auto hover:opacity-80 transition-opacity" title="Go to Dashboard">
                    <span className="text-xl font-black text-orange-500">L</span>
                    <span className="text-xl font-black text-zinc-900 dark:text-white">R</span>
                </button>
            )}
            
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-500 hover:text-red-500">
                <X className="w-6 h-6" />
            </button>

            <button 
                onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)} 
                className="hidden md:block text-zinc-400 hover:text-orange-500 transition-transform"
            >
                <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${isDesktopCollapsed ? 'rotate-180' : ''}`} />
            </button>
        </div>

        {/* TEAM SELECTOR (For coaches with multiple teams) */}
        {!isDesktopCollapsed && userData?.role === 'Coach' && (
          <div className="mb-4">
            <TeamSelector />
          </div>
        )}

        {/* PLAYER SELECTOR (Compact version for sidebar) */}
        {!isDesktopCollapsed && userData?.role === 'Parent' && (
          <div className="mb-4">
            <PlayerSelector />
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const hasUnread = item.unreadKey && unread[item.unreadKey];
            // On mobile, always show full nav items (isSidebarOpen means mobile menu is open)
            // On desktop, respect isDesktopCollapsed
            const showLabel = isSidebarOpen || !isDesktopCollapsed;
            
            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={(e) => handleNavClick(e, item.path)} 
                className={({ isActive }) => `${navLinkClasses} ${isActive ? activeClasses : inactiveClasses} relative`}
                title={!showLabel ? item.name : ''}
              >
                <div className="relative flex-shrink-0">
                  <item.icon className="w-5 h-5" />
                  {hasUnread && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-950 animate-pulse" />
                  )}
                </div>
                {showLabel && (
                  <span className="ml-3 font-medium">{item.name}</span>
                )}
                {hasUnread && showLabel && (
                  <span className="ml-auto w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </NavLink>
            );
          })}
        </nav>
        
        <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-900 space-y-2 flex-shrink-0">
            {/* Same logic: show labels on mobile (sidebar open) or desktop expanded */}
            {(() => {
              const showLabel = isSidebarOpen || !isDesktopCollapsed;
              return (
                <>
                  <button 
                      onClick={toggleTheme} 
                      className={`${navLinkClasses} ${inactiveClasses} w-full`}
                      title={!showLabel ? 'Toggle Theme' : ''}
                  >
                      {theme === 'dark' ? <Sun className="w-5 h-5 flex-shrink-0"/> : <Moon className="w-5 h-5 flex-shrink-0"/>}
                      {showLabel && (
                        <span className="ml-3 font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                      )}
                  </button>

                  <button 
                      onClick={handleSignOut} 
                      className={`${navLinkClasses} ${inactiveClasses} w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}
                      title={!showLabel ? 'Sign Out' : ''}
                  >
                      <LogOut className="w-5 h-5 flex-shrink-0" />
                      {showLabel && (
                        <span className="ml-3 font-medium">Sign Out</span>
                      )}
                  </button>
                </>
              );
            })()}
        </div>
      </aside>

      {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
      )}

      <main className="flex-1 flex flex-col overflow-hidden bg-zinc-50 dark:bg-black pt-16 md:pt-0 relative">
        <div ref={mainContentRef} className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Unsaved Changes</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">You have unsaved game stats</p>
              </div>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">
              Are you sure you want to leave this page? Your unsaved changes will be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelLeave}
                className="flex-1 px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors font-medium"
              >
                Stay on Page
              </button>
              <button
                onClick={handleConfirmLeave}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                Leave & Discard
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Layout;