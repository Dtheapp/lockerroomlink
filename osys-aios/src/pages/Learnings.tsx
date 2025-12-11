import { Lightbulb, BookOpen, Star } from 'lucide-react';
import { OSYS_DATA } from '../data/osysData';

function Learnings() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Learning Database</h1>
        <p className="text-slate-400">
          {OSYS_DATA.learnings.length} documented learnings from development
        </p>
      </div>

      {/* Learnings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {OSYS_DATA.learnings.map((learning) => (
          <div 
            key={learning.id} 
            className="glass rounded-2xl p-6 hover:border-purple-500/30 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-amber-400">{learning.id}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{learning.title}</h3>
                <p className="text-sm text-slate-300">{learning.lesson}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Key Patterns */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-purple-400" />
          Key Development Patterns
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Auth Pattern */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">🔐 Auth State Pattern</h3>
            <pre className="p-4 bg-black/30 rounded-lg overflow-x-auto text-sm">
              <code className="text-purple-300">{`const { user, userData, teamData, loading, 
  isLeagueOwner, isProgramCommissioner } = useAuth();

// NEVER re-fetch - these come from real-time listeners
// Credits: userData?.credits (real-time)`}</code>
            </pre>
          </div>

          {/* Firestore Write Pattern */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">📝 Firestore Write Pattern</h3>
            <pre className="p-4 bg-black/30 rounded-lg overflow-x-auto text-sm">
              <code className="text-emerald-300">{`await setDoc(doc(db, 'collection', id), {
  ...data,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});`}</code>
            </pre>
          </div>

          {/* Import Pattern */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">📦 Standard Imports</h3>
            <pre className="p-4 bg-black/30 rounded-lg overflow-x-auto text-sm">
              <code className="text-cyan-300">{`// UI Components
import { Button, Badge, GlassCard } from '../components/ui/OSYSComponents';
import { OSYSInput, OSYSModal } from '../components/ui/OSYSFormElements';

// Services
import { toastSuccess, toastError } from '../services/toast';`}</code>
            </pre>
          </div>

          {/* Sport Config Pattern */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">🏈 Sport Config Pattern</h3>
            <pre className="p-4 bg-black/30 rounded-lg overflow-x-auto text-sm">
              <code className="text-amber-300">{`// NEVER hardcode positions/stats
import { getPositions, getStats } from '../config/sportConfig';

const positions = getPositions(teamData?.sport);
const stats = getStats(teamData?.sport);`}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* Quality Standards */}
      <div className="mt-12 glass rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-400" />
          Quality Standards (The OSYS Way)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-purple-500/10 rounded-lg">
            <h4 className="font-semibold text-purple-400 mb-2">Mobile First</h4>
            <p className="text-sm text-slate-300">Nothing off-screen, everything fits. Test mobile before desktop.</p>
          </div>
          <div className="p-4 bg-amber-500/10 rounded-lg">
            <h4 className="font-semibold text-amber-400 mb-2">9/10 or 10/10</h4>
            <p className="text-sm text-slate-300">No amateur work. Rate every task and redo if below 9.</p>
          </div>
          <div className="p-4 bg-emerald-500/10 rounded-lg">
            <h4 className="font-semibold text-emerald-400 mb-2">Security Audit</h4>
            <p className="text-sm text-slate-300">Audit after EVERY feature. Check Firestore rules, inputs, XSS.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Learnings;
