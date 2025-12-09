// =============================================================================
// IMAGE EDITOR - Professional Photoshop-style image editing tools
// Includes: Eraser, Background Eraser (Magic Wand), Brush, Crop
// =============================================================================

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { X, Check, RotateCcw, ZoomIn, ZoomOut, Pipette, Eraser, Wand2, Paintbrush } from 'lucide-react';
import type { DesignElement, ToolState, ActiveTool } from './types';

interface ImageEditorProps {
  element: DesignElement;
  toolState: ToolState;
  onSave: (editedImageData: string) => void;
  onCancel: () => void;
  onColorSampled?: (color: string) => void;
}

// Flood fill algorithm for background eraser
const floodFill = (
  imageData: ImageData,
  startX: number,
  startY: number,
  tolerance: number,
  contiguous: boolean
): ImageData => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Get the color at the clicked position
  const getPixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    return {
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      a: data[idx + 3],
    };
  };
  
  const setPixelTransparent = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    data[idx + 3] = 0; // Set alpha to 0 (transparent)
  };
  
  const targetColor = getPixel(startX, startY);
  
  // Check if a color is within tolerance of target
  const colorMatch = (x: number, y: number) => {
    const pixel = getPixel(x, y);
    const diff = Math.abs(pixel.r - targetColor.r) +
                 Math.abs(pixel.g - targetColor.g) +
                 Math.abs(pixel.b - targetColor.b);
    return diff <= tolerance * 3 && pixel.a > 0;
  };
  
  if (contiguous) {
    // Flood fill only connected pixels
    const visited = new Set<string>();
    const stack: [number, number][] = [[startX, startY]];
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const key = `${x},${y}`;
      
      if (visited.has(key)) continue;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (!colorMatch(x, y)) continue;
      
      visited.add(key);
      setPixelTransparent(x, y);
      
      // Add neighbors
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  } else {
    // Remove ALL matching colors in the image
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (colorMatch(x, y)) {
          setPixelTransparent(x, y);
        }
      }
    }
  }
  
  return imageData;
};

// Eraser brush - erase pixels in a circular area
const eraseBrush = (
  imageData: ImageData,
  centerX: number,
  centerY: number,
  brushSize: number,
  hardness: number
): ImageData => {
  const data = imageData.data;
  const width = imageData.width;
  const radius = brushSize / 2;
  
  for (let y = Math.max(0, Math.floor(centerY - radius)); y < Math.min(imageData.height, Math.ceil(centerY + radius)); y++) {
    for (let x = Math.max(0, Math.floor(centerX - radius)); x < Math.min(width, Math.ceil(centerX + radius)); x++) {
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      if (distance <= radius) {
        const idx = (y * width + x) * 4;
        
        // Calculate opacity based on hardness and distance
        let eraseAmount = 1;
        if (hardness < 100) {
          const softness = (100 - hardness) / 100;
          const normalizedDist = distance / radius;
          eraseAmount = 1 - (normalizedDist * softness);
        }
        
        // Reduce alpha
        data[idx + 3] = Math.max(0, data[idx + 3] - (255 * eraseAmount));
      }
    }
  }
  
  return imageData;
};

// Paint brush - add color in a circular area
const paintBrush = (
  imageData: ImageData,
  centerX: number,
  centerY: number,
  brushSize: number,
  hardness: number,
  color: string
): ImageData => {
  const data = imageData.data;
  const width = imageData.width;
  const radius = brushSize / 2;
  
  // Parse color
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 255, g: 255, b: 255 };
  };
  
  const rgb = hexToRgb(color);
  
  for (let y = Math.max(0, Math.floor(centerY - radius)); y < Math.min(imageData.height, Math.ceil(centerY + radius)); y++) {
    for (let x = Math.max(0, Math.floor(centerX - radius)); x < Math.min(width, Math.ceil(centerX + radius)); x++) {
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      if (distance <= radius) {
        const idx = (y * width + x) * 4;
        
        // Calculate opacity based on hardness and distance
        let paintAmount = 1;
        if (hardness < 100) {
          const softness = (100 - hardness) / 100;
          const normalizedDist = distance / radius;
          paintAmount = 1 - (normalizedDist * softness);
        }
        
        // Blend color
        data[idx] = Math.round(data[idx] * (1 - paintAmount) + rgb.r * paintAmount);
        data[idx + 1] = Math.round(data[idx + 1] * (1 - paintAmount) + rgb.g * paintAmount);
        data[idx + 2] = Math.round(data[idx + 2] * (1 - paintAmount) + rgb.b * paintAmount);
        data[idx + 3] = Math.max(data[idx + 3], Math.round(255 * paintAmount));
      }
    }
  }
  
  return imageData;
};

const ImageEditor: React.FC<ImageEditorProps> = ({
  element,
  toolState: initialToolState,
  onSave,
  onCancel,
  onColorSampled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Local tool settings that can be adjusted in the editor
  const [activeTool, setActiveTool] = useState<ActiveTool>(initialToolState.activeTool);
  const [brushSize, setBrushSize] = useState(initialToolState.brushSize);
  const [brushHardness, setBrushHardness] = useState(initialToolState.brushHardness);
  const [brushColor, setBrushColor] = useState(initialToolState.brushColor);
  const [tolerance, setTolerance] = useState(initialToolState.tolerance);
  const [contiguous, setContiguous] = useState(initialToolState.contiguous);
  const [sampledColor, setSampledColor] = useState<string | null>(initialToolState.sampledColor);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Load image into canvas
  useEffect(() => {
    if (!canvasRef.current || !element.src) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Save initial state to history
      const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([initialData]);
      setHistoryIndex(0);
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.error('Failed to load image for editing');
    };
    img.src = element.src;
  }, [element.src]);
  
  // Save state to history
  const saveToHistory = useCallback(() => {
    if (!canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    const newData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Remove any future states (if we went back in history)
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newData);
    
    // Limit history to 50 states
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);
  
  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0 || !canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);
  
  // Get coordinates relative to canvas
  const getCanvasCoords = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  }, []);
  
  // Get color at position (for eyedropper)
  const getColorAtPosition = useCallback((x: number, y: number): string => {
    if (!canvasRef.current) return '#000000';
    
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '#000000';
    
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const r = pixel[0].toString(16).padStart(2, '0');
    const g = pixel[1].toString(16).padStart(2, '0');
    const b = pixel[2].toString(16).padStart(2, '0');
    
    return `#${r}${g}${b}`;
  }, []);
  
  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !imageLoaded) return;
    
    const { x, y } = getCanvasCoords(e);
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    if (activeTool === 'eyedropper') {
      // Sample color
      const color = getColorAtPosition(x, y);
      setSampledColor(color);
      setBrushColor(color); // Auto-set brush color to sampled color
      onColorSampled?.(color);
      return;
    }
    
    if (activeTool === 'backgroundEraser') {
      // Magic wand / background eraser - single click operation
      const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      const editedData = floodFill(imageData, x, y, tolerance, contiguous);
      ctx.putImageData(editedData, 0, 0);
      saveToHistory();
      return;
    }
    
    // Start drawing for eraser/brush
    if (activeTool === 'eraser' || activeTool === 'brush') {
      setIsDrawing(true);
      
      const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      if (activeTool === 'eraser') {
        const editedData = eraseBrush(imageData, x, y, brushSize, brushHardness);
        ctx.putImageData(editedData, 0, 0);
      } else {
        const editedData = paintBrush(imageData, x, y, brushSize, brushHardness, brushColor);
        ctx.putImageData(editedData, 0, 0);
      }
    }
  }, [activeTool, tolerance, contiguous, brushSize, brushHardness, brushColor, imageLoaded, getCanvasCoords, getColorAtPosition, onColorSampled, saveToHistory]);
  
  // Handle mouse move (for drawing)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Update cursor position for custom brush cursor
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setCursorPosition({ x: e.clientX, y: e.clientY });
    }
    
    if (!isDrawing || !canvasRef.current) return;
    
    const { x, y } = getCanvasCoords(e);
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    if (activeTool === 'eraser') {
      const editedData = eraseBrush(imageData, x, y, brushSize, brushHardness);
      ctx.putImageData(editedData, 0, 0);
    } else if (activeTool === 'brush') {
      const editedData = paintBrush(imageData, x, y, brushSize, brushHardness, brushColor);
      ctx.putImageData(editedData, 0, 0);
    }
  }, [isDrawing, activeTool, brushSize, brushHardness, brushColor, getCanvasCoords]);
  
  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      saveToHistory();
    }
    setIsDrawing(false);
  }, [isDrawing, saveToHistory]);
  
  // Save edited image
  const handleSave = useCallback(() => {
    if (!canvasRef.current) return;
    
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
  }, [onSave]);
  
  // Get cursor based on active tool
  const getCursor = () => {
    switch (activeTool) {
      case 'eyedropper':
        return 'crosshair';
      case 'eraser':
      case 'brush':
        return 'none'; // We'll show a custom cursor
      case 'backgroundEraser':
        return 'cell';
      default:
        return 'default';
    }
  };

  // Tool options for the sidebar
  const editingTools: { id: ActiveTool; icon: React.ElementType; label: string }[] = [
    { id: 'eyedropper', icon: Pipette, label: 'Eyedropper' },
    { id: 'brush', icon: Paintbrush, label: 'Brush' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
    { id: 'backgroundEraser', icon: Wand2, label: 'Background Eraser' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h2 className="text-white font-semibold">🎨 Image Editor</h2>
          <span className="text-slate-400 text-sm">
            {activeTool === 'eyedropper' && '👁️ Click anywhere to sample color'}
            {activeTool === 'eraser' && '🧹 Click and drag to erase'}
            {activeTool === 'backgroundEraser' && '✨ Click on background color to remove it (like removing white backgrounds from logos)'}
            {activeTool === 'brush' && '🖌️ Click and drag to paint'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          
          {/* Zoom controls */}
          <button
            onClick={() => setZoom(z => Math.max(25, z - 25))}
            className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-white text-sm w-12 text-center">{zoom}%</span>
          <button
            onClick={() => setZoom(z => Math.min(400, z + 25))}
            className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          
          <div className="w-px h-8 bg-zinc-700 mx-2" />
          
          {/* Cancel */}
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          
          {/* Save */}
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Apply Changes
          </button>
        </div>
      </div>
      
      {/* Main content with sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        <div className="w-14 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-3 gap-1">
          {editingTools.map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                activeTool === tool.id
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:bg-zinc-800 hover:text-white'
              }`}
              title={tool.label}
            >
              <tool.icon className="w-5 h-5" />
            </button>
          ))}
          
          {/* Sampled Color Display */}
          {sampledColor && (
            <div className="mt-4 flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded border-2 border-white shadow-lg cursor-pointer"
                style={{ backgroundColor: sampledColor }}
                title={`Sampled: ${sampledColor}\nClick to use as brush color`}
                onClick={() => setBrushColor(sampledColor)}
              />
              <span className="text-[8px] text-slate-500 font-mono">
                {sampledColor.toUpperCase()}
              </span>
            </div>
          )}
        </div>
        
        {/* Tool Settings Panel */}
        <div className="w-56 bg-zinc-800 border-r border-zinc-700 p-4 space-y-4 overflow-y-auto">
          <h3 className="text-white font-semibold text-sm">{editingTools.find(t => t.id === activeTool)?.label} Settings</h3>
          
          {(activeTool === 'eraser' || activeTool === 'brush') && (
            <>
              <div>
                <label className="text-slate-400 text-xs block mb-1">Brush Size: {brushSize}px</label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="text-slate-400 text-xs block mb-1">Hardness: {brushHardness}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={brushHardness}
                  onChange={(e) => setBrushHardness(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </>
          )}
          
          {activeTool === 'brush' && (
            <div>
              <label className="text-slate-400 text-xs block mb-1">Brush Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brushColor}
                  onChange={(e) => setBrushColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-zinc-600"
                />
                <span className="text-white text-sm font-mono">{brushColor}</span>
              </div>
            </div>
          )}
          
          {activeTool === 'backgroundEraser' && (
            <>
              <div>
                <label className="text-slate-400 text-xs block mb-1">Tolerance: {tolerance}</label>
                <input
                  type="range"
                  min="1"
                  max="128"
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-slate-500 text-[10px] mt-1">
                  Higher = removes more similar colors
                </p>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contiguous}
                  onChange={(e) => setContiguous(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-slate-300 text-sm">Contiguous only</span>
              </label>
              <p className="text-slate-500 text-[10px]">
                When checked, only connected pixels are removed
              </p>
            </>
          )}
          
          {activeTool === 'eyedropper' && (
            <div className="text-slate-400 text-sm">
              Click anywhere on the image to sample a color. The sampled color will be shown below and automatically set as the brush color.
            </div>
          )}
          
          {/* Tips */}
          <div className="pt-4 border-t border-zinc-700">
            <h4 className="text-slate-500 text-xs font-semibold mb-2">💡 TIP</h4>
            {activeTool === 'backgroundEraser' && (
              <p className="text-slate-500 text-xs">
                Perfect for removing white backgrounds from logos! Click on the white area to make it transparent.
              </p>
            )}
            {activeTool === 'eraser' && (
              <p className="text-slate-500 text-xs">
                Use a lower hardness for softer edges. Great for blending and fading out areas.
              </p>
            )}
            {activeTool === 'brush' && (
              <p className="text-slate-500 text-xs">
                Use the eyedropper to sample colors from the image, then paint with them!
              </p>
            )}
            {activeTool === 'eyedropper' && (
              <p className="text-slate-500 text-xs">
                Sample any color from your image. Perfect for matching existing colors.
              </p>
            )}
          </div>
        </div>
        
        {/* Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto flex items-center justify-center p-8"
          style={{
            background: `
              linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
              linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
              linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
            `,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
            backgroundColor: '#1a1a1a',
          }}
        >
          <div
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'center center',
            }}
          >
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                handleMouseUp();
                setCursorPosition(null);
              }}
              className="shadow-2xl"
              style={{
                cursor: getCursor(),
                maxWidth: 'none',
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Custom cursor for brush/eraser */}
      {(activeTool === 'eraser' || activeTool === 'brush') && cursorPosition && (
        <div
          className="pointer-events-none fixed border-2 border-white rounded-full opacity-75 mix-blend-difference"
          style={{
            width: brushSize * (zoom / 100),
            height: brushSize * (zoom / 100),
            left: cursorPosition.x,
            top: cursorPosition.y,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
    </div>
  );
};

export default ImageEditor;
