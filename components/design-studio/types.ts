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
  backgroundVisible?: boolean; // false = transparent export (for logos)
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

// Professional tool types - Photoshop-style
export type ActiveTool = 
  | 'select' 
  | 'text' 
  | 'shape' 
  | 'image' 
  | 'pan'
  | 'eyedropper'      // Color picker - sample any color from canvas
  | 'eraser'          // Standard eraser - erase parts of images
  | 'backgroundEraser' // Magic eraser - remove similar colors (like white backgrounds)
  | 'brush'           // Paint brush for drawing
  | 'crop';           // Crop images

export interface ToolState {
  activeTool: ActiveTool;
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'line' | 'star' | 'badge';
  // Brush/Eraser settings
  brushSize: number;
  brushHardness: number; // 0-100, affects edge softness
  brushColor: string;
  // Background eraser settings
  tolerance: number; // 0-255, how similar colors need to be to be erased
  contiguous: boolean; // Only erase connected pixels vs all matching
  // Sampled color from eyedropper
  sampledColor: string | null;
}

// Default tool state
export const DEFAULT_TOOL_STATE: ToolState = {
  activeTool: 'select',
  shapeType: 'rectangle',
  brushSize: 20,
  brushHardness: 100,
  brushColor: '#ffffff',
  tolerance: 32,
  contiguous: true,
  sampledColor: null,
};

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
  // Uniform sizes - optimized aspect ratios for each garment type
  jerseyFront: { width: 800, height: 1000, label: 'Jersey Front', icon: '👕' },
  jerseyBack: { width: 800, height: 1000, label: 'Jersey Back', icon: '👕' },
  shirtFront: { width: 800, height: 900, label: 'T-Shirt Front', icon: '👔' },
  shirtBack: { width: 800, height: 900, label: 'T-Shirt Back', icon: '👔' },
  pantsFront: { width: 600, height: 1200, label: 'Pants Front', icon: '👖' },
  pantsBack: { width: 600, height: 1200, label: 'Pants Back', icon: '👖' },
  shortsFront: { width: 700, height: 600, label: 'Shorts Front', icon: '🩳' },
  shortsBack: { width: 700, height: 600, label: 'Shorts Back', icon: '🩳' },
  socksSide: { width: 300, height: 800, label: 'Socks Side View', icon: '🧦' },
  uniformFull: { width: 800, height: 1600, label: 'Full Uniform', icon: '🏃' },
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
