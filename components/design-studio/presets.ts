// =============================================================================
// TEXT PRESETS - Quick text styles for common use cases
// =============================================================================

import type { DesignElement } from './types';
import { generateId } from './types';

export interface TextPreset {
  id: string;
  name: string;
  preview: string;
  styles: Partial<DesignElement>;
}

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: 'headline',
    name: 'Headline',
    preview: 'HEADLINE',
    styles: {
      fontSize: 72,
      fontWeight: 'bold',
      fontFamily: 'Inter, system-ui, sans-serif',
      textAlign: 'center',
      color: '#ffffff',
    },
  },
  {
    id: 'subheadline',
    name: 'Subheadline',
    preview: 'Subheadline',
    styles: {
      fontSize: 36,
      fontWeight: 'normal',
      fontFamily: 'Inter, system-ui, sans-serif',
      textAlign: 'center',
      color: '#ffffffcc',
    },
  },
  {
    id: 'body',
    name: 'Body Text',
    preview: 'Body text for descriptions',
    styles: {
      fontSize: 24,
      fontWeight: 'normal',
      fontFamily: 'Inter, system-ui, sans-serif',
      textAlign: 'center',
      color: '#ffffffbb',
    },
  },
  {
    id: 'accent',
    name: 'Accent',
    preview: '$99',
    styles: {
      fontSize: 48,
      fontWeight: 'bold',
      fontFamily: 'Inter, system-ui, sans-serif',
      textAlign: 'center',
      color: '#fbbf24',
    },
  },
  {
    id: 'cta',
    name: 'Call to Action',
    preview: 'REGISTER NOW',
    styles: {
      fontSize: 28,
      fontWeight: 'bold',
      fontFamily: 'Inter, system-ui, sans-serif',
      textAlign: 'center',
      color: '#ffffff',
    },
  },
  {
    id: 'caption',
    name: 'Caption',
    preview: 'Small caption text',
    styles: {
      fontSize: 16,
      fontWeight: 'normal',
      fontFamily: 'Inter, system-ui, sans-serif',
      textAlign: 'center',
      color: '#ffffffaa',
    },
  },
  {
    id: 'bold-impact',
    name: 'Bold Impact',
    preview: 'IMPACT',
    styles: {
      fontSize: 64,
      fontWeight: 'bold',
      fontFamily: 'Impact, sans-serif',
      textAlign: 'center',
      color: '#ffffff',
      letterSpacing: 2,
    },
  },
  {
    id: 'elegant',
    name: 'Elegant',
    preview: 'Elegant Style',
    styles: {
      fontSize: 40,
      fontWeight: 'normal',
      fontStyle: 'italic',
      fontFamily: 'Georgia, serif',
      textAlign: 'center',
      color: '#ffffff',
    },
  },
];

// Quick shape presets
export interface ShapePreset {
  id: string;
  name: string;
  icon: string;
  styles: Partial<DesignElement>;
}

export const SHAPE_PRESETS: ShapePreset[] = [
  {
    id: 'button-primary',
    name: 'Primary Button',
    icon: '🔵',
    styles: {
      shapeType: 'rectangle',
      backgroundColor: '#8b5cf6',
      borderRadius: 30,
      size: { width: 300, height: 60 },
    },
  },
  {
    id: 'button-secondary',
    name: 'Secondary Button',
    icon: '⚪',
    styles: {
      shapeType: 'rectangle',
      backgroundColor: '#ffffff',
      borderRadius: 30,
      size: { width: 300, height: 60 },
    },
  },
  {
    id: 'badge',
    name: 'Badge',
    icon: '🏷️',
    styles: {
      shapeType: 'rectangle',
      backgroundColor: '#fbbf24',
      borderRadius: 20,
      size: { width: 200, height: 40 },
    },
  },
  {
    id: 'divider',
    name: 'Divider Line',
    icon: '➖',
    styles: {
      shapeType: 'rectangle',
      backgroundColor: '#ffffff44',
      borderRadius: 2,
      size: { width: 400, height: 4 },
    },
  },
  {
    id: 'card',
    name: 'Card Background',
    icon: '📄',
    styles: {
      shapeType: 'rectangle',
      backgroundColor: '#ffffff11',
      borderRadius: 16,
      size: { width: 400, height: 300 },
    },
  },
  {
    id: 'circle-accent',
    name: 'Circle Accent',
    icon: '⭕',
    styles: {
      shapeType: 'circle',
      backgroundColor: '#8b5cf644',
      size: { width: 200, height: 200 },
    },
  },
];

// Color palettes for quick styling
export interface ColorPalette {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
}

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'sports-classic',
    name: 'Sports Classic',
    colors: {
      primary: '#1e3a5f',
      secondary: '#2d5a8a',
      accent: '#fbbf24',
      background: '#1e3a5f',
      text: '#ffffff',
    },
  },
  {
    id: 'midnight-purple',
    name: 'Midnight Purple',
    colors: {
      primary: '#1e1b4b',
      secondary: '#312e81',
      accent: '#a78bfa',
      background: '#1e1b4b',
      text: '#ffffff',
    },
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    colors: {
      primary: '#064e3b',
      secondary: '#065f46',
      accent: '#34d399',
      background: '#064e3b',
      text: '#ffffff',
    },
  },
  {
    id: 'fire-red',
    name: 'Fire Red',
    colors: {
      primary: '#7f1d1d',
      secondary: '#991b1b',
      accent: '#fbbf24',
      background: '#7f1d1d',
      text: '#ffffff',
    },
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    colors: {
      primary: '#0c4a6e',
      secondary: '#075985',
      accent: '#38bdf8',
      background: '#0c4a6e',
      text: '#ffffff',
    },
  },
  {
    id: 'dark-mode',
    name: 'Dark Mode',
    colors: {
      primary: '#171717',
      secondary: '#262626',
      accent: '#ffffff',
      background: '#171717',
      text: '#ffffff',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: {
      primary: '#422006',
      secondary: '#78350f',
      accent: '#fb923c',
      background: '#422006',
      text: '#ffffff',
    },
  },
  {
    id: 'clean-white',
    name: 'Clean White',
    colors: {
      primary: '#ffffff',
      secondary: '#f1f5f9',
      accent: '#8b5cf6',
      background: '#ffffff',
      text: '#1e293b',
    },
  },
];

// Sport-specific icons for quick add
export const SPORT_ICONS = [
  { emoji: '🏈', name: 'Football' },
  { emoji: '🏀', name: 'Basketball' },
  { emoji: '⚾', name: 'Baseball' },
  { emoji: '⚽', name: 'Soccer' },
  { emoji: '🏒', name: 'Hockey' },
  { emoji: '🏐', name: 'Volleyball' },
  { emoji: '🥍', name: 'Lacrosse' },
  { emoji: '🥎', name: 'Softball' },
  { emoji: '🎾', name: 'Tennis' },
  { emoji: '🏊', name: 'Swimming' },
  { emoji: '🤼', name: 'Wrestling' },
  { emoji: '🏃', name: 'Track' },
  { emoji: '📣', name: 'Cheerleading' },
  { emoji: '🏆', name: 'Trophy' },
  { emoji: '⭐', name: 'Star' },
  { emoji: '🎯', name: 'Target' },
  { emoji: '💪', name: 'Strength' },
  { emoji: '🔥', name: 'Fire' },
];

// Common phrases for quick add
export const QUICK_PHRASES = [
  'REGISTER NOW',
  'JOIN US',
  'GAME DAY',
  'TRYOUTS',
  'SIGN UP TODAY',
  'LIMITED SPOTS',
  'FREE ADMISSION',
  'SAVE THE DATE',
  'COMING SOON',
  "DON'T MISS OUT",
  'FAMILY EVENT',
  'ALL AGES WELCOME',
];
