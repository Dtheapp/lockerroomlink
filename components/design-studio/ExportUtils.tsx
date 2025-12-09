import { DesignElement, FlyerSize, FLYER_SIZES } from './types';

// Export quality options
export type ExportQuality = 'standard' | 'high';

// Quality multipliers
// Standard = 1x (native resolution, e.g., 1080px for social)
// High = 2x (double resolution for print, e.g., 2160px = 4K quality)
export const QUALITY_MULTIPLIERS: Record<ExportQuality, number> = {
  standard: 1,
  high: 2,
};

// Credits cost for high quality export
export const HIGH_QUALITY_EXPORT_CREDITS = 3;

// Get effective resolution for export
export function getExportResolution(size: FlyerSize, quality: ExportQuality): { width: number; height: number } {
  const sizeConfig = FLYER_SIZES[size];
  const multiplier = QUALITY_MULTIPLIERS[quality];
  return {
    width: sizeConfig.width * multiplier,
    height: sizeConfig.height * multiplier,
  };
}

// Export the canvas to an image
export async function exportToImage(
  elements: DesignElement[],
  size: FlyerSize,
  format: 'png' | 'jpeg' = 'png',
  quality: number = 1,
  backgroundColor: string = '#1f2937',
  exportQuality: ExportQuality = 'standard'
): Promise<Blob> {
  // Create a canvas element
  const canvas = document.createElement('canvas');
  const sizeConfig = FLYER_SIZES[size];
  const multiplier = QUALITY_MULTIPLIERS[exportQuality];
  
  // Apply quality multiplier for high-res export
  canvas.width = sizeConfig.width * multiplier;
  canvas.height = sizeConfig.height * multiplier;
  const ctx = canvas.getContext('2d')!;
  
  // Enable high quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Scale context for high-res rendering
  ctx.scale(multiplier, multiplier);
  
  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, sizeConfig.width, sizeConfig.height);
  
  // Sort elements by zIndex
  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  
  // Draw each element
  for (const element of sortedElements) {
    if (!element.visible) continue;
    
    ctx.save();
    
    // Apply rotation if needed
    if (element.rotation) {
      const centerX = element.position.x + element.size.width / 2;
      const centerY = element.position.y + element.size.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((element.rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
    }
    
    // Apply opacity
    ctx.globalAlpha = element.opacity;
    
    switch (element.type) {
      case 'text':
        await drawText(ctx, element);
        break;
      case 'image':
      case 'logo':
        await drawImage(ctx, element);
        break;
      case 'shape':
        drawShape(ctx, element);
        break;
      case 'qrcode':
        await drawQRCode(ctx, element);
        break;
    }
    
    ctx.restore();
  }
  
  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create image blob'));
        }
      },
      `image/${format}`,
      quality
    );
  });
}

async function drawText(ctx: CanvasRenderingContext2D, element: DesignElement) {
  const fontWeight = element.fontWeight || 'normal';
  const fontStyle = element.fontStyle || 'normal';
  const fontSize = element.fontSize || 24;
  const fontFamily = element.fontFamily || 'Arial';
  
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = element.color || '#ffffff';
  ctx.textAlign = (element.textAlign as CanvasTextAlign) || 'left';
  ctx.textBaseline = 'top';
  
  const lines = (element.content || '').split('\n');
  const lineHeight = fontSize * 1.3;
  
  let y = element.position.y;
  for (const line of lines) {
    let x = element.position.x;
    if (element.textAlign === 'center') {
      x = element.position.x + element.size.width / 2;
    } else if (element.textAlign === 'right') {
      x = element.position.x + element.size.width;
    }
    
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
}

async function drawImage(ctx: CanvasRenderingContext2D, element: DesignElement) {
  if (!element.content) return;
  
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, element.position.x, element.position.y, element.size.width, element.size.height);
      resolve();
    };
    img.onerror = () => {
      // Draw placeholder on error
      ctx.fillStyle = '#374151';
      ctx.fillRect(element.position.x, element.position.y, element.size.width, element.size.height);
      ctx.strokeStyle = '#6b7280';
      ctx.strokeRect(element.position.x, element.position.y, element.size.width, element.size.height);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Image', element.position.x + element.size.width / 2, element.position.y + element.size.height / 2);
      resolve();
    };
    img.src = element.content;
  });
}

function drawShape(ctx: CanvasRenderingContext2D, element: DesignElement) {
  const shape = element.shapeType || 'rectangle';
  const fillColor = element.backgroundColor || '#374151';
  const strokeColor = element.borderColor;
  const borderWidth = element.borderWidth || 0;
  const borderRadius = element.borderRadius || 0;
  
  ctx.fillStyle = fillColor;
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = borderWidth;
  }
  
  switch (shape) {
    case 'rectangle':
      if (borderRadius > 0) {
        drawRoundedRect(ctx, element.position.x, element.position.y, element.size.width, element.size.height, borderRadius);
      } else {
        ctx.fillRect(element.position.x, element.position.y, element.size.width, element.size.height);
        if (strokeColor && borderWidth) {
          ctx.strokeRect(element.position.x, element.position.y, element.size.width, element.size.height);
        }
      }
      break;
      
    case 'circle':
      ctx.beginPath();
      ctx.ellipse(
        element.position.x + element.size.width / 2,
        element.position.y + element.size.height / 2,
        element.size.width / 2,
        element.size.height / 2,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      if (strokeColor && borderWidth) {
        ctx.stroke();
      }
      break;
      
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(element.position.x + element.size.width / 2, element.position.y);
      ctx.lineTo(element.position.x + element.size.width, element.position.y + element.size.height);
      ctx.lineTo(element.position.x, element.position.y + element.size.height);
      ctx.closePath();
      ctx.fill();
      if (strokeColor && borderWidth) {
        ctx.stroke();
      }
      break;
      
    case 'line':
      ctx.beginPath();
      ctx.moveTo(element.position.x, element.position.y + element.size.height / 2);
      ctx.lineTo(element.position.x + element.size.width, element.position.y + element.size.height / 2);
      ctx.strokeStyle = fillColor;
      ctx.lineWidth = element.size.height || 2;
      ctx.stroke();
      break;
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

async function drawQRCode(ctx: CanvasRenderingContext2D, element: DesignElement) {
  // QR codes are stored as data URLs in qrData property
  if (!element.src) return;
  
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, element.position.x, element.position.y, element.size.width, element.size.height);
      resolve();
    };
    img.onerror = () => {
      // Draw placeholder
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(element.position.x, element.position.y, element.size.width, element.size.height);
      resolve();
    };
    img.src = element.src;
  });
}

// Download the exported image
export async function downloadImage(
  elements: DesignElement[],
  size: FlyerSize,
  filename: string = 'flyer',
  format: 'png' | 'jpeg' = 'png',
  exportQuality: ExportQuality = 'standard'
) {
  const blob = await exportToImage(elements, size, format, 1, '#1f2937', exportQuality);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  // Add quality suffix to filename
  const qualitySuffix = exportQuality === 'high' ? '_4K' : '';
  link.download = `${filename}${qualitySuffix}.${format}`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export as JSON for saving/loading
export function exportToJSON(elements: DesignElement[], size: FlyerSize): string {
  return JSON.stringify({
    version: '1.0',
    size,
    elements,
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

// Import from JSON
export function importFromJSON(json: string): { elements: DesignElement[]; size: FlyerSize } {
  const data = JSON.parse(json);
  return {
    elements: data.elements || [],
    size: data.size,
  };
}

export default {
  exportToImage,
  downloadImage,
  exportToJSON,
  importFromJSON,
};
