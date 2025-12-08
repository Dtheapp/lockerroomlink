// =============================================================================
// DESIGN TOOLBAR - Left side tool panel (simplified)
// =============================================================================

import React from 'react';
import { 
  MousePointer2, 
  Type, 
  Image, 
  QrCode,
  Hand,
  Sparkles,
} from 'lucide-react';
import type { ToolState } from './types';
import { useTheme } from '../../contexts/ThemeContext';

interface ToolbarProps {
  toolState: ToolState;
  onToolChange: (tool: ToolState['activeTool']) => void;
  onShapeChange: (shape: ToolState['shapeType']) => void;
  onAddElement: (type: 'text' | 'image' | 'shape' | 'qrcode') => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  toolState,
  onToolChange,
  onShapeChange,
  onAddElement,
}) => {
  const { theme } = useTheme();
  
  const tools = [
    { id: 'select' as const, icon: MousePointer2, label: 'Select (V)', shortcut: 'V' },
    { id: 'pan' as const, icon: Hand, label: 'Pan (H)', shortcut: 'H' },
  ];

  const addTools = [
    { id: 'text' as const, icon: Type, label: 'Add Text (T)', shortcut: 'T', action: () => onAddElement('text') },
    { id: 'image' as const, icon: Image, label: 'Add Image (I)', shortcut: 'I', action: () => onAddElement('image') },
    { id: 'qrcode' as const, icon: QrCode, label: 'Add QR Code', action: () => onAddElement('qrcode') },
  ];

  return (
    <div className={`w-14 border-r flex flex-col items-center py-3 gap-1 ${
      theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
    }`}>
      {/* Selection Tools */}
      <div className={`flex flex-col items-center gap-1 pb-2 border-b mb-2 ${theme === 'dark' ? 'border-zinc-800' : 'border-slate-200'}`}>
        {tools.map(tool => (
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
      <div className="flex flex-col items-center gap-1">
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

      {/* Spacer */}
      <div className="flex-1" />

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
