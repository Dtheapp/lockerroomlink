
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { LayoutDashboard, Users, Shield, LogOut, FileText, Menu, X, ChevronLeft, Sun, Moon, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const adminNavItems = [
  { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Users', path: '/admin/users', icon: Users },
  { name: 'Teams', path: '/admin/teams', icon: Shield },
  { name: 'Reports', path: '/admin/reports', icon: FileText },
  { name: 'Stats', path: '/admin/stats', icon: BarChart3 },
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
  const activeClasses = 'bg-sky-500 text-white dark:bg-sky-600';
  const inactiveClasses = 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600 dark:hover:text-sky-400';

  return (
    <div className="flex h-screen bg-white dark:bg-slate-900 overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
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
        } flex flex-col bg-slate-50 dark:bg-slate-900 p-4 h-full overflow-hidden ${
          isMobile 
            ? sidebarOpen ? 'translate-x-0' : '-translate-x-full' 
            : ''
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          {sidebarOpen ? (
            <div className="text-2xl font-bold text-slate-900 dark:text-white min-w-0">
              <div className="truncate">Gridiron<span className="text-sky-500">Hub</span></div>
              <p className="text-sm font-normal text-red-500 dark:text-red-400 mt-1">Super Admin</p>
            </div>
          ) : (
            <div className="flex justify-center w-full">
              <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-sky-500 to-sky-600 rounded-lg font-bold text-white text-lg">
                GH
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex-shrink-0 ml-2"
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
              <span className={`transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-auto space-y-2">
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
            <span className={`transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
              {theme === 'dark' ? 'Light' : 'Dark'} Mode
            </span>
          </button>
          <button
            onClick={handleSignOut}
            className={`${navLinkClasses} ${inactiveClasses} w-full justify-start`}
            title={!sidebarOpen ? 'Sign Out' : ''}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className={`transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            data-menu-toggle
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Super Admin</h1>
          <div className="w-6"></div>
        </div>

        {/* Desktop Header with Collapse Button */}
        <div className="hidden md:flex items-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all rounded-lg p-2"
            title={sidebarOpen ? 'Collapse menu' : 'Expand menu'}
          >
            <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${!sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className="ml-auto text-sm font-semibold text-slate-900 dark:text-white">
            {userData?.name}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-850">
          <div className="p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
