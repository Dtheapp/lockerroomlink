
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { LayoutDashboard, Users, Shield, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const adminNavItems = [
  { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Users', path: '/admin/users', icon: Users },
  { name: 'Teams', path: '/admin/teams', icon: Shield },
];

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { userData } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const navLinkClasses = 'flex items-center p-3 my-1 rounded-lg transition-colors';
  const activeClasses = 'bg-sky-500 text-white';
  const inactiveClasses = 'text-slate-400 hover:bg-slate-700 hover:text-white';

  return (
    <div className="flex h-screen bg-slate-850">
      <aside className="flex flex-col w-64 bg-slate-900 p-4">
        <div className="text-2xl font-bold text-white mb-6">
          Gridiron<span className="text-sky-500">Hub</span>
          <p className="text-sm font-normal text-red-400 mt-1">Admin Panel</p>
        </div>
        <nav className="flex-1">
          {adminNavItems.map((item) => (
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
        <div className='border-t border-slate-700 pt-4'>
           <div className='text-sm text-slate-300 px-3 mb-2 truncate'>{userData?.name}</div>
            <button onClick={handleSignOut} className={`${navLinkClasses} ${inactiveClasses} w-full`}>
                <LogOut className="w-5 h-5 mr-3" />
                <span>Sign Out</span>
            </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
