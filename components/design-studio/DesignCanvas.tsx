// =============================================================================
// DESIGN CANVAS - Main interactive canvas area with drag/drop/resize
// =============================================================================

import React, { useRef, useState, useCallback, useEffect } from 'react';
import DesignElementComponent from './DesignElement';
import type { DesignElement, CanvasState, Position, ResizeHandle, ToolState } from './types';
import { useTheme } from '../../contexts/ThemeContext';

interface DesignCanvasProps {
  canvas: CanvasState;
  elements: DesignElement[];
  selectedIds: string[];
  toolState: ToolState;
  zoom: number;
  onSelectElement: (id: string, addToSelection?: boolean) => void;
  onDeselectAll: () => void;
  onUpdateElement: (id: string, updates: Partial<DesignElement>) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onZoomChange: (zoom: number) => void;
  onAddElementAt: (type: 'text' | 'image' | 'shape', position: Position) => void;
}

const DesignCanvas: React.FC<DesignCanvasProps> = ({
  canvas,
  elements,
  selectedIds,
  toolState,
  zoom,
  onSelectElement,
  onDeselectAll,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onZoomChange,
  onAddElementAt,
}) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState<{ position: Position; size: { width: number; height: number } }>({
    position: { x: 0, y: 0 },
    size: { width: 0, height: 0 },
  });
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState<Position>({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });

  const scale = zoom / 100;

  // Handle mouse down on canvas (deselect all)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-bg')) {
      onDeselectAll();
      
      // Start panning if pan tool is active
      if (toolState.activeTool === 'pan') {
        setIsPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      }
    }
  };

  // Handle element drag start
  const handleStartDrag = (id: string, e: React.MouseEvent) => {
    const element = elements.find(el => el.id === id);
    if (!element || element.locked) return;

    setIsDragging(true);
    setActiveElementId(id);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ position: { ...element.position }, size: { ...element.size } });
  };

  // Handle element resize start
  const handleStartResize = (id: string, handle: ResizeHandle, e: React.MouseEvent) => {
    const element = elements.find(el => el.id === id);
    if (!element || element.locked) return;

    setIsResizing(true);
    setActiveElementId(id);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ position: { ...element.position }, size: { ...element.size } });
  };

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (!activeElementId) return;

    const deltaX = (e.clientX - dragStart.x) / scale;
    const deltaY = (e.clientY - dragStart.y) / scale;

    if (isDragging) {
      onUpdateElement(activeElementId, {
        position: {
          x: Math.round(elementStart.position.x + deltaX),
          y: Math.round(elementStart.position.y + deltaY),
        },
      });
    }

    if (isResizing && resizeHandle) {
      let newPosition = { ...elementStart.position };
      let newSize = { ...elementStart.size };

      // Calculate new size and position based on handle
      switch (resizeHandle) {
        case 'top-left':
          newSize.width = Math.max(20, elementStart.size.width - deltaX);
          newSize.height = Math.max(20, elementStart.size.height - deltaY);
          newPosition.x = elementStart.position.x + (elementStart.size.width - newSize.width);
          newPosition.y = elementStart.position.y + (elementStart.size.height - newSize.height);
          break;
        case 'top':
          newSize.height = Math.max(20, elementStart.size.height - deltaY);
          newPosition.y = elementStart.position.y + (elementStart.size.height - newSize.height);
          break;
        case 'top-right':
          newSize.width = Math.max(20, elementStart.size.width + deltaX);
          newSize.height = Math.max(20, elementStart.size.height - deltaY);
          newPosition.y = elementStart.position.y + (elementStart.size.height - newSize.height);
          break;
        case 'left':
          newSize.width = Math.max(20, elementStart.size.width - deltaX);
          newPosition.x = elementStart.position.x + (elementStart.size.width - newSize.width);
          break;
        case 'right':
          newSize.width = Math.max(20, elementStart.size.width + deltaX);
          break;
        case 'bottom-left':
          newSize.width = Math.max(20, elementStart.size.width - deltaX);
          newSize.height = Math.max(20, elementStart.size.height + deltaY);
          newPosition.x = elementStart.position.x + (elementStart.size.width - newSize.width);
          break;
        case 'bottom':
          newSize.height = Math.max(20, elementStart.size.height + deltaY);
          break;
        case 'bottom-right':
          newSize.width = Math.max(20, elementStart.size.width + deltaX);
          newSize.height = Math.max(20, elementStart.size.height + deltaY);
          break;
      }

      onUpdateElement(activeElementId, {
        position: { x: Math.round(newPosition.x), y: Math.round(newPosition.y) },
        size: { width: Math.round(newSize.width), height: Math.round(newSize.height) },
      });
    }
  }, [isDragging, isResizing, isPanning, activeElementId, dragStart, elementStart, resizeHandle, scale, panStart, onUpdateElement]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setIsPanning(false);
    setActiveElementId(null);
    setResizeHandle(null);
  }, []);

  // Add global mouse listeners
  useEffect(() => {
    if (isDragging || isResizing || isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, isPanning, handleMouseMove, handleMouseUp]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected elements
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        // Don't delete if we're editing text
        if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;
        selectedIds.forEach(id => onDeleteElement(id));
      }

      // Duplicate with Ctrl+D
      if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedIds.length > 0) {
        e.preventDefault();
        selectedIds.forEach(id => onDuplicateElement(id));
      }

      // Move elements with arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.length > 0) {
        if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        selectedIds.forEach(id => {
          const element = elements.find(el => el.id === id);
          if (!element || element.locked) return;
          
          let dx = 0, dy = 0;
          if (e.key === 'ArrowUp') dy = -delta;
          if (e.key === 'ArrowDown') dy = delta;
          if (e.key === 'ArrowLeft') dx = -delta;
          if (e.key === 'ArrowRight') dx = delta;
          
          onUpdateElement(id, {
            position: { x: element.position.x + dx, y: element.position.y + dy }
          });
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, elements, onDeleteElement, onDuplicateElement, onUpdateElement]);

  // Handle double click to add element
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('canvas-bg')) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - panOffset.x) / scale;
    const y = (e.clientY - rect.top - panOffset.y) / scale;

    if (toolState.activeTool === 'text') {
      onAddElementAt('text', { x, y });
    }
  };

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      onZoomChange(Math.min(200, Math.max(25, zoom + delta)));
    }
  };

  const handleElementDoubleClick = (id: string) => {
    // Element-specific double click handling is done in DesignElementComponent
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-zinc-950' : 'bg-slate-200'}`}>
      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-8"
        style={{ cursor: toolState.activeTool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={handleCanvasMouseDown}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      >
        {/* Canvas - Use transform scale for proper zooming */}
        <div
          className="relative shadow-2xl canvas-bg"
          style={{
            width: canvas.width,
            height: canvas.height,
            backgroundColor: canvas.backgroundColor,
            backgroundImage: canvas.backgroundImage ? `url(${canvas.backgroundImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Gradient overlay if set */}
          {canvas.backgroundGradient && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: canvas.backgroundGradient.type === 'linear'
                  ? `linear-gradient(${canvas.backgroundGradient.angle}deg, ${canvas.backgroundGradient.stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`
                  : `radial-gradient(circle, ${canvas.backgroundGradient.stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`
              }}
            />
          )}

          {/* Elements */}
          {elements
            .filter(el => el.visible)
            .sort((a, b) => a.zIndex - b.zIndex)
            .map(element => (
              <DesignElementComponent
                key={element.id}
                element={element}
                isSelected={selectedIds.includes(element.id)}
                scale={scale}
                onSelect={onSelectElement}
                onUpdate={onUpdateElement}
                onDelete={onDeleteElement}
                onDuplicate={onDuplicateElement}
                onStartDrag={handleStartDrag}
                onStartResize={handleStartResize}
                onDoubleClick={handleElementDoubleClick}
              />
            ))}
        </div>
      </div>
    </div>
  );
};

export default DesignCanvas;
