import { Box, Folder, Search } from 'lucide-react';
import { useState } from 'react';
import { OSYS_DATA } from '../data/osysData';

function Components() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = Object.keys(OSYS_DATA.components.byCategory);
  
  const filteredComponents = activeCategory 
    ? { [activeCategory]: OSYS_DATA.components.byCategory[activeCategory as keyof typeof OSYS_DATA.components.byCategory] }
    : OSYS_DATA.components.byCategory;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Component Registry</h1>
          <p className="text-slate-400">
            {OSYS_DATA.components.total} React components discovered in the codebase
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search components..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeCategory === null 
              ? 'bg-purple-500 text-white' 
              : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          All ({OSYS_DATA.components.total})
        </button>
        {categories.map((cat) => {
          const count = OSYS_DATA.components.byCategory[cat as keyof typeof OSYS_DATA.components.byCategory].length;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                activeCategory === cat 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Components Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(filteredComponents).map(([category, components]) => (
          <div key={category} className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Folder className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white capitalize">{category}</h3>
                <p className="text-xs text-slate-400">{components.length} components</p>
              </div>
            </div>
            <div className="space-y-2">
              {components
                .filter((c: string) => c.toLowerCase().includes(search.toLowerCase()))
                .map((component: string) => (
                <div 
                  key={component}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                >
                  <Box className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-white">{component}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Components;
