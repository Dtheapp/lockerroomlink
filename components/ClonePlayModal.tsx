import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { ClonePlayAnalysis, ClonedPlayer, PlayElement, DrawingLine, PlayShape, LineType, ShapeType } from '../types';
import { X, Upload, Clipboard, Image, Loader2, AlertCircle, CheckCircle, Sparkles, Zap, RefreshCw, Trash2, HelpCircle } from 'lucide-react';

interface ClonePlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayCloned: (elements: PlayElement[], lines: DrawingLine[], shapes: PlayShape[], suggestedCategory: 'Offense' | 'Defense' | 'Special Teams') => void;
  currentCredits: number;
}

// Color palette for route/line colors (matches CoachPlaybook)
const LINE_COLORS = [
  '#FACC15', '#06b6d4', '#ec4899', '#a3e635', '#f87171', '#ffffff', '#a855f7', '#ea580c', '#3b82f6', '#14b8a6', '#8b5cf6', '#000000'
];

const ClonePlayModal: React.FC<ClonePlayModalProps> = ({
  isOpen,
  onClose,
  onPlayCloned,
  currentCredits
}) => {
  const { user, userData } = useAuth();
  
  // Image state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ClonePlayAnalysis | null>(null);
  
  // Preview adjustments
  const [previewElements, setPreviewElements] = useState<ClonedPlayer[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setImagePreview(null);
      setImageName('');
      setAnalysis(null);
      setAnalysisError(null);
      setPreviewElements([]);
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
      setAnalysisError('Please select an image file');
      return;
    }
    
    // Max file size: 10MB
    if (file.size > 10 * 1024 * 1024) {
      setAnalysisError('Image too large. Please use an image under 10MB.');
      return;
    }
    
    setAnalysisError(null);
    setImageName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setAnalysis(null);
      setPreviewElements([]);
    };
    reader.onerror = () => {
      setAnalysisError('Failed to read image file');
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

  // Analyze the image using the Netlify function
  const analyzeImage = async () => {
    if (!imagePreview || !user?.uid) return;
    
    // Check credits
    if (currentCredits <= 0) {
      setAnalysisError('No clone credits remaining. Contact your administrator for more credits.');
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      // Extract base64 from data URL
      const base64Data = imagePreview.includes(',') 
        ? imagePreview 
        : `data:image/png;base64,${imagePreview}`;
      
      // Call the Netlify function
      const response = await fetch('/.netlify/functions/clone-play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageBase64: base64Data,
          userId: user.uid
        })
      });
      
      // Check if response is HTML (error page) instead of JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error('Server returned an error page. The clone feature may still be deploying - please try again in 1-2 minutes.');
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze image');
      }
      
      if (!data.success || !data.analysis) {
        throw new Error(data.error || 'No analysis returned');
      }
      
      // Decrement user's credits
      // First, check if cloneCredits field exists and initialize if needed
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      
      if (userData?.cloneCredits === undefined) {
        // Field doesn't exist - initialize with 9 (10 default - 1 for this use)
        await updateDoc(userRef, {
          cloneCredits: 9,
          totalClonesUsed: 1
        });
      } else {
        // Field exists - use increment
        await updateDoc(userRef, {
          cloneCredits: increment(-1),
          totalClonesUsed: increment(1)
        });
      }
      
      setAnalysis(data.analysis);
      setPreviewElements(data.analysis.players || []);
      
    } catch (error) {
      console.error('Clone play error:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Remove a detected player from preview
  const removePreviewPlayer = (playerId: string) => {
    setPreviewElements(prev => prev.filter(p => p.id !== playerId));
  };

  // Toggle player type (O/X) in preview
  const togglePlayerType = (playerId: string) => {
    setPreviewElements(prev => prev.map(p => 
      p.id === playerId 
        ? { ...p, suggestedType: p.suggestedType === 'O' ? 'X' : 'O' }
        : p
    ));
  };

  // Convert analysis to play elements and apply to editor
  const applyClonedPlay = () => {
    if (!analysis) return;
    
    // Convert cloned players to PlayElements
    const elements: PlayElement[] = previewElements.map((player, index) => ({
      id: Date.now().toString() + index,
      type: player.suggestedType || 'O',
      label: player.suggestedType === 'X' ? `D${index + 1}` : getPositionLabel(player, index),
      x: player.x,
      y: player.y,
      color: player.suggestedType === 'X' ? 'bg-red-600' : 'bg-blue-600'
    }));
    
    // Convert routes to standalone drawing lines (cloned routes are not attached to elements)
    const lines: DrawingLine[] = analysis.routes.map((route, index) => ({
      id: Date.now().toString() + 'l' + index,
      points: route.points,
      color: route.color || '#FACC15',
      lineType: convertLineType(route.lineType)
    }));
    
    // Convert shapes
    const shapes: PlayShape[] = analysis.shapes.map((shape, index) => ({
      id: Date.now().toString() + 's' + index,
      shapeType: shape.shapeType as ShapeType,
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      color: shape.color || '#ff0000',
      filled: false
    }));
    
    onPlayCloned(elements, lines, shapes, analysis.suggestedCategory);
    onClose();
  };

  // Helper to convert line types
  const convertLineType = (type: string): LineType => {
    switch (type) {
      case 'dashed': return 'dashed';
      case 'curved': return 'curved';
      case 'zigzag': return 'zigzag';
      default: return 'route';
    }
  };

  // Helper to generate position labels
  const getPositionLabel = (player: ClonedPlayer, index: number): string => {
    // Try to assign meaningful labels based on position
    const row = Math.floor(player.y / 25); // Divide field into 4 rows
    const col = Math.floor(player.x / 20); // Divide into 5 columns
    
    // Common offensive positions based on typical locations
    if (row === 0) return `WR${index + 1}`;
    if (row === 1 && col === 2) return 'QB';
    if (row === 2 && col === 2) return 'RB';
    if (row >= 2) return `OL${index + 1}`;
    return `P${index + 1}`;
  };

  // Render the preview canvas showing detected elements
  const renderPreviewCanvas = () => {
    if (!analysis) return null;
    
    return (
      <div 
        ref={previewCanvasRef}
        className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 9%,
              rgba(255,255,255,0.08) 9%,
              rgba(255,255,255,0.08) 10%
            )
          `
        }}
      >
        {/* Yard lines */}
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(yard => (
          <div
            key={yard}
            className="absolute left-0 right-0 h-px bg-white/20"
            style={{ top: `${yard}%` }}
          />
        ))}
        
        {/* Detected shapes */}
        {analysis.shapes.map(shape => (
          <div
            key={shape.id}
            className="absolute border-2 opacity-50"
            style={{
              left: `${shape.x - shape.width / 2}%`,
              top: `${shape.y - shape.height / 2}%`,
              width: `${shape.width}%`,
              height: `${shape.height}%`,
              borderColor: shape.color,
              borderRadius: shape.shapeType === 'circle' || shape.shapeType === 'oval' ? '50%' : '4px'
            }}
          />
        ))}
        
        {/* Detected routes */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {analysis.routes.map(route => {
            if (route.points.length < 2) return null;
            
            const pathData = route.points
              .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x}% ${pt.y}%`)
              .join(' ');
            
            return (
              <g key={route.id}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={route.color || '#FACC15'}
                  strokeWidth="2"
                  strokeDasharray={route.lineType === 'dashed' ? '5,5' : undefined}
                  vectorEffect="non-scaling-stroke"
                />
                {route.hasArrow && route.points.length >= 2 && (
                  <circle
                    cx={`${route.points[route.points.length - 1].x}%`}
                    cy={`${route.points[route.points.length - 1].y}%`}
                    r="4"
                    fill={route.color || '#FACC15'}
                  />
                )}
              </g>
            );
          })}
        </svg>
        
        {/* Detected players */}
        {previewElements.map(player => (
          <div
            key={player.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
            style={{
              left: `${player.x}%`,
              top: `${player.y}%`
            }}
          >
            {player.shape === 'triangle' ? (
              // Render triangle shape for defensive players
              <div 
                className="relative cursor-pointer"
                onClick={() => togglePlayerType(player.id)}
                title="Click to toggle O/X"
              >
                <svg width="32" height="32" viewBox="0 0 32 32" className="transition-all hover:scale-110">
                  <polygon 
                    points="16,4 28,28 4,28" 
                    fill={player.suggestedType === 'X' ? '#dc2626' : '#2563eb'}
                    stroke={player.suggestedType === 'X' ? '#ef4444' : '#3b82f6'}
                    strokeWidth="2"
                  />
                  <text x="16" y="22" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                    {player.suggestedType || 'X'}
                  </text>
                </svg>
              </div>
            ) : (
              // Render circle shape for offensive players
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs cursor-pointer transition-all hover:scale-110
                  ${player.suggestedType === 'X' ? 'bg-red-600 hover:bg-red-500 border-2 border-red-400' : 'bg-blue-600 hover:bg-blue-500 border-2 border-blue-400'}
                `}
                onClick={() => togglePlayerType(player.id)}
                title="Click to toggle O/X"
              >
                {player.suggestedType || 'O'}
              </div>
            )}
            <button
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                removePreviewPlayer(player.id);
              }}
              title="Remove player"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        
        {/* Confidence indicator */}
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
          {analysis.confidence}% confidence
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Clone Play from Image</h2>
              <p className="text-sm text-gray-400">AI-powered play detection</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-1.5 rounded-lg">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">
                {currentCredits} credit{currentCredits !== 1 ? 's' : ''} remaining
              </span>
            </div>
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
          <div className="p-4 bg-blue-500/10 border-b border-blue-500/30 text-sm text-blue-200">
            <p className="font-semibold mb-2">How it works:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-300">
              <li>Upload or paste a screenshot of any football play diagram</li>
              <li>AI will detect players (circles = offense, triangles = defense) and routes</li>
              <li>Review and adjust the detected elements - click players to toggle O/X</li>
              <li>Click "Use This Play" to import it into your play editor</li>
            </ol>
            <p className="mt-2 text-yellow-300">Tip: Clear, high-contrast diagrams work best!</p>
          </div>
        )}

        <div className="p-4">
          {/* Error display */}
          {analysisError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-200">{analysisError}</p>
            </div>
          )}

          {/* Step 1: Image Upload */}
          {!analysis && (
            <div className="space-y-4">
              {/* Upload area */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
                  ${isDragging 
                    ? 'border-purple-400 bg-purple-500/10' 
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
                
                {imagePreview ? (
                  <div className="space-y-4">
                    <img 
                      src={imagePreview} 
                      alt="Play to clone" 
                      className="max-h-64 mx-auto rounded-lg shadow-lg"
                    />
                    <p className="text-sm text-gray-400">{imageName || 'Pasted image'}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setImagePreview(null);
                        setImageName('');
                      }}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Remove and select different image
                    </button>
                  </div>
                ) : (
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
                      <p className="text-white font-medium">Drag & drop, click to upload, or paste</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Supports PNG, JPG, WEBP (max 10MB)
                      </p>
                    </div>
                    <div className="pt-2 border-t border-gray-700">
                      <p className="text-xs text-gray-500">
                        💡 Pro tip: Take a screenshot of a play diagram and press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">Ctrl+V</kbd> to paste
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Analyze button */}
              {imagePreview && (
                <button
                  onClick={analyzeImage}
                  disabled={isAnalyzing || currentCredits <= 0}
                  className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors
                    ${isAnalyzing || currentCredits <= 0
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                    }
                  `}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing play diagram...
                    </>
                  ) : currentCredits <= 0 ? (
                    <>
                      <AlertCircle className="w-5 h-5" />
                      No credits remaining
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Analyze Play (uses 1 credit)
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Step 2: Analysis Results */}
          {analysis && (
            <div className="space-y-4">
              {/* Success banner */}
              <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-200">Play detected successfully!</p>
                  <p className="text-xs text-green-300">
                    Found {previewElements.length} player{previewElements.length !== 1 ? 's' : ''} 
                    ({previewElements.filter(p => p.suggestedType === 'O').length} offense, {previewElements.filter(p => p.suggestedType === 'X').length} defense), {' '}
                    {analysis.routes.length} route{analysis.routes.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              
              {/* Player count warning if low */}
              {previewElements.length < 10 && (
                <div className="p-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-xs text-yellow-300">
                  ⚠️ Fewer than 11 players detected. The AI may have missed some - you can add missing players manually after importing.
                </div>
              )}

              {/* Category badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Suggested category:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium
                  ${analysis.suggestedCategory === 'Offense' ? 'bg-blue-500/20 text-blue-300' : ''}
                  ${analysis.suggestedCategory === 'Defense' ? 'bg-red-500/20 text-red-300' : ''}
                  ${analysis.suggestedCategory === 'Special Teams' ? 'bg-yellow-500/20 text-yellow-300' : ''}
                `}>
                  {analysis.suggestedCategory}
                </span>
              </div>

              {/* Original image (collapsed) */}
              <details className="bg-gray-800 rounded-lg">
                <summary className="p-3 cursor-pointer text-sm text-gray-400 hover:text-gray-300">
                  View original image
                </summary>
                <div className="p-3 pt-0">
                  <img 
                    src={imagePreview!} 
                    alt="Original" 
                    className="max-h-48 mx-auto rounded-lg"
                  />
                </div>
              </details>

              {/* Preview canvas */}
              <div>
                <p className="text-sm text-gray-400 mb-2">
                  Preview (click players to toggle O/X, hover to remove):
                </p>
                {renderPreviewCanvas()}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setAnalysis(null);
                    setImagePreview(null);
                    setImageName('');
                    setPreviewElements([]);
                  }}
                  className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Different Image
                </button>
                <button
                  onClick={applyClonedPlay}
                  disabled={previewElements.length === 0}
                  className={`flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors
                    ${previewElements.length === 0
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }
                  `}
                >
                  <CheckCircle className="w-4 h-4" />
                  Use This Play
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                The play will be added to your editor where you can adjust positions, add routes, and save it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClonePlayModal;
