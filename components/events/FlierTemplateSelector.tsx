import React, { useState } from 'react';

export interface FlierTemplateOption {
  id: string;
  name: string;
  description: string;
  previewColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  features: string[];
}

const TEMPLATES: FlierTemplateOption[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional sports flier with header bar and centered content',
    previewColors: {
      primary: '#1e3a5f',
      secondary: '#ffffff',
      accent: '#f59e0b',
    },
    features: ['Header accent bar', 'Centered layout', 'Clear hierarchy'],
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean, contemporary design with gradient background and accent shapes',
    previewColors: {
      primary: '#0f172a',
      secondary: '#ffffff',
      accent: '#3b82f6',
    },
    features: ['Gradient background', 'Accent shapes', 'Date highlight box'],
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'High contrast, attention-grabbing design with split background',
    previewColors: {
      primary: '#111827',
      secondary: '#ffffff',
      accent: '#ef4444',
    },
    features: ['Split background', 'Large typography', 'Diagonal stripe'],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple and elegant with clean white background',
    previewColors: {
      primary: '#374151',
      secondary: '#ffffff',
      accent: '#10b981',
    },
    features: ['White background', 'Clean lines', 'Elegant typography'],
  },
];

interface FlierTemplateSelectorProps {
  selectedTemplate: string;
  onSelect: (templateId: string) => void;
  teamColors?: { primary: string; secondary: string };
}

export const FlierTemplateSelector: React.FC<FlierTemplateSelectorProps> = ({
  selectedTemplate,
  onSelect,
  teamColors,
}) => {
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Choose a Flier Template
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Select a template style for your event flier. You can customize colors and content later.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TEMPLATES.map((template) => {
          const isSelected = selectedTemplate === template.id;
          const isHovered = hoveredTemplate === template.id;
          const colors = teamColors || template.previewColors;

          return (
            <button
              key={template.id}
              onClick={() => onSelect(template.id)}
              onMouseEnter={() => setHoveredTemplate(template.id)}
              onMouseLeave={() => setHoveredTemplate(null)}
              className={`relative rounded-xl overflow-hidden transition-all ${
                isSelected
                  ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900'
                  : 'hover:shadow-lg'
              }`}
            >
              {/* Template Preview */}
              <div className="aspect-square relative">
                <TemplatePreview
                  templateId={template.id}
                  colors={colors}
                  isHovered={isHovered}
                />

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Template Info */}
              <div className="p-3 bg-white dark:bg-gray-800 text-left">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  {template.name}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                  {template.description}
                </p>
                
                {/* Features */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {template.features.map((feature, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Team colors notice */}
      {teamColors && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-center text-sm text-blue-700 dark:text-blue-300">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            <span>Previews are showing your team colors. You can customize them in the editor.</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Mini template preview component
interface TemplatePreviewProps {
  templateId: string;
  colors: { primary: string; secondary: string; accent?: string };
  isHovered: boolean;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  templateId,
  colors,
  isHovered,
}) => {
  const accent = colors.accent || '#f59e0b';

  switch (templateId) {
    case 'classic':
      return (
        <div className="w-full h-full" style={{ backgroundColor: colors.primary }}>
          {/* Header bar */}
          <div className="h-[15%]" style={{ backgroundColor: accent }} />
          
          {/* Content area */}
          <div className="flex flex-col items-center justify-center h-[85%] px-4">
            {/* Title placeholder */}
            <div className="w-3/4 h-4 bg-white/80 rounded mb-3" />
            <div className="w-1/2 h-3 bg-white/60 rounded mb-6" />
            
            {/* Divider */}
            <div className="w-2/3 h-0.5 mb-6" style={{ backgroundColor: accent }} />
            
            {/* Details placeholders */}
            <div className="w-1/2 h-3 bg-white/60 rounded mb-2" />
            <div className="w-1/3 h-2 bg-white/40 rounded mb-4" />
            
            {/* QR placeholder */}
            <div 
              className={`w-12 h-12 bg-white rounded transition-transform ${isHovered ? 'scale-110' : ''}`}
            />
          </div>
        </div>
      );

    case 'modern':
      return (
        <div className="w-full h-full relative overflow-hidden">
          {/* Gradient background */}
          <div 
            className="absolute inset-0"
            style={{ 
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${adjustColor(colors.primary, -30)} 100%)` 
            }}
          />
          
          {/* Accent shape */}
          <div 
            className="absolute top-[35%] left-0 w-[35%] h-[5%]"
            style={{ 
              backgroundColor: accent,
              clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)'
            }}
          />
          
          {/* Content */}
          <div className="relative h-full flex flex-col px-4 pt-4">
            {/* Logo placeholder */}
            <div className="w-8 h-8 bg-white/30 rounded mb-8" />
            
            {/* Title */}
            <div className="w-3/4 h-4 bg-white/80 rounded mb-2 mt-4" />
            <div className="w-1/2 h-3 bg-white/60 rounded mb-4" />
            
            {/* Date box */}
            <div 
              className="w-2/3 h-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: accent }}
            >
              <div className="w-1/2 h-2 bg-white/80 rounded" />
            </div>
            
            {/* QR placeholder */}
            <div 
              className={`absolute bottom-4 right-4 w-10 h-10 bg-white rounded shadow transition-transform ${isHovered ? 'scale-110' : ''}`}
            />
          </div>
        </div>
      );

    case 'bold':
      return (
        <div className="w-full h-full relative overflow-hidden">
          {/* Split background */}
          <div className="absolute top-0 left-0 w-full h-1/2" style={{ backgroundColor: accent }} />
          <div className="absolute bottom-0 left-0 w-full h-1/2" style={{ backgroundColor: colors.primary }} />
          
          {/* Diagonal stripe */}
          <div 
            className="absolute top-[30%] left-0 w-full h-[30%]"
            style={{ 
              backgroundColor: colors.primary,
              clipPath: 'polygon(0 30%, 100% 0, 100% 70%, 0 100%)'
            }}
          />
          
          {/* Content */}
          <div className="relative h-full flex flex-col items-center justify-center">
            {/* Large title */}
            <div className="w-4/5 h-6 bg-white/90 rounded mb-4" />
            
            {/* Date */}
            <div className="w-1/2 h-4 bg-white/80 rounded mb-2" />
            <div className="w-1/3 h-3 bg-white/60 rounded mb-4" />
            
            {/* Pricing */}
            <div className="w-1/3 h-4 rounded" style={{ backgroundColor: accent }} />
          </div>
          
          {/* Corner elements */}
          <div 
            className={`absolute bottom-3 left-3 w-8 h-8 bg-white rounded transition-transform ${isHovered ? 'scale-110' : ''}`}
          />
          <div className="absolute bottom-3 right-3 w-6 h-6 bg-white/30 rounded" />
        </div>
      );

    case 'minimal':
      return (
        <div className="w-full h-full bg-white relative">
          {/* Top accent line */}
          <div className="h-1" style={{ backgroundColor: accent }} />
          
          {/* Content */}
          <div className="h-full flex flex-col items-center pt-6 px-4">
            {/* Logo placeholder */}
            <div className="w-10 h-10 rounded-full mb-4" style={{ backgroundColor: colors.primary + '30' }} />
            
            {/* Title */}
            <div className="w-3/4 h-3 rounded mb-2" style={{ backgroundColor: colors.primary + '60' }} />
            <div className="w-1/2 h-2 rounded mb-4" style={{ backgroundColor: colors.primary + '40' }} />
            
            {/* Divider */}
            <div className="w-2/3 h-px bg-gray-200 mb-4" />
            
            {/* Details */}
            <div className="w-1/2 h-2 rounded mb-2" style={{ backgroundColor: colors.primary + '40' }} />
            <div className="w-1/3 h-2 rounded mb-4" style={{ backgroundColor: colors.primary + '30' }} />
            
            {/* Pricing */}
            <div className="w-1/4 h-3 rounded mb-4" style={{ backgroundColor: accent + '80' }} />
            
            {/* QR */}
            <div 
              className={`w-10 h-10 border-2 rounded transition-transform ${isHovered ? 'scale-110' : ''}`}
              style={{ borderColor: colors.primary + '40' }}
            />
          </div>
          
          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: accent }} />
        </div>
      );

    default:
      return <div className="w-full h-full bg-gray-200" />;
  }
};

// Helper function
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

export default FlierTemplateSelector;
