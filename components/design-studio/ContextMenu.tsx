import React, { useEffect, useRef } from 'react';
import { 
  Copy, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  ChevronsUp, 
  ChevronsDown,
  Scissors,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Layers,
} from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCut: () => void;
  onCopy: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onToggleVisible: () => void;
  isLocked: boolean;
  isVisible: boolean;
  hasMultipleSelected: boolean;
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onDuplicate,
  onDelete,
  onCut,
  onCopy,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onLock,
  onUnlock,
  onToggleVisible,
  isLocked,
  isVisible,
  hasMultipleSelected,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);
  
  // Adjust position to stay within viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);
  
  const menuItems: (MenuItem | { divider: true })[] = [
    {
      label: 'Cut',
      icon: <Scissors size={14} />,
      shortcut: 'Ctrl+X',
      onClick: () => { onCut(); onClose(); },
    },
    {
      label: 'Copy',
      icon: <Copy size={14} />,
      shortcut: 'Ctrl+C',
      onClick: () => { onCopy(); onClose(); },
    },
    {
      label: 'Duplicate',
      icon: <Copy size={14} />,
      shortcut: 'Ctrl+D',
      onClick: () => { onDuplicate(); onClose(); },
    },
    { divider: true },
    {
      label: 'Bring Forward',
      icon: <ArrowUp size={14} />,
      shortcut: 'Ctrl+]',
      onClick: () => { onBringForward(); onClose(); },
    },
    {
      label: 'Send Backward',
      icon: <ArrowDown size={14} />,
      shortcut: 'Ctrl+[',
      onClick: () => { onSendBackward(); onClose(); },
    },
    {
      label: 'Bring to Front',
      icon: <ChevronsUp size={14} />,
      shortcut: 'Ctrl+Shift+]',
      onClick: () => { onBringToFront(); onClose(); },
    },
    {
      label: 'Send to Back',
      icon: <ChevronsDown size={14} />,
      shortcut: 'Ctrl+Shift+[',
      onClick: () => { onSendToBack(); onClose(); },
    },
    { divider: true },
    {
      label: isLocked ? 'Unlock' : 'Lock',
      icon: isLocked ? <Unlock size={14} /> : <Lock size={14} />,
      onClick: () => { isLocked ? onUnlock() : onLock(); onClose(); },
    },
    {
      label: isVisible ? 'Hide' : 'Show',
      icon: isVisible ? <EyeOff size={14} /> : <Eye size={14} />,
      onClick: () => { onToggleVisible(); onClose(); },
    },
    { divider: true },
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      shortcut: 'Del',
      onClick: () => { onDelete(); onClose(); },
      danger: true,
    },
  ];
  
  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[200px] bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden"
      style={{ left: x, top: y }}
    >
      <div className="py-1">
        {menuItems.map((item, index) => {
          if ('divider' in item && item.divider) {
            return <div key={`divider-${index}`} className="h-px bg-zinc-700 my-1" />;
          }
          
          const menuItem = item as MenuItem;
          return (
            <button
              key={menuItem.label}
              onClick={menuItem.onClick}
              className={`
                w-full px-3 py-2 flex items-center gap-3 text-sm
                transition-colors duration-150
                ${menuItem.danger 
                  ? 'text-red-400 hover:bg-red-500/20' 
                  : 'text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              <span className="opacity-70">{menuItem.icon}</span>
              <span className="flex-1 text-left">{menuItem.label}</span>
              {menuItem.shortcut && (
                <span className="text-xs text-zinc-500">{menuItem.shortcut}</span>
              )}
            </button>
          );
        })}
      </div>
      
      {hasMultipleSelected && (
        <div className="px-3 py-2 bg-zinc-800/50 border-t border-zinc-700">
          <span className="text-xs text-zinc-500">
            Multiple elements selected
          </span>
        </div>
      )}
    </div>
  );
};

export default ContextMenu;
