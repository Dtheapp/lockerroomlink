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
  gridEnabled: boolean;
  onSelectElement: (id: string, addToSelection?: boolean) => void;
  onDeselectAll: () => void;
  onUpdateElement: (id: string, updates: Partial<DesignElement>) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onZoomChange: (zoom: number) => void;
  onAddElementAt: (type: 'text' | 'image' | 'shape', position: Position) => void;
  onColorSampled?: (color: string) => void;
  onOpenImageEditor?: (elementId: string) => void;
}

const DesignCanvas: React.FC<DesignCanvasProps> = ({
  canvas,
  elements,
  selectedIds,
  toolState,
  zoom,
  gridEnabled,
  onSelectElement,
  onDeselectAll,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onZoomChange,
  onAddElementAt,
  onColorSampled,
  onOpenImageEditor,
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
  // Track start positions of all selected elements for multi-drag
  const [multiDragStarts, setMultiDragStarts] = useState<Map<string, Position>>(new Map());
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState<Position>({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });

  const scale = zoom / 100;

  // Handle mouse down on canvas (deselect all)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Eyedropper tool - sample color from anywhere
    if (toolState.activeTool === 'eyedropper') {
      e.preventDefault();
      e.stopPropagation();
      // Get color from where user clicked
      const color = getColorFromEvent(e);
      if (color && onColorSampled) {
        onColorSampled(color);
      }
      return;
    }
    
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-bg')) {
      onDeselectAll();
      
      // Start panning if pan tool is active
      if (toolState.activeTool === 'pan') {
        setIsPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      }
    }
  };
  
  // Handle click on any element when eyedropper is active
  const handleEyedropperClick = useCallback((e: MouseEvent) => {
    if (toolState.activeTool !== 'eyedropper') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target as HTMLElement;
    const color = getColorFromElement(target);
    
    if (color && onColorSampled) {
      onColorSampled(color);
    }
  }, [toolState.activeTool, onColorSampled]);
  
  // Add/remove eyedropper click listener
  useEffect(() => {
    if (toolState.activeTool === 'eyedropper') {
      // Use capture phase to intercept clicks before elements handle them
      document.addEventListener('click', handleEyedropperClick, true);
      return () => document.removeEventListener('click', handleEyedropperClick, true);
    }
  }, [toolState.activeTool, handleEyedropperClick]);
  
  // Helper to get color from an element
  const getColorFromElement = (target: HTMLElement): string | null => {
    const computedStyle = window.getComputedStyle(target);
    
    // Check various color properties in order of priority
    const colorSources = [
      computedStyle.backgroundColor,
      computedStyle.background,
      computedStyle.fill,
      computedStyle.color,
      target.style.backgroundColor,
      target.style.background,
    ];
    
    for (const colorSource of colorSources) {
      if (!colorSource) continue;
      
      // Skip transparent colors
      if (colorSource === 'transparent' || 
          colorSource === 'rgba(0, 0, 0, 0)' ||
          colorSource === 'none') continue;
      
      // Convert to hex if it's rgb/rgba
      if (colorSource.startsWith('rgb')) {
        const match = colorSource.match(/\d+/g);
        if (match && match.length >= 3) {
          const r = parseInt(match[0]).toString(16).padStart(2, '0');
          const g = parseInt(match[1]).toString(16).padStart(2, '0');
          const b = parseInt(match[2]).toString(16).padStart(2, '0');
          return `#${r}${g}${b}`;
        }
      }
      
      // If it's already a hex color
      if (colorSource.startsWith('#')) {
        return colorSource.substring(0, 7); // Remove alpha if present
      }
    }
    
    // Try to get color from data attribute (we can set this on elements)
    const dataColor = target.getAttribute('data-element-color');
    if (dataColor) return dataColor;
    
    // Walk up the DOM to find a colored parent
    if (target.parentElement && target.parentElement !== document.body) {
      return getColorFromElement(target.parentElement);
    }
    
    return null;
  };
  
  // Helper to get color from click event (for eyedropper)
  const getColorFromEvent = (e: React.MouseEvent): string | null => {
    return getColorFromElement(e.target as HTMLElement);
  };

  // Handle element drag start
  const handleStartDrag = (id: string, e: React.MouseEvent) => {
    const element = elements.find(el => el.id === id);
    if (!element || element.locked) return;

    setIsDragging(true);
    setActiveElementId(id);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ position: { ...element.position }, size: { ...element.size } });
    
    // If this element is in the selection, capture start positions of ALL selected elements
    if (selectedIds.includes(id) && selectedIds.length > 1) {
      const starts = new Map<string, Position>();
      selectedIds.forEach(selId => {
        const el = elements.find(e => e.id === selId);
        if (el && !el.locked) {
          starts.set(selId, { ...el.position });
        }
      });
      setMultiDragStarts(starts);
    } else {
      setMultiDragStarts(new Map());
    }
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
      // If we have multiple selected elements, move them all together
      if (multiDragStarts.size > 1) {
        multiDragStarts.forEach((startPos, id) => {
          onUpdateElement(id, {
            position: {
              x: Math.round(startPos.x + deltaX),
              y: Math.round(startPos.y + deltaY),
            },
          });
        });
      } else {
        // Single element drag
        onUpdateElement(activeElementId, {
          position: {
            x: Math.round(elementStart.position.x + deltaX),
            y: Math.round(elementStart.position.y + deltaY),
          },
        });
      }
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
  }, [isDragging, isResizing, isPanning, activeElementId, dragStart, elementStart, resizeHandle, scale, panStart, onUpdateElement, multiDragStarts]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setIsPanning(false);
    setActiveElementId(null);
    setResizeHandle(null);
    setMultiDragStarts(new Map());
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

  // Get cursor based on active tool
  const getCursor = () => {
    switch (toolState.activeTool) {
      case 'pan':
        return isPanning ? 'grabbing' : 'grab';
      case 'eyedropper':
        // Custom eyedropper cursor - SVG encoded
        return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m2 22 1-1h3l9-9'/%3E%3Cpath d='M3 21v-3l9-9'/%3E%3Cpath d='m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z'/%3E%3C/svg%3E") 2 22, crosshair`;
      case 'eraser':
      case 'brush':
        return 'crosshair';
      case 'backgroundEraser':
        return 'cell';
      case 'crop':
        return 'crosshair';
      default:
        return 'default';
    }
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-zinc-950' : 'bg-slate-200'}`}>
      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-8"
        style={{ cursor: getCursor() }}
        onMouseDown={handleCanvasMouseDown}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      >
        {/* Wrapper div to maintain proper spacing when scaled */}
        <div 
          style={{
            width: canvas.width * scale,
            height: canvas.height * scale,
            flexShrink: 0,
          }}
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
              transformOrigin: 'top left',
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

          {/* Grid Overlay */}
          {gridEnabled && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(128, 128, 128, 0.3) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(128, 128, 128, 0.3) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px',
              }}
            >
              {/* Major grid lines every 100px */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(128, 128, 128, 0.5) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(128, 128, 128, 0.5) 1px, transparent 1px)
                  `,
                  backgroundSize: '100px 100px',
                }}
              />
            </div>
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
                onEditImage={onOpenImageEditor}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignCanvas;
