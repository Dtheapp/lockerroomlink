import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GlassCard, Button, Badge } from './ui/OSYSComponents';
import QRCode from 'qrcode';
import { 
  Palette, 
  Type, 
  Image as ImageIcon, 
  Download, 
  Share2, 
  Sparkles,
  Layout,
  QrCode,
  Calendar,
  MapPin,
  DollarSign,
  FileText,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Layers
} from 'lucide-react';

// =============================================================================
// DESIGN STUDIO - Standalone flyer/graphic designer for teams
// =============================================================================

// Flier dimensions (standard social media sizes)
const FLIER_SIZES = {
  instagram: { width: 1080, height: 1080, label: 'Instagram Post (1:1)', icon: '📷' },
  instagramStory: { width: 1080, height: 1920, label: 'Instagram Story (9:16)', icon: '📱' },
  facebook: { width: 1200, height: 630, label: 'Facebook Post (1.91:1)', icon: '📘' },
  twitter: { width: 1200, height: 675, label: 'Twitter/X (16:9)', icon: '🐦' },
  print: { width: 2550, height: 3300, label: 'Print Flyer (8.5x11)', icon: '🖨️' },
};

type FlierSize = keyof typeof FLIER_SIZES;

// Design templates
const TEMPLATES = [
  { id: 'modern', name: 'Modern', description: 'Clean gradient style', preview: '🎨' },
  { id: 'classic', name: 'Classic', description: 'Traditional sports look', preview: '🏆' },
  { id: 'bold', name: 'Bold', description: 'High impact design', preview: '⚡' },
  { id: 'minimal', name: 'Minimal', description: 'Simple & elegant', preview: '✨' },
  { id: 'gameday', name: 'Game Day', description: 'Exciting match promo', preview: '🏀' },
  { id: 'fundraiser', name: 'Fundraiser', description: 'Donation focused', preview: '💰' },
];

// Design categories for the studio
const DESIGN_CATEGORIES = [
  { id: 'event', name: 'Event Flyer', icon: '📅', description: 'Games, practices, meetings' },
  { id: 'fundraiser', name: 'Fundraiser', icon: '💰', description: 'Donation drives, sales' },
  { id: 'registration', name: 'Registration', icon: '📝', description: 'Sign-ups, tryouts' },
  { id: 'announcement', name: 'Announcement', icon: '📢', description: 'News, updates' },
  { id: 'social', name: 'Social Post', icon: '📱', description: 'Instagram, Facebook, X' },
  { id: 'custom', name: 'Custom', icon: '🎨', description: 'Start from scratch' },
];

export interface DesignData {
  category: string;
  size: FlierSize;
  templateId: string;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  headerImage?: string;
  teamLogo?: string;
  title: string;
  subtitle?: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  price?: string;
  bulletPoints?: string[];
  customMessage?: string;
  showQRCode: boolean;
  qrCodeUrl?: string;
  contactInfo?: string;
}

const DesignStudio: React.FC = () => {
  const { teamData, userData } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'category' | 'template' | 'editor'>('category');
  const [isRendering, setIsRendering] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [headerImageLoaded, setHeaderImageLoaded] = useState<HTMLImageElement | null>(null);
  const [logoImageLoaded, setLogoImageLoaded] = useState<HTMLImageElement | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'style' | 'layout'>('content');
  
  // Design data state
  const [designData, setDesignData] = useState<DesignData>({
    category: '',
    size: 'instagram',
    templateId: 'modern',
    backgroundColor: teamData?.primaryColor || '#1e3a5f',
    accentColor: teamData?.secondaryColor || '#8b5cf6',
    textColor: '#ffffff',
    teamLogo: teamData?.logoUrl,
    title: '',
    subtitle: '',
    date: '',
    time: '',
    location: '',
    description: '',
    price: '',
    bulletPoints: [],
    customMessage: '',
    showQRCode: false,
    qrCodeUrl: '',
    contactInfo: '',
  });

  // Generate QR code when URL changes
  useEffect(() => {
    if (designData.showQRCode && designData.qrCodeUrl) {
      QRCode.toDataURL(designData.qrCodeUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      }).then(setQrCodeDataUrl).catch(console.error);
    } else {
      setQrCodeDataUrl(null);
    }
  }, [designData.showQRCode, designData.qrCodeUrl]);

  // Load header image
  useEffect(() => {
    if (designData.headerImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setHeaderImageLoaded(img);
      img.onerror = () => setHeaderImageLoaded(null);
      img.src = designData.headerImage;
    } else {
      setHeaderImageLoaded(null);
    }
  }, [designData.headerImage]);

  // Load team logo
  useEffect(() => {
    if (designData.teamLogo) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setLogoImageLoaded(img);
      img.onerror = () => setLogoImageLoaded(null);
      img.src = designData.teamLogo;
    } else {
      setLogoImageLoaded(null);
    }
  }, [designData.teamLogo]);

  // Text wrapping helper
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
    return currentY;
  };

  // Round rectangle helper
  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // Render the flyer on canvas
  const renderDesign = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsRendering(true);
    const { width, height } = FLIER_SIZES[designData.size];
    
    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = designData.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    const padding = width * 0.06;
    const scale = width / 1080;

    // Add gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Header image if present
    if (headerImageLoaded) {
      const imgHeight = height * 0.35;
      ctx.drawImage(headerImageLoaded, 0, 0, width, imgHeight);
      // Overlay gradient on image
      const imgGradient = ctx.createLinearGradient(0, 0, 0, imgHeight);
      imgGradient.addColorStop(0, 'rgba(0,0,0,0.1)');
      imgGradient.addColorStop(1, designData.backgroundColor);
      ctx.fillStyle = imgGradient;
      ctx.fillRect(0, 0, width, imgHeight);
    }

    // Accent shapes
    ctx.fillStyle = designData.accentColor + '40';
    ctx.beginPath();
    ctx.arc(width * 0.9, height * 0.1, width * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width * 0.1, height * 0.85, width * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Team logo
    if (logoImageLoaded) {
      const logoSize = 80 * scale;
      ctx.save();
      roundRect(ctx, padding, padding, logoSize, logoSize, 12 * scale);
      ctx.clip();
      ctx.drawImage(logoImageLoaded, padding, padding, logoSize, logoSize);
      ctx.restore();
    }

    // Team name badge
    if (teamData?.teamName) {
      ctx.fillStyle = designData.accentColor;
      const teamNameWidth = ctx.measureText(teamData.teamName).width + 40 * scale;
      roundRect(ctx, padding + (logoImageLoaded ? 100 * scale : 0), padding + 20 * scale, teamNameWidth, 40 * scale, 20 * scale);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${18 * scale}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(teamData.teamName.toUpperCase(), padding + (logoImageLoaded ? 120 * scale : 20 * scale), padding + 47 * scale);
    }

    // Main title
    ctx.fillStyle = designData.textColor;
    ctx.font = `bold ${72 * scale}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const titleY = headerImageLoaded ? height * 0.4 : height * 0.25;
    wrapText(ctx, designData.title || 'Your Event Title', width / 2, titleY, width - padding * 2, 80 * scale);

    // Subtitle
    if (designData.subtitle) {
      ctx.font = `${32 * scale}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = designData.textColor + 'cc';
      ctx.fillText(designData.subtitle, width / 2, titleY + 100 * scale);
    }

    // Info section
    let infoY = titleY + (designData.subtitle ? 160 : 100) * scale;

    // Date & Time
    if (designData.date) {
      ctx.fillStyle = designData.accentColor;
      roundRect(ctx, width / 2 - 200 * scale, infoY, 400 * scale, 50 * scale, 25 * scale);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${24 * scale}px Inter, system-ui, sans-serif`;
      const dateText = designData.time ? `📅 ${designData.date}  •  🕐 ${designData.time}` : `📅 ${designData.date}`;
      ctx.fillText(dateText, width / 2, infoY + 33 * scale);
      infoY += 70 * scale;
    }

    // Location
    if (designData.location) {
      ctx.fillStyle = designData.textColor + 'dd';
      ctx.font = `${28 * scale}px Inter, system-ui, sans-serif`;
      ctx.fillText(`📍 ${designData.location}`, width / 2, infoY + 30 * scale);
      infoY += 60 * scale;
    }

    // Price
    if (designData.price) {
      ctx.fillStyle = designData.accentColor;
      ctx.font = `bold ${36 * scale}px Inter, system-ui, sans-serif`;
      ctx.fillText(designData.price, width / 2, infoY + 40 * scale);
      infoY += 70 * scale;
    }

    // Description
    if (designData.description) {
      ctx.fillStyle = designData.textColor + 'bb';
      ctx.font = `${24 * scale}px Inter, system-ui, sans-serif`;
      wrapText(ctx, designData.description, width / 2, infoY + 30 * scale, width - padding * 4, 32 * scale);
    }

    // QR Code
    if (designData.showQRCode && qrCodeDataUrl) {
      const qrImg = new Image();
      qrImg.onload = () => {
        const qrSize = 120 * scale;
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, width - padding - qrSize - 10 * scale, height - padding - qrSize - 10 * scale, qrSize + 20 * scale, qrSize + 20 * scale, 12 * scale);
        ctx.fill();
        ctx.drawImage(qrImg, width - padding - qrSize, height - padding - qrSize, qrSize, qrSize);
        
        ctx.fillStyle = designData.textColor + 'aa';
        ctx.font = `${14 * scale}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText('Scan to register', width - padding, height - padding - qrSize - 20 * scale);
      };
      qrImg.src = qrCodeDataUrl;
    }

    // Custom message / CTA at bottom
    if (designData.customMessage) {
      ctx.fillStyle = designData.textColor + 'cc';
      ctx.font = `italic ${22 * scale}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(designData.customMessage, width / 2, height - padding - 20 * scale);
    }

    setIsRendering(false);
  }, [designData, qrCodeDataUrl, headerImageLoaded, logoImageLoaded, teamData]);

  // Re-render when data changes
  useEffect(() => {
    if (step === 'editor') {
      renderDesign();
    }
  }, [renderDesign, step]);

  // Download the flyer
  const handleDownload = (format: 'png' | 'jpg') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `${designData.title || 'design'}-${designData.size}.${format}`;
    link.href = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
    link.click();
  };

  // Handle image upload
  const handleImageUpload = (type: 'header' | 'logo') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (type === 'header') {
        setDesignData(prev => ({ ...prev, headerImage: dataUrl }));
      } else {
        setDesignData(prev => ({ ...prev, teamLogo: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Category selection step
  const renderCategoryStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Design Studio</h1>
        <p className="text-slate-400">Create professional graphics for your team in minutes</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {DESIGN_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setDesignData(prev => ({ ...prev, category: cat.id }));
              setStep('template');
            }}
            className="group p-6 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-purple-500 hover:bg-slate-800 transition-all text-left"
          >
            <div className="text-4xl mb-3">{cat.icon}</div>
            <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors">{cat.name}</h3>
            <p className="text-sm text-slate-400 mt-1">{cat.description}</p>
          </button>
        ))}
      </div>
    </div>
  );

  // Template selection step
  const renderTemplateStep = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => setStep('category')}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">Choose a Template</h2>
          <p className="text-slate-400">Select a starting point for your design</p>
        </div>
      </div>

      {/* Size selector */}
      <div className="mb-6">
        <label className="text-sm font-medium text-slate-300 mb-2 block">Output Size</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(FLIER_SIZES).map(([key, size]) => (
            <button
              key={key}
              onClick={() => setDesignData(prev => ({ ...prev, size: key as FlierSize }))}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                designData.size === key 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {size.icon} {size.label}
            </button>
          ))}
        </div>
      </div>

      {/* Templates grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {TEMPLATES.map(template => (
          <button
            key={template.id}
            onClick={() => {
              setDesignData(prev => ({ ...prev, templateId: template.id }));
              setStep('editor');
            }}
            className={`group p-6 rounded-2xl border transition-all text-left ${
              designData.templateId === template.id
                ? 'bg-purple-600/20 border-purple-500'
                : 'bg-slate-800/50 border-slate-700 hover:border-purple-500'
            }`}
          >
            <div className="text-4xl mb-3">{template.preview}</div>
            <h3 className="font-semibold text-white">{template.name}</h3>
            <p className="text-sm text-slate-400 mt-1">{template.description}</p>
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={() => setStep('editor')}
        >
          Continue to Editor
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  // Main editor step
  const renderEditorStep = () => (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Left panel - Controls */}
      <div className="lg:w-96 space-y-4 overflow-y-auto">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={() => setStep('template')}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-white">Edit Design</h2>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg">
          {[
            { id: 'content', label: 'Content', icon: Type },
            { id: 'style', label: 'Style', icon: Palette },
            { id: 'layout', label: 'Layout', icon: Layout },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <GlassCard className="p-4 space-y-4">
          {activeTab === 'content' && (
            <>
              {/* Title */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1 block">Title *</label>
                <input
                  type="text"
                  value={designData.title}
                  onChange={(e) => setDesignData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter your headline"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1 block">Subtitle</label>
                <input
                  type="text"
                  value={designData.subtitle || ''}
                  onChange={(e) => setDesignData(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Optional tagline"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1 block">Date</label>
                  <input
                    type="text"
                    value={designData.date || ''}
                    onChange={(e) => setDesignData(prev => ({ ...prev, date: e.target.value }))}
                    placeholder="Dec 15, 2025"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1 block">Time</label>
                  <input
                    type="text"
                    value={designData.time || ''}
                    onChange={(e) => setDesignData(prev => ({ ...prev, time: e.target.value }))}
                    placeholder="6:00 PM"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1 block">Location</label>
                <input
                  type="text"
                  value={designData.location || ''}
                  onChange={(e) => setDesignData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Venue name & address"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Price */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1 block">Price / Cost</label>
                <input
                  type="text"
                  value={designData.price || ''}
                  onChange={(e) => setDesignData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="$25 per player"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1 block">Description</label>
                <textarea
                  value={designData.description || ''}
                  onChange={(e) => setDesignData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none resize-none"
                />
              </div>

              {/* Custom message */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1 block">Call to Action</label>
                <input
                  type="text"
                  value={designData.customMessage || ''}
                  onChange={(e) => setDesignData(prev => ({ ...prev, customMessage: e.target.value }))}
                  placeholder="Register today! Limited spots!"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {activeTab === 'style' && (
            <>
              {/* Background color */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1 block">Background Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={designData.backgroundColor}
                    onChange={(e) => setDesignData(prev => ({ ...prev, backgroundColor: e.target.value }))}
                    className="w-12 h-10 rounded cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={designData.backgroundColor}
                    onChange={(e) => setDesignData(prev => ({ ...prev, backgroundColor: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Accent color */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1 block">Accent Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={designData.accentColor}
                    onChange={(e) => setDesignData(prev => ({ ...prev, accentColor: e.target.value }))}
                    className="w-12 h-10 rounded cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={designData.accentColor}
                    onChange={(e) => setDesignData(prev => ({ ...prev, accentColor: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Text color */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1 block">Text Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={designData.textColor}
                    onChange={(e) => setDesignData(prev => ({ ...prev, textColor: e.target.value }))}
                    className="w-12 h-10 rounded cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={designData.textColor}
                    onChange={(e) => setDesignData(prev => ({ ...prev, textColor: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick color presets */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Quick Presets</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { bg: '#1e3a5f', accent: '#f59e0b' },
                    { bg: '#1f2937', accent: '#8b5cf6' },
                    { bg: '#064e3b', accent: '#34d399' },
                    { bg: '#7f1d1d', accent: '#fbbf24' },
                    { bg: '#1e1b4b', accent: '#a78bfa' },
                    { bg: '#0c4a6e', accent: '#38bdf8' },
                    { bg: '#422006', accent: '#fb923c' },
                    { bg: '#171717', accent: '#ffffff' },
                  ].map((preset, i) => (
                    <button
                      key={i}
                      onClick={() => setDesignData(prev => ({ 
                        ...prev, 
                        backgroundColor: preset.bg, 
                        accentColor: preset.accent 
                      }))}
                      className="h-10 rounded-lg border-2 border-transparent hover:border-white/50 transition-all overflow-hidden"
                      style={{ background: `linear-gradient(135deg, ${preset.bg} 60%, ${preset.accent} 100%)` }}
                    />
                  ))}
                </div>
              </div>

              {/* Header image upload */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1 block">Header Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload('header')}
                  className="hidden"
                  id="header-upload"
                />
                <label
                  htmlFor="header-upload"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-slate-800 border border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-purple-500 hover:text-purple-400 cursor-pointer transition-colors"
                >
                  <ImageIcon className="w-5 h-5" />
                  {designData.headerImage ? 'Change Image' : 'Upload Image'}
                </label>
                {designData.headerImage && (
                  <button
                    onClick={() => setDesignData(prev => ({ ...prev, headerImage: undefined }))}
                    className="text-xs text-red-400 hover:text-red-300 mt-1"
                  >
                    Remove image
                  </button>
                )}
              </div>

              {/* Logo upload */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1 block">Team Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload('logo')}
                  className="hidden"
                  id="logo-upload"
                />
                <label
                  htmlFor="logo-upload"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-slate-800 border border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-purple-500 hover:text-purple-400 cursor-pointer transition-colors"
                >
                  <ImageIcon className="w-5 h-5" />
                  {designData.teamLogo ? 'Change Logo' : 'Upload Logo'}
                </label>
              </div>
            </>
          )}

          {activeTab === 'layout' && (
            <>
              {/* Size selector */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Output Size</label>
                <div className="space-y-2">
                  {Object.entries(FLIER_SIZES).map(([key, size]) => (
                    <button
                      key={key}
                      onClick={() => setDesignData(prev => ({ ...prev, size: key as FlierSize }))}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                        designData.size === key 
                          ? 'bg-purple-600/20 border border-purple-500 text-white' 
                          : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-xl">{size.icon}</span>
                      <div>
                        <div className="font-medium">{size.label}</div>
                        <div className="text-xs text-slate-500">{size.width} × {size.height}px</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* QR Code toggle */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={designData.showQRCode}
                    onChange={(e) => setDesignData(prev => ({ ...prev, showQRCode: e.target.checked }))}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-slate-300">Include QR Code</span>
                </label>
                {designData.showQRCode && (
                  <input
                    type="text"
                    value={designData.qrCodeUrl || ''}
                    onChange={(e) => setDesignData(prev => ({ ...prev, qrCodeUrl: e.target.value }))}
                    placeholder="https://your-link.com"
                    className="w-full mt-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none text-sm"
                  />
                )}
              </div>

              {/* Template switcher */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Template Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map(template => (
                    <button
                      key={template.id}
                      onClick={() => setDesignData(prev => ({ ...prev, templateId: template.id }))}
                      className={`p-3 rounded-lg text-left transition-all ${
                        designData.templateId === template.id
                          ? 'bg-purple-600/20 border border-purple-500'
                          : 'bg-slate-800 border border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-xl">{template.preview}</span>
                      <div className="text-sm font-medium text-white mt-1">{template.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </GlassCard>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setDesignData({
                ...designData,
                title: '',
                subtitle: '',
                date: '',
                time: '',
                location: '',
                description: '',
                price: '',
                customMessage: '',
              });
            }}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button
            variant="primary"
            onClick={() => handleDownload('png')}
            className="flex-1"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>

        {/* Download format options */}
        <div className="flex gap-2">
          <button
            onClick={() => handleDownload('png')}
            className="flex-1 py-2 text-sm bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
          >
            PNG (High Quality)
          </button>
          <button
            onClick={() => handleDownload('jpg')}
            className="flex-1 py-2 text-sm bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
          >
            JPG (Smaller Size)
          </button>
        </div>
      </div>

      {/* Right panel - Canvas preview */}
      <div className="flex-1 flex items-center justify-center bg-slate-900/50 rounded-2xl p-6 overflow-auto">
        <div className="relative">
          {isRendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-lg z-10">
              <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[70vh] rounded-lg shadow-2xl"
            style={{ 
              aspectRatio: `${FLIER_SIZES[designData.size].width} / ${FLIER_SIZES[designData.size].height}` 
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-6">
      {step === 'category' && renderCategoryStep()}
      {step === 'template' && renderTemplateStep()}
      {step === 'editor' && renderEditorStep()}
    </div>
  );
};

export default DesignStudio;
