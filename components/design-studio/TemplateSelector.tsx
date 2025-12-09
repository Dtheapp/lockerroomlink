// =============================================================================
// TEMPLATE SELECTOR - Choose from pre-built templates
// =============================================================================

import React, { useState } from 'react';
import { ChevronLeft, Search, Sparkles, FolderOpen, AlertTriangle, FileWarning, Wand2, Crown, Shirt } from 'lucide-react';
import { TEMPLATE_CATEGORIES, DESIGN_TEMPLATES, getTemplatesByCategory } from './templates';
import { FLYER_SIZES, FlyerSize } from './types';
import type { DesignTemplate } from './types';
import { useTheme } from '../../contexts/ThemeContext';

// Reminder item for items without designs
interface DesignReminder {
  id: string;
  type: 'registration' | 'game' | 'event';
  name: string;
  date?: string;
  suggestedTemplate: string; // Template ID to use
}

interface TemplateSelectorProps {
  onSelectTemplate: (template: DesignTemplate) => void;
  onStartBlank: (size: FlyerSize, customWidth?: number, customHeight?: number) => void;
  onBack: () => void;
  onOpenGallery?: () => void;
  onOpenAICreator?: () => void; // NEW: Open AI Creator modal
  onOpenUniformDesigner?: () => void; // NEW: Open Uniform Designer
  // Reminders for items without designs
  reminders?: DesignReminder[];
  onReminderClick?: (reminder: DesignReminder) => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onSelectTemplate,
  onStartBlank,
  onBack,
  onOpenGallery,
  onOpenAICreator,
  onOpenUniformDesigner,
  reminders = [],
  onReminderClick,
}) => {
  const { theme } = useTheme();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSize, setSelectedSize] = useState<FlyerSize>('instagram');
  
  // Custom size state
  const [showCustomSize, setShowCustomSize] = useState(false);
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1080);

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

        {/* AI Creator CTA - Premium Feature */}
        {onOpenAICreator && (
          <div className="mb-8">
            <button
              onClick={onOpenAICreator}
              className={`w-full p-6 rounded-2xl border transition-all group relative overflow-hidden ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-orange-600/20 border-purple-500/30 hover:border-purple-500/60'
                  : 'bg-gradient-to-r from-purple-100 via-pink-100 to-orange-100 border-purple-300 hover:border-purple-400 shadow-sm'
              }`}
            >
              {/* Animated background shimmer */}
              <div className={`absolute inset-0 bg-gradient-to-r from-transparent to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ${theme === 'dark' ? 'via-white/5' : 'via-white/50'}`} />
              
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Wand2 className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Create with AI</h3>
                    <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-xs font-bold text-white rounded-full flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      PREMIUM
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    Generate stunning logos, flyers, posters & more with AI. Upload photos, describe your vision, get professional designs in seconds.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-orange-500">
                    5 credits
                  </div>
                  <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>per generation</div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Uniform Designer Pro CTA */}
        {onOpenUniformDesigner && (
          <div className="mb-8">
            <button
              onClick={onOpenUniformDesigner}
              className={`w-full p-6 rounded-2xl border transition-all group relative overflow-hidden ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-orange-600/20 via-red-600/20 to-amber-600/20 border-orange-500/30 hover:border-orange-500/60'
                  : 'bg-gradient-to-r from-orange-100 via-red-100 to-amber-100 border-orange-300 hover:border-orange-400 shadow-sm'
              }`}
            >
              {/* Animated background shimmer */}
              <div className={`absolute inset-0 bg-gradient-to-r from-transparent to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ${theme === 'dark' ? 'via-white/5' : 'via-white/50'}`} />
              
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <Shirt className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Uniform Designer Pro</h3>
                    <span className="px-2 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-xs font-bold text-white rounded-full">
                      NEW
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    Design jerseys, shorts, pants & more. Preview on a 3D player model with full rotation. Best uniform builder in sports.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">
                    View on Player
                  </div>
                  <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>3D Preview</div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Design Reminders - Items without flyers */}
        {reminders.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <h3 className={`text-sm font-medium uppercase tracking-wide ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}>
                Needs Design ({reminders.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {reminders.map((reminder) => (
                <button
                  key={reminder.id}
                  onClick={() => onReminderClick?.(reminder)}
                  className={`group flex items-start gap-3 p-4 border rounded-xl hover:border-orange-500 transition-all text-left ${
                    theme === 'dark'
                      ? 'bg-orange-500/10 border-orange-500/30'
                      : 'bg-orange-50 border-orange-200'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    reminder.type === 'registration' ? 'bg-purple-500/20' :
                    reminder.type === 'game' ? 'bg-blue-500/20' : 'bg-green-500/20'
                  }`}>
                    <FileWarning className={`w-5 h-5 ${
                      reminder.type === 'registration' ? 'text-purple-400' :
                      reminder.type === 'game' ? 'text-blue-400' : 'text-green-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {reminder.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {reminder.type === 'registration' && '📝 No registration flyer'}
                      {reminder.type === 'game' && '🎟️ No ticket design'}
                      {reminder.type === 'event' && '📅 No event flyer'}
                    </div>
                    {reminder.date && (
                      <div className="text-xs text-orange-400 mt-1">
                        {reminder.date}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-orange-400 group-hover:text-orange-300 font-medium">
                    Create →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

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
            
            {/* Custom size button */}
            <button
              onClick={() => setShowCustomSize(!showCustomSize)}
              className={`group p-4 border rounded-xl transition-all text-center ${
                showCustomSize
                  ? 'border-purple-500 bg-purple-500/10'
                  : theme === 'dark'
                    ? 'bg-zinc-900 border-zinc-800 hover:border-purple-500'
                    : 'bg-white border-slate-200 hover:border-purple-500'
              }`}
            >
              <div className="text-2xl mb-2">✏️</div>
              <div className={`text-sm font-medium group-hover:text-purple-400 transition-colors ${showCustomSize ? 'text-purple-400' : theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Custom
              </div>
              <div className="text-xs text-slate-500">
                Any size
              </div>
            </button>
          </div>
          
          {/* Custom size input panel */}
          {showCustomSize && (
            <div className={`mt-4 p-4 rounded-xl border ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Width (px)</label>
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Math.max(100, Math.min(5000, parseInt(e.target.value) || 100)))}
                    min={100}
                    max={5000}
                    className={`w-full px-3 py-2 border rounded-lg focus:border-purple-500 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
                <div className={`text-xl font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>×</div>
                <div className="flex-1">
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Height (px)</label>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Math.max(100, Math.min(5000, parseInt(e.target.value) || 100)))}
                    min={100}
                    max={5000}
                    className={`w-full px-3 py-2 border rounded-lg focus:border-purple-500 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
                <button
                  onClick={() => onStartBlank('instagram', customWidth, customHeight)}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                >
                  Create
                </button>
              </div>
              <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                Tip: Use smaller sizes for logos (e.g., 500×500), larger for banners or posters
              </p>
            </div>
          )}
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
