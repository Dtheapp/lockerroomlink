import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useCredits } from '../hooks/useCredits';
import type { ClonePlayAnalysis, ClonedPlayer, PlayElement, DrawingLine, PlayShape, LineType, ShapeType } from '../types';
import { X, Upload, Clipboard, Image, Loader2, AlertCircle, CheckCircle, Sparkles, Zap, RefreshCw, Trash2, HelpCircle, Settings, Wand2, MessageSquare, Coins } from 'lucide-react';
import BuyCreditsModal from './credits/BuyCreditsModal';

interface ClonePlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayCloned: (elements: PlayElement[], lines: DrawingLine[], shapes: PlayShape[], suggestedCategory: 'Offense' | 'Defense' | 'Special Teams') => void;
  currentCredits?: number; // Deprecated - now uses useCredits hook
}

// Hint presets for Simple mode
interface HintPreset {
  id: string;
  label: string;
  hint: string;
}

const HINT_PRESETS: HintPreset[] = [
  { id: 'x_triangles', label: 'X marks = defensive players (triangles)', hint: 'X marks in this diagram represent defensive players, treat them as triangles' },
  { id: 'offense_only', label: 'Only offense shown (~11 players)', hint: 'This diagram only shows offensive players, expect around 11 players total' },
  { id: 'defense_only', label: 'Only defense shown (~11 players)', hint: 'This diagram only shows defensive players, expect around 11 players total' },
  { id: 'squares_circles', label: 'Squares = offensive players', hint: 'Square shapes represent offensive players, treat them as circles' },
  { id: 'ignore_text', label: 'Ignore text/labels in image', hint: 'Ignore any text or labels in the image, focus only on player symbols and routes' },
];

// Color palette for route/line colors (matches CoachPlaybook)
const LINE_COLORS = [
  '#FACC15', '#06b6d4', '#ec4899', '#a3e635', '#f87171', '#ffffff', '#a855f7', '#ea580c', '#3b82f6', '#14b8a6', '#8b5cf6', '#000000'
];

const ClonePlayModal: React.FC<ClonePlayModalProps> = ({
  isOpen,
  onClose,
  onPlayCloned,
  currentCredits: _deprecatedCredits // Deprecated prop, now using useCredits hook
}) => {
  const { user, userData } = useAuth();
  const { balance: currentCredits, checkFeature, consumeFeature, refreshBalance, getFeaturePricing, isFreePeriod } = useCredits();
  
  // Mode selection
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  
  // Image state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  
  // Hints state (Simple mode)
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [customHint, setCustomHint] = useState('');
  
  // Advanced mode state
  const [feedbackText, setFeedbackText] = useState('');
  const [generationCount, setGenerationCount] = useState(0);
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ClonePlayAnalysis | null>(null);
  
  // Preview adjustments
  const [previewElements, setPreviewElements] = useState<ClonedPlayer[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  
  // Buy credits modal
  const [showBuyModal, setShowBuyModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLDivElement>(null);
  
  // Get feature pricing
  const clonePricing = getFeaturePricing('design_clone_play');
  const creditCost = clonePricing?.creditsPerUse || 1;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setImagePreview(null);
      setImageName('');
      setAnalysis(null);
      setAnalysisError(null);
      setPreviewElements([]);
      setSelectedPresets([]);
      setCustomHint('');
      setFeedbackText('');
      setGenerationCount(0);
      setMode('simple');
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
  const analyzeImage = async (isRegenerate: boolean = false) => {
    if (!imagePreview || !user?.uid) return;
    
    // Check credits using new system
    const canUse = await checkFeature('design_clone_play');
    if (!canUse.canUse) {
      if (canUse.reason === 'Insufficient credits') {
        setShowBuyModal(true);
      }
      setAnalysisError(canUse.reason || 'Cannot use this feature');
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      // Extract base64 from data URL
      const base64Data = imagePreview.includes(',') 
        ? imagePreview 
        : `data:image/png;base64,${imagePreview}`;
      
      // Build hints string from presets and custom hint
      let hints = '';
      if (mode === 'simple') {
        const presetHints = selectedPresets
          .map(id => HINT_PRESETS.find(p => p.id === id)?.hint)
          .filter(Boolean)
          .join('. ');
        hints = [presetHints, customHint].filter(Boolean).join('. ');
      } else if (mode === 'advanced' && isRegenerate && feedbackText) {
        // For advanced mode regeneration, include feedback about what was wrong
        hints = `CORRECTION FROM USER: ${feedbackText}. Please fix these issues in your analysis.`;
      }
      
      // Call the Netlify function
      let response: Response;
      try {
        response = await fetch('/.netlify/functions/clone-play', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageBase64: base64Data,
            userId: user.uid,
            hints: hints || undefined
          })
        });
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        throw new Error('Network error - please check your connection and try again.');
      }
      
      // Check if response is HTML (error page) instead of JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 500));
        
        // Check for specific error patterns
        if (text.includes('504') || text.includes('timeout')) {
          throw new Error('Request timed out. The image may be too large - try a smaller image.');
        } else if (text.includes('502') || text.includes('Bad Gateway')) {
          throw new Error('Server error. Please wait a moment and try again.');
        } else if (response.status === 404) {
          throw new Error('Clone function not found. Please wait 1-2 minutes for deployment.');
        }
        throw new Error(`Server error (${response.status}). Please try again in a moment.`);
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze image');
      }
      
      if (!data.success || !data.analysis) {
        throw new Error(data.error || 'No analysis returned');
      }
      
      // Consume credits using new system
      await consumeFeature('design_clone_play', {
        imageName,
        mode,
        isRegenerate,
      });
      
      // Refresh balance after consumption
      await refreshBalance();
      
      setAnalysis(data.analysis);
      setPreviewElements(data.analysis.players || []);
      setGenerationCount(prev => prev + 1);
      setFeedbackText(''); // Clear feedback after successful generation
      
    } catch (error) {
      console.error('Clone play error:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Toggle preset selection
  const togglePreset = (presetId: string) => {
    setSelectedPresets(prev => 
      prev.includes(presetId) 
        ? prev.filter(id => id !== presetId)
        : [...prev, presetId]
    );
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
            {isFreePeriod ? (
              <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1.5 rounded-lg">
                <Sparkles className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-green-400">Free during promo!</span>
              </div>
            ) : (
              <button 
                onClick={() => setShowBuyModal(true)}
                className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-amber-400">
                  {currentCredits} credit{currentCredits !== 1 ? 's' : ''}
                </span>
              </button>
            )}
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
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3 overflow-hidden">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-200 break-words overflow-hidden">{analysisError}</p>
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

              {/* Mode selection (only show when image is uploaded) */}
              {imagePreview && (
                <div className="space-y-4">
                  {/* Mode toggle */}
                  <div className="flex gap-2 p-1 bg-gray-800 rounded-lg">
                    <button
                      onClick={() => setMode('simple')}
                      className={`flex-1 py-2 px-3 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors
                        ${mode === 'simple' 
                          ? 'bg-purple-600 text-white' 
                          : 'text-gray-400 hover:text-gray-300'
                        }
                      `}
                    >
                      <Wand2 className="w-4 h-4" />
                      Simple Mode
                    </button>
                    <button
                      onClick={() => setMode('advanced')}
                      className={`flex-1 py-2 px-3 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors
                        ${mode === 'advanced' 
                          ? 'bg-purple-600 text-white' 
                          : 'text-gray-400 hover:text-gray-300'
                        }
                      `}
                    >
                      <Settings className="w-4 h-4" />
                      Advanced Mode
                    </button>
                  </div>

                  {/* Mode description */}
                  <div className={`p-3 rounded-lg text-sm ${mode === 'simple' ? 'bg-purple-500/10 text-purple-200' : 'bg-orange-500/10 text-orange-200'}`}>
                    {mode === 'simple' ? (
                      <>
                        <span className="font-medium">Simple Mode:</span> One-time analysis with optional hints. Uses 1 credit.
                      </>
                    ) : (
                      <>
                        <span className="font-medium">Advanced Mode:</span> Iterative refinement - regenerate with feedback until perfect. 1 credit per generation.
                      </>
                    )}
                  </div>

                  {/* Simple Mode: Presets + custom hint */}
                  {mode === 'simple' && (
                    <div className="space-y-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <p className="text-sm font-medium text-gray-300">Help the AI understand your diagram (optional):</p>
                      
                      {/* Preset checkboxes */}
                      <div className="space-y-2">
                        {HINT_PRESETS.map(preset => (
                          <label 
                            key={preset.id}
                            className="flex items-center gap-2 cursor-pointer group"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPresets.includes(preset.id)}
                              onChange={() => togglePreset(preset.id)}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-900"
                            />
                            <span className="text-sm text-gray-400 group-hover:text-gray-300">
                              {preset.label}
                            </span>
                          </label>
                        ))}
                      </div>

                      {/* Custom hint input */}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Additional hints:</label>
                        <input
                          type="text"
                          value={customHint}
                          onChange={(e) => setCustomHint(e.target.value)}
                          placeholder="e.g., 'Blue shapes are receivers'"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}

                  {/* Advanced Mode: Info about iterative process */}
                  {mode === 'advanced' && (
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <div className="flex items-start gap-3">
                        <MessageSquare className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <p className="text-sm text-gray-300">
                            <span className="font-medium">How Advanced Mode works:</span>
                          </p>
                          <ol className="text-sm text-gray-400 list-decimal list-inside space-y-1">
                            <li>AI analyzes your image (1 credit)</li>
                            <li>Review the result and describe what's wrong</li>
                            <li>Regenerate with your feedback (1 credit each)</li>
                            <li>Repeat until you're happy with the result</li>
                          </ol>
                          <p className="text-xs text-gray-500 mt-2">
                            Perfect for complex diagrams that need multiple refinements.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Analyze button */}
              {imagePreview && (
                <button
                  onClick={() => analyzeImage(false)}
                  disabled={isAnalyzing || (!isFreePeriod && currentCredits < creditCost)}
                  className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors
                    ${isAnalyzing || (!isFreePeriod && currentCredits < creditCost)
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
                  ) : !isFreePeriod && currentCredits < creditCost ? (
                    <>
                      <AlertCircle className="w-5 h-5" />
                      Need {creditCost} credit{creditCost !== 1 ? 's' : ''} - <span onClick={() => setShowBuyModal(true)} className="underline cursor-pointer">Buy More</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Analyze Play {isFreePeriod ? '(Free!)' : `(${creditCost} credit${creditCost !== 1 ? 's' : ''})`}
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

              {/* Advanced Mode: Feedback and Regenerate */}
              {mode === 'advanced' && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-medium text-orange-200">
                        Not quite right? Regenerate with feedback
                      </span>
                    </div>
                    <span className="text-xs text-orange-400/70">
                      Generation #{generationCount}
                    </span>
                  </div>
                  
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Describe what's wrong, e.g., 'Missing 3 players on the offensive line' or 'The triangles should be at the bottom, not the top'"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                  
                  <button
                    onClick={() => analyzeImage(true)}
                    disabled={isAnalyzing || (!isFreePeriod && currentCredits < creditCost) || !feedbackText.trim()}
                    className={`w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors
                      ${isAnalyzing || (!isFreePeriod && currentCredits < creditCost) || !feedbackText.trim()
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-orange-600 hover:bg-orange-500 text-white'
                      }
                    `}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Regenerate {isFreePeriod ? '(Free!)' : `(${creditCost} credit${creditCost !== 1 ? 's' : ''})`}
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setAnalysis(null);
                    setImagePreview(null);
                    setImageName('');
                    setPreviewElements([]);
                    setFeedbackText('');
                    setGenerationCount(0);
                  }}
                  className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Start Over
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

              {/* Credits used indicator for Advanced mode */}
              {mode === 'advanced' && generationCount > 0 && (
                <p className="text-xs text-center text-gray-500">
                  Credits used this session: {generationCount}
                </p>
              )}

              <p className="text-xs text-gray-500 text-center">
                The play will be added to your editor where you can adjust positions, add routes, and save it.
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Buy Credits Modal */}
      {showBuyModal && (
        <BuyCreditsModal 
          onClose={() => setShowBuyModal(false)}
          onPurchaseComplete={() => {
            setShowBuyModal(false);
            refreshBalance();
          }}
        />
      )}
    </div>
  );
};

export default ClonePlayModal;
