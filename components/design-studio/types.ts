// =============================================================================
// DESIGN STUDIO - Types & Interfaces
// World-class flyer designer element system
// =============================================================================

export type ElementType = 'text' | 'image' | 'shape' | 'qrcode' | 'logo' | 'icon';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface DesignElement {
  id: string;
  type: ElementType;
  position: Position;
  size: Size;
  rotation: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  zIndex: number;
  // Type-specific properties
  content?: string; // For text elements
  src?: string; // For image/logo elements
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  // Text-specific
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold' | 'light';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  textDecoration?: 'none' | 'underline' | 'line-through';
  lineHeight?: number;
  letterSpacing?: number;
  textShadow?: string;
  autoScaleFont?: boolean; // Scale font size with element size (for emojis/icons)
  // Shape-specific
  shapeType?: 'rectangle' | 'circle' | 'triangle' | 'line' | 'star' | 'badge';
  // Effects
  shadow?: {
    x: number;
    y: number;
    blur: number;
    color: string;
  };
  gradient?: {
    type: 'linear' | 'radial';
    angle: number;
    stops: { offset: number; color: string }[];
  };
}

export interface CanvasState {
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage?: string;
  backgroundGradient?: {
    type: 'linear' | 'radial';
    angle: number;
    stops: { offset: number; color: string }[];
  };
}

export interface DesignState {
  canvas: CanvasState;
  elements: DesignElement[];
  selectedIds: string[];
  history: {
    past: DesignElement[][];
    future: DesignElement[][];
  };
  zoom: number;
  gridEnabled: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

export interface DragState {
  isDragging: boolean;
  isResizing: boolean;
  resizeHandle: ResizeHandle | null;
  startPosition: Position;
  startElementPosition: Position;
  startElementSize: Size;
}

export type ResizeHandle = 
  | 'top-left' | 'top' | 'top-right'
  | 'left' | 'right'
  | 'bottom-left' | 'bottom' | 'bottom-right';

export interface ToolState {
  activeTool: 'select' | 'text' | 'shape' | 'image' | 'pan';
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'line' | 'star' | 'badge';
}

// Flyer sizes for export
export const FLYER_SIZES = {
  instagram: { width: 1080, height: 1080, label: 'Instagram Post (1:1)', icon: '📷' },
  instagramStory: { width: 1080, height: 1920, label: 'Instagram Story (9:16)', icon: '📱' },
  story: { width: 1080, height: 1920, label: 'Story (9:16)', icon: '📱' }, // Alias for instagramStory
  facebook: { width: 1200, height: 630, label: 'Facebook Post (1.91:1)', icon: '📘' },
  twitter: { width: 1200, height: 675, label: 'Twitter/X (16:9)', icon: '🐦' },
  print: { width: 2550, height: 3300, label: 'Print Flyer (8.5x11)', icon: '🖨️' },
  flyer: { width: 2550, height: 3300, label: 'Flyer (8.5x11)', icon: '🖨️' }, // Alias for print
  poster: { width: 1800, height: 2400, label: 'Poster (18x24)', icon: '📜' },
  banner: { width: 1500, height: 500, label: 'Banner (3:1)', icon: '🏷️' },
} as const;

export type FlyerSize = keyof typeof FLYER_SIZES;

// Design templates
export interface DesignTemplate {
  id: string;
  name: string;
  description: string;
  preview: string;
  category: string;
  canvas: CanvasState;
  elements: DesignElement[];
}

// Font options
export const FONT_FAMILIES = [
  { name: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Open Sans', value: 'Open Sans, sans-serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif' },
  { name: 'Poppins', value: 'Poppins, sans-serif' },
  { name: 'Oswald', value: 'Oswald, sans-serif' },
  { name: 'Bebas Neue', value: 'Bebas Neue, cursive' },
  { name: 'Impact', value: 'Impact, sans-serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Playfair Display', value: 'Playfair Display, serif' },
] as const;

// Helper to generate unique IDs
export const generateId = (): string => {
  return `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Create default element
export const createDefaultElement = (type: ElementType, position: Position): DesignElement => {
  const baseElement: DesignElement = {
    id: generateId(),
    type,
    position,
    size: { width: 200, height: 100 },
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: Date.now(),
  };

  switch (type) {
    case 'text':
      return {
        ...baseElement,
        content: 'Double-click to edit',
        color: '#ffffff',
        fontSize: 32,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 'bold',
        textAlign: 'center',
        size: { width: 300, height: 50 },
      };
    case 'image':
    case 'logo':
      return {
        ...baseElement,
        size: { width: 200, height: 200 },
        borderRadius: type === 'logo' ? 12 : 0,
      };
    case 'shape':
      return {
        ...baseElement,
        shapeType: 'rectangle',
        backgroundColor: '#8b5cf6',
        borderRadius: 8,
        size: { width: 200, height: 100 },
      };
    case 'qrcode':
      return {
        ...baseElement,
        size: { width: 150, height: 150 },
        backgroundColor: '#ffffff',
        borderRadius: 8,
      };
    case 'icon':
      return {
        ...baseElement,
        size: { width: 48, height: 48 },
        color: '#ffffff',
      };
    default:
      return baseElement;
  }
};
