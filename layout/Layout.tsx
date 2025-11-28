import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
// FIXED: Added 'Send' to the imports
import { Home, Users, ClipboardList, MessageCircle, Video, LogOut, User, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const { teamData, userData } = useAuth(); 

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Define all possible items
  const allNavItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Roster', path: '/roster', icon: Users },
    { name: 'Playbook', path: '/playbook', icon: ClipboardList },
    { name: 'Team Chat', path: '/chat', icon: MessageCircle },
    { name: 'Messenger', path: '/messenger', icon: Send },     // <--- New Tab
    { name: 'Film Room', path: '/videos', icon: Video },
    { name: 'Profile', path: '/profile', icon: User }, 
  ];

  // Filter: Remove 'Playbook' if user is a Parent
  const navItems = allNavItems.filter(item => {
      if (item.name === 'Playbook' && userData?.role === 'Parent') {
          return false;
      }
      return true;
  });

  const navLinkClasses = 'flex items-center p-3 my-1 rounded-lg transition-colors';
  const activeClasses = 'bg-sky-500 text-white';
  const inactiveClasses = 'text-slate-400 hover:bg-slate-700 hover:text-white';

  const mobileNavLinkClasses = 'flex flex-col items-center justify-center flex-1 py-2 text-xs transition-colors';
  const mobileActiveClasses = 'text-sky-400';
  const mobileInactiveClasses = 'text-slate-400 hover:text-sky-400';

  return (
    <div className="flex h-screen bg-slate-850">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 p-4">
        <div className="text-2xl font-bold text-white mb-6">
          Gridiron<span className="text-sky-500">Hub</span>
          <p className="text-sm font-normal text-slate-400 mt-1 truncate">{teamData?.name || 'Loading...'}</p>
        </div>
        <nav className="flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => `${navLinkClasses} ${isActive ? activeClasses : inactiveClasses}`}
            >
              <item.icon className="w-5 h-5 mr-3" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
        <button onClick={handleSignOut} className={`${navLinkClasses} ${inactiveClasses} w-full mt-auto`}>
          <LogOut className="w-5 h-5 mr-3" />
          <span>Sign Out</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto pb-24 md:pb-6">
          <Outlet />
        </div>
      </main>

      {/* Bottom Nav for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 flex justify-around z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => `${mobileNavLinkClasses} ${isActive ? mobileActiveClasses : mobileInactiveClasses}`}
          >
            <item.icon className="w-6 h-6 mb-1" />
            <span>{item.name}</span>
          </NavLink>
        ))}
         <button onClick={handleSignOut} className={`${mobileNavLinkClasses} ${mobileInactiveClasses}`}>
          <LogOut className="w-6 h-6 mb-1" />
          <span>Sign Out</span>
        </button>
      </nav>
    </div>
  );
};

export default Layout;