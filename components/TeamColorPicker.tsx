/**
 * Team Color Picker Component
 * Reusable color palette picker for team primary/secondary colors
 * Used in team creation and edit flows
 */

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

// Expanded color palette organized by color family - covers most common team colors
export const TEAM_COLOR_PALETTE = {
  // Reds
  reds: ['#7f1d1d', '#991b1b', '#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5'],
  // Oranges
  oranges: ['#7c2d12', '#9a3412', '#c2410c', '#ea580c', '#f97316', '#fb923c', '#fdba74'],
  // Yellows/Golds
  yellows: ['#713f12', '#854d0e', '#a16207', '#ca8a04', '#eab308', '#facc15', '#fde047'],
  // Greens
  greens: ['#14532d', '#166534', '#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac'],
  // Teals/Cyans
  teals: ['#134e4a', '#115e59', '#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4'],
  // Blues
  blues: ['#1e3a5f', '#1e40af', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
  // Purples
  purples: ['#4c1d95', '#5b21b6', '#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd'],
  // Pinks/Magentas
  pinks: ['#831843', '#9d174d', '#be185d', '#db2777', '#ec4899', '#f472b6', '#f9a8d4'],
  // Neutrals (Black, Gray, White spectrum)
  neutrals: ['#000000', '#171717', '#262626', '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4', '#ffffff'],
  // Metallic/Special (common for sports)
  metallics: ['#b8860b', '#c0c0c0', '#cd7f32', '#ffd700', '#8b4513', '#2f4f4f']
};

interface TeamColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  showHexInput?: boolean;
}

export const TeamColorPicker: React.FC<TeamColorPickerProps> = ({
  label,
  value,
  onChange,
  showHexInput = true
}) => {
  const { theme } = useTheme();

  return (
    <div>
      <label className={`text-xs font-medium block mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        {label}
      </label>
      <div className="flex flex-wrap gap-1">
        {Object.entries(TEAM_COLOR_PALETTE).map(([family, colors]) => (
          <div key={`${label}-${family}`} className="flex gap-0.5">
            {colors.map((c) => (
              <button
                key={`${label}-${c}`}
                type="button"
                onClick={() => onChange(c)}
                className={`w-5 h-5 rounded transition-all border ${
                  c === '#ffffff' ? 'border-gray-300' : 'border-transparent'
                } ${
                  value === c 
                    ? `ring-2 ring-offset-1 scale-125 z-10 ${theme === 'dark' ? 'ring-purple-400 ring-offset-gray-800' : 'ring-purple-600 ring-offset-white'}` 
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        ))}
      </div>
      {showHexInput && (
        <div className="flex items-center gap-2 mt-2">
          <div 
            className="w-8 h-8 rounded-lg border-2 border-white shadow-md flex-shrink-0"
            style={{ backgroundColor: value }}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const hex = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
              if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex) || hex.length <= 7) {
                onChange(hex.toLowerCase());
              }
            }}
            placeholder="#000000"
            maxLength={7}
            className={`flex-1 px-2 py-1.5 text-sm font-mono rounded border focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
              theme === 'dark' 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
            }`}
          />
        </div>
      )}
    </div>
  );
};

// Team color preview component
interface TeamColorPreviewProps {
  primaryColor: string;
  secondaryColor: string;
  teamName?: string;
}

export const TeamColorPreview: React.FC<TeamColorPreviewProps> = ({
  primaryColor,
  secondaryColor,
  teamName = 'Team Name'
}) => {
  const { theme } = useTheme();
  
  return (
    <div className={`flex items-center gap-4 rounded-lg p-4 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
      <div 
        className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl overflow-hidden relative shadow-lg"
      >
        <div 
          className="absolute inset-0"
          style={{ 
            background: `linear-gradient(135deg, ${primaryColor} 50%, ${secondaryColor} 50%)`
          }}
        />
        <span className="relative z-10 drop-shadow-lg">{teamName?.charAt(0) || 'T'}</span>
      </div>
      <div className="flex-1">
        <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{teamName || 'Team Name'}</p>
        <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Color Preview</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded shadow-sm" style={{ backgroundColor: primaryColor }} />
            <span className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{primaryColor}</span>
          </div>
          <span className={`text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>/</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded shadow-sm" style={{ backgroundColor: secondaryColor }} />
            <span className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{secondaryColor}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamColorPicker;
