import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatedBackground } from '../components/ui/OSYSComponents';

interface OSYSLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

const navItems = [
  { icon: '📊', label: 'Dashboard', path: '/dashboard' },
  { icon: '👥', label: 'Roster', path: '/roster' },
  { icon: '📋', label: 'Playbook', path: '/playbook' },
  { icon: '📈', label: 'Stats', path: '/stats' },
  { icon: '🎬', label: 'Videos', path: '/videos' },
  { icon: '💬', label: 'Chat', path: '/chat' },
  { icon: '💰', label: 'Fundraising', path: '/fundraising', comingSoon: true },
  { icon: '📅', label: 'Events', path: '/events' },
];

const OSYSLayout: React.FC<OSYSLayoutProps> = ({ children, showSidebar = true }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen text-white">
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Sidebar */}
      {showSidebar && (
        <aside className="osys-sidebar">
          {/* Logo */}
          <div className="osys-sidebar-logo">
            <div className="osys-sidebar-logo-icon">⚡</div>
            <span className="osys-sidebar-logo-text">OSYS</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`osys-nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="osys-nav-item-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.comingSoon && (
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                      Soon
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="border-t border-white/10 pt-4 mt-4">
            <Link to="/profile" className="osys-nav-item">
              <span className="osys-nav-item-icon">⚙️</span>
              <span>Settings</span>
            </Link>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className={showSidebar ? 'osys-main' : 'osys-main-full'}>
        {children}
      </main>
    </div>
  );
};

export default OSYSLayout;
