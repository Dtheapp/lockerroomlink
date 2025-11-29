import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Home, Users, ClipboardList, MessageCircle, Video, LogOut, User, Send, Menu, X, ChevronLeft, Sun, Moon, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const { teamData, userData } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

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
    { name: 'Team Chat', path: '/chat', icon: MessageCircle },
    { name: 'Messenger', path: '/messenger', icon: Send },
    { name: 'Film Room', path: '/videos', icon: Video },
    { name: 'Stats', path: '/stats', icon: BarChart3 },
    { name: 'Profile', path: '/profile', icon: User }, 
  ];

  const navItems = allNavItems.filter(item => {
      if (item.name === 'Playbook' && userData?.role === 'Parent') return false;
      return true;
  });

  const navLinkClasses = 'flex items-center p-3 my-1 rounded-lg transition-colors whitespace-nowrap overflow-hidden';
  const activeClasses = 'bg-sky-500 text-white dark:bg-sky-600 shadow-md';
  const inactiveClasses = 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-sky-600 dark:hover:text-sky-400';

  return (
    // FIX: Custom Hex [#151e32] acts as Slate-850 (Lighter than 900, Darker than 800)
    <div className="flex h-screen bg-slate-50 dark:bg-[#151e32] overflow-hidden transition-colors duration-200">
      
      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-40 shadow-sm">
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            Gridiron<span className="text-sky-500">Hub</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600 dark:text-slate-300">
              <Menu className="w-8 h-8" />
          </button>
      </div>

      {/* SIDEBAR (Kept at Slate-900 for slight contrast against 850 background) */}
      <aside className={`
          fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 
          transition-all duration-300 ease-in-out flex flex-col p-4 shadow-xl
          md:relative md:translate-x-0 md:shadow-none
          ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'} 
          ${isDesktopCollapsed ? 'md:w-20' : 'md:w-64'}
      `}>
        
        <div className="flex items-center justify-between mb-6 h-10">
            {!isDesktopCollapsed && (
                <div className="min-w-0">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white truncate">
                        Gridiron<span className="text-sky-500">Hub</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-1">{teamData?.name || 'Loading...'}</p>
                </div>
            )}
            
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-500 hover:text-red-500">
                <X className="w-6 h-6" />
            </button>

            <button 
                onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)} 
                className="hidden md:block text-slate-400 hover:text-sky-500 transition-transform"
            >
                <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${isDesktopCollapsed ? 'rotate-180' : ''}`} />
            </button>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setIsSidebarOpen(false)} 
              className={({ isActive }) => `${navLinkClasses} ${isActive ? activeClasses : inactiveClasses}`}
              title={isDesktopCollapsed ? item.name : ''}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className={`ml-3 transition-opacity duration-200 ${isDesktopCollapsed ? 'opacity-0 w-0 hidden md:block' : 'opacity-100'}`}>
                  {item.name}
              </span>
            </NavLink>
          ))}
        </nav>
        
        <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <button 
                onClick={toggleTheme} 
                className={`${navLinkClasses} ${inactiveClasses} w-full`}
                title={isDesktopCollapsed ? 'Toggle Theme' : ''}
            >
                {theme === 'dark' ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
                <span className={`ml-3 ${isDesktopCollapsed ? 'hidden' : 'block'}`}>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <button 
                onClick={handleSignOut} 
                className={`${navLinkClasses} ${inactiveClasses} w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}
                title={isDesktopCollapsed ? 'Sign Out' : ''}
            >
                <LogOut className="w-5 h-5" />
                <span className={`ml-3 ${isDesktopCollapsed ? 'hidden' : 'block'}`}>Sign Out</span>
            </button>
        </div>
      </aside>

      {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-[#151e32] pt-16 md:pt-0 relative">
        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>

    </div>
  );
};

export default Layout;