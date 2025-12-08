// =============================================================================
// LAYERS PANEL - Element layer management with drag-and-drop
// =============================================================================

import React, { useState, useRef } from 'react';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Trash2,
  GripVertical,
  Type,
  Image,
  Square,
  QrCode,
  Sparkles,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { DesignElement } from './types';
import { useTheme } from '../../contexts/ThemeContext';

interface LayersPanelProps {
  elements: DesignElement[];
  selectedIds: string[];
  onSelect: (id: string, addToSelection?: boolean) => void;
  onUpdate: (id: string, updates: Partial<DesignElement>) => void;
  onDelete: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

const getElementIcon = (type: string) => {
  switch (type) {
    case 'text': return Type;
    case 'image': return Image;
    case 'logo': return Sparkles;
    case 'shape': return Square;
    case 'qrcode': return QrCode;
    default: return Square;
  }
};

const getElementLabel = (element: DesignElement) => {
  if (element.type === 'text' && element.content) {
    return element.content.substring(0, 15) + (element.content.length > 15 ? '...' : '');
  }
  return element.type.charAt(0).toUpperCase() + element.type.slice(1);
};

const LayersPanel: React.FC<LayersPanelProps> = ({
  elements,
  selectedIds,
  onSelect,
  onUpdate,
  onDelete,
  onReorder,
}) => {
  const { theme } = useTheme();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  
  // Sort elements by zIndex descending (top layers first)
  const sortedElements = [...elements].sort((a, b) => b.zIndex - a.zIndex);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      // Convert visual indices to actual element indices
      const fromElement = sortedElements[draggedIndex];
      const toElement = sortedElements[toIndex];
      
      const fromActualIndex = elements.findIndex(el => el.id === fromElement.id);
      const toActualIndex = elements.findIndex(el => el.id === toElement.id);
      
      onReorder(fromActualIndex, toActualIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Move layer up/down functions
  const moveLayerUp = (index: number) => {
    if (index <= 0) return;
    const fromElement = sortedElements[index];
    const toElement = sortedElements[index - 1];
    const fromActualIndex = elements.findIndex(el => el.id === fromElement.id);
    const toActualIndex = elements.findIndex(el => el.id === toElement.id);
    onReorder(fromActualIndex, toActualIndex);
  };

  const moveLayerDown = (index: number) => {
    if (index >= sortedElements.length - 1) return;
    const fromElement = sortedElements[index];
    const toElement = sortedElements[index + 1];
    const fromActualIndex = elements.findIndex(el => el.id === fromElement.id);
    const toActualIndex = elements.findIndex(el => el.id === toElement.id);
    onReorder(fromActualIndex, toActualIndex);
  };

  if (elements.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
          theme === 'dark' ? 'bg-zinc-800' : 'bg-slate-100'
        }`}>
          <Sparkles className="w-6 h-6 text-purple-400" />
        </div>
        <p className={theme === 'dark' ? 'text-slate-400 text-sm' : 'text-slate-600 text-sm'}>No elements yet</p>
        <p className="text-slate-500 text-xs mt-1">Add elements from Quick Add</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {sortedElements.map((element, index) => {
          const Icon = getElementIcon(element.type);
          const isSelected = selectedIds.includes(element.id);
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;

          return (
            <div
              key={element.id}
              ref={dragRef}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={(e) => onSelect(element.id, e.shiftKey)}
              className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-all ${
                isDragging ? 'opacity-50' : ''
              } ${isDragOver ? 'border-t-2 border-purple-500' : ''} ${
                isSelected
                  ? 'bg-purple-600/20 border-l-2 border-purple-500'
                  : theme === 'dark'
                    ? 'hover:bg-zinc-800 border-l-2 border-transparent'
                    : 'hover:bg-slate-100 border-l-2 border-transparent'
              }`}
            >
              {/* Drag Handle */}
              <GripVertical className="w-3 h-3 text-slate-500 cursor-grab flex-shrink-0" />

              {/* Element Icon */}
              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                isSelected ? 'bg-purple-600/30' : theme === 'dark' ? 'bg-zinc-800' : 'bg-slate-100'
              }`}>
                <Icon className={`w-3 h-3 ${isSelected ? 'text-purple-400' : 'text-slate-500'}`} />
              </div>

              {/* Element Name */}
              <span className={`flex-1 text-xs truncate ${
                isSelected 
                  ? theme === 'dark' ? 'text-white' : 'text-slate-900'
                  : theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              } ${!element.visible ? 'opacity-50' : ''}`}>
                {getElementLabel(element)}
              </span>

              {/* Layer Order Buttons */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); moveLayerUp(index); }}
                  disabled={index === 0}
                  className={`p-0.5 rounded ${
                    index === 0 
                      ? 'text-slate-600 cursor-not-allowed' 
                      : theme === 'dark' 
                        ? 'hover:bg-zinc-700 text-slate-400 hover:text-white' 
                        : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                  }`}
                  title="Move Up"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveLayerDown(index); }}
                  disabled={index === sortedElements.length - 1}
                  className={`p-0.5 rounded ${
                    index === sortedElements.length - 1 
                      ? 'text-slate-600 cursor-not-allowed' 
                      : theme === 'dark' 
                        ? 'hover:bg-zinc-700 text-slate-400 hover:text-white' 
                        : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                  }`}
                  title="Move Down"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              {/* Visibility/Lock */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdate(element.id, { visible: !element.visible }); }}
                  className={`p-0.5 rounded ${theme === 'dark' ? 'hover:bg-zinc-700 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'}`}
                  title={element.visible ? 'Hide' : 'Show'}
                >
                  {element.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
                {element.locked && <Lock className="w-3 h-3 text-orange-400" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LayersPanel;
