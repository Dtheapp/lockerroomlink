import { Bug, AlertTriangle, Code, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { OSYS_DATA } from '../data/osysData';

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

function Errors() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Error Database</h1>
        <p className="text-slate-400">
          {OSYS_DATA.commonErrors.length} documented errors with solutions
        </p>
      </div>

      {/* Bug Fix Summary */}
      <div className="glass rounded-2xl p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Bug className="w-5 h-5 text-amber-400" />
          Bug Fix History ({OSYS_DATA.bugFixes.total}+ fixes)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(OSYS_DATA.bugFixes.byCategory).map(([category, count]) => (
            <div key={category} className="px-4 py-3 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-white mb-1">{count}</div>
              <div className="text-xs text-slate-400">{category}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Common Errors */}
      <div className="space-y-6">
        {OSYS_DATA.commonErrors.map((error) => (
          <div 
            key={error.id} 
            className="glass rounded-2xl p-6 border border-red-500/20"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-red-400">{error.id}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{error.title}</h3>
                </div>
              </div>
            </div>

            {'wrong' in error && (
              <div className="grid grid-cols-2 gap-4">
                {/* Wrong */}
                <div>
                  <div className="text-xs text-red-400 font-medium mb-2">❌ WRONG</div>
                  <div className="relative">
                    <pre className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg overflow-x-auto">
                      <code className="text-sm text-red-300">{error.wrong}</code>
                    </pre>
                    <button
                      onClick={() => copyToClipboard(error.wrong!, error.id + '-wrong')}
                      className="absolute top-2 right-2 p-1 bg-white/10 rounded hover:bg-white/20"
                    >
                      {copiedId === error.id + '-wrong' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Right */}
                <div>
                  <div className="text-xs text-emerald-400 font-medium mb-2">✅ RIGHT</div>
                  <div className="relative">
                    <pre className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg overflow-x-auto">
                      <code className="text-sm text-emerald-300">{error.right}</code>
                    </pre>
                    <button
                      onClick={() => copyToClipboard(error.right!, error.id + '-right')}
                      className="absolute top-2 right-2 p-1 bg-white/10 rounded hover:bg-white/20"
                    >
                      {copiedId === error.id + '-right' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {'fix' in error && (
              <div className="mt-4">
                <div className="text-xs text-emerald-400 font-medium mb-2">🔧 FIX</div>
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <code className="text-sm text-emerald-300">{error.fix}</code>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* UI Variants Reference */}
      <div className="mt-8 glass rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Code className="w-5 h-5 text-purple-400" />
          UI Component Variants Reference
        </h2>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-emerald-400 mb-2">✅ Valid Button Variants</h3>
            <div className="flex flex-wrap gap-2">
              {OSYS_DATA.uiVariants.button.map((v) => (
                <span key={v} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded text-sm font-mono">
                  {v}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-400 mb-2">❌ Invalid Button Variants</h3>
            <div className="flex flex-wrap gap-2">
              {OSYS_DATA.uiVariants.invalid.button.map((v) => (
                <span key={v} className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm font-mono line-through">
                  {v}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-emerald-400 mb-2">✅ Valid Badge Variants</h3>
            <div className="flex flex-wrap gap-2">
              {OSYS_DATA.uiVariants.badge.map((v) => (
                <span key={v} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded text-sm font-mono">
                  {v}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-400 mb-2">❌ Invalid Badge Variants</h3>
            <div className="flex flex-wrap gap-2">
              {OSYS_DATA.uiVariants.invalid.badge.map((v) => (
                <span key={v} className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm font-mono line-through">
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Errors;
