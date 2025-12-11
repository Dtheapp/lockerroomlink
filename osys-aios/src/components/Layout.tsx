import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Box, 
  Wrench, 
  Route, 
  CheckSquare, 
  Bug, 
  Lightbulb, 
  DollarSign, 
  Target,
  Zap,
  RefreshCw
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/components', icon: Box, label: 'Components (87)' },
  { to: '/services', icon: Wrench, label: 'Services (26)' },
  { to: '/routes', icon: Route, label: 'Routes' },
  { to: '/features', icon: CheckSquare, label: 'Features' },
  { to: '/errors', icon: Bug, label: 'Errors (6)' },
  { to: '/learnings', icon: Lightbulb, label: 'Learnings (8)' },
  { to: '/revenue', icon: DollarSign, label: 'Revenue' },
  { to: '/competitors', icon: Target, label: 'Competitors' },
];

function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 glass border-r border-white/10 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-amber-500 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg gradient-text">OSYS AIOS</h1>
              <p className="text-xs text-slate-400">Development Intelligence</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Status */}
        <div className="p-4 border-t border-white/10">
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Progress</span>
              <span className="text-sm font-bold text-purple-400">40%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-amber-500 rounded-full"
                style={{ width: '40%' }}
              />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
              <span className="text-xs text-slate-400">Live Scan Active</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
