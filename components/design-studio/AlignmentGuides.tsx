import React from 'react';
import { DesignElement as ElementType } from './types';

interface AlignmentGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  label?: string;
}

interface AlignmentGuidesProps {
  guides: AlignmentGuide[];
  zoom: number;
  canvasOffset: { x: number; y: number };
}

export const AlignmentGuides: React.FC<AlignmentGuidesProps> = ({
  guides,
  zoom,
  canvasOffset,
}) => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible z-50">
      {guides.map((guide, index) => (
        <div
          key={`${guide.type}-${guide.position}-${index}`}
          className={`absolute ${
            guide.type === 'vertical'
              ? 'w-px h-full bg-pink-500'
              : 'h-px w-full bg-pink-500'
          }`}
          style={{
            ...(guide.type === 'vertical'
              ? { left: `${guide.position * zoom + canvasOffset.x}px`, top: 0 }
              : { top: `${guide.position * zoom + canvasOffset.y}px`, left: 0 }),
            boxShadow: guide.type === 'vertical'
              ? '0 0 4px rgba(236, 72, 153, 0.8)'
              : '0 0 4px rgba(236, 72, 153, 0.8)',
          }}
        >
          {guide.label && (
            <span
              className="absolute text-[10px] text-pink-500 bg-gray-900/80 px-1 rounded"
              style={{
                ...(guide.type === 'vertical'
                  ? { top: '4px', left: '4px' }
                  : { left: '4px', top: '-14px' }),
              }}
            >
              {guide.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

// Snap calculation utilities
export const SNAP_THRESHOLD = 8; // pixels
export const GRID_SIZE = 10; // pixels

export interface SnapResult {
  x: number;
  y: number;
  guides: AlignmentGuide[];
}

export function calculateSnap(
  element: { x: number; y: number; width: number; height: number },
  otherElements: ElementType[],
  canvasWidth: number,
  canvasHeight: number,
  gridSnap: boolean = true
): SnapResult {
  const guides: AlignmentGuide[] = [];
  let { x, y } = element;
  
  const elementCenterX = x + element.width / 2;
  const elementCenterY = y + element.height / 2;
  const elementRight = x + element.width;
  const elementBottom = y + element.height;
  
  // Canvas center guides
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;
  
  // Check canvas center X
  if (Math.abs(elementCenterX - canvasCenterX) < SNAP_THRESHOLD) {
    x = canvasCenterX - element.width / 2;
    guides.push({ type: 'vertical', position: canvasCenterX, label: 'Center' });
  }
  
  // Check canvas center Y
  if (Math.abs(elementCenterY - canvasCenterY) < SNAP_THRESHOLD) {
    y = canvasCenterY - element.height / 2;
    guides.push({ type: 'horizontal', position: canvasCenterY, label: 'Center' });
  }
  
  // Check canvas edges
  if (Math.abs(x) < SNAP_THRESHOLD) {
    x = 0;
    guides.push({ type: 'vertical', position: 0 });
  }
  if (Math.abs(y) < SNAP_THRESHOLD) {
    y = 0;
    guides.push({ type: 'horizontal', position: 0 });
  }
  if (Math.abs(elementRight - canvasWidth) < SNAP_THRESHOLD) {
    x = canvasWidth - element.width;
    guides.push({ type: 'vertical', position: canvasWidth });
  }
  if (Math.abs(elementBottom - canvasHeight) < SNAP_THRESHOLD) {
    y = canvasHeight - element.height;
    guides.push({ type: 'horizontal', position: canvasHeight });
  }
  
  // Check alignment with other elements
  for (const other of otherElements) {
    const otherCenterX = other.position.x + other.size.width / 2;
    const otherCenterY = other.position.y + other.size.height / 2;
    const otherRight = other.position.x + other.size.width;
    const otherBottom = other.position.y + other.size.height;
    
    // Left edge alignment
    if (Math.abs(x - other.position.x) < SNAP_THRESHOLD) {
      x = other.position.x;
      guides.push({ type: 'vertical', position: other.position.x });
    }
    // Right edge alignment
    if (Math.abs(elementRight - otherRight) < SNAP_THRESHOLD) {
      x = otherRight - element.width;
      guides.push({ type: 'vertical', position: otherRight });
    }
    // Left to right alignment
    if (Math.abs(x - otherRight) < SNAP_THRESHOLD) {
      x = otherRight;
      guides.push({ type: 'vertical', position: otherRight });
    }
    // Right to left alignment
    if (Math.abs(elementRight - other.position.x) < SNAP_THRESHOLD) {
      x = other.position.x - element.width;
      guides.push({ type: 'vertical', position: other.position.x });
    }
    // Center X alignment
    if (Math.abs(elementCenterX - otherCenterX) < SNAP_THRESHOLD) {
      x = otherCenterX - element.width / 2;
      guides.push({ type: 'vertical', position: otherCenterX });
    }
    
    // Top edge alignment
    if (Math.abs(y - other.position.y) < SNAP_THRESHOLD) {
      y = other.position.y;
      guides.push({ type: 'horizontal', position: other.position.y });
    }
    // Bottom edge alignment
    if (Math.abs(elementBottom - otherBottom) < SNAP_THRESHOLD) {
      y = otherBottom - element.height;
      guides.push({ type: 'horizontal', position: otherBottom });
    }
    // Top to bottom alignment
    if (Math.abs(y - otherBottom) < SNAP_THRESHOLD) {
      y = otherBottom;
      guides.push({ type: 'horizontal', position: otherBottom });
    }
    // Bottom to top alignment
    if (Math.abs(elementBottom - other.position.y) < SNAP_THRESHOLD) {
      y = other.position.y - element.height;
      guides.push({ type: 'horizontal', position: other.position.y });
    }
    // Center Y alignment
    if (Math.abs(elementCenterY - otherCenterY) < SNAP_THRESHOLD) {
      y = otherCenterY - element.height / 2;
      guides.push({ type: 'horizontal', position: otherCenterY });
    }
  }
  
  // Grid snap (if no other snaps and grid is enabled)
  if (gridSnap && guides.length === 0) {
    x = Math.round(x / GRID_SIZE) * GRID_SIZE;
    y = Math.round(y / GRID_SIZE) * GRID_SIZE;
  }
  
  return { x, y, guides };
}

// Distribution utilities
export function distributeHorizontally(elements: ElementType[]): ElementType[] {
  if (elements.length < 3) return elements;
  
  const sorted = [...elements].sort((a, b) => a.position.x - b.position.x);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalWidth = last.position.x + last.size.width - first.position.x;
  const totalElementWidth = elements.reduce((sum, el) => sum + el.size.width, 0);
  const spacing = (totalWidth - totalElementWidth) / (elements.length - 1);
  
  let currentX = first.position.x;
  return sorted.map((el, i) => {
    const newX = i === 0 ? el.position.x : currentX;
    const newEl = { ...el, position: { ...el.position, x: newX } };
    currentX = newX + el.size.width + spacing;
    return newEl;
  });
}

export function distributeVertically(elements: ElementType[]): ElementType[] {
  if (elements.length < 3) return elements;
  
  const sorted = [...elements].sort((a, b) => a.position.y - b.position.y);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalHeight = last.position.y + last.size.height - first.position.y;
  const totalElementHeight = elements.reduce((sum, el) => sum + el.size.height, 0);
  const spacing = (totalHeight - totalElementHeight) / (elements.length - 1);
  
  let currentY = first.position.y;
  return sorted.map((el, i) => {
    const newY = i === 0 ? el.position.y : currentY;
    const newEl = { ...el, position: { ...el.position, y: newY } };
    currentY = newY + el.size.height + spacing;
    return newEl;
  });
}

// Alignment utilities
export function alignElements(
  elements: ElementType[],
  alignment: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom'
): ElementType[] {
  if (elements.length < 2) return elements;
  
  switch (alignment) {
    case 'left': {
      const minX = Math.min(...elements.map(el => el.position.x));
      return elements.map(el => ({ ...el, position: { ...el.position, x: minX } }));
    }
    case 'center-h': {
      const centerX = elements.reduce((sum, el) => sum + el.position.x + el.size.width / 2, 0) / elements.length;
      return elements.map(el => ({ ...el, position: { ...el.position, x: centerX - el.size.width / 2 } }));
    }
    case 'right': {
      const maxRight = Math.max(...elements.map(el => el.position.x + el.size.width));
      return elements.map(el => ({ ...el, position: { ...el.position, x: maxRight - el.size.width } }));
    }
    case 'top': {
      const minY = Math.min(...elements.map(el => el.position.y));
      return elements.map(el => ({ ...el, position: { ...el.position, y: minY } }));
    }
    case 'center-v': {
      const centerY = elements.reduce((sum, el) => sum + el.position.y + el.size.height / 2, 0) / elements.length;
      return elements.map(el => ({ ...el, position: { ...el.position, y: centerY - el.size.height / 2 } }));
    }
    case 'bottom': {
      const maxBottom = Math.max(...elements.map(el => el.position.y + el.size.height));
      return elements.map(el => ({ ...el, position: { ...el.position, y: maxBottom - el.size.height } }));
    }
    default:
      return elements;
  }
}

export default AlignmentGuides;
