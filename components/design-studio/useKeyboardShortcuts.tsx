import { useEffect, useCallback } from 'react';
import { DesignElement } from './types';

export interface KeyboardShortcutsConfig {
  onDelete: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onCut: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSelectAll: () => void;
  onDeselect: () => void;
  onDuplicate: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onNudge: (direction: 'up' | 'down' | 'left' | 'right', shift: boolean) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onToggleGrid: () => void;
  onSave: () => void;
  onExport: () => void;
  hasSelection: boolean;
  isEditing: boolean;
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if editing text or in input
    if (
      config.isEditing ||
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA' ||
      (e.target as HTMLElement).isContentEditable
    ) {
      return;
    }
    
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const key = e.key.toLowerCase();
    
    // Delete
    if ((key === 'delete' || key === 'backspace') && config.hasSelection) {
      e.preventDefault();
      config.onDelete();
      return;
    }
    
    // Copy
    if (ctrl && key === 'c' && config.hasSelection) {
      e.preventDefault();
      config.onCopy();
      return;
    }
    
    // Paste
    if (ctrl && key === 'v') {
      e.preventDefault();
      config.onPaste();
      return;
    }
    
    // Cut
    if (ctrl && key === 'x' && config.hasSelection) {
      e.preventDefault();
      config.onCut();
      return;
    }
    
    // Undo
    if (ctrl && key === 'z' && !shift) {
      e.preventDefault();
      config.onUndo();
      return;
    }
    
    // Redo
    if ((ctrl && key === 'z' && shift) || (ctrl && key === 'y')) {
      e.preventDefault();
      config.onRedo();
      return;
    }
    
    // Select all
    if (ctrl && key === 'a') {
      e.preventDefault();
      config.onSelectAll();
      return;
    }
    
    // Deselect
    if (key === 'escape') {
      e.preventDefault();
      config.onDeselect();
      return;
    }
    
    // Duplicate
    if (ctrl && key === 'd' && config.hasSelection) {
      e.preventDefault();
      config.onDuplicate();
      return;
    }
    
    // Layer controls
    if (ctrl && key === ']' && config.hasSelection) {
      e.preventDefault();
      if (shift) {
        config.onBringToFront();
      } else {
        config.onBringForward();
      }
      return;
    }
    
    if (ctrl && key === '[' && config.hasSelection) {
      e.preventDefault();
      if (shift) {
        config.onSendToBack();
      } else {
        config.onSendBackward();
      }
      return;
    }
    
    // Nudge with arrow keys
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && config.hasSelection) {
      e.preventDefault();
      const direction = key.replace('arrow', '') as 'up' | 'down' | 'left' | 'right';
      config.onNudge(direction, shift);
      return;
    }
    
    // Zoom
    if (ctrl && (key === '=' || key === '+')) {
      e.preventDefault();
      config.onZoomIn();
      return;
    }
    
    if (ctrl && key === '-') {
      e.preventDefault();
      config.onZoomOut();
      return;
    }
    
    if (ctrl && key === '0') {
      e.preventDefault();
      config.onZoomReset();
      return;
    }
    
    // Toggle grid
    if (ctrl && key === 'g') {
      e.preventDefault();
      config.onToggleGrid();
      return;
    }
    
    // Save
    if (ctrl && key === 's') {
      e.preventDefault();
      config.onSave();
      return;
    }
    
    // Export
    if (ctrl && key === 'e') {
      e.preventDefault();
      config.onExport();
      return;
    }
  }, [config]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Clipboard management
let clipboard: DesignElement[] = [];

export function copyToClipboard(elements: DesignElement[]) {
  clipboard = elements.map(el => ({ ...el }));
}

export function getClipboard(): DesignElement[] {
  return clipboard.map(el => ({ ...el }));
}

export function hasClipboard(): boolean {
  return clipboard.length > 0;
}

// Shortcut display helper
export const SHORTCUT_MAP = {
  delete: 'Del',
  copy: 'Ctrl+C',
  paste: 'Ctrl+V',
  cut: 'Ctrl+X',
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Shift+Z',
  selectAll: 'Ctrl+A',
  deselect: 'Esc',
  duplicate: 'Ctrl+D',
  bringForward: 'Ctrl+]',
  sendBackward: 'Ctrl+[',
  bringToFront: 'Ctrl+Shift+]',
  sendToBack: 'Ctrl+Shift+[',
  zoomIn: 'Ctrl++',
  zoomOut: 'Ctrl+-',
  zoomReset: 'Ctrl+0',
  toggleGrid: 'Ctrl+G',
  save: 'Ctrl+S',
  export: 'Ctrl+E',
  nudge: '←↑↓→',
  nudgeLarge: 'Shift+←↑↓→',
};

export default useKeyboardShortcuts;
