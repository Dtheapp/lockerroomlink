// =============================================================================
// HEADER BAR - Top navigation with file operations, undo/redo, export
// =============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft,
  Download,
  Share2,
  Undo2,
  Redo2,
  Save,
  FileImage,
  Grid3X3,
  Eye,
  Settings,
  HelpCircle,
  Sparkles,
  FolderOpen,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { FLYER_SIZES, FlyerSize } from './types';
import { useTheme } from '../../contexts/ThemeContext';

interface HeaderBarProps {
  designName: string;
  canUndo: boolean;
  canRedo: boolean;
  gridEnabled: boolean;
  currentSize: FlyerSize;
  zoom: number;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onOpenGallery?: () => void;
  onExport: (format: 'png' | 'jpg' | 'pdf') => void;
  onToggleGrid: () => void;
  onSizeChange: (size: FlyerSize) => void;
  onNameChange: (name: string) => void;
  onPreview: () => void;
  onFullscreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomChange: (zoom: number) => void;
  onFitToScreen: () => void;
}

const HeaderBar: React.FC<HeaderBarProps> = ({
  designName,
  canUndo,
  canRedo,
  gridEnabled,
  currentSize,
  zoom,
  onBack,
  onUndo,
  onRedo,
  onSave,
  onOpenGallery,
  onExport,
  onToggleGrid,
  onSizeChange,
  onNameChange,
  onPreview,
  onFullscreen,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomChange,
  onFitToScreen,
}) => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInput, setZoomInput] = useState(zoom.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  const zoomInputRef = useRef<HTMLInputElement>(null);

  // Update zoomInput when zoom changes externally
  useEffect(() => {
    if (!isEditingZoom) {
      setZoomInput(zoom.toString());
    }
  }, [zoom, isEditingZoom]);

  return (
    <div className={`h-14 border-b flex items-center px-2 sm:px-4 overflow-x-auto ${
      theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
    }`}>
      {/* Left Section */}
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        <button
          onClick={onBack}
          className={`flex items-center gap-1 sm:gap-2 transition-colors ${
            theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm hidden sm:inline">Back</span>
        </button>

        <div className={`w-px h-6 ${theme === 'dark' ? 'bg-zinc-700' : 'bg-slate-200'}`} />

        {/* Design Name */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={designName}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
            className={`border rounded px-2 py-1 text-sm focus:border-purple-500 focus:outline-none ${
              theme === 'dark' 
                ? 'bg-zinc-800 border-zinc-600 text-white' 
                : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
            autoFocus
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className={`font-medium hover:text-purple-400 transition-colors flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline max-w-[120px] truncate">{designName || 'Untitled Design'}</span>
          </button>
        )}

        {/* Size Selector */}
        <div className="relative">
          <button
            onClick={() => setShowSizeMenu(!showSizeMenu)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              theme === 'dark' 
                ? 'bg-zinc-800 hover:bg-zinc-700 text-slate-300' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span>{FLYER_SIZES[currentSize].icon}</span>
            <span>{FLYER_SIZES[currentSize].label}</span>
          </button>
          
          {showSizeMenu && (
            <div className={`absolute top-full left-0 mt-1 border rounded-lg shadow-xl py-1 min-w-[200px] z-50 ${
              theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-200'
            }`}>
              {Object.entries(FLYER_SIZES).map(([key, size]) => (
                <button
                  key={key}
                  onClick={() => { onSizeChange(key as FlyerSize); setShowSizeMenu(false); }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                    theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-slate-100'
                  } ${
                    currentSize === key ? 'text-purple-400' : theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  <span>{size.icon}</span>
                  <span>{size.label}</span>
                  <span className="text-xs text-slate-500 ml-auto">{size.width}×{size.height}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center Section - Undo/Redo & Zoom */}
      <div className="flex items-center gap-1 mx-2 sm:mx-4 flex-shrink-0">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded-lg transition-colors ${
            canUndo 
              ? theme === 'dark' 
                ? 'text-slate-300 hover:bg-zinc-800 hover:text-white' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              : 'text-slate-400 cursor-not-allowed'
          }`}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-5 h-5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded-lg transition-colors ${
            canRedo 
              ? theme === 'dark' 
                ? 'text-slate-300 hover:bg-zinc-800 hover:text-white' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              : 'text-slate-400 cursor-not-allowed'
          }`}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="w-5 h-5" />
        </button>

        {/* Zoom Controls - Hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1">
          <div className={`w-px h-6 mx-2 ${theme === 'dark' ? 'bg-zinc-700' : 'bg-slate-200'}`} />

          <button
            onClick={onZoomOut}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'text-slate-300 hover:bg-zinc-800 hover:text-white' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="Zoom Out (-5%)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          {isEditingZoom ? (
            <input
              ref={zoomInputRef}
              type="number"
              value={zoomInput}
              onChange={(e) => setZoomInput(e.target.value)}
              onBlur={() => {
                const val = parseInt(zoomInput);
                if (!isNaN(val) && val >= 10 && val <= 400) {
                  onZoomChange(val);
                } else {
                  setZoomInput(zoom.toString());
                }
                setIsEditingZoom(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = parseInt(zoomInput);
                  if (!isNaN(val) && val >= 10 && val <= 400) {
                    onZoomChange(val);
                  }
                  setIsEditingZoom(false);
                }
                if (e.key === 'Escape') {
                  setZoomInput(zoom.toString());
                  setIsEditingZoom(false);
                }
              }}
              className={`w-16 px-2 py-1 rounded text-sm text-center border focus:outline-none focus:border-purple-500 ${
                theme === 'dark' 
                  ? 'bg-zinc-800 border-zinc-600 text-white' 
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
              autoFocus
              min="10"
              max="400"
            />
          ) : (
            <button
              onClick={() => {
                setZoomInput(zoom.toString());
                setIsEditingZoom(true);
                setTimeout(() => zoomInputRef.current?.select(), 0);
              }}
              className={`px-2 py-1 rounded-lg text-sm min-w-[50px] text-center transition-colors ${
                theme === 'dark' 
                  ? 'text-slate-300 hover:bg-zinc-800 hover:text-white' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="Click to enter custom zoom (10-400%)"
            >
              {zoom}%
            </button>
          )}
          <button
            onClick={onZoomIn}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'text-slate-300 hover:bg-zinc-800 hover:text-white' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="Zoom In (+5%)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={onFitToScreen}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'text-slate-300 hover:bg-zinc-800 hover:text-white' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="Fit to Screen"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-auto">
        {/* Fullscreen - Icon only */}
        <button
          onClick={onFullscreen}
          className={`p-2 rounded-lg transition-colors ${
            theme === 'dark' 
              ? 'text-slate-400 hover:bg-zinc-800 hover:text-white' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Edit Fullscreen"
        >
          <Maximize2 className="w-5 h-5" />
        </button>

        {/* Grid Toggle */}
        <button
          onClick={onToggleGrid}
          className={`p-2 rounded-lg transition-colors ${
            gridEnabled 
              ? 'bg-purple-600/20 text-purple-400' 
              : theme === 'dark' 
                ? 'text-slate-400 hover:bg-zinc-800 hover:text-white' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Toggle Grid"
        >
          <Grid3X3 className="w-5 h-5" />
        </button>

        {/* Preview */}
        <button
          onClick={onPreview}
          className={`p-2 rounded-lg transition-colors ${
            theme === 'dark' 
              ? 'text-slate-400 hover:bg-zinc-800 hover:text-white' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Preview"
        >
          <Eye className="w-5 h-5" />
        </button>

        <div className={`w-px h-6 hidden sm:block ${theme === 'dark' ? 'bg-zinc-700' : 'bg-slate-200'}`} />

        {/* Save */}
        <button
          onClick={onSave}
          className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-sm transition-colors ${
            theme === 'dark' 
              ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
              : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
          }`}
        >
          <Save className="w-4 h-4" />
          <span className="hidden sm:inline">Save</span>
        </button>

        {/* Export */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-sm transition-colors ${
              theme === 'dark' 
                ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
            }`}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          
          {showExportMenu && (
            <div className={`absolute top-full right-0 mt-1 border rounded-lg shadow-xl py-1 min-w-[160px] z-50 ${
              theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-200'
            }`}>
              <button
                onClick={() => { onExport('png'); setShowExportMenu(false); }}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                  theme === 'dark' ? 'text-slate-300 hover:bg-zinc-800' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileImage className="w-4 h-4" />
                PNG (High Quality)
              </button>
              <button
                onClick={() => { onExport('jpg'); setShowExportMenu(false); }}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                  theme === 'dark' ? 'text-slate-300 hover:bg-zinc-800' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileImage className="w-4 h-4" />
                JPG (Smaller Size)
              </button>
              <div className={`h-px my-1 ${theme === 'dark' ? 'bg-zinc-700' : 'bg-slate-200'}`} />
              <button
                onClick={() => { onExport('pdf'); setShowExportMenu(false); }}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                  theme === 'dark' ? 'text-slate-300 hover:bg-zinc-800' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileImage className="w-4 h-4" />
                PDF (Print Ready)
              </button>
            </div>
          )}
        </div>

        {/* My Designs - Navigate to full page */}
        <button
          onClick={() => navigate('/marketing')}
          className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-sm transition-colors ${
            theme === 'dark' 
              ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
              : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
          }`}
          title="My Designs"
        >
          <FolderOpen className="w-4 h-4" />
          <span className="hidden sm:inline">My Designs</span>
        </button>
      </div>
    </div>
  );
};

export default HeaderBar;
