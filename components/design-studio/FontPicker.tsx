import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Type } from 'lucide-react';

interface FontPickerProps {
  font: string;
  onChange: (font: string) => void;
  label?: string;
}

// Web-safe fonts with display names
export const FONT_OPTIONS = [
  // Sans-serif
  { name: 'Inter', value: 'Inter, sans-serif', category: 'Sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif', category: 'Sans-serif' },
  { name: 'Helvetica', value: 'Helvetica, sans-serif', category: 'Sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif', category: 'Sans-serif' },
  { name: 'Open Sans', value: "'Open Sans', sans-serif", category: 'Sans-serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif', category: 'Sans-serif' },
  { name: 'Poppins', value: 'Poppins, sans-serif', category: 'Sans-serif' },
  { name: 'Lato', value: 'Lato, sans-serif', category: 'Sans-serif' },
  { name: 'Oswald', value: 'Oswald, sans-serif', category: 'Sans-serif' },
  { name: 'Bebas Neue', value: "'Bebas Neue', sans-serif", category: 'Sans-serif' },
  
  // Serif
  { name: 'Times New Roman', value: "'Times New Roman', serif", category: 'Serif' },
  { name: 'Georgia', value: 'Georgia, serif', category: 'Serif' },
  { name: 'Playfair Display', value: "'Playfair Display', serif", category: 'Serif' },
  { name: 'Merriweather', value: 'Merriweather, serif', category: 'Serif' },
  { name: 'Lora', value: 'Lora, serif', category: 'Serif' },
  
  // Display
  { name: 'Impact', value: 'Impact, sans-serif', category: 'Display' },
  { name: 'Anton', value: 'Anton, sans-serif', category: 'Display' },
  { name: 'Passion One', value: "'Passion One', display", category: 'Display' },
  { name: 'Black Ops One', value: "'Black Ops One', display", category: 'Display' },
  { name: 'Bangers', value: 'Bangers, cursive', category: 'Display' },
  { name: 'Permanent Marker', value: "'Permanent Marker', cursive", category: 'Display' },
  
  // Monospace
  { name: 'Courier New', value: "'Courier New', monospace", category: 'Monospace' },
  { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace", category: 'Monospace' },
  { name: 'Fira Code', value: "'Fira Code', monospace", category: 'Monospace' },
  
  // Script
  { name: 'Brush Script', value: "'Brush Script MT', cursive", category: 'Script' },
  { name: 'Dancing Script', value: "'Dancing Script', cursive", category: 'Script' },
  { name: 'Pacifico', value: 'Pacifico, cursive', category: 'Script' },
];

// Group fonts by category
const groupedFonts = FONT_OPTIONS.reduce((acc, font) => {
  if (!acc[font.category]) {
    acc[font.category] = [];
  }
  acc[font.category].push(font);
  return acc;
}, {} as Record<string, typeof FONT_OPTIONS>);

const FontPicker: React.FC<FontPickerProps> = ({ font, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  
  // Find current font name
  const currentFont = FONT_OPTIONS.find(f => f.value === font)?.name || font.split(',')[0].replace(/'/g, '');
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Filter fonts by search
  const filteredFonts = searchQuery
    ? FONT_OPTIONS.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;
  
  return (
    <div ref={pickerRef} className="relative">
      {label && (
        <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors"
      >
        <Type size={14} className="text-zinc-500" />
        <span 
          className="flex-1 text-left text-sm text-zinc-300 truncate"
          style={{ fontFamily: font }}
        >
          {currentFont}
        </span>
        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-zinc-700">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fonts..."
              className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              autoFocus
            />
          </div>
          
          {/* Font List */}
          <div className="max-h-72 overflow-y-auto">
            {filteredFonts ? (
              // Search results
              <div className="p-1">
                {filteredFonts.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => {
                      onChange(f.value);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                      ${font === f.value ? 'bg-violet-600/20 text-violet-400' : 'text-zinc-300 hover:bg-zinc-800'}
                    `}
                  >
                    <span style={{ fontFamily: f.value }}>{f.name}</span>
                    {font === f.value && <Check size={14} />}
                  </button>
                ))}
                {filteredFonts.length === 0 && (
                  <div className="px-3 py-6 text-center text-zinc-500 text-sm">
                    No fonts found
                  </div>
                )}
              </div>
            ) : (
              // Grouped fonts
              Object.entries(groupedFonts).map(([category, fonts]) => (
                <div key={category}>
                  <div className="px-3 py-2 text-xs text-zinc-500 font-medium bg-zinc-800/50 sticky top-0">
                    {category}
                  </div>
                  <div className="p-1">
                    {fonts.map((f) => (
                      <button
                        key={f.value}
                        onClick={() => {
                          onChange(f.value);
                          setIsOpen(false);
                        }}
                        className={`
                          w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                          ${font === f.value ? 'bg-violet-600/20 text-violet-400' : 'text-zinc-300 hover:bg-zinc-800'}
                        `}
                      >
                        <span style={{ fontFamily: f.value }}>{f.name}</span>
                        {font === f.value && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Tip */}
          <div className="px-3 py-2 bg-zinc-800/50 border-t border-zinc-700">
            <p className="text-xs text-zinc-500">
              Tip: Some fonts may require Google Fonts to be loaded
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FontPicker;
