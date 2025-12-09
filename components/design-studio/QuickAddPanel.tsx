// =============================================================================
// QUICK ADD PANEL - Fast element insertion with presets
// =============================================================================

import React, { useState } from 'react';
import { 
  Type, 
  Square, 
  Image,
  Smile,
  Hash,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { TEXT_PRESETS, SHAPE_PRESETS, SPORT_ICONS, QUICK_PHRASES } from './presets';
import type { DesignElement, Position } from './types';
import { generateId, createDefaultElement } from './types';
import { useTheme } from '../../contexts/ThemeContext';

interface QuickAddPanelProps {
  canvasCenter: Position;
  onAddElement: (element: DesignElement) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const QuickAddPanel: React.FC<QuickAddPanelProps> = ({
  canvasCenter,
  onAddElement,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { theme } = useTheme();
  const [expandedSection, setExpandedSection] = useState<string | null>('text');
  
  // Pre-compute theme classes to avoid recalculation
  const isDark = theme === 'dark';

  const addTextWithPreset = (presetId: string) => {
    const preset = TEXT_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    const element: DesignElement = {
      id: generateId(),
      type: 'text',
      position: { x: canvasCenter.x - 150, y: canvasCenter.y - 25 },
      size: { width: 300, height: (preset.styles.fontSize || 32) * 1.5 },
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: Date.now(),
      content: preset.preview,
      ...preset.styles,
    };

    onAddElement(element);
  };

  const addShapeWithPreset = (presetId: string) => {
    const preset = SHAPE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    const size = preset.styles.size || { width: 200, height: 100 };
    const element: DesignElement = {
      id: generateId(),
      type: 'shape',
      position: { x: canvasCenter.x - size.width / 2, y: canvasCenter.y - size.height / 2 },
      size,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: Date.now(),
      ...preset.styles,
    };

    onAddElement(element);
  };

  const addEmoji = (emoji: string) => {
    const element: DesignElement = {
      id: generateId(),
      type: 'text',
      position: { x: canvasCenter.x - 50, y: canvasCenter.y - 50 },
      size: { width: 100, height: 100 },
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: Date.now(),
      content: emoji,
      fontSize: 72,
      textAlign: 'center',
      autoScaleFont: true, // Scale emoji with element size
    };

    onAddElement(element);
  };

  const addQuickPhrase = (phrase: string) => {
    const element: DesignElement = {
      id: generateId(),
      type: 'text',
      position: { x: canvasCenter.x - 150, y: canvasCenter.y - 25 },
      size: { width: 300, height: 50 },
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: Date.now(),
      content: phrase,
      fontSize: 32,
      fontWeight: 'bold',
      fontFamily: 'Inter, system-ui, sans-serif',
      textAlign: 'center',
      color: '#ffffff',
    };

    onAddElement(element);
  };

  // Render a section with collapsible header
  const renderSection = (id: string, title: string, icon: React.ReactNode, children: React.ReactNode) => {
    const isExpanded = expandedSection === id;
    
    return (
      <div key={id} className={isDark ? 'border-b last:border-b-0 border-zinc-800' : 'border-b last:border-b-0 border-slate-200'}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpandedSection(isExpanded ? null : id);
          }}
          className={isDark 
            ? 'w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800' 
            : 'w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100'
          }
        >
          {icon}
          <span className={isDark ? 'text-sm font-medium flex-1 text-left text-white' : 'text-sm font-medium flex-1 text-left text-slate-900'}>{title}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>
        {isExpanded && (
          <div className="px-3 pb-3">
            {children}
          </div>
        )}
      </div>
    );
  };

  // Collapsed state - just show icons
  if (isCollapsed) {
    return (
      <div className={isDark 
        ? 'w-12 border-r flex flex-col items-center py-2 bg-zinc-900 border-zinc-800'
        : 'w-12 border-r flex flex-col items-center py-2 bg-white border-slate-200'
      }>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={isDark ? 'p-2 rounded-lg mb-2 hover:bg-zinc-800 text-slate-400' : 'p-2 rounded-lg mb-2 hover:bg-slate-100 text-slate-600'}
            title="Expand panel"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => addTextWithPreset('heading')}
          className={isDark ? 'p-2 rounded-lg hover:bg-zinc-800 text-purple-400' : 'p-2 rounded-lg hover:bg-slate-100 text-purple-600'}
          title="Add Text"
        >
          <Type className="w-4 h-4" />
        </button>
        <button
          onClick={() => addShapeWithPreset('button-primary')}
          className={isDark ? 'p-2 rounded-lg hover:bg-zinc-800 text-blue-400' : 'p-2 rounded-lg hover:bg-slate-100 text-blue-600'}
          title="Add Shape"
        >
          <Square className="w-4 h-4" />
        </button>
        <button
          onClick={() => addEmoji('⚽')}
          className={isDark ? 'p-2 rounded-lg hover:bg-zinc-800 text-yellow-400' : 'p-2 rounded-lg hover:bg-slate-100 text-yellow-600'}
          title="Add Icon"
        >
          <Smile className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={isDark 
      ? 'w-52 border-r flex flex-col overflow-hidden bg-zinc-900 border-zinc-800'
      : 'w-52 border-r flex flex-col overflow-hidden bg-white border-slate-200'
    }>
      <div className={isDark ? 'p-2 border-b flex items-center justify-between border-zinc-800' : 'p-2 border-b flex items-center justify-between border-slate-200'}>
        <h3 className={isDark ? 'text-xs font-medium uppercase tracking-wide text-slate-400' : 'text-xs font-medium uppercase tracking-wide text-slate-500'}>
          Quick Add
        </h3>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={isDark ? 'p-1 rounded hover:bg-zinc-800 text-slate-400' : 'p-1 rounded hover:bg-slate-100 text-slate-600'}
            title="Collapse panel"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Text Presets */}
        {renderSection(
          'text',
          'Text Styles',
          <Type className="w-4 h-4 text-purple-400" />,
          <div className="space-y-1">
            {TEXT_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => addTextWithPreset(preset.id)}
                className={isDark 
                  ? 'w-full p-2 rounded-lg text-left bg-zinc-800 hover:bg-zinc-700' 
                  : 'w-full p-2 rounded-lg text-left bg-slate-100 hover:bg-slate-200'
                }
              >
                <div 
                  className={isDark ? 'truncate text-white' : 'truncate text-slate-900'}
                  style={{
                    fontSize: Math.min(preset.styles.fontSize || 16, 18),
                    fontWeight: preset.styles.fontWeight,
                    fontStyle: preset.styles.fontStyle,
                  }}
                >
                  {preset.preview}
                </div>
                <div className={isDark ? 'text-[10px] mt-0.5 text-slate-500' : 'text-[10px] mt-0.5 text-slate-400'}>{preset.name}</div>
              </button>
            ))}
          </div>
        )}

        {/* Shape Presets */}
        {renderSection(
          'shapes',
          'Shapes & Buttons',
          <Square className="w-4 h-4 text-blue-400" />,
          <div className="grid grid-cols-2 gap-1">
            {SHAPE_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => addShapeWithPreset(preset.id)}
                className={isDark 
                  ? 'p-2 rounded-lg text-center bg-zinc-800 hover:bg-zinc-700' 
                  : 'p-2 rounded-lg text-center bg-slate-100 hover:bg-slate-200'
                }
              >
                <span className="text-lg">{preset.icon}</span>
                <div className={isDark ? 'text-[10px] mt-1 text-slate-400' : 'text-[10px] mt-1 text-slate-500'}>{preset.name}</div>
              </button>
            ))}
          </div>
        )}

        {/* Sport Icons */}
        {renderSection(
          'icons',
          'Sport Icons',
          <Smile className="w-4 h-4 text-yellow-400" />,
          <div className="grid grid-cols-5 gap-1">
            {SPORT_ICONS.map(icon => (
              <button
                key={icon.emoji}
                onClick={() => addEmoji(icon.emoji)}
                className={isDark ? 'p-1.5 text-xl rounded hover:bg-zinc-800' : 'p-1.5 text-xl rounded hover:bg-slate-100'}
                title={icon.name}
              >
                {icon.emoji}
              </button>
            ))}
          </div>
        )}

        {/* Quick Phrases */}
        {renderSection(
          'phrases',
          'Quick Phrases',
          <Hash className="w-4 h-4 text-green-400" />,
          <div className="space-y-1">
            {QUICK_PHRASES.map(phrase => (
              <button
                key={phrase}
                onClick={() => addQuickPhrase(phrase)}
                className={isDark 
                  ? 'w-full px-2 py-1.5 rounded text-xs font-medium text-left bg-zinc-800 hover:bg-zinc-700 text-white' 
                  : 'w-full px-2 py-1.5 rounded text-xs font-medium text-left bg-slate-100 hover:bg-slate-200 text-slate-900'
                }
              >
                {phrase}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickAddPanel;
