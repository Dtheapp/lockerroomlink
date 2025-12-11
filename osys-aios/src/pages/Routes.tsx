import { Route, Globe, Lock, Shield, Users, Settings, Gavel, Timer, Heart } from 'lucide-react';
import { ROUTES } from '../data/osysData';

const categoryIcons: Record<string, React.ElementType> = {
  public: Globe,
  auth: Lock,
  dashboard: Users,
  admin: Shield,
  commissioner: Settings,
  league: Gavel,
  referee: Timer,
  fan: Heart,
};

const categoryColors: Record<string, string> = {
  public: 'bg-emerald-500/20 text-emerald-400',
  auth: 'bg-amber-500/20 text-amber-400',
  dashboard: 'bg-purple-500/20 text-purple-400',
  admin: 'bg-red-500/20 text-red-400',
  commissioner: 'bg-blue-500/20 text-blue-400',
  league: 'bg-cyan-500/20 text-cyan-400',
  referee: 'bg-orange-500/20 text-orange-400',
  fan: 'bg-pink-500/20 text-pink-400',
};

function Routes_() {
  const totalRoutes = Object.values(ROUTES).flat().length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Route Structure</h1>
        <p className="text-slate-400">
          {totalRoutes} routes defined in App.tsx with role-based access control
        </p>
      </div>

      {/* Routes by Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(ROUTES).map(([category, routes]) => {
          const Icon = categoryIcons[category] || Route;
          const colorClass = categoryColors[category] || 'bg-slate-500/20 text-slate-400';
          
          return (
            <div key={category} className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass.split(' ')[0]}`}>
                  <Icon className={`w-5 h-5 ${colorClass.split(' ')[1]}`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white capitalize">{category}</h3>
                  <p className="text-xs text-slate-400">{routes.length} routes</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {routes.map((route) => (
                  <div 
                    key={route.path}
                    className="px-4 py-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <code className="text-sm text-purple-400">{route.path}</code>
                      {'roles' in route && (
                        <span className="text-xs text-slate-500">
                          {Array.isArray(route.roles) ? route.roles.join(', ') : route.roles}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">→ {route.component}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Routes_;
