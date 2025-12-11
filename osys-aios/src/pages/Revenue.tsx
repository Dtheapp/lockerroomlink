import { DollarSign, TrendingUp, CreditCard, Ticket, Users, Trophy, BarChart } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart as RechartsBar, Bar } from 'recharts';
import { OSYS_DATA } from '../data/osysData';

const revenueData = [
  { year: 'Year 1', revenue: 23500 },
  { year: 'Year 2', revenue: 155500 },
  { year: 'Year 3', revenue: 679000 },
];

const streamData = OSYS_DATA.revenue.streams.map((s) => ({
  name: s.name,
  phase: s.phase,
}));

const phaseIcons: Record<number, React.ElementType> = {
  1: CreditCard,
  2: Ticket,
  3: Trophy,
};

const phaseColors: Record<number, string> = {
  1: 'bg-emerald-500/20 text-emerald-400',
  2: 'bg-amber-500/20 text-amber-400',
  3: 'bg-purple-500/20 text-purple-400',
};

function Revenue() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Revenue Strategy</h1>
        <p className="text-slate-400">
          {OSYS_DATA.revenue.streams.length} revenue streams across 3 phases
        </p>
      </div>

      {/* Projection Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Year 1</p>
              <h3 className="text-2xl font-bold text-white">
                ${OSYS_DATA.revenue.projections.year1.toLocaleString()}
              </h3>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Year 2</p>
              <h3 className="text-2xl font-bold text-white">
                ${OSYS_DATA.revenue.projections.year2.toLocaleString()}
              </h3>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Year 3</p>
              <h3 className="text-2xl font-bold text-white">
                ${OSYS_DATA.revenue.projections.year3.toLocaleString()}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="glass rounded-2xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">Revenue Projection</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="year" stroke="#64748b" />
              <YAxis stroke="#64748b" tickFormatter={(v) => `$${v/1000}k`} />
              <Tooltip 
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                contentStyle={{ 
                  background: 'rgba(0,0,0,0.8)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#10b981" 
                strokeWidth={3}
                fill="url(#revenueGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue Streams by Phase */}
      <div className="grid grid-cols-3 gap-6">
        {[1, 2, 3].map((phase) => {
          const Icon = phaseIcons[phase];
          const colorClass = phaseColors[phase];
          const streams = OSYS_DATA.revenue.streams.filter((s) => s.phase === phase);
          
          return (
            <div key={phase} className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass.split(' ')[0]}`}>
                  <Icon className={`w-5 h-5 ${colorClass.split(' ')[1]}`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Phase {phase}</h3>
                  <p className="text-xs text-slate-400">{streams.length} streams</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {streams.map((stream) => (
                  <div key={stream.name} className="p-3 bg-white/5 rounded-lg">
                    <div className="font-medium text-white text-sm">{stream.name}</div>
                    <div className="text-xs text-slate-400">{stream.model}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dependency Flywheel */}
      <div className="mt-8 glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">🔄 The Dependency Flywheel</h3>
        <div className="flex flex-wrap gap-2 items-center justify-center">
          {[
            'Teams Join (Free)',
            'Parents Join',
            'Coaches Pay',
            'Teams Fundraise',
            'Teams Sell Tickets',
            'Players Want NIL',
            'Coaches Offer Training',
            'Leagues Join',
            'Network Effect',
            'REPEAT 🔄'
          ].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className="px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm">
                {step}
              </span>
              {i < 9 && <span className="text-slate-500">→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Revenue;
