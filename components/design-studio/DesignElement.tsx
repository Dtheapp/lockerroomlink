// =============================================================================
// DESIGN ELEMENT - Draggable, resizable, deletable element component
// =============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Trash2, 
  Copy, 
  Lock, 
  Unlock, 
  MoreVertical,
  MoveUp,
  MoveDown,
  Eye,
  EyeOff,
  Wand2,
  Paintbrush,
} from 'lucide-react';
import QRCode from 'qrcode';
import type { DesignElement, Position, Size, ResizeHandle } from './types';

interface DesignElementProps {
  element: DesignElement;
  isSelected: boolean;
  scale: number;
  onSelect: (id: string, addToSelection?: boolean) => void;
  onUpdate: (id: string, updates: Partial<DesignElement>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onStartDrag: (id: string, e: React.MouseEvent) => void;
  onStartResize: (id: string, handle: ResizeHandle, e: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
  onEditImage?: (id: string) => void;
}

const RESIZE_HANDLES: ResizeHandle[] = [
  'top-left', 'top', 'top-right',
  'left', 'right',
  'bottom-left', 'bottom', 'bottom-right'
];

const getHandlePosition = (handle: ResizeHandle): React.CSSProperties => {
  const positions: Record<ResizeHandle, React.CSSProperties> = {
    'top-left': { top: -5, left: -5, cursor: 'nwse-resize' },
    'top': { top: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
    'top-right': { top: -5, right: -5, cursor: 'nesw-resize' },
    'left': { top: '50%', left: -5, transform: 'translateY(-50%)', cursor: 'ew-resize' },
    'right': { top: '50%', right: -5, transform: 'translateY(-50%)', cursor: 'ew-resize' },
    'bottom-left': { bottom: -5, left: -5, cursor: 'nesw-resize' },
    'bottom': { bottom: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
    'bottom-right': { bottom: -5, right: -5, cursor: 'nwse-resize' },
  };
  return positions[handle];
};

export const DesignElementComponent: React.FC<DesignElementProps> = ({
  element,
  isSelected,
  scale,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onStartDrag,
  onStartResize,
  onDoubleClick,
  onEditImage,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(element.content || '');
  const [qrCodeSrc, setQrCodeSrc] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Generate QR code when content changes
  useEffect(() => {
    if (element.type === 'qrcode' && element.content) {
      QRCode.toDataURL(element.content, {
        width: 300,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      }).then(setQrCodeSrc).catch(() => setQrCodeSrc(null));
    } else if (element.type === 'qrcode') {
      setQrCodeSrc(null);
    }
  }, [element.type, element.content]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (element.locked || isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(element.id, e.shiftKey);
    // Always start drag - multi-select drag is handled in DesignCanvas
    onStartDrag(element.id, e);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (element.type === 'text' && !element.locked) {
      setIsEditing(true);
      setEditText(element.content || '');
    }
    onDoubleClick(element.id);
  };

  const handleTextBlur = () => {
    setIsEditing(false);
    if (editText !== element.content) {
      onUpdate(element.id, { content: editText });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleTextBlur();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(element.content || '');
    }
  };

  const renderContent = () => {
    switch (element.type) {
      case 'text':
        if (isEditing) {
          return (
            <textarea
              ref={inputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleTextBlur}
              onKeyDown={handleKeyDown}
              className="w-full h-full bg-transparent border-none outline-none resize-none"
              style={{
                color: element.color,
                fontSize: element.fontSize,
                fontFamily: element.fontFamily,
                fontWeight: element.fontWeight,
                fontStyle: element.fontStyle,
                textAlign: element.textAlign,
                lineHeight: element.lineHeight || 1.2,
                letterSpacing: element.letterSpacing,
              }}
            />
          );
        }
        // Calculate font size for auto-scaling (emojis/icons)
        const effectiveFontSize = element.autoScaleFont 
          ? Math.min(element.size.width, element.size.height) * 0.7
          : element.fontSize;
        
        // For emojis/icons (autoScaleFont), use drop-shadow filter for border effect
        // For regular text, use WebkitTextStroke
        const isEmoji = element.autoScaleFont;
        const hasBorder = element.borderWidth && element.borderWidth > 0;
        const borderColor = element.borderColor || '#000000';
        
        // Drop shadow creates outline effect for emojis (multiple shadows for solid outline)
        const emojiOutlineFilter = hasBorder && isEmoji
          ? `drop-shadow(${element.borderWidth}px 0 0 ${borderColor}) 
             drop-shadow(-${element.borderWidth}px 0 0 ${borderColor}) 
             drop-shadow(0 ${element.borderWidth}px 0 ${borderColor}) 
             drop-shadow(0 -${element.borderWidth}px 0 ${borderColor})
             drop-shadow(${element.borderWidth! * 0.7}px ${element.borderWidth! * 0.7}px 0 ${borderColor})
             drop-shadow(-${element.borderWidth! * 0.7}px ${element.borderWidth! * 0.7}px 0 ${borderColor})
             drop-shadow(${element.borderWidth! * 0.7}px -${element.borderWidth! * 0.7}px 0 ${borderColor})
             drop-shadow(-${element.borderWidth! * 0.7}px -${element.borderWidth! * 0.7}px 0 ${borderColor})`
          : undefined;
        
        // Text stroke for regular text (not emojis)
        const textStrokeStyle = hasBorder && !isEmoji
          ? `${element.borderWidth}px ${borderColor}`
          : undefined;
        
        // POINT TEXT MODE: No wrapping, text stays on single line (unless explicit newlines)
        return (
          <div
            className="w-full h-full overflow-visible whitespace-pre flex items-center justify-center"
            style={{
              color: element.color,
              fontSize: effectiveFontSize,
              fontFamily: element.fontFamily,
              fontWeight: element.fontWeight,
              fontStyle: element.fontStyle,
              textAlign: element.textAlign,
              textDecoration: element.textDecoration,
              lineHeight: element.lineHeight || 1.2,
              letterSpacing: element.letterSpacing,
              textShadow: element.textShadow,
              WebkitTextStroke: textStrokeStyle,
              paintOrder: 'stroke fill', // Ensures stroke is behind fill
              filter: emojiOutlineFilter,
            }}
          >
            {element.content}
          </div>
        );

      case 'image':
      case 'logo':
        return element.src ? (
          <img
            src={element.src}
            alt=""
            className="w-full h-full"
            style={{ 
              borderRadius: element.borderRadius,
              objectFit: 'contain',
            }}
            draggable={false}
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center bg-slate-700/50 border-2 border-dashed border-slate-500"
            style={{ borderRadius: element.borderRadius }}
          >
            <span className="text-slate-400 text-sm">
              {element.type === 'logo' ? '🏆 Add Logo' : '🖼️ Add Image'}
            </span>
          </div>
        );

      case 'shape':
        const shapeStyle: React.CSSProperties = {
          width: '100%',
          height: '100%',
          backgroundColor: element.backgroundColor,
          borderRadius: element.shapeType === 'circle' ? '50%' : element.borderRadius,
          border: element.borderWidth ? `${element.borderWidth}px solid ${element.borderColor}` : undefined,
        };
        
        if (element.gradient) {
          const { type, angle, stops } = element.gradient;
          const gradientStops = stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ');
          shapeStyle.background = type === 'linear' 
            ? `linear-gradient(${angle}deg, ${gradientStops})`
            : `radial-gradient(circle, ${gradientStops})`;
        }
        
        return <div style={shapeStyle} />;

      case 'qrcode':
        return (
          <div 
            className="w-full h-full flex items-center justify-center"
            style={{ 
              backgroundColor: element.backgroundColor,
              borderRadius: element.borderRadius,
            }}
          >
            {qrCodeSrc ? (
              <img src={qrCodeSrc} alt="QR Code" className="w-full h-full p-2" draggable={false} />
            ) : (
              <div className="text-center">
                <span className="text-4xl block mb-1">📱</span>
                <span className="text-slate-600 text-xs">Enter URL in properties</span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (!element.visible) return null;

  // Border styles ONLY for images/logos (shapes handle their own border, text uses text-stroke)
  const shouldApplyWrapperBorder = element.type === 'image' || element.type === 'logo';
  const borderStyle = shouldApplyWrapperBorder && element.borderWidth && element.borderWidth > 0
    ? `${element.borderWidth}px solid ${element.borderColor || '#ffffff'}`
    : undefined;
  
  // Border radius for non-text elements
  const borderRadiusStyle = element.type !== 'text' ? element.borderRadius : undefined;

  // Note: We don't multiply by scale here because the parent canvas
  // uses CSS transform: scale() which handles visual scaling uniformly
  return (
    <div
      className={`absolute group ${element.locked ? 'cursor-not-allowed' : 'cursor-move'}`}
      style={{
        left: element.position.x,
        top: element.position.y,
        width: element.size.width,
        height: element.size.height,
        transform: `rotate(${element.rotation}deg)`,
        opacity: element.opacity,
        zIndex: element.zIndex,
        border: borderStyle,
        borderRadius: borderRadiusStyle,
        boxSizing: 'border-box',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Element content */}
      <div className="w-full h-full" style={{ pointerEvents: isEditing ? 'auto' : 'none', userSelect: 'none' }}>
        {renderContent()}
      </div>

      {/* Selection border & handles */}
      {isSelected && (
        <>
          {/* Selection border */}
          <div 
            className="absolute inset-0 border-2 border-purple-500 pointer-events-none"
            style={{ borderRadius: element.borderRadius }}
          />

          {/* Resize handles */}
          {!element.locked && RESIZE_HANDLES.map(handle => (
            <div
              key={handle}
              className="absolute w-3 h-3 bg-white border-2 border-purple-500 rounded-sm hover:bg-purple-100"
              style={{ 
                ...getHandlePosition(handle), 
                userSelect: 'none',
                cursor: handle.includes('n') && handle.includes('e') ? 'nesw-resize' :
                        handle.includes('n') && handle.includes('w') ? 'nwse-resize' :
                        handle.includes('s') && handle.includes('e') ? 'nwse-resize' :
                        handle.includes('s') && handle.includes('w') ? 'nesw-resize' :
                        handle.includes('n') || handle.includes('s') ? 'ns-resize' : 'ew-resize',
                zIndex: 9999,
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onStartResize(element.id, handle, e);
              }}
            />
          ))}

          {/* Quick actions toolbar */}
          <div 
            className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-zinc-900 rounded-lg px-2 py-1 shadow-xl border border-zinc-700"
            style={{ zIndex: 9999 }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(element.id); }}
              className="p-1 hover:bg-zinc-700 rounded text-slate-300 hover:text-white"
              title="Duplicate"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate(element.id, { locked: !element.locked }); }}
              className="p-1 hover:bg-zinc-700 rounded text-slate-300 hover:text-white"
              title={element.locked ? 'Unlock' : 'Lock'}
            >
              {element.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(element.id); }}
              className="p-1 hover:bg-red-600 rounded text-slate-300 hover:text-white"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-zinc-700" />
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-1 hover:bg-zinc-700 rounded text-slate-300 hover:text-white"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Extended menu */}
          {showMenu && (
            <div 
              ref={menuRef}
              className="absolute -top-10 left-1/2 translate-x-12 bg-zinc-900 rounded-lg py-1 shadow-xl border border-zinc-700 min-w-[160px]"
              style={{ zIndex: 10000 }}
            >
              {/* Edit Image option - only for image/logo elements */}
              {(element.type === 'image' || element.type === 'logo') && element.src && onEditImage && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditImage(element.id); setShowMenu(false); }}
                    className="w-full px-3 py-1.5 text-left text-sm text-purple-300 hover:bg-purple-600/30 flex items-center gap-2"
                  >
                    <Wand2 className="w-4 h-4" /> Edit Image
                  </button>
                  <div className="h-px bg-zinc-700 my-1" />
                </>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onUpdate(element.id, { zIndex: element.zIndex + 1 }); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-zinc-700 flex items-center gap-2"
              >
                <MoveUp className="w-4 h-4" /> Bring Forward
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onUpdate(element.id, { zIndex: Math.max(0, element.zIndex - 1) }); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-zinc-700 flex items-center gap-2"
              >
                <MoveDown className="w-4 h-4" /> Send Backward
              </button>
              <div className="h-px bg-zinc-700 my-1" />
              <button
                onClick={(e) => { e.stopPropagation(); onUpdate(element.id, { visible: false }); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-zinc-700 flex items-center gap-2"
              >
                <EyeOff className="w-4 h-4" /> Hide
              </button>
            </div>
          )}
        </>
      )}

      {/* Lock indicator */}
      {element.locked && (
        <div className="absolute top-1 right-1 p-1 bg-zinc-900/80 rounded">
          <Lock className="w-3 h-3 text-orange-400" />
        </div>
      )}
    </div>
  );
};

export default DesignElementComponent;
