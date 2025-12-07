import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Event, FlierTemplate } from '../../types/events';
import QRCode from 'qrcode';

// Flier dimensions (standard social media sizes)
const FLIER_SIZES = {
  instagram: { width: 1080, height: 1080, label: 'Instagram (1:1)' },
  instagramStory: { width: 1080, height: 1920, label: 'Instagram Story (9:16)' },
  facebook: { width: 1200, height: 630, label: 'Facebook (1.91:1)' },
  twitter: { width: 1200, height: 675, label: 'Twitter (16:9)' },
  print: { width: 2550, height: 3300, label: 'Print (8.5x11)' },
};

type FlierSize = keyof typeof FLIER_SIZES;

export interface FlierData {
  size: FlierSize;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  headerImage?: string;
  teamLogo?: string;
  eventTitle: string;
  eventDate: string;
  eventTime?: string;
  eventLocation: string;
  eventDescription?: string;
  pricingInfo?: string;
  includedItems?: string[];
  customMessage?: string;
  showQRCode: boolean;
  qrCodeUrl: string;
  templateId: string;
}

interface FlierEditorProps {
  event: Event;
  teamLogo?: string;
  teamColors?: { primary: string; secondary: string };
  registrationUrl: string;
  onSave?: (flierData: FlierData, imageDataUrl: string) => void;
}

export const FlierEditor: React.FC<FlierEditorProps> = ({
  event,
  teamLogo,
  teamColors,
  registrationUrl,
  onSave
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [headerImageLoaded, setHeaderImageLoaded] = useState<HTMLImageElement | null>(null);
  const [logoImageLoaded, setLogoImageLoaded] = useState<HTMLImageElement | null>(null);

  // Flier data state
  const [flierData, setFlierData] = useState<FlierData>({
    size: 'instagram',
    backgroundColor: teamColors?.primary || '#1e3a5f',
    accentColor: teamColors?.secondary || '#f59e0b',
    textColor: '#ffffff',
    teamLogo: teamLogo,
    eventTitle: event.title,
    eventDate: formatEventDate(event.eventStartDate.toDate(), event.eventEndDate.toDate()),
    eventTime: '',
    eventLocation: event.location.name || '',
    eventDescription: event.description?.slice(0, 150),
    pricingInfo: '',
    includedItems: event.includedItems,
    customMessage: '',
    showQRCode: true,
    qrCodeUrl: registrationUrl,
    templateId: 'modern',
  });

  // Generate QR code
  useEffect(() => {
    if (flierData.showQRCode && flierData.qrCodeUrl) {
      QRCode.toDataURL(flierData.qrCodeUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }).then(setQrCodeDataUrl).catch(console.error);
    }
  }, [flierData.showQRCode, flierData.qrCodeUrl]);

  // Load header image
  useEffect(() => {
    if (flierData.headerImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setHeaderImageLoaded(img);
      img.src = flierData.headerImage;
    } else {
      setHeaderImageLoaded(null);
    }
  }, [flierData.headerImage]);

  // Load logo image
  useEffect(() => {
    if (flierData.teamLogo) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setLogoImageLoaded(img);
      img.src = flierData.teamLogo;
    } else {
      setLogoImageLoaded(null);
    }
  }, [flierData.teamLogo]);

  // Render flier on canvas
  const renderFlier = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsRendering(true);
    const { width, height } = FLIER_SIZES[flierData.size];
    
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = flierData.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Render based on template
    switch (flierData.templateId) {
      case 'classic':
        renderClassicTemplate(ctx, width, height);
        break;
      case 'modern':
        renderModernTemplate(ctx, width, height);
        break;
      case 'bold':
        renderBoldTemplate(ctx, width, height);
        break;
      case 'minimal':
        renderMinimalTemplate(ctx, width, height);
        break;
      default:
        renderModernTemplate(ctx, width, height);
    }

    setIsRendering(false);
  }, [flierData, qrCodeDataUrl, headerImageLoaded, logoImageLoaded]);

  // Render when data changes
  useEffect(() => {
    renderFlier();
  }, [renderFlier]);

  // Classic Template - Traditional sports flier
  const renderClassicTemplate = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const padding = width * 0.05;
    const scale = width / 1080;

    // Accent header bar
    ctx.fillStyle = flierData.accentColor;
    ctx.fillRect(0, 0, width, height * 0.15);

    // Logo in header
    if (logoImageLoaded) {
      const logoSize = height * 0.1;
      ctx.drawImage(logoImageLoaded, padding, height * 0.025, logoSize, logoSize);
    }

    // Event title
    ctx.fillStyle = flierData.textColor;
    ctx.font = `bold ${60 * scale}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    wrapText(ctx, flierData.eventTitle.toUpperCase(), width / 2, height * 0.25, width - padding * 2, 70 * scale);

    // Divider line
    ctx.strokeStyle = flierData.accentColor;
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.moveTo(padding * 2, height * 0.35);
    ctx.lineTo(width - padding * 2, height * 0.35);
    ctx.stroke();

    // Date & Time
    ctx.font = `bold ${40 * scale}px Arial, sans-serif`;
    ctx.fillText(flierData.eventDate, width / 2, height * 0.45);
    if (flierData.eventTime) {
      ctx.font = `${32 * scale}px Arial, sans-serif`;
      ctx.fillText(flierData.eventTime, width / 2, height * 0.52);
    }

    // Location
    ctx.font = `${32 * scale}px Arial, sans-serif`;
    ctx.fillText(`📍 ${flierData.eventLocation}`, width / 2, height * 0.62);

    // Pricing
    if (flierData.pricingInfo) {
      ctx.font = `bold ${36 * scale}px Arial, sans-serif`;
      ctx.fillStyle = flierData.accentColor;
      ctx.fillText(flierData.pricingInfo, width / 2, height * 0.72);
    }

    // QR Code
    if (flierData.showQRCode && qrCodeDataUrl) {
      const qrImg = new Image();
      qrImg.src = qrCodeDataUrl;
      const qrSize = 150 * scale;
      ctx.drawImage(qrImg, width / 2 - qrSize / 2, height * 0.78, qrSize, qrSize);
      
      ctx.fillStyle = flierData.textColor;
      ctx.font = `${20 * scale}px Arial, sans-serif`;
      ctx.fillText('Scan to Register', width / 2, height * 0.95);
    }
  };

  // Modern Template - Clean, contemporary design
  const renderModernTemplate = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const padding = width * 0.06;
    const scale = width / 1080;

    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, flierData.backgroundColor);
    gradient.addColorStop(1, adjustColor(flierData.backgroundColor, -30));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Header image with overlay
    if (headerImageLoaded) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(headerImageLoaded, 0, 0, width, height * 0.4);
      ctx.globalAlpha = 1;
    }

    // Accent shape
    ctx.fillStyle = flierData.accentColor;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.35);
    ctx.lineTo(width * 0.3, height * 0.35);
    ctx.lineTo(width * 0.35, height * 0.4);
    ctx.lineTo(0, height * 0.4);
    ctx.closePath();
    ctx.fill();

    // Logo
    if (logoImageLoaded) {
      const logoSize = 100 * scale;
      ctx.drawImage(logoImageLoaded, padding, padding, logoSize, logoSize);
    }

    // Event title
    ctx.fillStyle = flierData.textColor;
    ctx.font = `bold ${56 * scale}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    wrapText(ctx, flierData.eventTitle, padding, height * 0.48, width - padding * 2, 65 * scale);

    // Date box
    ctx.fillStyle = flierData.accentColor;
    roundRect(ctx, padding, height * 0.58, width * 0.45, height * 0.12, 10 * scale);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${28 * scale}px Arial, sans-serif`;
    ctx.fillText('📅 ' + flierData.eventDate, padding + 20 * scale, height * 0.65);
    if (flierData.eventTime) {
      ctx.font = `${24 * scale}px Arial, sans-serif`;
      ctx.fillText('🕐 ' + flierData.eventTime, padding + 20 * scale, height * 0.68);
    }

    // Location
    ctx.fillStyle = flierData.textColor;
    ctx.font = `${28 * scale}px Arial, sans-serif`;
    ctx.fillText('📍 ' + flierData.eventLocation, padding, height * 0.76);

    // Included items
    if (flierData.includedItems && flierData.includedItems.length > 0) {
      ctx.font = `${22 * scale}px Arial, sans-serif`;
      ctx.fillStyle = adjustColor(flierData.textColor, -40);
      const itemsText = 'Includes: ' + flierData.includedItems.slice(0, 3).join(' • ');
      ctx.fillText(itemsText, padding, height * 0.82);
    }

    // QR Code area
    if (flierData.showQRCode && qrCodeDataUrl) {
      const qrImg = new Image();
      qrImg.src = qrCodeDataUrl;
      const qrSize = 120 * scale;
      
      // White background for QR
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, width - padding - qrSize - 20 * scale, height * 0.85 - qrSize - 30 * scale, qrSize + 40 * scale, qrSize + 60 * scale, 10 * scale);
      ctx.fill();
      
      ctx.drawImage(qrImg, width - padding - qrSize, height * 0.85 - qrSize - 10 * scale, qrSize, qrSize);
      
      ctx.fillStyle = '#333333';
      ctx.font = `bold ${16 * scale}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('REGISTER', width - padding - qrSize / 2, height * 0.88);
    }

    // Custom message
    if (flierData.customMessage) {
      ctx.fillStyle = flierData.accentColor;
      ctx.font = `italic ${24 * scale}px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(flierData.customMessage, padding, height * 0.95);
    }
  };

  // Bold Template - High contrast, attention-grabbing
  const renderBoldTemplate = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const scale = width / 1080;

    // Split background
    ctx.fillStyle = flierData.accentColor;
    ctx.fillRect(0, 0, width, height * 0.5);
    ctx.fillStyle = flierData.backgroundColor;
    ctx.fillRect(0, height * 0.5, width, height * 0.5);

    // Large diagonal stripe
    ctx.fillStyle = flierData.backgroundColor;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.4);
    ctx.lineTo(width, height * 0.3);
    ctx.lineTo(width, height * 0.5);
    ctx.lineTo(0, height * 0.6);
    ctx.closePath();
    ctx.fill();

    // Event title - large and bold
    ctx.fillStyle = flierData.textColor;
    ctx.font = `bold ${80 * scale}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    wrapText(ctx, flierData.eventTitle.toUpperCase(), width / 2, height * 0.2, width * 0.9, 90 * scale);

    // Date in accent box
    ctx.fillStyle = flierData.textColor;
    ctx.font = `bold ${48 * scale}px Arial, sans-serif`;
    ctx.fillText(flierData.eventDate, width / 2, height * 0.52);

    // Location
    ctx.font = `${32 * scale}px Arial, sans-serif`;
    ctx.fillText(flierData.eventLocation, width / 2, height * 0.62);

    // Pricing - large
    if (flierData.pricingInfo) {
      ctx.fillStyle = flierData.accentColor;
      ctx.font = `bold ${56 * scale}px Arial, sans-serif`;
      ctx.fillText(flierData.pricingInfo, width / 2, height * 0.75);
    }

    // Logo bottom right
    if (logoImageLoaded) {
      const logoSize = 80 * scale;
      ctx.drawImage(logoImageLoaded, width - logoSize - 40 * scale, height - logoSize - 40 * scale, logoSize, logoSize);
    }

    // QR bottom left
    if (flierData.showQRCode && qrCodeDataUrl) {
      const qrImg = new Image();
      qrImg.src = qrCodeDataUrl;
      const qrSize = 100 * scale;
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(30 * scale, height - qrSize - 50 * scale, qrSize + 20 * scale, qrSize + 40 * scale);
      ctx.drawImage(qrImg, 40 * scale, height - qrSize - 40 * scale, qrSize, qrSize);
      
      ctx.fillStyle = '#333333';
      ctx.font = `bold ${14 * scale}px Arial, sans-serif`;
      ctx.fillText('SCAN ME', 40 * scale + qrSize / 2, height - 25 * scale);
    }
  };

  // Minimal Template - Simple and elegant
  const renderMinimalTemplate = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const padding = width * 0.1;
    const scale = width / 1080;

    // Clean white/light background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Thin accent line at top
    ctx.fillStyle = flierData.accentColor;
    ctx.fillRect(0, 0, width, 8 * scale);

    // Logo centered at top
    if (logoImageLoaded) {
      const logoSize = 120 * scale;
      ctx.drawImage(logoImageLoaded, width / 2 - logoSize / 2, padding, logoSize, logoSize);
    }

    // Event title
    ctx.fillStyle = flierData.backgroundColor;
    ctx.font = `300 ${44 * scale}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    wrapText(ctx, flierData.eventTitle, width / 2, height * 0.35, width - padding * 2, 52 * scale);

    // Thin divider
    ctx.strokeStyle = '#e5e5e5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, height * 0.45);
    ctx.lineTo(width - padding, height * 0.45);
    ctx.stroke();

    // Date
    ctx.fillStyle = '#333333';
    ctx.font = `${28 * scale}px Arial, sans-serif`;
    ctx.fillText(flierData.eventDate, width / 2, height * 0.55);

    // Location
    ctx.fillStyle = '#666666';
    ctx.font = `${24 * scale}px Arial, sans-serif`;
    ctx.fillText(flierData.eventLocation, width / 2, height * 0.62);

    // Pricing
    if (flierData.pricingInfo) {
      ctx.fillStyle = flierData.accentColor;
      ctx.font = `500 ${32 * scale}px Arial, sans-serif`;
      ctx.fillText(flierData.pricingInfo, width / 2, height * 0.72);
    }

    // QR Code
    if (flierData.showQRCode && qrCodeDataUrl) {
      const qrImg = new Image();
      qrImg.src = qrCodeDataUrl;
      const qrSize = 140 * scale;
      ctx.drawImage(qrImg, width / 2 - qrSize / 2, height * 0.78, qrSize, qrSize);
      
      ctx.fillStyle = '#999999';
      ctx.font = `${18 * scale}px Arial, sans-serif`;
      ctx.fillText('Scan to register', width / 2, height * 0.96);
    }

    // Bottom accent line
    ctx.fillStyle = flierData.accentColor;
    ctx.fillRect(0, height - 8 * scale, width, 8 * scale);
  };

  // Export flier as image
  const exportFlier = (format: 'png' | 'jpg' = 'png') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const dataUrl = canvas.toDataURL(mimeType, 0.95);
    
    // Create download link
    const link = document.createElement('a');
    link.download = `${flierData.eventTitle.replace(/\s+/g, '_')}_flier.${format}`;
    link.href = dataUrl;
    link.click();
  };

  // Handle save
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !onSave) return;

    const dataUrl = canvas.toDataURL('image/png', 0.95);
    onSave(flierData, dataUrl);
  };

  // Update flier data
  const updateFlierData = (updates: Partial<FlierData>) => {
    setFlierData(prev => ({ ...prev, ...updates }));
  };

  // Handle header image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'header' | 'logo') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (type === 'header') {
        updateFlierData({ headerImage: dataUrl });
      } else {
        updateFlierData({ teamLogo: dataUrl });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Canvas Preview */}
      <div className="flex-1">
        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 flex items-center justify-center min-h-[500px]">
          <div className="relative" style={{ maxWidth: '100%', maxHeight: '600px' }}>
            <canvas
              ref={canvasRef}
              className="shadow-2xl rounded-lg"
              style={{
                maxWidth: '100%',
                maxHeight: '600px',
                objectFit: 'contain',
              }}
            />
            {isRendering && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
              </div>
            )}
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-3 mt-4 justify-center">
          <button
            onClick={() => exportFlier('png')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PNG
          </button>
          <button
            onClick={() => exportFlier('jpg')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download JPG
          </button>
          {onSave && (
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save
            </button>
          )}
        </div>
      </div>

      {/* Editor Controls */}
      <div className="w-full lg:w-80 space-y-4">
        {/* Size Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Flier Size
          </label>
          <select
            value={flierData.size}
            onChange={(e) => updateFlierData({ size: e.target.value as FlierSize })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {Object.entries(FLIER_SIZES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Template Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Template Style
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['classic', 'modern', 'bold', 'minimal'].map((template) => (
              <button
                key={template}
                onClick={() => updateFlierData({ templateId: template })}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  flierData.templateId === template
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {template}
              </button>
            ))}
          </div>
        </div>

        {/* Colors */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Colors</h4>
          
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-400 w-24">Background</label>
            <input
              type="color"
              value={flierData.backgroundColor}
              onChange={(e) => updateFlierData({ backgroundColor: e.target.value })}
              className="w-10 h-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={flierData.backgroundColor}
              onChange={(e) => updateFlierData({ backgroundColor: e.target.value })}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-400 w-24">Accent</label>
            <input
              type="color"
              value={flierData.accentColor}
              onChange={(e) => updateFlierData({ accentColor: e.target.value })}
              className="w-10 h-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={flierData.accentColor}
              onChange={(e) => updateFlierData({ accentColor: e.target.value })}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Content</h4>
          
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Event Title</label>
            <input
              type="text"
              value={flierData.eventTitle}
              onChange={(e) => updateFlierData({ eventTitle: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Date</label>
            <input
              type="text"
              value={flierData.eventDate}
              onChange={(e) => updateFlierData({ eventDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Time (optional)</label>
            <input
              type="text"
              value={flierData.eventTime || ''}
              onChange={(e) => updateFlierData({ eventTime: e.target.value })}
              placeholder="e.g., 9:00 AM - 12:00 PM"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Location</label>
            <input
              type="text"
              value={flierData.eventLocation}
              onChange={(e) => updateFlierData({ eventLocation: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Pricing Info</label>
            <input
              type="text"
              value={flierData.pricingInfo || ''}
              onChange={(e) => updateFlierData({ pricingInfo: e.target.value })}
              placeholder="e.g., $50 per player"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Custom Message</label>
            <input
              type="text"
              value={flierData.customMessage || ''}
              onChange={(e) => updateFlierData({ customMessage: e.target.value })}
              placeholder="e.g., Limited spots available!"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Images */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Images</h4>
          
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Team Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, 'logo')}
              className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-300"
            />
          </div>
          
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Header Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, 'header')}
              className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-300"
            />
          </div>
        </div>

        {/* QR Code Toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Show QR Code
            </span>
            <button
              onClick={() => updateFlierData({ showQRCode: !flierData.showQRCode })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                flierData.showQRCode 
                  ? 'bg-blue-600' 
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                  flierData.showQRCode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
          {flierData.showQRCode && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Links to: {flierData.qrCodeUrl}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions
function formatEventDate(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  
  return `${startStr} - ${endStr}`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[i] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
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
}

function adjustColor(hex: string, amount: number): string {
  const clamp = (val: number) => Math.min(255, Math.max(0, val));
  
  let color = hex.replace('#', '');
  if (color.length === 3) {
    color = color.split('').map(c => c + c).join('');
  }
  
  const r = clamp(parseInt(color.slice(0, 2), 16) + amount);
  const g = clamp(parseInt(color.slice(2, 4), 16) + amount);
  const b = clamp(parseInt(color.slice(4, 6), 16) + amount);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export default FlierEditor;
