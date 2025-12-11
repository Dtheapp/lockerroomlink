import { 
  Box, Wrench, Route, Users, Bug, Lightbulb, CheckSquare, 
  TrendingUp, DollarSign, Code, Database, Shield, Zap, AlertTriangle,
  Gamepad2, Phone, Video, Brain, ShieldCheck
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { OSYS_DATA, FEATURE_STATUS } from '../data/osysData';

const progressData = [
  { month: 'Sep', progress: 10 },
  { month: 'Oct', progress: 20 },
  { month: 'Nov', progress: 30 },
  { month: 'Dec', progress: 40 },
];

const pieData = [
  { name: 'Completed', value: 15, color: '#10b981' },
  { name: 'In Progress', value: 5, color: '#f59e0b' },
  { name: 'Planned', value: 7, color: '#6366f1' },
];

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}

function StatCard({ icon: Icon, label, value, subtext, color }: StatCardProps) {
  return (
    <div className="glass rounded-2xl p-6 hover:border-purple-500/30 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
      {subtext && <div className="text-xs text-slate-500 mt-1">{subtext}</div>}
    </div>
  );
}

function Dashboard() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-amber-500 rounded-2xl flex items-center justify-center pulse-purple">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{OSYS_DATA.project.name}</h1>
            <p className="text-slate-400">{OSYS_DATA.project.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span className="text-slate-400">
            <span className="text-purple-400 font-medium">{OSYS_DATA.project.devDays}</span> days in development
          </span>
          <span className="text-slate-400">
            Stack: <span className="text-white">{OSYS_DATA.project.tech.frontend}</span>
          </span>
          <span className="text-slate-400">
            Port: <span className="text-emerald-400">{OSYS_DATA.project.tech.devPort}</span>
          </span>
        </div>
      </div>

      {/* Blocker Alert */}
      {OSYS_DATA.blockers.length > 0 && (
        <div className="mb-6 glass rounded-xl p-4 border border-red-500/30 bg-red-500/10">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="font-medium text-red-400">PILOT BLOCKER:</span>
            <span className="text-white">{OSYS_DATA.blockers[0].title}</span>
            <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded">P0</span>
          </div>
        </div>
      )}

      {/* THE PLAYGROUND - Game Changer Feature */}
      {OSYS_DATA.playground && (
        <div className="mb-6 glass rounded-xl p-5 border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">🎮 THE PLAYGROUND</span>
                  <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">SPECS COMPLETE</span>
                  <span className="text-xs px-2 py-0.5 bg-pink-500/20 text-pink-400 rounded">GAME CHANGER</span>
                </div>
                <span className="text-sm text-slate-400">Youth Social Platform - {OSYS_DATA.playground.timeline}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-emerald-400">{OSYS_DATA.playground.monetization.price}/mo</div>
              <div className="text-xs text-slate-500">Premium</div>
            </div>
          </div>
          
          <p className="text-sm text-slate-300 mb-4 italic">"{OSYS_DATA.playground.source}"</p>
          
          <div className="grid grid-cols-5 gap-3">
            {OSYS_DATA.playground.features.map((feature, idx) => (
              <div key={idx} className="p-3 bg-white/5 rounded-lg text-center">
                <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-white/10 flex items-center justify-center">
                  {idx === 0 && <Phone className="w-4 h-4 text-purple-400" />}
                  {idx === 1 && <Video className="w-4 h-4 text-amber-400" />}
                  {idx === 2 && <Video className="w-4 h-4 text-blue-400" />}
                  {idx === 3 && <Brain className="w-4 h-4 text-pink-400" />}
                  {idx === 4 && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="text-xs text-white font-medium">{feature.name}</div>
                <div className="text-xs text-slate-500">{feature.weeks}w</div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-slate-400">{OSYS_DATA.playground.whyGameChanger}</span>
            <span className="text-xs text-emerald-400 font-medium">{OSYS_DATA.playground.monetization.revenueProjection}</span>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard 
          icon={Box} 
          label="Components" 
          value={OSYS_DATA.components.total} 
          subtext="React components discovered"
          color="bg-purple-500"
        />
        <StatCard 
          icon={Wrench} 
          label="Services" 
          value={OSYS_DATA.services.total} 
          subtext="Firebase & utility services"
          color="bg-blue-500"
        />
        <StatCard 
          icon={Users} 
          label="User Roles" 
          value={OSYS_DATA.userRoles.length} 
          subtext="Role-based access control"
          color="bg-emerald-500"
        />
        <StatCard 
          icon={Bug} 
          label="Bug Fixes" 
          value={`${OSYS_DATA.bugFixes.total}+`} 
          subtext="Documented & resolved"
          color="bg-amber-500"
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard 
          icon={Database} 
          label="Collections" 
          value={OSYS_DATA.collections.core.length + OSYS_DATA.collections.subcollections.length} 
          subtext="Firestore collections"
          color="bg-orange-500"
        />
        <StatCard 
          icon={Code} 
          label="Interfaces" 
          value={OSYS_DATA.interfaces.length} 
          subtext="TypeScript types"
          color="bg-cyan-500"
        />
        <StatCard 
          icon={Shield} 
          label="Sports" 
          value={OSYS_DATA.sports.length} 
          subtext="Multi-sport support"
          color="bg-pink-500"
        />
        <StatCard 
          icon={DollarSign} 
          label="Revenue Streams" 
          value={OSYS_DATA.revenue.streams.length} 
          subtext="Monetization paths"
          color="bg-green-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Progress Chart */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Development Progress</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={progressData}>
                <defs>
                  <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#64748b" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="progress" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  fill="url(#progressGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Feature Status Pie */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Feature Status</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                <span className="text-sm text-slate-400">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Info Panels */}
      <div className="grid grid-cols-3 gap-6">
        {/* User Roles */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            User Roles
          </h3>
          <div className="flex flex-wrap gap-2">
            {OSYS_DATA.userRoles.map((role) => (
              <span 
                key={role}
                className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-sm"
              >
                {role}
              </span>
            ))}
          </div>
        </div>

        {/* Sports */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            Supported Sports
          </h3>
          <div className="flex flex-wrap gap-2">
            {OSYS_DATA.sports.map((sport) => (
              <span 
                key={sport}
                className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-sm capitalize"
              >
                {sport}
              </span>
            ))}
          </div>
        </div>

        {/* Revenue Projection */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Revenue Projections
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Year 1</span>
              <span className="text-emerald-400 font-bold">${OSYS_DATA.revenue.projections.year1.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Year 2</span>
              <span className="text-emerald-400 font-bold">${OSYS_DATA.revenue.projections.year2.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Year 3</span>
              <span className="text-emerald-400 font-bold">${OSYS_DATA.revenue.projections.year3.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* In Progress Features */}
      <div className="mt-8 glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-amber-400" />
          Features In Progress
        </h3>
        <div className="space-y-4">
          {FEATURE_STATUS.inProgress.map((feature: any) => (
            <div key={feature.name} className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium">{feature.name}</span>
                  {feature.blocker && (
                    <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">BLOCKER</span>
                  )}
                  {feature.gameChanger && (
                    <span className="text-xs px-2 py-0.5 bg-pink-500/20 text-pink-400 rounded">GAME CHANGER</span>
                  )}
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${feature.blocker ? 'bg-red-500' : feature.gameChanger ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-amber-500'}`}
                    style={{ width: `${feature.progress}%` }}
                  />
                </div>
              </div>
              <span className="text-slate-400 font-medium">{feature.progress}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
