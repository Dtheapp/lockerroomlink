import { CheckCircle, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { FEATURE_STATUS } from '../data/osysData';

function Features() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Feature Tracker</h1>
        <p className="text-slate-400">
          Track all features from planning to production
        </p>
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">{FEATURE_STATUS.completed.length}</h3>
              <p className="text-sm text-slate-400">Completed</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">{FEATURE_STATUS.inProgress.length}</h3>
              <p className="text-sm text-slate-400">In Progress</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">{FEATURE_STATUS.planned.length}</h3>
              <p className="text-sm text-slate-400">Planned</p>
            </div>
          </div>
        </div>
      </div>

      {/* Completed Features */}
      <div className="glass rounded-2xl p-6 mb-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          Completed Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURE_STATUS.completed.map((feature) => (
            <div key={feature.name} className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">{feature.name}</span>
                <span className="text-emerald-400 text-sm font-bold">{feature.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* In Progress Features */}
      <div className="glass rounded-2xl p-6 mb-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          In Progress
        </h2>
        <div className="space-y-4">
          {FEATURE_STATUS.inProgress.map((feature) => (
            <div key={feature.name} className="px-4 py-4 bg-white/5 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{feature.name}</span>
                  {feature.blocker && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                      <AlertTriangle className="w-3 h-3" />
                      BLOCKER
                    </span>
                  )}
                </div>
                <span className="text-amber-400 font-bold">{feature.progress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${feature.blocker ? 'bg-red-500' : 'bg-amber-500'}`}
                  style={{ width: `${feature.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Planned Features */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-400" />
          Planned Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURE_STATUS.planned.map((feature) => (
            <div key={feature.name} className="px-4 py-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">{feature.name}</span>
                <span className="text-purple-400 text-sm">Planned</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Features;
