import { Wrench, Database, Zap, Lock, CreditCard, MessageSquare, Video, BarChart } from 'lucide-react';
import { OSYS_DATA } from '../data/osysData';

const iconMap: Record<string, React.ElementType> = {
  firebase: Database,
  eventService: Zap,
  creditService: CreditCard,
  moderation: Lock,
  chatService: MessageSquare,
  livestreamService: Video,
  statsService: BarChart,
};

function Services() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Service Layer</h1>
        <p className="text-slate-400">
          {OSYS_DATA.services.total} services powering OSYS functionality
        </p>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {OSYS_DATA.services.list.map((service) => {
          const Icon = iconMap[service.name] || Wrench;
          return (
            <div key={service.name} className="glass rounded-2xl p-6 hover:border-purple-500/30 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Icon className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{service.name}</h3>
                  <p className="text-xs text-slate-400">services/{service.name}.ts</p>
                </div>
              </div>
              <p className="text-sm text-slate-300">{service.purpose}</p>
            </div>
          );
        })}
      </div>

      {/* Hooks Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-white mb-6">Custom Hooks ({OSYS_DATA.hooks.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {OSYS_DATA.hooks.map((hook) => (
            <div key={hook.name} className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <code className="text-purple-400 font-mono">{hook.name}()</code>
              </div>
              <p className="text-sm text-slate-300 mb-2">{hook.purpose}</p>
              <p className="text-xs text-slate-500">📁 {hook.file}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contexts Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-white mb-6">Contexts ({OSYS_DATA.contexts.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {OSYS_DATA.contexts.map((ctx) => (
            <div key={ctx.name} className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <code className="text-amber-400 font-mono">&lt;{ctx.name}&gt;</code>
              </div>
              <p className="text-sm text-slate-300 mb-2">{ctx.purpose}</p>
              <p className="text-xs text-slate-500">📁 {ctx.file}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Services;
