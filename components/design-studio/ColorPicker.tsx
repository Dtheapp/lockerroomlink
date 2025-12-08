import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Pipette, Palette, ChevronDown, Check } from 'lucide-react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
  showGradients?: boolean;
  teamColors?: string[];
}

// Color presets
const COLOR_PRESETS = {
  basic: [
    '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308', 
    '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  ],
  grays: [
    '#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af',
    '#6b7280', '#4b5563', '#374151', '#1f2937', '#111827',
  ],
  sports: [
    '#1e3a5f', '#b8860b', '#8b0000', '#006400', '#4b0082',
    '#ff4500', '#2f4f4f', '#8b4513', '#000080', '#800000',
  ],
};

const GRADIENT_PRESETS = [
  { name: 'Sunset', value: 'linear-gradient(135deg, #ff6b6b, #feca57)' },
  { name: 'Ocean', value: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { name: 'Forest', value: 'linear-gradient(135deg, #11998e, #38ef7d)' },
  { name: 'Fire', value: 'linear-gradient(135deg, #f12711, #f5af19)' },
  { name: 'Night', value: 'linear-gradient(135deg, #0f0c29, #302b63)' },
  { name: 'Rose', value: 'linear-gradient(135deg, #ee9ca7, #ffdde1)' },
  { name: 'Steel', value: 'linear-gradient(135deg, #bdc3c7, #2c3e50)' },
  { name: 'Royal', value: 'linear-gradient(135deg, #141e30, #243b55)' },
];

const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  onChange,
  label,
  showGradients = false,
  teamColors = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'solid' | 'gradient'>('solid');
  const [customColor, setCustomColor] = useState(color.startsWith('#') ? color : '#000000');
  const pickerRef = useRef<HTMLDivElement>(null);
  
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
  
  const handleColorSelect = useCallback((newColor: string) => {
    onChange(newColor);
    if (newColor.startsWith('#')) {
      setCustomColor(newColor);
    }
  }, [onChange]);
  
  const handleCustomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    onChange(newColor);
  }, [onChange]);
  
  const isGradient = color.includes('gradient');
  
  return (
    <div ref={pickerRef} className="relative">
      {label && (
        <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors"
      >
        <div
          className="w-6 h-6 rounded border border-zinc-600"
          style={{ background: color }}
        />
        <span className="flex-1 text-left text-sm text-zinc-300 truncate">
          {isGradient ? 'Gradient' : color}
        </span>
        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
          {/* Tabs */}
          {showGradients && (
            <div className="flex border-b border-zinc-700">
              <button
                onClick={() => setActiveTab('solid')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'solid'
                    ? 'text-violet-400 border-b-2 border-violet-400 bg-zinc-800/50'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Solid
              </button>
              <button
                onClick={() => setActiveTab('gradient')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'gradient'
                    ? 'text-violet-400 border-b-2 border-violet-400 bg-zinc-800/50'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Gradient
              </button>
            </div>
          )}
          
          <div className="p-3">
            {activeTab === 'solid' ? (
              <>
                {/* Custom Color Input */}
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="color"
                    value={customColor}
                    onChange={handleCustomChange}
                    className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomColor(val);
                      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                        onChange(val);
                      }
                    }}
                    className="flex-1 px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-white font-mono"
                  />
                </div>
                
                {/* Team Colors */}
                {teamColors.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-zinc-500 mb-2">Team Colors</p>
                    <div className="flex gap-1.5">
                      {teamColors.map((c, i) => (
                        <button
                          key={i}
                          onClick={() => handleColorSelect(c)}
                          className={`w-7 h-7 rounded-md border-2 transition-all ${
                            color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Basic Colors */}
                <div className="mb-3">
                  <p className="text-xs text-zinc-500 mb-2">Basic</p>
                  <div className="grid grid-cols-10 gap-1">
                    {COLOR_PRESETS.basic.map((c) => (
                      <button
                        key={c}
                        onClick={() => handleColorSelect(c)}
                        className={`w-5 h-5 rounded border ${
                          color === c ? 'border-white ring-2 ring-violet-500' : 'border-zinc-600'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Gray Colors */}
                <div className="mb-3">
                  <p className="text-xs text-zinc-500 mb-2">Grays</p>
                  <div className="grid grid-cols-10 gap-1">
                    {COLOR_PRESETS.grays.map((c) => (
                      <button
                        key={c}
                        onClick={() => handleColorSelect(c)}
                        className={`w-5 h-5 rounded border ${
                          color === c ? 'border-white ring-2 ring-violet-500' : 'border-zinc-600'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Sports Colors */}
                <div>
                  <p className="text-xs text-zinc-500 mb-2">Sports</p>
                  <div className="grid grid-cols-10 gap-1">
                    {COLOR_PRESETS.sports.map((c) => (
                      <button
                        key={c}
                        onClick={() => handleColorSelect(c)}
                        className={`w-5 h-5 rounded border ${
                          color === c ? 'border-white ring-2 ring-violet-500' : 'border-zinc-600'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* Gradients */
              <div className="grid grid-cols-2 gap-2">
                {GRADIENT_PRESETS.map((g) => (
                  <button
                    key={g.name}
                    onClick={() => handleColorSelect(g.value)}
                    className={`relative h-12 rounded-lg border-2 transition-all ${
                      color === g.value ? 'border-white' : 'border-transparent hover:border-zinc-600'
                    }`}
                    style={{ background: g.value }}
                  >
                    <span className="absolute bottom-1 left-2 text-xs text-white font-medium drop-shadow-lg">
                      {g.name}
                    </span>
                    {color === g.value && (
                      <Check size={16} className="absolute top-1 right-1 text-white" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
