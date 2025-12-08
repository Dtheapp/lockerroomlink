// =============================================================================
// TEMPLATE SELECTOR - Choose from pre-built templates
// =============================================================================

import React, { useState } from 'react';
import { ChevronLeft, Search, Sparkles, FolderOpen } from 'lucide-react';
import { TEMPLATE_CATEGORIES, DESIGN_TEMPLATES, getTemplatesByCategory } from './templates';
import { FLYER_SIZES, FlyerSize } from './types';
import type { DesignTemplate } from './types';
import { useTheme } from '../../contexts/ThemeContext';

interface TemplateSelectorProps {
  onSelectTemplate: (template: DesignTemplate) => void;
  onStartBlank: (size: FlyerSize) => void;
  onBack: () => void;
  onOpenGallery?: () => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onSelectTemplate,
  onStartBlank,
  onBack,
  onOpenGallery,
}) => {
  const { theme } = useTheme();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSize, setSelectedSize] = useState<FlyerSize>('instagram');

  const templates = getTemplatesByCategory(activeCategory);
  const filteredTemplates = searchQuery
    ? templates.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : templates;

  return (
    <div className={`min-h-screen flex ${theme === 'dark' ? 'bg-zinc-950' : 'bg-slate-100'}`}>
      {/* Left Sidebar - Categories */}
      <div className={`w-64 border-r p-4 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`}>
        <button
          onClick={onBack}
          className={`flex items-center gap-2 mb-6 transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <h2 className={`font-semibold text-lg mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          <Sparkles className="w-5 h-5 text-purple-400" />
          Design Studio
        </h2>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:border-purple-500 focus:outline-none ${
              theme === 'dark' 
                ? 'bg-zinc-800 border-zinc-700 text-white placeholder-slate-500' 
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        {/* Categories */}
        <div className="space-y-1">
          {/* My Designs Button */}
          {onOpenGallery && (
            <button
              onClick={onOpenGallery}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors mb-2 bg-violet-600/20 text-violet-400 border border-violet-500/30 hover:bg-violet-600/30"
            >
              <FolderOpen className="w-5 h-5" />
              <span className="text-sm font-medium">My Designs</span>
            </button>
          )}
          
          {TEMPLATE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                activeCategory === cat.id
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                  : theme === 'dark' 
                    ? 'text-slate-300 hover:bg-zinc-800'
                    : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="text-sm font-medium">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {TEMPLATE_CATEGORIES.find(c => c.id === activeCategory)?.icon}{' '}
            {TEMPLATE_CATEGORIES.find(c => c.id === activeCategory)?.name || 'Templates'}
          </h1>
          <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Choose a template or start from scratch</p>
        </div>

        {/* Start from scratch section */}
        <div className="mb-8">
          <h3 className={`text-sm font-medium uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Start from Scratch
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(FLYER_SIZES).map(([key, size]) => (
              <button
                key={key}
                onClick={() => onStartBlank(key as FlyerSize)}
                className={`group p-4 border rounded-xl hover:border-purple-500 transition-all text-center ${
                  theme === 'dark'
                    ? 'bg-zinc-900 border-zinc-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-2xl mb-2">{size.icon}</div>
                <div className={`text-sm font-medium group-hover:text-purple-400 transition-colors ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {size.label.split(' ')[0]}
                </div>
                <div className="text-xs text-slate-500">
                  {size.width}×{size.height}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div>
          <h3 className={`text-sm font-medium uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Templates ({filteredTemplates.length})
          </h3>
          
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">No templates found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredTemplates.map(template => {
                return (
                  <button
                    key={template.id}
                    onClick={() => onSelectTemplate(template)}
                    className={`group relative border rounded-xl overflow-hidden hover:border-purple-500 transition-all ${
                      theme === 'dark'
                        ? 'bg-zinc-900 border-zinc-800'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    {/* Preview - Fixed uniform size */}
                    <div 
                      className="relative aspect-square flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: template.canvas.backgroundColor }}
                    >
                      <span className="text-6xl">{template.preview}</span>
                      
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-4 py-2 bg-purple-600 rounded-lg text-white text-sm font-medium">
                          Use Template
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h4 className={`text-sm font-medium group-hover:text-purple-400 transition-colors ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {template.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">{template.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateSelector;
