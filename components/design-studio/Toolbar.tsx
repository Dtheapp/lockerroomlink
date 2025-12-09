// =============================================================================
// DESIGN TOOLBAR - Left side tool panel (Professional Photoshop-style)
// Includes: Select, Pan, Text, Image, QR, Eyedropper, Eraser, Background Eraser, Brush
// =============================================================================

import React, { useState } from 'react';
import { 
  MousePointer2, 
  Type, 
  Image, 
  QrCode,
  Hand,
  Sparkles,
  Pipette,
  Eraser,
  Wand2,
  Paintbrush,
  Crop,
  ChevronDown,
} from 'lucide-react';
import type { ToolState, ActiveTool } from './types';
import { useTheme } from '../../contexts/ThemeContext';

interface ToolbarProps {
  toolState: ToolState;
  onToolChange: (tool: ActiveTool) => void;
  onShapeChange: (shape: ToolState['shapeType']) => void;
  onAddElement: (type: 'text' | 'image' | 'shape' | 'qrcode') => void;
  onToolSettingChange?: (key: keyof ToolState, value: any) => void;
  selectedElementType?: string | null;
}

const Toolbar: React.FC<ToolbarProps> = ({
  toolState,
  onToolChange,
  onShapeChange,
  onAddElement,
  onToolSettingChange,
  selectedElementType,
}) => {
  const { theme } = useTheme();
  const [showEraserMenu, setShowEraserMenu] = useState(false);
  
  // Selection & Navigation tools
  const navTools = [
    { id: 'select' as const, icon: MousePointer2, label: 'Select (V)', shortcut: 'V' },
    { id: 'pan' as const, icon: Hand, label: 'Pan (H)', shortcut: 'H' },
  ];

  // Add element tools
  const addTools = [
    { id: 'text' as const, icon: Type, label: 'Add Text (T)', shortcut: 'T', action: () => onAddElement('text') },
    { id: 'image' as const, icon: Image, label: 'Add Image (I)', shortcut: 'I', action: () => onAddElement('image') },
    { id: 'qrcode' as const, icon: QrCode, label: 'Add QR Code', action: () => onAddElement('qrcode') },
  ];

  // Professional editing tools (Photoshop-style)
  const editTools = [
    { 
      id: 'eyedropper' as const, 
      icon: Pipette, 
      label: 'Eyedropper (Color Picker)', 
      description: 'Click any color to sample it',
      shortcut: 'C'
    },
    { 
      id: 'brush' as const, 
      icon: Paintbrush, 
      label: 'Brush Tool (B)', 
      description: 'Paint on images',
      shortcut: 'B'
    },
    { 
      id: 'eraser' as const, 
      icon: Eraser, 
      label: 'Eraser (E)', 
      description: 'Erase parts of images',
      shortcut: 'E',
      hasSubmenu: true,
    },
    { 
      id: 'backgroundEraser' as const, 
      icon: Wand2, 
      label: 'Background Eraser / Magic Wand', 
      description: 'Click to remove similar colors (like white backgrounds)',
      shortcut: 'W'
    },
    { 
      id: 'crop' as const, 
      icon: Crop, 
      label: 'Crop Tool', 
      description: 'Crop images',
      shortcut: 'X'
    },
  ];

  const isImageSelected = selectedElementType === 'image' || selectedElementType === 'logo';
  const isEditToolActive = ['eyedropper', 'eraser', 'backgroundEraser', 'brush', 'crop'].includes(toolState.activeTool);

  return (
    <div className={`w-14 border-r flex flex-col items-center py-3 gap-1 ${
      theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
    }`}>
      {/* Selection Tools */}
      <div className={`flex flex-col items-center gap-1 pb-2 border-b mb-2 ${theme === 'dark' ? 'border-zinc-800' : 'border-slate-200'}`}>
        {navTools.map(tool => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              toolState.activeTool === tool.id
                ? 'bg-purple-600 text-white'
                : theme === 'dark' 
                  ? 'text-slate-400 hover:bg-zinc-800 hover:text-white' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title={tool.label}
          >
            <tool.icon className="w-5 h-5" />
          </button>
        ))}
      </div>

      {/* Add Element Tools */}
      <div className={`flex flex-col items-center gap-1 pb-2 border-b mb-2 ${theme === 'dark' ? 'border-zinc-800' : 'border-slate-200'}`}>
        {addTools.map(tool => (
          <button
            key={tool.id}
            onClick={tool.action}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              theme === 'dark' 
                ? 'text-slate-400 hover:bg-zinc-800 hover:text-white' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title={tool.label}
          >
            <tool.icon className="w-5 h-5" />
          </button>
        ))}
      </div>

      {/* Professional Edit Tools */}
      <div className="flex flex-col items-center gap-1 relative">
        <div className={`text-[9px] uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
          Edit
        </div>
        
        {editTools.map(tool => (
          <div key={tool.id} className="relative">
            <button
              onClick={() => {
                if (tool.id === 'eraser' && tool.hasSubmenu) {
                  setShowEraserMenu(!showEraserMenu);
                } else {
                  onToolChange(tool.id);
                  setShowEraserMenu(false);
                }
              }}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all relative ${
                toolState.activeTool === tool.id
                  ? 'bg-purple-600 text-white'
                  : !isImageSelected && tool.id !== 'eyedropper'
                    ? theme === 'dark'
                      ? 'text-slate-600 cursor-not-allowed opacity-50'
                      : 'text-slate-400 cursor-not-allowed opacity-50'
                    : theme === 'dark' 
                      ? 'text-slate-400 hover:bg-zinc-800 hover:text-white' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title={tool.label + (tool.description ? `\n${tool.description}` : '')}
              disabled={!isImageSelected && tool.id !== 'eyedropper'}
            >
              <tool.icon className="w-5 h-5" />
              {tool.hasSubmenu && (
                <ChevronDown className="w-2 h-2 absolute bottom-1 right-1" />
              )}
            </button>
            
            {/* Eraser submenu */}
            {tool.id === 'eraser' && showEraserMenu && (
              <div className={`absolute left-12 top-0 w-48 rounded-lg shadow-xl border z-50 ${
                theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-200'
              }`}>
                <button
                  onClick={() => {
                    onToolChange('eraser');
                    setShowEraserMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                    theme === 'dark' ? 'hover:bg-zinc-700 text-white' : 'hover:bg-slate-100 text-slate-900'
                  } ${toolState.activeTool === 'eraser' ? 'bg-purple-600/20' : ''}`}
                >
                  <Eraser className="w-4 h-4" />
                  <div>
                    <div>Eraser Tool</div>
                    <div className="text-xs text-slate-500">Erase with brush</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onToolChange('backgroundEraser');
                    setShowEraserMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                    theme === 'dark' ? 'hover:bg-zinc-700 text-white' : 'hover:bg-slate-100 text-slate-900'
                  } ${toolState.activeTool === 'backgroundEraser' ? 'bg-purple-600/20' : ''}`}
                >
                  <Wand2 className="w-4 h-4" />
                  <div>
                    <div>Background Eraser</div>
                    <div className="text-xs text-slate-500">Click to remove color</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sampled Color Display */}
      {toolState.sampledColor && (
        <div className="flex flex-col items-center gap-1 mb-2">
          <div
            className="w-8 h-8 rounded border-2 border-white shadow-lg"
            style={{ backgroundColor: toolState.sampledColor }}
            title={`Sampled: ${toolState.sampledColor}`}
          />
          <span className="text-[8px] text-slate-500 font-mono">
            {toolState.sampledColor.toUpperCase()}
          </span>
        </div>
      )}

      {/* Quick Tips */}
      <div className="text-center px-1">
        <Sparkles className="w-4 h-4 text-purple-400 mx-auto mb-1" />
        <span className="text-[9px] text-slate-500">Del to</span>
        <span className="text-[9px] text-slate-500 block">delete</span>
      </div>
    </div>
  );
};

export default Toolbar;
