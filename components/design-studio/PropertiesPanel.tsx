// =============================================================================
// PROPERTIES PANEL - Right side element properties editor
// =============================================================================

import React, { useState } from 'react';
import { 
  Type, 
  Palette, 
  Layout,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Trash2,
  Copy,
  Lock,
  Unlock,
  RotateCcw,
  Layers,
  Link,
  ExternalLink,
} from 'lucide-react';
import type { DesignElement, CanvasState } from './types';
import { FONT_FAMILIES } from './types';
import { useTheme } from '../../contexts/ThemeContext';

// QR Link destination types
type QRLinkType = 'custom' | 'registration' | 'game' | 'event' | 'team-page' | 'roster' | 'schedule';

interface QRLinkOption {
  type: QRLinkType;
  label: string;
  icon: string;
  description: string;
}

const QR_LINK_OPTIONS: QRLinkOption[] = [
  { type: 'custom', label: 'Custom URL', icon: '🔗', description: 'Enter any URL' },
  { type: 'registration', label: 'Registration Form', icon: '📝', description: 'Link to season registration' },
  { type: 'game', label: 'Game/Event Tickets', icon: '🎟️', description: 'Link to ticket purchase' },
  { type: 'team-page', label: 'Team Page', icon: '👥', description: 'Link to public team page' },
  { type: 'roster', label: 'Team Roster', icon: '📋', description: 'Link to view roster' },
  { type: 'schedule', label: 'Schedule', icon: '📅', description: 'Link to team schedule' },
];

interface PropertiesPanelProps {
  selectedElement: DesignElement | null;
  canvas: CanvasState;
  onUpdateElement: (id: string, updates: Partial<DesignElement>) => void;
  onUpdateCanvas: (updates: Partial<CanvasState>) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  activeTab?: 'element' | 'canvas' | 'layers';
  // Smart QR linking data
  teamId?: string;
  teamSlug?: string;
  seasons?: { id: string; name: string }[];
  events?: { id: string; name: string; type: string }[];
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedElement,
  canvas,
  onUpdateElement,
  onUpdateCanvas,
  onDeleteElement,
  onDuplicateElement,
  activeTab = 'element',
  teamId,
  teamSlug,
  seasons = [],
  events = [],
}) => {
  const { theme } = useTheme();
  const [qrLinkType, setQrLinkType] = useState<QRLinkType>('custom');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  
  // Theme-aware input classes
  const inputClasses = `w-full px-2 py-1.5 rounded text-sm ${
    theme === 'dark' 
      ? 'bg-zinc-800 border border-zinc-700 text-white' 
      : 'bg-white border border-slate-300 text-slate-900'
  }`;
  
  const labelClasses = `text-xs font-medium mb-1 block ${
    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
  }`;
  
  const smallLabelClasses = `text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`;
  
  const valueClasses = `text-xs w-8 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`;
  
  // Generate smart QR URL based on link type
  const generateQRUrl = (type: QRLinkType, resourceId?: string): string => {
    const baseUrl = window.location.origin;
    const slug = teamSlug || teamId || 'team';
    
    switch (type) {
      case 'registration':
        return resourceId 
          ? `${baseUrl}/register/${slug}/${resourceId}` 
          : `${baseUrl}/register/${slug}`;
      case 'game':
        return resourceId 
          ? `${baseUrl}/tickets/${slug}/${resourceId}` 
          : `${baseUrl}/tickets/${slug}`;
      case 'team-page':
        return `${baseUrl}/team/${slug}`;
      case 'roster':
        return `${baseUrl}/team/${slug}/roster`;
      case 'schedule':
        return `${baseUrl}/team/${slug}/schedule`;
      default:
        return '';
    }
  };
  
  // Handle QR link type change
  const handleQRLinkTypeChange = (type: QRLinkType) => {
    setQrLinkType(type);
    if (type !== 'custom' && selectedElement) {
      const url = generateQRUrl(type);
      if (url) {
        onUpdateElement(selectedElement.id, { content: url });
      }
    }
  };
  
  // Handle season/event selection
  const handleResourceSelect = (resourceId: string, type: 'registration' | 'game') => {
    if (type === 'registration') {
      setSelectedSeasonId(resourceId);
    } else {
      setSelectedEventId(resourceId);
    }
    
    if (selectedElement && resourceId) {
      const url = generateQRUrl(type, resourceId);
      onUpdateElement(selectedElement.id, { content: url });
    }
  };
  
  // Theme-aware input class
  const inputClass = theme === 'dark' 
    ? 'bg-zinc-800 border-zinc-700 text-white' 
    : 'bg-slate-50 border-slate-200 text-slate-900';

  const renderElementProperties = () => {
    if (!selectedElement) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <Layers className="w-8 h-8 text-slate-500" />
          </div>
          <p className="text-slate-400 text-sm">Select an element to edit its properties</p>
          <p className="text-slate-500 text-xs mt-2">Or click on the canvas to add new elements</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Element Type Badge */}
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            {selectedElement.type}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onDuplicateElement(selectedElement.id)}
              className="p-1.5 rounded hover:bg-zinc-700 text-slate-400 hover:text-white"
              title="Duplicate"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => onUpdateElement(selectedElement.id, { locked: !selectedElement.locked })}
              className="p-1.5 rounded hover:bg-zinc-700 text-slate-400 hover:text-white"
              title={selectedElement.locked ? 'Unlock' : 'Lock'}
            >
              {selectedElement.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onDeleteElement(selectedElement.id)}
              className="p-1.5 rounded hover:bg-red-600 text-slate-400 hover:text-white"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Position & Size */}
        <div>
          <label className={labelClasses}>Position & Size</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={smallLabelClasses}>X</label>
              <input
                type="number"
                value={Math.round(selectedElement.position.x)}
                onChange={(e) => onUpdateElement(selectedElement.id, { 
                  position: { ...selectedElement.position, x: Number(e.target.value) } 
                })}
                className={inputClasses}
              />
            </div>
            <div>
              <label className={smallLabelClasses}>Y</label>
              <input
                type="number"
                value={Math.round(selectedElement.position.y)}
                onChange={(e) => onUpdateElement(selectedElement.id, { 
                  position: { ...selectedElement.position, y: Number(e.target.value) } 
                })}
                className={inputClasses}
              />
            </div>
            <div>
              <label className={smallLabelClasses}>Width</label>
              <input
                type="number"
                value={Math.round(selectedElement.size.width)}
                onChange={(e) => onUpdateElement(selectedElement.id, { 
                  size: { ...selectedElement.size, width: Number(e.target.value) } 
                })}
                className={inputClasses}
              />
            </div>
            <div>
              <label className={smallLabelClasses}>Height</label>
              <input
                type="number"
                value={Math.round(selectedElement.size.height)}
                onChange={(e) => onUpdateElement(selectedElement.id, { 
                  size: { ...selectedElement.size, height: Number(e.target.value) } 
                })}
                className={inputClasses}
              />
            </div>
          </div>
        </div>

        {/* Rotation & Opacity */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClasses}>Rotation</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="-180"
                max="180"
                value={selectedElement.rotation}
                onChange={(e) => onUpdateElement(selectedElement.id, { rotation: Number(e.target.value) })}
                className="flex-1"
              />
              <span className={valueClasses}>{selectedElement.rotation}°</span>
            </div>
          </div>
          <div>
            <label className={labelClasses}>Opacity</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={selectedElement.opacity}
                onChange={(e) => onUpdateElement(selectedElement.id, { opacity: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="text-xs text-slate-400 w-8">{Math.round(selectedElement.opacity * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Text-specific properties */}
        {selectedElement.type === 'text' && (
          <>
            <div className="h-px bg-zinc-800" />
            <div>
              <label className="text-xs font-medium text-slate-400 mb-2 block flex items-center gap-1">
                <Type className="w-3 h-3" /> Typography
              </label>
              
              {/* Font Family */}
              <select
                value={selectedElement.fontFamily}
                onChange={(e) => onUpdateElement(selectedElement.id, { fontFamily: e.target.value })}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white mb-2"
              >
                {FONT_FAMILIES.map(font => (
                  <option key={font.value} value={font.value}>{font.name}</option>
                ))}
              </select>

              {/* Font Size */}
              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  value={selectedElement.fontSize}
                  onChange={(e) => onUpdateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                  className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white"
                  min="8"
                  max="200"
                />
                <span className="text-xs text-slate-500 self-center">px</span>
              </div>

              {/* Text Style Buttons */}
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => onUpdateElement(selectedElement.id, { 
                    fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold' 
                  })}
                  className={`flex-1 p-2 rounded ${
                    selectedElement.fontWeight === 'bold' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-zinc-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Bold className="w-4 h-4 mx-auto" />
                </button>
                <button
                  onClick={() => onUpdateElement(selectedElement.id, { 
                    fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic' 
                  })}
                  className={`flex-1 p-2 rounded ${
                    selectedElement.fontStyle === 'italic' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-zinc-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Italic className="w-4 h-4 mx-auto" />
                </button>
                <button
                  onClick={() => onUpdateElement(selectedElement.id, { 
                    textDecoration: selectedElement.textDecoration === 'underline' ? 'none' : 'underline' 
                  })}
                  className={`flex-1 p-2 rounded ${
                    selectedElement.textDecoration === 'underline' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-zinc-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Underline className="w-4 h-4 mx-auto" />
                </button>
              </div>

              {/* Text Alignment */}
              <div className="flex gap-1">
                {[
                  { value: 'left', icon: AlignLeft },
                  { value: 'center', icon: AlignCenter },
                  { value: 'right', icon: AlignRight },
                ].map(align => (
                  <button
                    key={align.value}
                    onClick={() => onUpdateElement(selectedElement.id, { textAlign: align.value as any })}
                    className={`flex-1 p-2 rounded ${
                      selectedElement.textAlign === align.value 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-zinc-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <align.icon className="w-4 h-4 mx-auto" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Color properties */}
        <div className={`h-px ${theme === 'dark' ? 'bg-zinc-800' : 'bg-slate-200'}`} />
        <div>
          <label className={`text-xs font-medium mb-2 block flex items-center gap-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            <Palette className="w-3 h-3" /> Colors
          </label>
          
          {/* Text/Foreground Color */}
          {(selectedElement.type === 'text' || selectedElement.type === 'icon') && (
            <div className="mb-2">
              <label className={smallLabelClasses}>Text Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedElement.color || '#ffffff'}
                  onChange={(e) => onUpdateElement(selectedElement.id, { color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={selectedElement.color || '#ffffff'}
                  onChange={(e) => onUpdateElement(selectedElement.id, { color: e.target.value })}
                  className={`flex-1 px-2 py-1.5 rounded text-sm font-mono ${theme === 'dark' ? 'bg-zinc-800 border border-zinc-700 text-white' : 'bg-white border border-slate-300 text-slate-900'}`}
                />
              </div>
            </div>
          )}

          {/* Background Color */}
          {(selectedElement.type === 'shape' || selectedElement.type === 'qrcode') && (
            <div className="mb-2">
              <label className={smallLabelClasses}>Fill Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedElement.backgroundColor || '#8b5cf6'}
                  onChange={(e) => onUpdateElement(selectedElement.id, { backgroundColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={selectedElement.backgroundColor || '#8b5cf6'}
                  onChange={(e) => onUpdateElement(selectedElement.id, { backgroundColor: e.target.value })}
                  className={`flex-1 px-2 py-1.5 rounded text-sm font-mono ${theme === 'dark' ? 'bg-zinc-800 border border-zinc-700 text-white' : 'bg-white border border-slate-300 text-slate-900'}`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Border - Available for ALL elements */}
        <div className={`h-px ${theme === 'dark' ? 'bg-zinc-800' : 'bg-slate-200'}`} />
        <div>
          <label className={`text-xs font-medium mb-2 block ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Border
          </label>
          
          {/* Border Width */}
          <div className="mb-3">
            <label className={smallLabelClasses}>Width</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="20"
                value={selectedElement.borderWidth || 0}
                onChange={(e) => onUpdateElement(selectedElement.id, { borderWidth: Number(e.target.value) })}
                className="flex-1"
              />
              <span className={valueClasses}>{selectedElement.borderWidth || 0}px</span>
            </div>
          </div>
          
          {/* Border Color */}
          <div className="mb-2">
            <label className={smallLabelClasses}>Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selectedElement.borderColor || '#ffffff'}
                onChange={(e) => onUpdateElement(selectedElement.id, { borderColor: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
              <input
                type="text"
                value={selectedElement.borderColor || '#ffffff'}
                onChange={(e) => onUpdateElement(selectedElement.id, { borderColor: e.target.value })}
                className={`flex-1 px-2 py-1.5 rounded text-sm font-mono ${theme === 'dark' ? 'bg-zinc-800 border border-zinc-700 text-white' : 'bg-white border border-slate-300 text-slate-900'}`}
              />
            </div>
          </div>
        </div>

        {/* Border Radius */}
        {(selectedElement.type === 'shape' || selectedElement.type === 'image' || selectedElement.type === 'logo') && (
          <div>
            <label className={labelClasses}>Corner Radius</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={selectedElement.borderRadius || 0}
                onChange={(e) => onUpdateElement(selectedElement.id, { borderRadius: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="text-xs text-slate-400 w-8">{selectedElement.borderRadius || 0}px</span>
            </div>
          </div>
        )}

        {/* Image Upload */}
        {(selectedElement.type === 'image' || selectedElement.type === 'logo') && (
          <>
            <div className="h-px bg-zinc-800" />
            <div>
              <label className="text-xs font-medium text-slate-400 mb-2 block">Image Source</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const dataUrl = event.target?.result as string;
                    onUpdateElement(selectedElement.id, { src: dataUrl });
                  };
                  reader.readAsDataURL(file);
                }}
                className="hidden"
                id={`image-upload-${selectedElement.id}`}
              />
              <label
                htmlFor={`image-upload-${selectedElement.id}`}
                className="flex items-center justify-center gap-2 w-full py-3 border border-dashed border-zinc-600 rounded-lg cursor-pointer hover:border-purple-500 hover:bg-zinc-800/50 text-slate-400 hover:text-purple-400 transition-colors"
              >
                📷 {selectedElement.src ? 'Replace Image' : 'Upload Image'}
              </label>
              {selectedElement.src && (
                <button
                  onClick={() => onUpdateElement(selectedElement.id, { src: undefined })}
                  className="w-full mt-2 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                >
                  Remove Image
                </button>
              )}
            </div>
          </>
        )}

        {/* QR Code URL - Smart Linking */}
        {selectedElement.type === 'qrcode' && (
          <>
            <div className="h-px bg-zinc-800" />
            <div className="space-y-3">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-2">
                <Link className="w-3.5 h-3.5" />
                QR Code Destination
              </label>
              
              {/* Link Type Selector */}
              <div className="grid grid-cols-2 gap-1.5">
                {QR_LINK_OPTIONS.map((option) => (
                  <button
                    key={option.type}
                    onClick={() => handleQRLinkTypeChange(option.type)}
                    className={`px-2 py-2 rounded-lg text-xs text-left transition-colors ${
                      qrLinkType === option.type
                        ? 'bg-purple-600/30 border border-purple-500 text-purple-300'
                        : 'bg-zinc-800 border border-zinc-700 text-slate-400 hover:border-zinc-600 hover:text-slate-300'
                    }`}
                  >
                    <span className="mr-1">{option.icon}</span>
                    <span className="font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
              
              {/* Season Selector - for Registration links */}
              {qrLinkType === 'registration' && seasons.length > 0 && (
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Select Season</label>
                  <select
                    value={selectedSeasonId}
                    onChange={(e) => handleResourceSelect(e.target.value, 'registration')}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Select a season...</option>
                    {seasons.map((season) => (
                      <option key={season.id} value={season.id}>{season.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Event Selector - for Game/Ticket links */}
              {qrLinkType === 'game' && events.length > 0 && (
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Select Game/Event</label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => handleResourceSelect(e.target.value, 'game')}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Select an event...</option>
                    {events.filter(e => e.type === 'game' || e.type === 'Game').map((event) => (
                      <option key={event.id} value={event.id}>{event.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Custom URL Input - always shown for custom, and as readonly for others */}
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">
                  {qrLinkType === 'custom' ? 'Enter URL' : 'Generated URL'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="https://your-link.com"
                    value={selectedElement.content || ''}
                    onChange={(e) => {
                      if (qrLinkType === 'custom') {
                        onUpdateElement(selectedElement.id, { content: e.target.value });
                      }
                    }}
                    readOnly={qrLinkType !== 'custom'}
                    className={`w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none ${
                      qrLinkType !== 'custom' ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  />
                  {selectedElement.content && (
                    <a
                      href={selectedElement.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-purple-400"
                      title="Open link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
              
              {/* Smart Link Info */}
              {qrLinkType !== 'custom' && (
                <div className="p-2 bg-purple-600/10 border border-purple-500/20 rounded-lg">
                  <p className="text-[10px] text-purple-300">
                    💡 <strong>Smart Link:</strong> Users who scan this QR will be directed to the in-app page. 
                    Non-users will see a signup prompt, then be redirected after login.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Z-Index */}
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">Layer Order</label>
          <div className="flex gap-2">
            <button
              onClick={() => onUpdateElement(selectedElement.id, { zIndex: selectedElement.zIndex + 10 })}
              className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-slate-300"
            >
              Bring Forward
            </button>
            <button
              onClick={() => onUpdateElement(selectedElement.id, { zIndex: Math.max(0, selectedElement.zIndex - 10) })}
              className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-slate-300"
            >
              Send Back
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCanvasProperties = () => (
    <div className="space-y-4">
      {/* Canvas Size */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">Canvas Size</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500">Width</label>
            <input
              type="number"
              value={canvas.width}
              onChange={(e) => onUpdateCanvas({ width: Number(e.target.value) })}
              className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Height</label>
            <input
              type="number"
              value={canvas.height}
              onChange={(e) => onUpdateCanvas({ height: Number(e.target.value) })}
              className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white"
            />
          </div>
        </div>
      </div>

      {/* Background Color */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">Background</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={canvas.backgroundColor}
            onChange={(e) => onUpdateCanvas({ backgroundColor: e.target.value })}
            className="w-10 h-10 rounded cursor-pointer border-0"
          />
          <input
            type="text"
            value={canvas.backgroundColor}
            onChange={(e) => onUpdateCanvas({ backgroundColor: e.target.value })}
            className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white font-mono"
          />
        </div>
      </div>

      {/* Quick Color Presets */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">Quick Presets</label>
        <div className="grid grid-cols-4 gap-2">
          {[
            '#1e3a5f', '#1f2937', '#064e3b', '#7f1d1d',
            '#1e1b4b', '#0c4a6e', '#422006', '#171717',
          ].map((color) => (
            <button
              key={color}
              onClick={() => onUpdateCanvas({ backgroundColor: color })}
              className="h-8 rounded border border-zinc-700 hover:border-white/50 transition-all"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-3">
      {activeTab === 'element' ? renderElementProperties() : renderCanvasProperties()}
    </div>
  );
};

export default PropertiesPanel;
