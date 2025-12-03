import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { LayoutDashboard, Users, Shield, LogOut, FileText, Menu, X, ChevronLeft, Sun, Moon, BarChart3, Megaphone, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const adminNavItems = [
  { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Users', path: '/admin/users', icon: Users },
  { name: 'Teams', path: '/admin/teams', icon: Shield },
  { name: 'Announcements', path: '/admin/announcements', icon: Megaphone },
  { name: 'Reports', path: '/admin/reports', icon: FileText },
  { name: 'Stats', path: '/admin/stats', icon: BarChart3 },
  { name: 'Settings', path: '/admin/settings', icon: Settings },
];

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobile && sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        const button = document.querySelector('[data-menu-toggle]');
        if (button && !button.contains(event.target as Node)) {
          setSidebarOpen(false);
        }
      }
    };

    if (sidebarOpen && isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [sidebarOpen, isMobile]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const navLinkClasses = 'flex items-center p-3 my-1 rounded-lg transition-colors';
  const activeClasses = 'bg-orange-600 text-white shadow-[0_0_15px_rgba(234,88,12,0.5)] border border-orange-500/50';
  const inactiveClasses = 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900 hover:text-orange-600 dark:hover:text-orange-400';

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black overflow-hidden font-sans transition-colors duration-200">
      {/* Mobile Overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/80 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`${
          isMobile 
            ? 'fixed z-40 w-64' 
            : `transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-64' : 'w-20'}`
        } flex flex-col bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-900 p-4 h-full overflow-hidden shadow-2xl ${
          isMobile 
            ? sidebarOpen ? 'translate-x-0' : '-translate-x-full' 
            : ''
        }`}
      >
        <div className="flex items-center justify-between mb-8">
          {sidebarOpen ? (
            <div className="text-2xl font-black tracking-tighter text-zinc-900 dark:text-white min-w-0">
              <div className="truncate">
                  <span className="text-orange-500">Locker</span> <span className="text-zinc-900 dark:text-white">Room</span>
              </div>
              <p className="text-xs font-bold text-orange-500 mt-1 uppercase tracking-widest">Super Admin</p>
            </div>
          ) : (
            <div className="flex justify-center w-full">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg font-black text-white text-sm shadow-lg">
                LR
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-zinc-500 hover:text-red-500 transition-colors flex-shrink-0 ml-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => isMobile && setSidebarOpen(false)}
              className={({ isActive }) => `${navLinkClasses} ${isActive ? activeClasses : inactiveClasses}`}
              title={!sidebarOpen ? item.name : ''}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className={`transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 ml-3 font-medium' : 'opacity-0 w-0 hidden'}`}>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-zinc-200 dark:border-zinc-900 pt-4 mt-auto space-y-2">
          <button
            onClick={toggleTheme}
            className={`${navLinkClasses} ${inactiveClasses} w-full justify-start`}
            title={!sidebarOpen ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : ''}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Moon className="w-5 h-5 flex-shrink-0" />
            )}
            <span className={`transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 ml-3 font-medium' : 'opacity-0 w-0 hidden'}`}>
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>
          <button
            onClick={handleSignOut}
            className={`${navLinkClasses} ${inactiveClasses} w-full justify-start text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}
            title={!sidebarOpen ? 'Sign Out' : ''}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className={`transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 ml-3 font-medium' : 'opacity-0 w-0 hidden'}`}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-900 p-4 shadow-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-zinc-600 dark:text-zinc-300 hover:text-orange-600 transition-colors"
            data-menu-toggle
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <h1 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">
              <span className="text-orange-500">Locker</span> Room
          </h1>
          <div className="w-6"></div>
        </div>

        {/* Desktop Header with Collapse Button */}
        <div className="hidden md:flex items-center bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-900 p-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-zinc-400 hover:text-orange-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all rounded-lg p-2"
            title={sidebarOpen ? 'Collapse menu' : 'Expand menu'}
          >
            <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${!sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className="ml-auto text-sm font-bold text-zinc-900 dark:text-white">
            {userData?.name}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-black">
          <div className="p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;