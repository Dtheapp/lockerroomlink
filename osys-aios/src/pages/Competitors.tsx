import { Target, AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import { OSYS_DATA } from '../data/osysData';

function Competitors() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Competitive Analysis</h1>
        <p className="text-slate-400">
          Know thy enemy - {OSYS_DATA.competitors.length} key competitors identified
        </p>
      </div>

      {/* Competitors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {OSYS_DATA.competitors.map((competitor) => (
          <div key={competitor.name} className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{competitor.name}</h3>
              </div>
            </div>
            
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium text-red-400">Their Weakness</span>
              </div>
              <p className="text-sm text-slate-300">{competitor.weakness}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Our Advantages */}
      <div className="glass rounded-2xl p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          OSYS Competitive Advantages
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <h4 className="font-semibold text-emerald-400 mb-2">🎨 Modern UI/UX</h4>
            <p className="text-sm text-slate-300">
              While competitors look like 2005, OSYS has a world-class glass design that impresses on first sight.
            </p>
          </div>
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <h4 className="font-semibold text-emerald-400 mb-2">📚 Built-in Playbook</h4>
            <p className="text-sm text-slate-300">
              No competitor has a real playbook builder. TeamSnap has none. GameChanger has none.
            </p>
          </div>
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <h4 className="font-semibold text-emerald-400 mb-2">🏈 Multi-Sport Native</h4>
            <p className="text-sm text-slate-300">
              Football, basketball, cheer, soccer, baseball, volleyball - all with sport-specific features.
            </p>
          </div>
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <h4 className="font-semibold text-emerald-400 mb-2">💰 All-in-One Platform</h4>
            <p className="text-sm text-slate-300">
              Roster + Chat + Events + Tickets + Fundraising + NIL + Livestream - One app, everything.
            </p>
          </div>
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <h4 className="font-semibold text-emerald-400 mb-2">🤖 AI Integration</h4>
            <p className="text-sm text-slate-300">
              AI highlight reels, AI stats from video, AI play suggestions - competitors don't have this.
            </p>
          </div>
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <h4 className="font-semibold text-emerald-400 mb-2">📱 Free Core Features</h4>
            <p className="text-sm text-slate-300">
              Competitors charge $10+/month for basics. OSYS gives core features free, monetizes premium.
            </p>
          </div>
        </div>
      </div>

      {/* Battle Strategy */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Battle Strategy
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">1</div>
            <div>
              <h4 className="font-semibold text-white">Start with Playbook</h4>
              <p className="text-sm text-slate-400">Hook coaches with the playbook - it's what they actually want. No competitor has this.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">2</div>
            <div>
              <h4 className="font-semibold text-white">Pull in Parents</h4>
              <p className="text-sm text-slate-400">Coaches onboard → Parents join to see their kids → Network effect begins.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">3</div>
            <div>
              <h4 className="font-semibold text-white">Own the Transaction</h4>
              <p className="text-sm text-slate-400">Registration fees, tickets, fundraising, NIL deals - we clip every transaction.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">4</div>
            <div>
              <h4 className="font-semibold text-white">Make Switching Impossible</h4>
              <p className="text-sm text-slate-400">Years of stats, playbooks, parent networks, fundraising history - too valuable to lose.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Competitors;
