import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Upload, Clipboard, Image, Move, Lock, Unlock, Eye, EyeOff, ZoomIn, ZoomOut, Maximize, HelpCircle, Plus, Minus, RotateCcw } from 'lucide-react';

// Player element type for displaying formation
interface PlayElement {
  id: string;
  type: 'X' | 'O';
  label: string;
  x: number;
  y: number;
  color: string;
}

interface TracePlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTracing: (imageDataUrl: string, imageSettings: ImageSettings) => void;
  formationElements?: PlayElement[]; // Optional: show formation players in preview
  formationName?: string; // Optional: name of the formation being used
}

export interface ImageSettings {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
}

const TracePlayModal: React.FC<TracePlayModalProps> = ({
  isOpen,
  onClose,
  onStartTracing,
  formationElements = [],
  formationName = ''
}) => {
  // Image state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  
  // Image dragging state
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; imgX: number; imgY: number } | null>(null);
  
  // Image settings for positioning
  const [imageSettings, setImageSettings] = useState<ImageSettings>({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    opacity: 50,
    locked: false,
    visible: true
  });
  
  // Natural image dimensions
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);
  
  const [showHelp, setShowHelp] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setImagePreview(null);
      setImageName('');
      setImageError(null);
      setImageSettings({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        opacity: 50,
        locked: false,
        visible: true
      });
      setNaturalWidth(0);
      setNaturalHeight(0);
    }
  }, [isOpen]);

  // Handle paste from clipboard
  useEffect(() => {
    if (!isOpen) return;
    
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await processImageFile(file);
          }
          break;
        }
      }
    };
    
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  // Process image file to base64
  const processImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setImageError('Please select an image file');
      return;
    }
    
    // Max file size: 10MB
    if (file.size > 10 * 1024 * 1024) {
      setImageError('Image too large. Please use an image under 10MB.');
      return;
    }
    
    setImageError(null);
    setImageName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      
      // Get natural dimensions
      const img = new window.Image();
      img.onload = () => {
        setNaturalWidth(img.naturalWidth);
        setNaturalHeight(img.naturalHeight);
        
        // Auto-fit to preview area (maintain aspect ratio)
        const previewAspect = 16 / 9; // Our canvas aspect ratio
        const imageAspect = img.naturalWidth / img.naturalHeight;
        
        if (imageAspect > previewAspect) {
          // Image is wider - fit to width
          setImageSettings(prev => ({
            ...prev,
            width: 100,
            height: (100 / imageAspect) * previewAspect,
            x: 0,
            y: (100 - (100 / imageAspect) * previewAspect) / 2
          }));
        } else {
          // Image is taller - fit to height
          setImageSettings(prev => ({
            ...prev,
            height: 100,
            width: (100 * imageAspect) / previewAspect,
            x: (100 - (100 * imageAspect) / previewAspect) / 2,
            y: 0
          }));
        }
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setImageError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processImageFile(file);
    }
  }, []);

  // Fit image to canvas
  const fitToWidth = () => {
    if (!naturalWidth || !naturalHeight) return;
    const previewAspect = 16 / 9;
    const imageAspect = naturalWidth / naturalHeight;
    
    setImageSettings(prev => ({
      ...prev,
      width: 100,
      height: (100 / imageAspect) * previewAspect,
      x: 0,
      y: (100 - (100 / imageAspect) * previewAspect) / 2
    }));
  };

  const fitToHeight = () => {
    if (!naturalWidth || !naturalHeight) return;
    const previewAspect = 16 / 9;
    const imageAspect = naturalWidth / naturalHeight;
    
    setImageSettings(prev => ({
      ...prev,
      height: 100,
      width: (100 * imageAspect) / previewAspect,
      x: (100 - (100 * imageAspect) / previewAspect) / 2,
      y: 0
    }));
  };

  const fitToCanvas = () => {
    setImageSettings(prev => ({
      ...prev,
      width: 100,
      height: 100,
      x: 0,
      y: 0
    }));
  };

  const resetPosition = () => {
    if (!naturalWidth || !naturalHeight) return;
    const previewAspect = 16 / 9;
    const imageAspect = naturalWidth / naturalHeight;
    
    if (imageAspect > previewAspect) {
      fitToWidth();
    } else {
      fitToHeight();
    }
  };

  // Adjust size
  const adjustSize = (delta: number) => {
    setImageSettings(prev => ({
      ...prev,
      width: Math.max(20, Math.min(200, prev.width + delta)),
      height: Math.max(20, Math.min(200, prev.height + delta))
    }));
  };

  // Start tracing
  const handleStartTracing = () => {
    if (!imagePreview) return;
    onStartTracing(imagePreview, imageSettings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Image className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Trace from Image</h2>
              <p className="text-sm text-gray-400">Free - manually trace your play</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Help"
            >
              <HelpCircle className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Help panel */}
        {showHelp && (
          <div className="p-4 bg-cyan-500/10 border-b border-cyan-500/30 text-sm text-cyan-200">
            <p className="font-semibold mb-2">How Trace Mode works:</p>
            <ol className="list-decimal list-inside space-y-1 text-cyan-300">
              <li>Upload an image of the play you want to recreate</li>
              <li>Adjust the image position, size, and opacity</li>
              <li>Click "Start Tracing" to open the play editor with your image as a background</li>
              <li>Place players and draw routes by tracing over the image</li>
              <li>Toggle the background off to preview your play</li>
              <li>Save your play - the background image is NOT saved (only your traced elements)</li>
            </ol>
            <p className="mt-2 text-emerald-300">✨ This is completely free - no credits needed!</p>
          </div>
        )}

        <div className="p-4">
          {/* Error display */}
          {imageError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
              <X className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-200">{imageError}</p>
            </div>
          )}

          {/* Step 1: Upload Image */}
          {!imagePreview && (
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                ${isDragging 
                  ? 'border-cyan-400 bg-cyan-500/10' 
                  : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
                }
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              
              <div className="space-y-4">
                <div className="flex justify-center gap-4">
                  <div className="p-4 bg-gray-700/50 rounded-xl">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="p-4 bg-gray-700/50 rounded-xl">
                    <Clipboard className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="p-4 bg-gray-700/50 rounded-xl">
                    <Image className="w-8 h-8 text-gray-400" />
                  </div>
                </div>
                <div>
                  <p className="text-white font-medium">Upload your play diagram</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Drag & drop, click to upload, or paste from clipboard
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-700">
                  <p className="text-xs text-gray-500">
                    💡 Works with screenshots, photos of whiteboards, or any play diagram image
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Adjust Image */}
          {imagePreview && (
            <div className="space-y-4">
              {/* Preview canvas */}
              <div 
                ref={previewRef}
                className={`relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden border border-gray-700 ${
                  !imageSettings.locked && imageSettings.visible ? 'cursor-move' : ''
                }`}
                style={{
                  backgroundImage: `
                    repeating-linear-gradient(
                      0deg,
                      transparent,
                      transparent 9%,
                      rgba(255,255,255,0.05) 9%,
                      rgba(255,255,255,0.05) 10%
                    )
                  `
                }}
                onMouseDown={(e) => {
                  if (imageSettings.locked || !imageSettings.visible) return;
                  const rect = previewRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setIsDraggingImage(true);
                  setDragStart({
                    x: e.clientX,
                    y: e.clientY,
                    imgX: imageSettings.x,
                    imgY: imageSettings.y
                  });
                }}
                onMouseMove={(e) => {
                  if (!isDraggingImage || !dragStart || !previewRef.current) return;
                  const rect = previewRef.current.getBoundingClientRect();
                  const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
                  const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;
                  setImageSettings(prev => ({
                    ...prev,
                    x: Math.max(-50, Math.min(100, dragStart.imgX + deltaX)),
                    y: Math.max(-50, Math.min(100, dragStart.imgY + deltaY))
                  }));
                }}
                onMouseUp={() => {
                  setIsDraggingImage(false);
                  setDragStart(null);
                }}
                onMouseLeave={() => {
                  setIsDraggingImage(false);
                  setDragStart(null);
                }}
                onTouchStart={(e) => {
                  if (imageSettings.locked || !imageSettings.visible) return;
                  const touch = e.touches[0];
                  const rect = previewRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setIsDraggingImage(true);
                  setDragStart({
                    x: touch.clientX,
                    y: touch.clientY,
                    imgX: imageSettings.x,
                    imgY: imageSettings.y
                  });
                }}
                onTouchMove={(e) => {
                  if (!isDraggingImage || !dragStart || !previewRef.current) return;
                  const touch = e.touches[0];
                  const rect = previewRef.current.getBoundingClientRect();
                  const deltaX = ((touch.clientX - dragStart.x) / rect.width) * 100;
                  const deltaY = ((touch.clientY - dragStart.y) / rect.height) * 100;
                  setImageSettings(prev => ({
                    ...prev,
                    x: Math.max(-50, Math.min(100, dragStart.imgX + deltaX)),
                    y: Math.max(-50, Math.min(100, dragStart.imgY + deltaY))
                  }));
                }}
                onTouchEnd={() => {
                  setIsDraggingImage(false);
                  setDragStart(null);
                }}
              >
                {/* Background image */}
                {imageSettings.visible && (
                  <img
                    src={imagePreview}
                    alt="Trace background"
                    className="absolute pointer-events-none select-none"
                    draggable={false}
                    style={{
                      left: `${imageSettings.x}%`,
                      top: `${imageSettings.y}%`,
                      width: `${imageSettings.width}%`,
                      height: `${imageSettings.height}%`,
                      opacity: imageSettings.opacity / 100,
                      objectFit: 'fill'
                    }}
                  />
                )}
                
                {/* Formation elements overlay - show players on top of trace image */}
                {formationElements.length > 0 && (
                  <>
                    {formationElements.map(el => (
                      <div
                        key={el.id}
                        className={`absolute flex items-center font-bold text-white shadow-lg border-2 border-white/60 pointer-events-none ${el.color} ${el.type === 'O' ? 'rounded-full justify-center' : 'justify-center'}`}
                        style={{ 
                          left: `${el.x}%`, 
                          top: `${el.y}%`, 
                          transform: 'translate(-50%, -50%)',
                          width: '36px',
                          height: '36px',
                          fontSize: '10px',
                          opacity: 0.6,
                          ...(el.type === 'X' ? { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: '0', paddingTop: '12px' } : {})
                        }}
                      >
                        {el.label || el.type}
                      </div>
                    ))}
                    {/* Formation name badge */}
                    {formationName && (
                      <div className="absolute top-2 left-2 bg-emerald-600/90 text-white text-xs px-2 py-1 rounded font-semibold">
                        {formationName}
                      </div>
                    )}
                  </>
                )}
                
                {/* Drag hint */}
                {!imageSettings.locked && imageSettings.visible && !isDraggingImage && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                    <Move className="w-3 h-3" />
                    Drag to position image
                  </div>
                )}
                
                {/* Dragging indicator */}
                {isDraggingImage && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-cyan-600 text-white text-xs px-3 py-1.5 rounded-full">
                    Moving...
                  </div>
                )}
                
                {/* Lock indicator */}
                {imageSettings.locked && (
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Locked
                  </div>
                )}
                
                {/* Position display */}
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded font-mono">
                  X: {Math.round(imageSettings.x)} Y: {Math.round(imageSettings.y)}
                </div>
                
                {/* Drag hint - only show when not locked and not dragging */}
                {!imageSettings.locked && !isDraggingImage && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-gray-300 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <Move className="w-3 h-3" />
                    Drag to position
                  </div>
                )}
                
                {/* Hidden indicator */}
                {!imageSettings.visible && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/60 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2">
                      <EyeOff className="w-4 h-4" />
                      Background Hidden
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Opacity slider */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <label className="text-sm text-gray-400 mb-2 block">
                    Opacity: {imageSettings.opacity}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={imageSettings.opacity}
                    onChange={(e) => setImageSettings(prev => ({ ...prev, opacity: Number(e.target.value) }))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                {/* Size controls */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <label className="text-sm text-gray-400 mb-2 block">
                    Size: {Math.round(imageSettings.width)}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    value={imageSettings.width}
                    onChange={(e) => {
                      const newWidth = Number(e.target.value);
                      if (naturalWidth && naturalHeight) {
                        const aspectRatio = naturalWidth / naturalHeight;
                        const previewAspect = 16 / 9;
                        setImageSettings(prev => ({
                          ...prev,
                          width: newWidth,
                          height: (newWidth / aspectRatio) * previewAspect
                        }));
                      } else {
                        setImageSettings(prev => ({ ...prev, width: newWidth, height: newWidth }));
                      }
                    }}
                    className="w-full accent-cyan-500 mb-2"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => adjustSize(-1)}
                      className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white flex items-center justify-center gap-1"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => adjustSize(1)}
                      className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Fit buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={fitToWidth}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white flex items-center gap-2"
                >
                  <Maximize className="w-4 h-4" />
                  Fit Width
                </button>
                <button
                  onClick={fitToHeight}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white flex items-center gap-2"
                >
                  <Maximize className="w-4 h-4 rotate-90" />
                  Fit Height
                </button>
                <button
                  onClick={fitToCanvas}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white flex items-center gap-2"
                >
                  <ZoomIn className="w-4 h-4" />
                  Fill Canvas
                </button>
                <button
                  onClick={resetPosition}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </div>

              {/* Toggle buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setImageSettings(prev => ({ ...prev, locked: !prev.locked }))}
                  className={`flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors
                    ${imageSettings.locked 
                      ? 'bg-yellow-600 hover:bg-yellow-500 text-white' 
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }
                  `}
                >
                  {imageSettings.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {imageSettings.locked ? 'Unlock Position' : 'Lock Position'}
                </button>
                <button
                  onClick={() => setImageSettings(prev => ({ ...prev, visible: !prev.visible }))}
                  className={`flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors
                    ${imageSettings.visible 
                      ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                    }
                  `}
                >
                  {imageSettings.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {imageSettings.visible ? 'Hide Background' : 'Show Background'}
                </button>
              </div>

              {/* Change image / Start tracing */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setImagePreview(null);
                    setImageName('');
                  }}
                  className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium"
                >
                  Change Image
                </button>
                <button
                  onClick={handleStartTracing}
                  className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <Move className="w-4 h-4" />
                  Start Tracing
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                The background image will only be visible while editing. It won't be saved with your play.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TracePlayModal;
