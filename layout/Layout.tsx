import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Home, Users, ClipboardList, MessageCircle, Video, LogOut, User, Send, Menu, X, ChevronLeft, Sun, Moon, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import PlayerSelector from '../components/PlayerSelector';

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

  const navLinkClasses = 'flex items-center p-3 my-1 rounded-lg transition-all duration-200 whitespace-nowrap overflow-hidden';
  const activeClasses = 'bg-orange-600 text-white shadow-[0_0_15px_rgba(234,88,12,0.5)] border border-orange-500/50';
  const inactiveClasses = 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900 hover:text-orange-500 dark:hover:text-orange-400';

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black overflow-hidden transition-colors duration-200 font-sans">
      
      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between px-4 z-40 shadow-sm">
          <div className="text-xl font-black tracking-tighter">
            <span className="text-orange-500">LOCKER</span><span className="text-zinc-900 dark:text-white">ROOM</span>
          </div>
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
                <div className="min-w-0">
                    {/* FIX: Split Logo Color Logic */}
                    <div className="text-xl font-black tracking-tighter truncate leading-none">
                        <span className="text-orange-500">LOCKER</span>
                        <span className="text-zinc-900 dark:text-white">ROOM</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold truncate mt-1">
                        Digital Link
                    </p>
                </div>
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

        {/* PLAYER SELECTOR (Compact version for sidebar) */}
        {!isDesktopCollapsed && userData?.role === 'Parent' && (
          <div className="mb-4">
            <PlayerSelector />
          </div>
        )}

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
              <span className={`ml-3 font-medium transition-opacity duration-200 ${isDesktopCollapsed ? 'opacity-0 w-0 hidden md:block' : 'opacity-100'}`}>
                  {item.name}
              </span>
            </NavLink>
          ))}
        </nav>
        
        <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-900 space-y-2">
            <button 
                onClick={toggleTheme} 
                className={`${navLinkClasses} ${inactiveClasses} w-full`}
                title={isDesktopCollapsed ? 'Toggle Theme' : ''}
            >
                {theme === 'dark' ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
                <span className={`ml-3 font-medium ${isDesktopCollapsed ? 'hidden' : 'block'}`}>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <button 
                onClick={handleSignOut} 
                className={`${navLinkClasses} ${inactiveClasses} w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}
                title={isDesktopCollapsed ? 'Sign Out' : ''}
            >
                <LogOut className="w-5 h-5" />
                <span className={`ml-3 font-medium ${isDesktopCollapsed ? 'hidden' : 'block'}`}>Sign Out</span>
            </button>
        </div>
      </aside>

      {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
      )}

      <main className="flex-1 flex flex-col overflow-hidden bg-zinc-50 dark:bg-black pt-16 md:pt-0 relative">
        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>

    </div>
  );
};

export default Layout;